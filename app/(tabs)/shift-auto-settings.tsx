import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Alert, Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../../firebase';

const DEFAULT_SITES = ['warp', 'thewarp', 'ラドンナ', '他'];

interface LeaderEntry { userId: string; name: string; }

export default function ShiftAutoSettingsScreen() {
  const router = useRouter();
  const [allStaff, setAllStaff] = useState<any[]>([]);
  const [sitesList, setSitesList] = useState<string[]>(DEFAULT_SITES);
  const [leaders, setLeaders] = useState<LeaderEntry[]>([]);
  const [storeRequirements, setStoreRequirements] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const siteSnap = await getDoc(doc(db, 'settings', 'siteConfig'));
        const sites = (siteSnap.exists() && siteSnap.data().sites) ? siteSnap.data().sites : DEFAULT_SITES;
        setSitesList(sites);

        const usersSnap = await getDocs(collection(db, 'users'));
        const staffList: any[] = [];
        usersSnap.forEach(d => {
          const u = d.data();
          if (u.role !== 'admin') staffList.push({ id: d.id, ...u });
        });
        setAllStaff(staffList);

        const configSnap = await getDoc(doc(db, 'settings', 'autoShiftConfig'));
        if (configSnap.exists()) {
          const config = configSnap.data();
          if (Array.isArray(config.leaders)) setLeaders(config.leaders);
          if (config.storeRequirements) {
            const req: Record<string, string> = {};
            Object.entries(config.storeRequirements).forEach(([site, count]) => {
              req[site] = String(count);
            });
            setStoreRequirements(req);
          }
        }
      } catch {}
      setLoading(false);
    };
    fetchData();
  }, []);

  const isLeader = (userId: string) => leaders.some(l => l.userId === userId);

  const addLeader = (staff: any) => {
    setLeaders(prev => [...prev, { userId: staff.id, name: staff.name }]);
  };

  const removeLeader = (userId: string) => {
    setLeaders(prev => prev.filter(l => l.userId !== userId));
  };

  const moveLeaderUp = (index: number) => {
    if (index === 0) return;
    const next = [...leaders];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    setLeaders(next);
  };

  const moveLeaderDown = (index: number) => {
    if (index === leaders.length - 1) return;
    const next = [...leaders];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    setLeaders(next);
  };

  const handleSave = async () => {
    try {
      const reqNumbers: Record<string, number> = {};
      Object.entries(storeRequirements).forEach(([site, val]) => {
        const n = parseInt(val, 10);
        if (!isNaN(n) && n >= 0) reqNumbers[site] = n;
      });

      await setDoc(doc(db, 'settings', 'autoShiftConfig'), {
        leaders,
        storeRequirements: reqNumbers,
      });
      Alert.alert('保存完了', '設定を保存しました');
    } catch {
      Alert.alert('エラー', '保存に失敗しました');
    }
  };

  const nonLeaderStaff = allStaff.filter(s => !isLeader(s.id));

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.push('/admin-menu')}>
            <Ionicons name="arrow-back" size={24} color="#B8860B" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>シフト自動入力設定</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#94a3b8' }}>読み込み中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/admin-menu')}>
          <Ionicons name="arrow-back" size={24} color="#B8860B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>シフト自動入力設定</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>

        {/* ── リーダー優先順位 ── */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>リーダー優先順位</Text>
          <Text style={styles.sectionDesc}>自動入力時に優先して配置されるリーダーの順位を設定します。上ほど優先されます。</Text>

          {leaders.length === 0 && (
            <Text style={styles.emptyText}>リーダーが設定されていません</Text>
          )}

          {leaders.map((leader, index) => (
            <View key={leader.userId} style={styles.leaderRow}>
              <View style={styles.priorityBadge}>
                <Text style={styles.priorityText}>{index + 1}</Text>
              </View>
              <Text style={styles.leaderName}>{leader.name}</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <TouchableOpacity
                  style={[styles.arrowBtn, index === 0 && { opacity: 0.3 }]}
                  onPress={() => moveLeaderUp(index)}
                  disabled={index === 0}
                >
                  <Ionicons name="chevron-up" size={18} color="#B8860B" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.arrowBtn, index === leaders.length - 1 && { opacity: 0.3 }]}
                  onPress={() => moveLeaderDown(index)}
                  disabled={index === leaders.length - 1}
                >
                  <Ionicons name="chevron-down" size={18} color="#B8860B" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.removeBtn} onPress={() => removeLeader(leader.userId)}>
                  <Ionicons name="close" size={18} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        {/* ── スタッフからリーダー追加 ── */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>スタッフをリーダーに追加</Text>
          {nonLeaderStaff.length === 0 ? (
            <Text style={styles.emptyText}>全スタッフがリーダーに設定されています</Text>
          ) : (
            nonLeaderStaff.map(staff => (
              <TouchableOpacity key={staff.id} style={styles.staffRow} onPress={() => addLeader(staff)}>
                <View>
                  <Text style={styles.staffName}>{staff.name}</Text>
                  <Text style={{ fontSize: 11, color: '#94a3b8' }}>{staff.role || 'アルバイト'}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 12, color: '#10B981', fontWeight: 'bold' }}>リーダーに設定</Text>
                  <Ionicons name="add-circle-outline" size={24} color="#10B981" />
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* ── 店舗別確保人数 ── */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>店舗別確保人数</Text>
          <Text style={styles.sectionDesc}>自動入力時に各店舗で配置する人数を設定します。「他」は手動入力のため対象外です。</Text>

          {sitesList.filter(s => s !== '他').map(site => (
            <View key={site} style={styles.storeRow}>
              <Text style={styles.storeName}>{site.toUpperCase()}</Text>
              <View style={styles.countInputRow}>
                <TextInput
                  style={styles.countField}
                  value={storeRequirements[site] ?? ''}
                  onChangeText={val => setStoreRequirements(prev => ({ ...prev, [site]: val }))}
                  keyboardType="numeric"
                  placeholder="0"
                  maxLength={2}
                  textAlign="center"
                />
                <Text style={styles.countUnit}>人</Text>
              </View>
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <Ionicons name="save-outline" size={20} color="#FFF" />
          <Text style={styles.saveBtnText}>設定を保存する</Text>
        </TouchableOpacity>
      </ScrollView>
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
  sectionCard: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 20,
    marginBottom: 16, borderWidth: 1, borderColor: '#E2E8F0',
  },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1e293b', marginBottom: 6 },
  sectionDesc: { fontSize: 12, color: '#64748b', marginBottom: 15, lineHeight: 18 },
  emptyText: { color: '#94a3b8', fontSize: 13, paddingVertical: 8 },
  leaderRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFBEB', padding: 14, borderRadius: 12, marginBottom: 10,
    borderWidth: 1, borderColor: '#FDE68A',
  },
  priorityBadge: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#B8860B', justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  priorityText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  leaderName: { flex: 1, fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
  arrowBtn: {
    width: 32, height: 32, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#F8FAFC', borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0',
  },
  removeBtn: {
    width: 32, height: 32, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#FEF2F2', borderRadius: 8,
  },
  staffRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 14, borderBottomWidth: 1, borderColor: '#F1F5F9',
  },
  staffName: { fontSize: 16, color: '#1e293b', fontWeight: 'bold' },
  storeRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 14, borderBottomWidth: 1, borderColor: '#F1F5F9',
  },
  storeName: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
  countInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  countField: {
    width: 56, fontSize: 20, fontWeight: 'bold',
    backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#CBD5E1',
    borderRadius: 10, paddingVertical: 8,
  },
  countUnit: { fontSize: 16, color: '#64748b', fontWeight: 'bold' },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#B8860B', padding: 18, borderRadius: 15, marginTop: 8,
  },
  saveBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
});
