import crypto from 'crypto'; 
import axios from 'axios';
import jwt from 'jsonwebtoken';
import connectDB from '../../lib/db.js';
import Payment from '../../models/Payment.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  await connectDB();

  try {
    // 1. Проверка авторизации
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Нет токена авторизации' });

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    const { paymentId } = req.body; 

    // 2. Находим платеж в БД и проверяем владельца
    const payment = await Payment.findOne({ _id: paymentId, userId });
    
    if (!payment) {
      return res.status(404).json({ error: 'Платеж не найден' });
    }

    if (payment.status !== 'succeeded') {
      return res.status(400).json({ error: 'Вернуть можно только успешный платеж' });
    }

    if (!payment.ЮKassaInvId) {
      return res.status(400).json({ error: 'Отсутствует ID платежа в ЮKassa (InvId)' });
    }

    // 3. Подготовка данных для возврата в ЮKassa
    const merchantLogin = process.env.ЮKassa_MERCHANT_LOGIN;
    const password2 = process.env.ЮKassa_PASSWORD_2; // Для возвратов используется Пароль №2!
    const outSum = payment.amount.toFixed(2);
    const invId = payment.ЮKassaInvId;

    if (!merchantLogin || !password2) {
      throw new Error('Не настроены переменные окружения ЮKassa для возврата');
    }

    // 4. Генерация подписи для возврата (MD5: MerchantLogin:OutSum:InvId:Password2)
    const signatureString = `${merchantLogin}:${outSum}:${invId}:${password2}`;
    const signatureValue = crypto.createHash('md5').update(signatureString).digest('hex');

    // 5. Отправка запроса на возврат
    // ЮKassa принимает возвраты через этот endpoint
    const refundUrl = 'https://auth.ЮKassa.ru/Merchant/Return.aspx';
    
    const params = new URLSearchParams();
    params.append('MerchantLogin', merchantLogin);
    params.append('InvId', invId);
    params.append('OutSum', outSum);
    params.append('SignatureValue', signatureValue);
    
    // Если нужна фискализация возврата (чек возврата), добавляем Receipt
    // (ЮKassa обычно делает это автоматически, если оригинальный чек был пробит, 
    // но явное указание надежнее)
    const receiptData = {
      sno: 'usn_income',
      items: [
        {
          name: 'Возврат: ' + (payment.description || 'Услуга'),
          quantity: 1.0,
          sum: outSum,
          payment_method: 'full_payment',
          payment_object: 'service',
          tax: 'none'
        }
      ],
      email: payment.email
    };
    params.append('Receipt', JSON.stringify(receiptData));

    const ЮKassaResponse = await axios.post(refundUrl, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    // ЮKassa возвращает простой текст: "OK" или код ошибки (например, "Invalid signature")
    const responseText = ЮKassaResponse.data.toString().trim();

    if (responseText.toUpperCase() === 'OK') {
      // 6. Обновляем статус в нашей БД
      payment.status = 'refunded';
      await payment.save();

      return res.status(200).json({
        success: true,
        message: 'Возврат успешно инициирован',
        ЮKassaResponse: responseText
      });
    } else {
      throw new Error(`ЮKassa вернула ошибку: ${responseText}`);
    }

  } catch (err) {
    console.error('Refund error:', err.message);
    res.status(500).json({
      error: err.message || 'Ошибка оформления возврата'
    });
  }
}