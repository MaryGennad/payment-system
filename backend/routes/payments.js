import express from 'express';
import axios from 'axios'; 
import jwt from 'jsonwebtoken'; 
import Payment from '../../models/Payment.js'; 
import Card from '../../models/Card.js'; 

const router = express.Router();

// Middleware для проверки токена
const auth = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Нет токена авторизации' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Неверный токен' });
  }
};

// Создать платеж
router.post('/create', auth, async (req, res) => {
  try {
    const { provider, amount, email, description, save_payment_method } = req.body;

    // Создание платежа в ЮKassa
   const yookassaResponse = await axios.post(
  'https://api.yookassa.ru/v3/payments',
  {
    amount: {
      value: amount.toFixed(2),
      currency: 'RUB'
    },
    confirmation: {
      type: 'redirect',
      return_url: process.env.YOOKASSA_RETURN_URL || 'https://payment-system-coral.vercel.app/cards.html?status=success'
    },
    capture: true,
    description: description || 'Привязка карты',
    save_payment_method: save_payment_method || false,
    payment_method_data: {
      type: 'bank_card'
    }
  },
  {
    auth: {
      username: process.env.YOOKASSA_SHOP_ID,
      password: process.env.YOOKASSA_SECRET_KEY
    },
    headers: {
      'Content-Type': 'application/json',
      'Idempotence-Key': Date.now().toString()
    }
  }
);

    const paymentData = yookassaResponse.data;

    // ДЛЯ ОТЛАДКИ:
console.log('YooKassa response:', paymentData);
console.log('Payment ID:', paymentData.id);

    // Сохранение платежа в БД
    const payment = new Payment({
      userId: req.userId,
      amount,
      provider,
      status: paymentData.status,
      paymentId: paymentData.id,
      email
    });

    await payment.save();

  // Если нужно сохранить карту И данные карты есть
if (save_payment_method && paymentData.payment_method?.card) {
  const card = new Card({
    userId: req.userId,
    last4: paymentData.payment_method.card.last4,
    cardType: paymentData.payment_method.card.card_type,
    expiryMonth: paymentData.payment_method.card.expiry_month,
    expiryYear: paymentData.payment_method.card.expiry_year,
    isDefault: false
  });
  await card.save();
}

 // Проверяем, что confirmation существует
if (!paymentData.confirmation || !paymentData.confirmation.confirmation_url) {
  console.error('No confirmation URL in YooKassa response');
  return res.status(500).json({ error: 'No confirmation URL' });
}

res.json({
  confirmation_url: paymentData.confirmation.confirmation_url,
  paymentId: payment._id
});

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ 
      error: err.response?.data?.error_description || 'Ошибка создания платежа' 
    });
  }
});

export default router;
