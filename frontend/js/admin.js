// Проверка авторизации
const authData = window.auth?.getAuth() || {};
if (!authData.token) {
  window.location.href = 'auth.html?returnTo=' + encodeURIComponent('admin.html');
}

(function () {
  const API_BASE = window.API_BASE || '/api';
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authData.token}`,
  };

  const escape = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  async function apiFetch(url, options = {}) {
    const res = await fetch(url, { ...options, headers });
    
    if (res.status === 401) {
      window.auth.clearAuth();
      window.location.href = 'auth.html';
      throw new Error('Сессия истекла');
    }
    
    if (res.status === 403) {
      // Бэкенд запретил доступ (не тот email)
      console.warn('Доступ к админ-панели запрещен сервером');
      window.location.href = 'cards.html';
      throw new Error('Доступ запрещён');
    }
    
    return res;
  }

  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    const isSuccess = type === 'success';
    toast.style.cssText = `
      position:fixed; top:24px; right:24px; z-index:10000;
      background:${isSuccess ? 'var(--bg,#fff)' : 'var(--error-bg,#fff5f5)'};
      border:1px solid var(--border,#e5e5e5);
      border-left:3px solid ${isSuccess ? 'var(--text-primary,#1a1a1a)' : 'var(--error,#dc3545)'};
      color:var(--text-primary,#1a1a1a); padding:16px 20px; border-radius:8px;
      box-shadow:0 10px 30px rgba(0,0,0,0.1); font-size:14px; font-weight:500;
      opacity:0; transform:translateY(-10px); transition:all 0.3s;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => { toast.style.opacity = '1'; toast.style.transform = 'translateY(0)'; });
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3500);
  }

  // Переключение вкладок
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });

  async function loadOverview() {
    try {
      const res = await apiFetch(`${API_BASE}/admin/overview`);
      const data = await res.json();
      document.getElementById('overviewStats').innerHTML = `
        <div class="stat-card"><div class="stat-value">${data.totalUsers}</div><div class="stat-label">Пользователей</div></div>
        <div class="stat-card"><div class="stat-value">${data.totalCards}</div><div class="stat-label">Привязанных карт</div></div>
        <div class="stat-card"><div class="stat-value">${data.totalPayments}</div><div class="stat-label">Платежей</div></div>
        <div class="stat-card"><div class="stat-value">${data.totalAmount} ₽</div><div class="stat-label">Всего собрано</div></div>
        <div class="stat-card"><div class="stat-value">${data.todayPayments}</div><div class="stat-label">Платежей сегодня</div></div>
        <div class="stat-card"><div class="stat-value">${data.todayAmount} ₽</div><div class="stat-label">Собрано сегодня</div></div>
      `;
    } catch (err) {
      console.error('Load overview error:', err);
    }
  }

  async function loadUsers() {
    try {
      const res = await apiFetch(`${API_BASE}/admin/users`);
      const users = await res.json();
      const tbody = document.querySelector('#usersTable tbody');
      tbody.innerHTML = users.map(u => `
        <tr>
          <td>${escape(u.email)}</td>
          <td>${escape(u.name || '—')}</td>
          <td>${new Date(u.createdAt).toLocaleDateString('ru-RU')}</td>
          <td>${u.cardsCount || 0}</td>
          <td>${u.paymentsCount || 0}</td>
          <td>${u.totalAmount || 0} ₽</td>
        </tr>
      `).join('');
    } catch (err) {
      console.error('Load users error:', err);
    }
  }

  async function loadPayments() {
    try {
      const res = await apiFetch(`${API_BASE}/admin/payments`);
      const payments = await res.json();
      const tbody = document.querySelector('#paymentsTable tbody');
      tbody.innerHTML = payments.map(p => `
        <tr>
          <td>${new Date(p.createdAt).toLocaleDateString('ru-RU')} ${new Date(p.createdAt).toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'})}</td>
          <td>${escape(p.email || '—')}</td>
          <td>${escape(p.description || '—')}</td>
          <td>${p.amount} ₽</td>
          <td>
            <span class="badge badge-${p.status === 'succeeded' ? 'success' : p.status === 'canceled' ? 'danger' : 'warning'}">
              ${p.status === 'succeeded' ? 'Успешно' : p.status === 'canceled' ? 'Отменён' : p.status}
            </span>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      console.error('Load payments error:', err);
    }
  }

  async function loadCards() {
    try {
      const res = await apiFetch(`${API_BASE}/admin/cards`);
      const cards = await res.json();
      const tbody = document.querySelector('#cardsTable tbody');
      
      const testsRes = await apiFetch(`${API_BASE}/admin/test-status`);
      const activeTests = await testsRes.json();
      
      tbody.innerHTML = cards.map(c => {
        const activeTest = activeTests.find(t => t.cardId === c._id);
        return `
          <tr>
            <td>${escape(c.userEmail || '—')}</td>
            <td>•••• ${escape(c.last4)}</td>
            <td>${escape(c.cardType || '—')}</td>
            <td>${String(c.expiryMonth || '').padStart(2,'0')}/${c.expiryYear || '—'}</td>
            <td style="font-size:11px; color:var(--text-secondary); font-family: monospace;">${c.cardToken ? '••••' + escape(c.cardToken.slice(-4)) : '—'}</td>
            <td>
              ${activeTest ? `
                <span style="color:green; font-size:12px; font-weight:600;">✓ Активен</span><br>
                <span style="color:var(--text-secondary); font-size:11px; display:block; margin: 4px 0;">
                  Осталось: ${activeTest.remaining}/3<br>
                  Следующее: ${new Date(activeTest.nextRun).toLocaleTimeString('ru-RU')}
                </span>
                <button class="btn btn-secondary" onclick="window.stopTest('${c._id}')" style="margin-top:4px; padding:4px 12px; font-size:11px; cursor:pointer;">Остановить</button>
              ` : `
                <button class="btn btn-primary" onclick="window.startTest('${c._id}')" style="padding:6px 16px; font-size:12px; cursor:pointer;">Запустить тест</button>
              `}
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      console.error('Load cards error:', err);
    }
  }

  window.startTest = async (cardId) => {
    const confirmed = await window.showConfirm('Запустить тестовые списания? Будет списано 1 ₽ каждые 60 минут (максимум 3 раз).', 'Запуск теста');
    if (!confirmed) return;
    try {
      const res = await apiFetch(`${API_BASE}/admin/start-test`, { method: 'POST', body: JSON.stringify({ cardId }) });
      if (!res.ok) { const data = await res.json(); throw new Error(data.error || 'Ошибка'); }
      showToast('Тест запущен! Первое списание произойдёт в течение минуты.');
      await loadCards();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  window.stopTest = async (cardId) => {
    const confirmed = await window.showConfirm('Остановить тестовые списания?', 'Остановка теста');
    if (!confirmed) return;
    try {
      const res = await apiFetch(`${API_BASE}/admin/stop-test`, { method: 'POST', body: JSON.stringify({ cardId }) });
      if (!res.ok) throw new Error('Ошибка');
      showToast('Тест остановлен');
      await loadCards();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // ЕДИНАЯ точка инициализации
  loadOverview();
  loadUsers();
  loadPayments();
  loadCards();
})();