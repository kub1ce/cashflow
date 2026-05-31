async function init() {
  /**
   * Главная точка входа. Инициализирует тему, загружает данные, 
   * настраивает UI и позиционирует таблицу на текущей дате.
   */
  const savedAnimations = localStorage.getItem('cashflow-animations');
  applyAnimationsSetting(savedAnimations !== 'false');
  
  const href = window.location.href;
  const savedTheme = localStorage.getItem('cashflow-theme');

  if (href.includes('theme=dark')) {
    applyTheme(true);
  } else if (href.includes('theme=light')) {
    applyTheme(false);
  } else if (savedTheme) {
    applyTheme(savedTheme === 'dark');
  } else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(prefersDark);
  }

  await new Promise(resolve => {
    if (window.pywebview) resolve();
    else window.addEventListener('pywebviewready', resolve, { once: true });
  });

  try {
    await pywebview.api.enable_window_resize();
  } catch (e) {
    console.error('Ошибка включения ресайза:', e);
  }

  const today = getTodayISO();
  const datePicker = document.getElementById('date-picker');
  
  if (datePicker) {
    datePicker.value = today;
    datePicker.addEventListener('change', e => {
      if (e.target.value) scrollToWeek(e.target.value, true);
    });
  }

  await reloadData();

  if (App.data?.settings?.visual_config) {
    const dbAnimations = App.data.settings.visual_config.animations;
    if (dbAnimations !== undefined && dbAnimations !== null) {
      const enabled = dbAnimations !== 'false';
      localStorage.setItem('cashflow-animations', enabled ? 'true' : 'false');
      applyAnimationsSetting(enabled);
    }
  }

  if (App.data?.settings?.visual_config) {
    const dbTheme = App.data.settings.visual_config.theme;
    if (dbTheme) {
      applyTheme(dbTheme === 'dark');
      localStorage.setItem('cashflow-theme', dbTheme); 
    }
  }

  try {
    const acc = await pywebview.api.get_account_name();
    if (acc.success && acc.name) {
      const el = document.getElementById('title-bar-account-name');
      if (el) el.textContent = acc.name;
    }
  } catch (e) {}

  if (App.data && App.data.weeks && App.data.weeks.length > 0) {
    const firstWeek = App.data.weeks[0];
    const lastWeek = App.data.weeks[App.data.weeks.length - 1];
    
    if (today < firstWeek.week_start) {
      showToast('⚠️ Текущая дата раньше начала периода планирования', 'info');
    } else if (today > lastWeek.week_end) {
      showToast('⚠️ Текущая дата позже конца периода планирования', 'info');
    }
  }

  setTimeout(() => scrollToWeek(today), 150);

  document.getElementById('loader').classList.add('hidden');

  initWindowControls();
  initSidebarNavigation();
}

async function reloadData(silent = false) {
  /**
   * Загружает актуальные данные с бэкенда и обновляет стейт.
   * Недели всегда регенерируются с текущей planning_start_date.
   */
  const loader = document.getElementById('loader');
  if (!silent) loader?.classList.remove('hidden');

  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), 10000)
    );

    const settings = await pywebview.api.get_settings();
    
    const weeks = generateWeeks(settings?.planning_start_date, 52);

    const [data, categories, account] = await Promise.race([
      Promise.all([
        pywebview.api.get_cashflow_data(),
        pywebview.api.get_categories(),
        pywebview.api.get_account(),
      ]),
      timeoutPromise
    ]);

    if (data.error) {
      if (!silent) showToast('Ошибка загрузки данных', 'error');
      return;
    }

    App.data = {
      settings: settings,
      weeks: weeks,
      plans: data.plans || {},
      facts: data.facts || {},
      categories: categories,
      account: account,
      initial_balance: account?.initial_balance || 0,
    };

    if (Array.isArray(data.comments)) {
      CellComments = {};
      data.comments.forEach(c => {
        CellComments[`${c.category_id}:${c.week_start_date || c.week_start}`] = c.comment;
      });
    } else {
      CellComments = data.comments || {};
    }

    if (App.activeView === 'dashboard' && !silent) {
      renderTable(App.data);
    }

  } catch (e) {
    if (!silent) showToast('Не удалось загрузить данные.', 'error');
  } finally {
    if (!silent) loader?.classList.add('hidden');
  }
}

