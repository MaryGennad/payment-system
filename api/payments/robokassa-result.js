import crypto from 'crypto';
import connectDB from '../../../lib/db.js'; // Проверьте путь к вашему db.js
import Payment from '../../../models/Payment.js';
import User from '../../../models/User.js';

export default async function handler(req, res) {
  // ЮKassa всегда шлет POST запросы на ResultURL
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  await connectDB();

  try {
    const { MerchantLogin, OutSum, InvId, SignatureValue, RecurringId } = req.body;

    // 1. ПРОВЕРКА ПОДПИСИ (Строгая формула ЮKassa для ResultURL)
    // Формат: MerchantLogin:OutSum:InvId:Password2
    const correctSignature = crypto
      .createHash('md5')
      .update(`${MerchantLogin}:${OutSum}:${InvId}:${process.env.ЮKassa_PASSWORD_2}`)
      .digest('hex')
      .toUpperCase();

    if (SignatureValue.toUpperCase() !== correctSignature) {
      console.error('❌ Ошибка подписи ResultURL! Ожидалось:', correctSignature, 'Получено:', SignatureValue);
      return res.status(403).send('Bad signature');
    }

    console.log('✅ Подпись верна! Обработка платежа InvId:', InvId);

    // 2. Находим платеж в нашей базе данных
    const payment = await Payment.findOne({ ЮKassaInvId: InvId });
    
    if (!payment) {
      console.error('❌ Платеж с InvId', InvId, 'не найден в БД');
      return res.status(404).send(`NOT_FOUND${InvId}`);
    }

    // Если платеж уже обработан, просто возвращаем OK (защита от повторных уведомлений)
    if (payment.status === 'succeeded') {
      console.log('⚠️ Платеж уже обработан ранее. Возвращаем OK');
      return res.status(200).send(`OK${InvId}`);
    }

    // 3. Обновляем статус платежа на успешный
    payment.status = 'succeeded';
    await payment.save();

    // 4. ВАЖНО ДЛЯ РЕКУРРЕНТНЫХ ПЛАТЕЖЕЙ: Сохраняем RecurringId пользователя
    if (RecurringId) {
      console.log('💳 Получен RecurringId:', RecurringId, 'для пользователя:', payment.userId);
      await User.findByIdAndUpdate(
        payment.userId,
        { ЮKassaRecurringId: RecurringId },
        { new: true }
      );
    }

    // 5. Возвращаем строго форматированный ответ для ЮKassa
    // Никаких лишних пробелов, только OK и номер заказа
    return res.status(200).send(`OK${InvId}`);

  } catch (err) {
    console.error('❌ Ошибка обработки ResultURL:', err);
    // Даже при ошибке лучше вернуть что-то, чтобы ЮKassa не спамила, 
    // но в данном случае вернем ошибку, чтобы увидеть её в логах ЮKassa
    return res.status(500).send('ERROR');
  }
}