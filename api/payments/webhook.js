// api/payments/webhook.js
import connectDB from '../../lib/db.js';
import Payment from '../../models/Payment.js';
import User from '../../models/User.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  await connectDB();

  try {
    const event = req.body;
    console.log('🔔 Webhook received:', event.event);

    // Обрабатываем успешную оплату
    if (event.event === 'payment.succeeded') {
      const paymentData = event.object;
      const yookassaId = paymentData.id;

      // 1. Обновляем статус платежа в БД
      const dbPayment = await Payment.findOneAndUpdate(
        { yookassaPaymentId: yookassaId },
        { status: 'succeeded' },
        { new: true }
      );

      // 2. Если это рекуррент и карта сохранилась, сохраняем токен пользователю
      if (dbPayment && dbPayment.userId && paymentData.payment_method?.saved) {
        const paymentMethodId = paymentData.payment_method.id;
        
        await User.findByIdAndUpdate(dbPayment.userId, {
          yookassaPaymentMethodId: paymentMethodId
        });
        console.log('💳 Токен карты сохранен для пользователя:', dbPayment.userId);
      }
    }

    // Обрабатываем отмену платежа
    if (event.event === 'payment.canceled') {
      const paymentData = event.object;
      await Payment.findOneAndUpdate(
        { yookassaPaymentId: paymentData.id },
        { status: 'canceled' }
      );
    }

    // Обрабатываем возврат
    if (event.event === 'refund.succeeded') {
      const refundData = event.object;
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