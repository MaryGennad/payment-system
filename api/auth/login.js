// api/auth/login.js
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import connectDB from '../../lib/db.js';
import User from '../../models/User.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  await connectDB();

  try {
    const { email, password } = req.body;

    // Поиск пользователя
    const user = await User.findOne({ email }).select('+password'); // +password нужен, если в схеме стоит select: false
    if (!user) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    // Проверка пароля
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    // Генерация токена
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.status(200).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}