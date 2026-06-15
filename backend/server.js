//путь к .env
require('dotenv').config({ path: __dirname + '/.env' });

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors'); // ОБЪЯВЛЯЕМ ТОЛЬКО ОДИН РАЗ!

const app = express();

// === CORS настройки ===
const cors = require('cors');

app.use(cors({
  origin: ['https://payment-system-alpha-eight.vercel.app', 'http://localhost:8080'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

const corsOptions = {
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};
app.use(cors(corsOptions));

// Middleware
app.use(express.json());

// Отладка
console.log('🔍 MONGO_URI:', process.env.MONGO_URI ? ' Загружено' : ' undefined');
console.log('🔍 JWT_SECRET:', process.env.JWT_SECRET ? ' Загружено' : ' undefined');

// MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log(' MongoDB подключена'))
  .catch(err => {
    console.error(' Ошибка MongoDB:', err.message);
    process.exit(1);
  });

// === Маршруты ===

// Публичные
app.get('/', (req, res) => res.json({ message: 'Payment API ready' }));
app.get('/api/health', (req, res) => res.json({ 
  status: 'ok', 
  timestamp: new Date().toISOString(),
  db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' 
}));

// Авторизация
app.use('/api/auth', require('./routes/auth'));

// Защищённые маршруты
const auth = require('./middleware/auth');
app.use('/api/cards', auth, require('./routes/cards'));
app.use('/api/payments', auth, require('./routes/payments'));

// 404 (последний!)
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// Запуск
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Сервер: http://localhost:${PORT}`));
