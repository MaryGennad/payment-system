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
    //   Безопасное получение body (защита от ошибок Vercel Functions)
    const body = req.body || (await req.json());
    const { amount, email, description, save_payment_method } = body;
    const authHeader = req.headers.authorization;
    
    let userId = null;

    //  Проверяем токен ТОЛЬКО если он передан (разрешаем гостевую оплату)
    if (authHeader) {
      try {
        const token = authHeader.split(' ')[1];
        const decoded = require('jsonwebtoken').verify(token, process.env.JWT_SECRET);
        userId = decoded.id;
      } catch (err) {
        console.warn('⚠️ Неверный токен, продолжаем обработку как гость');
        // Не выбрасываем ошибку, просто оставляем userId = null
      }
    }

    //ЗАЩИТА: Если пользователь не авторизован, но пытается сохранить карту — блокируем
    if (!userId && save_payment_method) {
      return res.status(403).json({ error: 'Для сохранения карты и рекуррентных платежей необходима авторизация' });
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
        return_url: `${process.env.FRONTEND_URL || 'https://payment-system-coral.vercel.app'}/index.html?status=success`
      },
      capture: true, // Сразу списывать деньги (не холдировать)
      save_payment_method: save_payment_method || false, // СОХРАНЕНИЕ КАРТЫ ДЛЯ РЕКУРРЕНТА!
      description: description || 'Оплата услуг',
      
      // Данные для чека (54-ФЗ)
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
            // 2 = "без НДС". код для Самозанятых (НПД)
            vat_code: 2 
          }
        ]
      }
    }, idempotenceKey);

    // 2. Сохраняем платеж в БД (userId может быть null для гостей)
    const dbPayment = await Payment.create({
      userId, 
      amount: outSum,
      provider: 'yookassa',
      status: payment.status, 
      yookassaPaymentId: payment.id, 
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