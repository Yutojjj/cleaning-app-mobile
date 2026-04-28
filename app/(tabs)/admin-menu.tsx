import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { collection, getDocs } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../../firebase';

export default function AdminMenuScreen() {
  const router = useRouter();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const fetchPending = async () => {
      try {
        const curMonthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
        const snap = await getDocs(collection(db, 'users'));
        let count = 0;
        snap.forEach(d => {
          const u = d.data();
          if (u.role !== 'admin' && u.monthlyStatus && u.monthlyStatus[curMonthKey] === 'submitted') {
            count++;
          }
        });
        setPendingCount(count);
      } catch (e) {}
    };
    fetchPending();
  }, []);

  const handleLogout = async () => {
    try { await signOut(auth); router.replace('/'); } catch (error) {}
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>管理者メニュー</Text>
      </View>

      <ScrollView contentContainerStyle={styles.menuContainer}>

        <TouchableOpacity style={styles.menuBtnCard} onPress={() => router.push('/salary-calc')}>
          <Ionicons name="calculator" size={40} color="#B8860B" />
          <View style={styles.textContainer}>
            <Text style={styles.menuBtnTitle}>給料計算</Text>
            <Text style={styles.menuBtnSub}>スタッフの提出状況確認・給与内訳の計算</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuBtnCard} onPress={() => router.push('/shift-settings')}>
          <Ionicons name="calendar-outline" size={40} color="#B8860B" />
          <View style={styles.textContainer}>
            <Text style={styles.menuBtnTitle}>シフト期間設定</Text>
            <Text style={styles.menuBtnSub}>募集期間・対象月の設定</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuBtnCard} onPress={() => router.push('/approval')}>
          <Ionicons name="checkmark-circle" size={40} color="#B8860B" />
          <View style={styles.textContainer}>
            <Text style={styles.menuBtnTitle}>申請・承認管理</Text>
            <Text style={styles.menuBtnSub}>提出された出勤実績の確認・一括承認</Text>
          </View>
          {pendingCount > 0 && (
            <View style={{ backgroundColor: '#EF4444', borderRadius: 15, paddingHorizontal: 10, paddingVertical: 5, justifyContent: 'center' }}>
              <Text style={{ color: '#FFF', fontSize: 14, fontWeight: 'bold' }}>{pendingCount}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuBtnCard} onPress={() => router.push('/account')}>
          <Ionicons name="people" size={40} color="#B8860B" />
          <View style={styles.textContainer}>
            <Text style={styles.menuBtnTitle}>アカウント管理</Text>
            <Text style={styles.menuBtnSub}>スタッフ情報の編集・単価設定</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.menuBtnCard, { borderColor: '#FCA5A5' }]} onPress={handleLogout}>
          <Ionicons name="log-out" size={40} color="#EF4444" />
          <View style={styles.textContainer}>
            <Text style={[styles.menuBtnTitle, { color: '#EF4444' }]}>ログアウト</Text>
            <Text style={styles.menuBtnSub}>システムからログアウトします</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  header: { padding: 20, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', backgroundColor: '#FFF', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
  menuContainer: { padding: 20, gap: 15, paddingBottom: 50 },
  menuBtnCard: { backgroundColor: '#FFF', padding: 25, borderRadius: 16, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0', elevation: 2 },
  textContainer: { marginLeft: 20, flex: 1 },
  menuBtnTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
  menuBtnSub: { fontSize: 12, color: '#64748b', marginTop: 4 },
});