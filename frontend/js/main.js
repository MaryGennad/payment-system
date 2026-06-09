// frontend/js/main.js
const API_BASE = 'http://localhost:3000/api';

// 🔐 Проверка авторизации
const { token } = window.auth?.getAuth() || {};
if (!token) {
  window.location.href = 'auth.html';
}

// Заголовки с токеном
const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${token}`
};

// === Элементы формы ===
const emailInput = document.getElementById('email');
const btnSubmit = document.getElementById('btnSubmit');
const paymentMethods = document.querySelectorAll('.payment-method');
const consent152 = document.getElementById('consent152');
const consentOffer = document.getElementById('consentOffer');
const consentSave = document.getElementById('consentSave');

let selectedProvider = 'yookassa';

// === Валидация email ===
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// === Проверка формы: активируем кнопку, если всё ок ===
function checkForm() {
  // Если элементов нет на странице — выходим
  if (!emailInput || !btnSubmit) return;
  
  const isEmailValid = isValidEmail(emailInput.value.trim());
  
  // Если чекбоксов нет — считаем, что они не нужны (или уже отмечены)
  const isConsent152 = consent152 ? consent152.checked : true;
  const isConsentOffer = consentOffer ? consentOffer.checked : true;
  const isConsentSave = consentSave ? consentSave.checked : true;
  
  const isConsentValid = isConsent152 && isConsentOffer && isConsentSave;
  
  // Активируем кнопку только если всё валидно
  btnSubmit.disabled = !(isEmailValid && isConsentValid);
  
  // Визуальная подсветка email
  if (emailInput.value && !isEmailValid) {
    emailInput.classList.add('error');
  } else {
    emailInput.classList.remove('error');
  }
}

// === Обработчики событий ===

// Email: проверяем при вводе
if (emailInput) {
  emailInput.addEventListener('input', checkForm);
}

// Чекбоксы: проверяем при изменении
[consent152, consentOffer, consentSave].forEach(cb => {
  if (cb) cb.addEventListener('change', checkForm);
});

// Выбор платёжной системы
paymentMethods.forEach(method => {
  method.addEventListener('click', () => {
    paymentMethods.forEach(m => m.classList.remove('active'));
    method.classList.add('active');
    selectedProvider = method.dataset.provider;
  });
});

// === Отправка формы ===
if (btnSubmit) {
  btnSubmit.addEventListener('click', async () => {
    if (btnSubmit.disabled) return;
    
    const originalText = btnSubmit.textContent;
    btnSubmit.disabled = true;
    btnSubmit.textContent = '⏳ Подготовка...';
    
    try {
      const res = await fetch(`${API_BASE}/payments/create`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          provider: selectedProvider,
          amount: 1.00,
          email: emailInput.value.trim(),
          description: 'Привязка карты',
          save_payment_method: true
        })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Ошибка создания платежа');
      }
      
      if (data.confirmation_url) {
        // Сохраняем флаг, что оплата в процессе
        localStorage.setItem('pending_payment', 'true');
        // Перенаправляем на оплату
        window.location.href = data.confirmation_url;
      } else {
        throw new Error('Нет URL для оплаты');
      }
      
    } catch (err) {
      console.error('Payment error:', err);
      alert(err.message);
      btnSubmit.disabled = false;
      btnSubmit.textContent = originalText;
    }
  });
}

// === Инициализация при загрузке ===
document.addEventListener('DOMContentLoaded', () => {
  // Проверяем форму сразу при загрузке
  checkForm();
  
  // Обработка возврата после оплаты
  const urlParams = new URLSearchParams(window.location.search);
  const status = urlParams.get('status');
  
  if (status === 'success') {
    alert('✅ Оплата прошла успешно! Карта привязана.');
    localStorage.removeItem('pending_payment');
    setTimeout(() => {
      window.location.href = 'cards.html';
    }, 2000);
  } else if (status === 'fail' || status === 'canceled') {
    alert('❌ Оплата не прошла. Попробуйте ещё раз.');
    localStorage.removeItem('pending_payment');
  }
});