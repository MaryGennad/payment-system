import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import connectDB from '../../lib/db.js';
import User from '../../models/User.js';

// проверка email
const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  await connectDB();

  try {
    // БЕЗОПАСНЫЙ ПАРСИНГ BODY ДЛЯ VERCEL
    let body;
    if (typeof req.body === 'object' && req.body !== null) {
      body = req.body;
    } else {
      body = await req.json();
    }
    
    const { name, email, password } = body;

    // ЗАЩИТА: Валидация входных данных
    if (!email || !password) {
      return res.status(400).json({ error: 'Email и пароль обязательны' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name ? name.trim() : 'Пользователь';

    if (!isValidEmail(cleanEmail)) {
      return res.status(400).json({ error: 'Некорректный формат email' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Пароль должен содержать минимум 8 символов' });
    }

    // Проверка существующего пользователя (по очищенному email)
    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
    }

    // Хэширование пароля
    const hashedPassword = await bcrypt.hash(password, 10);

    // Создание пользователя
    const user = await User.create({
      name: cleanName,
      email: cleanEmail,
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