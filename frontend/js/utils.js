// ============================================
// ГЛОБАЛЬНЫЕ УТИЛИТЫ
// ============================================

// Функция для создания диалога в DOM, если его ещё нет
function ensureConfirmDialogExists() {
  if (document.getElementById('confirmDialog')) return;

  const dialog = document.createElement('dialog');
  dialog.id = 'confirmDialog';
  dialog.className = 'custom-dialog';
  dialog.innerHTML = `
    <div class="dialog-content">
      <div class="dialog-header">
        <h3 class="dialog-title" id="confirmTitle">Подтверждение</h3>
      </div>
      <div class="dialog-body">
        <p id="confirmMessage" class="dialog-text">Вы уверены?</p>
      </div>
      <div class="dialog-footer">
        <button id="confirmCancel" class="btn btn-secondary">Отмена</button>
        <button id="confirmOk" class="btn btn-primary">Подтвердить</button>
      </div>
    </div>
  `;
  document.body.appendChild(dialog);
}

window.showConfirm = function(message, title = 'Подтверждение', isDanger = false) {
  return new Promise((resolve) => {
    // Гарантированно создаём диалог, если его нет
    ensureConfirmDialogExists();

    const dialog = document.getElementById('confirmDialog');
    const titleEl = document.getElementById('confirmTitle');
    const messageEl = document.getElementById('confirmMessage');
    const okBtn = document.getElementById('confirmOk');
    const cancelBtn = document.getElementById('confirmCancel');

    if (!dialog || !okBtn || !cancelBtn) {
      console.warn('Диалог не найден, используем confirm');
      resolve(window.confirm(message));
      return;
    }

    titleEl.textContent = title;
    messageEl.textContent = message;
    okBtn.textContent = isDanger ? 'Удалить' : 'Подтвердить';

    // Клонируем кнопки для очистки старых обработчиков
    const newOkBtn = okBtn.cloneNode(true);
    const newCancelBtn = cancelBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOkBtn, okBtn);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

    const cleanupAndResolve = (value) => {
      if (dialog.open) dialog.close();
      resolve(value);
    };

    const handleOk = () => cleanupAndResolve(true);
    const handleCancel = () => cleanupAndResolve(false);

    newOkBtn.addEventListener('click', handleOk);
    newCancelBtn.addEventListener('click', handleCancel);

    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) handleCancel();
    });

    dialog.showModal();
  });
};