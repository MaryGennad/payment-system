import YooKassa from 'yookassa';
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
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Нет токена авторизации' });

    // (Здесь можно добавить проверку JWT, как в create.js, для безопасности)
    
    const { paymentId } = req.body; // Это _id нашего платежа из MongoDB

    // 1. Находим платеж в нашей БД
    const payment = await Payment.findById(paymentId);
    
    if (!payment) {
      return res.status(404).json({ error: 'Платеж не найден' });
    }

    if (payment.status !== 'succeeded') {
      return res.status(400).json({ error: 'Вернуть можно только успешный платеж' });
    }

    if (!payment.yookassaPaymentId) {
      return res.status(400).json({ error: 'Отсутствует ID платежа в ЮKassa' });
    }

    const outSum = payment.amount.toFixed(2);
    const idempotenceKey = `refund_${Date.now()}`;

    // 2. Создаем возврат через SDK ЮKassa
    const refund = await yooKassa.createRefund({
      amount: {
        value: outSum,
        currency: 'RUB'
      },
      payment_id: payment.yookassaPaymentId,
      description: `Возврат по платежу ${payment.yookassaPaymentId}`
    }, idempotenceKey);

    // 3. Обновляем статус в нашей БД
    payment.status = 'refunded';
    await payment.save();

    res.status(200).json({
      success: true,
      message: 'Возврат успешно инициирован',
      refundId: refund.id,
      status: refund.status
    });

  } catch (err) {
    console.error('Refund error:', err);
    res.status(500).json({
      error: err.message || 'Ошибка оформления возврата'
    });
  }
}