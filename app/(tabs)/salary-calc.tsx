import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { collection, doc, getDocs, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Alert, Modal, Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { db } from '../../firebase';

export default function SalaryCalcScreen() {
  const router = useRouter();
  const [staffList, setStaffList] = useState<any[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<any>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [tempAdvance, setTempAdvance] = useState('');

  const curMonthKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;

  const fetchStaffData = async () => {
    try {
      const snap = await getDocs(collection(db, 'users'));
      const list: any[] = [];
      snap.forEach(document => {
        const d = document.data();
        if (d.role !== 'admin') {
          list.push({ id: document.id, ...d });
        }
      });
      setStaffList(list);
    } catch (e) {}
  };

  useEffect(() => { fetchStaffData(); }, [currentMonth]);

  const getStats = (data: any, targetMonthKey: string) => {
    const records = data.attendance || data.shifts || {};
    let days = 0, total = 0, actual = 0, over = 0, night = 0, dmCount = 0;
    const wage = data.salaryAmount || 0;

    Object.entries(records).forEach(([date, val]: any) => {
      if (!date.startsWith(targetMonthKey) || !val) return;
      
      if (val.dmList && Array.isArray(val.dmList)) {
        dmCount += val.dmList.length;
      }

      let timeString = '';
      if (typeof val === 'object') {
        if (val.jisseki) {
          timeString = val.jisseki;
        } else {
          for (const s of ['warp', 'thewarp', 'ラドンナ', '他']) {
            if (val[s] && val[s] !== '〇' && val[s] !== '休み') {
              timeString = val[s];
              break;
            }
          }
        }
      } else if (typeof val === 'string' && val.includes('-')) {
        timeString = val;
      }
      
      if (!timeString || timeString === '休み' || timeString === '〇') return;
      
      days++;
      const [s, e] = timeString.split('-');
      if (!s || !e) return;
      
      const sh = parseInt(s.split(':')[0]);
      let eh = parseInt(e.split(':')[0]);
      if (e.toUpperCase() === 'LAST' || eh === 0) eh = 24;
      if (eh < sh) eh += 24;
      
      const h = eh - sh;
      if (h <= 0 || isNaN(h)) return;

      const bh = h >= 8 ? 1 : (h >= 6 ? 0.75 : 0);
      const wh = h - bh;
      total += h; 
      actual += wh;
      
      if (wh > 8) over += (wh - 8);
      for (let i = sh; i < eh; i++) { if (i >= 22 || i < 5) night++; }
    });

    const regularHours = actual - over;
    const baseSalary = regularHours * wage;
    const overtimeSalary = over * wage * 1.25;
    const nightSalary = night * wage * 0.25;
    const dmAllowance = dmCount * 250;
    const expected = baseSalary + overtimeSalary + nightSalary + dmAllowance;
    
    const advancePayment = data.advancePayments?.[targetMonthKey] || 0;
    const finalSalary = expected - advancePayment;

    return { 
      workingDays: days, actualHours: actual, regularHours: regularHours,
      overtimeHours: over, nightHours: night, dmCount, dmAllowance,
      baseSalary: Math.floor(baseSalary), overtimeSalary: Math.floor(overtimeSalary), nightSalary: Math.floor(nightSalary),
      expectedSalary: Math.floor(expected), advancePayment, finalSalary: Math.floor(finalSalary), wage: wage
    };
  };

  const saveAdvancePayment = async () => {
    if (!selectedStaff) return;
    const amountNum = parseInt(tempAdvance, 10);
    const validAmount = isNaN(amountNum) ? 0 : amountNum;
    
    try {
      const userRef = doc(db, 'users', selectedStaff.id);
      const updatedAdvances = { ...(selectedStaff.advancePayments || {}), [curMonthKey]: validAmount };
      await updateDoc(userRef, { advancePayments: updatedAdvances });
      
      const updatedStaff = { ...selectedStaff, advancePayments: updatedAdvances };
      const updatedStats = getStats(updatedStaff, curMonthKey);
      
      setSelectedStaff({ ...updatedStaff, stats: updatedStats });
      setStaffList(prev => prev.map(s => s.id === selectedStaff.id ? updatedStaff : s));
      Alert.alert("保存しました", "日払い・天引き額を更新しました");
    } catch (error) {
      Alert.alert("エラー", "保存に失敗しました");
    }
  };

  const exportCSV = async () => {
    let csvString = "名前,出勤日数,実労働時間,所定内労働時間,残業時間,深夜時間,DM回数,基本給,残業手当,深夜手当,DM手当,総支給額(給与),差し引き額(日払い等),差引支給額\n";
    staffList.forEach(staff => {
      const s = getStats(staff, curMonthKey);
      csvString += `${staff.name},${s.workingDays},${s.actualHours},${s.regularHours},${s.overtimeHours},${s.nightHours},${s.dmCount},${s.baseSalary},${s.overtimeSalary},${s.nightSalary},${s.dmAllowance},${s.expectedSalary},${s.advancePayment},${s.finalSalary}\n`;
    });

    if (Platform.OS === 'web') {
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `salary_${curMonthKey}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      // ★ TS型エラー強制バイパス処理
      const fs: any = FileSystem;
      const dir = fs.documentDirectory;
      
      if (!dir) {
        Alert.alert("エラー", "ファイルシステムにアクセスできません");
        return;
      }
      
      const fileUri = `${dir}salary_${curMonthKey}.csv`;
      
      try {
        await fs.writeAsStringAsync(fileUri, csvString, { 
          encoding: 'utf8' 
        });
        
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri);
        } else {
          Alert.alert("エラー", "CSV出力・共有機能がサポートされていません");
        }
      } catch (error) {
        Alert.alert("エラー", "ファイルの書き込みに失敗しました");
      }
    }
  };

  const totalAllStaffFinalSalary = staffList.reduce((sum, staff) => sum + getStats(staff, curMonthKey).finalSalary, 0);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => router.push('/admin-menu')}>
            <Ionicons name="arrow-back" size={28} color="#B8860B" />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, {marginLeft: 10}]}>給料計算</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#B8860B', marginRight: 15 }}>合計: ¥{totalAllStaffFinalSalary.toLocaleString()}</Text>
          <TouchableOpacity onPress={exportCSV}>
            <Ionicons name="download-outline" size={28} color="#B8860B" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.monthNav}>
        <TouchableOpacity onPress={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}><Ionicons name="chevron-back" size={28} color="#B8860B" /></TouchableOpacity>
        <Text style={styles.monthText}>{currentMonth.getFullYear()}年 {currentMonth.getMonth() + 1}月</Text>
        <TouchableOpacity onPress={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}><Ionicons name="chevron-forward" size={28} color="#B8860B" /></TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }}>
        {staffList.map(staff => {
          const stats = getStats(staff, curMonthKey);
          const status = staff.monthlyStatus?.[curMonthKey];
          let statusText = '未提出'; let statusColor = '#94a3b8'; let statusBg = '#F1F5F9';
          if (status === 'submitted') { statusText = '承認待ち'; statusColor = '#B45309'; statusBg = '#FEF3C7'; }
          if (status === 'approved') { statusText = '承認済'; statusColor = '#10B981'; statusBg = '#D1FAE5'; }

          return (
            <TouchableOpacity key={staff.id} style={styles.staffCard} onPress={() => { setSelectedStaff({ ...staff, stats }); setTempAdvance(stats.advancePayment.toString()); }}>
              <View>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1e293b' }}>{staff.name}</Text>
                <Text style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{staff.role} / 差引支給額: ¥{stats.finalSalary.toLocaleString()}</Text>
              </View>
              <View style={{ backgroundColor: statusBg, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}>
                <Text style={{ color: statusColor, fontWeight: 'bold', fontSize: 12 }}>{statusText}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* 詳細モーダル */}
      <Modal visible={!!selectedStaff} transparent animationType="fade" onRequestClose={() => setSelectedStaff(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedStaff?.name} の給与内訳</Text>
              <TouchableOpacity onPress={() => setSelectedStaff(null)}><Ionicons name="close" size={28} /></TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={{ backgroundColor: '#F8FAFC', padding: 20, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 20 }}>
                <Text style={{ textAlign: 'center', fontSize: 14, color: '#64748b', fontWeight: 'bold' }}>{currentMonth.getMonth() + 1}月分 差引支給額</Text>
                <Text style={{ textAlign: 'center', fontSize: 36, fontWeight: '900', color: '#B8860B', marginVertical: 10 }}>¥{selectedStaff?.stats?.finalSalary.toLocaleString()}</Text>
                <Text style={{ textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>
                  基本時給: ¥{selectedStaff?.stats?.wage.toLocaleString() || 0}
                </Text>
              </View>

              <View style={styles.statRow}><Text style={styles.statTitle}>総支給額 (給与)</Text><Text style={styles.statData}>¥{selectedStaff?.stats?.expectedSalary.toLocaleString()}</Text></View>
              
              <View style={[styles.statRow, { alignItems: 'center' }]}>
                <Text style={styles.statTitle}>差し引き額 (日払い等)</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#0f172a', marginRight: 5 }}>¥</Text>
                  <TextInput 
                    style={{ backgroundColor: '#F1F5F9', padding: 8, borderRadius: 8, width: 80, textAlign: 'right', fontWeight: 'bold', fontSize: 16 }}
                    value={tempAdvance} onChangeText={setTempAdvance} keyboardType="numeric"
                  />
                </View>
              </View>
              <TouchableOpacity style={{ backgroundColor: '#1e293b', padding: 10, borderRadius: 8, alignItems: 'center', marginBottom: 15 }} onPress={saveAdvancePayment}>
                <Text style={{ color: '#FFF', fontWeight: 'bold' }}>日払い・天引き額を更新</Text>
              </TouchableOpacity>

              <View style={{ borderTopWidth: 1, borderColor: '#CBD5E1', marginVertical: 10 }} />

              <View style={styles.statRow}><Text style={styles.statTitle}>出勤日数</Text><Text style={styles.statData}>{selectedStaff?.stats?.workingDays} 日</Text></View>
              <View style={styles.statRow}><Text style={styles.statTitle}>実労働時間</Text><Text style={styles.statData}>{selectedStaff?.stats?.actualHours.toFixed(1)} h</Text></View>
              <View style={styles.statRow}><Text style={styles.statTitle}>所定内労働時間</Text><Text style={styles.statData}>{selectedStaff?.stats?.regularHours.toFixed(1)} h</Text></View>
              <View style={styles.statRow}><Text style={styles.statTitle}>法定外残業 (8h超)</Text><Text style={styles.statData}>{selectedStaff?.stats?.overtimeHours.toFixed(1)} h</Text></View>
              <View style={styles.statRow}><Text style={styles.statTitle}>深夜労働 (22時〜翌5時)</Text><Text style={styles.statData}>{selectedStaff?.stats?.nightHours.toFixed(1)} h</Text></View>
              <View style={styles.statRow}><Text style={styles.statTitle}>DM (1件250円)</Text><Text style={styles.statData}>{selectedStaff?.stats?.dmCount} 回</Text></View>

              <View style={{ borderTopWidth: 1, borderColor: '#CBD5E1', marginVertical: 15 }} />
              <View style={styles.statRow}><Text style={styles.statTitle}>基本給 (所定内)</Text><Text style={styles.statData}>¥{selectedStaff?.stats?.baseSalary.toLocaleString()}</Text></View>
              <View style={styles.statRow}><Text style={styles.statTitle}>残業手当 (25%割増)</Text><Text style={styles.statData}>¥{selectedStaff?.stats?.overtimeSalary.toLocaleString()}</Text></View>
              <View style={styles.statRow}><Text style={styles.statTitle}>深夜手当 (25%割増)</Text><Text style={styles.statData}>¥{selectedStaff?.stats?.nightSalary.toLocaleString()}</Text></View>
              <View style={styles.statRow}><Text style={styles.statTitle}>DM手当</Text><Text style={styles.statData}>¥{selectedStaff?.stats?.dmAllowance.toLocaleString()}</Text></View>
              
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  header: { padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
  monthNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#FFF' },
  monthText: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
  staffCard: { backgroundColor: '#FFF', padding: 20, borderRadius: 12, marginBottom: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '90%', maxHeight: '85%', backgroundColor: '#FFF', borderRadius: 20, padding: 25 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  statTitle: { fontSize: 14, color: '#475569', fontWeight: 'bold' },
  statData: { fontSize: 16, color: '#0f172a', fontWeight: 'bold' },
});