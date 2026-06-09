// // routes/payments.js
// const express = require('express');
// const router = express.Router();
// const axios = require('axios');
// const crypto = require('crypto');
// const Card = require('../models/Card');
// const Payment = require('../models/Payment');

// // POST /api/payments/create — создать платёж для привязки карты
// router.post('/create', async (req, res) => {
//   try {
//     const { provider, amount, email, save_payment_method = true } = req.body;
//     const userId = req.userId; // ← из токена!
    
//     if (!userId || !provider || !amount) {
//       return res.status(400).json({ error: 'userId, provider и amount обязательны' });
//     }

//     let paymentData;

//     if (provider === 'yookassa') {
//       // ===== YooKassa =====
//       const response = await axios.post(
//         'https://api.yookassa.ru/v3/payments',
//         {
//           amount: { value: amount.toFixed(2), currency: 'RUB' },
//           confirmation: { type: 'redirect', return_url: process.env.YOOKASSA_RETURN_URL || 'http://localhost:8080/cards' },
//           save_payment_method,
//           capture: true,
//           description: 'Привязка карты',
//           metadata: { user_id: userId, email }
//         },
//         {
//           auth: {
//             username: process.env.YOOKASSA_SHOP_ID,
//             password: process.env.YOOKASSA_SECRET_KEY
//           },
//           headers: {
//             'Content-Type': 'application/json',
//             'Idempotence-Key': crypto.randomUUID()
//           }
//         }
//       );

//       // Сохраняем платёж в БД
//       await Payment.create({
//         userId,
//         provider: 'yookassa',
//         paymentId: response.data.id,
//         amount,
//         status: 'pending',
//         metadata: { email }
//       });

//       paymentData = {
//         payment_id: response.data.id,
//         confirmation_url: response.data.confirmation?.confirmation_url,
//         provider: 'yookassa'
//       };

//     } else if (provider === 'robokassa') {
//       // ===== Robokassa =====
//       const login = process.env.ROBOKASSA_LOGIN;
//       const pass1 = process.env.ROBOKASSA_PASS1;
//       const isTest = process.env.ROBOKASSA_IS_TEST === '1';
//       const invId = Date.now().toString();
//       const desc = encodeURIComponent('Привязка карты');

//       // Подпись
//       const signature = crypto
//         .createHash('md5')
//         .update(`${login}:${amount.toFixed(2)}:${invId}:${pass1}:Shp_email=${email}`)
//         .digest('hex');

//       const baseUrl = isTest 
//         ? 'https://test.robokassa.ru/Index.aspx' 
//         : 'https://merchant.roboxchange.com/Index.aspx';

//       const paymentUrl = `${baseUrl}?MerchantLogin=${login}&OutSum=${amount.toFixed(2)}&InvId=${invId}&Description=${desc}&SignatureValue=${signature}&Shp_email=${email}&IsTest=${isTest ? 1 : 0}`;

//       // Сохраняем платёж
//       await Payment.create({
//         userId,
//         provider: 'robokassa',
//         paymentId: invId,
//         amount,
//         status: 'pending',
//         metadata: { email, invId }
//       });

//       paymentData = {
//         payment_id: invId,
//         confirmation_url: paymentUrl,
//         provider: 'robokassa'
//       };
//     } else {
//       return res.status(400).json({ error: 'Неизвестный провайдер' });
//     }

//     res.json(paymentData);
//   } catch (err) {
//     console.error('Payment create error:', err.response?.data || err.message);
//     res.status(500).json({ error: 'Failed to create payment' });
//   }
// });

// // POST /api/payments/webhook/yookassa
// router.post('/webhook/yookassa', async (req, res) => {
//   try {
//     const { event, object } = req.body;
    
//     if (event === 'payment.succeeded') {
//       // Обновляем статус платежа
//       await Payment.findOneAndUpdate(
//         { paymentId: object.id },
//         { status: 'succeeded' }
//       );

//       // Если карта сохранена — добавляем в БД
//       if (object.payment_method?.saved) {
//         const pm = object.payment_method;
//         await Card.create({
//           userId: object.metadata?.user_id,
//           provider: 'yookassa',
//           cardToken: pm.id,
//           last4: pm.card?.last4,
//           cardType: pm.type,
//           expiryMonth: pm.card?.expiry_month,
//           expiryYear: pm.card?.expiry_year,
//           isDefault: false
//         });
//       }
//     }
//     res.json({ status: 'ok' });
//   } catch (err) {
//     console.error('YooKassa webhook error:', err);
//     res.status(500).json({ error: 'Webhook error' });
//   }
// });

// // POST /api/payments/webhook/robokassa
// router.post('/webhook/robokassa', async (req, res) => {
//   try {
//     const { OutSum, InvId, SignatureValue } = req.body;
//     const pass2 = process.env.ROBOKASSA_PASS2;

//     // Проверка подписи
//     const mySignature = crypto
//       .createHash('md5')
//       .update(`${OutSum}:${InvId}:${pass2}`)
//       .digest('hex')
//       .toUpperCase();

//     if (mySignature !== SignatureValue?.toUpperCase()) {
//       return res.status(400).send('Bad signature');
//     }

//     await Payment.findOneAndUpdate({ paymentId: InvId }, { status: 'succeeded' });
//     res.send(`OK${InvId}`);
//   } catch (err) {
//     console.error('Robokassa webhook error:', err);
//     res.status(500).send('Error');
//   }
// });

// module.exports = router;