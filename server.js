import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';// для чтения файла заглушки
import adminRoutes from './backend/routes/admin.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

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
  // ВАЖНО: Пропускаем вебхуки ЮKassa и тестовые роуты, даже если БД упала
  // Чтобы ЮKassa не получала HTML-страницу вместо ожидаемого JSON
  if (req.path.startsWith('/api/payments/webhook') || req.path === '/api/test') {
    return next();
  }

  if (!isDbConnected && maintenanceHtml) {
    // Возвращаем 503 Service Unavailable и HTML заглушку
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

// Обработка разрыва соединения
mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB disconnected');
  isDbConnected = false;
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB error:', err);
  isDbConnected = false;
});

// Импорт роутов
import authRoutes from './backend/routes/auth.js';
import cardRoutes from './backend/routes/cards.js';
import paymentRoutes from './backend/routes/payments.js';

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

// Главная страница
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;