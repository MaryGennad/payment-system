// models/Card.js
import mongoose from 'mongoose'; // <-- Используйте import

const CardSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId, // <-- Правильный тип для ссылки на ID
    ref: 'User',                          // <-- Ссылка на имя модели 'User'
    required: true
  },
  provider: {
    type: String,
    enum: ['yookassa', 'robokassa'],
    required: true
  },
  cardToken: {
    type: String,
    required: true
  },
  last4: {
    type: String,
    required: true
  },
  cardType: {
    type: String,
    required: true
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
    default: false
  }
}, { 
  timestamps: true 
});

// ВАЖНО: Убедитесь, что здесь нет упоминания UserSchema!
export default mongoose.model('Card', CardSchema);