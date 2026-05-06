import { getToken, isSupported, Messaging } from 'firebase/messaging';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { auth, db } from '../firebase';
import { arrayUnion, doc, updateDoc } from 'firebase/firestore';

const VAPID_KEY = process.env.EXPO_PUBLIC_FIREBASE_VAPID_KEY;

export function useNotifications() {
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const setup = async () => {
      try {
        const supported = await isSupported();
        if (!supported) return;

        const { getMessaging } = await import('firebase/messaging');
        const { getApp } = await import('firebase/app');
        const messaging: Messaging = getMessaging(getApp());

        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        const token = await getToken(messaging, { vapidKey: VAPID_KEY });
        if (!token) return;

        const user = auth.currentUser;
        if (!user) return;

        await updateDoc(doc(db, 'users', user.uid), {
          fcmTokens: arrayUnion(token),
        });
      } catch (e) {
        // 通知が無効/未対応の場合は無視
      }
    };

    // ログイン後に呼ばれる想定なので少し遅延して実行
    const timer = setTimeout(setup, 2000);
    return () => clearTimeout(timer);
  }, []);
}
