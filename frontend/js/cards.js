const { token } = window.auth?.getAuth() || {};// Проверка авторизации
if (!token) {
  window.location.href = 'auth.html';
}

// Заголовки с токеном
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
            ? `<button class="btn-small" onclick="setDefault('${c._id}')">⭐ Основная</button>` 
            : '<span class="badge">⭐ Основная</span>'}
          <button class="btn-small" onclick="chargeSavedCard('${c._id}', 10)">
            💰 Списать 10₽
          </button>
          <button class="btn-small danger" onclick="deleteCard('${c._id}')">
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
    
    alert('Карта установлена как основная!');
    loadCards();
    
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

    alert('Карта удалена!');
    loadCards();
    
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
    alert('Оплата прошла успешно! Карта привязана.');
    localStorage.removeItem('pending_payment');
    loadCards();
  } else if (status === 'fail' || status === 'canceled') {
    alert('Оплата не прошла. Попробуйте ещё раз.');
    localStorage.removeItem('pending_payment');
  }
});

// ============================================
// КНОПКА ВЫХОДА
// ============================================
document.querySelector('.header-top')?.insertAdjacentHTML('beforeend', 
  `<button onclick="window.auth.clearAuth(); location.href='auth.html'" 
    style="margin-left:auto; background:none; border:none; color:#8b5cf6; cursor:pointer; font-weight:bold;">
    🚪 Выйти
  </button>`
);

// Загрузка карт при старте
loadCards();