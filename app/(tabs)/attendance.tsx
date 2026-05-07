import { Ionicons } from '@expo/vector-icons';
import { onAuthStateChanged } from 'firebase/auth';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Alert, Dimensions, Modal, Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../../firebase';

const { height: screenHeight } = Dimensions.get('window');
const SITES = ['warp', 'thewarp', 'ラドンナ'];

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const JissekiTimePicker = ({ value, onChange, disabled }: { value: string, onChange: (v: string) => void, disabled: boolean }) => {
  const [startH, setStartH] = useState('19');
  const [startM, setStartM] = useState('00');
  const [endH, setEndH] = useState('24');
  const [endM, setEndM] = useState('00');
  const [openPicker, setOpenPicker] = useState<'startH'|'startM'|'endH'|'endM'|null>(null);

  useEffect(() => {
    if (value && value.includes('-')) {
      const [s, e] = value.split('-');
      setStartH(s.split(':')[0] || '19'); setStartM(s.split(':')[1] || '00');
      setEndH(e.split(':')[0] || '24'); setEndM(e.split(':')[1] || '00');
    }
  }, [value]);

  const applyTime = (sh: string, sm: string, eh: string, em: string) => {
    const finalEm = (eh === '24') ? '00' : em;
    onChange(`${sh}:${sm}-${eh}:${finalEm}`);
  };

  const hours = Array.from({length: 25}, (_, i) => String(i).padStart(2, '0'));
  const minutes = Array.from({length: 12}, (_, i) => String(i * 5).padStart(2, '0'));

  const handleSelect = (type: 'startH'|'startM'|'endH'|'endM', item: string) => {
    let sh = startH, sm = startM, eh = endH, em = endM;
    if (type === 'startH') { sh = item; setStartH(item); }
    if (type === 'startM') { sm = item; setStartM(item); }
    if (type === 'endH') { eh = item; setEndH(item); }
    if (type === 'endM') { em = item; setEndM(item); }
    applyTime(sh, sm, eh, em);
    setOpenPicker(null);
  };

  if (disabled) return <View style={localStyles.readonlyBox}><Text style={{ color: '#1e293b' }}>{value}</Text></View>;

  if (!value) {
    return (
      <TouchableOpacity style={{ backgroundColor: '#F8FAFC', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center' }} onPress={() => applyTime('19', '00', '24', '00')}>
        <Text style={{ color: '#64748b' }}>未設定 (タップして時間を入力)</Text>
      </TouchableOpacity>
    );
  }

  const displayEndM = endH === '24' ? '00' : endM;
  const pickerData = openPicker?.endsWith('H') ? hours : minutes;

  return (
    <View style={{ backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 10, flexWrap: 'wrap' }}>
        <TouchableOpacity style={[localStyles.dropdownBtn, openPicker === 'startH' && localStyles.dropdownBtnOpen]} onPress={() => setOpenPicker(openPicker === 'startH' ? null : 'startH')}>
          <Text style={localStyles.dropdownText}>{startH}</Text><Ionicons name={openPicker === 'startH' ? 'caret-up' : 'caret-down'} size={14} color="#64748b"/>
        </TouchableOpacity>
        <Text style={{fontWeight:'bold', marginHorizontal: 2}}>:</Text>
        <TouchableOpacity style={[localStyles.dropdownBtn, openPicker === 'startM' && localStyles.dropdownBtnOpen]} onPress={() => setOpenPicker(openPicker === 'startM' ? null : 'startM')}>
          <Text style={localStyles.dropdownText}>{startM}</Text><Ionicons name={openPicker === 'startM' ? 'caret-up' : 'caret-down'} size={14} color="#64748b"/>
        </TouchableOpacity>
        <Text style={{fontSize: 16, marginHorizontal: 6, color:'#CBD5E1'}}>〜</Text>
        <TouchableOpacity style={[localStyles.dropdownBtn, openPicker === 'endH' && localStyles.dropdownBtnOpen]} onPress={() => setOpenPicker(openPicker === 'endH' ? null : 'endH')}>
          <Text style={localStyles.dropdownText}>{endH}</Text><Ionicons name={openPicker === 'endH' ? 'caret-up' : 'caret-down'} size={14} color="#64748b"/>
        </TouchableOpacity>
        <Text style={{fontWeight:'bold', marginHorizontal: 2}}>:</Text>
        <TouchableOpacity style={[localStyles.dropdownBtn, openPicker === 'endM' && localStyles.dropdownBtnOpen]} onPress={() => setOpenPicker(openPicker === 'endM' ? null : 'endM')}>
          <Text style={localStyles.dropdownText}>{displayEndM}</Text><Ionicons name={openPicker === 'endM' ? 'caret-up' : 'caret-down'} size={14} color="#64748b"/>
        </TouchableOpacity>
      </View>
      {openPicker && (
        <View style={{ borderTopWidth: 1, borderColor: '#E2E8F0', paddingVertical: 6, paddingHorizontal: 4 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {pickerData!.map(item => {
              const curVal = openPicker === 'startH' ? startH : openPicker === 'startM' ? startM : openPicker === 'endH' ? endH : displayEndM;
              return (
                <TouchableOpacity
                  key={item}
                  style={{ width: openPicker.endsWith('H') ? '20%' : '25%', paddingVertical: 10, alignItems: 'center', backgroundColor: item === curVal ? '#B8860B' : 'transparent', borderRadius: 6 }}
                  onPress={() => handleSelect(openPicker, item)}
                >
                  <Text style={{ fontSize: 15, fontWeight: 'bold', color: item === curVal ? '#FFF' : '#1e293b' }}>{item}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
      <TouchableOpacity style={{ margin: 10, padding: 8, backgroundColor: '#F1F5F9', borderRadius: 8, alignItems: 'center' }} onPress={() => onChange('')}>
        <Text style={{ color: '#64748b', fontSize: 12, fontWeight: 'bold' }}>時間をクリア</Text>
      </TouchableOpacity>
    </View>
  );
};

export default function AttendanceScreen() {
  const [currentUid, setCurrentUid] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [attendance, setAttendance] = useState<Record<string, any>>({});
  const [shifts, setShifts] = useState<Record<string, any>>({});
  const [monthlyStatus, setMonthlyStatus] = useState<Record<string, string>>({});
  const [userDmItems, setUserDmItems] = useState<string[]>([]);
  const [salaryAmount, setSalaryAmount] = useState(0);
  const [userName, setUserName] = useState('');

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dakokuTime, setDakokuTime] = useState('');
  const [jissekiTime, setJissekiTime] = useState('');
  const [selectedDmList, setSelectedDmList] = useState<string[]>([]);
  const [newDmInput, setNewDmInput] = useState('');

  const [shopEvents, setShopEvents] = useState<Record<string, string>>({});

  // 日払い申請
  const [dailyPayRequests, setDailyPayRequests] = useState<any[]>([]);
  const [dpModalVisible, setDpModalVisible] = useState(false);
  const [dpAmount, setDpAmount] = useState('');
  const [dpDate, setDpDate] = useState(today());
  const [dpNote, setDpNote] = useState('');

  const fetchEvents = async () => {
    try {
      const snap = await getDocs(collection(db, 'events'));
      const evs: Record<string, string> = {};
      snap.forEach(d => { evs[d.id] = d.data().title; });
      setShopEvents(evs);
    } catch {}
  };

  const fetchDailyPayRequests = async (uid: string) => {
    try {
      const q = query(collection(db, 'dailyPayRequests'), where('userId', '==', uid));
      const snap = await getDocs(q);
      const reqs: any[] = [];
      snap.forEach(d => reqs.push({ id: d.id, ...d.data() }));
      reqs.sort((a, b) => b.createdAt?.localeCompare?.(a.createdAt) ?? 0);
      setDailyPayRequests(reqs);
    } catch {}
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setCurrentUid(u.uid);
        const d = await getDoc(doc(db, 'users', u.uid));
        if (d.exists()) {
          const data = d.data();
          setAttendance(data.attendance || {});
          setShifts(data.shifts || {});
          setMonthlyStatus(data.monthlyStatus || {});
          setUserDmItems(data.dmItems || []);
          setSalaryAmount(data.salaryAmount || 0);
          setUserName(data.name || '');

          const today_d = new Date();
          const mKey = `${today_d.getFullYear()}-${String(today_d.getMonth() + 1).padStart(2, '0')}`;
          if (today_d.getDate() >= 25 && !(data.monthlyStatus || {})[mKey]) {
            Alert.alert('出勤簿の提出期限', '毎月25日になりました。\n今月の出勤簿を確認・提出してください。', [{ text: '確認' }]);
          }
        }
        fetchEvents();
        fetchDailyPayRequests(u.uid);
      }
    });
    return () => unsub();
  }, []);

  const currentMonthKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}`;
  const isMonthLocked = monthlyStatus[currentMonthKey] === 'submitted' || monthlyStatus[currentMonthKey] === 'approved';
  const canSubmit = currentMonth.getMonth() !== new Date().getMonth() || new Date().getDate() >= 25;

  const handleDayPress = (dateKey: string) => {
    setSelectedDate(dateKey);
    const dayData = attendance[dateKey];
    let dTime = '未打刻', jTime = '', dmArr: string[] = [];
    if (dayData && typeof dayData === 'object') {
      if (dayData.dakoku) dTime = dayData.dakoku;
      jTime = dayData.jisseki || dayData.dakoku || '';
      if (dayData.dmList && Array.isArray(dayData.dmList)) dmArr = dayData.dmList;
    } else if (dayData && typeof dayData === 'string' && dayData.includes('-')) {
      jTime = dayData;
    }
    if (!jTime) {
      const shiftData = shifts[dateKey];
      if (typeof shiftData === 'string' && shiftData !== '〇') jTime = shiftData;
      else if (typeof shiftData === 'object') {
        for (const s of SITES) {
          if (shiftData[s] && shiftData[s] !== '〇' && shiftData[s] !== '休み') { jTime = shiftData[s]; break; }
        }
      }
    }
    setDakokuTime(dTime); setJissekiTime(jTime); setSelectedDmList(dmArr);
    setModalVisible(true);
  };

  const saveJisseki = async () => {
    if (!currentUid) return;
    try {
      const newData = { ...attendance };
      newData[selectedDate!] = { dakoku: dakokuTime !== '未打刻' ? dakokuTime : '', jisseki: jissekiTime, dmList: selectedDmList };
      await updateDoc(doc(db, 'users', currentUid), { attendance: newData });
      setAttendance(newData);
      setModalVisible(false);
    } catch {
      Alert.alert('エラー', '保存に失敗しました');
    }
  };

  const handleSubmit = () => {
    Alert.alert('送信確認', '実績を確定して送信しますか？', [
      { text: 'キャンセル' },
      { text: 'はい', onPress: async () => {
        const nextStatus = { ...monthlyStatus, [currentMonthKey]: 'submitted' };
        await updateDoc(doc(db, 'users', currentUid!), { monthlyStatus: nextStatus });
        setMonthlyStatus(nextStatus);
        Alert.alert('送信完了');
      }}
    ]);
  };

  const addDmItemToUser = async () => {
    if (!newDmInput.trim()) return;
    const nextItems = [...userDmItems, newDmInput.trim()];
    setUserDmItems(nextItems); setNewDmInput('');
    await updateDoc(doc(db, 'users', currentUid!), { dmItems: nextItems });
  };

  const deleteDmItemFromUser = async (itemToRemove: string) => {
    Alert.alert('確認', `「${itemToRemove}」を削除しますか？`, [
      { text: 'キャンセル', style: 'cancel' },
      { text: '削除', style: 'destructive', onPress: async () => {
        const nextItems = userDmItems.filter(i => i !== itemToRemove);
        setUserDmItems(nextItems);
        setSelectedDmList(prev => prev.filter(i => i !== itemToRemove));
        await updateDoc(doc(db, 'users', currentUid!), { dmItems: nextItems });
      }}
    ]);
  };

  const toggleDmSelection = (item: string) => {
    if (selectedDmList.includes(item)) setSelectedDmList(selectedDmList.filter(d => d !== item));
    else setSelectedDmList([...selectedDmList, item]);
  };

  const submitDailyPayRequest = async () => {
    const amount = parseInt(dpAmount, 10);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('エラー', '金額を正しく入力してください');
      return;
    }
    if (!dpDate) {
      Alert.alert('エラー', '日付を入力してください');
      return;
    }
    try {
      const now = new Date().toISOString();
      await addDoc(collection(db, 'dailyPayRequests'), {
        userId: currentUid,
        userName,
        date: dpDate,
        amount,
        note: dpNote.trim(),
        status: 'pending',
        createdAt: now,
      });
      Alert.alert('申請完了', '日払い申請を送信しました。承認をお待ちください。');
      setDpModalVisible(false);
      setDpAmount(''); setDpNote(''); setDpDate(today());
      if (currentUid) fetchDailyPayRequests(currentUid);
    } catch {
      Alert.alert('エラー', '申請に失敗しました');
    }
  };

  const cancelDailyPayRequest = async (req: any) => {
    Alert.alert('申請取り消し', 'この申請を取り消しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      { text: '取り消す', style: 'destructive', onPress: async () => {
        try {
          await deleteDoc(doc(db, 'dailyPayRequests', req.id));
          setDailyPayRequests(prev => prev.filter(r => r.id !== req.id));
        } catch {
          Alert.alert('エラー', '取り消しに失敗しました');
        }
      }}
    ]);
  };

  const renderDays = () => {
    const y = currentMonth.getFullYear(), m = currentMonth.getMonth();
    const days = new Date(y, m + 1, 0).getDate(), first = new Date(y, m, 1).getDay();
    const arr: (number | null)[] = [];
    for (let i = 0; i < first; i++) arr.push(null);
    for (let i = 1; i <= days; i++) arr.push(i);
    return arr;
  };

  const monthRequests = dailyPayRequests.filter(r => r.date?.startsWith(currentMonthKey));
  const approvedTotal = monthRequests.filter(r => r.status === 'approved').reduce((sum, r) => sum + (r.amount || 0), 0);

  const statusLabel = (s: string) => {
    if (s === 'approved') return { text: '承認済', color: '#10B981', bg: '#D1FAE5' };
    if (s === 'rejected') return { text: '却下', color: '#EF4444', bg: '#FEE2E2' };
    return { text: '申請中', color: '#F59E0B', bg: '#FEF3C7' };
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: '#B8860B' }]}>出勤簿（実績）</Text>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <TouchableOpacity
            style={localStyles.dpRequestBtn}
            onPress={() => { setDpDate(today()); setDpModalVisible(true); }}
          >
            <Ionicons name="cash-outline" size={16} color="#FFF" />
            <Text style={{ color: '#FFF', fontSize: 12, fontWeight: 'bold', marginLeft: 4 }}>日払い申請</Text>
          </TouchableOpacity>
          {canSubmit && (
            <TouchableOpacity
              style={[localStyles.submitBtn, isMonthLocked && { backgroundColor: '#94a3b8' }]}
              onPress={handleSubmit}
              disabled={isMonthLocked}
            >
              <Text style={localStyles.submitBtnText}>{isMonthLocked ? '送信済み' : '提出する'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 150 }}>
        <View style={localStyles.monthNav}>
          <TouchableOpacity onPress={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}>
            <Ionicons name="chevron-back" size={28} color="#B8860B" />
          </TouchableOpacity>
          <Text style={localStyles.monthText}>{currentMonth.getFullYear()}年 {currentMonth.getMonth() + 1}月</Text>
          <TouchableOpacity onPress={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}>
            <Ionicons name="chevron-forward" size={28} color="#B8860B" />
          </TouchableOpacity>
        </View>

        <View style={localStyles.calendarCard}>
          <View style={localStyles.weekHeader}>
            {['日','月','火','水','木','金','土'].map(d => <Text key={d} style={localStyles.weekText}>{d}</Text>)}
          </View>
          <View style={localStyles.daysGrid}>
            {renderDays().map((day, i) => {
              const dateKey = day ? `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : '';
              const eventTitle = dateKey ? shopEvents[dateKey] : null;
              let plannedTime = '';
              if (day) {
                const shiftData = shifts[dateKey];
                if (shiftData) {
                  if (typeof shiftData === 'string' && shiftData !== '〇') plannedTime = shiftData;
                  else if (typeof shiftData === 'object') {
                    for (const site of SITES) {
                      if (shiftData[site] && shiftData[site] !== '〇' && shiftData[site] !== '休み') { plannedTime = shiftData[site]; break; }
                    }
                  }
                }
              }
              
              let dakokuTimeDisplay = '', jissekiTimeDisplay = '', dmCountDisplay = 0;
              if (day) {
                const dayData = attendance[dateKey];
                if (dayData && typeof dayData === 'object') {
                  if (dayData.dakoku) dakokuTimeDisplay = dayData.dakoku;
                  if (dayData.jisseki) jissekiTimeDisplay = dayData.jisseki;
                  if (dayData.dmList) dmCountDisplay = dayData.dmList.length;
                } else if (dayData && typeof dayData === 'string' && dayData.includes('-')) {
                  jissekiTimeDisplay = dayData;
                }
              }
              
              const hasDpRequest = day ? monthRequests.some(r => r.date === dateKey) : false;
              const fmtTime = (t: string) => t.includes('-') ? t.replace('-', '\n~') : t;

              return (
                <TouchableOpacity
                  key={i}
                  style={[localStyles.dayCell, (!!plannedTime || !!dakokuTimeDisplay || !!jissekiTimeDisplay) && localStyles.dayCellActive, eventTitle && { backgroundColor: '#FFFBEB' }]}
                  onPress={() => day && handleDayPress(dateKey)}
                >
                  <Text style={localStyles.dayNum}>{day || ''}</Text>
                  {eventTitle && <View style={localStyles.eventBadge}><Text style={localStyles.eventText} numberOfLines={1}>📌 {eventTitle}</Text></View>}
                  {!!plannedTime && <Text style={localStyles.plannedText}>{fmtTime(plannedTime)}</Text>}
                  {!!jissekiTimeDisplay ? (
                    <Text style={[localStyles.dakokuText, { color: '#B8860B' }]}>{fmtTime(jissekiTimeDisplay)}</Text>
                  ) : !!dakokuTimeDisplay ? (
                    <Text style={localStyles.dakokuText}>{fmtTime(dakokuTimeDisplay)}</Text>
                  ) : null}
                  {dmCountDisplay > 0 && <Text style={{ fontSize: 8, color: '#10B981', fontWeight: 'bold' }}>DM:{dmCountDisplay}</Text>}
                  {hasDpRequest && <Ionicons name="cash" size={10} color="#F59E0B" />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 日払い申請一覧 */}
        <View style={{ margin: 16, backgroundColor: '#FFF', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#E2E8F0' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#1e293b' }}>日払い申請 ({currentMonth.getMonth() + 1}月)</Text>
            {approvedTotal > 0 && (
              <Text style={{ fontSize: 13, color: '#EF4444', fontWeight: 'bold' }}>
                天引き合計: ¥{approvedTotal.toLocaleString()}
              </Text>
            )}
          </View>
          {monthRequests.length === 0 ? (
            <Text style={{ color: '#94a3b8', fontSize: 13 }}>今月の申請はありません</Text>
          ) : (
            monthRequests.map(req => {
              const s = statusLabel(req.status);
              return (
                <View key={req.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderColor: '#F1F5F9' }}>
                  <View>
                    <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#1e293b' }}>{req.date}</Text>
                    {req.note ? <Text style={{ fontSize: 11, color: '#64748b' }}>{req.note}</Text> : null}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#1e293b' }}>¥{(req.amount || 0).toLocaleString()}</Text>
                    <View style={{ backgroundColor: s.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                      <Text style={{ fontSize: 11, fontWeight: 'bold', color: s.color }}>{s.text}</Text>
                    </View>
                    {req.status === 'pending' && (
                      <TouchableOpacity onPress={() => cancelDailyPayRequest(req)}>
                        <Ionicons name="close-circle" size={22} color="#EF4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* 実績修正モーダル */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ width: '90%', maxHeight: '85%', backgroundColor: '#FFF', borderRadius: 20, padding: 25 }}>
            <View style={localStyles.modalHeader}>
              <Text style={localStyles.modalTitle}>実績修正</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}><Ionicons name="close" size={24} /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={localStyles.label}>打刻時間 (修正不可)</Text>
              <View style={localStyles.readonlyBox}><Text style={{ color: '#94a3b8' }}>{dakokuTime}</Text><Ionicons name="lock-closed" size={16} color="#94a3b8" /></View>
              <Text style={localStyles.label}>実績時間</Text>
              <JissekiTimePicker value={jissekiTime} onChange={setJissekiTime} disabled={isMonthLocked} />
              <View style={{ marginVertical: 15, borderBottomWidth: 1, borderColor: '#F1F5F9' }} />
              <Text style={localStyles.label}>DM (1件につき250円追加)</Text>
              {!isMonthLocked && (
                <View style={{ flexDirection: 'row', marginBottom: 15 }}>
                  <TextInput style={{ backgroundColor: '#F8FAFC', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#CBD5E1', flex: 1, marginRight: 10 }} placeholder="DM項目を新規追加..." value={newDmInput} onChangeText={setNewDmInput} />
                  <TouchableOpacity style={{ backgroundColor: '#1e293b', justifyContent: 'center', paddingHorizontal: 15, borderRadius: 8 }} onPress={addDmItemToUser}>
                    <Text style={{ color: '#FFF', fontWeight: 'bold' }}>追加</Text>
                  </TouchableOpacity>
                </View>
              )}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {userDmItems.length === 0 && <Text style={{ color: '#94a3b8', fontSize: 12 }}>項目がありません。追加してください。</Text>}
                {userDmItems.map(item => {
                  const isSelected = selectedDmList.includes(item);
                  return (
                    <View key={item} style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 5 }}>
                      <TouchableOpacity disabled={isMonthLocked} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: isSelected ? '#10B981' : '#CBD5E1', backgroundColor: isSelected ? '#D1FAE5' : '#F8FAFC' }} onPress={() => toggleDmSelection(item)}>
                        <Text style={{ color: isSelected ? '#065F46' : '#64748b', fontWeight: 'bold' }}>{item}</Text>
                      </TouchableOpacity>
                      {!isMonthLocked && (
                        <TouchableOpacity onPress={() => deleteDmItemFromUser(item)} style={{ marginLeft: -12, marginTop: -20, backgroundColor: '#EF4444', borderRadius: 12, width: 22, height: 22, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFF' }}>
                          <Ionicons name="close" size={14} color="#FFF" />
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </View>
              <View style={{ height: 20 }} />
            </ScrollView>
            {!isMonthLocked && (
              <TouchableOpacity style={localStyles.goldBtn} onPress={saveJisseki}>
                <Text style={{ color: '#FFF', fontWeight: 'bold' }}>実績を保存</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {/* 日払い申請モーダル */}
      <Modal visible={dpModalVisible} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 28, paddingBottom: 40 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#1e293b' }}>日払い申請</Text>
              <TouchableOpacity onPress={() => setDpModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            {salaryAmount > 0 && (
              <View style={{ backgroundColor: '#F0FDF4', padding: 12, borderRadius: 10, marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="information-circle-outline" size={18} color="#16A34A" />
                <Text style={{ fontSize: 12, color: '#16A34A', fontWeight: 'bold' }}>
                  あなたの時給: ¥{salaryAmount.toLocaleString()}/h
                </Text>
              </View>
            )}

            <Text style={localStyles.label}>対象日</Text>
            <TextInput
              style={[localStyles.inputField, { marginBottom: 16 }]}
              value={dpDate}
              onChangeText={setDpDate}
              placeholder="例: 2025-01-15"
              keyboardType="numbers-and-punctuation"
            />

            <Text style={localStyles.label}>申請金額 (円)</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#1e293b', marginRight: 8 }}>¥</Text>
              <TextInput
                style={[localStyles.inputField, { flex: 1 }]}
                value={dpAmount}
                onChangeText={setDpAmount}
                placeholder="例: 5000"
                keyboardType="numeric"
              />
            </View>

            <Text style={localStyles.label}>備考 (任意)</Text>
            <TextInput
              style={[localStyles.inputField, { marginBottom: 24 }]}
              value={dpNote}
              onChangeText={setDpNote}
              placeholder="例: 急な出費のため"
            />

            <TouchableOpacity
              style={{ backgroundColor: '#B8860B', padding: 16, borderRadius: 14, alignItems: 'center' }}
              onPress={submitDailyPayRequest}
            >
              <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 16 }}>申請する</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFF', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  header: { paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
});

const localStyles = StyleSheet.create({
  submitBtn: { backgroundColor: '#0f172a', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  submitBtnText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  dpRequestBtn: { backgroundColor: '#B8860B', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, flexDirection: 'row', alignItems: 'center' },
  monthNav: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, alignItems: 'center' },
  monthText: { fontSize: 22, fontWeight: 'bold' },
  calendarCard: { padding: 5 },
  weekHeader: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#F1F5F9', paddingBottom: 10 },
  weekText: { flex: 1, textAlign: 'center', fontSize: 12, color: '#94a3b8' },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: '14.28%', height: screenHeight / 8, borderBottomWidth: 0.5, borderRightWidth: 0.5, borderColor: '#F1F5F9', alignItems: 'center', padding: 2 },
  dayCellActive: { backgroundColor: '#F8FAFC' },
  dayNum: { fontSize: 14, fontWeight: 'bold' },
  plannedText: { color: '#64748b', fontSize: 8, marginTop: 2, fontWeight: 'bold', textAlign: 'center' },
  dakokuText: { color: '#10B981', fontSize: 8, marginTop: 2, fontWeight: 'bold', textAlign: 'center' },
  eventBadge: { backgroundColor: '#FEF3C7', padding: 1, borderRadius: 3, width: '90%', marginTop: 2 },
  eventText: { fontSize: 7, color: '#92400E', textAlign: 'center', fontWeight: 'bold' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  label: { fontSize: 13, color: '#64748b', fontWeight: 'bold', marginBottom: 6 },
  readonlyBox: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#F1F5F9', padding: 15, borderRadius: 12, marginBottom: 15 },
  dropdownBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 8, backgroundColor: '#FFF', borderRadius: 8, borderWidth: 1, borderColor: '#CBD5E1' },
  dropdownBtnOpen: { borderColor: '#B8860B', backgroundColor: '#FFF8E7' },
  dropdownText: { fontSize: 16, fontWeight: 'bold', color: '#1e293b', marginRight: 2 },
  goldBtn: { backgroundColor: '#B8860B', padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 15 },
  inputField: { backgroundColor: '#F8FAFC', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#CBD5E1', fontSize: 16 },
});