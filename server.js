import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json());

// Раздача статических файлов из папки frontend
app.use(express.static(path.join(__dirname, 'frontend')));

// Подключение к БД
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Импорт роутов
import authRoutes from './backend/routes/auth.js';
import cardRoutes from './backend/routes/cards.js';
import paymentRoutes from './backend/routes/payments.js';

app.use('/api/auth', authRoutes);
app.use('/api/cards', cardRoutes);
app.use('/api/payments', paymentRoutes);

app.get('/api/test', (req, res) => {
  res.json({ message: 'API is working with Express!' });
});

// Публичные страницы (БЕЗ авторизации)
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

export default app;