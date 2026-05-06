import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { signOut } from 'firebase/auth';
import { collection, getDocs } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Alert, Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../../firebase';

export default function AdminMenuScreen() {
  const router = useRouter();
  const [pendingCount, setPendingCount] = useState(0);
  const [unsubmittedCount, setUnsubmittedCount] = useState(0);

  useEffect(() => {
    const fetchPending = async () => {
      try {
        const today = new Date();
        const curMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        const snap = await getDocs(collection(db, 'users'));
        let submitted = 0;
        let unsubmitted = 0;
        snap.forEach(d => {
          const u = d.data();
          if (u.role !== 'admin') {
            const status = u.monthlyStatus?.[curMonthKey];
            if (status === 'submitted') submitted++;
            else if (!status) unsubmitted++;
          }
        });
        setPendingCount(submitted);
        setUnsubmittedCount(unsubmitted);
      } catch (e) {}
    };
    fetchPending();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace('/');
    } catch (error) {}
  };

  const exportTimecardsCSV = async () => {
    try {
      const snap = await getDocs(collection(db, 'timecards'));
      let csvString = "\uFEFF日時,名前,アクション,位置情報,理由\n";
      
      const records: any[] = [];
      snap.forEach(d => { records.push(d.data()); });
      
      // 日時順に並び替え
      records.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      records.forEach(data => {
        const dateStr = new Date(data.timestamp).toLocaleString('ja-JP');
        csvString += `${dateStr},${data.name},${data.actionType},"${data.location || ''}","${data.reason || ''}"\n`;
      });

      if (Platform.OS === 'web') {
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `timecards_history.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        const fs: any = FileSystem;
        const dir = fs.documentDirectory;
        if (!dir) { Alert.alert("エラー", "ファイルシステムにアクセスできません"); return; }
        
        const fileUri = `${dir}timecards_history.csv`;
        await fs.writeAsStringAsync(fileUri, csvString, { encoding: 'utf8' });
        
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri);
        } else {
          Alert.alert("エラー", "CSV出力・共有機能がサポートされていません");
        }
      }
    } catch (error) {
      Alert.alert("エラー", "履歴の出力に失敗しました");
    }
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
            <Text style={styles.menuBtnTitle}>報酬計算</Text>
            <Text style={styles.menuBtnSub}>スタッフの提出状況確認・報酬内訳の計算</Text>
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
            {pendingCount > 0 && (
              <Text style={{ fontSize: 11, color: '#EF4444', fontWeight: 'bold', marginTop: 3 }}>未承認: {pendingCount}件</Text>
            )}
            {unsubmittedCount > 0 && (
              <Text style={{ fontSize: 11, color: '#F59E0B', fontWeight: 'bold', marginTop: 1 }}>未提出: {unsubmittedCount}名</Text>
            )}
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

        <TouchableOpacity style={styles.menuBtnCard} onPress={exportTimecardsCSV}>
          <Ionicons name="download-outline" size={40} color="#B8860B" />
          <View style={styles.textContainer}>
            <Text style={styles.menuBtnTitle}>打刻履歴CSV出力</Text>
            <Text style={styles.menuBtnSub}>全スタッフの打刻時間と位置情報を出力します</Text>
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