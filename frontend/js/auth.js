const API_BASE = '/api';

// ============================================
// ГЛОБАЛЬНЫЙ ОБЪЕКТ АВТОРИЗАЦИИ
// ============================================
window.auth = {
  saveAuth: (token, user) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  },
  getAuth: () => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    return { 
      token, 
      user: userStr ? JSON.parse(userStr) : null 
    };
  },
  clearAuth: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }
};

// ============================================
// АВТОРЕДИРЕКТ: Если уже авторизован, кидаем в КАТАЛОГ УСЛУГ
// ============================================
if (window.location.pathname.includes('auth.html') && window.auth.getAuth().token) {
  window.location.href = 'services.html';
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
// ВХОД В АККАУНТ
// ============================================
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const submitBtn = loginForm.querySelector('button[type="submit"]');

    try {
      // Блокируем кнопку, чтобы избежать двойной отправки
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
      if (!res.ok) throw new Error(data.error || 'Ошибка входа');
      
      window.auth.saveAuth(data.token, data.user);
      
      // 🎯 РЕДИРЕКТ НА КАТАЛОГ УСЛУГ
      window.location.href = 'services.html';
      
    } catch (err) {
      alert('❌ ' + err.message);
    } finally {
      // Возвращаем кнопку в исходное состояние
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Войти';
      }
    }
  });
}

// ============================================
// РЕГИСТРАЦИЯ
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
      // Блокируем кнопку, чтобы избежать двойной отправки
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
      if (!res.ok) throw new Error(data.error || 'Ошибка регистрации');
      
      window.auth.saveAuth(data.token, data.user);
      
      // 🎯 РЕДИРЕКТ НА КАТАЛОГ УСЛУГ
      window.location.href = 'services.html';
      
    } catch (err) {
      alert('❌ ' + err.message);
    } finally {
      // Возвращаем кнопку в исходное состояние
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Зарегистрироваться';
      }
    }
  });
}

// ============================================
// ФУНКЦИЯ ВЫХОДА (доступна на всех страницах)
// ============================================
window.logout = function() {
  if (confirm('Выйти из аккаунта?')) {
    window.auth.clearAuth();
    window.location.href = 'auth.html';
  }
};