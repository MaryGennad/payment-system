//frontend/js/auth.js
const API_BASE = '/api';
// Глобальный объект авторизации
window.auth = {
  saveAuth: (token, user) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  },
  getAuth: () => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    return { token, user: user ? JSON.parse(user) : null };
  },
  clearAuth: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }
};

// Если уже авторизован — редирект на карты
if (window.location.pathname.includes('auth.html') && window.auth.getAuth().token) {
  window.location.href = 'cards.html';
}

// Переключение вкладок — только если элементы есть
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

// Вход — только если форма есть
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      window.auth.saveAuth(data.token, data.user);
      window.location.href = 'cards.html';
    } catch (err) {
      alert(err.message);
    }
  });
}

// Регистрация — только если форма есть
const registerForm = document.getElementById('registerForm');
if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      window.auth.saveAuth(data.token, data.user);
      window.location.href = 'cards.html';
    } catch (err) {
      alert(err.message);
    }
  });
}