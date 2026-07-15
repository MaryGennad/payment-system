// api/payments/refund.js
import crypto from 'crypto'; 
import axios from 'axios';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import connectDB from '../../lib/db.js';
import Payment from '../../models/Payment.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  await connectDB();

  try {
    // 1. Проверка авторизации
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Нет токена' });

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    const { paymentId } = req.body; // Это paymentId из нашей БД (или yookassaPaymentId, зависит от того, что передаем)

    // 2. Находим платеж в БД и проверяем, что он принадлежит этому пользователю
    const payment = await Payment.findOne({ _id: paymentId, userId });
    
    if (!payment) {
      return res.status(404).json({ error: 'Платеж не найден' });
    }

    if (payment.status !== 'succeeded') {
      return res.status(400).json({ error: 'Вернуть можно только успешный платеж' });
    }

    // 3. Отправляем запрос на возврат в Robokassa
    const yookassaResponse = await axios.post(
      'https://api.yookassa.ru/v3/refunds',
      {
        payment_id: payment.paymentId, // ID платежа в Robokassa
        amount: {
          value: payment.amount.toFixed(2),
          currency: 'RUB'
        }
      },
      {
        auth: {
          username: process.env.YOOKASSA_SHOP_ID,
          password: process.env.YOOKASSA_SECRET_KEY
        },
        headers: {
          'Content-Type': 'application/json',
          'Idempotence-Key': crypto.randomUUID() // Уникальный ключ для идемпотентности
        }
      }
    );

    const refundData = yookassaResponse.data;

    // 4. Обновляем статус платежа в нашей БД
    payment.status = 'refunded';
    await payment.save();

    res.json({
      success: true,
      message: 'Возврат успешно инициирован',
      refundId: refundData.id
    });

  } catch (err) {
    console.error('Refund error:', err.response?.data || err.message);
    res.status(500).json({
      error: err.response?.data?.description || err.message || 'Ошибка оформления возврата'
    });
  }
}