import mongoose from 'mongoose';

const PaymentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
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
  },
  //  НОВЫЕ ПОЛЯ для рекуррентных платежей
  recurringInfo: {
    isRecurring: { type: Boolean, default: false },
    totalStages: { type: Number, default: 1 }, // Всего этапов (например, 3)
    currentStage: { type: Number, default: 1 } // Текущий этап (1, 2 или 3)
  },
  parentPaymentId: {
    // ID первого платежа (для связи всех этапов)
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment',
    default: null
  }
}, { 
  timestamps: true 
});

export default mongoose.model('Payment', PaymentSchema);