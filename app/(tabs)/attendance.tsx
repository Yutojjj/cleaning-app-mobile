import { Ionicons } from '@expo/vector-icons';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Alert, Dimensions, Modal, Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../../firebase';

const { height: screenHeight } = Dimensions.get('window');
const SITES = ['warp', 'thewarp', 'ラドンナ'];

// ⑧ 実績時間をピッカーで選択できるように修正したコンポーネント
const JissekiTimePicker = ({ value, onChange, disabled }: { value: string, onChange: (v: string) => void, disabled: boolean }) => {
  const [startH, setStartH] = useState('19');
  const [startM, setStartM] = useState('00');
  const [endH, setEndH] = useState('24');
  const [endM, setEndM] = useState('00');
  const [pickerConfig, setPickerConfig] = useState<{ visible: boolean, type: 'startH'|'startM'|'endH'|'endM' } | null>(null);

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

  const renderPickerModal = () => {
    if (!pickerConfig) return null;
    const isHour = pickerConfig.type.endsWith('H');
    // 時は0〜24、分は0〜55(5分刻み)
    const data = isHour ? Array.from({length: 25}, (_, i) => String(i).padStart(2, '0')) : Array.from({length: 12}, (_, i) => String(i * 5).padStart(2, '0'));

    return (
      <Modal visible={true} transparent animationType="fade">
        <TouchableOpacity style={{flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'center', alignItems:'center'}} onPress={() => setPickerConfig(null)}>
          <View style={{backgroundColor:'#FFF', width:'70%', height: 350, borderRadius:20, padding:10}}>
            <Text style={{textAlign:'center', fontWeight:'bold', padding:15, borderBottomWidth:1, borderColor:'#EEE'}}>{isHour ? '時を選択' : '分を選択'}</Text>
            <ScrollView>
              {data.map(item => (
                <TouchableOpacity key={item} style={{padding:15, alignItems:'center', borderBottomWidth:1, borderColor:'#F1F5F9'}} onPress={() => {
                  let nextSh = startH, nextSm = startM, nextEh = endH, nextEm = endM;
                  if(pickerConfig.type === 'startH') { nextSh = item; setStartH(item); }
                  if(pickerConfig.type === 'startM') { nextSm = item; setStartM(item); }
                  if(pickerConfig.type === 'endH') { nextEh = item; setEndH(item); }
                  if(pickerConfig.type === 'endM') { nextEm = item; setEndM(item); }
                  applyTime(nextSh, nextSm, nextEh, nextEm);
                  setPickerConfig(null);
                }}><Text style={{fontSize:22, fontWeight:'bold'}}>{item}</Text></TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    );
  };

  if (disabled) {
    return <View style={localStyles.readonlyBox}><Text style={{ color: '#1e293b' }}>{value}</Text></View>;
  }

  if (!value) {
    return (
      <TouchableOpacity style={{ backgroundColor: '#F8FAFC', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center' }} onPress={() => applyTime('19', '00', '24', '00')}>
        <Text style={{ color: '#64748b' }}>未設定 (タップして時間を入力)</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={{ backgroundColor: '#F8FAFC', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity style={localStyles.dropdownBtn} onPress={() => setPickerConfig({visible:true, type:'startH'})}><Text style={localStyles.dropdownText}>{startH}</Text><Ionicons name="caret-down" size={14}/></TouchableOpacity>
        <Text style={{fontWeight:'bold', marginHorizontal:5}}>:</Text>
        <TouchableOpacity style={localStyles.dropdownBtn} onPress={() => setPickerConfig({visible:true, type:'startM'})}><Text style={localStyles.dropdownText}>{startM}</Text><Ionicons name="caret-down" size={14}/></TouchableOpacity>
        <Text style={{fontSize: 20, marginHorizontal: 15, color:'#CBD5E1'}}>〜</Text>
        <TouchableOpacity style={localStyles.dropdownBtn} onPress={() => setPickerConfig({visible:true, type:'endH'})}><Text style={localStyles.dropdownText}>{endH}</Text><Ionicons name="caret-down" size={14}/></TouchableOpacity>
        <Text style={{fontWeight:'bold', marginHorizontal:5}}>:</Text>
        <TouchableOpacity style={localStyles.dropdownBtn} onPress={() => setPickerConfig({visible:true, type:'endM'})}><Text style={localStyles.dropdownText}>{endH === '24' ? '00' : endM}</Text><Ionicons name="caret-down" size={14}/></TouchableOpacity>
      </View>
      <TouchableOpacity style={{ marginTop: 15, padding: 8, backgroundColor: '#F1F5F9', borderRadius: 8 }} onPress={() => onChange('')}>
        <Text style={{ color: '#64748b', fontSize: 12, fontWeight: 'bold' }}>時間をクリア</Text>
      </TouchableOpacity>
      {renderPickerModal()}
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
  
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dakokuTime, setDakokuTime] = useState('');
  const [jissekiTime, setJissekiTime] = useState('');
  const [selectedDmList, setSelectedDmList] = useState<string[]>([]);
  const [newDmInput, setNewDmInput] = useState('');
  
  const [shopEvents, setShopEvents] = useState<Record<string, string>>({});

  const fetchEvents = async () => {
    try {
      const snap = await getDocs(collection(db, 'events'));
      const evs: Record<string, string> = {};
      snap.forEach(d => { evs[d.id] = d.data().title; });
      setShopEvents(evs);
    } catch (error) { console.error(error); }
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
        }
        fetchEvents();
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
    
    let dTime = '未打刻';
    let jTime = '';
    let dmArr: string[] = [];

    if (dayData && typeof dayData === 'object') {
      if (dayData.dakoku) dTime = dayData.dakoku;
      jTime = dayData.jisseki || dayData.dakoku || '';
      if (dayData.dmList && Array.isArray(dayData.dmList)) dmArr = dayData.dmList;
    } else if (dayData && typeof dayData === 'string' && dayData.includes('-')) { 
      dTime = '未打刻'; 
      jTime = dayData; 
    }

    if (!jTime) {
      let planned = '';
      const shiftData = shifts[dateKey];
      if (typeof shiftData === 'string' && shiftData !== '〇') planned = shiftData;
      else if (typeof shiftData === 'object') {
        for (const s of SITES) {
          if (shiftData[s] && shiftData[s] !== '〇' && shiftData[s] !== '休み') { planned = shiftData[s]; break; }
        }
      }
      if (planned) jTime = planned;
    }

    setDakokuTime(dTime); 
    setJissekiTime(jTime);
    setSelectedDmList(dmArr);
    setModalVisible(true);
  };

  const saveJisseki = async () => {
    const newData = { ...attendance };
    newData[selectedDate!] = { dakoku: dakokuTime !== '未打刻' ? dakokuTime : '', jisseki: jissekiTime, dmList: selectedDmList };
    await updateDoc(doc(db, 'users', currentUid!), { attendance: newData });
    setAttendance(newData); setModalVisible(false);
  };

  const handleSubmit = () => {
    Alert.alert("送信確認", "実績を確定して送信しますか？", [
      { text: "キャンセル" },
      { text: "はい", onPress: async () => {
        const nextStatus = { ...monthlyStatus, [currentMonthKey]: 'submitted' };
        await updateDoc(doc(db, 'users', currentUid!), { monthlyStatus: nextStatus });
        setMonthlyStatus(nextStatus);
        Alert.alert("送信完了");
      }}
    ]);
  };

  const addDmItemToUser = async () => {
    if (!newDmInput.trim()) return;
    const nextItems = [...userDmItems, newDmInput.trim()];
    setUserDmItems(nextItems);
    setNewDmInput('');
    await updateDoc(doc(db, 'users', currentUid!), { dmItems: nextItems });
  };

  // ⑧ DM項目の削除処理
  const deleteDmItemFromUser = async (itemToRemove: string) => {
    Alert.alert('確認', `「${itemToRemove}」を削除しますか？`, [
      { text: 'キャンセル', style: 'cancel' },
      { text: '削除', style: 'destructive', onPress: async () => {
          const nextItems = userDmItems.filter(i => i !== itemToRemove);
          setUserDmItems(nextItems);
          setSelectedDmList(prev => prev.filter(i => i !== itemToRemove)); // 選択中リストからも解除
          await updateDoc(doc(db, 'users', currentUid!), { dmItems: nextItems });
        }
      }
    ]);
  };

  const toggleDmSelection = (item: string) => {
    if (selectedDmList.includes(item)) setSelectedDmList(selectedDmList.filter(d => d !== item));
    else setSelectedDmList([...selectedDmList, item]);
  };

  const renderDays = () => {
    const y = currentMonth.getFullYear(), m = currentMonth.getMonth();
    const days = new Date(y, m + 1, 0).getDate(), first = new Date(y, m, 1).getDay();
    const arr = []; for (let i = 0; i < first; i++) arr.push(null);
    for (let i = 1; i <= days; i++) arr.push(i); return arr;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: '#B8860B' }]}>出勤簿（実績）</Text>
        {canSubmit && <TouchableOpacity style={[localStyles.submitBtn, isMonthLocked && { backgroundColor: '#94a3b8' }]} onPress={handleSubmit} disabled={isMonthLocked}><Text style={localStyles.submitBtnText}>{isMonthLocked ? '送信済み' : '提出する'}</Text></TouchableOpacity>}
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 150 }}>
        <View style={localStyles.monthNav}>
          <TouchableOpacity onPress={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}><Ionicons name="chevron-back" size={28} color="#B8860B" /></TouchableOpacity>
          <Text style={localStyles.monthText}>{currentMonth.getFullYear()}年 {currentMonth.getMonth() + 1}月</Text>
          <TouchableOpacity onPress={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}><Ionicons name="chevron-forward" size={28} color="#B8860B" /></TouchableOpacity>
        </View>
        <View style={localStyles.calendarCard}>
          <View style={localStyles.weekHeader}>{['日','月','火','水','木','金','土'].map(d => <Text key={d} style={localStyles.weekText}>{d}</Text>)}</View>
          <View style={localStyles.daysGrid}>
            {renderDays().map((day, i) => {
              const dateKey = day ? `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : '';
              const eventTitle = dateKey ? shopEvents[dateKey] : null;
              
              let plannedTime = '';
              if (day) {
                const shiftData = shifts[dateKey];
                if (shiftData) {
                  if (typeof shiftData === 'string' && shiftData !== '〇') {
                    plannedTime = shiftData;
                  } else if (typeof shiftData === 'object') {
                    for (const site of SITES) {
                      if (shiftData[site] && shiftData[site] !== '〇' && shiftData[site] !== '休み') {
                        plannedTime = shiftData[site];
                        break;
                      }
                    }
                  }
                }
              }

              let dakokuTimeDisplay = '';
              let dmCountDisplay = 0;
              if (day) {
                const dayData = attendance[dateKey];
                if (dayData && typeof dayData === 'object') {
                   if (dayData.dakoku) dakokuTimeDisplay = dayData.dakoku;
                   if (dayData.dmList) dmCountDisplay = dayData.dmList.length;
                }
              }

              // ⑥ 文字切れ対策のため、「19:00-24:00」を「19:00 \n~24:00」と表示用に改行を入れる
              let formattedPlannedTime = plannedTime;
              if (formattedPlannedTime.includes('-')) {
                formattedPlannedTime = formattedPlannedTime.replace('-', '\n~');
              }
              let formattedDakokuTime = dakokuTimeDisplay;
              if (formattedDakokuTime.includes('-')) {
                formattedDakokuTime = formattedDakokuTime.replace('-', '\n~');
              }

              return (
                <TouchableOpacity key={i} style={[localStyles.dayCell, (!!plannedTime || !!dakokuTimeDisplay) && localStyles.dayCellActive, eventTitle && { backgroundColor: '#FFFBEB' }]} onPress={() => day && handleDayPress(dateKey)}>
                  <Text style={localStyles.dayNum}>{day || ''}</Text>
                  {eventTitle && <View style={localStyles.eventBadge}><Text style={localStyles.eventText} numberOfLines={1}>📌 {eventTitle}</Text></View>}
                  
                  {!!plannedTime && <Text style={localStyles.plannedText}>{formattedPlannedTime}</Text>}
                  {!!dakokuTimeDisplay && <Text style={localStyles.dakokuText}>{formattedDakokuTime}</Text>}
                  {dmCountDisplay > 0 && <Text style={{ fontSize: 8, color: '#10B981', fontWeight: 'bold' }}>DM: {dmCountDisplay}</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ width: '90%', maxHeight: '85%', backgroundColor: '#FFF', borderRadius: 20, padding: 25 }}>
            <View style={localStyles.modalHeader}><Text style={localStyles.modalTitle}>実績修正</Text><TouchableOpacity onPress={() => setModalVisible(false)}><Ionicons name="close" size={24} /></TouchableOpacity></View>
            
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
                      {/* ⑧ 個別のDM項目を削除できるボタン */}
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

            {!isMonthLocked && <TouchableOpacity style={localStyles.goldBtn} onPress={saveJisseki}><Text style={{ color: '#FFF', fontWeight: 'bold' }}>実績を保存</Text></TouchableOpacity>}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFF', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  header: { padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  headerTitle: { fontSize: 20, fontWeight: 'bold' },
});

const localStyles = StyleSheet.create({
  submitBtn: { backgroundColor: '#0f172a', padding: 10, borderRadius: 8 },
  submitBtnText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  monthNav: { flexDirection: 'row', justifyContent: 'space-between', padding: 20 },
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
  label: { fontSize: 14, color: '#64748b', marginBottom: 5 },
  readonlyBox: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#F1F5F9', padding: 15, borderRadius: 12, marginBottom: 15 },
  dropdownBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#FFF', borderRadius: 8, borderWidth: 1, borderColor: '#CBD5E1' },
  dropdownText: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginRight: 5 },
  goldBtn: { backgroundColor: '#B8860B', padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 15 },
});