// models/User.js
import mongoose from 'mongoose'; // <-- Замени require на import

const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }
}, { timestamps: true });

export default mongoose.model('User', UserSchema); 