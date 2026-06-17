const mongoose = require('mongoose');

const cardSchema = new mongoose.Schema({
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

module.exports = mongoose.model('Card', cardSchema);