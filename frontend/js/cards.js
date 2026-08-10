// ============================================
// ПРОВЕРКА АВТОРИЗАЦИИ
// ============================================
const authData = window.auth?.getAuth() || {};
const token = authData.token;

if (!token) {
  window.location.href = 'auth.html';
}

(function () {
  const auth = window.auth?.getAuth() || {};
  const currentToken = auth.token;

  if (!currentToken) {
    window.location.href = 'auth.html';
    return;
  }

  const API_BASE = window.API_BASE || '/api';
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${currentToken}`,
  };

  // ============================================
  // ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
  // ============================================
  
  // Защита от XSS
  const escape = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  // Единый fetch с обработкой истекшего токена
  async function apiFetch(url, options = {}) {
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      window.auth.clearAuth();
      window.location.href = 'auth.html';
      throw new Error('Сессия истекла. Пожалуйста, войдите снова.');
    }
    return res;
  }

  // Премиальные Toast-уведомления
  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    const isSuccess = type === 'success';
    
    const iconSvg = isSuccess 
      ? `<svg class="icon" style="color:var(--text-primary); width:20px; height:20px;" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`
      : `<svg class="icon" style="color:var(--error); width:20px; height:20px;" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;

    const borderColor = isSuccess ? 'var(--text-primary)' : 'var(--error)';
    const bgColor = isSuccess ? 'var(--bg)' : 'var(--error-bg)';

    toast.style.cssText = `
      position:fixed; top:24px; right:24px; 
      background:${bgColor}; 
      border: 1px solid var(--border);
      border-left: 3px solid ${borderColor};
      color:var(--text-primary); 
      padding:16px 20px; 
      border-radius:8px; 
      box-shadow:var(--shadow-lg); 
      z-index:10000;
      display:flex; align-items:center; gap:12px;
      font-size:14px; font-weight:500;
      opacity:0; transform:translateY(-10px); 
      transition:all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    `;
    
    toast.innerHTML = `${iconSvg}<span>${message}</span>`;
    document.body.appendChild(toast);
    
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    });
    
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      setTimeout(() => toast.remove(), 400);
    }, 3500);
  }

  // Кэш для истории платежей
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
          ? '<span class="badge" style="background:var(--text-primary); color:var(--bg); padding:4px 8px; border-radius:4px; font-size:12px; font-weight:600;">Основная</span>'
          : `<button class="btn-small" data-action="setDefault" data-id="${escape(c._id)}">Сделать основной</button>`;
        
        return `
          <div class="card-item animate-in" style="background:var(--surface); border:1px solid var(--border); padding:20px; border-radius:8px; margin-bottom:16px;">
            <div class="card-info">
              <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">
                <svg class="icon" style="width:24px; height:24px; color:var(--text-secondary);" viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>
                <span style="font-weight:600; letter-spacing:-0.02em; font-size:16px;">•••• ${escape(c.last4)}</span>
              </div>
              <div style="font-size:13px; color:var(--text-secondary); font-weight:400; margin-left: 34px;">
                ${escape(c.cardType || 'Банковская карта')} • ${escape(month)}/${escape(c.expiryYear)}
              </div>
            </div>
            <div class="card-actions" style="display:flex; gap:8px; margin-top:16px; flex-wrap:wrap;">
              ${isDefault}
              <button class="btn-small" data-action="charge" data-id="${escape(c._id)}" style="background:var(--text-primary); color:var(--bg); border:none; padding:8px 16px; border-radius:6px; cursor:pointer; font-weight:500;">Списать 1000 ₽ (3 этапа)</button>
              <button class="btn-small danger" data-action="delete" data-id="${escape(c._id)}" style="background:transparent; color:var(--error); border:1px solid var(--error); padding:8px 16px; border-radius:6px; cursor:pointer; font-weight:500; display:flex; align-items:center;">
                <svg class="icon" style="width:16px; height:16px; margin-right:6px;" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                Удалить
              </button>
            </div>
          </div>`;
      }).join('');
    } catch (err) {
      console.error('Load cards error:', err);
      showToast(err.message, 'error');
    }
  }

  // Делегирование событий для кнопок
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    
    const id = btn.dataset.id;
    const action = btn.dataset.action;

    if (action === 'setDefault') window.setDefault(id);
    if (action === 'charge') window.chargeSavedCard(id, 1000, 3); // 🔥 ИСПРАВЛЕНО: теперь по умолчанию 3 этапа
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
      statsDiv.style.cssText = 'background:var(--surface); border:1px solid var(--border); padding:24px 32px; border-radius:8px; margin-bottom:24px; text-align:center;';
      statsDiv.innerHTML = `
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:24px;">
          <div>
            <div style="font-size:32px; font-weight:600; color:var(--text-primary); letter-spacing:-0.04em;">${successCount}</div>
            <div style="color:var(--text-secondary); font-size:13px; text-transform:uppercase; letter-spacing:0.05em; margin-top:4px;">Успешных платежей</div>
          </div>
          <div>
            <div style="font-size:32px; font-weight:600; color:var(--text-primary); letter-spacing:-0.04em;">${totalAmount} ₽</div>
            <div style="color:var(--text-secondary); font-size:13px; text-transform:uppercase; letter-spacing:0.05em; margin-top:4px;">Всего списано</div>
          </div>
        </div>`;

      const cardsList = document.getElementById('cardsList');
      if (cardsList) cardsList.parentNode.insertBefore(statsDiv, cardsList);
    } catch (err) {
      console.error('Update stats error:', err);
    }
  }

  // ============================================
  // ИСТОРИЯ ПЛАТЕЖЕЙ
  // ============================================
  async function loadPaymentHistory() {
    try {
      const payments = await getPaymentHistory();
      const historyDiv = document.getElementById('paymentHistory');
      if (!historyDiv) return;

      if (!payments.length) {
        historyDiv.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding: 40px 0; font-size:14px;">История операций пуста</p>';
        return;
      }

      historyDiv.innerHTML = `
        <h3 style="margin-bottom:20px; font-size:15px; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-muted);">История операций</h3>
        <div style="display:flex; flex-direction:column; gap:12px;">
          ${payments.map(p => {
            const isSucceeded = p.status === 'succeeded';
            const isRefunded = p.status === 'refunded';
            
            let statusColor = 'var(--text-muted)';
            let statusText = 'В обработке';
            
            if (isSucceeded) { statusColor = 'var(--text-primary)'; statusText = 'Успешно'; }
            if (isRefunded) { statusColor = 'var(--text-muted)'; statusText = 'Возвращено'; }
            if (p.status === 'failed' || p.status === 'canceled') { statusColor = 'var(--error)'; statusText = 'Отменено'; }

            const refundButton = isSucceeded ? `
              <button class="btn-small" style="margin-top:16px; width:100%; background:transparent; color:var(--text-secondary); border:1px solid var(--border); padding:8px; border-radius:6px; cursor:pointer;" 
                onclick="window.requestRefund('${escape(p._id)}', ${p.amount})">
                Оформить возврат
              </button>
            ` : '';

            // 🔥 ИСПРАВЛЕНА ВЕРСТКА И СИНТАКСИС ШАБЛОННОЙ СТРОКИ ЗДЕСЬ:
            return `
              <div style="background:var(--bg); border:1px solid var(--border); padding:20px; border-radius:8px; transition: border-color 0.3s ease;" onmouseover="this.style.borderColor='var(--border-hover)'" onmouseout="this.style.borderColor='var(--border)'">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                  <span style="font-weight:600; font-size:16px; letter-spacing:-0.02em; color:var(--text-primary);">${escape(p.amount)} ₽</span>
                  <span style="color:${statusColor}; font-size:13px; font-weight:500; text-transform:uppercase; letter-spacing:0.05em;">${statusText}</span>
                </div>
                <div style="display:flex; flex-direction:column; gap:8px; font-size:13px; color:var(--text-secondary);">
                  <div style="display:flex; align-items:center; gap:8px;">
                    <svg class="icon" style="width:16px; height:16px;" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    ${new Date(p.createdAt).toLocaleDateString('ru-RU')} в ${new Date(p.createdAt).toLocaleTimeString('ru-RU', {hour: '2-digit', minute:'2-digit'})}
                  </div>
                  <div style="display:flex; align-items:center; gap:8px;">
                    <svg class="icon" style="width:16px; height:16px;" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                    ${escape(p.description || 'Платеж')}
                  </div>
                  ${p.recurringInfo?.isRecurring ? `
                    <div style="margin-top:4px; font-size:12px; color:var(--text-primary); font-weight: 600; background: var(--surface); padding: 4px 8px; border-radius: 4px; display: inline-block; width: fit-content; border: 1px solid var(--border);">
                      Этап ${p.recurringInfo.currentStage} из ${p.recurringInfo.totalStages}
                    </div>
                  ` : ''}
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
      showToast('Карта успешно назначена основной');
      await loadCards();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  window.deleteCard = async (cardId) => {
    if (!confirm('Вы уверены, что хотите удалить эту карту? Это действие нельзя отменить.')) return;
    try {
      const res = await apiFetch(`${API_BASE}/cards/${cardId}`, { method: 'DELETE' });
      const data = res.ok ? await res.json().catch(() => ({})) : {};
      if (!res.ok) throw new Error(data.error || 'Ошибка удаления');
      showToast('Карта успешно удалена');
      await loadCards();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  window.chargeSavedCard = async (cardId, amount = 1000, totalStages = 3) => {
    if (!confirm(`Подтвердите рекуррентное списание: ${amount} ₽ × ${totalStages} раз (Итого: ${amount * totalStages} ₽).`)) return;

    try {
      const progressDiv = document.createElement('div');
      progressDiv.id = 'chargeProgress';
      progressDiv.style.cssText = `position:fixed; top:24px; right:24px; background:var(--bg); border:1px solid var(--border); color:var(--text-primary); padding:20px; border-radius:8px; box-shadow:var(--shadow-lg); z-index:10000; min-width:260px; font-size:14px;`;
      progressDiv.innerHTML = `
        <div style="font-weight:600; margin-bottom:12px; text-transform:uppercase; letter-spacing:0.05em; font-size:12px; color:var(--text-muted);">Выполнение списаний</div>
        <div id="chargeStatus" style="margin-bottom:12px;">Подготовка...</div>
        <div style="background:var(--border); height:4px; border-radius:2px; overflow:hidden;">
          <div id="chargeProgressBar" style="background:var(--text-primary); height:100%; width:0%; transition:width 0.3s ease;"></div>
        </div>`;
      document.body.appendChild(progressDiv);

      const statusDiv = document.getElementById('chargeStatus');
      const progressBar = document.getElementById('chargeProgressBar');
      let successCount = 0;
      let failCount = 0;

      for (let stage = 1; stage <= totalStages; stage++) {
        statusDiv.textContent = `Обработка этапа ${stage} из ${totalStages}...`;
        progressBar.style.width = `${((stage - 1) / totalStages) * 100}%`;

        try {
          const currentAuth = window.auth?.getAuth() || {};
          const res = await fetch(`${API_BASE}/payments/charge-saved`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${currentAuth.token}`
            },
            body: JSON.stringify({ 
              cardId, 
              amount, 
              email: currentAuth.user?.email || 'user@example.com', 
              description: `Рекуррентный платеж (этап ${stage} из ${totalStages})`,
              stageNumber: stage,
              totalStages: totalStages
            })
          });

          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Ошибка списания');
          
          successCount++;
        } catch (err) {
          failCount++;
          console.error(`Charge stage ${stage} failed:`, err);
        }

        progressBar.style.width = `${(stage / totalStages) * 100}%`;
      }

      statusDiv.textContent = `Завершено: успешно ${successCount} из ${totalStages}`;
      setTimeout(() => progressDiv.remove(), 3000);
      
      if (successCount > 0) {
        showToast(`Успешно списано ${successCount} этапов из ${totalStages}`);
        historyCache = null;
        await loadPaymentHistory();
        await updateStats();
      } else {
        showToast('Все попытки списания завершились ошибкой', 'error');
      }

    } catch (err) {
      showToast(err.message, 'error');
      const progressDiv = document.getElementById('chargeProgress');
      if (progressDiv) progressDiv.remove();
    }
  };

  window.requestRefund = async (paymentId, amount) => {
    if (!confirm(`Вы уверены, что хотите оформить возврат на сумму ${amount} ₽?`)) return;

    try {
      const res = await apiFetch(`${API_BASE}/payments/refund`, {
        method: 'POST',
        body: JSON.stringify({ paymentId })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка оформления возврата');

      showToast('Возврат успешно инициирован');
      historyCache = null; // Сброс кэша
      await loadPaymentHistory();
      await updateStats();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // ============================================
  // ИНИЦИАЛИЗАЦИЯ
  // ============================================
  document.addEventListener('DOMContentLoaded', () => {
    loadCards();
    updateStats();
    loadPaymentHistory();
  });

})();