import { Ionicons } from '@expo/vector-icons';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Alert, Dimensions, Modal, Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../../firebase';

const { height: screenHeight } = Dimensions.get('window');
const DEFAULT_SITES = ['warp', 'thewarp', 'ラドンナ', '他'];

interface Staff { id: string; name: string; role: string; shifts: Record<string, string>; }

const formatDateJapanese = (dateStr: string) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}(${dayNames[d.getDay()]})`;
};

const SITE_BASE_COLORS: Record<string, string> = {
  'warp': '#3B82F6', 'thewarp': '#10B981', 'ラドンナ': '#8B5CF6', '他': '#F59E0B',
};
const EXTRA_COLORS = ['#EF4444', '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6B7280'];

const getSiteAbbrev = (site: string): string => {
  const map: Record<string, string> = { 'warp': 'w', 'thewarp': 'tw', 'ラドンナ': 'LA', '他': '他' };
  return map[site] || site.substring(0, 3).toUpperCase();
};

const getSiteColor = (site: string, allSites: string[]): string => {
  if (SITE_BASE_COLORS[site]) return SITE_BASE_COLORS[site];
  const extraIdx = allSites.filter(s => !SITE_BASE_COLORS[s]).indexOf(site);
  return EXTRA_COLORS[extraIdx % EXTRA_COLORS.length] || '#6B7280';
};

const isAssigned = (val: any): boolean => {
  if (!val) return false;
  if (typeof val === 'string') return val !== '〇' && val !== '休み';
  return false;
};

const hasHope = (raw: any): boolean => {
  if (!raw) return false;
  if (typeof raw === 'string') return raw === '〇';
  if (typeof raw === 'object') return Object.values(raw).some(v => v === '〇');
  return false;
};

export default function ShiftInputScreen() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUid, setCurrentUid] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [shifts, setShifts] = useState<Record<string, any>>({});
  const [mockStaff, setMockStaff] = useState<Record<string, Staff[]>>({});
  const [allStaffDB, setAllStaffDB] = useState<any[]>([]);
  const [shopEvents, setShopEvents] = useState<Record<string, string>>({});
  const [shiftConfig, setShiftConfig] = useState<any>(null);
  const [sitesList, setSitesList] = useState<string[]>(DEFAULT_SITES);
  const [detailView, setDetailView] = useState(false);
  const [twoWeekView, setTwoWeekView] = useState(false);
  const [twoWeekOffset, setTwoWeekOffset] = useState(0);

  const [dayDetailModalVisible, setDayDetailModalVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [modalView, setModalView] = useState<'list' | 'addStaff'>('list');
  const [targetSiteForAdd, setTargetSiteForAdd] = useState<string | null>(null);

  const fetchEvents = async () => {
    try {
      const snap = await getDocs(collection(db, 'events'));
      const evs: Record<string, string> = {};
      snap.forEach(d => { evs[d.id] = d.data().title; });
      setShopEvents(evs);
    } catch {}
  };

  const fetchUsersFromFirestore = async (sites: string[]) => {
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const fetchedUsers: any[] = [];
      const initial: Record<string, Staff[]> = {};
      sites.forEach(s => { initial[s] = []; });

      querySnapshot.forEach((docSnap) => {
        const u = docSnap.data();
        if (u.role !== 'admin') {
          fetchedUsers.push({ id: docSnap.id, ...u });
          const userSites = Array.isArray(u.sites) ? u.sites : (u.site ? [u.site] : []);
          userSites.forEach((s: string) => {
            if (!initial[s]) initial[s] = [];
            const siteShifts: Record<string, string> = {};
            if (u.shifts) {
              Object.keys(u.shifts).forEach(date => {
                const val = u.shifts[date];
                if (typeof val === 'string') siteShifts[date] = val;
                else if (val && typeof val === 'object' && val[s] && val[s] !== '休み') siteShifts[date] = val[s];
              });
            }
            initial[s].push({ id: docSnap.id, name: u.name, role: u.role, shifts: siteShifts });
          });
        }
      });
      setAllStaffDB(fetchedUsers);
      setMockStaff(initial);
    } catch {}
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
            if (data.role !== 'admin' && data.shifts) setShifts(data.shifts);

            const configSnap = await getDoc(doc(db, 'settings', 'shiftConfig'));
            if (configSnap.exists()) {
              const configData = configSnap.data();
              setShiftConfig(configData);
              if (data.role !== 'admin' && configData.targetMonth) {
                setCurrentMonth(new Date(configData.targetMonth + '-01'));
              }
            }

            const siteSnap = await getDoc(doc(db, 'settings', 'siteConfig'));
            const loadedSites = (siteSnap.exists() && siteSnap.data().sites) ? siteSnap.data().sites : DEFAULT_SITES;
            setSitesList(loadedSites);
            fetchUsersFromFirestore(loadedSites);
          }
        } catch {}
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

  const handleDayPress = async (dateKey: string) => {
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
    if (!newMock[site]) newMock[site] = [];
    const existingIndex = newMock[site].findIndex(s => s.id === staffDef.id);
    if (existingIndex >= 0) {
      const arr = [...newMock[site]];
      arr[existingIndex] = { ...arr[existingIndex], shifts: { ...arr[existingIndex].shifts, [selectedDate]: '出勤' } };
      newMock[site] = arr;
    } else {
      newMock[site] = [...newMock[site], { ...staffDef, shifts: { [selectedDate]: '出勤' } }];
    }
    setMockStaff(newMock);

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
        newDayShift[site] = '出勤';
        await updateDoc(userRef, { shifts: { ...currentShifts, [selectedDate]: newDayShift } });
      }
    } catch {}
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
    } catch {}
    fetchUsersFromFirestore(sitesList);
  };

  const autoFillShifts = async () => {
    if (!selectedDate) return;
    try {
      const configSnap = await getDoc(doc(db, 'settings', 'autoShiftConfig'));
      const autoConfig = configSnap.exists() ? configSnap.data() : { leaders: [], storeRequirements: {} };

      const leaderPriorityMap: Record<string, number> = {};
      (autoConfig.leaders || []).forEach((l: any, idx: number) => {
        leaderPriorityMap[l.userId] = idx;
      });

      const availableStaff = allStaffDB.filter(s => hasHope(s.shifts?.[selectedDate]));

      const updates: Record<string, Record<string, string>> = {};
      const newMock: Record<string, Staff[]> = JSON.parse(JSON.stringify(mockStaff));

      for (const site of sitesList) {
        if (site === '他') continue;
        const required: number = autoConfig.storeRequirements?.[site] || 0;
        if (required === 0) continue;

        const eligible = availableStaff.filter((s: any) => {
          const userSites = Array.isArray(s.sites) ? s.sites : (s.site ? [s.site] : []);
          return userSites.includes(site);
        });

        eligible.sort((a: any, b: any) => {
          const ap = leaderPriorityMap[a.id] ?? 9999;
          const bp = leaderPriorityMap[b.id] ?? 9999;
          return ap - bp;
        });

        const toAssign = eligible.slice(0, required);
        for (const staff of toAssign) {
          if (!updates[staff.id]) updates[staff.id] = {};
          updates[staff.id][site] = '出勤';

          if (!newMock[site]) newMock[site] = [];
          const idx = newMock[site].findIndex((s: Staff) => s.id === staff.id);
          if (idx >= 0) {
            newMock[site][idx] = { ...newMock[site][idx], shifts: { ...newMock[site][idx].shifts, [selectedDate]: '出勤' } };
          } else {
            newMock[site].push({ id: staff.id, name: staff.name, role: staff.role, shifts: { [selectedDate]: '出勤' } });
          }
        }
      }

      for (const [userId, siteShifts] of Object.entries(updates)) {
        const userRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
          const currentShifts = userDoc.data().shifts || {};
          const dayShift = currentShifts[selectedDate] || {};
          const newDayShift = typeof dayShift === 'string' ? {} : { ...dayShift };
          Object.assign(newDayShift, siteShifts);
          await updateDoc(userRef, { shifts: { ...currentShifts, [selectedDate]: newDayShift } });
        }
      }

      setMockStaff(newMock);
      Alert.alert('完了', '自動入力が完了しました');
    } catch {
      Alert.alert('エラー', '自動入力に失敗しました');
    }
  };

  const renderDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    if (!twoWeekView) {
      const firstDay = new Date(year, month, 1).getDay();
      const days: (number | null)[] = [];
      for (let i = 0; i < firstDay; i++) days.push(null);
      for (let i = 1; i <= daysInMonth; i++) days.push(i);
      return days;
    } else {
      const startDay = twoWeekOffset * 14 + 1;
      const endDay = Math.min(twoWeekOffset * 14 + 14, daysInMonth);
      const startDow = new Date(year, month, startDay).getDay();
      const days: (number | null)[] = [];
      for (let i = 0; i < startDow; i++) days.push(null);
      for (let i = startDay; i <= endDay; i++) days.push(i);
      return days;
    }
  };

  const cellHeight = twoWeekView ? screenHeight / 5 : screenHeight / 8.5;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: '#B8860B' }]}>{isAdmin ? 'シフト編成・管理' : 'シフト希望入力'}</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 150 }}>
        {!isAdmin && (
          <View>
            {!isWithinSubmissionPeriod() ? (
              <View style={{ backgroundColor: '#FEF2F2', padding: 15, alignItems: 'center' }}>
                <Text style={{ color: '#EF4444', fontWeight: 'bold', fontSize: 14 }}>募集期間外のため入力できません</Text>
                {shiftConfig && (
                  <View style={{ marginTop: 8, alignItems: 'center' }}>
                    <Text style={{ color: '#EF4444', fontSize: 12 }}>
                      {shiftConfig.targetMonth ? `【${shiftConfig.targetMonth.replace('-', '年')}月分 シフト希望】` : ''}
                    </Text>
                    <Text style={{ color: '#EF4444', fontSize: 12, marginTop: 2 }}>
                      募集期間: {shiftConfig.startDate} 〜 {shiftConfig.endDate}
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              shiftConfig && (
                <View style={{ backgroundColor: '#FFFBEB', padding: 12, alignItems: 'center', borderBottomWidth: 1, borderColor: '#FDE68A' }}>
                  <Text style={{ color: '#92400E', fontWeight: 'bold', fontSize: 13 }}>
                    {shiftConfig.targetMonth ? `${shiftConfig.targetMonth.replace('-', '年')}月分` : ''} シフト希望 受付中
                  </Text>
                  <Text style={{ color: '#B45309', fontSize: 12, marginTop: 3 }}>締切: {shiftConfig.endDate} まで</Text>
                </View>
              )
            )}
          </View>
        )}

        <View style={localStyles.monthNav}>
          <TouchableOpacity onPress={() => { setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)); setTwoWeekOffset(0); }}>
            <Ionicons name="chevron-back" size={28} color="#B8860B" />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={localStyles.monthText}>{currentMonth.getFullYear()}年 {currentMonth.getMonth() + 1}月</Text>
            {twoWeekView && (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 8 }}>
                <TouchableOpacity onPress={() => setTwoWeekOffset(Math.max(0, twoWeekOffset - 1))} disabled={twoWeekOffset === 0}>
                  <Ionicons name="chevron-back-circle-outline" size={22} color={twoWeekOffset === 0 ? '#CBD5E1' : '#B8860B'} />
                </TouchableOpacity>
                <Text style={{ fontSize: 11, color: '#64748b' }}>{twoWeekOffset === 0 ? '前半 (1〜14日)' : '後半 (15日〜)'}</Text>
                <TouchableOpacity onPress={() => setTwoWeekOffset(Math.min(1, twoWeekOffset + 1))} disabled={twoWeekOffset === 1}>
                  <Ionicons name="chevron-forward-circle-outline" size={22} color={twoWeekOffset === 1 ? '#CBD5E1' : '#B8860B'} />
                </TouchableOpacity>
              </View>
            )}
          </View>
          <TouchableOpacity onPress={() => { setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)); setTwoWeekOffset(0); }}>
            <Ionicons name="chevron-forward" size={28} color="#B8860B" />
          </TouchableOpacity>
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
              const dateKey = day
                ? `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                : '';
              const eventTitle = dateKey ? shopEvents[dateKey] : null;

              if (isAdmin) {
                const assignedCounts: Record<string, number> = {};
                const hopeIds = new Set<string>();

                for (const site of sitesList) {
                  const count = mockStaff[site]?.filter(s => isAssigned(s.shifts[dateKey])).length || 0;
                  if (count > 0) assignedCounts[site] = count;
                  mockStaff[site]?.forEach(staff => {
                    if (staff.shifts[dateKey] && staff.shifts[dateKey] !== '休み') hopeIds.add(staff.id);
                  });
                }
                const totalHopeStaff = day ? hopeIds.size : 0;

                return (
                  <TouchableOpacity key={i} style={[localStyles.dayCell, { height: cellHeight }]} onPress={() => day && handleDayPress(dateKey)} disabled={!day}>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'flex-start', width: '100%', paddingLeft: 3 }}>
                      <Text style={localStyles.dayNum}>{day || ''}</Text>
                      {day && totalHopeStaff > 0 && <Text style={localStyles.miniTotalCount}>{totalHopeStaff}名</Text>}
                    </View>
                    {eventTitle && <View style={localStyles.eventBadge}><Text style={localStyles.eventText} numberOfLines={1}>📌 {eventTitle}</Text></View>}

                    {detailView ? (
                      <View style={{ width: '100%', marginTop: 1 }}>
                        {sitesList.map(site => {
                          const siteStaff = mockStaff[site]?.filter(s => isAssigned(s.shifts[dateKey])) || [];
                          if (siteStaff.length === 0) return null;
                          const color = getSiteColor(site, sitesList);
                          return (
                            <View key={site}>
                              {siteStaff.map(s => (
                                <Text key={s.id} style={{ fontSize: 7.5, color, fontWeight: 'bold', lineHeight: 11 }} numberOfLines={1}>
                                  {getSiteAbbrev(site)}:{s.name.length > 3 ? s.name.slice(0, 3) : s.name}
                                </Text>
                              ))}
                            </View>
                          );
                        })}
                      </View>
                    ) : (
                      <View style={{ width: '100%', marginTop: 2 }}>
                        {Object.entries(assignedCounts).map(([site, count]) => (
                          <Text key={site} style={[localStyles.siteCountText, { color: getSiteColor(site, sitesList) }]} numberOfLines={1}>
                            {getSiteAbbrev(site)}:{count}名
                          </Text>
                        ))}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              } else {
                const hasShift = !!shifts[dateKey];
                return (
                  <TouchableOpacity
                    key={i}
                    style={[localStyles.dayCell, { height: cellHeight }, hasShift && localStyles.dayCellActive, eventTitle && { backgroundColor: '#FFFBEB' }]}
                    onPress={() => day && handleDayPress(dateKey)}
                    disabled={!day || !isWithinSubmissionPeriod()}
                    activeOpacity={0.6}
                  >
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

      {isAdmin && (
        <TouchableOpacity
          style={localStyles.fab}
          onPress={() => {
            const next = !detailView;
            setDetailView(next);
            setTwoWeekView(next);
            if (next) setTwoWeekOffset(0);
          }}
        >
          <Ionicons name={detailView ? 'list-outline' : 'people-outline'} size={26} color="#FFF" />
        </TouchableOpacity>
      )}

      <Modal
        visible={dayDetailModalVisible}
        animationType="slide"
        onRequestClose={() => { if (modalView !== 'list') setModalView('list'); else setDayDetailModalVisible(false); }}
      >
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => { if (modalView !== 'list') setModalView('list'); else setDayDetailModalVisible(false); }}>
              <Ionicons name={modalView === 'list' ? 'chevron-down' : 'arrow-back'} size={32} color="#B8860B" />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: '#B8860B' }]}>
              {modalView === 'list' ? `${formatDateJapanese(selectedDate || '')} シフト詳細` : 'スタッフ追加'}
            </Text>
            <View style={{ width: 32 }} />
          </View>

          {modalView === 'list' && (
            <View style={{ flex: 1 }}>
              <ScrollView style={{ padding: 20 }}>
                {sitesList.map(site => {
                  const color = getSiteColor(site, sitesList);
                  const workingStaff = mockStaff[site]?.filter(s => isAssigned(s.shifts[selectedDate!])) || [];
                  return (
                    <View key={site} style={{ marginBottom: 35 }}>
                      <Text style={[localStyles.detailSiteTitle, { color }]}>{site.toUpperCase()}</Text>
                      {workingStaff.length === 0 && (
                        <Text style={{ color: '#94a3b8', fontSize: 12, marginBottom: 10 }}>配置されているメンバーはいません</Text>
                      )}
                      {workingStaff.map(staff => (
                        <View key={staff.id} style={localStyles.detailStaffRow}>
                          <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#1e293b' }}>{staff.name}</Text>
                          <TouchableOpacity style={localStyles.detailDeleteBtn} onPress={() => deleteStaffFromDate(staff.id, site)}>
                            <Ionicons name="trash-outline" size={20} color="#ef4444" />
                          </TouchableOpacity>
                        </View>
                      ))}
                      <TouchableOpacity style={localStyles.addStaffBtn} onPress={() => { setTargetSiteForAdd(site); setModalView('addStaff'); }}>
                        <Ionicons name="add" size={20} color="#10B981" />
                        <Text style={{ color: '#10B981', fontWeight: 'bold', marginLeft: 5 }}>メンバーを追加・編成する</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
                <View style={{ height: 100 }} />
              </ScrollView>

              <TouchableOpacity style={localStyles.autoFillBtn} onPress={autoFillShifts}>
                <Ionicons name="flash" size={20} color="#FFF" />
                <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 14, marginLeft: 6 }}>自動入力</Text>
              </TouchableOpacity>
            </View>
          )}

          {modalView === 'addStaff' && (() => {
            const targetColor = getSiteColor(targetSiteForAdd || '', sitesList);

            const assignedStaff = mockStaff[targetSiteForAdd!]?.filter(s =>
              isAssigned(s.shifts[selectedDate!])
            ) || [];
            const assignedIds = new Set(assignedStaff.map(s => s.id));

            const nonAssignedStaff = allStaffDB.filter((s: any) => !assignedIds.has(s.id));

            const circleStaff = nonAssignedStaff.filter((s: any) => hasHope(s.shifts?.[selectedDate!]));
            const noCircleStaff = nonAssignedStaff.filter((s: any) => !circleStaff.some((c: any) => c.id === s.id));

            return (
              <View style={{ flex: 1, padding: 20 }}>
                <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 15, color: targetColor }}>
                  {targetSiteForAdd?.toUpperCase()} に編成する
                </Text>
                <ScrollView showsVerticalScrollIndicator={false}>

                  {assignedStaff.length > 0 && (
                    <View style={{ marginBottom: 20 }}>
                      <Text style={[localStyles.sectionLabelGold, { color: targetColor, borderColor: targetColor }]}>
                        ■ 現在の配置 ({targetSiteForAdd?.toUpperCase()})
                      </Text>
                      {assignedStaff.map(staff => (
                        <View key={staff.id} style={[localStyles.addStaffItem, { borderColor: targetColor, borderWidth: 1 }]}>
                          <View>
                            <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#1e293b' }}>{staff.name}</Text>
                            <Text style={{ fontSize: 12, color: targetColor, fontWeight: 'bold', marginTop: 2 }}>配置済み</Text>
                          </View>
                          <TouchableOpacity
                            style={localStyles.detailDeleteBtn}
                            onPress={() => deleteStaffFromDate(staff.id, targetSiteForAdd!)}
                          >
                            <Ionicons name="trash-outline" size={20} color="#ef4444" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}

                  <Text style={localStyles.sectionLabelGold}>■ 希望を出しているメンバー</Text>
                  {circleStaff.length === 0 && <Text style={{ color: '#94a3b8', marginBottom: 15 }}>該当なし</Text>}
                  {circleStaff.map((staff: any) => (
                    <TouchableOpacity key={staff.id} style={localStyles.addStaffItem} onPress={() => addStaffToDate(targetSiteForAdd!, staff)}>
                      <View>
                        <Text style={{ fontSize: 16, fontWeight: 'bold' }}>{staff.name}</Text>
                        <Text style={{ fontSize: 10, color: '#64748b' }}>{staff.role}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={{ color: '#10B981', fontWeight: 'bold', marginRight: 10, fontSize: 12 }}>〇 希望あり</Text>
                        <Ionicons name="add-circle" size={24} color="#10B981" />
                      </View>
                    </TouchableOpacity>
                  ))}

                  <Text style={[localStyles.sectionLabelGold, { color: '#64748b', marginTop: 20 }]}>■ 希望を出していないメンバー</Text>
                  {noCircleStaff.length === 0 && <Text style={{ color: '#94a3b8', marginBottom: 15 }}>該当なし</Text>}
                  {noCircleStaff.map((staff: any) => (
                    <TouchableOpacity key={staff.id} style={[localStyles.addStaffItem, { opacity: 0.7 }]} onPress={() => addStaffToDate(targetSiteForAdd!, staff)}>
                      <View>
                        <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#64748b' }}>{staff.name}</Text>
                        <Text style={{ fontSize: 10, color: '#94a3b8' }}>{staff.role}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={{ color: '#94a3b8', marginRight: 10, fontSize: 12 }}>希望なし</Text>
                        <Ionicons name="add-circle-outline" size={24} color="#94a3b8" />
                      </View>
                    </TouchableOpacity>
                  ))}

                  <View style={{ height: 40 }} />
                </ScrollView>
              </View>
            );
          })()}
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
  dayCell: { width: '14.28%', borderBottomWidth: 0.5, borderRightWidth: 0.5, borderColor: '#F1F5F9', padding: 2, alignItems: 'center' },
  dayCellActive: { backgroundColor: '#F0FDF4' },
  dayNum: { fontSize: 15, color: '#475569', marginTop: 2, fontWeight: 'bold' },
  miniTotalCount: { fontSize: 10, color: '#B8860B', fontWeight: 'bold' },
  dayNumberActive: { color: '#B8860B', fontWeight: 'bold' },
  siteCountText: { fontSize: 8, fontWeight: 'bold', textAlign: 'center', marginTop: 1 },
  eventBadge: { marginTop: 2, backgroundColor: '#FFFBEB', padding: 2, borderRadius: 4, width: '100%', borderWidth: 0.5, borderColor: '#F59E0B' },
  eventText: { color: '#92400E', fontSize: 8, fontWeight: 'bold', textAlign: 'center' },
  detailSiteTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  detailStaffRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 15, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  detailDeleteBtn: { padding: 8, backgroundColor: '#FEF2F2', borderRadius: 8 },
  addStaffBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, backgroundColor: '#F0FDF4', borderRadius: 12, borderWidth: 1, borderColor: '#10B981', borderStyle: 'dashed' },
  sectionLabelGold: { fontSize: 14, fontWeight: 'bold', color: '#B8860B', marginBottom: 10, borderBottomWidth: 1, borderColor: '#E2E8F0', paddingBottom: 5 },
  addStaffItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderColor: '#F1F5F9', backgroundColor: '#FFF', borderRadius: 8, marginBottom: 5 },
  fab: { position: 'absolute', bottom: 90, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: '#B8860B', justifyContent: 'center', alignItems: 'center', elevation: 6, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  autoFillBtn: { position: 'absolute', bottom: 30, right: 20, flexDirection: 'row', alignItems: 'center', backgroundColor: '#10B981', paddingVertical: 14, paddingHorizontal: 20, borderRadius: 28, elevation: 6, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
});
