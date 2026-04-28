import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Alert, Dimensions, Modal, Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { db } from '../../firebase';

const { width: screenWidth } = Dimensions.get('window');

export default function ShiftSettingsScreen() {
  const router = useRouter();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [targetMonth, setTargetMonth] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // カレンダー関連の状態
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [pickerType, setPickerType] = useState<'start' | 'end' | 'month' | null>(null);
  const [calendarDate, setCalendarDate] = useState(new Date());

  useEffect(() => {
    const fetchConfig = async () => {
      const docSnap = await getDoc(doc(db, 'settings', 'shiftConfig'));
      if (docSnap.exists()) {
        const data = docSnap.data();
        setStartDate(data.startDate || '');
        setEndDate(data.endDate || '');
        setTargetMonth(data.targetMonth || '');
      }
    };
    fetchConfig();
  }, []);

  const handleSave = async () => {
    if (!startDate || !endDate || !targetMonth) {
      Alert.alert('エラー', 'すべての項目を入力してください');
      return;
    }
    setIsLoading(true);
    try {
      await setDoc(doc(db, 'settings', 'shiftConfig'), {
        startDate,
        endDate,
        targetMonth
      });
      Alert.alert('成功', 'シフト期間設定を更新しました');
      router.back();
    } catch (e) {
      Alert.alert('エラー', '保存に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  const openPicker = (type: 'start' | 'end' | 'month') => {
    setPickerType(type);
    let initialDate = new Date();
    if (type === 'start' && startDate) initialDate = new Date(startDate);
    if (type === 'end' && endDate) initialDate = new Date(endDate);
    if (type === 'month' && targetMonth) initialDate = new Date(targetMonth + '-01');
    
    if (!isNaN(initialDate.getTime())) {
      setCalendarDate(initialDate);
    }
    setCalendarVisible(true);
  };

  const handleSelectDate = (day: number) => {
    const y = calendarDate.getFullYear();
    const m = String(calendarDate.getMonth() + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    const formatted = `${y}-${m}-${d}`;
    
    if (pickerType === 'start') setStartDate(formatted);
    if (pickerType === 'end') setEndDate(formatted);
    setCalendarVisible(false);
  };

  const handleSelectMonth = (monthIndex: number) => {
    const y = calendarDate.getFullYear();
    const m = String(monthIndex + 1).padStart(2, '0');
    setTargetMonth(`${y}-${m}`);
    setCalendarVisible(false);
  };

  const renderDays = () => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    return days;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={28} color="#B8860B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>シフト期間設定</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 25 }}>
        <View style={styles.card}>
          <Text style={styles.label}>① 募集開始日</Text>
          <TouchableOpacity style={styles.inputBtn} onPress={() => openPicker('start')}>
            <Text style={[styles.inputText, !startDate && { color: '#94a3b8' }]}>{startDate || '日付を選択してください'}</Text>
            <Ionicons name="calendar-outline" size={20} color="#64748b" />
          </TouchableOpacity>
          <Text style={styles.hint}>スタッフがアプリで入力可能になる日</Text>

          <Text style={styles.label}>② 募集締切日</Text>
          <TouchableOpacity style={styles.inputBtn} onPress={() => openPicker('end')}>
            <Text style={[styles.inputText, !endDate && { color: '#94a3b8' }]}>{endDate || '日付を選択してください'}</Text>
            <Ionicons name="calendar-outline" size={20} color="#64748b" />
          </TouchableOpacity>
          <Text style={styles.hint}>この日を過ぎるとスタッフは入力できなくなります</Text>

          <View style={styles.divider} />

          <Text style={styles.label}>③ 対象月</Text>
          <TouchableOpacity style={styles.inputBtn} onPress={() => openPicker('month')}>
            <Text style={[styles.inputText, !targetMonth && { color: '#94a3b8' }]}>{targetMonth || '月を選択してください'}</Text>
            <Ionicons name="calendar-outline" size={20} color="#64748b" />
          </TouchableOpacity>
          <Text style={styles.hint}>スタッフがシフト希望を出す対象の月</Text>
        </View>

        <TouchableOpacity 
          style={[styles.saveBtn, isLoading && { opacity: 0.7 }]} 
          onPress={handleSave} 
          disabled={isLoading}
        >
          <Text style={styles.saveBtnText}>{isLoading ? '保存中...' : '設定を保存する'}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* カレンダーモーダル */}
      <Modal visible={calendarVisible} transparent animationType="fade" onRequestClose={() => setCalendarVisible(false)}>
        <View style={localStyles.modalOverlay}>
          <View style={localStyles.modalContent}>
            <View style={localStyles.modalHeader}>
              <Text style={localStyles.modalTitle}>
                {pickerType === 'month' ? '対象月を選択' : pickerType === 'start' ? '開始日を選択' : '終了日を選択'}
              </Text>
              <TouchableOpacity onPress={() => setCalendarVisible(false)}>
                <Ionicons name="close" size={28} color="#1e293b" />
              </TouchableOpacity>
            </View>

            <View style={localStyles.monthNav}>
              <TouchableOpacity onPress={() => {
                const d = new Date(calendarDate);
                if (pickerType === 'month') d.setFullYear(d.getFullYear() - 1);
                else d.setMonth(d.getMonth() - 1);
                setCalendarDate(d);
              }}>
                <Ionicons name="chevron-back" size={28} color="#B8860B" />
              </TouchableOpacity>
              <Text style={localStyles.monthText}>
                {pickerType === 'month' ? `${calendarDate.getFullYear()}年` : `${calendarDate.getFullYear()}年 ${calendarDate.getMonth() + 1}月`}
              </Text>
              <TouchableOpacity onPress={() => {
                const d = new Date(calendarDate);
                if (pickerType === 'month') d.setFullYear(d.getFullYear() + 1);
                else d.setMonth(d.getMonth() + 1);
                setCalendarDate(d);
              }}>
                <Ionicons name="chevron-forward" size={28} color="#B8860B" />
              </TouchableOpacity>
            </View>

            {pickerType === 'month' ? (
              <View style={localStyles.monthsGrid}>
                {Array.from({ length: 12 }).map((_, i) => (
                  <TouchableOpacity key={i} style={localStyles.monthCell} onPress={() => handleSelectMonth(i)}>
                    <Text style={localStyles.monthCellText}>{i + 1}月</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View>
                <View style={localStyles.weekHeader}>
                  {['日', '月', '火', '水', '木', '金', '土'].map((w, i) => (
                    <Text key={w} style={[localStyles.weekText, i === 0 && { color: '#ef4444' }, i === 6 && { color: '#3b82f6' }]}>{w}</Text>
                  ))}
                </View>
                <View style={localStyles.daysGrid}>
                  {renderDays().map((d, i) => (
                    <TouchableOpacity key={i} style={[localStyles.dayCell, !d && { backgroundColor: 'transparent', borderWidth: 0 }]} onPress={() => d && handleSelectDate(d)} disabled={!d}>
                      <Text style={localStyles.dayNum}>{d || ''}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
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
  card: { backgroundColor: '#FFF', padding: 20, borderRadius: 15, borderWidth: 1, borderColor: '#E2E8F0' },
  label: { fontSize: 14, fontWeight: 'bold', color: '#1e293b', marginBottom: 8, marginTop: 15 },
  inputBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#CBD5E1' },
  inputText: { fontSize: 16, color: '#1e293b' },
  hint: { fontSize: 11, color: '#64748b', marginTop: 5 },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 20 },
  saveBtn: { backgroundColor: '#B8860B', padding: 20, borderRadius: 15, alignItems: 'center', marginTop: 30 },
  saveBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
});

const localStyles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '90%', backgroundColor: '#FFF', borderRadius: 20, padding: 20, elevation: 5 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
  monthNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  monthText: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
  weekHeader: { flexDirection: 'row', paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  weekText: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: 'bold', color: '#64748b' },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: `${100 / 7}%`, aspectRatio: 1, justifyContent: 'center', alignItems: 'center', borderBottomWidth: 0.5, borderRightWidth: 0.5, borderColor: '#F1F5F9' },
  dayNum: { fontSize: 16, color: '#1e293b', fontWeight: 'bold' },
  monthsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  monthCell: { width: '30%', paddingVertical: 15, backgroundColor: '#F8FAFC', borderRadius: 10, borderWidth: 1, borderColor: '#CBD5E1', alignItems: 'center' },
  monthCellText: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
});