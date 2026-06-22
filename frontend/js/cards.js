// frontend/cards.js

// ============================================
// ПРОВЕРКА АВТОРИЗАЦИИ И ИНИЦИАЛИЗАЦИЯ
// ============================================
(function() {
  const auth = window.auth?.getAuth() || {};
  const token = auth.token;
  
  if (!token) {
    window.location.href = 'auth.html';
    return;
  }

  const headers = { 
    'Content-Type': 'application/json', 
    'Authorization': `Bearer ${token}` 
  };

  // ============================================
  // ЗАГРУЗКА СПИСКА КАРТ
  // ============================================
  async function loadCards() {
    try {
      const res = await fetch(`${API_BASE}/cards`, { headers });
      
      if (!res.ok) {
        throw new Error('Ошибка загрузки карт');
      }
      
      const cards = await res.json();
      const list = document.getElementById('cardsList');
      const empty = document.getElementById('emptyState');
      
      if (!list || !empty) {
        console.error('Элементы cardsList или emptyState не найдены');
        return;
      }
      
      if (!cards || !cards.length) {
        list.style.display = 'none';
        empty.style.display = 'block';
        return;
      }
      
      list.style.display = 'block';
      empty.style.display = 'none';
      
      list.innerHTML = cards.map(c => `
        <div class="card-item">
          <div class="card-info">
            💳 •••• ${c.last4} | ${c.cardType} ${c.expiryMonth}/${c.expiryYear}
          </div>
          <div class="card-actions">
            ${!c.isDefault 
              ? `<button class="btn-small" onclick="window.setDefault('${c._id}')"> Основная</button>` 
              : '<span class="badge"> Основная</span>'}
            <button class="btn-small" onclick="window.chargeSavedCard('${c._id}', 10)">
               Списать 10₽
            </button>
            <button class="btn-small danger" onclick="window.deleteCard('${c._id}')">
              🗑️ Удалить
            </button>
          </div>
        </div>
      `).join('');
      
    } catch (err) {
      console.error('Load cards error:', err);
      alert('❌ Ошибка загрузки карт: ' + err.message);
    }
  }
// ============================================
// СЧЁТЧИК УСПЕШНЫХ ОПЕРАЦИЙ
// ============================================
async function updateStats() {
  try {
    const res = await fetch(`${API_BASE}/payments/history`, { headers });
    if (!res.ok) return;
    
    const payments = await res.json();
    const successCount = payments.filter(p => p.status === 'succeeded').length;
    const totalAmount = payments
      .filter(p => p.status === 'succeeded')
      .reduce((sum, p) => sum + p.amount, 0);
    
    // Добавь статистику в начало страницы
    const statsDiv = document.createElement('div');
    statsDiv.id = 'paymentStats';
    statsDiv.style.cssText = 'background:linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding:20px; border-radius:12px; margin-bottom:20px; text-align:center;';
    statsDiv.innerHTML = `
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px;">
        <div>
          <div style="font-size:32px; font-weight:bold; color:white;">${successCount}</div>
          <div style="color:#e0e7ff; font-size:14px;">✅ Успешных платежей</div>
        </div>
        <div>
          <div style="font-size:32px; font-weight:bold; color:white;">${totalAmount} ₽</div>
          <div style="color:#e0e7ff; font-size:14px;">💰 Всего списано</div>
        </div>
      </div>
    `;
    
    // Вставь перед списком карт
    const cardsList = document.getElementById('cardsList');
    if (cardsList && !document.getElementById('paymentStats')) {
      cardsList.parentNode.insertBefore(statsDiv, cardsList);
    }
    
  } catch (err) {
    console.error('Update stats error:', err);
  }
}

// ============================================
// TOAST УВЕДОМЛЕНИЯ
// ============================================
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position:fixed; top:20px; right:20px; 
    background:${type === 'success' ? '#10b981' : '#ef4444'}; 
    color:white; padding:15px 25px; border-radius:8px; 
    box-shadow:0 4px 12px rgba(0,0,0,0.3); z-index:10000;
    animation:slideIn 0.3s ease;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// Используй в функции chargeSavedCard
window.chargeSavedCard = async function(cardId, amount) {
  try {
    // ... существующий код ...
    
    if (!res.ok) {
      throw new Error(data.error || 'Ошибка списания');
    }

    showToast(`✅ Успешно списано ${amount}₽!`, 'success');
    
    setTimeout(() => {
      window.location.reload();
    }, 1000);
    
  } catch (err) {
    showToast(`❌ Ошибка: ${err.message}`, 'error');
  }
};

// Вызови после загрузки
window.addEventListener('DOMContentLoaded', () => {
  // ... существующий код ...
  updateStats();
});

// ============================================
// ЗАГРУЗКА ИСТОРИИ ПЛАТЕЖЕЙ
// ============================================
async function loadPaymentHistory() {
  try {
    const res = await fetch(`${API_BASE}/payments/history`, { headers });
    if (!res.ok) return;
    
    const payments = await res.json();
    const historyDiv = document.getElementById('paymentHistory');
    
    if (!historyDiv) return;
    
    if (!payments.length) {
      historyDiv.innerHTML = '<p style="text-align:center; color:#888;">Нет платежей</p>';
      return;
    }
    
    historyDiv.innerHTML = `
      <h3 style="margin-bottom:15px;">📊 История платежей</h3>
      <div style="max-height:300px; overflow-y:auto;">
        ${payments.map(p => `
          <div style="background:#1e293b; padding:12px; margin-bottom:10px; border-radius:8px; border-left:4px solid ${p.status === 'succeeded' ? '#10b981' : '#f59e0b'}">
            <div style="display:flex; justify-content:space-between;">
              <span style="font-weight:600;">💰 ${p.amount} ₽</span>
              <span style="color:${p.status === 'succeeded' ? '#10b981' : '#f59e0b'}">
                ${p.status === 'succeeded' ? '✅ Успешно' : '⏳ В обработке'}
              </span>
            </div>
            <div style="font-size:12px; color:#888; margin-top:5px;">
              📅 ${new Date(p.createdAt).toLocaleString('ru-RU')}
            </div>
            <div style="font-size:12px; color:#888;">
              🏦 ${p.provider}
            </div>
          </div>
        `).join('')}
      </div>
    `;
    
  } catch (err) {
    console.error('Load history error:', err);
  }
}

// Вызови загрузку истории после загрузки карт
window.addEventListener('DOMContentLoaded', () => {
  // ... существующий код ...
  loadPaymentHistory();
});
  // ============================================
  // СДЕЛАТЬ КАРТУ ОСНОВНОЙ
  // ============================================
  window.setDefault = async (cardId) => {
    try {
      const res = await fetch(`${API_BASE}/cards/set-default`, { 
        method: 'POST', 
        headers, 
        body: JSON.stringify({ cardId }) 
      });
      
      if (!res.ok) {
        throw new Error('Ошибка установки основной карты');
      }
      
      alert('✅ Карта установлена как основная!');
      await loadCards();
      
    } catch (err) {
      console.error('Set default error:', err);
      alert('❌ Ошибка: ' + err.message);
    }
  };

  // ============================================
  // УДАЛЕНИЕ КАРТЫ
  // ============================================
  window.deleteCard = async (cardId) => {
    try {
      const confirmed = confirm('🗑️ Удалить эту карту? Это действие нельзя отменить.');
      if (!confirmed) return;

      const res = await fetch(`${API_BASE}/cards/${cardId}`, { 
        method: 'DELETE', 
        headers 
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Ошибка удаления');
      }

      alert('✅ Карта удалена!');
      await loadCards();
      
    } catch (err) {
      console.error('Delete card error:', err);
      alert('❌ Ошибка: ' + err.message);
    }
  };

  // ============================================
  // ПРОВЕРКА СТАТУСА ОПЛАТЫ ПРИ ЗАГРУЗКЕ
  // ============================================
  window.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get('status');
    
    if (status === 'success') {
      alert('✅ Оплата прошла успешно! Карта привязана.');
      localStorage.removeItem('pending_payment');
      loadCards();
    } else if (status === 'fail' || status === 'canceled') {
      alert('❌ Оплата не прошла. Попробуйте ещё раз.');
      localStorage.removeItem('pending_payment');
    }
    
    // Загрузка карт
    loadCards();
  });

})();