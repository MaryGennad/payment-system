//frontend/js/cards.js
const API_BASE = '/api';  // Относительный путь!
const { token } = window.auth?.getAuth() || {};
if (!token) window.location.href = 'auth.html';

const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

async function loadCards() {
  const res = await fetch(`${API_BASE}/cards`, { headers });
  const cards = await res.json();
  const list = document.getElementById('cardsList');
  const empty = document.getElementById('emptyState');
  
  if (!cards.length) { list.style.display = 'none'; empty.style.display = 'block'; return; }
  
  list.innerHTML = cards.map(c => `
    <div class="card-item">
      <div class="card-info">•••• ${c.last4} | ${c.cardType} ${c.expiryMonth}/${c.expiryYear}</div>
      <div class="card-actions">
        ${!c.isDefault ? `<button class="btn-small" onclick="setDefault('${c._id}')">Основная</button>` : '<span class="badge">Основная</span>'}
        <button class="btn-small danger" onclick="deleteCard('${c._id}')">Удалить</button>
      </div>
    </div>
  `).join('');
}

window.setDefault = async (id) => {
  await fetch(`${API_BASE}/cards/set-default`, { method: 'POST', headers, body: JSON.stringify({ cardId: id }) });
  loadCards();
};

window.deleteCard = async (id) => {
  if (!confirm('Удалить?')) return;
  await fetch(`${API_BASE}/cards/${id}`, { method: 'DELETE', headers });
  loadCards();
};

// Кнопка выхода
document.querySelector('.header-top')?.insertAdjacentHTML('beforeend', 
  `<button onclick="window.auth.clearAuth(); location.href='auth.html'" style="margin-left:auto; background:none; border:none; color:#8b5cf6; cursor:pointer;">🚪 Выйти</button>`
);

loadCards();
