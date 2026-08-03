import { YooKassa } from 'yookassa';
import connectDB from '../../lib/db.js';
import Payment from '../../models/Payment.js';

// Инициализация ЮKassa
const yooKassa = new YooKassa({
  shopId: process.env.YOOKASSA_SHOP_ID,
  secretKey: process.env.YOOKASSA_SECRET_KEY
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  await connectDB();

  try {
    const { amount, email, description, save_payment_method } = req.body;
    const authHeader = req.headers.authorization;
    
    if (!authHeader) return res.status(401).json({ error: 'Нет токена авторизации' });

    // Проверка JWT
    const token = authHeader.split(' ')[1];
    let userId;
    try {
      const decoded = require('jsonwebtoken').verify(token, process.env.JWT_SECRET);
      userId = decoded.id;
    } catch (err) {
      return res.status(401).json({ error: 'Неверный токен' });
    }

    const outSum = parseFloat(amount).toFixed(2);
    const idempotenceKey = Date.now().toString(); // Уникальный ключ для идемпотентности

    // 1. Создаем платеж через SDK ЮKassa
    const payment = await yooKassa.createPayment({
      amount: {
        value: outSum,
        currency: 'RUB'
      },
      confirmation: {
        type: 'redirect',
        // Куда вернуть пользователя после оплаты
        return_url: `${process.env.FRONTEND_URL || 'https://payment-system-coral.vercel.app'}/cards.html?status=success`
      },
      capture: true, // Сразу списывать деньги (не холдировать)
      save_payment_method: save_payment_method || false, // СОХРАНЕНИЕ КАРТЫ ДЛЯ РЕКУРРЕНТА!
      description: description || 'Оплата услуг',
      // Данные для чека (54-ФЗ) - обязательно для ИП/ООО
      receipt: {
        customer: {
          email: email
        },
        items: [
          {
            description: description || 'Услуга',
            quantity: '1.00',
            amount: {
              value: outSum,
              currency: 'RUB'
            },
            vat_code: 1 // НДС 20% (или 2 для "без НДС", уточните вашу систему)
          }
        ]
      }
    }, idempotenceKey);

    // 2. Сохраняем платеж в нашу БД
    const dbPayment = await Payment.create({
      userId,
      amount: outSum,
      provider: 'yookassa',
      status: payment.status, // обычно 'pending'
      yookassaPaymentId: payment.id, // Сохраняем ID платежа из ЮKassa
      email,
      description
    });

    // 3. Возвращаем ссылку на оплату фронтенду
    res.status(200).json({
      confirmation_url: payment.confirmation.confirmation_url,
      paymentId: dbPayment._id
    });

  } catch (err) {
    console.error('YooKassa create error:', err);
    res.status(500).json({ 
      error: err.message || 'Ошибка создания платежа' 
    });
  }
}