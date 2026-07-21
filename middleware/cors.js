export default function cors(req, res, next) {
  // Разрешаем только ваш домен
  const allowedOrigins = [
    'https://payment-system-coral.vercel.app',
    'https://payment-system-git-main-maria-gennadievnas-projects.vercel.app'
  ];

  const origin = req.headers.origin;
  
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  next();
}