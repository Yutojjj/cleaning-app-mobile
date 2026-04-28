import { Ionicons } from '@expo/vector-icons';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Alert, Dimensions, Modal, Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../../firebase';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const SITES = ['warp', 'thewarp', 'ラドンナ', '他'];

interface Staff { id: string; name: string; role: string; shifts: Record<string, string>; }

const formatDateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const formatDateJapanese = (dateStr: string) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}(${dayNames[d.getDay()]})`;
};

const CustomTimePicker = ({ site, value, onChange }: { site: string, value: any, onChange: (v: string) => void }) => {
  const safeValue = typeof value === 'string' && value.includes('-') ? value : '休み';
  const isActive = safeValue !== '休み';
  const [startH, setStartH] = useState(isActive ? safeValue.split('-')[0].split(':')[0] : '19');
  const [startM, setStartM] = useState(isActive ? safeValue.split('-')[0].split(':')[1] : '00');
  const [endH, setEndH] = useState(isActive ? safeValue.split('-')[1].split(':')[0] : '24');
  const [endM, setEndM] = useState(isActive ? (safeValue.split('-')[1].split(':')[1] || '00') : '00');
  const [pickerConfig, setPickerConfig] = useState<{ visible: boolean, type: 'startH'|'startM'|'endH'|'endM' } | null>(null);

  useEffect(() => {
    if (isActive) {
      const finalEndM = (endH === '24' || endH === 'LAST') ? '00' : endM;
      onChange(`${startH}:${startM}-${endH}:${finalEndM}`);
    }
  }, [startH, startM, endH, endM]);

  useEffect(() => {
    if (typeof value === 'string' && value.includes('-')) {
      const [s, e] = value.split('-');
      if (s && e) {
        setStartH(s.split(':')[0]); setStartM(s.split(':')[1] || '00');
        setEndH(e.split(':')[0]); setEndM(e.split(':')[1] || '00');
      }
    }
  }, [value]);

  const renderPickerModal = () => {
    if (!pickerConfig) return null;
    const isHour = pickerConfig.type.endsWith('H');
    const data = isHour ? Array.from({length: 24}, (_, i) => String(i).padStart(2, '0')).concat(['24', 'LAST']) : Array.from({length: 12}, (_, i) => String(i * 5).padStart(2, '0'));
    return (
      <Modal visible={true} transparent animationType="fade">
        <TouchableOpacity style={{flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'center', alignItems:'center'}} onPress={() => setPickerConfig(null)}>
          <View style={{backgroundColor:'#FFF', width:'70%', height: 350, borderRadius:20, padding:10}}>
            <Text style={{textAlign:'center', fontWeight:'bold', padding:15, borderBottomWidth:1, borderColor:'#EEE'}}>{isHour ? '時を選択' : '分を選択'}</Text>
            <ScrollView>
              {data.map(item => (
                <TouchableOpacity key={item} style={{padding:15, alignItems:'center', borderBottomWidth:1, borderColor:'#F1F5F9'}} onPress={() => {
                  if(pickerConfig.type === 'startH') setStartH(item);
                  if(pickerConfig.type === 'startM') setStartM(item);
                  if(pickerConfig.type === 'endH') setEndH(item);
                  if(pickerConfig.type === 'endM') setEndM(item);
                  setPickerConfig(null);
                }}><Text style={{fontSize:22, fontWeight:'bold'}}>{item}</Text></TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    );
  };

  return (
    <View style={{ marginBottom: 15 }}>
      <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isActive ? '#B8860B' : '#F8FAFC', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: isActive ? '#B8860B' : '#E2E8F0' }} onPress={() => isActive ? onChange('休み') : onChange(`${startH}:${startM}-${endH}:${endM}`)}>
        <Ionicons name={isActive ? "checkmark-circle" : "ellipse-outline"} size={24} color={isActive ? "#FFF" : "#CBD5E1"} />
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: isActive ? '#FFF' : '#1e293b', marginLeft: 10 }}>{site.toUpperCase()}</Text>
      </TouchableOpacity>
      {isActive && (
        <View style={{ backgroundColor: '#FFF', padding: 15, borderBottomLeftRadius: 12, borderBottomRightRadius: 12, borderWidth: 1, borderTopWidth: 0, borderColor: '#E2E8F0', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity style={localStyles.dropdownBtn} onPress={() => setPickerConfig({visible:true, type:'startH'})}><Text style={localStyles.dropdownText}>{startH}</Text><Ionicons name="caret-down" size={14}/></TouchableOpacity>
            <Text style={{fontWeight:'bold', marginHorizontal:5}}>:</Text>
            <TouchableOpacity style={localStyles.dropdownBtn} onPress={() => setPickerConfig({visible:true, type:'startM'})}><Text style={localStyles.dropdownText}>{startM}</Text><Ionicons name="caret-down" size={14}/></TouchableOpacity>
            <Text style={{fontSize: 20, marginHorizontal: 15, color:'#CBD5E1'}}>〜</Text>
            <TouchableOpacity style={localStyles.dropdownBtn} onPress={() => setPickerConfig({visible:true, type:'endH'})}><Text style={localStyles.dropdownText}>{endH}</Text><Ionicons name="caret-down" size={14}/></TouchableOpacity>
            <Text style={{fontWeight:'bold', marginHorizontal:5}}>:</Text>
            <TouchableOpacity style={localStyles.dropdownBtn} onPress={() => setPickerConfig({visible:true, type:'endM'})}><Text style={localStyles.dropdownText}>{endH === '24' || endH === 'LAST' ? '00' : endM}</Text><Ionicons name="caret-down" size={14}/></TouchableOpacity>
          </View>
        </View>
      )}
      {renderPickerModal()}
    </View>
  );
};

export default function ShiftInputScreen() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUid, setCurrentUid] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [shifts, setShifts] = useState<Record<string, any>>({});
  const [mockStaff, setMockStaff] = useState<Record<string, Staff[]>>({ 'warp': [], 'thewarp': [], 'ラドンナ': [], '他': [] });
  const [allStaffDB, setAllStaffDB] = useState<any[]>([]);
  const [editShiftsForDate, setEditShiftsForDate] = useState<Record<string, string>>({});
  const [shopEvents, setShopEvents] = useState<Record<string, string>>({});
  const [shiftTemplates, setShiftTemplates] = useState<string[]>(['19:00-24:00', '18:00-23:00']);
  const [newTemplateInput, setNewTemplateInput] = useState('');
  
  // シフト期間設定
  const [shiftConfig, setShiftConfig] = useState<any>(null);

  const fetchEvents = async () => {
    try {
      const snap = await getDocs(collection(db, 'events'));
      const evs: Record<string, string> = {};
      snap.forEach(d => { evs[d.id] = d.data().title; });
      setShopEvents(evs);
    } catch (error) {}
  };

  const fetchUsersFromFirestore = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const fetchedUsers: any[] = [];
      const initial: Record<string, Staff[]> = { 'warp': [], 'thewarp': [], 'ラドンナ': [], '他': [] };
      querySnapshot.forEach((docSnap) => {
        const u = docSnap.data();
        if (u.role !== 'admin') {
          fetchedUsers.push({ id: docSnap.id, ...u });
          const userSites = Array.isArray(u.sites) ? u.sites : (u.site ? [u.site] : []);
          userSites.forEach(s => {
            if (initial[s]) {
              const siteShifts: Record<string, string> = {};
              if (u.shifts) {
                Object.keys(u.shifts).forEach(date => {
                  const val = u.shifts[date];
                  if (typeof val === 'string') siteShifts[date] = val;
                  else if (val && typeof val === 'object' && val[s] && val[s] !== '休み') siteShifts[date] = val[s];
                });
              }
              initial[s].push({ id: docSnap.id, name: u.name, role: u.role, shifts: siteShifts });
            }
          });
        }
      });
      setAllStaffDB(fetchedUsers);
      setMockStaff(initial);
    } catch (error) {}
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setCurrentUid(currentUser.uid);
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setIsAdmin(data.role === 'admin');
            if (data.role !== 'admin') {
              if (data.shifts) setShifts(data.shifts);
            }
            if (data.shiftTemplates) {
              setShiftTemplates(data.shiftTemplates);
            }

            const configSnap = await getDoc(doc(db, 'settings', 'shiftConfig'));
            if (configSnap.exists()) {
              const configData = configSnap.data();
              setShiftConfig(configData);
              if (data.role !== 'admin' && configData.targetMonth) {
                setCurrentMonth(new Date(configData.targetMonth + '-01'));
              }
            }
          }
        } catch (error) {}
        fetchUsersFromFirestore();
        fetchEvents();
      } else {
        setIsAdmin(false); setCurrentUid(null);
      }
    });
    return () => unsubscribe();
  }, []);

  const isWithinSubmissionPeriod = () => {
    if (isAdmin) return true;
    if (!shiftConfig) return false;
    const now = new Date();
    const start = new Date(shiftConfig.startDate);
    const end = new Date(shiftConfig.endDate);
    end.setHours(23, 59, 59);
    return now >= start && now <= end;
  };

  const saveNewTemplate = async () => {
    if (!newTemplateInput.includes('-')) {
      Alert.alert('エラー', '例：19:00-24:00 のように入力してください');
      return;
    }
    const nextTemplates = [...shiftTemplates, newTemplateInput];
    setShiftTemplates(nextTemplates);
    setNewTemplateInput('');
    if (currentUid) {
      await updateDoc(doc(db, 'users', currentUid), { shiftTemplates: nextTemplates });
    }
  };

  const applyTemplate = (templateTime: string) => {
    const nextEdit = { ...editShiftsForDate };
    SITES.forEach(s => {
      if (nextEdit[s] && nextEdit[s] !== '休み') {
        nextEdit[s] = templateTime;
      }
    });
    setEditShiftsForDate(nextEdit);
  };

  const [dayDetailModalVisible, setDayDetailModalVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [modalView, setModalView] = useState<'list' | 'addStaff' | 'editTime'>('list');
  const [targetSiteForAdd, setTargetSiteForAdd] = useState<string | null>(null);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);

  const handleDayPress = async (dateKey: string, day: number) => {
    if (!isWithinSubmissionPeriod()) {
      Alert.alert('募集期間外', '現在はシフト希望の募集期間ではありません。');
      return;
    }

    setSelectedDate(dateKey);
    if (isAdmin) {
      setModalView('list');
      setDayDetailModalVisible(true);
    } else {
      const nextShifts = { ...shifts };
      nextShifts[dateKey] = nextShifts[dateKey] ? null : '〇';
      setShifts(nextShifts);
      if (currentUid) await updateDoc(doc(db, 'users', currentUid), { shifts: nextShifts });
    }
  };

  const addStaffToDate = async (site: string, staffDef: { id: string; name: string; role: string }) => {
    if (!selectedDate) return;
    const newMock = { ...mockStaff };
    const existingIndex = newMock[site].findIndex(s => s.id === staffDef.id);
    if (existingIndex >= 0) {
      const updatedArray = [...newMock[site]];
      updatedArray[existingIndex] = { ...updatedArray[existingIndex], shifts: { ...updatedArray[existingIndex].shifts, [selectedDate]: '19:00-24:00' } };
      newMock[site] = updatedArray;
    } else {
      newMock[site] = [...newMock[site], { ...staffDef, shifts: { [selectedDate]: '19:00-24:00' } }];
    }
    
    try {
      const userRef = doc(db, 'users', staffDef.id);
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        const uData = userDoc.data();
        const currentShifts = uData.shifts || {};
        const dayShift = currentShifts[selectedDate];
        
        let newDayShift: any = {};
        if (typeof dayShift === 'string') {
           const userSites = Array.isArray(uData.sites) ? uData.sites : (uData.site ? [uData.site] : []);
           userSites.forEach((s: string) => { newDayShift[s] = dayShift; });
        } else if (dayShift && typeof dayShift === 'object') {
           newDayShift = { ...dayShift };
        }
        
        newDayShift[site] = '19:00-24:00';
        await updateDoc(userRef, { shifts: { ...currentShifts, [selectedDate]: newDayShift } });
      }
    } catch(e) {}
    setMockStaff(newMock);
    setModalView('list'); 
  };

  const openEditStaffTime = async (staff: Staff) => {
    setEditingStaff(staff);
    const userDoc = await getDoc(doc(db, 'users', staff.id));
    let initialEdit: any = {};
    if (userDoc.exists()) {
       const uShifts = userDoc.data().shifts || {};
       const dayShift = uShifts[selectedDate!] || {};
       initialEdit = typeof dayShift === 'string' ? { warp: dayShift } : dayShift;
    }
    const fullEdit: Record<string, string> = {};
    SITES.forEach(s => { fullEdit[s] = initialEdit[s] || '休み'; });
    setEditShiftsForDate(fullEdit);
    setModalView('editTime'); 
  };

  const saveStaffTime = async () => {
    if (!selectedDate || !editingStaff) return;
    try {
      const userRef = doc(db, 'users', editingStaff.id);
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        const currentShifts = userDoc.data().shifts || {};
        await updateDoc(userRef, { shifts: { ...currentShifts, [selectedDate]: editShiftsForDate } });
      }
      fetchUsersFromFirestore();
    } catch(e) {}
    setModalView('list'); 
    setEditingStaff(null);
  };

  const deleteStaffFromDate = async (staffId: string, site: string) => {
    if (!selectedDate) return;
    try {
      const userRef = doc(db, 'users', staffId);
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        const currentShifts = userDoc.data().shifts || {};
        const dayShift = currentShifts[selectedDate] || {};
        if (typeof dayShift === 'string') {
           delete currentShifts[selectedDate];
        } else {
           delete dayShift[site];
           if (Object.keys(dayShift).length === 0) delete currentShifts[selectedDate];
           else currentShifts[selectedDate] = dayShift;
        }
        await updateDoc(userRef, { shifts: currentShifts });
      }
    } catch(e) {}
    fetchUsersFromFirestore();
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
        <Text style={[styles.headerTitle, { color: '#B8860B' }]}>{isAdmin ? 'シフト編成・管理' : 'シフト希望入力'}</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 150 }}>
        {/* 期間外表示 */}
        {!isAdmin && !isWithinSubmissionPeriod() && (
          <View style={{ backgroundColor: '#FEF2F2', padding: 15, alignItems: 'center' }}>
            <Text style={{ color: '#EF4444', fontWeight: 'bold' }}>募集期間外のため入力できません</Text>
            {shiftConfig && <Text style={{ color: '#EF4444', fontSize: 12 }}>期間: {shiftConfig.startDate} 〜 {shiftConfig.endDate}</Text>}
          </View>
        )}

        <View style={localStyles.monthNav}>
          <TouchableOpacity onPress={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} disabled={!isAdmin && !isWithinSubmissionPeriod()}><Ionicons name="chevron-back" size={28} color={(!isAdmin && !isWithinSubmissionPeriod()) ? "#CBD5E1" : "#B8860B"} /></TouchableOpacity>
          <Text style={localStyles.monthText}>{currentMonth.getFullYear()}年 {currentMonth.getMonth() + 1}月</Text>
          <TouchableOpacity onPress={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} disabled={!isAdmin && !isWithinSubmissionPeriod()}><Ionicons name="chevron-forward" size={28} color={(!isAdmin && !isWithinSubmissionPeriod()) ? "#CBD5E1" : "#B8860B"} /></TouchableOpacity>
        </View>

        {!isAdmin && (
          <View style={{ paddingHorizontal: 20, paddingBottom: 10 }}>
             <Text style={{ color: '#64748b', fontSize: 11, textAlign: 'center' }}>※出勤できる日をタップして「〇」をつけてください</Text>
          </View>
        )}

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

              if (isAdmin) {
                const assignedCounts: Record<string, number> = {};
                const hopeIds = new Set<string>();

                for (const site of SITES) {
                  const assignedCount = mockStaff[site]?.filter(s => s.shifts[dateKey] && s.shifts[dateKey] !== '〇' && s.shifts[dateKey] !== '休み').length || 0;
                  if (assignedCount > 0) assignedCounts[site] = assignedCount;

                  mockStaff[site]?.forEach(staff => {
                    if (staff.shifts[dateKey] && staff.shifts[dateKey] !== '休み') {
                      hopeIds.add(staff.id);
                    }
                  });
                }
                const totalHopeStaff = day ? hopeIds.size : 0;

                return (
                  <TouchableOpacity key={i} style={localStyles.dayCell} onPress={() => day && handleDayPress(dateKey, day)} disabled={!day}>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'flex-start', width: '100%', paddingLeft: 5 }}>
                      <Text style={localStyles.dayNum}>{day || ''}</Text>
                      {day && totalHopeStaff > 0 && <Text style={localStyles.miniTotalCount}>{totalHopeStaff}名</Text>}
                    </View>
                    {eventTitle && <View style={localStyles.eventBadge}><Text style={localStyles.eventText} numberOfLines={1}>📌 {eventTitle}</Text></View>}
                    <View style={{ width: '100%', marginTop: 2 }}>
                      {Object.entries(assignedCounts).map(([site, count]) => (
                        <Text key={site} style={localStyles.siteCountText} numberOfLines={1}>{site.substring(0, 4).toUpperCase()}: {count}名</Text>
                      ))}
                    </View>
                  </TouchableOpacity>
                );
              } else {
                const hasShift = !!shifts[dateKey];
                return (
                  <TouchableOpacity key={i} style={[localStyles.dayCell, hasShift && localStyles.dayCellActive, eventTitle && { backgroundColor: '#FFFBEB' }]} onPress={() => day && handleDayPress(dateKey, day)} disabled={!day || !isWithinSubmissionPeriod()} activeOpacity={0.6}>
                    <Text style={[localStyles.dayNum, hasShift && localStyles.dayNumberActive]}>{day || ''}</Text>
                    {eventTitle && <View style={localStyles.eventBadge}><Text style={localStyles.eventText} numberOfLines={1}>📌 {eventTitle}</Text></View>}
                    {hasShift && <Text style={{ color: '#10B981', fontSize: 24, fontWeight: 'bold', marginTop: 5 }}>〇</Text>}
                  </TouchableOpacity>
                );
              }
            })}
          </View>
        </View>
      </ScrollView>

      <Modal visible={dayDetailModalVisible} animationType="slide" onRequestClose={() => {
        if (modalView !== 'list') setModalView('list'); else setDayDetailModalVisible(false);
      }}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => { if (modalView !== 'list') setModalView('list'); else setDayDetailModalVisible(false); }}>
              <Ionicons name={modalView === 'list' ? "chevron-down" : "arrow-back"} size={32} color="#B8860B" />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: '#B8860B' }]}>{modalView === 'list' ? `${formatDateJapanese(selectedDate || '')} シフト詳細` : modalView === 'addStaff' ? 'スタッフ追加' : 'シフト時間編集'}</Text>
            <View style={{ width: 32 }} />
          </View>

          {modalView === 'list' && (
            <ScrollView style={{ padding: 20 }}>
              {SITES.map(site => {
                const workingStaff = mockStaff[site]?.filter(s => s.shifts[selectedDate!] && s.shifts[selectedDate!] !== '〇' && s.shifts[selectedDate!] !== '休み') || [];
                return (
                  <View key={site} style={{ marginBottom: 35 }}>
                    <Text style={localStyles.detailSiteTitle}>{site.toUpperCase()}</Text>
                    {workingStaff.length === 0 && <Text style={{ color: '#94a3b8', fontSize: 12, marginBottom: 10 }}>時間が確定しているメンバーはいません</Text>}
                    {workingStaff.map(staff => (
                      <TouchableOpacity key={staff.id} style={localStyles.detailStaffRow} onPress={() => openEditStaffTime(staff)}>
                        <View>
                          <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#1e293b' }}>{staff.name}</Text>
                          <Text style={{ fontSize: 14, color: '#B8860B', fontWeight: 'bold', marginTop: 4 }}>{staff.shifts[selectedDate!]}</Text>
                        </View>
                        <TouchableOpacity style={localStyles.detailDeleteBtn} onPress={() => deleteStaffFromDate(staff.id, site)}><Ionicons name="trash-outline" size={20} color="#ef4444" /></TouchableOpacity>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity style={localStyles.addStaffBtn} onPress={() => { setTargetSiteForAdd(site); setModalView('addStaff'); }}>
                      <Ionicons name="add" size={20} color="#10B981" /><Text style={{ color: '#10B981', fontWeight: 'bold', marginLeft: 5 }}>メンバーを追加・編成する</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>
          )}

          {modalView === 'addStaff' && (() => {
            const targetStaff = allStaffDB;

            const unassignedStaff = targetStaff.filter(s => {
                const shiftVal = s.shifts ? s.shifts[selectedDate!] : null;
                if (!shiftVal) return true;
                if (typeof shiftVal === 'string') return shiftVal === '〇' || shiftVal === '休み';
                return !shiftVal[targetSiteForAdd!] || shiftVal[targetSiteForAdd!] === '〇' || shiftVal[targetSiteForAdd!] === '休み';
            });

            const circleStaff = unassignedStaff.filter(s => {
                const shiftVal = s.shifts ? s.shifts[selectedDate!] : null;
                if (typeof shiftVal === 'string') return shiftVal === '〇';
                if (typeof shiftVal === 'object' && shiftVal !== null) {
                    return Object.values(shiftVal).includes('〇');
                }
                return false;
            });

            const noCircleStaff = unassignedStaff.filter(s => !circleStaff.includes(s));

            return (
              <View style={{ flex: 1, padding: 20 }}>
                <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 15, color: '#1e293b' }}>{targetSiteForAdd?.toUpperCase()} に編成する</Text>
                <ScrollView showsVerticalScrollIndicator={false}>
                  <Text style={localStyles.sectionLabelGold}>■ 希望を出しているメンバー</Text>
                  {circleStaff.length === 0 && <Text style={{ color:'#94a3b8', marginBottom:15 }}>該当なし</Text>}
                  {circleStaff.map(staff => (
                    <TouchableOpacity key={staff.id} style={localStyles.addStaffItem} onPress={() => addStaffToDate(targetSiteForAdd!, staff)}>
                      <View><Text style={{ fontSize: 16, fontWeight: 'bold' }}>{staff.name}</Text><Text style={{ fontSize: 10, color: '#64748b' }}>{staff.role}</Text></View>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}><Text style={{ color: '#10B981', fontWeight: 'bold', marginRight: 10, fontSize: 12 }}>〇 希望あり</Text><Ionicons name="add-circle" size={24} color="#10B981" /></View>
                    </TouchableOpacity>
                  ))}

                  <Text style={[localStyles.sectionLabelGold, { color: '#64748b', marginTop: 20 }]}>■ 希望を出していないメンバー</Text>
                  {noCircleStaff.length === 0 && <Text style={{ color:'#94a3b8', marginBottom:15 }}>該当なし</Text>}
                  {noCircleStaff.map(staff => (
                    <TouchableOpacity key={staff.id} style={[localStyles.addStaffItem, { opacity: 0.6, borderColor: '#E2E8F0' }]} onPress={() => {
                        Alert.alert("確認", "シフト希望を出していないメンバーですが、追加しますか？", [
                          { text: "キャンセル", style: "cancel" },
                          { text: "追加する", onPress: () => addStaffToDate(targetSiteForAdd!, staff) }
                        ]);
                      }}>
                      <View><Text style={{ fontSize: 16, fontWeight: 'bold', color: '#64748b' }}>{staff.name}</Text><Text style={{ fontSize: 10, color: '#94a3b8' }}>{staff.role}</Text></View>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}><Text style={{ color: '#94a3b8', marginRight: 10, fontSize: 12 }}>希望なし</Text><Ionicons name="add-circle-outline" size={24} color="#94a3b8" /></View>
                    </TouchableOpacity>
                  ))}
                  <View style={{ height: 40 }}/>
                </ScrollView>
              </View>
            );
          })()}

          {modalView === 'editTime' && (
            <View style={{ flex: 1, padding: 20 }}>
              <Text style={{ fontSize: 18, fontWeight: '900', color: '#1e293b', marginBottom: 20, textAlign: 'center' }}>{editingStaff?.name} のシフトを編集</Text>
              <ScrollView showsVerticalScrollIndicator={false}>
                
                <View style={{ backgroundColor: '#F8FAFC', padding: 15, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: '#E2E8F0' }}>
                  <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#64748b', marginBottom: 10 }}>よく使う時間の選択 (テンプレート)</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 15 }}>
                    {shiftTemplates.map((temp, idx) => (
                      <TouchableOpacity key={idx} style={{ paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#FFF', borderRadius: 8, borderWidth: 1, borderColor: '#B8860B' }} onPress={() => applyTemplate(temp)}>
                        <Text style={{ color: '#B8860B', fontWeight: 'bold' }}>{temp}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View style={{ flexDirection: 'row' }}>
                    <TextInput style={{ flex: 1, backgroundColor: '#FFF', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#CBD5E1', marginRight: 10 }} placeholder="例: 19:00-24:00" value={newTemplateInput} onChangeText={setNewTemplateInput} />
                    <TouchableOpacity style={{ backgroundColor: '#1e293b', justifyContent: 'center', paddingHorizontal: 15, borderRadius: 8 }} onPress={saveNewTemplate}>
                      <Text style={{ color: '#FFF', fontWeight: 'bold' }}>保存</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {SITES.map(site => <CustomTimePicker key={site} site={site} value={editShiftsForDate[site]} onChange={(v) => setEditShiftsForDate(prev => ({ ...prev, [site]: v }))} />)}
                <TouchableOpacity style={localStyles.goldBtn} onPress={saveStaffTime}><Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 16 }}>時間を確定する</Text></TouchableOpacity>
                <View style={{ height: 50 }} />
              </ScrollView>
            </View>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  header: { paddingHorizontal: 20, paddingVertical: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', letterSpacing: 1, color: '#1e293b' },
});

const localStyles = StyleSheet.create({
  monthNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  monthText: { fontSize: 22, fontWeight: 'bold', color: '#1e293b' },
  calendarCard: { backgroundColor: '#FFF', paddingHorizontal: 5 },
  weekHeader: { flexDirection: 'row', paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  weekText: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: 'bold', color: '#94a3b8' },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: '14.28%', height: screenHeight / 8.5, borderBottomWidth: 0.5, borderRightWidth: 0.5, borderColor: '#F1F5F9', padding: 2, alignItems: 'center' },
  dayCellActive: { backgroundColor: '#F0FDF4' },
  dayNum: { fontSize: 15, color: '#475569', marginTop: 2, fontWeight: 'bold' },
  miniTotalCount: { fontSize: 10, color: '#B8860B', fontWeight: 'bold' },
  dayNumberActive: { color: '#B8860B', fontWeight: 'bold' },
  siteCountText: { fontSize: 8, color: '#B8860B', fontWeight: 'bold', textAlign: 'center', marginTop: 2 },
  eventBadge: { marginTop: 2, backgroundColor: '#FFFBEB', padding: 2, borderRadius: 4, width: '100%', borderWidth: 0.5, borderColor: '#F59E0B' },
  eventText: { color: '#92400E', fontSize: 8, fontWeight: 'bold', textAlign: 'center' },
  detailSiteTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginBottom: 10 },
  detailStaffRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 15, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  detailDeleteBtn: { padding: 8, backgroundColor: '#FEF2F2', borderRadius: 8 },
  addStaffBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, backgroundColor: '#F0FDF4', borderRadius: 12, borderWidth: 1, borderColor: '#10B981', borderStyle: 'dashed' },
  sectionLabelGold: { fontSize: 14, fontWeight: 'bold', color: '#B8860B', marginBottom: 10, borderBottomWidth: 1, borderColor: '#E2E8F0', paddingBottom: 5 },
  addStaffItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderColor: '#F1F5F9', backgroundColor: '#FFF', borderRadius: 8, marginBottom: 5 },
  dropdownBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#F8FAFC', borderRadius: 8, borderWidth: 1, borderColor: '#CBD5E1' },
  dropdownText: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginRight: 5 },
  goldBtn: { width: '100%', backgroundColor: '#B8860B', padding: 18, borderRadius: 15, alignItems: 'center', marginTop: 10 },
});