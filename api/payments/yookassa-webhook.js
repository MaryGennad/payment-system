import connectDB from '../../lib/db.js';
import Payment from '../../models/Payment.js';
import User from '../../models/User.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  await connectDB();

  try {
    const { event, object } = req.body;

    // Нас интересует только успешная оплата
    if (event === 'payment.succeeded') {
      const yookassaPaymentId = object.id;
      const paymentMethodId = object.payment_method?.id; // 🔥 ВОТ ОН, ТОКЕН ДЛЯ РЕКУРРЕНТА!
      const saved = object.payment_method?.saved; // true, если карта сохранилась

      console.log('✅ Оплата прошла:', yookassaPaymentId);

      // 1. Обновляем статус платежа в БД
      await Payment.findOneAndUpdate(
        { yookassaPaymentId: yookassaPaymentId },
        { status: 'succeeded' }
      );

      // 2. Если карта сохранилась, сохраняем payment_method_id пользователю
      if (saved && paymentMethodId) {
        // Находим платеж, чтобы узнать userId
        const payment = await Payment.findOne({ yookassaPaymentId: yookassaPaymentId });
        
        if (payment && payment.userId) {
          await User.findByIdAndUpdate(payment.userId, {
            yookassaPaymentMethodId: paymentMethodId
          });
          console.log('💳 Токен карты сохранен для пользователя:', payment.userId);
        }
      }
    }

    // ЮKassa всегда ожидает ответ 200 OK
    res.status(200).json({ success: true });

  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
}