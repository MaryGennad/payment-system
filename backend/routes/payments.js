// backend/routes/payments.js
import express from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import Payment from '../../models/Payment.js';
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
// ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ: Проверка дубликата карты
// ============================================
async function findExistingCard(userId, last4, expiryMonth, expiryYear) {
  return await Card.findOne({
    userId: userId,
    last4: last4,
    expiryMonth: expiryMonth,
    expiryYear: expiryYear
  });
}

/// ============================================
// СОЗДАТЬ ПЛАТЕЖ (в файле backend/routes/payments.js)
// ============================================
router.post('/create', async (req, res) => {  // 🔥 УБРАЛИ 'auth' отсюда!
  try {
    const { provider, amount, email, description, save_payment_method } = req.body;
    
    // 1. Проверяем токен, если он есть (гостевая оплата разрешена)
    let userId = null;
    const authHeader = req.headers.authorization;
    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.id;
      } catch (err) {
        console.warn('⚠️ Неверный токен, продолжаем как гость');
      }
    }

    // 2. ЗАЩИТА: гость не может сохранить карту для рекуррента
    if (!userId && save_payment_method) {
      return res.status(403).json({ error: 'Для сохранения карты необходима авторизация' });
    }

    // Создание платежа в ЮKassa
    const yookassaResponse = await axios.post(
      'https://api.yookassa.ru/v3/payments',
      {
        amount: {
          value: parseFloat(amount).toFixed(2),
          currency: 'RUB'
        },
        confirmation: {
          type: 'redirect',
          return_url: process.env.YOOKASSA_RETURN_URL || 'https://payment-system-coral.vercel.app/index.html?status=success'
        },
        capture: true,
        description: description || 'Оплата услуг',
        save_payment_method: save_payment_method || false,
        payment_method_data: {
          type: 'bank_card'
        },
        // 🧾 ЧЕК 54-ФЗ (Без НДС для самозанятых)
        receipt: {
          customer: { email: email },
          items: [{
            description: description || 'Услуга',
            quantity: '1.00',
            amount: { value: parseFloat(amount).toFixed(2), currency: 'RUB' },
            vat_code: 2 // 🔥 Без НДС
          }]
        }
      },
      {
        auth: {
          username: process.env.YOOKASSA_SHOP_ID,
          password: process.env.YOOKASSA_SECRET_KEY
        },
        headers: {
          'Content-Type': 'application/json',
          'Idempotence-Key': Date.now().toString()
        }
      }
    );

    const paymentData = yookassaResponse.data;
    console.log('YooKassa response:', paymentData);
    console.log('Payment ID:', paymentData.id);

    // Сохранение платежа в БД (используем paymentId, как в модели!)
    const payment = new Payment({
      userId, // Будет null для гостей
      amount,
      provider,
      status: paymentData.status,
      paymentId: paymentData.id, // 🔥 paymentId (как в модели!)
      email,
      description
    });

    await payment.save();

    // Логика сохранения карты (если нужно)
    if (save_payment_method && paymentData.payment_method?.card) {
      const cardData = paymentData.payment_method.card;
      const existingCard = await Card.findOne({
        userId: userId,
        last4: cardData.last4,
        expiryMonth: cardData.expiry_month,
        expiryYear: cardData.expiry_year
      });

      if (!existingCard) {
        const card = new Card({
          userId: userId,
          provider: provider || 'yookassa',
          cardToken: paymentData.id,
          last4: cardData.last4,
          cardType: cardData.card_type,
          expiryMonth: cardData.expiry_month,
          expiryYear: cardData.expiry_year,
          isDefault: false
        });
        await card.save();
      }
    }

    if (!paymentData.confirmation || !paymentData.confirmation.confirmation_url) {
      return res.status(500).json({ error: 'No confirmation URL' });
    }

    res.json({
      confirmation_url: paymentData.confirmation.confirmation_url,
      paymentId: payment._id
    });

  } catch (err) {
    console.error('Create payment error:', err.message);
    res.status(500).json({
      error: err.response?.data?.error_description || 'Ошибка создания платежа'
    });
  }
});

