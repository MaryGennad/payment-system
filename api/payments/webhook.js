import connectDB from '../../lib/db.js';
import Payment from '../../models/Payment.js';
import User from '../../models/User.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  await connectDB();

  try {
    //   Безопасный парсинг body для Vercel
    let body;
    if (typeof req.body === 'object' && req.body !== null) {
      body = req.body;
    } else {
      body = await req.json();
    }
    
    const { event, object } = body;
    console.log('🔔 Webhook received:', event);

    // Обрабатываем успешную оплату
    if (event === 'payment.succeeded') {
      const yookassaId = object.id;
      const paymentMethodId = object.payment_method?.id;
      const saved = object.payment_method?.saved;

      // 1. Обновляем статус платежа в БД
      const dbPayment = await Payment.findOneAndUpdate(
        { yookassaPaymentId: yookassaId },
        { status: 'succeeded' },
        { new: true }
      );

      // 2. Если это рекуррент и карта сохранилась, сохраняем токен пользователю
      if (dbPayment && dbPayment.userId && saved && paymentMethodId) {
        await User.findByIdAndUpdate(dbPayment.userId, {
          yookassaPaymentMethodId: paymentMethodId
        });
        console.log('💳 Токен карты сохранен для пользователя:', dbPayment.userId);
      }
    }

    // Обрабатываем отмену платежа
    if (event === 'payment.canceled') {
      const paymentData = object;
      await Payment.findOneAndUpdate(
        { yookassaPaymentId: paymentData.id },
        { status: 'canceled' }
      );
    }

    // Обрабатываем возврат
    if (event === 'refund.succeeded') {
      const refundData = object;
      await Payment.findOneAndUpdate(
        { yookassaPaymentId: refundData.payment_id },
        { status: 'refunded' }
      );
    }

    // ЮKassa всегда ожидает ответ 200
    res.status(200).json({ status: 'ok' });

  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
}