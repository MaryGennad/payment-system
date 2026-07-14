// ============================================
// 1. ИНИЦИАЛИЗАЦИЯ И ПЕРЕМЕННЫЕ
// ============================================
const API_BASE = window.API_BASE || '/api';

const authData = window.auth?.getAuth() || {};
const token = authData.token;

// Если нет токена, отправляем на страницу входа
if (!token) {
  window.location.href = 'auth.html';
}

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${token}`
};

// Элементы формы
const emailInput = document.getElementById('email');
const btnSubmit = document.getElementById('btnSubmit');
const paymentMethods = document.querySelectorAll('.payment-method');
const consent152 = document.getElementById('consent152');
const consentOffer = document.getElementById('consentOffer');
const consentSave = document.getElementById('consentSave');

let selectedProvider = 'yookassa';

// Чтение параметров из URL (при переходе из каталога услуг)
const urlParams = new URLSearchParams(window.location.search);
const urlAmount = urlParams.get('amount');
const urlDesc = urlParams.get('description');
const urlSave = urlParams.get('save');

// ============================================
// 2. ОБНОВЛЕНИЕ ИНТЕРФЕЙСА ПОД ВЫБРАННУЮ УСЛУГУ
// ============================================
if (urlAmount) {
  // Обновляем итоговую сумму в блоке summary, если он есть
  const totalElement = document.querySelector('.summary-row.total span:last-child');
  if (totalElement) {
    totalElement.textContent = `${parseFloat(urlAmount).toFixed(2)} ₽`;
  }
  
  // Если есть чекбокс "Сохранить карту", проставляем его по умолчанию из URL
  if (urlSave === 'true' && consentSave) {
    consentSave.checked = true;
  }
}

// ============================================
// 3. ВАЛИДАЦИЯ ФОРМЫ
// ============================================
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function checkForm() {
  if (!emailInput || !btnSubmit) return;
  
  const isEmailValid = isValidEmail(emailInput.value.trim());
  
  const isConsent152 = consent152 ? consent152.checked : true;
  const isConsentOffer = consentOffer ? consentOffer.checked : true;
  const isConsentSave = consentSave ? consentSave.checked : true;
  
  const isConsentValid = isConsent152 && isConsentOffer && isConsentSave;
  
  // Активируем кнопку только если email валиден и все согласия получены
  btnSubmit.disabled = !(isEmailValid && isConsentValid);
  
  // Визуальная подсветка ошибки в поле email
  if (emailInput.value && !isEmailValid) {
    emailInput.classList.add('error');
  } else {
    emailInput.classList.remove('error');
  }
}

// ============================================
// 4. ОБРАБОТЧИКИ СОБЫТИЙ
// ============================================
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

// ============================================
// 5. ОТПРАВКА ФОРМЫ (СОЗДАНИЕ ПЛАТЕЖА)
// ============================================
if (btnSubmit) {
  btnSubmit.addEventListener('click', async (e) => {
    e.preventDefault();
    if (btnSubmit.disabled) return;
    
    const originalText = btnSubmit.textContent;
    btnSubmit.disabled = true;
    btnSubmit.textContent = '⏳ Подготовка платежа...';
    
    try {
      const res = await fetch(`${API_BASE}/payments/create`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          provider: selectedProvider,
          amount: parseFloat(urlAmount || 1.00), // Берем из URL или 1₽ по умолчанию
          email: emailInput.value.trim(),
          description: urlDesc || 'Привязка карты', // Берем из URL или по умолчанию
          save_payment_method: urlSave === 'true' // Берем из URL
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
        throw new Error('Платежная система не вернула ссылку для оплаты');
      }
      
    } catch (err) {
      console.error('Payment error:', err);
      alert('❌ ' + err.message);
      btnSubmit.disabled = false;
      btnSubmit.textContent = originalText;
    }
  });
}

// ============================================
// 6. ОБРАБОТКА ВОЗВРАТА ОТ ЮKASSA
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  // Инициализация валидации при загрузке
  checkForm();
  
  // Загрузка ИНН для модерации (если элемент существует на странице)
  loadRecipientInfo();
  
  // Проверка статуса возврата
  const status = urlParams.get('status');
  
  if (status === 'success') {
    // Небольшая задержка, чтобы пользователь успел заметить сообщение
    setTimeout(() => {
      alert('✅ Оплата прошла успешно! Карта привязана.');
      localStorage.removeItem('pending_payment');
      window.location.href = 'cards.html';
    }, 500);
  } else if (status === 'fail' || status === 'canceled') {
    alert('❌ Оплата не прошла или была отменена. Попробуйте ещё раз.');
    localStorage.removeItem('pending_payment');
  }
});

// ============================================
// 7. ЗАГРУЗКА ИНН (ДЛЯ МОДЕРАЦИИ ЮKASSA)
// ============================================
async function loadRecipientInfo() {
  const innElement = document.getElementById('recipientInn');
  if (!innElement) return;
  
  try {
    // ЗАМЕНИТЕ НА ВАШ РЕАЛЬНЫЙ ИНН
    const inn = '123456789012'; 
    
    if (inn && inn.length === 12) {
      innElement.textContent = inn.replace(/(\d{3})(\d{3})(\d{3})(\d{3})/, '$1-$2-$3-$4');
    } else {
      innElement.textContent = inn;
    }
    
    innElement.style.color = '#059669'; // Зеленый цвет для доверия
  } catch (err) {
    console.error('Error loading INN:', err);
    innElement.textContent = 'Не указан';
  }
}