// ============================================
// 1. ПРОВЕРКА АВТОРИЗАЦИИ
// ВАЖНО: Если вы даете ссылку на эту страницу модераторам ЮKassa,
// они НЕ смогут её открыть, если здесь стоит редирект на auth.html!
// Если страница должна быть публичной для проверки, закомментируйте эти 4 строки:
/*
const { token } = window.auth?.getAuth() || {};
if (!token) {
  window.location.href = 'auth.html';
}
*/

// Если страница всё же только для авторизованных, оставьте так:
const authData = window.auth?.getAuth() || {};
const token = authData.token;

// Заголовки с токеном (если токен есть)
const headers = {
  'Content-Type': 'application/json',
  'Authorization': token ? `Bearer ${token}` : ''
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
  if (!emailInput || !btnSubmit) return;
  
  const isEmailValid = isValidEmail(emailInput.value.trim());
  
  const isConsent152 = consent152 ? consent152.checked : true;
  const isConsentOffer = consentOffer ? consentOffer.checked : true;
  const isConsentSave = consentSave ? consentSave.checked : true;
  
  const isConsentValid = isConsent152 && isConsentOffer && isConsentSave;
  
  btnSubmit.disabled = !(isEmailValid && isConsentValid);
  
  if (emailInput.value && !isEmailValid) {
    emailInput.classList.add('error');
  } else {
    emailInput.classList.remove('error');
  }
}

// ============================================
// 2. НОВАЯ ФУНКЦИЯ: ЗАГРУЗКА ИНН ДЛЯ МОДЕРАЦИИ
// ============================================
async function loadRecipientInfo() {
  const innElement = document.getElementById('recipientInn');
  if (!innElement) return;
  
  try {
    // Здесь можно жестко прописать ваш ИНН, чтобы модераторы ЮKassa его точно увидели
    // Даже без запроса к серверу. Это самый надежный способ для прохождения модерации.
    const inn = '532113934079'; // <-- ЗАМЕНИТЕ НА ВАШ РЕАЛЬНЫЙ ИНН
    
    // Форматируем: 123456789012 -> 123-456-789-012
    const formattedInn = inn.length === 12 
      ? inn.replace(/(\d{3})(\d{3})(\d{3})(\d{3})/, '$1-$2-$3-$4') 
      : inn;
    
    innElement.textContent = formattedInn;
    innElement.style.color = '#34d399'; // Зеленый цвет для доверия
  } catch (err) {
    console.error('Error loading INN:', err);
    innElement.textContent = 'Не указан';
  }
}

// === Обработчики событий ===
if (emailInput) {
  emailInput.addEventListener('input', checkForm);
}

[consent152, consentOffer, consentSave].forEach(cb => {
  if (cb) cb.addEventListener('change', checkForm);
});

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
    
    // Проверка токена прямо перед оплатой (на случай, если убрали верхнюю проверку)
    if (!token) {
      alert('Для оплаты необходимо войти в аккаунт');
      window.location.href = 'auth.html';
      return;
    }

    const originalText = btnSubmit.textContent;
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Подготовка...';
    
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
        localStorage.setItem('pending_payment', 'true');
        window.location.href = data.confirmation_url;
      } else {
        throw new Error('Нет URL для оплаты');
      }
      
    } catch (err) {
      console.error('Payment error:', err);
      alert('❌ ' + err.message);
      btnSubmit.disabled = false;
      btnSubmit.textContent = originalText;
    }
  });
}

// === Инициализация при загрузке ===
document.addEventListener('DOMContentLoaded', () => {
  // 1. Загружаем и показываем ИНН (для модерации ЮKassa)
  loadRecipientInfo();
  
  // 2. Проверяем форму
 