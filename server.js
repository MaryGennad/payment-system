// server.js
require('dotenv').config(); // Загружаем переменные окружения из .env

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors()); // Разрешаем запросы с других доменов (фронтенда)
app.use(express.json()); // Позволяет читать JSON из тела запроса

// Подключение к базе данных
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));

// Импорт моделей (если они нужны для прямого доступа, но лучше через роуты)
// const User = require('./models/User'); 
// const Card = require('./models/Card');
// const Payment = require('./models/Payment');

// Подключение роутов
// Убедись, что файлы в backend/routes/ используют module.exports = router;
const authRoutes = require('./frontend/js/auth');
const cardRoutes = require('./frontend/js/cards');
const paymentRoutes = require('./backend/routes/payments');

// Использование роутов
app.use('/api/auth', authRoutes);
app.use('/api/cards', cardRoutes);
app.use('/api/payments', paymentRoutes);

// Тестовый роут для проверки, что API работает
app.get('/api/test', (req, res) => {
  res.json({ message: 'Vercel API is working with Express!' });
});

// Обработка ошибок 404 для API
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Экспорт приложения для Vercel
module.exports = app;

// Запуск сервера локально (не будет работать на Vercel, но удобно для тестов)
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}