// backend/middleware/auth.js
const jwt = require('jsonwebtoken');

module.exports = function auth(req, res, next) {
  // Получаем токен из заголовка
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    // Проверяем токен
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId; // добавляем userId в запрос
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Неверный токен' });
    }
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Токен истёк' });
    }
    return res.status(401).json({ error: 'Ошибка авторизации' });
  }
};