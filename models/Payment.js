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
    enum: ['pending', 'succeeded', 'canceled', 'failed'],
    default: 'pending'
  },
  email: String,
  description: String
}, { timestamps: true });

export default mongoose.models.Payment || mongoose.model('Payment', PaymentSchema);