function switchView(view) {
  /**
   * Переключает между представлениями (dashboard/settings).
   */
  App.activeView = view;

  document.getElementById('view-dashboard')
    .classList.toggle('hidden', view !== 'dashboard');
  document.getElementById('view-settings')
    .classList.toggle('hidden', view !== 'settings');
  document.getElementById('header-datepicker')
    .classList.toggle('hidden', view !== 'dashboard');

  document.getElementById('view-title').textContent =
    view === 'dashboard' ? 'Таблица планирования' : 'Параметры системы';

  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const navId = view === 'dashboard' ? 'nav-dashboard' : 'nav-settings';
  document.getElementById(navId)?.classList.add('active');

  if (view === 'settings') renderSettingsView();
}

let draggedCatId = null;

function onDragStart(e) {
  /**
   * Инициирует перетаскивание категории.
   */
  draggedCatId = this.dataset.categoryId;
  this.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', draggedCatId);
}

function onDragOver(e) {
  /**
   * Разрешает область для drop.
   */
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

function onDrop(e) {
  /**
   * Переупорядочивает категории при drop.
   */
  e.preventDefault();
  const targetId = this.dataset.categoryId;
  if (!draggedCatId || draggedCatId === targetId) return;

  const draggedCat = App.data.categories.find(c => c.id === parseInt(draggedCatId));
  const targetCat = App.data.categories.find(c => c.id === parseInt(targetId));
  if (!draggedCat || !targetCat || draggedCat.type !== targetCat.type) return;

  const tbody = document.getElementById('table-body');
  const dragged = document.querySelector(`tr[data-category-id="${draggedCatId}"]`);
  const target = document.querySelector(`tr[data-category-id="${targetId}"]`);

  if (!dragged || !target) return;

  const rows = [...tbody.querySelectorAll('tr.row-category')];
  const dIdx = rows.indexOf(dragged);
  const tIdx = rows.indexOf(target);

  if (dIdx < tIdx) {
    target.parentNode.insertBefore(dragged, target.nextSibling);
  } else {
    target.parentNode.insertBefore(dragged, target);
  }
}

async function onDragEnd() {
  /**
   * Сохраняет новый порядок категорий на бэкенде.
   */
  this.classList.remove('dragging');
  draggedCatId = null;

  const allRows = [...document.getElementById('table-body').querySelectorAll('tr.row-category')];
  const orderedIds = allRows.map(r => parseInt(r.dataset.categoryId));

  try {
    await pywebview.api.update_category_order(orderedIds);
    await reloadData();
  } catch (e) {
    console.error('Ошибка сортировки:', e);
  }
}

let _undoInProgress = false;

async function undoLastAction() {
  /**
   * Откатывает последнее действие пользователя, применяя точечное обновление DOM.
   */
  if (_undoInProgress) return;
  if (UndoHistory.isEmpty()) { showToast('Нечего отменять', 'info'); return; }

  _undoInProgress = true;
  closeActiveCellEditor(true);
  const action = UndoHistory.pop();

  try {
    if (action.type === ACTION_TYPES.CELL_EDIT) {
      await undoCellEdit(action);
      _undoPatchCell(action.categoryId, action.weekStart, action.oldValue);

    } else if (action.type === ACTION_TYPES.AUTOFILL) {
      await undoAutofill(action);
      await _undoPatchAutofill(action);

    } else if (action.type === ACTION_TYPES.LOAN_REPAYMENT) {
      await undoLoanRepayment(action);
      await reloadData(true);
      _patchWholeTable();

    } else if (action.type === 'ADD_FACT') {
      for (const fId of action.factIds) {
        await pywebview.api.delete_fact_transaction({ fact_id: fId });
      }
      await reloadData(true);
      _patchFactCell(action);

    } else if (action.type === 'DELETE_FACT') {
      await pywebview.api.add_fact_transaction(action.deletedData);
      await reloadData(true);
      _patchFactCell(action);

    } else if (action.type === 'EDIT_FACT') {
      await pywebview.api.update_fact_transaction({
        fact_id: action.factId,
        amount: action.oldAmount
      });
      await reloadData(true);
      _patchFactCell(action);
    }

    showToast('Действие отменено', 'success');

  } catch (e) {
    showToast('Ошибка при отмене', 'error');
    UndoHistory.push(action);
  } finally {
    _undoInProgress = false;
  }
}

function _undoPatchCell(categoryId, weekStart, oldValue) {
  /**
   * Обновляет одну ячейку плана без ре-рендера всей таблицы.
   */
  const key = `${categoryId}:${weekStart}`;
  if (oldValue === 0) {
    delete App.data.plans[key];
  } else {
    App.data.plans[key] = { amount: oldValue };
  }

  const td = document.querySelector(
    `td[data-category-id="${categoryId}"][data-week-start="${weekStart}"]`
  );
  if (td) {
    refreshCellContent(td, App.data.plans, App.data.facts);
    updateCellCommentIcon(key);
    if (typeof Anim !== 'undefined') Anim.flashCellSaved(td);
  }

  recalcTotalsAndBalance();
}

async function _undoPatchAutofill(action) {
  /**
   * Обновляет ячейки, затронутые автозаполнением, без полного ре-рендера.
   */
  await reloadData(true);

  const { categoryId } = action;
  
  document.querySelectorAll(
    `td.data-cell[data-category-id="${categoryId}"]`
  ).forEach(td => {
    refreshCellContent(td, App.data.plans, App.data.facts);
    const key = `${categoryId}:${td.dataset.weekStart}`;
    updateCellCommentIcon(key);
    if (typeof Anim !== 'undefined') Anim.flashCellSaved(td);
  });

  recalcTotalsAndBalance();
}

function _patchFactCell(action) {
  /**
   * Точечно обновляет ячейку после отмены операции с фактом.
   */
  const catId     = action.categoryId    || action.deletedData?.category_id;
  const weekStart = action.weekStart     || action.deletedData?.week_start;

  if (!catId || !weekStart) {
    _patchWholeTable();
    return;
  }

  const key = `${catId}:${weekStart}`;
  const td  = document.querySelector(
    `td[data-category-id="${catId}"][data-week-start="${weekStart}"]`
  );

  if (td) {
    refreshCellContent(td, App.data.plans, App.data.facts);
    updateCellCommentIcon(key);
    if (typeof Anim !== 'undefined') Anim.flashCellSaved(td);
  }

  recalcTotalsAndBalance();
}

function _patchWholeTable() {
  /**
   * Fallback-функция: обновляет контент всех ячеек без полного ре-рендера DOM.
   */
  document.querySelectorAll('td.data-cell').forEach(td => {
    refreshCellContent(td, App.data.plans, App.data.facts);
  });
  recalcTotalsAndBalance();
  refreshAllCommentIcons();
}

async function undoCellEdit(action) {
  /**
   * Возвращает предыдущее значение отредактированной ячейки на бэкенде.
   */
  const { categoryId, weekStart, weekEnd, mode, oldValue } = action;
  await pywebview.api.save_cell({
    category_id:     categoryId,
    week_start_date: weekStart,
    week_end_date:   weekEnd,
    amount:          oldValue,
    mode,
  });
}

async function undoAutofill(action) {
  /**
   * Откатывает операцию автозаполнения на бэкенде.
   */
  const { categoryId, startDate, mode, count, dayOfMonth } = action;
  await pywebview.api.undo_autofill({
    category_id:  categoryId,
    start_date:   startDate,
    mode,
    count,
    day_of_month: dayOfMonth,
  });
}

async function undoLoanRepayment(action) {
  /**
   * Отменяет займ и запланированные возвраты.
   */
  const { weekStart, weekEnd } = action;
  
  try {
    const result = await pywebview.api.undo_loan_repayment({
      week_start: weekStart,
      week_end:   weekEnd,
    });
    
    if (!result.success) {
      throw new Error(result.error || 'Ошибка отката');
    }
    
    const loanCatId = App.data.categories.find(c => c.name === 'Займ')?.id;
    const returnCatId = App.data.categories.find(c => c.name === 'Возврат займа')?.id;
    
    if (loanCatId) {
      const loanKey = `${loanCatId}:${weekStart}`;
      delete App.data.facts[loanKey];
      delete App.data.plans[loanKey];
    }
    
    if (returnCatId) {
      const returnKey = `${returnCatId}:${weekStart}`;
      delete App.data.facts[returnKey];
      delete App.data.plans[returnKey];
    }
    
  } catch (e) {
    console.error('Ошибка отката займа:', e);
    throw e;
  }
}

// Горячие клавиши и обработчики
window.addEventListener('keydown', (e) => {
  if (!isUndoShortcut(e)) return;
  e.preventDefault();
  e.stopPropagation();
  undoLastAction();
}, true);

window.addEventListener('blur', () => {
  closeActiveCellEditor(true);
});

init();
