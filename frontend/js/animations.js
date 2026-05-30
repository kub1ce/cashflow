let isViewSwitching = false;

const Anim = {
  
  switchView(fromEl, toEl, onMidpoint) {
    /**
     * Плавное переключение между view-панелями.
     */
    return new Promise(resolve => {
      if (!fromEl || !toEl || isViewSwitching) {
        if (!isViewSwitching) onMidpoint?.();
        resolve();
        return;
      }

      if (document.startViewTransition) {
        isViewSwitching = true;
        const transition = document.startViewTransition(() => onMidpoint?.());
        transition.finished.then(() => {
          isViewSwitching = false;
          resolve();
        });
        return;
      }
      
      isViewSwitching = true;
      fromEl.classList.add('view-panel', 'view-exit');
      
      setTimeout(() => {
        fromEl.classList.add('hidden');
        fromEl.classList.remove('view-exit');
        
        onMidpoint?.();
        
        toEl.classList.remove('hidden');
        toEl.classList.add('view-panel', 'view-enter');
        
        setTimeout(() => {
          toEl.classList.remove('view-enter');
          isViewSwitching = false;
          resolve();
        }, 250);
      }, 250);
    });
  },

  showModal(id) {
    /**
     * Показывает модальное окно с анимацией.
     */
    const el = document.getElementById(id);
    if (!el) return;

    el.classList.remove('hidden');
    el.classList.add('flex');
    el.classList.add('modal-overlay');
    
    const content = el.querySelector('.modal-content, [class*="bg-white"], [class*="bg-slate"]');
    if (content) {
      content.classList.add('modal-content');
    }
  },

  hideModal(id) {
    /**
     * Скрывает модальное окно с анимацией.
     */
    const el = document.getElementById(id);
    if (!el) return;

    el.classList.add('closing');
    
    setTimeout(() => {
      el.classList.remove('flex', 'closing');
      el.classList.add('hidden');
      el.classList.remove('modal-overlay');
    }, 150);
  },

  flashCellSaved(td) {
    /**
     * Вспышка при успешном сохранении ячейки.
     */
    if (!td) return;
    td.classList.remove('cell-saved-flash', 'cell-error-flash');
    void td.offsetWidth;
    td.classList.add('cell-saved-flash');
    setTimeout(() => td.classList.remove('cell-saved-flash'), 700);
  },

  flashCellError(td) {
    /**
     * Вспышка при ошибке.
     */
    if (!td) return;
    td.classList.remove('cell-saved-flash', 'cell-error-flash');
    void td.offsetWidth;
    td.classList.add('cell-error-flash');
    setTimeout(() => td.classList.remove('cell-error-flash'), 600);
  },

  shakeEditor() {
    /**
     * Shake анимация редактора при отрицательном значении.
     */
    const editor = document.getElementById('active-cell-editor');
    if (!editor) return;
    editor.classList.remove('editor-shake');
    void editor.offsetWidth;
    editor.classList.add('editor-shake');
    setTimeout(() => editor.classList.remove('editor-shake'), 350);
  },

  animateTableRows(tbody) {
    /**
     * Анимация появления строк таблицы со стагжером.
     */
    if (!tbody) return;

    const rows = tbody.querySelectorAll('tr');
    rows.forEach((row, i) => {
      row.classList.add('row-animate');
      row.style.animationDelay = `${i * 15}ms`;
    });

    setTimeout(() => {
      rows.forEach(row => {
        row.style.animationDelay = '';
        row.classList.remove('row-animate');
      });
    }, (rows.length * 15) + 300);
  },

  animateSettingsItems(container) {
    /**
     * Анимация появления элементов настроек.
     */
    if (!container) return;

    const items = container.querySelectorAll('.settings-cat-item');
    items.forEach((item, i) => {
      item.classList.add('settings-item-animate');
      item.style.animationDelay = `${i * 30}ms`;
    });

    setTimeout(() => {
      items.forEach(item => {
        item.style.animationDelay = '';
        item.classList.remove('settings-item-animate');
      });
    }, items.length * 30 + 400);
  },

  addRipple(btn, event) {
    /**
     * Добавляет ripple эффект к кнопке.
     */
    if (!btn) return;

    const circle = document.createElement('span');
    circle.className = 'ripple-circle';
    
    const rect = btn.getBoundingClientRect();
    circle.style.left = `${event.clientX - rect.left}px`;
    circle.style.top  = `${event.clientY - rect.top}px`;
    
    btn.classList.add('btn-ripple');
    btn.appendChild(circle);
    
    setTimeout(() => circle.remove(), 600);
  },

  animateNumber(el, from, to, duration = 400, formatter = v => v) {
    /**
     * Анимирует изменение числа с easing функцией.
     */
    if (!el) return;
    
    if (Math.abs(to - from) < 0.01) {
      el.textContent = formatter(to);
      return;
    }

    const start = performance.now();
    const diff  = to - from;

    const frame = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      const value = from + diff * ease;

      el.textContent = formatter(value);

      if (progress < 1) {
        requestAnimationFrame(frame);
      } else {
        el.textContent = formatter(to);
      }
    };

    requestAnimationFrame(frame);
  },

  pulseBalanceCell(td) {
    /**
     * Пульс при обновлении баланса.
     */
    if (!td) return;
    const inner = td.querySelector('.balance-cell-inner');
    if (!inner) return;
    
    inner.classList.remove('balance-updating');
    void inner.offsetWidth;
    inner.classList.add('balance-updating');
    setTimeout(() => inner.classList.remove('balance-updating'), 500);
  },

  markDragOver(row, active) {
    /**
     * Включает/отключает визуальный индикатор drag-over.
     */
    if (!row) return;
    row.classList.toggle('drag-over', active);
  },

  spinAutofillBtn(btn, promise) {
    /**
     * Добавляет spin анимацию к кнопке автозаполнения.
     */
    if (!btn) return promise;
    btn.classList.add('svg-spin');
    return promise.finally(() => {
      btn.classList.remove('svg-spin');
    });
  },

  initGuideAccordions() {
    /**
     * Плавная анимация открытия и закрытия гайда с жестким контролем высоты (без прыжков).
     */
    document.querySelectorAll('.settings-section details').forEach(detail => {
      if (detail.dataset.animInitialized) return;
      detail.dataset.animInitialized = 'true';

      const summary = detail.querySelector('summary');
      const content = detail.querySelector('div');
      summary.style.transform = 'translateZ(0)';
      summary.style.backfaceVisibility = 'hidden';

      summary.addEventListener('click', (e) => {
        if (document.body.classList.contains('no-animations')) return;

        e.preventDefault();
        
        if (detail.dataset.isAnimating === 'true') return;
        detail.dataset.isAnimating = 'true';

        const smoothEase = 'cubic-bezier(0.4, 0, 0.2, 1)';

        if (detail.open) {
          const startHeight = detail.getBoundingClientRect().height;
          const targetHeight = summary.getBoundingClientRect().height;
          
          detail.style.height = `${startHeight}px`;
          detail.style.overflow = 'hidden';
          
          content.animate(
            { opacity: [1, 0], transform: ['translateY(0)', 'translateY(-4px)'] },
            { duration: 200, easing: smoothEase }
          );
          
          const heightAnim = detail.animate(
            { height: [`${startHeight}px`, `${targetHeight}px`] },
            { duration: 200, easing: smoothEase }
          );

          heightAnim.onfinish = () => {
            detail.open = false;
            detail.style.height = '';
            detail.style.overflow = '';
            detail.dataset.isAnimating = 'false';
          };
        } else {
          const startHeight = detail.getBoundingClientRect().height;
          
          detail.open = true;
          const targetHeight = detail.getBoundingClientRect().height;
          
          detail.style.height = `${startHeight}px`;
          detail.style.overflow = 'hidden';
          
          content.animate(
            { opacity: [0, 1], transform: ['translateY(8px)', 'translateY(0)'] },
            { duration: 250, easing: smoothEase }
          );
          
          const heightAnim = detail.animate(
            { height: [`${startHeight}px`, `${targetHeight}px`] },
            { duration: 250, easing: smoothEase }
          );

          heightAnim.onfinish = () => {
            detail.style.height = '';
            detail.style.overflow = '';
            detail.dataset.isAnimating = 'false';
          };
        }
      });
    });
  }
}

