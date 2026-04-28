import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Modal, Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { getApp, getApps, initializeApp } from 'firebase/app';
import { createUserWithEmailAndPassword, getAuth, signOut } from 'firebase/auth';
import { collection, deleteDoc, doc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';

const kanaToRomaji = (kana: string) => {
  const mapping: Record<string, string> = {
    'あ':'a','い':'i','う':'u','え':'e','お':'o',
    'か':'ka','き':'ki','く':'ku','け':'ke','こ':'ko',
    'さ':'sa','し':'shi','す':'su','せ':'se','そ':'so',
    'た':'ta','ち':'chi','つ':'tsu','て':'te','と':'to',
    'な':'na','に':'ni','ぬ':'nu','ね':'ne','の':'no',
    'は':'ha','ひ':'hi','ふ':'fu','へ':'he','ほ':'ho',
    'ま':'ma','み':'mi','む':'mu','め':'me','も':'mo',
    'や':'ya','ゆ':'yu','よ':'yo',
    'ら':'ra','り':'ri','る':'ru','れ':'re','ろ':'ro',
    'わ':'wa','を':'wo','ん':'n',
    'が':'ga','ぎ':'gi','ぐ':'gu','げ':'ge','ご':'go',
    'ざ':'za','じ':'ji','ず':'zu','ぜ':'ze','ぞ':'zo',
    'だ':'da','ぢ':'ji','づ':'zu','で':'de','ど':'do',
    'ば':'ba','び':'bi','ぶ':'bu','べ':'be','ぼ':'bo',
    'ぱ':'pa','ぴ':'pi','ぷ':'pu','ぺ':'pe','ぽ':'po',
    'きゃ':'kya','きゅ':'kyu','きょ':'kyo',
    'しゃ':'sha','しゅ':'shu','しょ':'sho',
    'ちゃ':'cha','ちゅ':'chu','ちょ':'cho',
    'にゃ':'nya','にゅ':'nyu','にょ':'nyo',
    'ひゃ':'hya','ひゅ':'hyu','ひょ':'hyo',
    'みゃ':'mya','みゅ':'myu','みょ':'myo',
    'りゃ':'rya','りゅ':'ryu','りょ':'ryo',
    'っ':'tsu','ー':'-'
  };
  let romaji = '';
  for(let i = 0; i < kana.length; i++) {
    let k2 = kana.substring(i, i+2);
    if(mapping[k2]) { romaji += mapping[k2]; i++; }
    else { romaji += mapping[kana[i]] || kana[i]; }
  }
  return romaji;
};

export default function AccountScreen() {
  const router = useRouter();
  const [accountList, setAccountList] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [newNickname, setNewNickname] = useState('');
  const [newSites, setNewSites] = useState<string[]>(['warp']);
  const [newRole, setNewRole] = useState('アルバイト'); 

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editSites, setEditSites] = useState<string[]>([]);
  const [editRole, setEditRole] = useState('');
  const [salaryAmount, setSalaryAmount] = useState(''); 

  const fetchAccounts = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const users = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAccountList(users);
    } catch (error) {}
  };

  useEffect(() => { fetchAccounts(); }, []);

  const toggleSite = (site: string, currentSites: string[], setSites: (sites: string[]) => void) => {
    if (currentSites.includes(site)) {
      setSites(currentSites.filter(s => s !== site));
    } else {
      setSites([...currentSites, site]);
    }
  };

  const handleAddAccount = async () => {
    if (!newName || !newNickname || newSites.length === 0) {
      Alert.alert('エラー', '名前、ニックネーム、配属先は必須です');
      return;
    }

    const baseRomaji = kanaToRomaji(newNickname).toLowerCase();
    const randomIdSuffix = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const randomPassSuffix = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    
    const finalSystemId = `${baseRomaji}${randomIdSuffix}`;
    const finalPassword = `${baseRomaji}${randomPassSuffix}`;
    const email = `${finalSystemId}@cleaning-app.local`;

    try {
      const secondaryApp = getApps().find(app => app.name === 'SecondaryApp') || initializeApp(getApp().options, 'SecondaryApp');
      const secondaryAuth = getAuth(secondaryApp);

      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, finalPassword);
      const newUserId = userCredential.user.uid; 

      await signOut(secondaryAuth);

      const userRef = doc(db, 'users', newUserId);
      await setDoc(userRef, {
        name: newName,
        nickname: newNickname,
        gender: '男性',
        sites: newSites,
        role: newRole,
        systemId: finalSystemId,
        password: finalPassword,
        salaryType: 'hourly', 
        salaryAmount: 0 
      });

      Alert.alert('成功', 'アカウントを作成しました');
      setIsAddModalVisible(false);
      setNewName(''); setNewNickname(''); setNewSites(['warp']); setNewRole('アルバイト');
      fetchAccounts();

    } catch (error: any) {
      Alert.alert('エラー', 'アカウントの作成に失敗しました');
    }
  };

  const startEditing = () => {
    setEditName(selectedUser.name || '');
    const userSites = Array.isArray(selectedUser.sites) 
      ? selectedUser.sites 
      : (selectedUser.site ? [selectedUser.site] : []);
    setEditSites(userSites);
    setEditRole(selectedUser.role || 'アルバイト');
    setSalaryAmount(selectedUser.salaryAmount ? selectedUser.salaryAmount.toString() : '');
    setIsEditing(true);
  };

  const saveEditing = async () => {
    if (editSites.length === 0) { Alert.alert('エラー', '配属先を1つ以上選択してください'); return; }
    
    const amountNum = parseInt(salaryAmount, 10);
    if (salaryAmount !== '' && isNaN(amountNum)) {
      Alert.alert('エラー', '金額は半角数字で入力してください');
      return;
    }

    try {
      const userRef = doc(db, 'users', selectedUser.id);
      await updateDoc(userRef, {
        name: editName,
        sites: editSites,
        role: editRole,
        salaryType: 'hourly',
        salaryAmount: isNaN(amountNum) ? 0 : amountNum
      });
      Alert.alert('成功', '情報を更新しました');
      setIsEditing(false);
      setSelectedUser({ ...selectedUser, name: editName, sites: editSites, role: editRole, salaryType: 'hourly', salaryAmount: isNaN(amountNum) ? 0 : amountNum });
      fetchAccounts();
    } catch (error) {
      Alert.alert('エラー', '更新に失敗しました');
    }
  };

  const handleDeleteAccount = async (userId: string) => {
    Alert.alert('確認', 'このメンバーを削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      { text: '削除', style: 'destructive', onPress: async () => {
          try {
            await deleteDoc(doc(db, 'users', userId));
            Alert.alert('削除完了');
            setSelectedUser(null);
            fetchAccounts();
          } catch (error) { Alert.alert('エラー', '削除に失敗しました'); }
        } 
      }
    ]);
  };

  const getThemeStyle = (role: string) => {
    if (role === 'admin') return { bg: '#FFFBEB', border: '#FDE68A', icon: '#B8860B' }; 
    return { bg: '#F0FDF4', border: '#BBF7D0', icon: '#16A34A' }; 
  };

  const baseWage = parseInt(salaryAmount, 10) || 0;
  const overtimeWage = Math.floor(baseWage * 1.25); 
  const nightWage = Math.floor(baseWage * 1.25);    
  const nightOvertimeWage = Math.floor(baseWage * 1.50); 

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/admin-menu')}><Ionicons name="arrow-back" size={24} color="#B8860B" /></TouchableOpacity>
        <Text style={styles.headerTitle}>アカウント管理</Text>
        <TouchableOpacity onPress={() => setIsAddModalVisible(true)}><Ionicons name="person-add" size={24} color="#B8860B" /></TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        {accountList.map(user => {
          const theme = getThemeStyle(user.role);
          return (
            <TouchableOpacity 
              key={user.id} 
              style={[localStyles.userCard, { backgroundColor: theme.bg, borderColor: theme.border }]} 
              onPress={() => { setSelectedUser(user); setIsEditing(false); }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={[localStyles.iconBox, { borderColor: theme.border }]}>
                  <Ionicons name={user.role === 'admin' ? "shield-checkmark" : "person"} size={24} color={theme.icon} />
                </View>
                <View>
                  <Text style={localStyles.userName}>{user.name || '名前未設定'}</Text>
                  
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                    <Text style={[localStyles.userRole, { color: theme.icon, backgroundColor: '#FFF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' }]}>
                      {user.role === 'admin' ? '管理者' : (user.role || '未設定')}
                    </Text>
                    {user.role !== 'admin' && (
                      user.salaryAmount ? (
                        <Text style={{ backgroundColor: '#ECFCCB', color: '#65A30D', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, fontSize: 10, fontWeight: 'bold', overflow: 'hidden' }}>
                          時給: ¥{user.salaryAmount.toLocaleString()}/h
                        </Text>
                      ) : (
                        <Text style={{ backgroundColor: '#FEF2F2', color: '#EF4444', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, fontSize: 10, fontWeight: 'bold', overflow: 'hidden' }}>
                          時給未設定
                        </Text>
                      )
                    )}
                  </View>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.border} />
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Modal visible={!!selectedUser} animationType="fade" transparent onRequestClose={() => setSelectedUser(null)}>
        <View style={localStyles.modalOverlay}>
          <View style={localStyles.modalContent}>
            <Text style={localStyles.modalTitleGold}>{isEditing ? 'EDIT INFO' : '登録情報'}</Text>

            {!isEditing ? (
              <>
                <View style={localStyles.detailRow}>
                  <Text style={localStyles.detailLabel}>名前</Text>
                  <Text style={localStyles.detailValue}>{selectedUser?.name || '未設定'}</Text>
                </View>
                <View style={localStyles.detailRow}>
                  <Text style={localStyles.detailLabel}>配属先</Text>
                  <Text style={localStyles.detailValue}>
                    {(selectedUser?.sites || (selectedUser?.site ? [selectedUser.site] : []))
                      .filter(Boolean)
                      .map((s:string) => s.toUpperCase())
                      .join(', ') || '未設定'}
                  </Text>
                </View>
                <View style={localStyles.detailRow}>
                  <Text style={localStyles.detailLabel}>雇用形態</Text>
                  <Text style={localStyles.detailValue}>
                    {selectedUser?.role === 'admin' ? '管理者' : (selectedUser?.role || '未設定')}
                  </Text>
                </View>
                {selectedUser?.role !== 'admin' && (
                  <View style={localStyles.detailRow}>
                    <Text style={localStyles.detailLabel}>基本時給</Text>
                    <Text style={[localStyles.detailValue, { color: '#65A30D' }]}>
                      {selectedUser?.salaryAmount ? `¥${selectedUser.salaryAmount.toLocaleString()}` : '未設定'}
                    </Text>
                  </View>
                )}
                
                <View style={localStyles.authBox}>
                  <Text style={{ fontSize: 10, color: '#94a3b8', marginBottom: 5 }}>※長押しでコピーできます</Text>
                  <View style={localStyles.detailRow}>
                    <Text style={localStyles.detailLabel}>システムID</Text>
                    <Text style={[localStyles.detailValue, { color: '#B8860B' }]} selectable={true}>{selectedUser?.systemId || '未設定'}</Text>
                  </View>
                  <View style={localStyles.detailRow}>
                    <Text style={[localStyles.detailLabel, { borderBottomWidth: 0 }]}>パスワード</Text>
                    <Text style={[localStyles.detailValue, { color: '#ef4444' }]} selectable={true}>{selectedUser?.password || '未設定'}</Text>
                  </View>
                </View>
              </>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 450 }}>
                <Text style={localStyles.inputLabel}>名前</Text>
                <TextInput style={localStyles.textInput} value={editName} onChangeText={setEditName} />
                
                <Text style={localStyles.inputLabel}>配属先 (複数選択可)</Text>
                <View style={localStyles.pickerRow}>
                  {['warp', 'thewarp', 'ラドンナ', '他'].map(s => (
                    <TouchableOpacity key={s} style={[localStyles.pickBtn, editSites.includes(s) && localStyles.pickBtnActive]} onPress={() => toggleSite(s, editSites, setEditSites)}>
                      <Text style={{ color: editSites.includes(s) ? '#FFF' : '#333', fontWeight: 'bold' }}>{s.toUpperCase()}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* ★ 雇用形態から「社員」を削除 */}
                <Text style={localStyles.inputLabel}>雇用形態</Text>
                <View style={localStyles.pickerRow}>
                  {['アルバイト', 'admin'].map(r => (
                    <TouchableOpacity key={r} style={[localStyles.pickBtn, editRole === r && localStyles.pickBtnActive]} onPress={() => setEditRole(r)}>
                      <Text style={{ color: editRole === r ? '#FFF' : '#333', fontWeight: 'bold' }}>{r === 'admin' ? '管理者' : r}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {editRole !== 'admin' && (
                  <View style={localStyles.wageSection}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 }}>
                      <Text style={[localStyles.inputLabel, { marginBottom: 0, color: '#002d72' }]}>基本時給 (円)</Text>
                      <Text style={{ fontSize: 10, color: '#64748b' }}>※法定割増は自動計算</Text>
                    </View>
                    <View style={localStyles.wageInputContainer}>
                      <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#1e293b', marginRight: 10 }}>¥</Text>
                      <TextInput style={localStyles.wageInput} value={salaryAmount} onChangeText={setSalaryAmount} placeholder="1200" keyboardType="numeric" maxLength={7} />
                    </View>
                    <View style={localStyles.calculationBox}>
                      <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#475569', marginBottom: 8 }}>法定割増時の時給プレビュー</Text>
                      <View style={localStyles.calcRow}><Text style={localStyles.calcLabel}>深夜労働 (22時〜翌5時)</Text><Text style={localStyles.calcValue}>¥{nightWage.toLocaleString()}</Text></View>
                      <View style={localStyles.calcRow}><Text style={localStyles.calcLabel}>時間外労働 (1日8h超)</Text><Text style={localStyles.calcValue}>¥{overtimeWage.toLocaleString()}</Text></View>
                      <View style={[localStyles.calcRow, { borderBottomWidth: 0, paddingBottom: 0 }]}><Text style={localStyles.calcLabel}>深夜 ＋ 時間外</Text><Text style={localStyles.calcValue}>¥{nightOvertimeWage.toLocaleString()}</Text></View>
                    </View>
                  </View>
                )}
              </ScrollView>
            )}

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 30 }}>
              {!isEditing ? (
                <>
                  {selectedUser?.role !== 'admin' && (
                    <TouchableOpacity style={localStyles.deleteBtn} onPress={() => handleDeleteAccount(selectedUser.id)}><Text style={localStyles.deleteBtnText}>削除</Text></TouchableOpacity>
                  )}
                  <TouchableOpacity style={localStyles.editBtn} onPress={startEditing}><Text style={localStyles.editBtnText}>編集する</Text></TouchableOpacity>
                  <TouchableOpacity style={localStyles.closeBtn} onPress={() => setSelectedUser(null)}><Text style={localStyles.closeBtnText}>閉じる</Text></TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity style={localStyles.closeBtn} onPress={() => setIsEditing(false)}><Text style={localStyles.closeBtnText}>キャンセル</Text></TouchableOpacity>
                  <TouchableOpacity style={localStyles.saveBtn} onPress={saveEditing}><Text style={localStyles.saveBtnText}>保存する</Text></TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={isAddModalVisible} animationType="slide" transparent onRequestClose={() => setIsAddModalVisible(false)}>
        <View style={localStyles.modalOverlay}>
          <View style={[localStyles.modalContent, { height: '85%' }]}>
            <Text style={localStyles.modalTitleGold}>新規メンバー追加</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={localStyles.inputLabel}>名前 (漢字)</Text>
              <TextInput style={localStyles.textInput} value={newName} onChangeText={setNewName} placeholder="田中 太郎" />
              <Text style={localStyles.inputLabel}>ニックネーム (かな)</Text>
              <TextInput style={localStyles.textInput} value={newNickname} onChangeText={setNewNickname} placeholder="たろう" />
              <Text style={localStyles.inputLabel}>配属先 (複数選択可)</Text>
              <View style={localStyles.pickerRow}>
                {['warp', 'thewarp', 'ラドンナ', '他'].map(s => (
                  <TouchableOpacity key={s} style={[localStyles.pickBtn, newSites.includes(s) && localStyles.pickBtnActive]} onPress={() => toggleSite(s, newSites, setNewSites)}>
                    <Text style={{ color: newSites.includes(s) ? '#FFF' : '#333', fontWeight: 'bold' }}>{s.toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {/* ★ 新規作成時も「社員」を削除 */}
              <Text style={localStyles.inputLabel}>雇用形態</Text>
              <View style={localStyles.pickerRow}>
                {['アルバイト', 'admin'].map(r => (
                  <TouchableOpacity key={r} style={[localStyles.pickBtn, newRole === r && localStyles.pickBtnActive]} onPress={() => setNewRole(r)}>
                    <Text style={{ color: newRole === r ? '#FFF' : '#333', fontWeight: 'bold' }}>{r === 'admin' ? '管理者' : r}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <TouchableOpacity style={localStyles.closeBtn} onPress={() => setIsAddModalVisible(false)}><Text style={localStyles.closeBtnText}>キャンセル</Text></TouchableOpacity>
              <TouchableOpacity style={localStyles.saveBtn} onPress={handleAddAccount}><Text style={localStyles.saveBtnText}>登録する</Text></TouchableOpacity>
            </View>
          </View>
        </View>
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
  userCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderRadius: 15, marginBottom: 15, borderWidth: 1 },
  iconBox: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.6)', justifyContent: 'center', alignItems: 'center', marginRight: 15, borderWidth: 1 },
  userName: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginBottom: 4 },
  userRole: { fontSize: 10, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '90%', backgroundColor: '#FFFFFF', borderRadius: 25, padding: 30, elevation: 10 },
  modalTitleGold: { fontSize: 26, fontWeight: '900', color: '#B8860B', marginBottom: 25, textAlign: 'center', letterSpacing: 4 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  detailLabel: { fontSize: 14, color: '#64748b', fontWeight: 'bold' },
  detailValue: { fontSize: 16, color: '#1e293b', fontWeight: 'bold' },
  authBox: { marginTop: 15, backgroundColor: '#F8FAFC', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 15, borderWidth: 1, borderColor: '#E2E8F0' },
  deleteBtn: { flex: 1, backgroundColor: '#FEF2F2', padding: 15, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#FCA5A5' },
  deleteBtnText: { color: '#EF4444', fontWeight: 'bold', fontSize: 14 },
  editBtn: { flex: 1, backgroundColor: '#F3E5AB', padding: 15, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#F59E0B' },
  editBtnText: { color: '#92400E', fontWeight: 'bold', fontSize: 14 },
  closeBtn: { flex: 1, backgroundColor: '#F1F5F9', padding: 15, borderRadius: 12, alignItems: 'center' },
  closeBtnText: { color: '#64748b', fontWeight: 'bold', fontSize: 14 },
  saveBtn: { flex: 1, backgroundColor: '#B8860B', padding: 15, borderRadius: 12, alignItems: 'center' },
  saveBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  inputLabel: { fontSize: 14, fontWeight: 'bold', color: '#64748b', marginBottom: 8, marginTop: 15 },
  textInput: { backgroundColor: '#F8FAFC', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#CBD5E1', fontSize: 16 },
  pickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  pickBtn: { paddingVertical: 10, paddingHorizontal: 15, borderRadius: 8, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
  pickBtnActive: { backgroundColor: '#B8860B', borderColor: '#B8860B' },
  wageSection: { backgroundColor: '#F0F9FF', padding: 15, borderRadius: 16, borderWidth: 1, borderColor: '#BAE6FD', marginTop: 20 },
  wageInputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#93C5FD', borderRadius: 12, paddingHorizontal: 15, marginBottom: 15 },
  wageInput: { flex: 1, fontSize: 20, fontWeight: 'bold', color: '#1e293b', paddingVertical: 10 },
  calculationBox: { backgroundColor: '#FFFFFF', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E0F2FE' },
  calcRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  calcLabel: { fontSize: 10, color: '#475569', fontWeight: 'bold' },
  calcValue: { fontSize: 14, fontWeight: 'bold', color: '#0369A1' },
});