// ============================================
// WEBHOOK ОТ ЮKassa
// ============================================
router.post('/webhook', async (req, res) => {
  try {
    const event = req.body;
    console.log('Webhook received:', event.event);

    if (event.event === 'payment.succeeded') {
      const paymentData = event.object;

      // Найди платеж в БД
      const payment = await Payment.findOne({ paymentId: paymentData.id });

      if (payment && paymentData.payment_method?.card) {
        const cardData = paymentData.payment_method.card;
        
        // ПРОВЕРКА: Ищем существующую карту
        const existingCard = await findExistingCard(
          payment.userId,
          cardData.last4,
          cardData.expiry_month,
          cardData.expiry_year
        );

        if (existingCard) {
          console.log(' Карта уже существует (webhook):', existingCard._id);
        } else {
          // Сохрани карту только если её нет
          const card = new Card({
            userId: payment.userId,
            provider: payment.provider,
            cardToken: paymentData.id,
            last4: cardData.last4,
            cardType: cardData.card_type,
            expiryMonth: cardData.expiry_month,
            expiryYear: cardData.expiry_year,
            isDefault: false
          });

          await card.save();
          console.log(' Новая карта сохранена через webhook:', card);
        }

        // Обнови статус платежа
        await Payment.updateOne(
          { paymentId: paymentData.id },
          { status: paymentData.status }
        );
      }
    }

    res.json({ status: 'ok' });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: 'Webhook error' });
  }
});

// ============================================
// СПИСАНИЕ С СОХРАНЁННОЙ КАРТЫ (РЕКУРРЕНТНЫЙ ПЛАТЁЖ)
// ============================================
router.post('/charge-saved', auth, async (req, res) => {
  try {
    const { amount, email, description, cardId } = req.body;

    // Найди сохранённую карту
    const card = await Card.findOne({ 
      _id: cardId, 
      userId: req.userId 
    });

    if (!card) {
      return res.status(404).json({ error: 'Карта не найдена' });
    }

    if (!card.cardToken) {
      return res.status(400).json({ error: 'Карта не привязана для повторных списаний' });
    }

    // Создание рекуррентного платежа (БЕЗ confirmation!)
    const yookassaResponse = await axios.post(
      'https://api.yookassa.ru/v3/payments',
      {
        amount: {
          value: amount.toFixed(2),
          currency: 'RUB'
        },
        capture: true,
        description: description || 'Регулярный платёж',
        payment_method_id: card.cardToken,  // ID сохранённого метода оплаты
        save_payment_method: true
      },
      {
        auth: {
          username: process.env.YOOKASSA_SHOP_ID,
          password: process.env.YOOKASSA_SECRET_KEY
        },
        headers: {
          'Content-Type': 'application/json',
          'Idempotence-Key': Date.now().toString()
        }
      }
    );

    const paymentData = yookassaResponse.data;
    console.log('Recurrent payment response:', paymentData);

    // Сохранение платежа в БД
    const payment = new Payment({
      userId: req.userId,
      amount,
      provider: card.provider,
      status: paymentData.status,
      paymentId: paymentData.id,
      email
    });

    await payment.save();

    res.json({
      success: true,
      paymentId: payment._id,
      status: paymentData.status,
      amount: paymentData.amount.value
    });

  } catch (err) {
    console.error('Charge saved card error:', err.message);
    console.error('YooKassa error details:', err.response?.data);
    res.status(500).json({
      error: err.response?.data?.description || err.response?.data?.error_description || 'Ошибка списания'
    });
  }
});

// ============================================
// ПОЛУЧИТЬ ИСТОРИЮ ПЛАТЕЖЕЙ ПОЛЬЗОВАТЕЛЯ
// ============================================
router.get('/history', auth, async (req, res) => {
  try {
    const payments = await Payment.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(10);
    
    res.json(payments);
  } catch (err) {
    console.error('Get history error:', err);
    res.status(500).json({ error: 'Ошибка получения истории' });
  }
});

export default router;