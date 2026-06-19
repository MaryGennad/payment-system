// api/auth/register.js
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
    const { name, email, password } = req.body;

    // Проверка пользователя
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Пользователь уже существует' });
    }

    // Хэширование пароля (вручную, так как убрали хук из модели)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Создание пользователя
    const user = await User.create({
      name: name || 'Пользователь',
      email,
      password: hashedPassword
    });

    // Генерация токена
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });

  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}