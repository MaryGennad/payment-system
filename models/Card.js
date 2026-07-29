import mongoose from 'mongoose';

const CardSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  provider: {
    type: String,
    enum: ['yookassa', 'ЮKassa'],
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

// Уникальный индекс: пользователь + последние 4 цифры + срок действия
// Это предотвратит создание дубликатов на уровне базы данных
CardSchema.index(
  { userId: 1, last4: 1, expiryMonth: 1, expiryYear: 1 }, 
  { unique: true, name: 'unique_user_card' }
);

export default mongoose.model('Card', CardSchema);