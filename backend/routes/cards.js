// routes/cards.js
const express = require('express');
const router = express.Router();
const Card = require('../models/Card');
const Payment = require('../models/Payment');
const axios = require('axios');

// GET /api/cards?userId=xxx — список карт пользователя
router.get('/', async (req, res) => {
  try {
    // Стало:
    const userId = req.userId; // из токена
    if (!userId) return res.status(400).json({ error: 'Требуется userId' });
    
    const cards = await Card.find({ userId }).sort({ isDefault: -1, createdAt: -1 });
    res.json(cards);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/cards/set-default — сделать карту основной
router.post('/set-default', async (req, res) => {
  try {
    const { cardId } = req.body;
    const userId = req.userId;
    if (!userId || !cardId) return res.status(400).json({ error: 'userId и cardId обязательны' });

    // Транзакция: сначала сбросить все, потом установить одну
    await Card.updateMany({ userId }, { isDefault: false });
    await Card.findByIdAndUpdate(cardId, { isDefault: true });
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/cards/:id — удалить карту
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId; // из токена
    
    // Проверяем, что карта принадлежит пользователю
    const card = await Card.findOne({ _id: id, userId });
    if (!card) return res.status(404).json({ error: 'Карта не найдена' });

    // Если ЮKassa — удаляем токен на их стороне (опционально)
    if (card.provider === 'yookassa' && process.env.YOOKASSA_SECRET_KEY) {
      try {
        await axios.delete(`https://api.yookassa.ru/v3/payment_methods/${card.cardToken}`, {
          auth: {
            username: process.env.YOOKASSA_SHOP_ID,
            password: process.env.YOOKASSA_SECRET_KEY
          }
        });
      } catch (e) {
        console.warn('⚠️ Не удалось удалить токен в ЮKassa:', e.message);
      }
    }

    // Удаляем из нашей БД
    await Card.findByIdAndDelete(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;