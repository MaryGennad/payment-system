import mongoose from 'mongoose'; 

const PaymentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null 
  },
  yookassaPaymentId: { 
    type: String,
    unique: true,
    required: true, // Это поле ОБЯЗАТЕЛЬНО (ID платежа из ЮKassa)
    index: true
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
    required: true
  },
  description: {
    type: String,
    default: 'Оплата услуги'
  }
}, { 
  timestamps: true 
});

export default mongoose.model('Payment', PaymentSchema);