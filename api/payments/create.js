import axios from 'axios';
import connectDB from '../../lib/db.js';
import Payment from '../../models/Payment.js';
import Card from '../../models/Card.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  await connectDB();

  try {
    const { provider, amount, email, description, save_payment_method } = req.body;
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ error: 'Нет токена авторизации' });
    }

    const token = authHeader.split(' ')[1];
    let userId;
    try {
      const decoded = require('jsonwebtoken').verify(token, process.env.JWT_SECRET);
      userId = decoded.id;
    } catch (err) {
      return res.status(401).json({ error: 'Неверный токен' });
    }

    // Создание платежа в ЮKassa
    const yookassaResponse = await axios.post(
      'https://api.yookassa.ru/v3/payments',
      {
        amount: {
          value: amount.toFixed(2),
          currency: 'RUB'
        },
        confirmation: {
          type: 'redirect',
          return_url: process.env.YOOKASSA_RETURN_URL || 'https://payment-system-coral.vercel.app/cards.html?status=success'
        },
        capture: true,
        description: description || 'Привязка карты',
        save_payment_method: save_payment_method || false,
        payment_method_data: {
          type: 'bank_card'
        },
        recipient: {
          account_id: process.env.YOOKASSA_SHOP_ID,
          gateway_id: process.env.YOOKASSA_GATEWAY_ID
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

    // Сохранение платежа в БД
    const payment = await Payment.create({
      userId,
      amount,
      provider,
      status: paymentData.status,
      yookassaPaymentId: paymentData.id,
      email
    });

    // Если нужно сохранить карту
    if (save_payment_method && paymentData.payment_method) {
      await Card.create({
        userId,
        last4: paymentData.payment_method.card.last4,
        cardType: paymentData.payment_method.card.card_type,
        expiryMonth: paymentData.payment_method.card.expiry_month,
        expiryYear: paymentData.payment_method.card.expiry_year,
        isDefault: false
      });
    }

    res.status(200).json({
      confirmation_url: paymentData.confirmation.confirmation_url,
      paymentId: payment._id
    });

  } catch (err) {
    console.error('Payment creation error:', err);
    res.status(500).json({ 
      error: err.response?.data?.error_description || 'Ошибка создания платежа' 
    });
  }
}
