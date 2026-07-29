// api/payments/recurring.js
import crypto from 'crypto'; 
import axios from 'axios';
import connectDB from '../../lib/db.js';
import Payment from '../../models/Payment.js';
import User from '../../models/User.js'; // Предполагаем, что у пользователя есть recurringId

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  await connectDB();

  try {
    // В реальном проекте этот эндпоинт вызывается по Cron (планировщику), 
    // а не напрямую клиентом. Но для теста можно вызвать вручную.
    const { userId, amount, description } = req.body;

    if (!userId || !amount) {
      return res.status(400).json({ error: 'Не указаны userId или amount' });
    }

    // 1. Находим пользователя и его токен рекуррентного платежа
    const user = await User.findById(userId);
    if (!user || !user.ЮKassaRecurringId) {
      return res.status(400).json({ error: 'У пользователя нет сохраненного метода оплаты (RecurringId)' });
    }

    const merchantLogin = process.env.ЮKassa_MERCHANT_LOGIN;
    const password1 = process.env.ЮKassa_PASSWORD_1; // Для рекуррентных списаний используется Пароль №1
    const outSum = parseFloat(amount).toFixed(2);
    const invId = Date.now().toString(); // Новый уникальный номер заказа для этого списания
    const recurringId = user.ЮKassaRecurringId;

    // 2. Генерация подписи для рекуррентного платежа
    // Формат: MerchantLogin:RecurringId:OutSum:InvId:Password1
    const signatureString = `${merchantLogin}:${recurringId}:${outSum}:${invId}:${password1}`;
    const signatureValue = crypto.createHash('md5').update(signatureString).digest('hex');

    // 3. Формируем данные для чека (54-ФЗ) - обязательно для каждого списания!
    const receiptData = {
      sno: 'usn_income',
      items: [
        {
          name: description || 'Рекуррентный платеж: Услуги 1С:Отель',
          quantity: 1.0,
          sum: outSum,
          payment_method: 'full_payment',
          payment_object: 'service',
          tax: 'none'
        }
      ],
      email: user.email // Email должен совпадать с тем, что был при первой оплате
    };

    // 4. Отправка запроса на рекуррентное списание в ЮKassa
    const recurringUrl = 'https://auth.ЮKassa.ru/Merchant/Recurring.aspx';
    
    const params = new URLSearchParams();
    params.append('MerchantLogin', merchantLogin);
    params.append('RecurringId', recurringId);
    params.append('OutSum', outSum);
    params.append('InvId', invId);
    params.append('SignatureValue', signatureValue);
    params.append('Receipt', JSON.stringify(receiptData));
    params.append('IsTest', '1'); // Уберите при реальной работе

    const ЮKassaResponse = await axios.post(recurringUrl, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const responseText = ЮKassaResponse.data.toString().trim();

    if (responseText.toUpperCase() === 'OK') {
      // 5. Сохраняем факт успешного рекуррентного платежа в БД
      await Payment.create({
        userId,
        amount: outSum,
        provider: 'ЮKassa_recurring',
        status: 'succeeded',
        ЮKassaInvId: invId,
        description: description || 'Рекуррентный платеж',
        email: user.email
      });

      return res.status(200).json({
        success: true,
        message: 'Рекуррентный платеж успешно списан',
        invId: invId
      });
    } else {
      throw new Error(`ЮKassa вернула ошибку: ${responseText}`);
    }

  } catch (err) {
    console.error('Recurring payment error:', err.message);
    res.status(500).json({
      error: err.message || 'Ошибка рекуррентного списания'
    });
  }
}