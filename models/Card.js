// models/Card.js
import mongoose from 'mongoose';

const CardSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
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
  expiryMonth: String,
  expiryYear: String,
  isDefault: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

export default mongoose.models.Card || mongoose.model('Card', CardSchema);