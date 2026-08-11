import { YooKassa } from 'yookassa';
import jwt from 'jsonwebtoken'; 
import connectDB from '../../lib/db.js';
import Payment from '../../models/Payment.js';

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
    // Безопасное получение body
    let body;
    if (typeof req.body === 'object' && req.body !== null) {
      body = req.body;
    } else {
      body = await req.json();
    }
    
    const { amount, email, description, save_payment_method } = body;
    const authHeader = req.headers.authorization;
    
    let userId = null;

    // Проверяем токен ТОЛЬКО если он передан
    if (authHeader) {
      try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET); 
        userId = decoded.id;
      } catch (err) {
        console.warn('️ Неверный токен, продолжаем обработку как гость');
      }
    }

    // ЗАЩИТА: Сохранять карту можно только авторизованным
    if (!userId && save_payment_method) {
      return res.status(403).json({ error: 'Для сохранения карты необходима авторизация' });
    }

    const outSum = parseFloat(amount).toFixed(2);
    const idempotenceKey = Date.now().toString();

    // 1. Создаем платеж в ЮKassa
    const payment = await yooKassa.createPayment({
      amount: { value: outSum, currency: 'RUB' },
      confirmation: {
        type: 'redirect',
        return_url: `${process.env.FRONTEND_URL || 'https://payment-system-coral.vercel.app'}/index.html?status=success`
      },
      capture: true,
      save_payment_method: save_payment_method || false,
      description: description || 'Оплата услуг',
      receipt: {
        customer: { email: email },
        items: [{
          description: description || 'Услуга',
          quantity: '1.00',
          amount: { value: outSum, currency: 'RUB' },
          vat_code: 2 // Без НДС для самозанятых
        }]
      }
    }, idempotenceKey);

    // 2. Сохраняем в БД
    const dbPayment = await Payment.create({
      userId,
      amount: outSum,
      provider: 'yookassa',
      status: payment.status,
      yookassaPaymentId: payment.id,
      email,
      description
    });

    // 3. Возвращаем ссылку
    res.status(200).json({
      confirmation_url: payment.confirmation.confirmation_url,
      paymentId: dbPayment._id
    });

  } catch (err) {
    console.error(' CREATE PAYMENT ERROR:', err.message);
    console.error('Stack:', err.stack);
    res.status(500).json({ 
      error: 'Ошибка создания платежа',
      details: err.message
    });
  }
}