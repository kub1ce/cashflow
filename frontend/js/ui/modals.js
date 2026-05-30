function showConfirm(title, subtitle = '') {
  /**
   * Показывает кастомное диалоговое окно подтверждения и возвращает Promise.
   */
  return new Promise(resolve => {
    document.getElementById('confirm-title').textContent    = title;
    document.getElementById('confirm-subtitle').textContent = subtitle;
    showModal('confirm-dialog');

    const ok     = document.getElementById('confirm-ok');
    const cancel = document.getElementById('confirm-cancel');

    if (title.includes('Удалить')) {
      ok.textContent = 'Удалить';
      ok.style.background = '#ef4444';
    } else if (title.includes('Импортировать')) {
      ok.textContent = 'Импортировать';
      ok.style.background = '#3b82f6';
    } else {
      ok.textContent = 'Подтвердить';
      ok.style.background = '#ef4444';
    }

    const cleanup = () => {
      hideModal('confirm-dialog');
      ok.replaceWith(ok.cloneNode(true));
      cancel.replaceWith(cancel.cloneNode(true));
    };

    document.getElementById('confirm-ok').addEventListener('click', () => {
      cleanup(); resolve(true);
    }, { once: true });

    document.getElementById('confirm-cancel').addEventListener('click', () => {
      cleanup(); resolve(false);
    }, { once: true });
  });
}

window.showModal = function(id) {
  /**
   * Отображает модальное окно по его ID.
   */
  const el = document.getElementById(id);
  if (!el) return;

  el.classList.remove('hidden');
  el.classList.add('flex');
}

window.hideModal = function(id) {
  /**
   * Скрывает модальное окно по его ID.
   */
  const el = document.getElementById(id);
  if (!el) return;

  el.classList.remove('flex');
  el.classList.add('hidden');
}

window.showToast = function(message, type = 'success') {
  /**
   * Показывает всплывающее уведомление (toast) внизу экрана.
   */
  const existing = document.getElementById('app-toast');
  if (existing) existing.remove();

  const colors = { success: '#059669', error: '#dc2626', info: '#475569' };
  const icons  = { success: '✓',       error: '✕',       info: 'ℹ' };

  const toast = document.createElement('div');
  toast.id = 'app-toast';
  toast.style.cssText = `
    position: fixed; bottom: 24px; left: 50%;
    transform: translateX(-50%) translateY(20px);
    display: flex; align-items: center; gap: 10px;
    padding: 12px 20px; border-radius: 10px;
    background: ${colors[type] || colors.info};
    color: white; font-size: 13px; font-weight: 500;
    font-family: inherit; z-index: 9999;
    opacity: 0; transition: opacity 0.25s ease, transform 0.25s ease;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15); white-space: nowrap;
    pointer-events: none;`;
  toast.innerHTML = `
    <span style="font-weight:700">${icons[type] || 'ℹ'}</span>
    <span>${message}</span>`;

  document.body.appendChild(toast);
  requestAnimationFrame(() => {
    toast.style.opacity   = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
  });
  setTimeout(() => {
    toast.style.opacity   = '0';
    toast.style.transform = 'translateX(-50%) translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}