function initRippleEffect() {
  /**
   * Инициализирует ripple эффект для кнопок.
   */
  document.addEventListener('click', (e) => {
    const btn = e.target.closest(
      '.btn-settings-primary, .btn-settings-secondary, .btn-settings-blue, ' +
      '.cell-editor-confirm, .cell-editor-cancel, .fact-btn-primary'
    );
    if (btn) Anim.addRipple(btn, e);
  });
}

const _originalSwitchView = window.switchView;
window.switchView = function(view) {
  /**
   * Переопределение switchView с анимацией.
   */
  const fromView = App?.activeView;
  if (fromView === view) return;

  const fromEl = document.getElementById(`view-${fromView}`);
  const toEl   = document.getElementById(`view-${view}`);

  Anim.switchView(fromEl, toEl, () => {
    _originalSwitchView(view);
  }).then(() => {
    if (view === 'settings') {
      ['s-income-cats', 's-expense-cats'].forEach(id => {
        Anim.animateSettingsItems(document.getElementById(id));
      });
    }
  });
};

window.showModal = function(id) {
  /**
   * Переопределение showModal с анимацией.
   */
  Anim.showModal(id);
};

window.hideModal = function(id) {
  /**
   * Переопределение hideModal с анимацией.
   */
  Anim.hideModal(id);
};

