// backend/models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: { 
    type: String, 
    required: true, 
    unique: true, 
    lowercase: true,
    trim: true
  },
  password: { 
    type: String, 
    required: true,
    minlength: 6,
    select: false // 🔒 Пароль не возвращается в ответах
  },
  name: { 
    type: String, 
    trim: true 
  }
}, { timestamps: true });

// 🛡 Хеширование пароля перед сохранением
// ✅ Используем async БЕЗ next() — Mongoose сам обработает Promise
userSchema.pre('save', async function() {
  // Если пароль не менялся — выходим
  if (!this.isModified('password')) return;
  
  // Хэшируем пароль
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  // ✅ Не вызываем next() — async функция сама вернёт Promise
});

// 🗝 Метод для проверки пароля при входе
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);