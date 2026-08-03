import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true 
  },
  email: { 
    type: String, 
    required: true, 
    unique: true,
    lowercase: true, // Автоматически приводим к нижнему регистру для надежности
    trim: true       // Убираем лишние пробелы по краям
  },
  password: { 
    type: String, 
    required: true 
  },
  // 🔥 ДОБАВЛЕНО: Поле для хранения токена карты ЮKassa для рекуррентных платежей
  yookassaPaymentMethodId: { 
    type: String, 
    default: null 
  }
}, { 
  timestamps: true 
});

export default mongoose.model('User', UserSchema);