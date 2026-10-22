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
      window.location.href = 'cards.html';
      throw new Error('Доступ запрещён');
    }
    return res;
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

  // Загрузка данных
  async function loadOverview() {
    try {
      const res = await apiFetch(`${API_BASE}/admin/overview`);
      const data = await res.json();

      document.getElementById('overviewStats').innerHTML = `
        <div class="stat-card">
          <div class="stat-value">${data.totalUsers}</div>
          <div class="stat-label">Пользователей</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${data.totalCards}</div>
          <div class="stat-label">Привязанных карт</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${data.totalPayments}</div>
          <div class="stat-label">Платежей</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${data.totalAmount} ₽</div>
          <div class="stat-label">Всего собрано</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${data.todayPayments}</div>
          <div class="stat-label">Платежей сегодня</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${data.todayAmount} ₽</div>
          <div class="stat-label">Собрано сегодня</div>
        </div>
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
      tbody.innerHTML = cards.map(c => `
        <tr>
          <td>${escape(c.userEmail || '—')}</td>
          <td>•••• ${escape(c.last4)}</td>
          <td>${escape(c.cardType || '—')}</td>
          <td>${String(c.expiryMonth || '').padStart(2,'0')}/${c.expiryYear || '—'}</td>
          <td style="font-size:11px; color:var(--text-secondary);">${escape(c.cardToken || '—')}</td>
        </tr>
      `).join('');
    } catch (err) {
      console.error('Load cards error:', err);
    }
  }

  // Инициализация
  loadOverview();
  loadUsers();
  loadPayments();
  loadCards();
})();