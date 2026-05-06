import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, doc, getDocs, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Alert, Modal, Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { db } from '../../firebase';

const SITES = ['warp', 'thewarp', 'ラドンナ'];

const JissekiTimePicker = ({ value, onChange }: { value: string, onChange: (v: string) => void }) => {
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
    onChange(`${sh}:${sm}-${eh}:${(eh === '24') ? '00' : em}`);
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

  if (!value) {
    return (
      <TouchableOpacity style={pStyles.unset} onPress={() => { applyTime('19', '00', '24', '00'); }}>
        <Text style={{ color: '#64748b' }}>未設定 (タップして設定)</Text>
      </TouchableOpacity>
    );
  }

  const displayEndM = endH === '24' ? '00' : endM;
  const pickerData = openPicker?.endsWith('H') ? hours : minutes;

  return (
    <View style={pStyles.container}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
        <TouchableOpacity style={[pStyles.btn, openPicker === 'startH' && pStyles.btnOpen]} onPress={() => setOpenPicker(openPicker === 'startH' ? null : 'startH')}>
          <Text style={pStyles.btnText}>{startH}</Text><Ionicons name={openPicker === 'startH' ? 'caret-up' : 'caret-down'} size={13} color="#64748b"/>
        </TouchableOpacity>
        <Text style={pStyles.sep}>:</Text>
        <TouchableOpacity style={[pStyles.btn, openPicker === 'startM' && pStyles.btnOpen]} onPress={() => setOpenPicker(openPicker === 'startM' ? null : 'startM')}>
          <Text style={pStyles.btnText}>{startM}</Text><Ionicons name={openPicker === 'startM' ? 'caret-up' : 'caret-down'} size={13} color="#64748b"/>
        </TouchableOpacity>
        <Text style={[pStyles.sep, { marginHorizontal: 10, color: '#CBD5E1', fontSize: 16 }]}>〜</Text>
        <TouchableOpacity style={[pStyles.btn, openPicker === 'endH' && pStyles.btnOpen]} onPress={() => setOpenPicker(openPicker === 'endH' ? null : 'endH')}>
          <Text style={pStyles.btnText}>{endH}</Text><Ionicons name={openPicker === 'endH' ? 'caret-up' : 'caret-down'} size={13} color="#64748b"/>
        </TouchableOpacity>
        <Text style={pStyles.sep}>:</Text>
        <TouchableOpacity style={[pStyles.btn, openPicker === 'endM' && pStyles.btnOpen]} onPress={() => setOpenPicker(openPicker === 'endM' ? null : 'endM')}>
          <Text style={pStyles.btnText}>{displayEndM}</Text><Ionicons name={openPicker === 'endM' ? 'caret-up' : 'caret-down'} size={13} color="#64748b"/>
        </TouchableOpacity>
      </View>
      {openPicker && (
        <View style={{ borderTopWidth: 1, borderColor: '#E2E8F0', maxHeight: 180 }}>
          <ScrollView nestedScrollEnabled={true} showsVerticalScrollIndicator={true}>
            {pickerData!.map(item => (
              <TouchableOpacity key={item} style={{ padding: 13, alignItems: 'center', borderBottomWidth: 1, borderColor: '#F1F5F9' }} onPress={() => handleSelect(openPicker, item)}>
                <Text style={{ fontSize: 19, fontWeight: 'bold', color: '#1e293b' }}>{item}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
      <TouchableOpacity style={{ margin: 8, padding: 7, backgroundColor: '#F1F5F9', borderRadius: 8, alignItems: 'center' }} onPress={() => onChange('')}>
        <Text style={{ color: '#64748b', fontSize: 12, fontWeight: 'bold' }}>クリア</Text>
      </TouchableOpacity>
    </View>
  );
};

const pStyles = StyleSheet.create({
  container: { backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', marginVertical: 6 },
  unset: { backgroundColor: '#F8FAFC', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', marginVertical: 6 },
  btn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#FFF', borderRadius: 8, borderWidth: 1, borderColor: '#CBD5E1' },
  btnOpen: { borderColor: '#B8860B', backgroundColor: '#FFF8E7' },
  btnText: { fontSize: 17, fontWeight: 'bold', color: '#1e293b', marginRight: 4 },
  sep: { fontWeight: 'bold', marginHorizontal: 4, color: '#1e293b' },
});

interface StaffRecord {
  id: string;
  name: string;
  attendance: Record<string, any>;
  shifts: Record<string, any>;
  monthlyStatus: Record<string, string>;
}

export default function AdminAttendanceScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<'list' | 'approved' | 'unapproved'>('list');
  const [staff, setStaff] = useState<StaffRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMonth, setViewMonth] = useState(new Date());
  const [selectedStaff, setSelectedStaff] = useState<StaffRecord | null>(null);
  const [detailMonth, setDetailMonth] = useState(new Date());
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editJisseki, setEditJisseki] = useState('');

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'users'));
      const list: StaffRecord[] = [];
      snap.forEach(d => {
        const data = d.data();
        if (data.role !== 'admin') {
          list.push({
            id: d.id,
            name: data.name || '名前なし',
            attendance: data.attendance || {},
            shifts: data.shifts || {},
            monthlyStatus: data.monthlyStatus || {},
          });
        }
      });
      list.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
      setStaff(list);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchStaff(); }, []);

  const viewMonthKey = `${viewMonth.getFullYear()}-${String(viewMonth.getMonth() + 1).padStart(2, '0')}`;
  const detailMonthKey = `${detailMonth.getFullYear()}-${String(detailMonth.getMonth() + 1).padStart(2, '0')}`;

  const filteredStaff = tab === 'list'
    ? staff
    : staff.filter(s => {
        const status = s.monthlyStatus[viewMonthKey];
        return tab === 'approved' ? status === 'approved' : status !== 'approved';
      });

  const getStatusBadge = (s: StaffRecord, monthKey: string) => {
    const status = s.monthlyStatus[monthKey];
    if (status === 'approved') return { text: '承認済', color: '#10B981', bg: '#D1FAE5' };
    if (status === 'submitted') return { text: '提出済', color: '#3B82F6', bg: '#DBEAFE' };
    return { text: '未提出', color: '#94a3b8', bg: '#F1F5F9' };
  };

  const handleApproveMonth = async (staffMember: StaffRecord) => {
    const isApproved = staffMember.monthlyStatus[detailMonthKey] === 'approved';
    const action = isApproved ? '承認を取り消す' : '承認する';
    Alert.alert(
      `出勤簿${action}`,
      `${staffMember.name} の ${detailMonth.getMonth() + 1}月を${action}ますか？`,
      [
        { text: 'キャンセル', style: 'cancel' },
        { text: action, onPress: async () => {
          try {
            const newStatus = isApproved ? 'submitted' : 'approved';
            const nextMonthlyStatus = { ...staffMember.monthlyStatus, [detailMonthKey]: newStatus };
            await updateDoc(doc(db, 'users', staffMember.id), { monthlyStatus: nextMonthlyStatus });
            const updated = { ...staffMember, monthlyStatus: nextMonthlyStatus };
            setStaff(prev => prev.map(s => s.id === staffMember.id ? updated : s));
            setSelectedStaff(updated);
          } catch {
            Alert.alert('エラー', '処理に失敗しました');
          }
        }}
      ]
    );
  };

  const handleDayPress = (dateKey: string) => {
    if (editingDate === dateKey) { setEditingDate(null); return; }
    setEditingDate(dateKey);
    const dayData = selectedStaff!.attendance[dateKey];
    let jTime = '';
    if (dayData && typeof dayData === 'object') {
      jTime = dayData.jisseki || dayData.dakoku || '';
    } else if (typeof dayData === 'string' && dayData.includes('-')) {
      jTime = dayData;
    }
    if (!jTime) {
      const shiftData = selectedStaff!.shifts[dateKey];
      if (typeof shiftData === 'string' && shiftData !== '〇') jTime = shiftData;
      else if (typeof shiftData === 'object') {
        for (const s of SITES) {
          if (shiftData[s] && shiftData[s] !== '〇' && shiftData[s] !== '休み') { jTime = shiftData[s]; break; }
        }
      }
    }
    setEditJisseki(jTime);
  };

  const saveEdit = async () => {
    if (!selectedStaff || !editingDate) return;
    try {
      const newAttendance = { ...selectedStaff.attendance };
      const existing = newAttendance[editingDate];
      newAttendance[editingDate] = (existing && typeof existing === 'object')
        ? { ...existing, jisseki: editJisseki }
        : { jisseki: editJisseki };
      await updateDoc(doc(db, 'users', selectedStaff.id), { attendance: newAttendance });
      const updated = { ...selectedStaff, attendance: newAttendance };
      setStaff(prev => prev.map(s => s.id === selectedStaff.id ? updated : s));
      setSelectedStaff(updated);
      setEditingDate(null);
      Alert.alert('保存しました');
    } catch {
      Alert.alert('エラー', '保存に失敗しました');
    }
  };

  const getDaysInMonth = (month: Date) => {
    const y = month.getFullYear(), m = month.getMonth();
    const days = new Date(y, m + 1, 0).getDate(), first = new Date(y, m, 1).getDay();
    const arr: (number | null)[] = [];
    for (let i = 0; i < first; i++) arr.push(null);
    for (let i = 1; i <= days; i++) arr.push(i);
    return arr;
  };

  const renderStaffDetail = () => {
    if (!selectedStaff) return null;
    const isApproved = selectedStaff.monthlyStatus[detailMonthKey] === 'approved';
    const isSubmitted = selectedStaff.monthlyStatus[detailMonthKey] === 'submitted';
    const days = getDaysInMonth(detailMonth);

    return (
      <Modal visible={true} animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 }}>
          <View style={styles.detailHeader}>
            <TouchableOpacity onPress={() => { setSelectedStaff(null); setEditingDate(null); }}>
              <Ionicons name="arrow-back" size={24} color="#B8860B" />
            </TouchableOpacity>
            <Text style={{ fontSize: 17, fontWeight: 'bold', color: '#1e293b' }}>{selectedStaff.name}</Text>
            <TouchableOpacity
              style={{ backgroundColor: isApproved ? '#EF4444' : '#10B981', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}
              onPress={() => handleApproveMonth(selectedStaff)}
            >
              <Text style={{ color: '#FFF', fontSize: 12, fontWeight: 'bold' }}>{isApproved ? '承認取消' : '承認する'}</Text>
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, alignItems: 'center' }}>
            <TouchableOpacity onPress={() => { setDetailMonth(new Date(detailMonth.getFullYear(), detailMonth.getMonth() - 1, 1)); setEditingDate(null); }}>
              <Ionicons name="chevron-back" size={26} color="#B8860B" />
            </TouchableOpacity>
            <Text style={{ fontSize: 18, fontWeight: 'bold' }}>{detailMonth.getFullYear()}年 {detailMonth.getMonth() + 1}月</Text>
            <TouchableOpacity onPress={() => { setDetailMonth(new Date(detailMonth.getFullYear(), detailMonth.getMonth() + 1, 1)); setEditingDate(null); }}>
              <Ionicons name="chevron-forward" size={26} color="#B8860B" />
            </TouchableOpacity>
          </View>

          {(isApproved || isSubmitted) && (
            <View style={{ backgroundColor: isApproved ? '#D1FAE5' : '#DBEAFE', marginHorizontal: 16, marginBottom: 8, padding: 10, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name={isApproved ? 'checkmark-circle' : 'time'} size={17} color={isApproved ? '#10B981' : '#3B82F6'} />
              <Text style={{ fontSize: 13, fontWeight: 'bold', color: isApproved ? '#065F46' : '#1E40AF' }}>
                {isApproved ? '承認済み' : '提出済み（未承認）'}
              </Text>
            </View>
          )}

          <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 80 }}>
            {days.map((day, i) => {
              if (!day) return null;
              const dateKey = `${detailMonthKey}-${String(day).padStart(2, '0')}`;
              const dayData = selectedStaff.attendance[dateKey];
              let dakokuTime = '', jissekiTime = '', dmCount = 0;
              if (dayData && typeof dayData === 'object') {
                dakokuTime = dayData.dakoku || '';
                jissekiTime = dayData.jisseki || '';
                dmCount = (dayData.dmList || []).length;
              } else if (typeof dayData === 'string' && dayData.includes('-')) {
                jissekiTime = dayData;
              }
              const shiftData = selectedStaff.shifts[dateKey];
              let shiftInfo = '';
              if (shiftData) {
                if (typeof shiftData === 'string' && shiftData !== '〇') shiftInfo = shiftData;
                else if (typeof shiftData === 'object') {
                  for (const s of SITES) {
                    if (shiftData[s] && shiftData[s] !== '〇' && shiftData[s] !== '休み') { shiftInfo = shiftData[s]; break; }
                  }
                }
              }
              const isEditing = editingDate === dateKey;
              const dow = ['日', '月', '火', '水', '木', '金', '土'][new Date(detailMonth.getFullYear(), detailMonth.getMonth(), day).getDay()];
              const hasData = dakokuTime || jissekiTime || shiftInfo;

              return (
                <View key={i} style={[styles.dayRow, isEditing && { borderColor: '#B8860B', backgroundColor: '#FFFBEB' }, !hasData && { opacity: 0.5 }]}>
                  <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center' }} onPress={() => handleDayPress(dateKey)}>
                    <Text style={[styles.dayNum, dow === '日' && { color: '#EF4444' }, dow === '土' && { color: '#3B82F6' }]}>
                      {day}({dow})
                    </Text>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      {shiftInfo ? <Text style={{ fontSize: 12, color: '#64748b' }}>シフト: {shiftInfo}</Text> : null}
                      {dakokuTime ? <Text style={{ fontSize: 12, color: '#10B981' }}>打刻: {dakokuTime}</Text> : null}
                      {jissekiTime ? <Text style={{ fontSize: 12, color: '#1e293b', fontWeight: 'bold' }}>実績: {jissekiTime}</Text> : null}
                      {dmCount > 0 && <Text style={{ fontSize: 11, color: '#10B981' }}>DM: {dmCount}件</Text>}
                      {!hasData && <Text style={{ fontSize: 12, color: '#CBD5E1' }}>データなし</Text>}
                    </View>
                    <Ionicons name={isEditing ? 'chevron-up' : 'create-outline'} size={18} color="#B8860B" />
                  </TouchableOpacity>

                  {isEditing && (
                    <View style={{ marginTop: 12 }}>
                      <Text style={{ fontSize: 13, color: '#64748b', fontWeight: 'bold', marginBottom: 4 }}>実績時間を編集</Text>
                      <JissekiTimePicker value={editJisseki} onChange={setEditJisseki} />
                      <TouchableOpacity
                        style={{ backgroundColor: '#B8860B', padding: 12, borderRadius: 10, alignItems: 'center', marginTop: 8 }}
                        onPress={saveEdit}
                      >
                        <Text style={{ color: '#FFF', fontWeight: 'bold' }}>保存する</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 }}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/admin-menu')}>
          <Ionicons name="arrow-back" size={24} color="#B8860B" />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1e293b' }}>出勤簿管理</Text>
        <TouchableOpacity onPress={fetchStaff}>
          <Ionicons name="refresh" size={24} color="#B8860B" />
        </TouchableOpacity>
      </View>

      {tab !== 'list' && (
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 10, gap: 20 }}>
          <TouchableOpacity onPress={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}>
            <Ionicons name="chevron-back" size={22} color="#B8860B" />
          </TouchableOpacity>
          <Text style={{ fontSize: 16, fontWeight: 'bold' }}>{viewMonth.getFullYear()}年 {viewMonth.getMonth() + 1}月</Text>
          <TouchableOpacity onPress={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}>
            <Ionicons name="chevron-forward" size={22} color="#B8860B" />
          </TouchableOpacity>
        </View>
      )}

      <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, gap: 6 }}>
        {([['list', '一覧'], ['approved', '月別承認済み'], ['unapproved', '月別未承認']] as const).map(([key, label]) => (
          <TouchableOpacity
            key={key}
            style={[styles.tabBtn, tab === key && styles.tabBtnActive]}
            onPress={() => setTab(key)}
          >
            <Text style={[styles.tabBtnText, tab === key && { color: '#FFF' }]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#94a3b8' }}>読み込み中...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
          {filteredStaff.length === 0 && (
            <Text style={{ color: '#94a3b8', textAlign: 'center', marginTop: 40 }}>該当するスタッフがいません</Text>
          )}
          {filteredStaff.map(s => {
            const badge = getStatusBadge(s, viewMonthKey);
            return (
              <TouchableOpacity
                key={s.id}
                style={styles.staffCard}
                onPress={() => { setSelectedStaff(s); setDetailMonth(viewMonth); setEditingDate(null); }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#1e293b' }}>{s.name}</Text>
                  {tab !== 'list' && <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{viewMonthKey}</Text>}
                </View>
                <View style={{ backgroundColor: badge.bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}>
                  <Text style={{ fontSize: 12, fontWeight: 'bold', color: badge.color }}>{badge.text}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#CBD5E1" style={{ marginLeft: 8 }} />
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {selectedStaff && renderStaffDetail()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20, paddingVertical: 15,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6', backgroundColor: '#FFF',
  },
  detailHeader: {
    paddingHorizontal: 20, paddingVertical: 15,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6', backgroundColor: '#FFF',
  },
  staffCard: {
    backgroundColor: '#FFF', padding: 16, borderRadius: 14, marginBottom: 10,
    flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0',
  },
  dayRow: {
    backgroundColor: '#FFF', padding: 14, borderRadius: 12, marginBottom: 8,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  dayNum: { fontSize: 15, fontWeight: 'bold', color: '#1e293b', minWidth: 52 },
  tabBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center',
  },
  tabBtnActive: { backgroundColor: '#B8860B', borderColor: '#B8860B' },
  tabBtnText: { fontSize: 10, fontWeight: 'bold', color: '#64748b' },
});
