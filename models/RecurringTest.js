import mongoose from 'mongoose';

const recurringTestSchema = new mongoose.Schema({
  cardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Card', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  remaining: { type: Number, default: 5 },
  isActive: { type: Boolean, default: true },
  nextRun: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('RecurringTest', recurringTestSchema);