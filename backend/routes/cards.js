import express from 'express';// backend/routes/cards.js
import jwt from 'jsonwebtoken';
import Card from '../../models/Card.js';

const router = express.Router();

// Middleware для проверки токена
const auth = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Нет токена авторизации' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Неверный токен' });
  }
};

// ============================================
// ПОЛУЧИТЬ ВСЕ КАРТЫ ПОЛЬЗОВАТЕЛЯ
// ============================================
router.get('/', auth, async (req, res) => {
  try {
    const cards = await Card.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json(cards);
  } catch (err) {
    console.error('Get cards error:', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ============================================
// УДАЛИТЬ КАРТУ
// ============================================
router.delete('/:cardId', auth, async (req, res) => {
  try {
    const { cardId } = req.params;

    // Найди карту и убедись, что она принадлежит текущему пользователю
    const card = await Card.findOneAndDelete({ 
      _id: cardId, 
      userId: req.userId 
    });

    if (!card) {
      return res.status(404).json({ error: 'Карта не найдена или уже удалена' });
    }

    console.log(' Карта удалена:', cardId);

    res.json({ 
      success: true, 
      message: 'Карта успешно удалена' 
    });

  } catch (err) {
    console.error('Delete card error:', err.message);
    res.status(500).json({ 
      error: 'Ошибка удаления карты' 
    });
  }
});

// ============================================
// СДЕЛАТЬ КАРТУ ОСНОВНОЙ
// ============================================
router.post('/set-default', auth, async (req, res) => {
  try {
    const { cardId } = req.body;
    
    // Сбросить флаг isDefault у всех карт пользователя
    await Card.updateMany({ userId: req.userId }, { isDefault: false });
    
    // Установить флаг у выбранной карты
    const card = await Card.findOneAndUpdate(
      { _id: cardId, userId: req.userId },
      { isDefault: true },
      { new: true }
    );

    if (!card) {
      return res.status(404).json({ error: 'Карта не найдена' });
    }

    console.log(' Карта установлена как основная:', cardId);

    res.json(card);
  } catch (err) {
    console.error('Set default error:', err.message);
    res.status(500).json({ error: 'Ошибка установки основной карты' });
  }
});

export default router;