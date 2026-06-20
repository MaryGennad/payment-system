// models/Payment.js
import mongoose from 'mongoose'; 

const PaymentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  paymentId: {
    type: String,
    unique: true, // ID платежа в ЮKassa должен быть уникальным
    required: true
  },
  provider: {
    type: String,
    required: true // yookassa или robokassa
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
    enum: ['pending', 'succeeded', 'canceled', 'failed'],
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

export default mongoose.model('User', UserSchema);