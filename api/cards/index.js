// api/cards/index.js
import connectDB from '../../lib/db.js';
import Card from '../../models/Card.js';
import { authenticateToken } from '../../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Проверка токена
  authenticateToken(req, res, async () => {
    await connectDB();

    try {
      const cards = await Card.find({ userId: req.userId });
      res.status(200).json(cards);
    } catch (err) {
      console.error('Get cards error:', err);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  });
}