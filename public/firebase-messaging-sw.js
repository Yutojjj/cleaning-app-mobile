importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDmBRdEHML3Q6M_dRhW0xqR8B95rYaCHVw",
  authDomain: "yagi-fb7f9.firebaseapp.com",
  projectId: "yagi-fb7f9",
  storageBucket: "yagi-fb7f9.firebasestorage.app",
  messagingSenderId: "441879617417",
  appId: "1:441879617417:web:40f442a6fc933a41ca4b58"
});

const messaging = firebase.messaging();

// バックグラウンドでプッシュ通知を受信したときの処理
messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {};
  self.registration.showNotification(title || 'パイナップル', {
    body: body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
  });
});
