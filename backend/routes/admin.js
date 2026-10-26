import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../../models/User.js';
import Card from '../../models/Card.js';
import Payment from '../../models/Payment.js';

const router = express.Router();

// Middleware: проверка авторизации + роль админа
// const adminAuth = (req, res, next) => {
//   const token = req.header('Authorization')?.replace('Bearer ', '');
//   if (!token) return res.status(401).json({ error: 'Нет токена' });

//   try {
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     req.userId = decoded.id;
    
//     // Проверяем, что это админ (по email из .env)
//     User.findById(decoded.id).then(user => {
//       if (!user || user.email !== process.env.ADMIN_EMAIL) {
//         return res.status(403).json({ error: 'Доступ запрещён' });
//       }
//       next();
//     }).catch(err => {
//       return res.status(500).json({ error: 'Ошибка проверки прав' });
//     });
//   } catch (err) {
//     res.status(401).json({ error: 'Неверный токен' });
//   }
// };
// Middleware: проверка авторизации + роль админа
const adminAuth = async (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Нет токена' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    
    const user = await User.findById(decoded.id);
    
    // .trim() убирает случайные пробелы или переносы строк
    const userEmail = user ? user.email.trim().toLowerCase() : '';
    const adminEmail = process.env.ADMIN_EMAIL ? process.env.ADMIN_EMAIL.trim().toLowerCase() : '';

    console.log(`[ADMIN AUTH] Проверка доступа:`);
    console.log(`[ADMIN AUTH] Email пользователя: "${userEmail}"`);
    console.log(`[ADMIN AUTH] Email из .env:      "${adminEmail}"`);

    if (!user || userEmail !== adminEmail) {
      console.log('[ADMIN AUTH] ДОСТУП ЗАПРЕЩЁН (email не совпадает)');
      return res.status(403).json({ error: 'Доступ запрещён' });
    }

    console.log('[ADMIN AUTH] ДОСТУП РАЗРЕШЁН');
    next();
  } catch (err) {
    console.error('[ADMIN AUTH] Ошибка проверки токена:', err.message);
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

// Все карты (токен маскируется для безопасности)
router.get('/cards', adminAuth, async (req, res) => {
  try {
    const cards = await Card.find().sort({ createdAt: -1 }).lean();
    
    const cardsWithUser = await Promise.all(cards.map(async (c) => {
      const user = await User.findById(c.userId);
      return { 
        ...c, 
        userEmail: user?.email || '—',
        // Маскируем токен: показываем только последние 4 символа
        cardToken: c.cardToken ? `***${c.cardToken.slice(-4)}` : null
      };
    }));

    res.json(cardsWithUser);
  } catch (err) {
    console.error('Admin cards error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});


// Получить статус активных тестов
router.get('/test-status', adminAuth, async (req, res) => {
  try {
    const RecurringTest = (await import('../../models/RecurringTest.js')).default;
    const tests = await RecurringTest.find({ isActive: true });
    res.json(tests);
  } catch (err) {
    console.error('Get test status error:', err);
    res.status(500).json({ error: 'Ошибка' });
  }
});

// Запустить тест
router.post('/start-test', adminAuth, async (req, res) => {
  try {
    const { cardId } = req.body;
    const RecurringTest = (await import('../../models/RecurringTest.js')).default;
    const Card = (await import('../../models/Card.js')).default;

    // Проверяем карту
    const card = await Card.findById(cardId);
    if (!card || !card.cardToken) {
      return res.status(400).json({ error: 'Карта не найдена или не имеет токена' });
    }

    // Проверяем, нет ли уже активного теста
    const existing = await RecurringTest.findOne({ cardId, isActive: true });
    if (existing) {
      return res.status(400).json({ error: 'Для этой карты уже запущен тест' });
    }

    // Создаём тест (первое списание через 1 минуту)
    const nextRun = new Date(Date.now() + 60 * 1000);
    
    await new RecurringTest({
      cardId,
      userId: card.userId,
      remaining: 5,
      isActive: true,
      nextRun
    }).save();

    res.json({ success: true });
  } catch (err) {
    console.error('Start test error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Остановить тест
router.post('/stop-test', adminAuth, async (req, res) => {
  try {
    const { cardId } = req.body;
    const RecurringTest = (await import('../../models/RecurringTest.js')).default;

    await RecurringTest.findOneAndUpdate(
      { cardId, isActive: true },
      { isActive: false }
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Stop test error:', err);
    res.status(500).json({ error: 'Ошибка' });
  }
});

export default router;