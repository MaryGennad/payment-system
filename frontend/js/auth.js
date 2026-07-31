const API_BASE = '/api';

// ============================================
// ГЛОБАЛЬНЫЙ ОБЪЕКТ АВТОРИЗАЦИИ
// ============================================
window.auth = {
  setAuth: (token, user) => {
    localStorage.setItem('auth', JSON.stringify({ token, user }));
  },
  getAuth: () => {
    const data = localStorage.getItem('auth');
    return data ? JSON.parse(data) : { token: null, user: null };
  },
  clearAuth: () => {
    localStorage.removeItem('auth');
  }
};

// ============================================
// АВТОРЕДИРЕКТ: Если уже авторизован и зашел на auth.html
// ============================================
if (window.location.pathname.includes('auth.html') && window.auth.getAuth().token) {
  const urlParams = new URLSearchParams(window.location.search);
  const returnTo = urlParams.get('returnTo');
  
  if (returnTo) {
    window.location.href = decodeURIComponent(returnTo);
  } else {
    window.location.href = 'cards.html';
  }
}

// ============================================
// ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК (Вход / Регистрация)
// ============================================
const tabBtns = document.querySelectorAll('.tab-btn');
if (tabBtns.length > 0) {
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const tab = btn.dataset.tab;
      const loginForm = document.getElementById('loginForm');
      const registerForm = document.getElementById('registerForm');
      
      if (loginForm && registerForm) {
        loginForm.style.display = tab === 'login' ? 'block' : 'none';
        registerForm.style.display = tab === 'register' ? 'block' : 'none';
      }
    });
  });
}

// ============================================
// ВХОД В АККАУНТ (ИСПРАВЛЕНО: добавлена проверка returnTo)
// ============================================
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const submitBtn = loginForm.querySelector('button[type="submit"]');

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Вход...';
      }

      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Неверный email или пароль');
      
      window.auth.setAuth(data.token, data.user);
      
      // очищаем сразу после успешного входа, чтобы email не "прилипал" к форме входа навсегда, когда пользователь просто захочет войти в аккаунт в другой раз
      localStorage.removeItem('pending_payment_email');

      // ПРОВЕРЯЕМ, КУДА НУЖНО ВЕРНУТЬ ПОЛЬЗОВАТЕЛЯ
      const urlParams = new URLSearchParams(window.location.search);
      const returnTo = urlParams.get('returnTo');
      
      if (returnTo) {
        console.log('🔄 Возврат на страницу оплаты с параметрами:', decodeURIComponent(returnTo));
        window.location.href = decodeURIComponent(returnTo);
      } else {
        window.location.href = 'cards.html';
      }
      
    } catch (err) {
      alert('Ошибка: ' + err.message);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Войти';
      }
    }
  });
}

// ============================================
// РЕГИСТРАЦИЯ (ИСПРАВЛЕНО: добавлена проверка returnTo)
// ============================================
const registerForm = document.getElementById('registerForm');
if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('registerName').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value;
    const submitBtn = registerForm.querySelector('button[type="submit"]');

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Регистрация...';
      }

      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка при создании аккаунта');
      
      window.auth.setAuth(data.token, data.user);
      
      localStorage.removeItem('pending_payment_email');
      // ПРОВЕРЯЕМ, КУДА НУЖНО ВЕРНУТЬ ПОЛЬЗОВАТЕЛЯ
      const urlParams = new URLSearchParams(window.location.search);
      const returnTo = urlParams.get('returnTo');
      
      if (returnTo) {
        console.log('🔄 Возврат на страницу оплаты с параметрами:', decodeURIComponent(returnTo));
        window.location.href = decodeURIComponent(returnTo);
      } else {
        window.location.href = 'cards.html';
      }
      
    } catch (err) {
      alert('Ошибка: ' + err.message);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Зарегистрироваться';
      }
    }
  });
}

// ============================================
// ФУНКЦИЯ ВЫХОДА
// ============================================
window.logout = function() {
  if (confirm('Вы действительно хотите выйти из аккаунта?')) {
    window.auth.clearAuth();
    window.location.href = 'index.html';
  }
};