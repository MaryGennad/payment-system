const API_BASE = '/api';

// ============================================
// ГЛОБАЛЬНЫЙ ОБЪЕКТ АВТОРИЗАЦИИ (Единый и правильный)
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
// АВТОРЕДИРЕКТ: Если уже авторизован и зашел на auth.html, кидаем в ЛК
// ============================================
if (window.location.pathname.includes('auth.html') && window.auth.getAuth().token) {
  window.location.href = 'cards.html';
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
      
      // ✅ Сохраняем и сразу редиректим в ЛИЧНЫЙ КАБИНЕТ
      window.auth.setAuth(data.token, data.user);
      window.location.href = 'cards.html';
      
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
      
      // ✅ Сохраняем и сразу редиректим в ЛИЧНЫЙ КАБИНЕТ
      window.auth.setAuth(data.token, data.user);
      window.location.href = 'cards.html';
      
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
    // ✅ После выхода кидаем на главную (каталог), а не на страницу входа
    window.location.href = 'index.html';
  }
};