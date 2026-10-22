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
        console.warn('Неверный токен, продолжаем как гость');
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
          return_url: save_payment_method 
            ? `${process.env.FRONTEND_URL || 'https://hotel-prod.ru'}/cards.html?status=success`
            : `${process.env.FRONTEND_URL || 'https://hotel-prod.ru'}/index.html?status=success`,
        },
        capture: false,  // Деньги только блокируются, не списываются
        description: description || 'Оплата услуг',
        payment_method_data: {
          type: 'bank_card'
        },
        // Только если передан save_payment_method — добавляем его
        ...(save_payment_method && { save_payment_method: true }),
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
      userId, 
      amount,
      provider: provider || 'yookassa',
      status: paymentData.status,
      paymentId: paymentData.id,
      email,
      description, // Описание придет с фронта (например, "Комплексная настройка 1С Отель (этап 1 из 3)")
      recurringInfo: {
        isRecurring: save_payment_method || false,
        totalStages: save_payment_method ? 3 : 1, 
        currentStage: 1
      },
      parentPaymentId: null 
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
    console.log('Webhook received:', event.event);

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
        const paymentMethodId = paymentData.payment_method.id; 
        
        if (cardData) {
          const existingCard = await Card.findOne({
            userId: payment.userId,
            last4: cardData.last4
          });

          if (!existingCard) {
            const card = new Card({
              userId: payment.userId,
              provider: payment.provider || 'yookassa',
              cardToken: paymentMethodId, 
              last4: cardData.last4,
              cardType: cardData.card_type,
              expiryMonth: cardData.expiry_month,
              expiryYear: cardData.expiry_year,
              isDefault: true 
            });
            await card.save();
            console.log('Карта сохранена после успешной оплаты:', card._id);
          }
        }

        // 3. Сохраняем payment_method_id в User для будущих рекуррентных платежей
        await User.findByIdAndUpdate(payment.userId, {
          yookassaPaymentMethodId: paymentMethodId
        });
        console.log('Токен карты сохранен для пользователя:', payment.userId);
      }
    }

    // СПОСОБ ОПЛАТЫ СОХРАНЁН (ГЛАВНОЕ СОБЫТИЕ ДЛЯ РЕКУРРЕНТА!)
    if (event.event === 'payment_method.active') {
      const paymentMethod = event.object;
      const paymentMethodId = paymentMethod.id;
      
      console.log('=== СПОСОБ ОПЛАТЫ СОХРАНЁН ===');
      console.log('Payment Method ID:', paymentMethodId);

      // Находим платёж, к которому привязан этот способ
      const payment = await Payment.findOne({
        paymentId: paymentMethod.payment_id?.id
      }).sort({ createdAt: -1 });

      if (payment && payment.userId) {
        const cardData = paymentMethod.card;
        
        if (cardData) {
          const existingCard = await Card.findOne({
            userId: payment.userId,
            last4: cardData.last4
          });

          if (!existingCard) {
            const card = new Card({
              userId: payment.userId,
              provider: 'yookassa',
              cardToken: paymentMethodId,
              last4: cardData.last4,
              cardType: cardData.card_type,
              expiryMonth: cardData.expiry_month,
              expiryYear: cardData.expiry_year,
              isDefault: true
            });
            await card.save();
            console.log('Карта сохранена:', card._id);
          }

          await User.findByIdAndUpdate(payment.userId, {
            yookassaPaymentMethodId: paymentMethodId
          });
          console.log('Токен карты сохранён для пользователя:', payment.userId);

          // ОТМЕНЯЕМ ПЛАТЁЖ (деньги вернутся)
          try {
            await axios.post(
              `https://api.yookassa.ru/v3/payments/${payment.paymentId}/cancel`,
              {},
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
            console.log('Платёж отменён, деньги возвращены');
            await Payment.findByIdAndUpdate(payment._id, { status: 'canceled' });
          } catch (cancelErr) {
            console.error('Ошибка отмены:', cancelErr.response?.data);
          }
        }
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

// СПИСАНИЕ С СОХРАНЁННОЙ КАРТЫ (РЕКУРРЕНТНЫЙ ПЛАТЁЖ)
router.post('/charge-saved', auth, async (req, res) => {
  try {
    const { amount, email, cardId, stageNumber, totalStages } = req.body;

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

    // Формируем корректное описание для ЮKassa и БД
    const currentStage = stageNumber || 1;
    const maxStages = totalStages || 3;
    const paymentDescription = `Комплексная настройка 1С Отель (этап ${currentStage} из ${maxStages})`;

    // Создание рекуррентного платежа
    const yookassaResponse = await axios.post(
      'https://api.yookassa.ru/v3/payments',
      {
        amount: {
          value: parseFloat(amount).toFixed(2),
          currency: 'RUB'
        },
        capture: true,
        description: paymentDescription, // Используем сформированное описание
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

    // Найди первый (родительский) платеж для этой карты, чтобы связать их
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
      description: paymentDescription, // Сохраняем правильное описание в БД
      recurringInfo: {
        isRecurring: true,
        totalStages: maxStages,
        currentStage: currentStage
      },
      parentPaymentId: firstPayment ? firstPayment._id : null
    });

    await payment.save();

    res.json({
      success: true,
      paymentId: payment._id,
      status: paymentData.status,
      amount: paymentData.amount.value,
      stage: currentStage,
      totalStages: maxStages
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
// ОФОРМИТЬ ВОЗВРАТ
// ============================================
router.post('/refund', auth, async (req, res) => {
  try {
    const { paymentId } = req.body;

    // Найди платеж в БД
    const payment = await Payment.findOne({
      _id: paymentId,
      userId: req.userId
    });

    if (!payment) {
      return res.status(404).json({ error: 'Платеж не найден' });
    }

    if (payment.status !== 'succeeded') {
      return res.status(400).json({ error: 'Возврат возможен только для успешных платежей' });
    }

    // Создаем возврат в ЮKassa
    const refundResponse = await axios.post(
      'https://api.yookassa.ru/v3/refunds',
      {
        payment_id: payment.paymentId, // ID платежа в ЮKassa
        amount: {
          value: payment.amount.toFixed(2),
          currency: 'RUB'
        },
        description: `Возврат по платежу: ${payment.description}`
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

    const refundData = refundResponse.data;
    console.log('Refund created:', refundData);

    // Обновляем статус платежа в БД
    await Payment.findByIdAndUpdate(paymentId, {
      status: 'refunded'
    });

    res.json({
      success: true,
      refundId: refundData.id,
      status: refundData.status
    });

  } catch (err) {
    console.error('Refund error:', err.message);
    console.error('YooKassa error:', err.response?.data);
    res.status(500).json({
      error: err.response?.data?.description || err.response?.data?.error_description || 'Ошибка оформления возврата'
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

// ============================================
// СОХРАНЕНИЕ КАРТЫ (привязка через тестовый платеж 1 ₽)
// ============================================
router.post('/save-card', auth, async (req, res) => {
  try {
    const { email, amount = 1, description = 'Привязка карты для будущих платежей' } = req.body;

    console.log('=== СОЗДАНИЕ ПЛАТЕЖА ДЛЯ ПРИВЯЗКИ КАРТЫ ===');
    console.log('Shop ID:', process.env.YOOKASSA_SHOP_ID);
    console.log('Email:', email);
    console.log('Amount:', amount);

    const yookassaResponse = await axios.post(
      'https://api.yookassa.ru/v3/payments',
      {
        amount: {
          value: parseFloat(amount).toFixed(2),
          currency: 'RUB'
        },
        confirmation: {
          type: 'redirect',
          return_url: `${process.env.FRONTEND_URL || 'https://hotel-prod.ru'}/cards.html?status=card-saved`
        },
        capture: false, // ИЗМЕНЕНО: было true, стало false, чтобы деньги только блокировались и затем отменялись
        save_payment_method: true,
        description: description,
        payment_method_data: {
          type: 'bank_card'
        },
        receipt: {
          customer: { email: email },
          items: [{
            description: description,
            quantity: '1.00',
            amount: { value: parseFloat(amount).toFixed(2), currency: 'RUB' },
            vat_code: 2
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
          'Idempotence-Key': Date.now().toString(),
          'Accept': 'application/json'
        }
      }
    );

    const paymentData = yookassaResponse.data;
    console.log('YooKassa ответ:', paymentData);

    const payment = new Payment({
      userId: req.userId,
      paymentId: paymentData.id,
      provider: 'yookassa',
      amount: parseFloat(amount),
      currency: 'RUB',
      status: paymentData.status,
      email: email,
      description: description,
      recurringInfo: {
        isRecurring: true,
        totalStages: 1,
        currentStage: 1
      }
    });

    await payment.save();

    res.json({
      success: true,
      confirmation_url: paymentData.confirmation.confirmation_url
    });

  } catch (err) {
    console.error('=== ОШИБКА ПРИ СОЗДАНИИ ПЛАТЕЖА ===');
    console.error('Status:', err.response?.status);
    console.error('Data:', err.response?.data);
    console.error('Message:', err.message);
    
    res.status(500).json({ 
      error: err.response?.data?.description || 'Ошибка привязки карты' 
    });
  }
});

// ============================================
// ПРОВЕРКА МАРКИ (Честный ЗНАК) — 1 ₽, лимит 5/день
// ============================================

// Тестовая база марок (в реальности здесь будет запрос к API Честного ЗНАКа)
const MOCK_MARKS = {
  'MX-100000000001': { productName: 'Вода минеральная 0.5л', manufacturer: 'ООО "Аква"', status: 'Легальный оборот' },
  'MX-100000000002': { productName: 'Молоко 3.2% 1л', manufacturer: 'ОАО "Молоко"', status: 'Легальный оборот' },
  'MX-100000000003': { productName: 'Хлеб белый нарезной', manufacturer: 'ИП Пекарев', status: 'Легальный оборот' },
  'MX-100000000004': { productName: 'Сигареты Marlboro', manufacturer: 'Филип Моррис', status: 'Легальный оборот' },
  'MX-100000000005': { productName: 'Духи Chanel №5', manufacturer: 'Chanel', status: 'Легальный оборот' },
};

const DAILY_LIMIT = 5;

// GET — получить лимит и историю
router.get('/marks/check', auth, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayChecks = await Payment.countDocuments({
      userId: req.userId,
      description: 'Проверка марки',
      createdAt: { $gte: today },
      status: 'succeeded'
    });

    const history = await Payment.find({
      userId: req.userId,
      description: 'Проверка марки'
    }).sort({ createdAt: -1 }).limit(20);

    res.json({
      remaining: Math.max(0, DAILY_LIMIT - todayChecks),
      limit: DAILY_LIMIT,
      used: todayChecks,
      history: history.map(p => ({
        code: p.metadata?.markCode || '—',
        productName: p.metadata?.productName,
        status: p.status,
        createdAt: p.createdAt
      }))
    });
  } catch (err) {
    console.error('Get marks error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST — проверить марку и списать 1 ₽
router.post('/marks/check', auth, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Не указан код марки' });

    // Проверяем лимит
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayChecks = await Payment.countDocuments({
      userId: req.userId,
      description: 'Проверка марки',
      createdAt: { $gte: today },
      status: 'succeeded'
    });

    if (todayChecks >= DAILY_LIMIT) {
      return res.status(403).json({
        error: `Лимит проверок на сегодня исчерпан (${DAILY_LIMIT}/${DAILY_LIMIT})`,
        remaining: 0,
        limit: DAILY_LIMIT
      });
    }

    // Проверяем привязанную карту
    const Card = (await import('../../models/Card.js')).default;
    const card = await Card.findOne({ userId: req.userId });
    if (!card || !card.cardToken) {
      return res.status(400).json({ error: 'Нет привязанной карты. Добавьте карту в разделе "Мои карты".' });
    }

    // Ищем марку в тестовой базе
    const markData = MOCK_MARKS[code];
    if (!markData) {
      return res.status(404).json({
        error: 'Марка не найдена в базе. Попробуйте: MX-100000000001',
        remaining: DAILY_LIMIT - todayChecks,
        limit: DAILY_LIMIT
      });
    }

    // Списываем 1 ₽ через ЮKassa
    const yookassaResponse = await axios.post(
      'https://api.yookassa.ru/v3/payments',
      {
        amount: { value: '1.00', currency: 'RUB' },
        capture: true,
        description: 'Проверка марки',
        payment_method_id: card.cardToken
      },
      {
        auth: {
          username: process.env.YOOKASSA_SHOP_ID,
          password: process.env.YOOKASSA_SECRET_KEY
        },
        headers: {
          'Content-Type': 'application/json',
          'Idempotence-Key': `mark-${req.userId}-${Date.now()}`
        }
      }
    );

    const paymentData = yookassaResponse.data;

    // Сохраняем платёж с метаданными марки
    await new Payment({
      userId: req.userId,
      paymentId: paymentData.id,
      provider: 'yookassa',
      amount: 1,
      status: paymentData.status,
      description: 'Проверка марки',
      metadata: {
        markCode: code,
        productName: markData.productName,
        manufacturer: markData.manufacturer
      }
    }).save();

    const remaining = DAILY_LIMIT - (todayChecks + 1);

    res.json({
      success: true,
      code,
      productName: markData.productName,
      manufacturer: markData.manufacturer,
      status: markData.status,
      remaining,
      limit: DAILY_LIMIT
    });

  } catch (err) {
    console.error('Check mark error:', err.response?.data || err.message);
    res.status(500).json({
      error: err.response?.data?.description || 'Ошибка проверки марки'
    });
  }
});

export default router;