import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../../models/User.js';
import Card from '../../models/Card.js';
import Payment from '../../models/Payment.js';

const router = express.Router();

// Middleware: проверка авторизации + роль админа
const adminAuth = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Нет токена' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    
    // Проверяем, что это админ (по email из .env)
    User.findById(decoded.id).then(user => {
      if (!user || user.email !== process.env.ADMIN_EMAIL) {
        return res.status(403).json({ error: 'Доступ запрещён' });
      }
      next();
    }).catch(err => {
      return res.status(500).json({ error: 'Ошибка проверки прав' });
    });
  } catch (err) {
    res.status(401).json({ error: 'Неверный токен' });
  }
};

// Обзор: общая статистика
router.get('/overview', adminAuth, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalCards = await Card.countDocuments();
    const totalPayments = await Payment.countDocuments();
    
    const totalAmountResult = await Payment.aggregate([
      { $match: { status: 'succeeded' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalAmount = totalAmountResult[0]?.total || 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayPayments = await Payment.countDocuments({ createdAt: { $gte: today } });
    const todayAmountResult = await Payment.aggregate([
      { $match: { status: 'succeeded', createdAt: { $gte: today } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const todayAmount = todayAmountResult[0]?.total || 0;

    res.json({
      totalUsers,
      totalCards,
      totalPayments,
      totalAmount: Math.round(totalAmount),
      todayPayments,
      todayAmount: Math.round(todayAmount)
    });
  } catch (err) {
    console.error('Admin overview error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Все пользователи
router.get('/users', adminAuth, async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 }).lean();
    
    const usersWithStats = await Promise.all(users.map(async (u) => {
      const cardsCount = await Card.countDocuments({ userId: u._id });
      const paymentsCount = await Payment.countDocuments({ userId: u._id });
      const amountResult = await Payment.aggregate([
        { $match: { userId: u._id, status: 'succeeded' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);
      return {
        ...u,
        cardsCount,
        paymentsCount,
        totalAmount: Math.round(amountResult[0]?.total || 0)
      };
    }));

    res.json(usersWithStats);
  } catch (err) {
    console.error('Admin users error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Все платежи
router.get('/payments', adminAuth, async (req, res) => {
  try {
    const payments = await Payment.find()
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json(payments);
  } catch (err) {
    console.error('Admin payments error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Все карты
router.get('/cards', adminAuth, async (req, res) => {
  try {
    const cards = await Card.find().sort({ createdAt: -1 }).lean();
    
    const cardsWithUser = await Promise.all(cards.map(async (c) => {
      const user = await User.findById(c.userId);
      return { ...c, userEmail: user?.email || '—' };
    }));

    res.json(cardsWithUser);
  } catch (err) {
    console.error('Admin cards error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;