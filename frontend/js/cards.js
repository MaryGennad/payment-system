// frontend/js/cards.js
(function () {
  const auth = window.auth?.getAuth() || {};
  const token = auth.token;

  if (!token) {
    window.location.href = 'auth.html';
    return;
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  // ============================================
  // ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
  // ============================================
  
  // Защита от XSS
  const escape = s => String(s ?? '')
    .replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  // Единый fetch с обработкой 401 (истёкший токен)
  async function apiFetch(url, options = {}) {
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      window.location.href = 'auth.html';
      throw new Error('Сессия истекла');
    }
    return res;
  }

  // Красивые уведомления (вместо alert)
  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position:fixed; top:20px; right:20px;
      background:${type === 'success' ? '#10b981' : '#ef4444'};
      color:white; padding:15px 25px; border-radius:8px;
      box-shadow:0 4px 12px rgba(0,0,0,0.3); z-index:10000;
      opacity:0; transform:translateX(20px); transition:all 0.3s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(0)';
    });
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(20px)';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // Кэш для истории платежей (чтобы не делать лишние запросы)
  let historyCache = null;
  async function getPaymentHistory() {
    if (historyCache) return historyCache;
    const res = await apiFetch(`${API_BASE}/payments/history`);
    if (!res.ok) throw new Error('Ошибка загрузки истории');
    historyCache = await res.json();
    return historyCache;
  }

  // ============================================
  // ЗАГРУЗКА СПИСКА КАРТ
  // ============================================
  async function loadCards() {
    try {
      const res = await apiFetch(`${API_BASE}/cards`);
      if (!res.ok) throw new Error('Ошибка загрузки карт');

      const cards = await res.json();
      const list = document.getElementById('cardsList');
      const empty = document.getElementById('emptyState');
      
      if (!list || !empty) return;

      if (!cards || !cards.length) {
        list.style.display = 'none';
        empty.style.display = 'block';
        return;
      }

      list.style.display = 'block';
      empty.style.display = 'none';

      list.innerHTML = cards.map(c => {
        const month = String(c.expiryMonth ?? '').padStart(2, '0');
        const isDefault = c.isDefault 
          ? '<span class="badge">Основная</span>'
          : `<button class="btn-small" data-action="setDefault" data-id="${escape(c._id)}">Основная</button>`;
        
        // ИСПРАВЛЕНО: 1 рубль, 3 раза (итого 3₽)
        return `
          <div class="card-item">
            <div class="card-info">
              💳 •••• ${escape(c.last4)} | ${escape(c.cardType)} ${escape(month)}/${escape(c.expiryYear)}
            </div>
            <div class="card-actions">
              ${isDefault}
              <button class="btn-small" data-action="charge" data-id="${escape(c._id)}">Списать 3₽</button>
              <button class="btn-small danger" data-action="delete" data-id="${escape(c._id)}">🗑️ Удалить</button>
            </div>
          </div>`;
      }).join('');
    } catch (err) {
      console.error('Load cards error:', err);
      showToast('❌ ' + err.message, 'error');
    }
  }

  // Делегирование событий (вместо onclick в HTML)
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;

    if (action === 'setDefault') window.setDefault(id);
    if (action === 'charge') window.chargeSavedCard(id, 1, 3); // 1₽, 3 раза
    if (action === 'delete') window.deleteCard(id);
  });

  // ============================================
  // СТАТИСТИКА
  // ============================================
  async function updateStats() {
    try {
      const payments = await getPaymentHistory();
      const succeeded = payments.filter(p => p.status === 'succeeded');
      const successCount = succeeded.length;
      const totalAmount = succeeded.reduce((sum, p) => sum + Number(p.amount || 0), 0);

      const existing = document.getElementById('paymentStats');
      if (existing) existing.remove();

      const statsDiv = document.createElement('div');
      statsDiv.id = 'paymentStats';
      statsDiv.style.cssText = 'background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:20px;border-radius:12px;margin-bottom:20px;text-align:center;';
      statsDiv.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;">
          <div>
            <div style="font-size:32px;font-weight:bold;color:white;">${successCount}</div>
            <div style="color:#e0e7ff;font-size:14px;">✅ Успешных платежей</div>
          </div>
          <div>
            <div style="font-size:32px;font-weight:bold;color:white;">${totalAmount} ₽</div>
            <div style="color:#e0e7ff;font-size:14px;">💰 Всего списано</div>
          </div>
        </div>`;

      const cardsList = document.getElementById('cardsList');
      if (cardsList) cardsList.parentNode.insertBefore(statsDiv, cardsList);
    } catch (err) {
      console.error('Update stats error:', err);
    }
  }

  // ============================================
  // ИСТОРИЯ ПЛАТЕЖЕЙ (с кнопкой возврата)
  // ============================================
  async function loadPaymentHistory() {
    try {
      const payments = await getPaymentHistory();
      const historyDiv = document.getElementById('paymentHistory');
      if (!historyDiv) return;

      if (!payments.length) {
        historyDiv.innerHTML = '<p style="text-align:center;color:#888;">Нет платежей</p>';
        return;
      }

      historyDiv.innerHTML = `
        <h3 style="margin-bottom:15px;">📊 История платежей</h3>
        <div style="max-height:400px;overflow-y:auto;">
          ${payments.map(p => {
            const isSucceeded = p.status === 'succeeded';
            const isRefunded = p.status === 'refunded';
            
            let statusColor = '#f59e0b';
            let statusText = '⏳ В обработке';
            
            if (isSucceeded) { statusColor = '#10b981'; statusText = '✅ Успешно'; }
            if (isRefunded) { statusColor = '#6b7280'; statusText = '🔄 Возвращено'; }
            if (p.status === 'failed' || p.status === 'canceled') { statusColor = '#ef4444'; statusText = '❌ Отменено'; }

            const refundButton = isSucceeded ? `
              <button class="btn-small" style="margin-top:8px; background:#f3f4f6; color:#374151; border:1px solid #d1d5db; width:100%;" 
                onclick="window.requestRefund('${escape(p._id)}', ${p.amount})">
                🔄 Вернуть средства
              </button>
            ` : '';

            return `
              <div style="background:#1e293b;padding:12px;margin-bottom:10px;border-radius:8px;border-left:4px solid ${statusColor}">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <span style="font-weight:600;">💰 ${escape(p.amount)} ₽</span>
                  <span style="color:${statusColor}; font-size:13px; font-weight:600;">${statusText}</span>
                </div>
                <div style="font-size:12px;color:#888;margin-top:5px;">
                  📅 ${new Date(p.createdAt).toLocaleString('ru-RU')}
                </div>
                <div style="font-size:12px;color:#888;">
                  🏦 ${escape(p.provider)} | ${escape(p.description || 'Платеж')}
                </div>
                ${refundButton}
              </div>`;
          }).join('')}
        </div>`;
    } catch (err) {
      console.error('Load history error:', err);
    }
  }

  // ============================================
  // ГЛОБАЛЬНЫЕ ДЕЙСТВИЯ
  // ============================================
  
  window.setDefault = async (cardId) => {
    try {
      const res = await apiFetch(`${API_BASE}/cards/set-default`, {
        method: 'POST',
        body: JSON.stringify({ cardId }),
      });
      if (!res.ok) throw new Error('Ошибка установки основной карты');
      showToast('✅ Карта установлена как основная!');
      await loadCards();
    } catch (err) {
      showToast('❌ ' + err.message, 'error');
    }
  };

  window.deleteCard = async (cardId) => {
    if (!confirm('🗑️ Удалить эту карту? Это действие нельзя отменить.')) return;
    try {
      const res = await apiFetch(`${API_BASE}/cards/${cardId}`, { method: 'DELETE' });
      const data = res.ok ? await res.json().catch(() => ({})) : {};
      if (!res.ok) throw new Error(data.error || 'Ошибка удаления');
      showToast('✅ Карта удалена!');
      await loadCards();
    } catch (err) {
      showToast('❌ ' + err.message, 'error');
    }
  };

  window.chargeSavedCard = async (cardId, amount = 1, count = 10) => {
    if (!confirm(`💳 Списать ${amount}₽ × ${count} раз (всего ${amount * count}₽)?`)) return;

    try {
      const progressDiv = document.createElement('div');
      progressDiv.id = 'chargeProgress';
      progressDiv.style.cssText = `position:fixed; top:80px; right:20px; background:#1e293b; color:white; padding:20px; border-radius:12px; box-shadow:0 4px 12px rgba(0,0,0,0.5); z-index:10000; min-width:250px;`;
      progressDiv.innerHTML = `
        <div style="font-weight:bold; margin-bottom:10px;">⚡ Рекуррентные списания</div>
        <div id="chargeStatus">Подготовка...</div>
        <div style="margin-top:10px; background:#334155; height:8px; border-radius:4px; overflow:hidden;">
          <div id="chargeProgressBar" style="background:#10b981; height:100%; width:0%; transition:width 0.3s;"></div>
        </div>`;
      document.body.appendChild(progressDiv);

      const statusDiv = document.getElementById('chargeStatus');
      const progressBar = document.getElementById('chargeProgressBar');
      let successCount = 0;
      let failCount = 0;

      for (let i = 1; i <= count; i++) {
        statusDiv.textContent = `Списание ${i}/${count}...`;
        progressBar.style.width = `${((i - 1) / count) * 100}%`;

        try {
          const res = await apiFetch(`${API_BASE}/payments/charge-saved`, {
            method: 'POST',
            body: JSON.stringify({ cardId, amount, email: 'user@example.com', description: `Рекуррентный платёж ${i}/${count}` })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Ошибка списания');

          successCount++;
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (err) {
          failCount++;
          if (err.message.includes('Сессия истекла')) throw err;
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      progressBar.style.width = '100%';
      statusDiv.innerHTML = `<div style="margin-top:10px;">✅ Успешно: ${successCount}<br>❌ Ошибок: ${failCount}<br>💰 Всего: ${successCount * amount}₽</div>`;
      
      setTimeout(() => {
        progressDiv.remove();
        historyCache = null;
        window.location.reload();
      }, 3000);

    } catch (err) {
      showToast('❌ ' + err.message, 'error');
      const progressDiv = document.getElementById('chargeProgress');
      if (progressDiv) progressDiv.remove();
    }
  };

  window.requestRefund = async (paymentId, amount) => {
    if (!confirm(`Вы уверены, что хотите оформить возврат ${amount}₽?\n\nДеньги вернутся на карту в течение 1-3 рабочих дней.`)) return;

    try {
      const res = await apiFetch(`${API_BASE}/payments/refund`, {
        method: 'POST',
        body: JSON.stringify({ paymentId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка оформления возврата');

      showToast(`✅ Возврат ${amount}₽ успешно инициирован!`);
      historyCache = null;
      setTimeout(() => loadPaymentHistory(), 1000);
    } catch (err) {
      showToast('❌ ' + err.message, 'error');
    }
  };

  // ============================================
  // ЕДИНАЯ ТОЧКА ВХОДА (DOMContentLoaded)
  // ============================================
  window.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get('status');
    
    if (status === 'success') {
      showToast('✅ Оплата прошла успешно! Карта привязана.');
      localStorage.removeItem('pending_payment');
    } else if (status === 'fail' || status === 'canceled') {
      showToast('❌ Оплата не прошла. Попробуйте ещё раз.', 'error');
      localStorage.removeItem('pending_payment');
    }
    
    // Запускаем все загрузки параллельно для скорости
    await Promise.all([
      loadCards(),
      updateStats(),
      loadPaymentHistory()
    ]);
  });

})();