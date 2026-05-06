import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, doc, getDoc, getDocs, orderBy, query, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Alert, Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { db } from '../../firebase';

type RequestStatus = 'pending' | 'approved' | 'rejected';

interface DailyPayRequest {
  id: string;
  userId: string;
  userName: string;
  date: string;
  amount: number;
  note?: string;
  status: RequestStatus;
  createdAt: string;
}

const statusInfo = (s: RequestStatus) => {
  if (s === 'approved') return { text: '承認済', color: '#10B981', bg: '#D1FAE5' };
  if (s === 'rejected') return { text: '却下', color: '#EF4444', bg: '#FEE2E2' };
  return { text: '申請中', color: '#F59E0B', bg: '#FEF3C7' };
};

export default function DailyPayApprovalScreen() {
  const router = useRouter();
  const [requests, setRequests] = useState<DailyPayRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved'>('pending');

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'dailyPayRequests'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const reqs: DailyPayRequest[] = [];
      snap.forEach(d => reqs.push({ id: d.id, ...d.data() } as DailyPayRequest));
      setRequests(reqs);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchRequests(); }, []);

  const handleApprove = (req: DailyPayRequest) => {
    Alert.alert(
      '承認確認',
      `${req.userName} の ${req.date} 日払い申請\n¥${req.amount.toLocaleString()} を承認しますか？\n\n承認するとその月の給与から天引きされます。`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '承認する', onPress: async () => {
            try {
              await updateDoc(doc(db, 'dailyPayRequests', req.id), { status: 'approved' });

              const monthKey = req.date.substring(0, 7);
              const userRef = doc(db, 'users', req.userId);
              const userDoc = await getDoc(userRef);
              if (userDoc.exists()) {
                const current = userDoc.data().advancePayments || {};
                const prev = current[monthKey] || 0;
                await updateDoc(userRef, {
                  advancePayments: { ...current, [monthKey]: prev + req.amount }
                });
              }

              setRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'approved' } : r));
              Alert.alert('承認完了', `¥${req.amount.toLocaleString()} を承認しました`);
            } catch {
              Alert.alert('エラー', '承認処理に失敗しました');
            }
          }
        }
      ]
    );
  };

  const handleReject = (req: DailyPayRequest) => {
    Alert.alert(
      '却下確認',
      `${req.userName} の日払い申請 ¥${req.amount.toLocaleString()} を却下しますか？`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '却下する', style: 'destructive', onPress: async () => {
            try {
              await updateDoc(doc(db, 'dailyPayRequests', req.id), { status: 'rejected' });
              setRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'rejected' } : r));
            } catch {
              Alert.alert('エラー', '却下処理に失敗しました');
            }
          }
        }
      ]
    );
  };

  const filtered = requests.filter(r => {
    if (filter === 'pending') return r.status === 'pending';
    if (filter === 'approved') return r.status === 'approved';
    return true;
  });

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/admin-menu')}>
          <Ionicons name="arrow-back" size={24} color="#B8860B" />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={styles.headerTitle}>日払い承認</Text>
          {pendingCount > 0 && (
            <View style={{ backgroundColor: '#EF4444', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 }}>
              <Text style={{ color: '#FFF', fontSize: 12, fontWeight: 'bold' }}>{pendingCount}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity onPress={fetchRequests}>
          <Ionicons name="refresh" size={24} color="#B8860B" />
        </TouchableOpacity>
      </View>

      {/* フィルタータブ */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}>
        {([['pending', '申請中'], ['approved', '承認済'], ['all', 'すべて']] as const).map(([key, label]) => (
          <TouchableOpacity
            key={key}
            style={[styles.filterTab, filter === key && styles.filterTabActive]}
            onPress={() => setFilter(key)}
          >
            <Text style={[styles.filterTabText, filter === key && { color: '#FFF' }]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#94a3b8' }}>読み込み中...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
          {filtered.length === 0 && (
            <View style={{ alignItems: 'center', marginTop: 60 }}>
              <Ionicons name="checkmark-circle-outline" size={48} color="#CBD5E1" />
              <Text style={{ color: '#94a3b8', marginTop: 12, fontSize: 15 }}>
                {filter === 'pending' ? '未処理の申請はありません' : '該当する申請はありません'}
              </Text>
            </View>
          )}
          {filtered.map(req => {
            const s = statusInfo(req.status);
            return (
              <View key={req.id} style={styles.card}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#1e293b' }}>{req.userName}</Text>
                    <Text style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>対象日: {req.date}</Text>
                    {req.note ? <Text style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>備考: {req.note}</Text> : null}
                    <Text style={{ fontSize: 11, color: '#CBD5E1', marginTop: 4 }}>
                      申請日時: {req.createdAt ? new Date(req.createdAt).toLocaleString('ja-JP') : '—'}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#1e293b' }}>
                      ¥{(req.amount || 0).toLocaleString()}
                    </Text>
                    <View style={{ backgroundColor: s.bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}>
                      <Text style={{ fontSize: 12, fontWeight: 'bold', color: s.color }}>{s.text}</Text>
                    </View>
                  </View>
                </View>

                {req.status === 'pending' && (
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                    <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReject(req)}>
                      <Text style={styles.rejectBtnText}>却下</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.approveBtn} onPress={() => handleApprove(req)}>
                      <Ionicons name="checkmark" size={16} color="#FFF" />
                      <Text style={styles.approveBtnText}>承認する</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  header: {
    paddingHorizontal: 20, paddingVertical: 15,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6', backgroundColor: '#FFF',
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
  filterTab: {
    paddingVertical: 7, paddingHorizontal: 16, borderRadius: 20,
    backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0',
  },
  filterTabActive: { backgroundColor: '#B8860B', borderColor: '#B8860B' },
  filterTabText: { fontSize: 13, fontWeight: 'bold', color: '#64748b' },
  card: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 18,
    marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0',
  },
  rejectBtn: {
    flex: 1, padding: 12, borderRadius: 10, alignItems: 'center',
    backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FCA5A5',
  },
  rejectBtnText: { color: '#EF4444', fontWeight: 'bold', fontSize: 14 },
  approveBtn: {
    flex: 2, padding: 12, borderRadius: 10, alignItems: 'center',
    backgroundColor: '#10B981', flexDirection: 'row', justifyContent: 'center', gap: 6,
  },
  approveBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
});
