// models/Card.js
import mongoose from 'mongoose';

const CardSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Ссылка на модель User
    required: true
  },
  provider: {
    type: String,
    enum: ['yookassa', 'robokassa'], // Ограничение по провайдерам
    required: true
  },
  cardToken: {
    type: String,
    required: true // Токен карты от платежной системы
  },
  last4: {
    type: String,
    required: true // Последние 4 цифры карты
  },
  cardType: {
    type: String,
    required: true // Тип карты (visa, mastercard и т.д.)
  },
  expiryMonth: {
    type: String,
    required: true
  },
  expiryYear: {
    type: String,
    required: true
  },
  isDefault: {
    type: Boolean,
    default: false // Является ли карта основной
  }
}, { 
  timestamps: true // Автоматически добавляет поля createdAt и updatedAt
});

export default mongoose.model('User', UserSchema);