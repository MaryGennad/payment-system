// ============================================
// 1. ИНИЦИАЛИЗАЦИЯ И ПЕРЕМЕННЫЕ
// ============================================
const API_BASE = window.API_BASE || '/api';

const authData = window.auth?.getAuth() || {};
const token = authData.token;

// ЗАЩИТА: Если нет токена, редирект на вход, НО с сохранением текущей ссылки
if (!token) {
  const currentUrl = window.location.pathname + window.location.search;
  window.location.href = `auth.html?returnTo=${encodeURIComponent(currentUrl)}`;
}

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${token}`
};

const emailInput = document.getElementById('email');
const btnSubmit = document.getElementById('btnSubmit');
const paymentMethods = document.querySelectorAll('.payment-method');
const consent152 = document.getElementById('consent152');
const consentOffer = document.getElementById('consentOffer');
const consentSave = document.getElementById('consentSave');

let selectedProvider = 'robokassa'; // Исправлено с yookassa на robokassa

// Чтение параметров из URL (при переходе из каталога услуг)
const urlParams = new URLSearchParams(window.location.search);
const urlAmount = urlParams.get('amount');
const urlDesc = urlParams.get('description');
const urlSave = urlParams.get('save');

// 🔍 ОТЛАДКА: Смотрим в консоль браузера (F12), что пришло из URL
console.log('URL Параметры:', { urlAmount, urlDesc, urlSave });

// ============================================
// 2. ОБНОВЛЕНИЕ ИНТЕРФЕЙСА ПОД ВЫБРАННУЮ УСЛУГУ
// ============================================
if (urlAmount) {
  const amountNum = parseFloat(urlAmount);
  
  // 1. Обновляем сумму
  const totalElement = document.getElementById('totalAmount');
  if (totalElement) {
    totalElement.textContent = `${amountNum.toFixed(2)} ₽`;
    console.log('Сумма обновлена:', totalElement.textContent);
  }
  
  // 2. Обновляем название услуги
  if (urlDesc) {
    const serviceElement = document.getElementById('serviceName');
    if (serviceElement) {
      serviceElement.textContent = decodeURIComponent(urlDesc);
      console.log('Услуга обновлена:', serviceElement.textContent);
    }
  }
  
  // 3. Чекбокс сохранения карты
  if (urlSave === 'true' && consentSave) {
    consentSave.checked = true;
  }
} else {
  console.warn('Параметр amount не найден в URL. Показываем значения по умолчанию.');
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
  // consentSave не обязателен для валидации, но если он есть, проверяем
  
  const isConsentValid = isConsent152 && isConsentOffer;
  
  btnSubmit.disabled = !(isEmailValid && isConsentValid);
  
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
    
    // ✅ ПРОВЕРКА АВТОРИЗАЦИИ ПЕРЕД СОЗДАНИЕМ ПЛАТЕЖА
    const currentAuthData = window.auth?.getAuth() || {};
    const currentToken = currentAuthData.token;
    
    if (!currentToken) {
      // Если пользователь не вошел, сохраняем ссылку и отправляем на вход
      const currentUrl = window.location.pathname + window.location.search;
      window.location.href = `auth.html?returnTo=${encodeURIComponent(currentUrl)}`;
      return; // Прерываем выполнение, не отправляем запрос на сервер
    }

    const originalText = btnSubmit.textContent;
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Подготовка платежа...';
    
    try {
      const res = await fetch(`${API_BASE}/payments/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentToken}` // Используем актуальный токен
        },
        body: JSON.stringify({
          provider: selectedProvider,
          amount: parseFloat(urlAmount || 100.00),
          email: emailInput.value.trim(),
          description: urlDesc || 'Оплата услуги 1С:Отель',
          save_payment_method: urlSave === 'true'
        })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Ошибка создания платежа');
      }
      
      if (data.confirmation_url || data.paymentUrl) {
        localStorage.setItem('pending_payment', 'true');
        window.location.href = data.confirmation_url || data.paymentUrl;
      } else {
        throw new Error('Платежная система не вернула ссылку для оплаты');
      }
      
    } catch (err) {
      console.error('Payment error:', err);
      alert('Ошибка: ' + err.message);
      btnSubmit.disabled = false;
      btnSubmit.textContent = originalText;
    }
  });
}

// ============================================
// 6. ОБРАБОТКА ВОЗВРАТА И ИНИЦИАЛИЗАЦИЯ
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  checkForm();
  loadRecipientInfo();
  
  const status = urlParams.get('status');
  if (status === 'success') {
    setTimeout(() => {
      alert('Оплата прошла успешно. Доступ предоставлен.');
      localStorage.removeItem('pending_payment');
      window.location.href = 'cards.html';
    }, 500);
  } else if (status === 'fail' || status === 'canceled') {
    alert('Оплата не прошла или была отменена. Попробуйте ещё раз.');
    localStorage.removeItem('pending_payment');
  }
});

// ============================================
// 7. ЗАГРУЗКА ИНН
// ============================================
function loadRecipientInfo() {
  const innElement = document.getElementById('recipientInn');
  if (!innElement) return;
  
  const inn = '532113934079'; 
  if (inn && inn.length === 12) {
    innElement.textContent = inn.replace(/(\d{3})(\d{3})(\d{3})(\d{3})/, '$1-$2-$3-$4');
  } else {
    innElement.textContent = inn;
  }
}