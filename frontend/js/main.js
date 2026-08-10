// ============================================
// 1. ИНИЦИАЛИЗАЦИЯ
// ============================================
document.addEventListener('DOMContentLoaded', function() {
  console.log('main.js запущен (DOMContentLoaded)');
  
  const API_BASE = window.API_BASE || '/api';
  const authData = window.auth?.getAuth() || {};
  const token = authData.token;
  
  console.log('🔑 Токен:', token ? 'ЕСТЬ (авторизован)' : 'НЕТ (гость)');
  
  //   ПРОВЕРЯЕМ, НЕ ВЕРНУЛИСЬ ЛИ МЫ С АВТОРИЗАЦИИ
  const savedAmount = localStorage.getItem('pending_payment_amount');
  const savedDesc = localStorage.getItem('pending_payment_desc');
  const savedSave = localStorage.getItem('pending_payment_save');
  const savedEmail = localStorage.getItem('pending_payment_email'); //   НОВОЕ
  
  if (savedAmount) {
    console.log('Восстановлены параметры платежа из localStorage');
    const newUrl = new URL(window.location);
    newUrl.searchParams.set('amount', savedAmount);
    if (savedDesc) newUrl.searchParams.set('description', savedDesc);
    if (savedSave) newUrl.searchParams.set('save', savedSave);
    window.history.replaceState({}, '', newUrl);
    
    localStorage.removeItem('pending_payment_amount');
    localStorage.removeItem('pending_payment_desc');
    localStorage.removeItem('pending_payment_save');
    localStorage.removeItem('pending_payment_email'); //   Очищаем после использования
  }

  const urlParams = new URLSearchParams(window.location.search);
  const urlAmount = urlParams.get('amount');
  const urlDesc = urlParams.get('description');
  const urlSave = urlParams.get('save'); // 'true' если выбрана рекуррентная оплата
  
  console.log(' Параметры URL:', { amount: urlAmount, desc: urlDesc, save: urlSave });
  
  // ============================================
  // 2. ОБНОВЛЕНИЕ ИНТЕРФЕЙСА
  // ============================================
  const totalElement = document.getElementById('totalAmount');
  const serviceElement = document.getElementById('serviceName');
  const emailInput = document.getElementById('email');
  
  if (urlAmount && totalElement) {
    totalElement.textContent = `${parseFloat(urlAmount).toFixed(2)} ₽`;
  }
  
  if (urlDesc && serviceElement) {
    serviceElement.textContent = decodeURIComponent(urlDesc);
  }
  
  if (urlSave === 'true') {
    const consentSave = document.getElementById('consentSave');
    if (consentSave) consentSave.checked = true;
  }

  //   ВОССТАНАВЛИВАЕМ EMAIL, если пользователь вернулся с регистрации
  if (savedEmail && emailInput) {
    emailInput.value = savedEmail;
    // Триггерим событие input, чтобы сработала валидация и кнопка разблокировалась
    emailInput.dispatchEvent(new Event('input'));
  }
  
  // ============================================
  // 3. ВАЛИДАЦИЯ И СОБЫТИЯ
  // ============================================
  const btnSubmit = document.getElementById('btnSubmit');
  const consent152 = document.getElementById('consent152');
  const consentOffer = document.getElementById('consentOffer');
  
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
  
  // ============================================
  // 4. ОТПРАВКА ФОРМЫ (УМНАЯ ЛОГИКА: ГОСТЬ ИЛИ АВТОРИЗОВАН)
  // ============================================
  if (btnSubmit) {
    btnSubmit.addEventListener('click', async (e) => {
      e.preventDefault();
      if (btnSubmit.disabled) return;
      
      const currentAuth = window.auth?.getAuth() || {};
      const currentToken = currentAuth.token;
      const isRecurring = urlSave === 'true';

      // ЕСЛИ ГОСТЬ, НО ХОЧЕТ СОХРАНИТЬ КАРТУ (РЕКУРРЕНТ) → ПРОСИМ ВОЙТИ
      if (!currentToken && isRecurring) {
        console.log('🚫 Гость хочет рекуррентный платеж. Редирект на вход...');
        
        if (urlAmount) localStorage.setItem('pending_payment_amount', urlAmount);
        if (urlDesc) localStorage.setItem('pending_payment_desc', urlDesc);
        if (urlSave) localStorage.setItem('pending_payment_save', urlSave);
        if (emailInput && emailInput.value) {
          localStorage.setItem('pending_payment_email', emailInput.value.trim());
        }

        const currentUrl = window.location.pathname + window.location.search;
        window.location.href = `auth.html?returnTo=${encodeURIComponent(currentUrl)}`;
        return; // Останавливаем выполнение, ждем входа
      }

      // ЕСЛИ ГОСТЬ ИЛИ АВТОРИЗОВАН, НО ПЛАТЕЖ РАЗОВЫЙ → ПРОДОЛЖАЕМ ОПЛАТУ
      const originalText = btnSubmit.textContent;
      btnSubmit.disabled = true;
      btnSubmit.textContent = 'Подготовка платежа...';
      
      try {
        // Формируем заголовки: добавляем Authorization ТОЛЬКО если есть токен
        const headers = {
          'Content-Type': 'application/json'
        };
        if (currentToken) {
          headers['Authorization'] = `Bearer ${currentToken}`;
        }

        const res = await fetch(`${API_BASE}/payments/create`, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({
            provider: 'yookassa',
            amount: parseFloat(urlAmount || 1000.00),
            email: emailInput.value.trim(),
            description: urlDesc ? decodeURIComponent(urlDesc) : 'Оплата услуги',
            save_payment_method: isRecurring
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
  
  // ============================================
  // 5. ОБРАБОТКА ВОЗВРАТА С ПЛАТЕЖНОГО ШЛЮЗА
  // ============================================
  const status = urlParams.get('status');
  if (status === 'success') {
    setTimeout(() => {
      alert('Оплата прошла успешно! Чек отправлен на ваш email.');
      localStorage.removeItem('pending_payment');
      
      // УМНЫЙ РЕДИРЕКТ: если пользователь авторизован (сохранял карту), 
      // ведем его в кабинет, иначе на главную
      const currentTokenCheck = window.auth?.getAuth()?.token;
      const targetPage = currentTokenCheck ? 'cards.html' : 'index.html';
      
      window.location.href = targetPage; 
    }, 500);
  } else if (status === 'fail' || status === 'canceled') {
    alert('Оплата не прошла или была отменена.');
    localStorage.removeItem('pending_payment');
  }
});

// ============================================
// 6. ЗАГРУЗКА ИНН
// ============================================
function loadRecipientInfo() {
  const innElement = document.getElementById('recipientInn');
  if (!innElement) return;
  
  const inn = '532113934079'; 
  if (inn && inn.length === 12) {
    innElement.textContent = inn.replace(/(\d{3})(\d{3})(\d{3})(\d{3})/, '$1-$2-$3-$4');
  }
}