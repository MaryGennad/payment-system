import mongoose from 'mongoose'; 

const PaymentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null // 🔥 Разрешаем null для гостевых оплат
  },
  paymentId: { // 🔥 ВОЗВРАЩАЕМ оригинальное имя поля, которое использует ваш server.js!
    type: String,
    unique: true,
    required: true
  },
  provider: {
    type: String,
    required: true
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
    required: true
  },
  description: {
    type: String
  }
}, { 
  timestamps: true 
});

export default mongoose.model('Payment', PaymentSchema);