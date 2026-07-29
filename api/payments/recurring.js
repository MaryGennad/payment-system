import { YooKassa }  from 'yookassa';
import connectDB from '../../lib/db.js';
import Payment from '../../models/Payment.js';
import User from '../../models/User.js';

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
    const { userId, amount, description } = req.body;

    if (!userId || !amount) {
      return res.status(400).json({ error: 'Не указаны userId или amount' });
    }

    // 1. Находим пользователя и его сохраненный метод оплаты
    const user = await User.findById(userId);
    if (!user || !user.yookassaPaymentMethodId) {
      return res.status(400).json({ error: 'У пользователя нет сохраненной карты для списания' });
    }

    const outSum = parseFloat(amount).toFixed(2);
    const idempotenceKey = `recurring_${Date.now()}`; // Уникальный ключ для идемпотентности

    // 2. Создаем платеж с использованием сохраненного payment_method_id
    const payment = await yooKassa.createPayment({
      amount: {
        value: outSum,
        currency: 'RUB'
      },
      payment_method_id: user.yookassaPaymentMethodId, // 🔥 Магия рекуррента: списываем без участия клиента
      capture: true,
      description: description || 'Рекуррентный платеж: Подписка',
      receipt: {
        customer: { email: user.email },
        items: [
          {
            description: description || 'Услуга по подписке',
            quantity: '1.00',
            amount: { value: outSum, currency: 'RUB' },
            vat_code: 1 // или 2 (без НДС), в зависимости от вашей системы
          }
        ]
      }
    }, idempotenceKey);

    // 3. Сохраняем факт успешного списания в БД
    await Payment.create({
      userId,
      amount: outSum,
      provider: 'yookassa_recurring',
      status: payment.status, // обычно 'succeeded', если карта не отклонена
      yookassaPaymentId: payment.id,
      email: user.email,
      description: description || 'Рекуррентный платеж'
    });

    res.status(200).json({
      success: true,
      message: 'Рекуррентный платеж успешно инициирован',
      yookassaPaymentId: payment.id,
      status: payment.status
    });

  } catch (err) {
    console.error('Recurring payment error:', err);
    res.status(500).json({
      error: err.message || 'Ошибка рекуррентного списания'
    });
  }
}