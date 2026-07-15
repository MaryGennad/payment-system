import connectDB from '../lib/db.js';

export default async function handler(req, res) {
  try {
    await connectDB();
    res.json({ 
      status: 'ok', 
      message: 'MongoDB подключен успешно!',
      uri: process.env.MONGODB_URI ? 'установлен' : 'НЕ установлен'
    });
  } catch (err) {
    res.status(500).json({ 
      status: 'error', 
      message: err.message 
    });
  }
}