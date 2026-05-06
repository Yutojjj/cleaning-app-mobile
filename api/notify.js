// POST /api/notify
// Body: { tokens: string[], title: string, body: string }
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { tokens, title, body } = req.body || {};
  if (!tokens?.length) return res.status(400).json({ error: 'tokens required' });

  const serverKey = process.env.FIREBASE_SERVER_KEY;
  if (!serverKey) return res.status(500).json({ error: 'FIREBASE_SERVER_KEY not set' });

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
          notification: { title, body },
        }),
      })
    )
  );

  const failed = results.filter((r) => r.status === 'rejected').length;
  res.status(200).json({ sent: tokens.length - failed, failed });
}
