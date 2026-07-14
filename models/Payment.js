// models/Payment.js
import mongoose from 'mongoose'; // <-- Используйте import

const PaymentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  paymentId: {
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

// ВАЖНО: Здесь должно быть PaymentSchema, а НЕ UserSchema!
export default mongoose.model('Payment', PaymentSchema); 