// Проверка авторизации
const authData = window.auth?.getAuth() || {};
if (!authData.token) {
  window.location.href = 'auth.html?returnTo=' + encodeURIComponent('marks.html');
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

  // Загрузка лимита и истории
  async function loadMarksData() {
    try {
      const res = await apiFetch(`${API_BASE}/marks/check`);
      const data = await res.json();
      
      // Обновляем счётчик лимита
      const limitInfo = document.getElementById('limitInfo');
      if (limitInfo && data.remaining !== undefined) {
        limitInfo.innerHTML = `
          <div style="font-size:32px; font-weight:600;">${data.remaining}</div>
          <div style="color:var(--text-secondary); font-size:13px; text-transform:uppercase; letter-spacing:0.05em; margin-top:4px;">
            из ${data.limit} проверок осталось сегодня
          </div>
          ${data.remaining === 0 ? '<div style="margin-top:12px; color:var(--error); font-size:13px;">Лимит исчерпан. Попробуйте завтра.</div>' : ''}
        `;
      }

      // Обновляем историю
      const historyDiv = document.getElementById('marksHistory');
      if (historyDiv && data.history) {
        if (data.history.length === 0) {
          historyDiv.innerHTML = '<h3 style="margin-bottom:16px; font-size:15px; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-muted);">История проверок</h3><p style="text-align:center; color:var(--text-muted); padding:20px;">Проверок ещё не было</p>';
        } else {
          historyDiv.innerHTML = `
            <h3 style="margin-bottom:16px; font-size:15px; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-muted);">История проверок</h3>
            <div style="display:flex; flex-direction:column; gap:12px;">
              ${data.history.map(m => `
                <div style="background:var(--bg); border:1px solid var(--border); padding:16px; border-radius:8px;">
                  <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                    <span style="font-weight:600; font-size:14px;">${escape(m.code)}</span>
                    <span style="color:${m.status === 'succeeded' ? 'var(--text-primary)' : 'var(--error)'}; font-size:12px; font-weight:500; text-transform:uppercase;">
                      ${m.status === 'succeeded' ? 'Успешно' : 'Ошибка'}
                    </span>
                  </div>
                  <div style="font-size:12px; color:var(--text-secondary);">
                    ${new Date(m.createdAt).toLocaleDateString('ru-RU')} в ${new Date(m.createdAt).toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'})}
                    ${m.productName ? ` • ${escape(m.productName)}` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          `;
        }
      }
    } catch (err) {
      console.error('Load marks error:', err);
    }
  }

  // Обработчик кнопки проверки
  const checkBtn = document.getElementById('checkBtn');
  const markCodeInput = document.getElementById('markCode');
  const resultContainer = document.getElementById('resultContainer');

  if (checkBtn) {
    checkBtn.addEventListener('click', async () => {
      const code = markCodeInput.value.trim();
      if (!code) {
        showToast('Введите код марки', 'error');
        return;
      }

      const confirmed = await showConfirm(
        `Проверить марку "${code}"? Будет списано 1 ₽.`,
        'Проверка марки'
      );
      if (!confirmed) return;

      checkBtn.disabled = true;
      checkBtn.textContent = 'Проверка...';
      resultContainer.innerHTML = '';

      try {
        const res = await apiFetch(`${API_BASE}/marks/check`, {
          method: 'POST',
          body: JSON.stringify({ code })
        });
        const data = await res.json();

        if (!res.ok) {
          resultContainer.innerHTML = `
            <div class="result-box error">
              <div style="font-weight:600; margin-bottom:8px; color:var(--error);">Ошибка проверки</div>
              <div style="font-size:14px;">${escape(data.error || 'Неизвестная ошибка')}</div>
              ${data.remaining !== undefined ? `<div class="limit-badge">Осталось: ${data.remaining} из ${data.limit}</div>` : ''}
            </div>
          `;
          showToast(data.error || 'Ошибка', 'error');
        } else {
          resultContainer.innerHTML = `
            <div class="result-box success">
              <div style="font-weight:600; margin-bottom:12px;">✅ Марка проверена успешно</div>
              <div class="result-row"><span class="result-label">Код:</span><span class="result-value">${escape(data.code)}</span></div>
              <div class="result-row"><span class="result-label">Товар:</span><span class="result-value">${escape(data.productName || '—')}</span></div>
              <div class="result-row"><span class="result-label">Производитель:</span><span class="result-value">${escape(data.manufacturer || '—')}</span></div>
              <div class="result-row"><span class="result-label">Статус:</span><span class="result-value" style="color:green;">${escape(data.status || 'Легальный')}</span></div>
              <div class="result-row"><span class="result-label">Списано:</span><span class="result-value">1 ₽</span></div>
              <div class="limit-badge">Осталось проверок сегодня: ${data.remaining} из ${data.limit}</div>
            </div>
          `;
          showToast(`Проверка успешна! Осталось: ${data.remaining}`);
          markCodeInput.value = '';
        }

        await loadMarksData();

      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        checkBtn.disabled = false;
        checkBtn.textContent = 'Проверить марку (1 ₽)';
      }
    });
  }

  // Инициализация
  loadMarksData();
})();