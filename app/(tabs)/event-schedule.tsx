import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, deleteDoc, doc, getDocs, setDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  Alert, Dimensions, Modal, Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View
} from 'react-native';
import { db } from '../../firebase';

const { height: screenHeight } = Dimensions.get('window');

export default function EventScheduleScreen() {
  const router = useRouter();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [shopEvents, setShopEvents] = useState<Record<string, string>>({});
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [eventTitle, setEventTitle] = useState('');

  const fetchEvents = async () => {
    try {
      const snap = await getDocs(collection(db, 'events'));
      const evs: Record<string, string> = {};
      snap.forEach(d => { evs[d.id] = d.data().title; });
      setShopEvents(evs);
    } catch (error) { console.error(error); }
  };

  useEffect(() => { fetchEvents(); }, []);

  const handleDayPress = (dateKey: string) => {
    setSelectedDate(dateKey);
    setEventTitle(shopEvents[dateKey] || '');
    setModalVisible(true);
  };

  const saveEvent = async () => {
    if (!selectedDate) return;
    if (!eventTitle.trim()) {
      await deleteEvent();
      return;
    }
    try {
      await setDoc(doc(db, 'events', selectedDate), { title: eventTitle.trim() });
      setShopEvents(prev => ({ ...prev, [selectedDate]: eventTitle.trim() }));
      setModalVisible(false);
    } catch (e) { Alert.alert('エラー', '保存に失敗しました'); }
  };

  const deleteEvent = async () => {
    if (!selectedDate) return;
    try {
      await deleteDoc(doc(db, 'events', selectedDate));
      const next = { ...shopEvents };
      delete next[selectedDate];
      setShopEvents(next);
      setModalVisible(false);
    } catch (e) { Alert.alert('エラー', '削除に失敗しました'); }
  };

  const renderDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
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
        <TouchableOpacity onPress={() => router.push('/admin-menu')}>
          <Ionicons name="arrow-back" size={28} color="#B8860B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>イベント管理</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={localStyles.monthNav}>
          <TouchableOpacity onPress={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}><Ionicons name="chevron-back" size={28} color="#B8860B" /></TouchableOpacity>
          <Text style={localStyles.monthText}>{currentMonth.getFullYear()}年 {currentMonth.getMonth() + 1}月</Text>
          <TouchableOpacity onPress={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}><Ionicons name="chevron-forward" size={28} color="#B8860B" /></TouchableOpacity>
        </View>

        <View style={{ paddingHorizontal: 20, paddingBottom: 10 }}>
          <Text style={{ color: '#64748b', fontSize: 11, textAlign: 'center' }}>※日付をタップしてイベント（店舗の予定など）を登録してください</Text>
        </View>

        <View style={localStyles.calendarCard}>
          <View style={localStyles.weekHeader}>
            {['日', '月', '火', '水', '木', '金', '土'].map((d, i) => (
              <Text key={d} style={[localStyles.weekText, i === 0 && { color: '#ef4444' }, i === 6 && { color: '#3b82f6' }]}>{d}</Text>
            ))}
          </View>

          <View style={localStyles.daysGrid}>
            {renderDays().map((day, i) => {
              const dateKey = day ? `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : '';
              const eventTitle = dateKey ? shopEvents[dateKey] : null;

              return (
                <TouchableOpacity key={i} style={[localStyles.dayCell, eventTitle && { backgroundColor: '#FFFBEB' }]} onPress={() => day && handleDayPress(dateKey)} disabled={!day} activeOpacity={0.6}>
                  <Text style={[localStyles.dayNum, eventTitle && { color: '#B8860B' }]}>{day || ''}</Text>
                  {eventTitle && <View style={localStyles.eventBadge}><Text style={localStyles.eventText} numberOfLines={2}>📌 {eventTitle}</Text></View>}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={localStyles.modalOverlay}>
          <View style={localStyles.modalContent}>
            <View style={localStyles.modalHeader}>
              <Text style={localStyles.modalTitle}>{selectedDate?.replace(/-/g, '/')} のイベント</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}><Ionicons name="close" size={24} color="#333" /></TouchableOpacity>
            </View>

            <Text style={localStyles.label}>イベント内容 (全館一斉清掃、ミーティング等)</Text>
            <TextInput
              style={localStyles.textInput}
              placeholder="イベント名を入力"
              value={eventTitle}
              onChangeText={setEventTitle}
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
              <TouchableOpacity style={[localStyles.btn, { backgroundColor: '#FEF2F2', flex: 1 }]} onPress={deleteEvent}>
                <Text style={{ color: '#EF4444', fontWeight: 'bold' }}>削除</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[localStyles.btn, { backgroundColor: '#B8860B', flex: 2 }]} onPress={saveEvent}>
                <Text style={{ color: '#FFF', fontWeight: 'bold' }}>保存する</Text>
              </TouchableOpacity>
            </View>
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
  monthNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  monthText: { fontSize: 22, fontWeight: 'bold', color: '#1e293b' },
  calendarCard: { backgroundColor: '#FFF', paddingHorizontal: 5 },
  weekHeader: { flexDirection: 'row', paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  weekText: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: 'bold', color: '#94a3b8' },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: '14.28%', height: screenHeight / 8.5, borderBottomWidth: 0.5, borderRightWidth: 0.5, borderColor: '#F1F5F9', padding: 2, alignItems: 'center' },
  dayNum: { fontSize: 15, color: '#475569', marginTop: 2, fontWeight: 'bold' },
  eventBadge: { marginTop: 4, backgroundColor: '#FEF3C7', padding: 2, borderRadius: 4, width: '95%' },
  eventText: { color: '#92400E', fontSize: 9, fontWeight: 'bold', textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '90%', backgroundColor: '#FFF', borderRadius: 20, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
  label: { fontSize: 12, fontWeight: 'bold', color: '#64748b', marginBottom: 8 },
  textInput: { backgroundColor: '#F8FAFC', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#CBD5E1', fontSize: 16 },
  btn: { padding: 15, borderRadius: 12, alignItems: 'center' },
});