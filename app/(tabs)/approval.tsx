import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, doc, getDoc, getDocs, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Alert, Modal, Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { db } from '../../firebase';

export default function ApprovalScreen() {
  const router = useRouter();
  const [approvalList, setApprovalList] = useState<any[]>([]);
  
  // ② 選択されたスタッフの出勤簿詳細を保持するステート
  const [selectedStaffDetail, setSelectedStaffDetail] = useState<any | null>(null);

  const fetchApprovals = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const curMonthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      const approvals: any[] = [];
      
      querySnapshot.forEach((docSnap) => {
        const u = docSnap.data();
        if (u.role !== 'admin' && u.monthlyStatus && u.monthlyStatus[curMonthKey] === 'submitted') {
          // モーダル表示用に、attendance情報やshifts情報も含めて取得
          approvals.push({ 
            id: docSnap.id, 
            name: u.name, 
            currentMonthKey: curMonthKey,
            attendance: u.attendance || {},
            shifts: u.shifts || {}
          });
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
        setSelectedStaffDetail(null); // モーダルが開いていれば閉じる
      }
    } catch (e) { console.error(e); }
  };

  const renderAttendanceDetail = (user: any) => {
    const monthKey = user.currentMonthKey;
    const [yearStr, monthStr] = monthKey.split('-');
    const daysInMonth = new Date(parseInt(yearStr), parseInt(monthStr), 0).getDate();
    
    const records = [];
    for (let i = 1; i <= daysInMonth; i++) {
      const dateKey = `${monthKey}-${String(i).padStart(2, '0')}`;
      const attData = user.attendance[dateKey];
      
      let jTime = '';
      let dTime = '';
      let dmCount = 0;
      
      if (attData && typeof attData === 'object') {
        jTime = attData.jisseki || '';
        dTime = attData.dakoku || '';
        if (attData.dmList) dmCount = attData.dmList.length;
      } else if (typeof attData === 'string' && attData.includes('-')) {
        jTime = attData;
      }
      
      if (jTime || dTime || dmCount > 0) {
        records.push(
          <View key={dateKey} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
            <Text style={{ width: '15%', fontSize: 14, fontWeight: 'bold', color: '#1e293b' }}>{i}日</Text>
            <View style={{ width: '40%' }}>
              <Text style={{ fontSize: 12, color: '#64748b' }}>実績: <Text style={{ color: '#1e293b', fontWeight: 'bold' }}>{jTime || '未入力'}</Text></Text>
              {dTime ? <Text style={{ fontSize: 10, color: '#10B981', marginTop: 2 }}>打刻: {dTime}</Text> : null}
            </View>
            <View style={{ width: '45%', alignItems: 'flex-end' }}>
              {dmCount > 0 && <Text style={{ fontSize: 10, backgroundColor: '#D1FAE5', color: '#065F46', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' }}>DM {dmCount}件</Text>}
            </View>
          </View>
        );
      }
    }

    if (records.length === 0) {
      return <Text style={{ textAlign: 'center', color: '#94a3b8', marginTop: 20 }}>出勤実績データがありません。</Text>;
    }
    return records;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
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
            // ② カード全体をタップできるように修正
            <TouchableOpacity key={item.id} style={localStyles.approvalRow} onPress={() => setSelectedStaffDetail(item)}>
              <View>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1e293b' }}>{item.name}</Text>
                <Text style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>対象月: {item.currentMonthKey}</Text>
              </View>
              <TouchableOpacity style={localStyles.approveBtn} onPress={() => approveStaff(item.id, item.currentMonthKey)}>
                <Text style={{ color: '#FFF', fontWeight: 'bold' }}>一括承認</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* ② タップした際に出勤簿の詳細を表示するモーダル */}
      <Modal visible={!!selectedStaffDetail} animationType="slide" transparent onRequestClose={() => setSelectedStaffDetail(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ width: '90%', maxHeight: '80%', backgroundColor: '#FFF', borderRadius: 20, padding: 25 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
              <View>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1e293b' }}>{selectedStaffDetail?.name} の実績</Text>
                <Text style={{ fontSize: 12, color: '#64748b' }}>{selectedStaffDetail?.currentMonthKey}月分</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedStaffDetail(null)}>
                <Ionicons name="close" size={28} color="#1e293b" />
              </TouchableOpacity>
            </View>
            
            <ScrollView showsVerticalScrollIndicator={false} style={{ marginBottom: 20 }}>
              {selectedStaffDetail && renderAttendanceDetail(selectedStaffDetail)}
            </ScrollView>

            <TouchableOpacity style={{ backgroundColor: '#10B981', padding: 15, borderRadius: 12, alignItems: 'center' }} onPress={() => approveStaff(selectedStaffDetail.id, selectedStaffDetail.currentMonthKey)}>
              <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 16 }}>この実績を承認する</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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