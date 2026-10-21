// ============================================
// УНИВЕРСАЛЬНЫЕ УТИЛИТЫ
// ============================================

// Современная функция подтверждения через <dialog>
window.showConfirm = function(message, title = 'Подтверждение', isDanger = false) {
  return new Promise((resolve) => {
    const dialog = document.getElementById('confirmDialog');
    const titleEl = document.getElementById('confirmTitle');
    const messageEl = document.getElementById('confirmMessage');
    const okBtn = document.getElementById('confirmOk');
    const cancelBtn = document.getElementById('confirmCancel');

    if (!dialog || !okBtn || !cancelBtn) {
      console.error('Диалог подтверждения не найден в DOM');
      // Фоллбэк на нативный confirm, если диалога нет
      resolve(window.confirm(message));
      return;
    }

    titleEl.textContent = title;
    messageEl.textContent = message;
    okBtn.textContent = isDanger ? 'Удалить' : 'Подтвердить';

    // Клонируем кнопки, чтобы убрать старые обработчики
    const newOkBtn = okBtn.cloneNode(true);
    const newCancelBtn = cancelBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOkBtn, okBtn);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

    const handleOk = () => {
      dialog.close();
      resolve(true);
    };

    const handleCancel = () => {
      dialog.close();
      resolve(false);
    };

    newOkBtn.addEventListener('click', handleOk);
    newCancelBtn.addEventListener('click', handleCancel);
    
    // Закрытие по клику на фон
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) handleCancel();
    });

    dialog.showModal();
  });
};