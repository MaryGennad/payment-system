// backend/routes/cards.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Card = require('../../models/Card');

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

// Получить все карты пользователя
router.get('/', auth, async (req, res) => {
  try {
    const cards = await Card.find({ userId: req.userId });
    res.json(cards);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Ошибка сервера');
  }
});

// Удалить карту
router.delete('/:id', auth, async (req, res) => {
  try {
    const card = await Card.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!card) {
      return res.status(404).json({ error: 'Карта не найдена' });
    }
    res.json({ message: 'Карта удалена' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Ошибка сервера');
  }
});

// Сделать карту основной
router.post('/set-default', auth, async (req, res) => {
  try {
    const { cardId } = req.body;
    
    // Сбросить флаг isDefault у всех карт
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

    res.json(card);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Ошибка сервера');
  }
});

module.exports = router;