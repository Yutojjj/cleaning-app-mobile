import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useNavigation, useRouter } from 'expo-router';
import {
  browserLocalPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import { addDoc, collection, doc, getDoc, getDocs, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Dimensions, Modal,
  Platform,
  SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View
} from 'react-native';
import { auth, db } from '../../firebase';

const { height: screenHeight, width: screenWidth } = Dimensions.get('window');
const GAS_WEB_APP_URL = 'YOUR_GAS_WEB_APP_URL_HERE';
const SITES = ['warp', 'thewarp', 'ラドンナ', '他'];

export default function HomeScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [systemId, setSystemId] = useState('');
  const [password, setPassword] = useState('');
  const [mockStaff, setMockStaff] = useState<Record<string, any>>({});
  const [shopEvents, setShopEvents] = useState<Record<string, string>>({});
  const [currentTime, setCurrentTime] = useState(new Date());
  const [locationText, setLocationText] = useState('位置情報を取得中...');
  const [correctionModalVisible, setCorrectionModalVisible] = useState(false);
  const [correctionReason, setCorrectionReason] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [webPayslipVisible, setWebPayslipVisible] = useState(false);
  const [selectedPayslipMonth, setSelectedPayslipMonth] = useState<string | null>(null);
  const [stats, setStats] = useState({ workingDays: 0, actualHours: 0, regularHours: 0, overtimeHours: 0, nightHours: 0, expectedSalary: 0, dmAllowance: 0, advancePayment: 0, finalSalary: 0 });
  const [statsExpanded, setStatsExpanded] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => { if (Platform.OS === 'web') setPersistence(auth, browserLocalPersistence).catch(console.error); }, []);

  useEffect(() => {
    (async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') { setLocationText('位置情報の許可がありません'); return; }
        
        let location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
        const lat = location.coords.latitude; 
        const lon = location.coords.longitude;
        
        try {
          if (Platform.OS !== 'web') {
            let reverseGeocode = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
            if (reverseGeocode.length > 0) {
              const place = reverseGeocode[0];
              const address = `${place.region || ''}${place.city || ''}${place.street || ''}${place.name || ''}`;
              setLocationText(address || `緯度:${lat.toFixed(4)} 経度:${lon.toFixed(4)}`);
              return;
            }
          }
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&accept-language=ja`);
          const data = await response.json();
          if (data && data.address) {
            const a = data.address;
            const fullAddress = `${a.province || a.state || ''}${a.city || a.town || a.village || a.county || ''}${a.suburb || a.neighbourhood || a.residential || ''}${a.road || ''}`;
            setLocationText(fullAddress || `緯度:${lat.toFixed(4)} 経度:${lon.toFixed(4)}`);
          } else { 
            setLocationText(`緯度:${lat.toFixed(4)} 経度:${lon.toFixed(4)}`); 
          }
        } catch (geoError) { 
          setLocationText(`緯度:${lat.toFixed(4)} 経度:${lon.toFixed(4)}`); 
        }
      } catch (error) { 
        setLocationText('位置情報が取得できません'); 
      }
    })();
  }, []);

  const formattedTime = currentTime.toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour12: false });
  const curMonthKey = `${currentTime.getFullYear()}-${String(currentTime.getMonth() + 1).padStart(2, '0')}`;

  const getStatsForMonth = (data: any, targetMonthKey: string) => {
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
          for (const s of SITES) {
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

    const dmAllowance = dmCount * 250;
    const expected = (actual * wage) + (over * wage * 0.25) + (night * wage * 0.25) + dmAllowance;
    const advance = data.advancePayments?.[targetMonthKey] || 0;
    const finalExpected = expected - advance;

    return { workingDays: days, actualHours: actual, regularHours: actual - over, overtimeHours: over, nightHours: night, dmAllowance, advancePayment: advance, expectedSalary: Math.floor(expected), finalSalary: Math.floor(finalExpected) };
  };

  const fetchUsersAndEvents = async () => {
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const initial: Record<string, any[]> = { 'warp': [], 'thewarp': [], 'ラドンナ': [], '他': [] };
      usersSnap.forEach((docSnap) => {
        const u = docSnap.data();
        if (u.role !== 'admin') {
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
              initial[s].push({ id: docSnap.id, name: u.name, role: u.role, shifts: siteShifts, salaryAmount: u.salaryAmount });
            }
          });
        }
      });
      setMockStaff(initial);

      const eventsSnap = await getDocs(collection(db, 'events'));
      const evs: Record<string, string> = {};
      eventsSnap.forEach(d => { evs[d.id] = d.data().title; });
      setShopEvents(evs);
    } catch (error) {}
  };

  useEffect(() => {
    const parent = navigation.getParent();
    if (parent) {
      if (!user) { parent.setOptions({ tabBarStyle: { display: 'none' } }); } 
      else { parent.setOptions({ tabBarStyle: { display: 'flex' } }); }
    }
  }, [user, navigation]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        const userDoc = await getDoc(doc(db, 'users', u.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUser({ ...u, ...data });
          setUserRole(data.role);
          if (data.role !== 'admin') {
              const curMonthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
              setStats(getStatsForMonth(data, curMonthKey));
          }
          await fetchUsersAndEvents();
        }
      } else {
        setUser(null);
        setUserRole(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleLogin = async () => {
    if (!systemId || !password) { Alert.alert("エラー", "入力してください"); return; }
    setIsProcessing(true);
    const email = `${systemId.trim()}@cleaning-app.local`;
    try { await signInWithEmailAndPassword(auth, email, password); } 
    catch (error) { Alert.alert("失敗", "ID/PASSが違います"); } 
    finally { setIsProcessing(false); }
  };

  const handleLogout = async () => { 
    setIsMenuOpen(false);
    try { await signOut(auth); } catch (error) {} 
  };

  const handleClockAction = async (actionType: '出勤' | '退勤' | '休憩開始' | '休憩終了' | '打刻修正') => {
    if (actionType === '打刻修正' && user?.monthlyStatus && (user.monthlyStatus[curMonthKey] === 'submitted' || user.monthlyStatus[curMonthKey] === 'approved')) {
      Alert.alert("申請不可", "今月の実績は既に提出済みのため、打刻修正はできません。");
      return;
    }
    
    setIsSending(true);
    try {
      // ⑦ Firestore への履歴保存処理の追加
      await addDoc(collection(db, 'timecards'), {
        uid: user?.uid,
        name: user?.name,
        role: userRole,
        actionType,
        location: locationText,
        reason: actionType === '打刻修正' ? correctionReason : '',
        timestamp: new Date().toISOString()
      });

      if (GAS_WEB_APP_URL !== 'YOUR_GAS_WEB_APP_URL_HERE') {
        await fetch(GAS_WEB_APP_URL, { 
          method: 'POST', headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify({ actionType, site: 'WARP', staffName: user?.name, role: userRole, location: locationText, reason: actionType === '打刻修正' ? correctionReason : '', timestamp: new Date().toISOString() }) 
        });
      }
      
      if (actionType === '出勤') {
        try {
          const now = new Date();
          const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
          const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
          const userRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const att = userSnap.data().attendance || {};
            await updateDoc(userRef, {
              attendance: { ...att, [dateKey]: { ...(att[dateKey] || {}), dakoku: timeStr } }
            });
          }
        } catch {}
      }

      Alert.alert("完了", `${actionType} を記録しました`);
      if (actionType === '打刻修正') { setCorrectionReason(''); setCorrectionModalVisible(false); }
    } catch (error) { Alert.alert("通信エラー"); } 
    finally { setIsSending(false); }
  };

  const formatDateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const formatDateJapanese = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}(${dayNames[d.getDay()]})`;
  };

  const renderShiftSection = (dateKey: string, titleLabel: string) => {
    const eventTitle = shopEvents[dateKey];
    return (
      <View style={{ marginTop: 25, paddingHorizontal: 20 }}>
        <Text style={localStyles.sectionLabel}>{titleLabel}</Text>
        
        {eventTitle && (
          <View style={{ backgroundColor: '#FEF3C7', padding: 10, borderRadius: 8, marginBottom: 15, flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 16, marginRight: 5 }}>📌</Text>
            <Text style={{ color: '#92400E', fontWeight: 'bold' }}>{eventTitle}</Text>
          </View>
        )}

        {SITES.map(site => {
          let workingStaff = mockStaff[site] ? mockStaff[site].filter((staff:any) => !!staff.shifts[dateKey] && staff.shifts[dateKey] !== '休み' && staff.shifts[dateKey] !== '〇') : [];
          
          if (userRole !== 'admin') {
            workingStaff = workingStaff.filter((staff:any) => staff.id === user?.uid);
            if (workingStaff.length === 0) return null; 
          }

          return (
            <View key={site} style={styles.siteSection}>
              <View style={styles.siteHeader}>
                <Text style={styles.siteName}>{site.toUpperCase()}</Text>
                <Text style={styles.siteCount}>{workingStaff.length}名</Text>
              </View>
              {workingStaff.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
                  {workingStaff.map((staff:any) => {
                    return (
                      <View key={staff.id} style={[styles.staffCard, { backgroundColor: '#F0FDF4' }]}>
                        <Text style={styles.staffName} numberOfLines={1}>{staff.name}</Text>
                        <View style={styles.timeContainer}>
                          <Text style={[styles.staffTime, { color: '#10B981' }]}>{staff.shifts[dateKey]}</Text>
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>
              ) : (
                <View style={{ paddingHorizontal: 5, paddingVertical: 5 }}>
                  <Text style={{ color: '#94a3b8', fontSize: 13 }}>予定されているメンバーはいません</Text>
                </View>
              )}
            </View>
          );
        })}
      </View>
    );
  };

  if (loading) return <View style={localStyles.loadingContainer}><ActivityIndicator size="large" color="#B8860B" /></View>;

  if (!user) {
    return (
      <View style={{ flex: 1 }}>
        <Modal visible={true} animationType="fade" transparent={false}>
          <SafeAreaView style={styles.safeArea}>
            <View style={localStyles.loginContent}>
              <Text style={localStyles.loginTitle}>SYSTEM PORTAL</Text>
              <View style={localStyles.formCard}>
                <TextInput style={localStyles.textInput} placeholder="システムID" value={systemId} onChangeText={setSystemId} autoCapitalize="none" />
                <TextInput style={localStyles.textInput} placeholder="パスワード" value={password} onChangeText={setPassword} secureTextEntry />
                <TouchableOpacity style={localStyles.loginSubmitBtn} onPress={handleLogin} disabled={isProcessing}>
                  {isProcessing ? <ActivityIndicator color="#FFF" /> : <Text style={localStyles.loginSubmitText}>ログイン</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </Modal>
      </View>
    );
  }

  const todayKey = formatDateKey(currentTime);
  const tomorrow = new Date(currentTime); tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = formatDateKey(tomorrow);
  const isWorkingToday = Object.values(mockStaff).flat().some((s:any) => s.id === user.uid && s.shifts[todayKey] && s.shifts[todayKey] !== '休み' && s.shifts[todayKey] !== '〇');
  const approvedMonths = user.monthlyStatus ? Object.keys(user.monthlyStatus).filter(k => user.monthlyStatus[k] === 'approved').sort().reverse() : [];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={{ width: 32 }} />
        <View style={{ alignItems: 'center' }}><Text style={styles.headerTitle}>直近のシフト</Text><Text style={styles.headerSub}>{user.name} 様</Text></View>
        {userRole !== 'admin' ? (
          <TouchableOpacity onPress={() => setIsMenuOpen(true)}><Ionicons name="menu" size={32} color="#0f172a" /></TouchableOpacity>
        ) : (<View style={{ width: 32 }} />)}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {userRole !== 'admin' && (
          <View style={styles.clockCard}>
             <Text style={localStyles.currentTimeText}>{formattedTime}</Text>
             {isWorkingToday ? (
               <View>
                 <View style={styles.clockGrid}>
                    <TouchableOpacity style={[styles.clockBtn, { backgroundColor: '#10B981' }]} onPress={() => handleClockAction('出勤')} disabled={isSending}><Text style={styles.clockBtnText}>出勤</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.clockBtn, { backgroundColor: '#EF4444' }]} onPress={() => handleClockAction('退勤')} disabled={isSending}><Text style={styles.clockBtnText}>退勤</Text></TouchableOpacity>
                 </View>
                 <View style={[styles.clockGrid, { marginTop: 15 }]}>
                    <TouchableOpacity style={[styles.clockBtn, { backgroundColor: '#F59E0B', height: 45 }]} onPress={() => handleClockAction('休憩開始')} disabled={isSending}><Text style={[styles.clockBtnText, { fontSize: 14 }]}>休憩開始</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.clockBtn, { backgroundColor: '#B8860B', height: 45 }]} onPress={() => handleClockAction('休憩終了')} disabled={isSending}><Text style={[styles.clockBtnText, { fontSize: 14 }]}>休憩終了</Text></TouchableOpacity>
                 </View>
                 <TouchableOpacity style={{ marginTop: 20, alignItems: 'center' }} onPress={() => setCorrectionModalVisible(true)}>
                    <Text style={{ color: '#0f172a', textDecorationLine: 'underline', fontSize: 12 }}>充電切れ・押し忘れ等による打刻修正申請</Text>
                 </TouchableOpacity>
               </View>
             ) : (
               <View style={localStyles.offDayCard}><Ionicons name="cafe-outline" size={32} color="#B8860B" /><Text style={localStyles.offDayText}>本日はお休みです</Text></View>
             )}
             <View style={localStyles.locationBox}>
                <Ionicons name="location-outline" size={18} color="#64748b" />
                <Text style={localStyles.locationText}>{locationText}</Text>
             </View>
          </View>
        )}

        {renderShiftSection(todayKey, `本日のシフト (${formatDateJapanese(todayKey)})`)}
        {renderShiftSection(tomorrowKey, `明日のシフト (${formatDateJapanese(tomorrowKey)})`)}
        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={isMenuOpen} transparent animationType="fade" onRequestClose={() => setIsMenuOpen(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', flexDirection: 'row', justifyContent: 'flex-end' }} activeOpacity={1} onPress={() => setIsMenuOpen(false)}>
          <TouchableOpacity activeOpacity={1} style={{ width: screenWidth * 0.8, height: '100%', backgroundColor: '#FFF', padding: 20, shadowColor: '#000', shadowOffset: { width: -2, height: 0 }, shadowOpacity: 0.2, shadowRadius: 10 }}>
            
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30, marginTop: Platform.OS === 'ios' ? 40 : 10 }}>
              <Text style={{ fontSize: 20, fontWeight: '900', color: '#1e293b' }}>MENU</Text>
              <TouchableOpacity onPress={() => setIsMenuOpen(false)}><Ionicons name="close" size={28} color="#1e293b" /></TouchableOpacity>
            </View>

            <TouchableOpacity style={{ backgroundColor: '#F8FAFC', padding: 15, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: '#E2E8F0' }} onPress={() => setStatsExpanded(!statsExpanded)} activeOpacity={0.7}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text style={{ fontSize: 12, color: '#64748b', fontWeight: 'bold' }}>今月の見込み報酬(差引後)</Text>
                  <Text style={{ fontSize: 24, fontWeight: '900', color: '#B8860B', marginVertical: 5 }}>¥{stats.finalSalary.toLocaleString()}</Text>
                </View>
                <Ionicons name={statsExpanded ? "chevron-up" : "chevron-down"} size={20} color="#64748b" />
              </View>

              {statsExpanded && (
                <View style={{ marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#F1F5F9' }}>
                  <View style={localStyles.statRow}><Text style={localStyles.statTitle}>総支給額 (報酬)</Text><Text style={localStyles.statData}>¥{stats.expectedSalary.toLocaleString()}</Text></View>
                  <View style={localStyles.statRow}><Text style={localStyles.statTitle}>差し引き額 (日払い等)</Text><Text style={localStyles.statData}>¥{stats.advancePayment.toLocaleString()}</Text></View>
                  <View style={{ marginVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }} />
                  <View style={localStyles.statRow}><Text style={localStyles.statTitle}>出勤日数</Text><Text style={localStyles.statData}>{stats.workingDays} 日</Text></View>
                  <View style={localStyles.statRow}><Text style={localStyles.statTitle}>実労働時間</Text><Text style={localStyles.statData}>{stats.actualHours.toFixed(1)} h</Text></View>
                  <View style={localStyles.statRow}><Text style={localStyles.statTitle}>所定内労働時間</Text><Text style={localStyles.statData}>{stats.regularHours.toFixed(1)} h</Text></View>
                  <View style={localStyles.statRow}><Text style={[localStyles.statTitle, { color: '#EF4444' }]}>法定外残業 (8h超)</Text><Text style={[localStyles.statData, { color: '#EF4444' }]}>{stats.overtimeHours.toFixed(1)} h</Text></View>
                  <View style={localStyles.statRow}><Text style={[localStyles.statTitle, { color: '#B8860B' }]}>深夜労働 (22時〜翌5時)</Text><Text style={[localStyles.statData, { color: '#B8860B' }]}>{stats.nightHours.toFixed(1)} h</Text></View>
                  <View style={localStyles.statRow}><Text style={[localStyles.statTitle, { color: '#10B981' }]}>DM手当</Text><Text style={[localStyles.statData, { color: '#10B981' }]}>¥{stats.dmAllowance.toLocaleString()}</Text></View>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={localStyles.drawerLink} onPress={() => { setIsMenuOpen(false); setWebPayslipVisible(true); }}>
              <Ionicons name="document-text" size={22} color="#0f172a" style={{ marginRight: 15 }} />
              <Text style={localStyles.drawerLinkText}>WEB明細 (過去の報酬)</Text>
              <Ionicons name="chevron-forward" size={18} color="#CBD5E1" style={{ marginLeft: 'auto' }} />
            </TouchableOpacity>

            <TouchableOpacity style={[localStyles.drawerLink, { marginTop: 'auto', borderBottomWidth: 0 }]} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={22} color="#ef4444" style={{ marginRight: 15 }} />
              <Text style={[localStyles.drawerLinkText, { color: '#ef4444' }]}>ログアウト</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal visible={webPayslipVisible} animationType="slide" onRequestClose={() => { setSelectedPayslipMonth(null); setWebPayslipVisible(false); setIsMenuOpen(true); }}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => { 
              if (selectedPayslipMonth) {
                setSelectedPayslipMonth(null); 
              } else {
                setWebPayslipVisible(false);
                setIsMenuOpen(true);
              }
            }}>
              <Ionicons name="arrow-back" size={28} color="#B8860B" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{selectedPayslipMonth ? `${selectedPayslipMonth.replace('-', '年')}月分 報酬明細` : 'WEB明細一覧'}</Text>
            <View style={{ width: 28 }} />
          </View>
          
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            {!selectedPayslipMonth ? (
              approvedMonths.length === 0 ? (
                <Text style={{ textAlign: 'center', color: '#94a3b8', marginTop: 40 }}>確定した過去の報酬明細はありません。</Text>
              ) : (
                approvedMonths.map(mKey => {
                  const mStats = getStatsForMonth(user, mKey);
                  return (
                    <TouchableOpacity key={mKey} style={{ backgroundColor: '#FFF', padding: 20, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#E2E8F0', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }} onPress={() => setSelectedPayslipMonth(mKey)}>
                      <View>
                        <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#1e293b' }}>{mKey.replace('-', '年')}月分</Text>
                        <Text style={{ fontSize: 12, color: '#64748b', marginTop: 5 }}>差引支給額</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={{ fontSize: 20, fontWeight: '900', color: '#10B981', marginRight: 10 }}>¥{mStats.finalSalary.toLocaleString()}</Text>
                        <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
                      </View>
                    </TouchableOpacity>
                  );
                })
              )
            ) : (
              <View style={{ backgroundColor: '#FFF', padding: 25, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0' }}>
                <Text style={{ textAlign: 'center', fontSize: 14, color: '#64748b', fontWeight: 'bold', marginBottom: 10 }}>{user.name} 様</Text>
                <Text style={{ textAlign: 'center', fontSize: 12, color: '#64748b', marginTop: 5 }}>差引支給額</Text>
                <Text style={{ textAlign: 'center', fontSize: 32, fontWeight: '900', color: '#0f172a', marginBottom: 30 }}>¥{getStatsForMonth(user, selectedPayslipMonth).finalSalary.toLocaleString()}</Text>
                
                <View style={{ borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 20 }}>
                  <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#B8860B', marginBottom: 15 }}>支給内訳</Text>
                  <View style={localStyles.statRow}><Text style={localStyles.statTitle}>総支給額 (報酬)</Text><Text style={localStyles.statData}>¥{getStatsForMonth(user, selectedPayslipMonth).expectedSalary.toLocaleString()}</Text></View>
                  <View style={localStyles.statRow}><Text style={localStyles.statTitle}>差し引き額 (日払い等)</Text><Text style={localStyles.statData}>¥{getStatsForMonth(user, selectedPayslipMonth).advancePayment.toLocaleString()}</Text></View>
                  <View style={{ marginVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }} />
                  <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#B8860B', marginBottom: 15 }}>勤怠実績</Text>
                  <View style={localStyles.statRow}><Text style={localStyles.statTitle}>出勤日数</Text><Text style={localStyles.statData}>{getStatsForMonth(user, selectedPayslipMonth).workingDays} 日</Text></View>
                  <View style={localStyles.statRow}><Text style={localStyles.statTitle}>総労働時間</Text><Text style={localStyles.statData}>{getStatsForMonth(user, selectedPayslipMonth).actualHours.toFixed(1)} h</Text></View>
                  <View style={localStyles.statRow}><Text style={localStyles.statTitle}>法定外残業 (8h超)</Text><Text style={localStyles.statData}>{getStatsForMonth(user, selectedPayslipMonth).overtimeHours.toFixed(1)} h</Text></View>
                  <View style={localStyles.statRow}><Text style={localStyles.statTitle}>深夜労働 (22時〜翌5時)</Text><Text style={localStyles.statData}>{getStatsForMonth(user, selectedPayslipMonth).nightHours.toFixed(1)} h</Text></View>
                  <View style={localStyles.statRow}><Text style={localStyles.statTitle}>DM手当</Text><Text style={localStyles.statData}>¥{getStatsForMonth(user, selectedPayslipMonth).dmAllowance.toLocaleString()}</Text></View>
                </View>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal visible={correctionModalVisible} animationType="slide" transparent onRequestClose={() => setCorrectionModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#FFF', borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 30, paddingBottom: 50 }}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#1e293b', marginBottom: 20 }}>打刻の修正申請</Text>
            <Text style={{ fontSize: 14, color: '#64748b', marginBottom: 15 }}>スマホの充電切れなどで打刻できなかった場合、正しい出勤・退勤時間と理由を管理者に送信します。</Text>
            <TextInput
              style={{ backgroundColor: '#F8FAFC', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#CBD5E1', fontSize: 16, height: 100, textAlignVertical: 'top' }}
              placeholder="例：スマホの電源が切れていたため、18:00出勤で修正をお願いします。"
              multiline value={correctionReason} onChangeText={setCorrectionReason}
            />
            <View style={{ flexDirection: 'row', gap: 15, marginTop: 20 }}>
              <TouchableOpacity style={{ flex: 1, padding: 15, backgroundColor: '#F1F5F9', borderRadius: 12, alignItems: 'center' }} onPress={() => setCorrectionModalVisible(false)}>
                <Text style={{ color: '#64748b', fontWeight: 'bold' }}>キャンセル</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 1, padding: 15, backgroundColor: '#0f172a', borderRadius: 12, alignItems: 'center' }} onPress={() => handleClockAction('打刻修正')}>
                <Text style={{ color: '#FFF', fontWeight: 'bold' }}>管理者に送信</Text>
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
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { paddingHorizontal: 20, paddingVertical: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', letterSpacing: 1, color: '#1e293b' },
  headerSub: { fontSize: 13, color: '#64748b', marginTop: 4 },
  scrollContent: { paddingBottom: 100 },
  clockCard: { margin: 20, marginTop: 10, padding: 25, backgroundColor: '#FFFFFF', borderRadius: 20, elevation: 5, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 },
  clockGrid: { flexDirection: 'row', gap: 15 },
  clockBtn: { flex: 1, height: 65, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  clockBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 18 },
  siteSection: { marginBottom: 10 },
  siteHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 0, marginBottom: 10 },
  siteName: { fontSize: 16, fontWeight: '900', color: '#1e293b' },
  siteCount: { fontSize: 14, color: '#64748b' },
  horizontalScroll: { paddingLeft: 0 },
  staffCard: { width: 90, marginRight: 10, padding: 10, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#F1F5F9', alignItems: 'center' },
  staffName: { fontSize: 13, fontWeight: 'bold', color: '#1e293b' },
  timeContainer: { marginTop: 6 },
  staffTime: { fontSize: 10, fontWeight: 'bold' },
});

const localStyles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loginContent: { flex: 1, justifyContent: 'center', padding: 30 },
  loginTitle: { fontSize: 36, fontWeight: '900', color: '#B8860B', textAlign: 'center', marginBottom: 50, letterSpacing: 6 },
  formCard: { backgroundColor: '#FFF', padding: 30, borderRadius: 30, elevation: 5 },
  textInput: { backgroundColor: '#F8FAFC', padding: 18, borderRadius: 15, marginBottom: 20, borderWidth: 1, borderColor: '#CBD5E1', fontSize: 16 },
  loginSubmitBtn: { backgroundColor: '#0f172a', padding: 20, borderRadius: 15, alignItems: 'center' },
  loginSubmitText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 18 },
  offDayCard: { alignItems: 'center', gap: 10, paddingVertical: 10 },
  offDayText: { fontSize: 18, fontWeight: 'bold', color: '#B8860B' },
  sectionLabel: { fontSize: 18, fontWeight: '900', color: '#B8860B', marginBottom: 15 },
  currentTimeText: { fontSize: 36, fontWeight: '900', color: '#1e293b', textAlign: 'center', marginBottom: 20, letterSpacing: 2 },
  locationBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 20, gap: 6 },
  locationText: { fontSize: 12, color: '#64748b', fontWeight: 'bold' },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  statTitle: { fontSize: 14, color: '#475569', fontWeight: 'bold' },
  statData: { fontSize: 16, color: '#0f172a', fontWeight: 'bold' },
  drawerLink: { flexDirection: 'row', alignItems: 'center', paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  drawerLinkText: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
  dropdownBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#F8FAFC', borderRadius: 8, borderWidth: 1, borderColor: '#CBD5E1' },
  dropdownText: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginRight: 5 },
});