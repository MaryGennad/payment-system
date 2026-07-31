// ============================================
// 1. ИНИЦИАЛИЗАЦИЯ
// ============================================
document.addEventListener('DOMContentLoaded', function() {
  console.log('main.js запущен (DOMContentLoaded)');
  
  const API_BASE = window.API_BASE || '/api';
  const authData = window.auth?.getAuth() || {};
  const token = authData.token;
  
  console.log('Токен:', token ? 'ЕСТЬ' : 'НЕТ (гость)');
  
  // Чтение параметров из URL
  const urlParams = new URLSearchParams(window.location.search);
  const urlAmount = urlParams.get('amount');
  const urlDesc = urlParams.get('description');
  const urlSave = urlParams.get('save');
  
  console.log(' Параметры URL:', { amount: urlAmount, desc: urlDesc, save: urlSave });
  
  // ============================================
  // 2. ОБНОВЛЕНИЕ ИНТЕРФЕЙСА
  // ============================================
  const totalElement = document.getElementById('totalAmount');
  const serviceElement = document.getElementById('serviceName');
  
  if (urlAmount && totalElement) {
    const amountNum = parseFloat(urlAmount);
    totalElement.textContent = `${amountNum.toFixed(2)} ₽`;
    console.log(' Сумма обновлена:', totalElement.textContent);
  } else {
    console.warn(' Не удалось обновить сумму. urlAmount:', urlAmount, 'totalElement:', totalElement);
  }
  
  if (urlDesc && serviceElement) {
    serviceElement.textContent = decodeURIComponent(urlDesc);
    console.log(' Услуга обновлена:', serviceElement.textContent);
  } else {
    console.warn(' Не удалось обновить услугу. urlDesc:', urlDesc, 'serviceElement:', serviceElement);
  }
  
  // Чекбокс сохранения
  if (urlSave === 'true') {
    const consentSave = document.getElementById('consentSave');
    if (consentSave) consentSave.checked = true;
  }
  
  // ============================================
  // 3. ВАЛИДАЦИЯ И СОБЫТИЯ
  // ============================================
  const emailInput = document.getElementById('email');
  const btnSubmit = document.getElementById('btnSubmit');
  const consent152 = document.getElementById('consent152');
  const consentOffer = document.getElementById('consentOffer');
  const consentSave = document.getElementById('consentSave');
  
  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
  
  function checkForm() {
    if (!emailInput || !btnSubmit) return;
    
    const isEmailValid = isValidEmail(emailInput.value.trim());
    const isConsentValid = (consent152 ? consent152.checked : true) && 
                           (consentOffer ? consentOffer.checked : true);
    
    btnSubmit.disabled = !(isEmailValid && isConsentValid);
  }
  
  if (emailInput) emailInput.addEventListener('input', checkForm);
  if (consent152) consent152.addEventListener('change', checkForm);
  if (consentOffer) consentOffer.addEventListener('change', checkForm);
  if (consentSave) consentSave.addEventListener('change', checkForm);
  
  // ============================================
  // 4. ОТПРАВКА ФОРМЫ
  // ============================================
  if (btnSubmit) {
    btnSubmit.addEventListener('click', async (e) => {
      e.preventDefault();
      if (btnSubmit.disabled) return;
      
      // Проверка авторизации
      const currentAuth = window.auth?.getAuth() || {};
      const currentToken = currentAuth.token;
      
      if (!currentToken) {
        console.log('⚠️ Нет токена, редирект на вход');

  const emailInput = document.getElementById('email'); // Это поле на странице payment.html
  if (emailInput && emailInput.value) {
    localStorage.setItem('pending_payment_email', emailInput.value.trim());
  }
  

        const currentUrl = window.location.pathname + window.location.search;
        window.location.href = `auth.html?returnTo=${encodeURIComponent(currentUrl)}`;
        return;
      }
      
      const originalText = btnSubmit.textContent;
      btnSubmit.disabled = true;
      btnSubmit.textContent = 'Подготовка платежа...';
      
      try {
        const res = await fetch(`${API_BASE}/payments/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentToken}`
          },
          body: JSON.stringify({
            provider: 'ЮKassa',
            amount: parseFloat(urlAmount || 1000.00),
            email: emailInput.value.trim(),
            description: urlDesc ? decodeURIComponent(urlDesc) : 'Оплата услуги 1С:Отель',
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
  
  // Инициализация
  checkForm();
  loadRecipientInfo();
  
  // Обработка возврата
  const status = urlParams.get('status');
  if (status === 'success') {
    setTimeout(() => {
      alert('Оплата прошла успешно!');
      localStorage.removeItem('pending_payment');
      window.location.href = 'cards.html';
    }, 500);
  } else if (status === 'fail' || status === 'canceled') {
    alert('Оплата не прошла или была отменена.');
    localStorage.removeItem('pending_payment');
  }
});

// ============================================
// 5. ЗАГРУЗКА ИНН
// ============================================
function loadRecipientInfo() {
  const innElement = document.getElementById('recipientInn');
  if (!innElement) return;
  
  const inn = '532113934079'; 
  if (inn && inn.length === 12) {
    innElement.textContent = inn.replace(/(\d{3})(\d{3})(\d{3})(\d{3})/, '$1-$2-$3-$4');
  }
}
// ============================================
// 6. СОХРАНЯЕМ EMAIL ПЕРЕД РЕДИРЕКТОМ
// ============================================
// В main.js, внутри проверки токена
if (!currentToken) {
  console.log('⚠️ Нет токена, редирект на вход');
  
  //  СОХРАНЯЕМ
  const emailInput = document.getElementById('email');
  if (emailInput && emailInput.value) {
    localStorage.setItem('pending_payment_email', emailInput.value.trim());
  }
  
  const currentUrl = window.location.pathname + window.location.search;
  window.location.href = `auth.html?returnTo=${encodeURIComponent(currentUrl)}`;
  return;
}