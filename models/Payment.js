import mongoose from 'mongoose'; 

const PaymentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null //   ИЗМЕНЕНО: Теперь может быть null для гостевых оплат (убрали required: true)
  },
  yookassaPaymentId: { 
    type: String,
    unique: true,
    required: true,
    index: true // Добавили индекс для быстрого поиска платежа при обработке Webhook
  },
  provider: {
    type: String,
    required: true,
    default: 'yookassa'
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'RUB'
  },
  status: {
    type: String,
    enum: ['pending', 'succeeded', 'canceled', 'failed', 'refunded'], 
    default: 'pending'
  },
  email: {
    type: String,
    required: true // Email обязателен всегда (и для гостей, и для авторизованных) для отправки чека 54-ФЗ
  },
  description: {
    type: String,
    default: 'Оплата услуги'
  }
}, { 
  timestamps: true 
});

export default mongoose.model('Payment', PaymentSchema);