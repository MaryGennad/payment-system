// backend/routes/payments.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');
const Card = require('../models/Card');
const Payment = require('../models/Payment');

// POST /api/payments/create
router.post('/create', async (req, res) => {
  try {
    const { provider, amount, email, description, save_payment_method = true } = req.body;
    const userId = req.userId; // из токена
    
    if (!userId || !provider || !amount) {
      return res.status(400).json({ error: 'userId, provider и amount обязательны' });
    }

    let paymentData;

    if (provider === 'yookassa') {
      // ===== YooKassa =====
      const response = await axios.post(
        'https://api.yookassa.ru/v3/payments',
        {
          amount: { value: amount.toFixed(2), currency: 'RUB' },
          confirmation: { 
            type: 'redirect', 
            return_url: process.env.YOOKASSA_RETURN_URL || 'http://localhost:8080/cards' 
          },
          save_payment_method,
          capture: true,
          description: description || 'Привязка карты',
          metadata: { user_id: userId, email }
        },
        {
          auth: {
            username: process.env.YOOKASSA_SHOP_ID,
            password: process.env.YOOKASSA_SECRET_KEY
          },
          headers: {
            'Content-Type': 'application/json',
            'Idempotence-Key': crypto.randomUUID()
          }
        }
      );

      // Сохраняем платёж в БД
      await Payment.create({
        userId,
        provider: 'yookassa',
        paymentId: response.data.id,
        amount,
        status: 'pending',
        metadata: { email }
      });

      paymentData = {
        payment_id: response.data.id,
        confirmation_url: response.data.confirmation?.confirmation_url,
        provider: 'yookassa'
      };

    } else {
      return res.status(400).json({ error: 'Провайдер не поддерживается' });
    }

    res.json(paymentData);
  } catch (err) {
    console.error('Payment create error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to create payment' });
  }
});

// POST /api/payments/webhook/yookassa
router.post('/webhook/yookassa', async (req, res) => {
  try {
    const { event, object } = req.body;
    
    if (event === 'payment.succeeded') {
      // Обновляем статус платежа
      await Payment.findOneAndUpdate(
        { paymentId: object.id },
        { status: 'succeeded' }
      );

      // Если карта сохранена — добавляем в БД
      if (object.payment_method?.saved) {
        const pm = object.payment_method;
        await Card.create({
          userId: object.metadata?.user_id,
          provider: 'yookassa',
          cardToken: pm.id,
          last4: pm.card?.last4,
          cardType: pm.type,
          expiryMonth: pm.card?.expiry_month,
          expiryYear: pm.card?.expiry_year,
          isDefault: false
        });
      }
    }
    res.json({ status: 'ok' });
  } catch (err) {
    console.error('YooKassa webhook error:', err);
    res.status(500).json({ error: 'Webhook error' });
  }
});

module.exports = router;