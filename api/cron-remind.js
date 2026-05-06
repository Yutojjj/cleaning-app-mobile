// Vercel Cron: 毎月25日 09:00 JST (00:00 UTC) にスタッフへ出勤簿提出リマインダーを送信
// vercel.json cron: "0 0 25 * *"
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function getAdminApp() {
  if (getApps().length) return getApps()[0];
  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

export default async function handler(req, res) {
  // Vercel Cronからのリクエストのみ許可
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).end();
  }

  const app = getAdminApp();
  const db = getFirestore(app);

  const today = new Date();
  const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  const snap = await db.collection('users').get();
  const tokens = [];

  snap.forEach((d) => {
    const u = d.data();
    if (u.role === 'admin') return;
    const status = u.monthlyStatus?.[monthKey];
    if (!status && u.fcmTokens?.length) {
      tokens.push(...u.fcmTokens);
    }
  });

  if (!tokens.length) return res.status(200).json({ sent: 0 });

  const serverKey = process.env.FIREBASE_SERVER_KEY;
  const results = await Promise.allSettled(
    tokens.map((token) =>
      fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `key=${serverKey}`,
        },
        body: JSON.stringify({
          to: token,
          notification: {
            title: '出勤簿の提出期限',
            body: `今月（${monthKey}）の出勤簿がまだ提出されていません。確認・提出をお願いします。`,
          },
        }),
      })
    )
  );

  const failed = results.filter((r) => r.status === 'rejected').length;
  res.status(200).json({ sent: tokens.length - failed, failed });
}
