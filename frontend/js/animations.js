// ══════════════════════════════════════════════════════════════
// ANIMATIONS MODULE
// ══════════════════════════════════════════════════════════════

const Anim = {

    // ── View Transitions ────────────────────────────────────────
    
    /**
     * Плавное переключение между view-панелями
     */
    switchView(fromEl, toEl, onMidpoint) {
      return new Promise(resolve => {
        if (!fromEl || !toEl) {
          onMidpoint?.();
          resolve();
          return;
        }
  
        // Проверяем, поддерживает ли браузер View Transitions API
        if (document.startViewTransition) {
          const transition = document.startViewTransition(() => {
            onMidpoint?.();
          });
          transition.finished.then(resolve);
          return;
        }
  
        // Fallback: ручная анимация
        fromEl.classList.add('view-panel', 'view-exit');
        
        const duration = 250;
        
        setTimeout(() => {
          fromEl.classList.add('hidden');
          fromEl.classList.remove('view-exit');
          
          onMidpoint?.();
          
          toEl.classList.remove('hidden');
          toEl.classList.add('view-panel', 'view-enter');
          
          setTimeout(() => {
            toEl.classList.remove('view-enter');
            resolve();
          }, duration);
        }, duration);
      });
    },
  
    // ── Modal ───────────────────────────────────────────────────
  
    /**
     * Показ модального окна с анимацией
     */
    showModal(id) {
      const el = document.getElementById(id);
      if (!el) return;
  
      el.classList.remove('hidden');
      el.classList.add('flex');
      
      // Добавляем классы анимации
      el.classList.add('modal-overlay');
      
      const content = el.querySelector('.modal-content, [class*="bg-white"], [class*="bg-slate"]');
      if (content) {
        content.classList.add('modal-content');
      }
    },
  
    /**
     * Скрытие модального окна с анимацией
     */
    hideModal(id) {
      const el = document.getElementById(id);
      if (!el) return;
  
      el.classList.add('closing');
      
      setTimeout(() => {
        el.classList.remove('flex', 'closing');
        el.classList.add('hidden');
        el.classList.remove('modal-overlay');
      }, 200);
    },
  
    // ── Cell Animations ─────────────────────────────────────────
  
    /**
     * Вспышка при успешном сохранении ячейки
     */
    flashCellSaved(td) {
      if (!td) return;
      td.classList.remove('cell-saved-flash', 'cell-error-flash');
      // Форсируем reflow чтобы анимация перезапустилась
      void td.offsetWidth;
      td.classList.add('cell-saved-flash');
      setTimeout(() => td.classList.remove('cell-saved-flash'), 700);
    },
  
    /**
     * Вспышка при ошибке
     */
    flashCellError(td) {
      if (!td) return;
      td.classList.remove('cell-saved-flash', 'cell-error-flash');
      void td.offsetWidth;
      td.classList.add('cell-error-flash');
      setTimeout(() => td.classList.remove('cell-error-flash'), 600);
    },
  
    /**
     * Shake анимация для редактора при вводе отрицательного
     */
    shakeEditor() {
      const editor = document.getElementById('active-cell-editor');
      if (!editor) return;
      editor.classList.remove('editor-shake');
      void editor.offsetWidth;
      editor.classList.add('editor-shake');
      setTimeout(() => editor.classList.remove('editor-shake'), 350);
    },
  
    // ── Table Rows Stagger ──────────────────────────────────────
  
    /**
     * Анимация появления строк таблицы с задержкой (stagger)
     */
    animateTableRows(tbody) {
      if (!tbody) return;
  
      const rows = tbody.querySelectorAll('tr');
      rows.forEach((row, i) => {
        row.classList.add('row-animate');
        // Ограничиваем задержку — чтобы не ждать вечно при 50+ строках
        const delay = Math.min(i * 18, 300);
        row.style.animationDelay = `${delay}ms`;
      });
  
      // Очищаем delay после окончания анимации
      setTimeout(() => {
        rows.forEach(row => {
          row.style.animationDelay = '';
          row.classList.remove('row-animate');
        });
      }, Math.min(rows.length * 18, 300) + 450);
    },
  
    // ── Settings Items Stagger ──────────────────────────────────
  
    /**
     * Анимация появления элементов настроек
     */
    animateSettingsItems(container) {
      if (!container) return;
  
      const items = container.querySelectorAll('.settings-cat-item');
      items.forEach((item, i) => {
        item.style.animationDelay = `${i * 30}ms`;
      });
  
      setTimeout(() => {
        items.forEach(item => {
          item.style.animationDelay = '';
        });
      }, items.length * 30 + 400);
    },
  
    // ── Ripple Effect ───────────────────────────────────────────
  
    /**
     * Добавляет ripple эффект к кнопке
     */
    addRipple(btn, event) {
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
  
    // ── Number Counter ──────────────────────────────────────────
  
    /**
     * Улучшенная анимация числа с поддержкой easing
     */
    animateNumber(el, from, to, duration = 400, formatter = v => v) {
      if (!el) return;
      
      // Не анимируем слишком маленькие изменения
      if (Math.abs(to - from) < 0.01) {
        el.textContent = formatter(to);
        return;
      }
  
      const start = performance.now();
      const diff  = to - from;
  
      const frame = (now) => {
        const progress = Math.min((now - start) / duration, 1);
        // easeOutCubic
        const ease  = 1 - Math.pow(1 - progress, 3);
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
  
    // ── Balance Update ──────────────────────────────────────────
  
    /**
     * Пульс при обновлении баланса
     */
    pulseBalanceCell(td) {
      if (!td) return;
      const inner = td.querySelector('.balance-cell-inner');
      if (!inner) return;
      
      inner.classList.remove('balance-updating');
      void inner.offsetWidth;
      inner.classList.add('balance-updating');
      setTimeout(() => inner.classList.remove('balance-updating'), 500);
    },
  
    // ── Drag Over Indicator ─────────────────────────────────────
  
    markDragOver(row, active) {
      if (!row) return;
      row.classList.toggle('drag-over', active);
    },
  
    // ── Autofill Button Spin ────────────────────────────────────
  
    spinAutofillBtn(btn, promise) {
      if (!btn) return promise;
      btn.classList.add('svg-spin');
      return promise.finally(() => {
        btn.classList.remove('svg-spin');
      });
    }
};
  
  // ══════════════════════════════════════════════════════════════
  // RIPPLE — глобальная инициализация для кнопок
  // ══════════════════════════════════════════════════════════════
  
  function initRippleEffect() {
    // Применяем к кнопкам с классами btn-settings-primary/secondary/blue
    document.addEventListener('click', (e) => {
      const btn = e.target.closest(
        '.btn-settings-primary, .btn-settings-secondary, .btn-settings-blue, ' +
        '.cell-editor-confirm, .cell-editor-cancel'
      );
      if (btn) Anim.addRipple(btn, e);
    });
  }
  
  // ══════════════════════════════════════════════════════════════
  // ПЕРЕОПРЕДЕЛЯЕМ КЛЮЧЕВЫЕ ФУНКЦИИ main.js
  // ══════════════════════════════════════════════════════════════
  
  // ── switchView — с анимацией ────────────────────────────────

const _originalSwitchView = window.switchView;

window.switchView = function(view) {
  // Просто вызываем оригинал — он уже всё делает правильно
  // Добавляем только визуальную анимацию поверх
  
  const fromView = App?.activeView;
  if (fromView === view) return;

  const fromEl = document.getElementById(`view-${fromView}`);
  const toEl   = document.getElementById(`view-${view}`);

  Anim.switchView(fromEl, toEl, () => {
    // В момент переключения (или внутри View Transition) вызываем оригинальную логику
    _originalSwitchView(view);
  }).then(() => {
    // Анимируем элементы настроек после того, как view переключился
    if (view === 'settings') {
      ['s-income-cats', 's-expense-cats'].forEach(id => {
        Anim.animateSettingsItems(document.getElementById(id));
      });
    }
  });
};
  
  // ── showModal / hideModal — с анимацией ─────────────────────
  
  window.showModal = function(id) {
    Anim.showModal(id);
  };
  
  window.hideModal = function(id) {
    Anim.hideModal(id);
  };
  
  // ── renderTable — добавляем stagger ─────────────────────────
  
  const _originalRenderTable = window.renderTable;
  
  window.renderTable = function(data) {
    _originalRenderTable(data);
    
    const tbody = document.getElementById('table-body');
    Anim.animateTableRows(tbody);
  };
  
  // ── saveCellEditor — добавляем flash ────────────────────────
  
  const _originalSaveCellEditor = window.saveCellEditor;
  
  window.saveCellEditor = async function() {
    const input = document.getElementById('cell-editor-input');
    if (!input) return;
  
    const amount = evalAmount(input.value);
    const { el } = App.editing;
  
    // Отрицательное значение — shake + flash error
    if (amount < 0) {
      Anim.shakeEditor();
      Anim.flashCellError(el);
      showToast('Сумма не может быть отрицательной', 'error');
      refreshCellContent(el, App.data.plans, App.data.facts);
      return;
    }
  
    await _originalSaveCellEditor();
  
    // Flash success на ячейке
    if (el) {
      Anim.flashCellSaved(el);
    }
  };
  
  // ── showToast — улучшенная анимация ─────────────────────────
  
  window.showToast = function(message, type = 'success') {
    const existing = document.getElementById('app-toast');
    if (existing) {
      existing.classList.add('app-toast-exit');
      setTimeout(() => existing.remove(), 220);
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
  
  // ── recalcTotalsAndBalance — добавляем pulse на баланс ──────
  
  const _originalRecalc = window.recalcTotalsAndBalance;
  
  window.recalcTotalsAndBalance = function() {
    // Запоминаем старые значения баланса
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
  
    // После пересчёта — pulse на изменившихся ячейках
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
  
  // ── onDragOver — добавляем drag-over indicator ──────────────
  
  const _originalOnDragOver = window.onDragOver;
  window.onDragOver = function(e) {
    _originalOnDragOver?.call(this, e);
    
    // Ищем текущую строку, над которой находится мышь
    const row = e.currentTarget || e.target.closest('tr');
    if (!row) return;

    document.querySelectorAll('.drag-over').forEach(r => {
      if (r !== row) Anim.markDragOver(r, false);
    });
    
    Anim.markDragOver(row, true);
  };

  const _originalOnDrop = window.onDrop;
  window.onDrop = function(e) {
    const row = e.currentTarget || e.target.closest('tr');
    Anim.markDragOver(row, false);
    _originalOnDrop?.call(this, e);
  };
  
  // ── renderSettingsView — анимируем items ────────────────────
  
  const _originalRenderSettingsView = window.renderSettingsView;
  
  window.renderSettingsView = async function() {
    await _originalRenderSettingsView();
    
    setTimeout(() => {
      ['s-income-cats', 's-expense-cats'].forEach(id => {
        Anim.animateSettingsItems(document.getElementById(id));
      });
    }, 50);
  };
  
  // ══════════════════════════════════════════════════════════════
  // ИНИЦИАЛИЗАЦИЯ
  // ══════════════════════════════════════════════════════════════
  
  document.addEventListener('DOMContentLoaded', () => {
    initRippleEffect();
  });

  