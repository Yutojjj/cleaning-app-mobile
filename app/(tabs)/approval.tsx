import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, doc, getDoc, getDocs, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Alert, Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { db } from '../../firebase';

export default function ApprovalScreen() {
  const router = useRouter();
  const [approvalList, setApprovalList] = useState<any[]>([]);

  const fetchApprovals = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const curMonthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      const approvals: any[] = [];
      
      querySnapshot.forEach((docSnap) => {
        const u = docSnap.data();
        if (u.role !== 'admin' && u.monthlyStatus && u.monthlyStatus[curMonthKey] === 'submitted') {
          approvals.push({ id: docSnap.id, name: u.name, currentMonthKey: curMonthKey });
        }
      });
      setApprovalList(approvals);
    } catch (error) { console.error(error); }
  };

  useEffect(() => { fetchApprovals(); }, []);

  const approveStaff = async (staffId: string, monthKey: string) => {
    try {
      const dRef = doc(db, 'users', staffId);
      const dSnap = await getDoc(dRef);
      if (dSnap.exists()) {
        const d = dSnap.data();
        const nextStatus = { ...(d.monthlyStatus || {}), [monthKey]: 'approved' };
        await updateDoc(dRef, { monthlyStatus: nextStatus });
        Alert.alert("承認完了", "実績を承認しました。");
        fetchApprovals();
      }
    } catch (e) { console.error(e); }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        {/* メニューに戻るための矢印ボタン */}
        <TouchableOpacity onPress={() => router.push('/')}>
          <Ionicons name="arrow-back" size={28} color="#B8860B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>申請・承認管理</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 15, color: '#1e293b' }}>提出済みの実績 ({approvalList.length}件)</Text>
        
        {approvalList.length === 0 ? (
          <Text style={{ color: '#94a3b8' }}>承認待ちのデータはありません。</Text>
        ) : (
          approvalList.map(item => (
            <View key={item.id} style={localStyles.approvalRow}>
              <View>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1e293b' }}>{item.name}</Text>
                <Text style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>対象月: {item.currentMonthKey}</Text>
              </View>
              <TouchableOpacity style={localStyles.approveBtn} onPress={() => approveStaff(item.id, item.currentMonthKey)}>
                <Text style={{ color: '#FFF', fontWeight: 'bold' }}>一括承認</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  header: { paddingHorizontal: 20, paddingVertical: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
});

const localStyles = StyleSheet.create({
  approvalRow: { backgroundColor: '#FFF', padding: 20, borderRadius: 12, marginBottom: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  approveBtn: { backgroundColor: '#10B981', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 8 },
});