// server.js
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';

const app = express();

app.use(cors());
app.use(express.json());

// Подключение к БД
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));


// Импорт роутов (внимание! .js в конце!)
import authRoutes from './backend/routes/auth.js';
import cardRoutes from './backend/routes/cards.js';
import paymentRoutes from './backend/routes/payments.js';

app.use('/api/auth', authRoutes);
app.use('/api/cards', cardRoutes);
app.use('/api/payments', paymentRoutes);

app.get('/api/test', (req, res) => {
  res.json({ message: 'Vercel API is working with Express!' });
});

export default app;