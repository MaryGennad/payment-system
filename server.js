import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import cron from 'node-cron'; // <-- 1. Импортируем cron
import axios from 'axios';    // <-- 2. Импортируем axios для запросов к ЮKassa

// Импортируем модели (пути исправлены на ./models/)
import RecurringTest from './models/RecurringTest.js';
import Card from './models/Card.js';
import Payment from './models/Payment.js';

import adminRoutes from './backend/routes/admin.js';
import authRoutes from './backend/routes/auth.js';
import cardRoutes from './backend/routes/cards.js';
import paymentRoutes from './backend/routes/payments.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', 1); // Доверять прокси (Nginx)

app.use(cors());
app.use(express.json());

// Раздача статических файлов из папки frontend
app.use(express.static(path.join(__dirname, 'frontend')));

// 1. ЗАГРУЗКА СТРАНИЦЫ-ЗАГЛУШКИ
let maintenanceHtml = '';
try {
  maintenanceHtml = fs.readFileSync(path.join(__dirname, 'frontend', 'maintenance.html'), 'utf-8');
  console.log('Страница-заглушка (maintenance.html) успешно загружена');
} catch (err) {
  console.warn('Не удалось загрузить maintenance.html');
}

// 2. СОСТОЯНИЕ БАЗЫ ДАННЫХ
let isDbConnected = false;

// 3. MIDDLEWARE: ПРОВЕРКА ДОСТУПНОСТИ БД
app.use((req, res, next) => {
  if (req.path.startsWith('/api/payments/webhook') || req.path === '/api/test' || req.path.startsWith('/api/admin/test-status')) {
    return next();
  }

  if (!isDbConnected && maintenanceHtml) {
    return res.status(503).type('html').send(maintenanceHtml);
  }
  
  next();
});

// 4. ПОДКЛЮЧЕНИЕ К БД С ОБНОВЛЕНИЕМ СТАТУСА
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('MongoDB connected');
    isDbConnected = true;
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    isDbConnected = false;
  });

mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB disconnected');
  isDbConnected = false;
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB error:', err);
  isDbConnected = false;
});

// 5. ПОДКЛЮЧЕНИЕ РОУТОВ
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/cards', cardRoutes);
app.use('/api/payments', paymentRoutes);

// Публичные страницы
app.get('/user-agreement', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'user-agreement.html'));
});

app.get('/privacy-policy', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'privacy-policy.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// ==========================================
// 6. ФОНОВАЯ ЗАДАЧА: ТЕСТОВЫЕ СПИСАНИЯ (каждую минуту проверяет, пора ли списывать)
// ==========================================
cron.schedule('* * * * *', async () => {
  try {
    const now = new Date();
    // Ищем тесты, которые активны, у них остались попытки, и время nextRun наступило или прошло
    const tests = await RecurringTest.find({ 
      isActive: true, 
      remaining: { $gt: 0 },
      nextRun: { $lte: now }
    });

    for (const test of tests) {
      try {
        const card = await Card.findById(test.cardId);
        if (!card || !card.cardToken) {
          test.isActive = false;
          await test.save();
          continue;
        }

        console.log(`[TEST] Списание 1 ₽. Карта: ${card.last4}. Осталось: ${test.remaining}`);

        // Списываем 1 ₽ через ЮKassa
        const response = await axios.post(
          'https://api.yookassa.ru/v3/payments',
          {
            amount: { value: '1.00', currency: 'RUB' },
            capture: true,
            description: `Тестовое списание (осталось ${test.remaining} из 5)`,
            payment_method_id: card.cardToken
          },
          {
            auth: {
              username: process.env.YOOKASSA_SHOP_ID,
              password: process.env.YOOKASSA_SECRET_KEY
            },
            headers: {
              'Content-Type': 'application/json',
              'Idempotence-Key': `test-${test._id}-${Date.now()}`
            }
          }
        );

        // Сохраняем платёж в историю
        await new Payment({
          userId: test.userId,
          paymentId: response.data.id,
          provider: 'yookassa',
          amount: 1,
          status: response.data.status,
          description: `Тест: 1 ₽ (осталось ${test.remaining} из 5)`,
          recurringInfo: { isRecurring: true, totalStages: 5, currentStage: 6 - test.remaining }
        }).save();

        // Уменьшаем счётчик попыток
        test.remaining -= 1;
        if (test.remaining <= 0) {
          test.isActive = false;
          console.log(`[TEST] Тест завершён для карты ${test._id}`);
        } else {
          // Следующее списание через 60 минут (60 * 60 * 1000 мс)
          test.nextRun = new Date(Date.now() + 60 * 60 * 1000);
        }
        await test.save();

      } catch (err) {
        console.error(`[TEST] Ошибка при списании:`, err.response?.data || err.message);
        // Если карта отозвана или ошибка 400/403, останавливаем тест, чтобы не спамить ошибками
        if (err.response?.status === 400 || err.response?.status === 403) {
          test.isActive = false;
          await test.save();
        }
      }
    }
  } catch (err) {
    console.error('[TEST] Критическая ошибка фоновой задачи:', err);
  }
});

// 7. ЗАПУСК СЕРВЕРА
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;