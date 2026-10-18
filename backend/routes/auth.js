import express from 'express';
import bcrypt from 'bcryptjs'; 
import jwt from 'jsonwebtoken'; 
import rateLimit from 'express-rate-limit'; // <-- ДОБАВЛЕНО
import User from '../../models/User.js'; 

const router = express.Router();

// === ЗАЩИТА ОТ ПЕРЕБОРА (RATE LIMITING) ===
// Ограничиваем вход: максимум 5 попыток за 15 минут с одного IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 5, // 5 попыток
  message: { error: 'Слишком много попыток входа. Попробуйте через 15 минут.' },
  standardHeaders: true, 
  legacyHeaders: false, 
});

// Ограничиваем регистрацию: максимум 3 попытки за час с одного IP
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 час
  max: 3, // 3 попытки
  message: { error: 'Слишком много попыток регистрации. Попробуйте через час.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ==========================================
// РЕГИСТРАЦИЯ
// ==========================================
router.post('/register', registerLimiter, async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // 1. Базовая валидация
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Заполните все обязательные поля' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Пароль должен быть не менее 6 символов' });
    }
    // Простая проверка формата email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Некорректный формат email' });
    }

    // 2. Проверка существующего пользователя
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
    }

    // 3. Хэширование пароля
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 4. Создание пользователя
    user = new User({
      name,
      email,
      password: hashedPassword
    });

    await user.save();

    // 5. Генерация токена
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
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
    console.error('Register error:', err.message);
    res.status(500).json({ error: 'Ошибка сервера при регистрации' });
  }
});

// ==========================================
// ВХОД
// ==========================================
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Базовая валидация
    if (!email || !password) {
      return res.status(400).json({ error: 'Укажите email и пароль' });
    }

    // 2. Поиск пользователя
    const user = await User.findOne({ email });
    if (!user) {
      // Возвращаем общую ошибку, чтобы не раскрывать, существует ли такой email
      return res.status(400).json({ error: 'Неверный email или пароль' });
    }

    // 3. Проверка пароля
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Неверный email или пароль' });
    }

    // 4. Генерация токена
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });

  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Ошибка сервера при входе' });
  }
});

export default router;