const _originalRenderTable = window.renderTable;
window.renderTable = function(data) {
  /**
   * Переопределение renderTable со стагжером для строк.
   */
  _originalRenderTable(data);
  
  const tbody = document.getElementById('table-body');
  Anim.animateTableRows(tbody);
};

const _originalSaveCellEditor = window.saveCellEditor;
window.saveCellEditor = async function() {
  /**
   * Переопределение saveCellEditor с flash эффектом.
   */
  const input = document.getElementById('cell-editor-input');
  if (!input) return;

  const amount = window.evalAmount ? window.evalAmount(input.value) : parseFloat(input.value);
  const el = App?.editing?.el;

  if (amount < 0 && el) {
    Anim.shakeEditor();
    Anim.flashCellError(el);
    showToast('Сумма не может быть отрицательной', 'error');
    refreshCellContent(el, App.data.plans, App.data.facts);
    return;
  }

  await _originalSaveCellEditor();

  if (el) {
    Anim.flashCellSaved(el);
  }
};

window.showToast = function(message, type = 'success') {
  /**
   * Улучшенная анимация toast уведомлений.
   */
  const existing = document.getElementById('app-toast');
  if (existing) {
    existing.remove();
  }

  const colors = { success: '#059669', error: '#dc2626', info: '#475569' };
  const icons  = { success: '✓',       error: '✕',       info: 'ℹ' };

  const toast = document.createElement('div');
  toast.id = 'app-toast';
  toast.className = 'app-toast-enter';
  
  toast.style.cssText = `
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 20px;
    border-radius: 10px;
    background: ${colors[type] || colors.info};
    color: white;
    font-size: 13px;
    font-weight: 500;
    font-family: inherit;
    z-index: 9999;
    box-shadow: 0 4px 20px rgba(0,0,0,0.2);
    white-space: nowrap;
    pointer-events: none;
  `;

  toast.innerHTML = `
    <span style="font-weight:700;font-size:15px">${icons[type] || 'ℹ'}</span>
    <span>${message}</span>`;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.remove('app-toast-enter');
    toast.classList.add('app-toast-exit');
    setTimeout(() => toast.remove(), 250);
  }, 3000);
};

const _originalRecalc = window.recalcTotalsAndBalance;
window.recalcTotalsAndBalance = function() {
  /**
   * Переопределение recalcTotalsAndBalance с pulse эффектом на баланс.
   */
  const oldValues = {};
  document.querySelectorAll('.balance-data-cell').forEach(td => {
    const span = td.querySelector('span');
    if (span) {
      oldValues[td.dataset.weekStart] = parseFloat(
        span.textContent.replace(/\s/g, '').replace(',', '.') || '0'
      ) || 0;
    }
  });

  _originalRecalc();

  requestAnimationFrame(() => {
    document.querySelectorAll('.balance-data-cell').forEach(td => {
      const span = td.querySelector('span');
      if (!span) return;
      
      const newVal = parseFloat(
        span.textContent.replace(/\s/g, '').replace(',', '.') || '0'
      ) || 0;
      const oldVal = oldValues[td.dataset.weekStart] || 0;

      if (Math.abs(newVal - oldVal) > 0.01) {
        Anim.pulseBalanceCell(td);
      }
    });
  });
};

let currentDragRow = null;

const _originalOnDragOver = window.onDragOver;
window.onDragOver = function(e) {
  /**
   * Переопределение onDragOver с визуальным индикатором.
   */
  _originalOnDragOver?.call(this, e);
  
  const row = e.target.closest('tr');
  if (!row) return;

  if (row !== currentDragRow) {
    if (currentDragRow) Anim.markDragOver(currentDragRow, false);
    Anim.markDragOver(row, true);
    currentDragRow = row;
  }
};

const _originalOnDrop = window.onDrop;
window.onDrop = function(e) {
  /**
   * Переопределение onDrop с очисткой индикатора.
   */
  if (currentDragRow) {
    Anim.markDragOver(currentDragRow, false);
    currentDragRow = null;
  }
  _originalOnDrop?.call(this, e);
};

const _originalRenderSettingsView = window.renderSettingsView;
window.renderSettingsView = async function() {
  /**
   * Переопределение renderSettingsView со стагжером для элементов.
   */
  await _originalRenderSettingsView();
  
  setTimeout(() => {
    ['s-income-cats', 's-expense-cats'].forEach(id => {
      Anim.animateSettingsItems(document.getElementById(id));
    });

    Anim.initGuideAccordions();

  }, 50);
};

document.addEventListener('DOMContentLoaded', () => {
  initRippleEffect();
});
