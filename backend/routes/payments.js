// backend/routes/payments.js
import express from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import Payment from '../../models/Payment.js';
import Card from '../../models/Card.js';
import User from '../../models/User.js';

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
// СОЗДАТЬ ПЛАТЕЖ (гостевая оплата разрешена)
// ============================================
router.post('/create', async (req, res) => {
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

    // 3. Создание платежа в ЮKassa
    const yookassaResponse = await axios.post(
      'https://api.yookassa.ru/v3/payments',
      {
        amount: {
          value: parseFloat(amount).toFixed(2),
          currency: 'RUB'
        },
        confirmation: {
          type: 'redirect',
          // Умный return_url: если save_payment_method=true → cards.html, иначе → index.html
          return_url: save_payment_method 
            ? `${process.env.FRONTEND_URL || 'https://payment-system-coral.vercel.app'}/cards.html?status=success`
            : `${process.env.FRONTEND_URL || 'https://payment-system-coral.vercel.app'}/index.html?status=success`,
        },
        capture: true,
        description: description || 'Оплата услуг',
        save_payment_method: save_payment_method || false,
        payment_method_data: {
          type: 'bank_card'
        },
        // ЧЕК 54-ФЗ (Без НДС для самозанятых)
        receipt: {
          customer: { email: email },
          items: [{
            description: description || 'Услуга',
            quantity: '1.00',
            amount: { value: parseFloat(amount).toFixed(2), currency: 'RUB' },
            vat_code: 2 // Без НДС
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

    // 4. Сохранение платежа в БД
    const payment = new Payment({
      userId, // Будет null для гостей
      amount,
      provider: provider || 'yookassa',
      status: paymentData.status,
      paymentId: paymentData.id,
      email,
      description,
      // Информация о рекуррентности
  recurringInfo: {
    isRecurring: save_payment_method || false,
    totalStages: save_payment_method ? 3 : 1, // Для комплексной настройки — 3 этапа
    currentStage: 1
  },
  parentPaymentId: null // Первый платеж — родительский
});
    
    await payment.save();

    // 5. Возвращаем ссылку на оплату
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
// WEBHOOK ОТ ЮKASSA (сохранение карты после успешной оплаты)
// ============================================
router.post('/webhook', async (req, res) => {
  try {
    const event = req.body;
    console.log('🔔 Webhook received:', event.event);

    // Обрабатываем успешную оплату
    if (event.event === 'payment.succeeded') {
      const paymentData = event.object;
      const yookassaPaymentId = paymentData.id;

      // 1. Обновляем статус платежа в БД
      const payment = await Payment.findOneAndUpdate(
        { paymentId: yookassaPaymentId },
        { status: 'succeeded' },
        { new: true }
      );

      // 2. СОХРАНЯЕМ КАРТУ (только если пользователь авторизован и карта была сохранена)
      if (payment && payment.userId && paymentData.payment_method?.saved) {
        const cardData = paymentData.payment_method.card;
        const paymentMethodId = paymentData.payment_method.id; // ID метода платежа для рекуррента
        
        if (cardData) {
          // Проверяем, не сохранена ли уже такая карта
          const existingCard = await Card.findOne({
            userId: payment.userId,
            last4: cardData.last4
          });

          if (!existingCard) {
            const card = new Card({
              userId: payment.userId,
              provider: payment.provider || 'yookassa',
              cardToken: paymentMethodId, // ВАЖНО: сохраняем payment_method.id, а не payment.id!
              last4: cardData.last4,
              cardType: cardData.card_type,
              expiryMonth: cardData.expiry_month,
              expiryYear: cardData.expiry_year,
              isDefault: true // Первая карта — основная
            });
            await card.save();
            console.log('✅ Карта сохранена после успешной оплаты:', card._id);
          }
        }

        // 3. Сохраняем payment_method_id в User для будущих рекуррентных платежей
        await User.findByIdAndUpdate(payment.userId, {
          yookassaPaymentMethodId: paymentMethodId
        });
        console.log('💳 Токен карты сохранен для пользователя:', payment.userId);
      }
    }

    // Обрабатываем отмену платежа
    if (event.event === 'payment.canceled') {
      const paymentData = event.object;
      await Payment.findOneAndUpdate(
        { paymentId: paymentData.id },
        { status: 'canceled' }
      );
    }

    // ЮKassa всегда ожидает ответ 200
    res.status(200).json({ status: 'ok' });

  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// ============================================
// СПИСАНИЕ С СОХРАНЁННОЙ КАРТЫ (РЕКУРРЕНТНЫЙ ПЛАТЁЖ)
// ============================================
router.post('/charge-saved', auth, async (req, res) => {
  try {
    const { amount, email, description, cardId, stageNumber, totalStages } = req.body;

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

    // Создание рекуррентного платежа
    const yookassaResponse = await axios.post(
      'https://api.yookassa.ru/v3/payments',
      {
        amount: {
          value: parseFloat(amount).toFixed(2),
          currency: 'RUB'
        },
        capture: true,
        description: description || `Рекуррентный платеж (этап ${stageNumber || 1} из ${totalStages || 3})`,
        payment_method_id: card.cardToken,
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

    // Найди первый (родительский) платеж для этой карты
    const firstPayment = await Payment.findOne({
      userId: req.userId,
      'recurringInfo.isRecurring': true
    }).sort({ createdAt: 1 });

    // Сохранение платежа в БД
    const payment = new Payment({
      userId: req.userId,
      amount,
      provider: card.provider,
      status: paymentData.status,
      paymentId: paymentData.id,
      email,
      description: description || `Рекуррентный платеж (этап ${stageNumber || 1} из ${totalStages || 3})`,
      recurringInfo: {
        isRecurring: true,
        totalStages: totalStages || 3,
        currentStage: stageNumber || 1
      },
      parentPaymentId: firstPayment ? firstPayment._id : null
    });

    await payment.save();

    res.json({
      success: true,
      paymentId: payment._id,
      status: paymentData.status,
      amount: paymentData.amount.value,
      stage: stageNumber || 1,
      totalStages: totalStages || 3
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