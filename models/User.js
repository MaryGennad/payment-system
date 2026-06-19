// models/User.js
import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true
  },
  email: { 
    type: String, 
    required: true, 
    unique: true, 
    lowercase: true,
    trim: true
  },
  password: { 
    type: String, 
    required: true,
    minlength: 6
    // Мы убрали select: false, чтобы видеть пароль при отладке, но можно вернуть
  }
}, { timestamps: true });

// ВАЖНО: Эта строка предотвращает ошибку "OverwriteModelError" на Vercel
export default mongoose.models.User || mongoose.model('User', UserSchema);