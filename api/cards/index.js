import jwt from 'jsonwebtoken';
import connectDB from '../../lib/db.js';
import Card from '../../models/Card.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  await connectDB();

  try {
    const authHeader = req.headers.authorization;
    
    // Для получения карт авторизация обязательна
    if (!authHeader) {
      return res.status(401).json({ error: 'Нет токена авторизации' });
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Неверный токен' });
    }

    const userId = decoded.id;

    // Получаем карты пользователя
    // (Примечание: если вы перешли на хранение токена в User.yookassaPaymentMethodId, 
    // этот запрос можно будет упростить, но пока оставляем как есть)
    const cards = await Card.find({ userId: userId });
    
    res.status(200).json(cards);

  } catch (err) {
    console.error('Get cards error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}