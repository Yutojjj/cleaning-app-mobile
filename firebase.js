import { getApp, getApps, initializeApp } from 'firebase/app';
// ★ Web用の browserLocalPersistence を追加でインポート
import AsyncStorage from '@react-native-async-storage/async-storage';
import { browserLocalPersistence, getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
// ★ OS判定のために Platform をインポート
import { Platform } from 'react-native';

// ★ ハードコーディングをやめ、.env から読み込むように変更
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

let auth;

// ★ Web環境とスマホ環境で、ログインの保持（Persistence）の方法を切り替える
if (Platform.OS === 'web') {
  auth = initializeAuth(app, {
    persistence: browserLocalPersistence
  });
} else {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
}

export { auth };
export const db = getFirestore(app);