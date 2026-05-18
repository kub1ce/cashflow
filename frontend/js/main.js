// ══════════════════════════════════════════════════════════════
// СОСТОЯНИЕ
// ══════════════════════════════════════════════════════════════
const App = {
  data:        null,   // get_cashflow_data()
  activeView: 'dashboard',
  editing: {
    categoryId:  null,
    weekStart:   null,
    weekEnd:     null,
    mode:        'plan',  // 'plan' | 'fact'
    el:          null,    // td элемент
  },
};

const Deficit = {
  weekStart: null,
  weekEnd:   null,
  amount:    0,
  mode:      'single',  // 'single' | 'parts'
};

const Autofill = {
  categoryId: null,
  mode:       'weeks',  // 'weeks' | 'months'
};

// Системные категории — нельзя удалять
const PROTECTED_CATS = [
  'Незапланированные расходы',
  'Незапланированные доходы',
  'Возврат займа',
  'Покрытие из копилки',
  'Займ',
];

// ══════════════════════════════════════════════════════════════
// УТИЛИТЫ
// ══════════════════════════════════════════════════════════════

function formatAmount(value) {
  if (value === null || value === undefined) return '';
  return value.toLocaleString('ru-RU', { minimumFractionDigits: 2 });
}

function getTodayISO() {
  return new Date().toISOString().split('T')[0];
}

function getMondayOf(dateStr) {
  const d   = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return d.toISOString().split('T')[0];
}

function isCurrentWeek(weekStart, weekEnd) {
  const today = getTodayISO();
  return today >= weekStart && today <= weekEnd;
}

function evalAmount(str) {
  try {
    const sanitized = str.replace(/,/g, '.').replace(/[^0-9+\-*/().]/g, '');
    if (!sanitized) return 0;
    return Number(new Function(`return ${sanitized}`)()) || 0;
  } catch {
    return 0;
  }
}

function getVisualConfig() {
  return App.data?.settings?.visual_config || {};
}

function getWeekColor() {
  return getVisualConfig().weekColor || '#3b82f6';
}

function getCurrentWeekColor() {
  return getVisualConfig().currentWeekColor || '#fef08a';
}

function pluralWeeks(n) {
  const m10 = n % 10, m100 = n % 100;
  if (m100 >= 11 && m100 <= 19) return 'недель';
  if (m10 === 1) return 'неделю';
  if (m10 >= 2 && m10 <= 4) return 'недели';
  return 'недель';
}

/**
 * Определяет нужен ли тёмный или светлый текст для заданного цвета фона.
 * Поддерживает и #hex, и rgb(...), и rgba(...)
 */
function getContrastColor(color) {
  if (!color) return '#0f172a';

  let r, g, b;

  // Если цвет в hex формате
  if (color.startsWith('#')) {
    let hex = color.slice(1);
    if (hex.length === 3) {
      hex = hex.split('').map(ch => ch + ch).join('');
    }
    if (hex.length !== 6) return '#0f172a';
    
    r = parseInt(hex.slice(0, 2), 16);
    g = parseInt(hex.slice(2, 4), 16);
    b = parseInt(hex.slice(4, 6), 16);
  } 
  // Если цвет в rgb/rgba формате (то, что возвращает WebView)
  else {
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (!match) return '#0f172a';
    
    r = parseInt(match[1], 10);
    g = parseInt(match[2], 10);
    b = parseInt(match[3], 10);
  }

  // Формула расчёта яркости (WCAG)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  return luminance > 0.5 ? '#0f172a' : '#ffffff';
}

function isUndoShortcut(e) {
  return (e.ctrlKey || e.metaKey) &&
         !e.shiftKey &&
         (e.code === 'KeyZ' || e.key === 'z' || e.key === 'Z' || e.key === 'я' || e.key === 'Я');
}

// ══════════════════════════════════════════════════════════════
// ПЕРЕКЛЮЧЕНИЕ VIEWS
// ══════════════════════════════════════════════════════════════

function switchView(view) {
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

// ══════════════════════════════════════════════════════════════
// РЕНДЕР ТАБЛИЦЫ
// ══════════════════════════════════════════════════════════════

function renderTable(data) {
  const { weeks, categories, plans, facts, initial_balance } = data;
  const vc = data.settings.visual_config || {};

  const thead = document.getElementById('table-head');
  const tbody = document.getElementById('table-body');
  thead.innerHTML = '';
  tbody.innerHTML = '';

  const incomeCats  = categories.filter(c => c.type === 'income');
  const expenseCats = categories.filter(c => c.type === 'expense');
  const weekColor   = vc.weekColor || '#3b82f6';
  const cwColor     = vc.currentWeekColor || '#fef08a';

  // ── ШАПКА ──────────────────────────────────────────────────
  const tr = document.createElement('tr');

  const thCorner = document.createElement('th');
  thCorner.className = 'th-sticky';
  thCorner.style.top = '0';
  thCorner.innerHTML = `<span class="text-xs font-semibold text-slate-500
                               uppercase tracking-wide">
    Начало недели — Конец недели
  </span>`;
  tr.appendChild(thCorner);

  weeks.forEach((week, i) => {
    const th = document.createElement('th');
    th.className = 'th-week';
    th.id        = `week-col-${week.week_start}`;
    th.dataset.weekStart = week.week_start;

    const isCurrent = isCurrentWeek(week.week_start, week.week_end);

    const startD = new Date(week.week_start + 'T00:00:00');
    const endD   = new Date(week.week_end   + 'T00:00:00');
    const fmt    = d => `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}`;

    if (isCurrent) {
      const textColor = getContrastColor(cwColor);
      th.style.backgroundColor = cwColor;
      th.innerHTML = `
        <div class="week-number" style="color:${textColor}">
          Неделя ${week.week_number}
        </div>
        <div class="week-dates"
            style="color:${textColor};background:rgba(0,0,0,0.12)">
          ${fmt(startD)} - ${fmt(endD)}
        </div>`;
    } else {
      th.innerHTML = `
        <div class="week-number" style="color:#475569">
          Неделя ${week.week_number}
        </div>
        <div class="week-dates" style="color:#0f172a">
          ${fmt(startD)} - ${fmt(endD)}
        </div>`;
    }

    tr.appendChild(th);
  });

  thead.appendChild(tr);

  // ── СЕКЦИЯ ДОХОДЫ ───────────────────────────────────────────
  tbody.appendChild(makeSectionRow('income', weeks.length));
  incomeCats.forEach(cat => {
    tbody.appendChild(makeCategoryRow(cat, weeks, plans, facts, cwColor));
  });
  tbody.appendChild(makeTotalRow(
    'income', 'Итого доходы',
    weeks, incomeCats, plans, facts,
    vc.totalIncomeColor || '#16a34a', cwColor
  ));

  // ── СЕКЦИЯ РАСХОДЫ ──────────────────────────────────────────
  tbody.appendChild(makeSectionRow('expense', weeks.length));
  expenseCats.forEach(cat => {
    tbody.appendChild(makeCategoryRow(cat, weeks, plans, facts, cwColor));
  });
  tbody.appendChild(makeTotalRow(
    'expense', 'Итого расходы',
    weeks, expenseCats, plans, facts,
    vc.totalExpenseColor || '#ef4444', cwColor
  ));

  // ── СТРОКА БАЛАНСА ──────────────────────────────────────────
  tbody.appendChild(makeBalanceRow(
    weeks, categories, plans, facts,
    initial_balance, weekColor, cwColor,
    vc.negativeBalanceColor || '#f87171'
  ));
}

// ── Секция-разделитель ─────────────────────────────────────────────────────────
function makeSectionRow(type, weeksCount) {
  const tr  = document.createElement('tr');
  tr.className = `row-section ${type}-section`;

  const td  = document.createElement('td');
  td.colSpan = weeksCount + 1;

  const label = document.createElement('div');
  label.className = 'section-label';
  label.textContent = type === 'income' ? '+ Доходы' : '− Расходы';
  td.appendChild(label);
  tr.appendChild(td);
  return tr;
}

// ── Строка категории ───────────────────────────────────────────────────────────
function makeCategoryRow(cat, weeks, plans, facts, cwColor) {
  const tr = document.createElement('tr');
  tr.className   = 'row-category';
  tr.draggable   = true;
  tr.dataset.categoryId = cat.id;

  tr.addEventListener('dragstart', onDragStart);
  tr.addEventListener('dragover',  onDragOver);
  tr.addEventListener('drop',      onDrop);
  tr.addEventListener('dragend',   onDragEnd);

  // Левая ячейка
  const tdName = document.createElement('td');
  tdName.className = 'td-sticky';

  const isIncome = cat.type === 'income';
  tdName.innerHTML = `
    <div class="cat-name-cell">
      <div class="cat-name-left">
        <span class="cat-color-dot"
              style="background:${cat.color_code || '#94a3b8'}"></span>
        <span class="cat-name-text" title="${cat.name}">${cat.name}</span>
      </div>
      <button class="autofill-btn ${isIncome ? 'income' : 'expense'}"
              title="Автозаполнение плана"
              onclick="openAutofill(event, ${cat.id})">
        <svg width="13" height="13" fill="none" viewBox="0 0 24 24"
             stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0
               0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357
               2H15"/>
        </svg>
      </button>
    </div>`;
  tr.appendChild(tdName);

  // Ячейки данных
  weeks.forEach(week => {
    tr.appendChild(makeDataCell(cat, week, plans, facts, cwColor));
  });

  return tr;
}

// ── Ячейка данных ──────────────────────────────────────────────────────────────
function makeDataCell(cat, week, plans, facts, cwColor) {
  const td = document.createElement('td');
  td.className = 'data-cell';
  td.dataset.categoryId = cat.id;
  td.dataset.weekStart  = week.week_start;
  td.dataset.weekEnd    = week.week_end;
  td.dataset.catType    = cat.type;
  td.dataset.colorCode  = cat.color_code;

  const isCurrent = isCurrentWeek(week.week_start, week.week_end);
  if (isCurrent) {
    td.style.backgroundColor = cwColor;
  }

  refreshCellContent(td, plans, facts);

  // Левый клик — открыть редактор
  td.addEventListener('click', e => {
    e.stopPropagation();
    const key      = `${cat.id}:${week.week_start}`;
    const hasFact  = !!(facts[key] && facts[key].length > 0);
    openCellEditor(td, hasFact ? 'fact' : 'plan');
  });

  // Правый клик — сразу факт
  td.addEventListener('contextmenu', e => {
    e.preventDefault();
    e.stopPropagation();
    openCellEditor(td, 'fact');
  });

  return td;
}

// ── Контент ячейки ─────────────────────────────────────────────────────────────
function refreshCellContent(td, plans, facts) {
  const catId     = parseInt(td.dataset.categoryId);
  const weekStart = td.dataset.weekStart;
  const catType   = td.dataset.catType;
  const colorCode = td.dataset.colorCode;
  const key       = `${catId}:${weekStart}`;

  const plan      = plans?.[key];
  const factArr   = facts?.[key];
  const factTotal = factArr ? factArr.reduce((s, f) => s + f.amount, 0) : null;
  const planAmt   = plan ? plan.amount : null;
  const isFact    = factTotal !== null && factTotal !== 0;
  const isPlan    = planAmt !== null && planAmt !== 0;

  let html = '';

  if (isFact) {
    if (catType === 'income') {
      html = `<span class="val-fact-income"
                    style="color:${colorCode || '#10b981'}">
                ${formatAmount(factTotal)}
              </span>`;
    } else {
      html = `<span class="val-fact-expense">${formatAmount(factTotal)}</span>`;
    }
  } else if (isPlan) {
    const cls = catType === 'income' ? 'val-plan-income' : 'val-plan-expense';
    html = `<span class="${cls}">${formatAmount(planAmt)}</span>`;
  }
  // Если пусто — ничего не выводим (как в оригинале)

  td.innerHTML = `<div class="data-cell-inner">${html}</div>`;
}

// ── Inline редактор ────────────────────────────────────────────────────────────
function openCellEditor(td, initialMode) {
  closeActiveCellEditor(true);

  const catId     = parseInt(td.dataset.categoryId);
  const weekStart = td.dataset.weekStart;
  const weekEnd   = td.dataset.weekEnd;
  const key       = `${catId}:${weekStart}`;
  const plan      = App.data.plans[key];
  const factArr   = App.data.facts[key];
  const factTotal = factArr ? factArr.reduce((s, f) => s + f.amount, 0) : 0;

  App.editing = { categoryId: catId, weekStart, weekEnd, mode: initialMode, el: td };

  let initVal = '';
  if (initialMode === 'fact' && factTotal) initVal = factTotal.toString();
  else if (initialMode === 'plan' && plan) initVal = plan.amount.toString();

  const editor = document.createElement('div');
  editor.className = 'cell-editor';
  editor.id        = 'active-cell-editor';

  // ВАЖНО: блокируем всплытие клика, чтобы ячейка таблицы не переоткрывала редактор
  editor.addEventListener('click', e => e.stopPropagation());

  editor.innerHTML = `
    <div class="cell-editor-tabs">
      <button class="cell-editor-tab ${initialMode === 'plan' ? 'active' : ''}" data-mode="plan" type="button">
        План
      </button>
      <button class="cell-editor-tab ${initialMode === 'fact' ? 'active' : ''}" data-mode="fact" type="button">
        Факт
      </button>
    </div>
    <input
      id="cell-editor-input"
      type="text"
      value="${initVal}"
      autocomplete="off"
      placeholder="0"
      oninput="this.value = this.value.replace(/[^0-9.,+-]/g, '')"
    />
    <div class="cell-editor-actions">
      <button type="button" class="cell-editor-cancel">✕</button>
      <button type="button" class="cell-editor-confirm">ОК</button>
    </div>`;

  td.style.position = 'relative';
  td.appendChild(editor);

  const input = document.getElementById('cell-editor-input');
  input.focus();
  input.select();

  // Назначаем события кнопкам
  editor.querySelector('.cell-editor-cancel').addEventListener('click', () => {
    closeActiveCellEditor(true);
  });
  
  editor.querySelector('.cell-editor-confirm').addEventListener('click', () => {
    saveCellEditor();
  });

  // Переключение вкладок без потери введённого значения
  editor.querySelectorAll('.cell-editor-tab').forEach(btn => {
    btn.addEventListener('click', (e) => {
      App.editing.mode = e.target.dataset.mode;
      editor.querySelectorAll('.cell-editor-tab').forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');
      input.focus(); // Возвращаем фокус в поле ввода
    });
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); saveCellEditor(); }
    if (e.key === 'Escape') { e.preventDefault(); closeActiveCellEditor(true); }
    if (isUndoShortcut(e)) {
      e.preventDefault();
      e.stopPropagation();
      undoLastAction();
    }
  });

  // Клик вне редактора — закрываем БЕЗ сохранения
  setTimeout(() => {
    document.addEventListener('click', onOutsideClick);
  }, 0);
}

function onOutsideClick(e) {
  const editor = document.getElementById('active-cell-editor');
  if (!editor) {
    document.removeEventListener('click', onOutsideClick);
    return;
  }
  // Если кликнули мимо редактора — закрываем
  if (!editor.contains(e.target)) {
    document.removeEventListener('click', onOutsideClick);
    closeActiveCellEditor(true);
  }
}

function closeActiveCellEditor(cancel = false) {
  document.removeEventListener('click', onOutsideClick);
  const editor = document.getElementById('active-cell-editor');
  if (editor) {
    editor.remove();
  }
  if (cancel && App.editing.el) {
    // Возвращаем ячейке прежний вид
    refreshCellContent(App.editing.el, App.data?.plans, App.data?.facts);
  }
  App.editing = {
    categoryId: null, weekStart: null, weekEnd: null, mode: 'plan', el: null,
  };
}

async function saveCellEditor() {
  const input = document.getElementById('cell-editor-input');
  if (!input) return;

  const amount    = evalAmount(input.value);
  const { categoryId, weekStart, weekEnd, mode, el } = App.editing;

  // Снимаем редактор
  const editor = document.getElementById('active-cell-editor');
  if (editor) editor.remove();

  if (!categoryId || !weekStart) return;

  const key = `${categoryId}:${weekStart}`;
  
  // Сохраняем старое значение
  const oldValue = mode === 'plan' 
    ? App.data.plans[key]?.amount || 0
    : (App.data.facts[key] ? App.data.facts[key].reduce((s,f)=>s+f.amount,0) : 0);

  // Оптимистичное обновление локального кэша
  if (mode === 'plan') {
    if (amount === 0) {
      delete App.data.plans[key];
    } else {
      App.data.plans[key] = { amount };
    }
  } else {
    if (amount === 0) {
      delete App.data.facts[key];
    } else {
      App.data.facts[key] = [{ amount, date: getTodayISO(), comment: null }];
    }
  }

  if (el) refreshCellContent(el, App.data.plans, App.data.facts);

  // Пересчитываем итоги и баланс
  recalcTotalsAndBalance();

  // Добавляем в историю
  UndoHistory.push({
    type: ACTION_TYPES.CELL_EDIT,
    categoryId,
    weekStart,
    weekEnd,
    mode,
    oldValue,
    newValue: amount,
    timestamp: Date.now(),
  });

  App.editing = { categoryId: null, weekStart: null, weekEnd: null, mode: 'plan', el: null };

  // Сохраняем в БД
  try {
    await pywebview.api.save_cell({
      category_id:     categoryId,
      week_start_date: weekStart,
      week_end_date:   weekEnd,
      amount,
      mode,
    });
  } catch (e) {
    console.error('Ошибка сохранения:', e);
    showToast('Ошибка сохранения', 'error');
    await reloadData();
  }
}

// ── Пересчёт итогов без полного ре-рендера ─────────────────────────────────────
function recalcTotalsAndBalance() {
  if (!App.data) return;
  const { weeks, categories, plans, facts, initial_balance } = App.data;
  const vc  = App.data.settings.visual_config || {};
  const cwColor = vc.currentWeekColor || '#fef08a';

  const incomeCats  = categories.filter(c => c.type === 'income');
  const expenseCats = categories.filter(c => c.type === 'expense');

  const weekTotals = weeks.map(week => {
    let inc = 0, exp = 0;

    incomeCats.forEach(cat => {
      const key = `${cat.id}:${week.week_start}`;
      const fa  = facts[key];
      const p   = plans[key];
      inc += fa && fa.length ? fa.reduce((s,f)=>s+f.amount,0) : (p ? p.amount : 0);
    });

    expenseCats.forEach(cat => {
      const key = `${cat.id}:${week.week_start}`;
      const fa  = facts[key];
      const p   = plans[key];
      exp += fa && fa.length ? fa.reduce((s,f)=>s+f.amount,0) : (p ? p.amount : 0);
    });

    return { weekStart: week.week_start, inc, exp };
  });

  // Обновляем строку итого доходы
  const incTotalCells = document.querySelectorAll(
    '.row-total-income td.data-cell-total'
  );
  incTotalCells.forEach((td, i) => {
    const { inc } = weekTotals[i] || {};
    td.querySelector('div').textContent = inc ? formatAmount(inc) : '';
    td.querySelector('div').style.color = vc.totalIncomeColor || '#16a34a';
  });

  // Обновляем строку итого расходы
  const expTotalCells = document.querySelectorAll(
    '.row-total-expense td.data-cell-total'
  );
  expTotalCells.forEach((td, i) => {
    const { exp } = weekTotals[i] || {};
    td.querySelector('div').textContent = exp ? `-${formatAmount(exp)}` : '';
    td.querySelector('div').style.color = vc.totalExpenseColor || '#ef4444';
  });

  // Обновляем строку баланса
  const negColor  = vc.negativeBalanceColor || '#f87171';
  const weekColor = vc.weekColor || '#3b82f6';
  let running     = initial_balance;

  const balanceCells = document.querySelectorAll('.row-balance td.balance-data-cell');
  balanceCells.forEach((td, i) => {
    const week = weeks[i];
  const wt = weekTotals[i];
  if (!wt) return;
  running += wt.inc - wt.exp;

  const inner = td.querySelector('.balance-cell-inner');
  const isNeg = running < 0;
  const isCurrent = isCurrentWeek(week.week_start, week.week_end);
  
  // Сначала выставляем фон, потом по нему считаем контраст
  const bgColor = isCurrent ? cwColor : weekColor;
  td.style.backgroundColor = bgColor;
  
  const textColor = isNeg ? negColor : getContrastColor(bgColor);

  inner.innerHTML = `
    ${isNeg ? `
      <button class="wand-btn"
        onclick="handleDeficit(event,'${week.week_start}','${week.week_end}',${Math.abs(running).toFixed(2)})"
        title="Покрыть дефицит">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-magic" viewBox="0 0 16 16">
            <path d="M9.5 2.672a.5.5 0 1 0 1 0V.843a.5.5 0 0 0-1 0zm4.5.035A.5.5 0 0 0 13.293 2L12 3.293a.5.5 0 1 0 .707.707zM7.293 4A.5.5 0 1 0 8 3.293L6.707 2A.5.5 0 0 0 6 2.707zm-.621 2.5a.5.5 0 1 0 0-1H4.843a.5.5 0 1 0 0 1zm8.485 0a.5.5 0 1 0 0-1h-1.829a.5.5 0 0 0 0 1zM13.293 10A.5.5 0 1 0 14 9.293L12.707 8a.5.5 0 1 0-.707.707zM9.5 11.157a.5.5 0 0 0 1 0V9.328a.5.5 0 0 0-1 0zm1.854-5.097a.5.5 0 0 0 0-.706l-.708-.708a.5.5 0 0 0-.707 0L8.646 5.94a.5.5 0 0 0 0 .707l.708.708a.5.5 0 0 0 .707 0l1.293-1.293Zm-3 3a.5.5 0 0 0 0-.706l-.708-.708a.5.5 0 0 0-.707 0L.646 13.94a.5.5 0 0 0 0 .707l.708.708a.5.5 0 0 0 .707 0z"/>
          </svg>
      </button>` : ''}
      <span style="color:${textColor}">${formatAmount(running)}</span>`;
  });
}

// ── Итоговая строка ────────────────────────────────────────────────────────────
function makeTotalRow(type, label, weeks, typeCats, plans, facts, color, cwColor) {
  const tr = document.createElement('tr');
  tr.className = `row-total row-total-${type}`;

  const tdLabel = document.createElement('td');
  tdLabel.className = 'td-sticky';
  tdLabel.innerHTML = `
    <div style="padding:6px 16px;font-size:11px;font-weight:700;
                text-transform:uppercase;letter-spacing:0.04em;color:#475569;">
      ${label}
    </div>`;
  tr.appendChild(tdLabel);

  weeks.forEach(week => {
    const td = document.createElement('td');
    td.className = 'data-cell data-cell-total';
    td.dataset.weekStart = week.week_start;

    const isCurrent = isCurrentWeek(week.week_start, week.week_end);
    
    if (isCurrent) {
      td.style.backgroundColor = cwColor;
    } else {
      if (type === 'income') td.style.background = 'rgba(236,253,245,0.3)';
      if (type === 'expense') td.style.background = 'rgba(255,241,242,0.3)';
    }

    let total = 0;
    typeCats.forEach(cat => {
      const key   = `${cat.id}:${week.week_start}`;
      const fa    = facts[key];
      const p     = plans[key];
      total += fa && fa.length ? fa.reduce((s,f)=>s+f.amount,0) : (p ? p.amount : 0);
    });

    const display = type === 'expense' && total
      ? `-${formatAmount(total)}`
      : (total ? formatAmount(total) : '');

    td.innerHTML = `
      <div style="padding:4px 8px;font-weight:700;text-align:right;
                  color:${color};font-variant-numeric:tabular-nums;">
        ${display}
      </div>`;
    tr.appendChild(td);
  });

  return tr;
}

// ── Строка баланса ─────────────────────────────────────────────────────────────
function makeBalanceRow(weeks, categories, plans, facts, initialBalance,
                        weekColor, cwColor, negColor) {
  const tr = document.createElement('tr');
  tr.className = 'row-balance';

  const balanceTextColor = getContrastColor(weekColor);
  const tdLabel = document.createElement('td');
  tdLabel.className = 'td-sticky';
  tdLabel.style.backgroundColor = weekColor;
  tdLabel.innerHTML = `
    <div style="padding:6px 16px;font-size:11px;font-weight:700;
                text-transform:uppercase;letter-spacing:0.04em;
                color:${balanceTextColor};opacity:0.8;">
      Остаток (Баланс)
    </div>`;
  
  tr.appendChild(tdLabel);

  const incomeCats  = categories.filter(c => c.type === 'income');
  const expenseCats = categories.filter(c => c.type === 'expense');
  let running = initialBalance;

  weeks.forEach((week, i) => {
    let inc = 0, exp = 0;

    incomeCats.forEach(cat => {
      const key = `${cat.id}:${week.week_start}`;
      const fa  = facts[key];
      const p   = plans[key];
      inc += fa && fa.length ? fa.reduce((s,f)=>s+f.amount,0) : (p ? p.amount : 0);
    });

    expenseCats.forEach(cat => {
      const key = `${cat.id}:${week.week_start}`;
      const fa  = facts[key];
      const p   = plans[key];
      exp += fa && fa.length ? fa.reduce((s,f)=>s+f.amount,0) : (p ? p.amount : 0);
    });

    running += inc - exp;
    const isNeg = running < 0;

    const td = document.createElement('td');
    td.className = 'balance-data-cell';
    td.dataset.weekStart = week.week_start;
    td.style.backgroundColor = weekColor;
    td.style.borderColor = 'rgba(255,255,255,0.3)';
    td.style.textAlign = 'right';

    const isCurrent   = isCurrentWeek(week.week_start, week.week_end);
    const cellBgColor = isCurrent ? cwColor : weekColor;
    const cellTextColor = getContrastColor(cellBgColor);

    if (isCurrent) td.style.backgroundColor = cwColor;
    else           td.style.backgroundColor = weekColor;
    // Для текущей недели в строке баланса считаем контраст отдельно
    const cwBalanceColor = getContrastColor(cwColor);

    td.innerHTML = `
      <div class="balance-cell-inner" style="padding:0 8px;">
        ${isNeg ? `
          <button class="wand-btn"
        onclick="handleDeficit(event,'${week.week_start}',
                 '${week.week_end}',
                 ${Math.abs(running).toFixed(2)})"
        title="Покрыть дефицит">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-magic" viewBox="0 0 16 16">
            <path d="M9.5 2.672a.5.5 0 1 0 1 0V.843a.5.5 0 0 0-1 0zm4.5.035A.5.5 0 0 0 13.293 2L12 3.293a.5.5 0 1 0 .707.707zM7.293 4A.5.5 0 1 0 8 3.293L6.707 2A.5.5 0 0 0 6 2.707zm-.621 2.5a.5.5 0 1 0 0-1H4.843a.5.5 0 1 0 0 1zm8.485 0a.5.5 0 1 0 0-1h-1.829a.5.5 0 0 0 0 1zM13.293 10A.5.5 0 1 0 14 9.293L12.707 8a.5.5 0 1 0-.707.707zM9.5 11.157a.5.5 0 0 0 1 0V9.328a.5.5 0 0 0-1 0zm1.854-5.097a.5.5 0 0 0 0-.706l-.708-.708a.5.5 0 0 0-.707 0L8.646 5.94a.5.5 0 0 0 0 .707l.708.708a.5.5 0 0 0 .707 0l1.293-1.293Zm-3 3a.5.5 0 0 0 0-.706l-.708-.708a.5.5 0 0 0-.707 0L.646 13.94a.5.5 0 0 0 0 .707l.708.708a.5.5 0 0 0 .707 0z"/>
          </svg>
</button>` : ''}
        <span style="color:${isNeg ? negColor : cellTextColor}">
          ${formatAmount(running)}
        </span>
      </div>`;

    tr.appendChild(td);
  });

  return tr;
}

// ══════════════════════════════════════════════════════════════
// DRAG AND DROP
// ══════════════════════════════════════════════════════════════

let draggedCatId = null;

function onDragStart(e) {
  draggedCatId = this.dataset.categoryId;
  this.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', draggedCatId);
}

function onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

function onDrop(e) {
  e.preventDefault();
  const targetId = this.dataset.categoryId;
  if (!draggedCatId || draggedCatId === targetId) return;

  // Проверяем одну секцию
  const draggedCat = App.data.categories.find(c => c.id === parseInt(draggedCatId));
  const targetCat  = App.data.categories.find(c => c.id === parseInt(targetId));
  if (!draggedCat || !targetCat || draggedCat.type !== targetCat.type) return;

  const tbody  = document.getElementById('table-body');
  const dragged = document.querySelector(`tr[data-category-id="${draggedCatId}"]`);
  const target  = document.querySelector(`tr[data-category-id="${targetId}"]`);

  if (!dragged || !target) return;

  const rows   = [...tbody.querySelectorAll('tr.row-category')];
  const dIdx   = rows.indexOf(dragged);
  const tIdx   = rows.indexOf(target);

  if (dIdx < tIdx) {
    target.parentNode.insertBefore(dragged, target.nextSibling);
  } else {
    target.parentNode.insertBefore(dragged, target);
  }
}

async function onDragEnd() {
  this.classList.remove('dragging');
  draggedCatId = null;

  const allRows    = [...document.getElementById('table-body')
    .querySelectorAll('tr.row-category')];
  const orderedIds = allRows.map(r => parseInt(r.dataset.categoryId));

  try {
    await pywebview.api.update_category_order(orderedIds);
    await reloadData();
  } catch (e) {
    console.error('Ошибка сортировки:', e);
  }
}

// ══════════════════════════════════════════════════════════════
// AUTOFILL
// ══════════════════════════════════════════════════════════════

function setAutofillMode(mode) {
  Autofill.mode = mode;

  // Кнопки
  document.getElementById('af-mode-weeks')
    .classList.toggle('active', mode === 'weeks');
  document.getElementById('af-mode-months')
    .classList.toggle('active', mode === 'months');

  // День месяца
  document.getElementById('af-day-of-month-wrap')
    .classList.toggle('hidden', mode === 'weeks');

  // Лейбл количества
  document.getElementById('af-count-label').textContent =
    mode === 'weeks' ? 'Количество недель' : 'Количество месяцев';

  // Максимум
  document.getElementById('autofill-weeks').max =
    mode === 'weeks' ? 52 : 24;

  updateAutofillPreview();
}

function openAutofill(event, categoryId) {
  event.stopPropagation();
  Autofill.categoryId = categoryId;
  Autofill.mode       = 'weeks';

  const cat = App.data.categories.find(c => c.id === categoryId);
  document.getElementById('autofill-cat-name').textContent = cat?.name || '';

  // Сброс формы
  setAutofillMode('weeks');
  const monday = getMondayOf(getTodayISO());
  document.getElementById('autofill-start-date').value  = monday;
  document.getElementById('autofill-weeks').value        = 12;
  document.getElementById('autofill-amount').value       = '';
  document.getElementById('autofill-day-of-month').value = 1;
  document.getElementById('autofill-week-hint').classList.add('hidden');
  document.getElementById('af-preview').classList.add('hidden');

  showModal('autofill-modal');
  setTimeout(() => document.getElementById('autofill-amount').focus(), 100);
}

function closeAutofillModal() {
  hideModal('autofill-modal');
  Autofill.categoryId = null;
}

function updateAutofillPreview() {
  const startVal  = document.getElementById('autofill-start-date').value;
  const count     = parseInt(document.getElementById('autofill-weeks').value) || 0;
  const amount    = parseFloat(document.getElementById('autofill-amount').value) || 0;
  const dayOfMonth= parseInt(document.getElementById('autofill-day-of-month').value) || 1;
  const preview   = document.getElementById('af-preview');

  if (!startVal || count <= 0 || amount <= 0) {
    preview.classList.add('hidden');
    return;
  }

  const mode = Autofill.mode;

  if (mode === 'weeks') {
    const monday  = getMondayOf(startVal);
    const endDate = new Date(monday + 'T00:00:00');
    endDate.setDate(endDate.getDate() + (count - 1) * 7 + 6);

    preview.innerHTML = `
      Будет проставлено <strong>${formatAmount(amount)} ₽</strong>
      на <strong>${count}</strong> ${pluralWeeks(count)}<br>
      Итого: <strong>${formatAmount(amount * count)} ₽</strong>`;
  } else {
    preview.innerHTML = `
      Будет проставлено <strong>${formatAmount(amount)} ₽</strong>
      каждый месяц <strong>${count}</strong> раз<br>
      (${dayOfMonth}-го числа каждого месяца)<br>
      Итого: <strong>${formatAmount(amount * count)} ₽</strong>`;
  }

  preview.classList.remove('hidden');
}

// Подсказка какая неделя будет выбрана
document.getElementById('autofill-start-date')
  ?.addEventListener('change', function() {
    const val  = this.value;
    const hint = document.getElementById('autofill-week-hint');
    if (!val || !App.data) { hint.classList.add('hidden'); return; }

    const monday = getMondayOf(val);
    const week   = App.data.weeks.find(w => w.week_start === monday);
    if (week) {
      hint.textContent = `Начнётся с: Неделя ${week.week_number} (${week.label})`;
      hint.classList.remove('hidden');
    }
    updateAutofillPreview();
  });

document.getElementById('autofill-weeks')
  ?.addEventListener('input', updateAutofillPreview);
document.getElementById('autofill-amount')
  ?.addEventListener('input', updateAutofillPreview);
document.getElementById('autofill-day-of-month')
  ?.addEventListener('input', updateAutofillPreview);

async function submitAutofill() {
  const startDate  = document.getElementById('autofill-start-date').value;
  const count      = parseInt(document.getElementById('autofill-weeks').value);
  const amount     = parseFloat(document.getElementById('autofill-amount').value);
  const dayOfMonth = parseInt(document.getElementById('autofill-day-of-month').value) || 1;

  if (!startDate)           { showToast('Укажите начальную дату', 'error');    return; }
  if (!count || count <= 0) { showToast('Укажите количество', 'error');         return; }
  if (!amount || amount <= 0){ showToast('Укажите сумму', 'error');             return; }

  try {
    const result = await pywebview.api.autofill({
      category_id:  Autofill.categoryId,
      start_date:   startDate,
      amount,
      mode:         Autofill.mode,
      count,
      day_of_month: dayOfMonth,
    });

    if (result.success) {
      // Добавляем в историю
      UndoHistory.push({
        type: ACTION_TYPES.AUTOFILL,
        categoryId: Autofill.categoryId,
        startDate,
        amount,
        mode: Autofill.mode,
        count,
        dayOfMonth,
        filledWeeks: result.filled || count,
        timestamp: Date.now(),
      });

      closeAutofillModal();
      showToast(`Заполнено ${result.filled} ${pluralWeeks(result.filled)}`, 'success');
      await reloadData();
    } else {
      showToast('Ошибка: ' + result.error, 'error');
    }
  } catch (e) {
    showToast('Ошибка соединения', 'error');
  }
}

// ══════════════════════════════════════════════════════════════
// ИСТОРИЯ ДЕЙСТВИЙ (UNDO)
// ══════════════════════════════════════════════════════════════

const UndoHistory = {
  stack: [],
  maxSize: 50,

  push(action) {
    this.stack.push(action);
    if (this.stack.length > this.maxSize) {
      this.stack.shift();
    }
  },

  pop() {
    return this.stack.pop();
  },

  clear() {
    this.stack = [];
  },

  isEmpty() {
    return this.stack.length === 0;
  },
};

const ACTION_TYPES = {
  CELL_EDIT:      'cell_edit',
  AUTOFILL:       'autofill',
  LOAN_REPAYMENT: 'loan_repayment',
};

// ══════════════════════════════════════════════════════════════
// КАССОВЫЙ РАЗРЫВ
// ══════════════════════════════════════════════════════════════

function setDeficitMode(mode) {
  Deficit.mode = mode;

  document.getElementById('def-mode-single')
    .classList.toggle('active', mode === 'single');
  document.getElementById('def-mode-parts')
    .classList.toggle('active', mode === 'parts');

  document.getElementById('def-single-wrap')
    .classList.toggle('hidden', mode !== 'single');
  document.getElementById('def-parts-wrap')
    .classList.toggle('hidden', mode !== 'parts');

  if (mode === 'parts') updateDeficitPartsPreview();
}

function updateDeficitPartsPreview() {
  const count     = parseInt(document.getElementById('def-parts-count').value) || 0;
  const period    = document.getElementById('def-parts-period').value;
  const startDate = document.getElementById('def-parts-start-date').value;
  const preview   = document.getElementById('def-parts-preview');

  if (!count || count < 2 || !startDate) {
    preview.classList.add('hidden');
    return;
  }

  const perPayment = Deficit.amount / count;
  const periodLabel = period === 'weeks'
    ? `${count} ${pluralWeeks(count)}`
    : `${count} мес.`;

  preview.innerHTML = `
    Сумма каждой выплаты: <strong>${formatAmount(perPayment)} ₽</strong><br>
    Период: <strong>${periodLabel}</strong> начиная с выбранной даты`;
  preview.classList.remove('hidden');
}

async function handleDeficit(event, weekStart, weekEnd, deficitAmount) {
  event.stopPropagation();
  if (!App.data) return;

  const strategy = App.data.settings.financial_strategy;
  Deficit.weekStart = weekStart;
  Deficit.weekEnd   = weekEnd;
  Deficit.amount    = deficitAmount;
  Deficit.mode      = 'single';

  if (strategy === 'manual') {
    showToast('Ручное управление: автодействия отключены', 'info');
    return;
  }

  if (strategy === 'saving_first') {
    const result = await pywebview.api.handle_deficit({
      week_start: weekStart,
      week_end:   weekEnd,
      deficit:    deficitAmount,
      strategy:   'saving_first',
    });
    if (result.success) {
      showToast(`Покрыто из копилки: ${formatAmount(deficitAmount)} ₽`, 'success');
      await reloadData();
    } else {
      showToast('Ошибка: ' + result.error, 'error');
    }
    return;
  }

  if (strategy === 'credit_first') {
    document.getElementById('deficit-amount-display').textContent =
      `${formatAmount(deficitAmount)} ₽`;

    // Сброс формы
    setDeficitMode('single');

    // Дата возврата по умолчанию: +4 недели
    const ret = new Date(weekStart + 'T00:00:00');
    ret.setDate(ret.getDate() + 28);
    document.getElementById('deficit-return-date').value =
      ret.toISOString().split('T')[0];

    // Дата первой выплаты по умолчанию = та же
    document.getElementById('def-parts-start-date').value =
      ret.toISOString().split('T')[0];
    document.getElementById('def-parts-count').value = 4;
    document.getElementById('def-parts-preview').classList.add('hidden');

    showModal('deficit-modal');
  }
}

function closeDeficitModal() {
  hideModal('deficit-modal');
}

async function submitDeficit() {
  if (Deficit.mode === 'single') {
    // Единовременный возврат
    const returnDate = document.getElementById('deficit-return-date').value;
    if (!returnDate) { showToast('Укажите дату возврата', 'error'); return; }

    try {
      const result = await pywebview.api.handle_deficit({
        week_start:  Deficit.weekStart,
        week_end:    Deficit.weekEnd,
        deficit:     Deficit.amount,
        strategy:    'credit_first',
        return_date: returnDate,
      });
      if (result.success) {
        // Добавляем в историю
        UndoHistory.push({
          type: ACTION_TYPES.LOAN_REPAYMENT,
          weekStart: Deficit.weekStart,
          weekEnd: Deficit.weekEnd,
          amount: Deficit.amount,
          returnDate,
          mode: 'single',
          timestamp: Date.now(),
        });

        closeDeficitModal();
        showToast('Займ оформлен, возврат запланирован', 'success');
        await reloadData();
      } else {
        showToast('Ошибка: ' + result.error, 'error');
      }
    } catch (e) {
      showToast('Ошибка соединения', 'error');
    }

  } else {
    // Возврат по частям
    const count     = parseInt(document.getElementById('def-parts-count').value);
    const period    = document.getElementById('def-parts-period').value;
    const startDate = document.getElementById('def-parts-start-date').value;

    if (!count || count < 2) {
      showToast('Укажите количество выплат (минимум 2)', 'error'); return;
    }
    if (!startDate) {
      showToast('Укажите дату первой выплаты', 'error'); return;
    }

    try {
      const result = await pywebview.api.handle_deficit({
        week_start:       Deficit.weekStart,
        week_end:         Deficit.weekEnd,
        deficit:          Deficit.amount,
        strategy:         'credit_first',
        repayment_mode:   'parts',
        parts_count:      count,
        parts_period:     period,
        parts_start_date: startDate,
      });
      if (result.success) {
        // Добавляем в историю
        UndoHistory.push({
          type: ACTION_TYPES.LOAN_REPAYMENT,
          weekStart: Deficit.weekStart,
          weekEnd: Deficit.weekEnd,
          amount: Deficit.amount,
          mode: 'parts',
          partsCount: count,
          partsPeriod: period,
          partsStartDate: startDate,
          timestamp: Date.now(),
        });

        closeDeficitModal();
        showToast(`Займ оформлен, ${count} выплат запланировано`, 'success');
        await reloadData();
      } else {
        showToast('Ошибка: ' + result.error, 'error');
      }
    } catch (e) {
      showToast('Ошибка соединения', 'error');
    }
  }
}

// ══════════════════════════════════════════════════════════════
// СВЕРКА БАЛАНСА
// ══════════════════════════════════════════════════════════════

async function openReconcileModal() {
  const today = getTodayISO();

  document.getElementById('reconcile-date').value   = today;
  document.getElementById('reconcile-actual').value = '';
  document.getElementById('reconcile-diff-preview').classList.add('hidden');
  document.getElementById('reconcile-calculated').textContent = '...';
  document.getElementById('reconcile-calculated').dataset.value     = '';
  document.getElementById('reconcile-calculated').dataset.weekStart = '';
  document.getElementById('reconcile-calculated').dataset.weekEnd   = '';

  showModal('reconcile-modal');

  await updateReconcileCalculated(today);

  setTimeout(() => document.getElementById('reconcile-actual').focus(), 100);
}

async function updateReconcileCalculated(dateStr) {
  if (!dateStr) return;

  // Находим неделю в которую попадает выбранная дата
  const targetWeek = App.data?.weeks.find(w =>
    dateStr >= w.week_start && dateStr <= w.week_end
  );

  const weekStart = targetWeek?.week_start;
  const weekEnd   = targetWeek?.week_end;

  if (!weekStart) {
    document.getElementById('reconcile-calculated').textContent = 'Вне периода';
    return;
  }

  document.getElementById('reconcile-calculated').textContent = '...';

  try {
    const res = await pywebview.api.get_calculated_balance(weekStart);
    const el  = document.getElementById('reconcile-calculated');
    if (res.success) {
      el.textContent         = `${formatAmount(res.balance)} ₽`;
      el.dataset.value       = res.balance;
      el.dataset.weekStart   = weekStart;
      el.dataset.weekEnd     = weekEnd;
    } else {
      el.textContent = 'Ошибка';
    }
  } catch (e) {
    document.getElementById('reconcile-calculated').textContent = 'Ошибка';
  }

  setTimeout(() => document.getElementById('reconcile-actual').focus(), 100);
}

function closeReconcileModal() {
  hideModal('reconcile-modal');
}

document.getElementById('reconcile-actual')
  ?.addEventListener('input', function() {
    const actual     = parseFloat(this.value);
    const calcEl     = document.getElementById('reconcile-calculated');
    const calculated = parseFloat(calcEl.dataset.value || '0');
    const preview    = document.getElementById('reconcile-diff-preview');

    if (isNaN(actual)) { preview.classList.add('hidden'); return; }

    const diff = actual - calculated;
    if (Math.abs(diff) < 0.01) {
      preview.style.cssText = 'padding:12px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;font-size:12px;color:#166534;';
      preview.textContent   = '✓ Балансы совпадают. Корректировка не нужна.';
    } else if (diff > 0) {
      preview.style.cssText = 'padding:12px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;font-size:12px;color:#1d4ed8;';
      preview.innerHTML     = `Будет добавлен доход <strong>«Незапланированные доходы» ${formatAmount(diff)} ₽</strong>`;
    } else {
      preview.style.cssText = 'padding:12px;background:#fff1f2;border:1px solid #fecdd3;border-radius:8px;font-size:12px;color:#be123c;';
      preview.innerHTML     = `Будет добавлен расход <strong>«Незапланированные расходы» ${formatAmount(Math.abs(diff))} ₽</strong>`;
    }
    preview.classList.remove('hidden');
  });

async function submitReconcile() {
  const actualVal  = parseFloat(document.getElementById('reconcile-actual').value);
  const calcEl     = document.getElementById('reconcile-calculated');
  const calcVal    = parseFloat(calcEl.dataset.value || '0');
  const weekStart  = calcEl.dataset.weekStart;
  const weekEnd    = calcEl.dataset.weekEnd;

  if (isNaN(actualVal)) { showToast('Введите фактический баланс', 'error'); return; }
  else if (actualVal < 0) { showToast('Введите корректный баланс (≥ 0)', 'error'); return; }

  try {
    const result = await pywebview.api.reconcile_balance({
      actual_balance:     actualVal,
      calculated_balance: calcVal,
      week_start:         weekStart,
      week_end:           weekEnd,
    });
    if (result.success) {
      closeReconcileModal();
      if (result.action === 'none') {
        showToast('Балансы совпадают', 'info');
      } else {
        showToast('Баланс выровнен', 'success');
        await reloadData();
      }
    } else {
      showToast('Ошибка: ' + result.error, 'error');
    }
  } catch (e) {
    showToast('Ошибка соединения', 'error');
  }
}

document.getElementById('reconcile-modal')
  ?.addEventListener('click', function(e) {
    if (e.target === this) closeReconcileModal();
  });

// ══════════════════════════════════════════════════════════════
// НАСТРОЙКИ VIEW
// ══════════════════════════════════════════════════════════════

async function renderSettingsView() {
  const container = document.getElementById('settings-content');
  container.innerHTML = '<div class="text-slate-400 text-sm">Загрузка...</div>';

  let settings, categories, account;
  try {
    [settings, categories, account] = await Promise.all([
      pywebview.api.get_settings(),
      pywebview.api.get_categories(),
      pywebview.api.get_account(),
    ]);
  } catch (e) {
    container.innerHTML = '<div class="text-rose-500 text-sm">Ошибка загрузки</div>';
    return;
  }

  const vc = settings.visual_config || {};

  let warningHtml = '';
  if (App.data && App.data.weeks && App.data.weeks.length > 0) {
    const today = getTodayISO();
    const firstWeek = App.data.weeks[0];
    const lastWeek = App.data.weeks[App.data.weeks.length - 1];
    
    if (today < firstWeek.week_start) {
      warningHtml = `
        <div style="padding:12px; background:#fef3c7; border:1px solid #fcd34d; 
                    border-radius:8px; font-size:13px; color:#92400e; margin-bottom:20px;">
          ⚠️ <strong>Внимание:</strong> Период планирования начинается ${firstWeek.week_start}, 
          а текущая дата ${today}. Текущая неделя не будет выделена.
        </div>`;
    } else if (today > lastWeek.week_end) {
      warningHtml = `
        <div style="padding:12px; background:#fef3c7; border:1px solid #fcd34d; 
                    border-radius:8px; font-size:13px; color:#92400e; margin-bottom:20px;">
          ⚠️ <strong>Внимание:</strong> Период планирования заканчивается ${lastWeek.week_end}, 
          а текущая дата ${today}. Текущая неделя не будет выделена.
        </div>`;
    }
  }

  container.innerHTML = `

    <!-- Параметры планирования -->
    <div class="settings-section">
      <h2>Параметры планирования</h2>
      <div class="space-y-4">
        <div>
          <label class="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wide">
            Дата начала периода
          </label>
          <input type="date" id="s-start-date"
                 class="settings-input"
                 value="${settings.planning_start_date || ''}"/>
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wide">
            Стратегия при кассовых разрывах
          </label>
          <select id="s-strategy" class="settings-select w-full max-w-sm">
            <option value="manual"       ${settings.financial_strategy==='manual'       ? 'selected':''}>
              Ручное управление (только подсветка)
            </option>
            <option value="saving_first" ${settings.financial_strategy==='saving_first' ? 'selected':''}>
              Приоритет: Накопления (Копилка)
            </option>
            <option value="credit_first" ${settings.financial_strategy==='credit_first' ? 'selected':''}>
              Приоритет: Кредитка (Заёмные средства)
            </option>
          </select>
          <p class="text-xs text-slate-500 mt-1.5">
            Система будет предлагать покрытие отрицательного остатка за счёт выбранного источника.
          </p>
        </div>
        <div>
          <button onclick="saveMainSettings()"
                  class="btn-settings-primary">
            Сохранить
          </button>
        </div>
      </div>
    </div>

    <!-- Категории -->
    <div class="settings-section">
      <h2>Статьи доходов и расходов</h2>

      <div class="grid grid-cols-2 gap-8 mb-6">

        <!-- Доходы -->
        <div>
          <h3 class="text-xs font-bold text-emerald-600 uppercase mb-3
                     border-b border-slate-100 pb-2">Доходы</h3>
          <div id="s-income-cats"
               class="space-y-2 max-h-[300px] overflow-y-auto pr-1">
          </div>
        </div>

        <!-- Расходы -->
        <div>
          <h3 class="text-xs font-bold text-rose-600 uppercase mb-3
                     border-b border-slate-100 pb-2">Расходы</h3>
          <div id="s-expense-cats"
               class="space-y-2 max-h-[300px] overflow-y-auto pr-1">
          </div>
        </div>
      </div>

    <!-- Форма добавления категории с emoji picker -->
      <div class="pt-4 border-t border-slate-100 flex items-end gap-3 max-w-2xl">
        <div class="flex-1">
          <label class="block text-[10px] font-bold text-slate-500 mb-1 uppercase">
            Добавить статью
          </label>
          <div class="flex gap-2">
            <!-- Input с эмодзи кнопкой -->
            <div class="relative flex-[2]">
              <input type="text" id="s-new-cat-name"
                    placeholder="Название"
                    class="settings-input w-full pr-10"
                    onkeydown="if(event.key==='Enter') submitAddCategorySettings()"/>
              <button type="button"
                      id="emoji-picker-btn"
                      class="absolute right-2 top-1/2 transform -translate-y-1/2"
                      title="Добавить эмодзи"
                      onclick="toggleEmojiPicker(event)">
                😊
              </button>
            </div>
            
            <select id="s-new-cat-type" class="settings-select flex-1">
              <option value="expense">Расход</option>
              <option value="income">Доход</option>
            </select>
          </div>
          
          <!-- Emoji Picker Panel -->
          <div id="emoji-picker-panel" 
              class="hidden"
              style="width: 380px; max-height: 500px; overflow-y: auto;">
            <div class="grid grid-cols-8 gap-1.5" id="emoji-grid">
              <!-- Эмодзи будут загружены JS -->
            </div>
          </div>
        </div>
        
        <button onclick="submitAddCategorySettings()"
                class="btn-settings-primary">
          Добавить
        </button>
      </div>
    </div>

    <!-- Оформление -->
    <div class="settings-section">
      <h2>Оформление</h2>
      <div class="grid grid-cols-2 md:grid-cols-5 gap-6">
        ${[
          ['weekColor',            vc.weekColor            || '#3b82f6', 'Цвет темы / баланс'],
          ['currentWeekColor',     vc.currentWeekColor     || '#fef08a', 'Текущая неделя'],
          ['negativeBalanceColor', vc.negativeBalanceColor || '#f87171', 'Дефицит (< 0)'],
          ['totalIncomeColor',     vc.totalIncomeColor     || '#16a34a', 'Итого доходы'],
          ['totalExpenseColor',    vc.totalExpenseColor    || '#ef4444', 'Итого расходы'],
        ].map(([key, val, label]) => `
          <div>
            <label class="block text-[10px] font-bold text-slate-500 mb-1 uppercase">
              ${label}
            </label>
            <input type="color"
                   class="w-full h-10 border border-slate-200 rounded outline-none
                          cursor-pointer"
                   value="${val}"
                   data-vc-key="${key}"
                   onchange="updateVisualColor('${key}', this.value)"/>
          </div>`).join('')}
      </div>
    </div>

    <!-- Управление данными -->
    <div class="settings-section flex items-center justify-between">
      <div>
        <h2 style="margin-bottom:4px;">Управление данными</h2>
        <p class="text-xs text-slate-500">
          Экспорт и импорт всех настроек, статей и транзакций в формате JSON
        </p>
      </div>
      <div class="flex gap-3">
        <button onclick="handleExport()"
                class="btn-settings-secondary">
          Экспорт JSON
        </button>
        <button onclick="handleImport()"
                class="btn-settings-blue">
          Импорт JSON
        </button>
      </div>
    </div>
  `;

  // Рендер категорий
  renderSettingsCategoryList(
    categories.filter(c => c.type === 'income'),
    document.getElementById('s-income-cats')
  );
  renderSettingsCategoryList(
    categories.filter(c => c.type === 'expense'),
    document.getElementById('s-expense-cats')
  );
}

function renderSettingsCategoryList(cats, container) {
  container.innerHTML = '';

  cats.forEach(cat => {
    const item = document.createElement('div');
    item.className = 'settings-cat-item';
    item.dataset.catId = cat.id;

    item.innerHTML = `
      <div class="settings-cat-name-wrap" id="cat-display-${cat.id}">
        <!-- Color picker -->
        <label class="cursor-pointer flex items-center justify-center
                      relative w-5 h-5 flex-shrink-0"
               title="Изменить цвет">
          <div class="w-3 h-3 rounded-full"
               style="background:${cat.color_code || '#94a3b8'}"></div>
          <input type="color"
                 value="${cat.color_code || '#94a3b8'}"
                 class="absolute w-0 h-0 opacity-0"
                 onchange="updateCategoryColor(${cat.id}, this.value, this)"/>
        </label>
        <span class="font-semibold text-slate-800 text-sm truncate">
          ${cat.name}
        </span>
      </div>

      <!-- Редактор (скрыт) -->
      <div class="settings-cat-name-wrap hidden" id="cat-edit-${cat.id}">
        <!-- Input с кнопкой эмодзи -->
        <div class="relative flex items-center flex-1">
          <input type="text"
                 class="settings-cat-edit-input w-full pr-8"
                 id="cat-edit-input-${cat.id}"
                 value="${cat.name}"
                 onkeydown="if(event.key==='Enter') saveCategoryName(${cat.id});
                            if(event.key==='Escape') cancelCategoryEdit(${cat.id});"/>
          <button type="button"
                  class="absolute right-2 top-1/2 -translate-y-1/2 text-base leading-none"
                  title="Добавить эмодзи"
                  onclick="toggleEmojiPickerForEdit(event, ${cat.id})">
            😊
          </button>
        </div>
        <button onclick="saveCategoryName(${cat.id})"
                class="px-2 py-1 bg-blue-600 text-white text-[10px]
                       font-bold rounded whitespace-nowrap">OK</button>
      </div>
      
      <!-- Emoji Picker Panel для редактирования (скрыт) -->
      <div id="emoji-picker-edit-panel-${cat.id}"
           class="hidden"
           style="
             position: fixed;
             z-index: 9999;
             background: white;
             border: 1px solid #e2e8f0;
             border-radius: 12px;
             padding: 12px;
             box-shadow: 0 8px 32px rgba(0,0,0,0.15);
             width: 380px;
             max-height: 400px;
             overflow-y: auto;
           ">
        <div class="emoji-edit-grid-${cat.id}"></div>
      </div>

      <div class="flex items-center gap-1 shrink-0">
        ${!PROTECTED_CATS.includes(cat.name) ? `
          <button class="settings-icon-btn"
                  onclick="startCategoryEdit(${cat.id})"
                  title="Переименовать">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
            </svg>
          </button>
          <button class="settings-icon-btn danger"
                  onclick="deleteCategorySettings(${cat.id}, '${cat.name.replace(/'/g, "\\'")}')"
                  title="Удалить">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
          </button>
        ` : ''}
      </div>`;

    container.appendChild(item);
  });
}

function startCategoryEdit(catId) {
  // Закрываем все открытые edit-пикеры при открытии нового редактора
  closeAllEditEmojiPickers();

  document.getElementById(`cat-display-${catId}`)?.classList.add('hidden');
  const editWrap = document.getElementById(`cat-edit-${catId}`);
  editWrap?.classList.remove('hidden');
  document.getElementById(`cat-edit-input-${catId}`)?.focus();
}

function cancelCategoryEdit(catId) {
  closeAllEditEmojiPickers();
  document.getElementById(`cat-display-${catId}`)?.classList.remove('hidden');
  document.getElementById(`cat-edit-${catId}`)?.classList.add('hidden');
}

async function saveCategoryName(catId) {
  closeAllEditEmojiPickers();
  
  const input = document.getElementById(`cat-edit-input-${catId}`);
  const name  = input?.value.trim();
  if (!name) return;

  try {
    const result = await pywebview.api.update_category(catId, { name });
    if (result.success) {
      showToast('Категория обновлена', 'success');
      await reloadData();
      renderTable(App.data);
      renderSettingsView();
    } else {
      showToast('Ошибка: ' + result.error, 'error');
    }
  } catch (e) {
    showToast('Ошибка соединения', 'error');
  }
}

async function updateCategoryColor(catId, colorValue, inputEl) {
  // Обновляем кружок сразу
  const dot = inputEl.previousElementSibling;
  if (dot) dot.style.background = colorValue;

  try {
    await pywebview.api.update_category(catId, { color_code: colorValue });
    await reloadData();
    renderTable(App.data);
  } catch (e) {
    showToast('Ошибка обновления цвета', 'error');
  }
}

async function deleteCategorySettings(catId, catName) {
  const ok = await showConfirm(
    `Удалить «${catName}»?`,
    'Все связанные планы и факты будут удалены.'
  );
  if (!ok) return;

  try {
    const result = await pywebview.api.delete_category(catId);
    if (result.success) {
      showToast('Категория удалена', 'success');
      
      // Перезагружаем и ВСЕГДА перерисовываем
      await reloadData();
      renderTable(App.data);
      
      if (App.activeView === 'settings') {
        renderSettingsView();
      }
    } else {
      showToast('Ошибка: ' + result.error, 'error');
    }
  } catch (e) {
    showToast('Ошибка соединения', 'error');
  }
}

async function submitAddCategorySettings() {
  const name = document.getElementById('s-new-cat-name')?.value.trim();
  const type = document.getElementById('s-new-cat-type')?.value;

  if (!name) { showToast('Введите название категории', 'error'); return; }

  try {
    const result = await pywebview.api.add_category({
      name,
      type,
      color_code: type === 'income' ? '#10b981' : '#f43f5e',
    });
    if (result.success) {
      document.getElementById('s-new-cat-name').value = '';
      showToast(`Категория «${name}» добавлена`, 'success');
      
      // Перезагружаем данные И ВСЕГДА ПЕРЕРИСОВЫВАЕМ ТАБЛИЦУ
      await reloadData();
      renderTable(App.data);  // Всегда перерисовываем
      
      // Если открыта settings, то обновим и её
      if (App.activeView === 'settings') {
        renderSettingsView();
      }
    } else {
      showToast('Ошибка: ' + result.error, 'error');
    }
  } catch (e) {
    showToast('Ошибка соединения', 'error');
  }
}

async function saveMainSettings() {
  const startDate = document.getElementById('s-start-date')?.value;
  const strategy  = document.getElementById('s-strategy')?.value;

  if (!startDate) { showToast('Укажите дату начала', 'error'); return; }

  try {
    const result = await pywebview.api.save_settings({
      planning_start_date: startDate,
      financial_strategy:  strategy,
    });
    if (result.success) {
      showToast('Настройки сохранены', 'success');
      await reloadData();
      // Переключаемся на таблицу чтобы пользователь сразу увидел изменения
      switchView('dashboard');
      location.reload();
    } else {
      showToast('Ошибка: ' + result.error, 'error');
    }
  } catch (e) {
    showToast('Ошибка соединения', 'error');
  }
}

// Обновление цветов в visual_config
const _pendingVcUpdate = {};
let   _vcUpdateTimer   = null;

async function updateVisualColor(key, value) {
  _pendingVcUpdate[key] = value;

  // Применяем цвета мгновенно в App.data
  if (!App.data) return;
  if (!App.data.settings.visual_config) App.data.settings.visual_config = {};
  App.data.settings.visual_config[key] = value;

  // Перерисовываем таблицу сразу
  renderTable(App.data);

  // Сохраняем в БД с debounce (не спамим запросами пока тянут пикер)
  clearTimeout(_vcUpdateTimer);
  _vcUpdateTimer = setTimeout(async () => {
    const current = App.data?.settings?.visual_config || {};
    const updated = { ...current, ..._pendingVcUpdate };

    try {
      await pywebview.api.save_settings({ visual_config: updated });
    } catch (e) {
      showToast('Ошибка сохранения цвета', 'error');
    }
  }, 800);
}

// Экспорт
async function handleExport() {
  try {
    const result = await pywebview.api.export_data();
    if (!result.success) { showToast('Ошибка экспорта', 'error'); return; }

    const content  = JSON.stringify(result.data, null, 2);
    const today    = new Date().toISOString().slice(0, 10);
    const filename = `cashflow_backup_${today}.json`;

    const saved = await pywebview.api.save_file_dialog(content, filename);
    if (saved.success) {
      showToast('Данные экспортированы', 'success');
    }
  } catch (e) {
    showToast('Ошибка экспорта', 'error');
  }
}

// Импорт
async function handleImport() {
  try {
    const result = await pywebview.api.open_file_dialog();
    if (!result.success) return;   // Отменено

    const data = JSON.parse(result.content);
    if (!data.version || !data.settings) {
      showToast('Неверный формат файла', 'error');
      return;
    }

    const ok = await showConfirm(
      'Импортировать данные?',
      'Все текущие данные будут заменены.'
    );
    if (!ok) return;

    const importResult = await pywebview.api.import_data(data);
    if (importResult.success) {
      showToast('Данные импортированы', 'success');
      
      // Сначала переключаемся на dashboard, чтобы reloadData увидел правильный activeView
      switchView('dashboard');
      
      // Теперь загружаем данные — renderTable вызовется внутри reloadData
      await reloadData();
      
      // Очищаем историю undo — старые действия больше не актуальны
      UndoHistory.clear();
      
      // Прокручиваем к текущей неделе (если она есть в периоде)
      const today = getTodayISO();
      setTimeout(() => scrollToWeek(today), 150);
    } else {
      showToast('Ошибка импорта: ' + importResult.error, 'error');
    }
  } catch (e) {
    showToast('Ошибка при чтении файла', 'error');
  }
}

// ══════════════════════════════════════════════════════════════
// НАВИГАЦИЯ К ДАТЕ
// ══════════════════════════════════════════════════════════════

function scrollToWeek(dateStr, highlight = false) {
  if (!dateStr || !App.data) return;

  const target = dateStr.slice(0, 10);

  let targetWeek = App.data.weeks.find(w =>
    target >= w.week_start && target <= w.week_end
  );

  if (!targetWeek) {
    const first = App.data.weeks[0];
    const last  = App.data.weeks[App.data.weeks.length - 1];
    targetWeek  = target < first.week_start ? first : last;
  }

  const container = document.getElementById('table-scroll-container');
  const th        = document.getElementById(`week-col-${targetWeek.week_start}`);

  if (!container || !th) return;

  const STICKY_WIDTH     = 257;
  const targetScrollLeft = th.offsetLeft - STICKY_WIDTH;

  container.scrollTo({
    left:     Math.max(0, targetScrollLeft),
    behavior: 'smooth',
  });

  // Подсвечиваем колонку красным на 3 секунды
  if (highlight) highlightWeekColumn(targetWeek.week_start);
}

function scrollToToday() {
  scrollToWeek(getTodayISO(), true);
}

function highlightWeekColumn(weekStart) {
  document.querySelectorAll('.week-highlight').forEach(el => {
    el.classList.remove('week-highlight');
    el.style.removeProperty('background-color');
    el.style.removeProperty('transition');
  });

  // Только заголовок недели
  const th = document.getElementById(`week-col-${weekStart}`);
  
  if (!th) return;

  const original = th.style.backgroundColor;

  th.style.transition = 'background-color 0.3s ease';
  th.style.backgroundColor = '#fca5a5';
  th.classList.add('week-highlight');

  setTimeout(() => {
    th.style.backgroundColor = original || '';
    th.classList.remove('week-highlight');
    setTimeout(() => {
      th.style.removeProperty('transition');
    }, 300);
  }, 3000);
}

// ══════════════════════════════════════════════════════════════
// ПОДТВЕРЖДЕНИЕ
// ══════════════════════════════════════════════════════════════

function showConfirm(title, subtitle = '') {
  return new Promise(resolve => {
    document.getElementById('confirm-title').textContent    = title;
    document.getElementById('confirm-subtitle').textContent = subtitle;
    showModal('confirm-dialog');

    const ok     = document.getElementById('confirm-ok');
    const cancel = document.getElementById('confirm-cancel');

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

// ══════════════════════════════════════════════════════════════
// МОДАЛЬНЫЕ ОКНА (утилиты)
// ══════════════════════════════════════════════════════════════

function showModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.remove('hidden');
    el.classList.add('modal-show');
  }
}

function hideModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.remove('modal-show');
    el.classList.add('hidden');
  }
}

// ══════════════════════════════════════════════════════════════
// TOAST
// ══════════════════════════════════════════════════════════════

function showToast(message, type = 'success') {
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


// ══════════════════════════════════════════════════════════════
// TITLE BAR DRAG
// ══════════════════════════════════════════════════════════════

async function handleToggleMaximize() {
  await pywebview.api.toggle_maximize();

  // Небольшая задержка чтобы окно успело изменить размер
  setTimeout(() => {
    const btn = document.getElementById('btn-maximize');
    if (!btn) return;

    // Проверяем по соотношению размера окна к экрану
    const isMax = (
      window.outerWidth  >= screen.availWidth  - 20 &&
      window.outerHeight >= screen.availHeight - 20
    );

    btn.innerHTML = isMax
      ? `<svg viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1">
           <rect x="2" y="0" width="8" height="8"/>
           <path d="M0 2v8h8" fill="none"/>
         </svg>`
      : `<svg viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1">
           <rect x="0.5" y="0.5" width="9" height="9"/>
         </svg>`;

    btn.title = isMax ? 'Восстановить' : 'Развернуть';
  }, 100);
}

// async function updateMaximizeIcon() {
//   const btn = document.getElementById('btn-maximize');
//   if (!btn) return;

//   try {
//     const hwndInfo = await pywebview.api.toggle_maximize();
//     // toggle_maximize уже сработал — это неправильно для проверки
//     // поэтому используем размер окна как индикатор
//   } catch (e) {}
// }

(function initTitleBarDrag() {
  const titleBar = document.getElementById('title-bar');
  if (!titleBar) return;

  let isDragging   = false;
  let startMouseX  = 0;
  let startMouseY  = 0;
  let startWinX    = 0;
  let startWinY    = 0;

  titleBar.addEventListener('mousedown', async (e) => {
    // Только левая кнопка мыши
    if (e.button !== 0) return;

    // Не начинаем drag если кликнули по кнопке или интерактивному элементу
    if (e.target.closest('button')) return;

    // Не drag если окно maximized — сначала restore
    // (Windows-поведение: при перетаскивании maximize окно восстанавливается)
    isDragging  = false;

    // Запоминаем стартовую позицию мыши на экране
    startMouseX = e.screenX;
    startMouseY = e.screenY;

    // Получаем текущую позицию окна
    try {
      const pos = await pywebview.api.get_window_pos();
      if (!pos.success) return;
      startWinX = pos.x;
      startWinY = pos.y;
      isDragging = true;
    } catch (err) {
      return;
    }

    e.preventDefault();
  });

  document.addEventListener('mousemove', async (e) => {
    if (!isDragging) return;

    const dx = e.screenX - startMouseX;
    const dy = e.screenY - startMouseY;

    const newX = startWinX + dx;
    const newY = startWinY + dy;

    try {
      await pywebview.api.move_window(newX, newY);
    } catch (err) {
      isDragging = false;
    }
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
  });

  // Двойной клик по title bar — maximize/restore
  titleBar.addEventListener('dblclick', (e) => {
    if (e.target.closest('button')) return;
    pywebview.api.toggle_maximize();
  });
})();


// ══════════════════════════════════════════════════════════════
// ЗАГРУЗКА ДАННЫХ
// ══════════════════════════════════════════════════════════════

async function reloadData() {
  try {
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout')), 10000)
    );
    
    const data = await Promise.race([
      pywebview.api.get_cashflow_data(),
      timeoutPromise
    ]);
    
    if (data.error) { console.error('Ошибка данных:', data.error); return; }
    App.data = data;
    
    if (App.activeView === 'dashboard') {
      renderTable(data);
    }
  } catch (e) {
    console.error('Ошибка загрузки:', e);
  }
}

async function init() {
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

  // Загружаем название счёта в title bar
  try {
    const acc = await pywebview.api.get_account_name();
    if (acc.success && acc.name) {
      const el = document.getElementById('title-bar-account-name');
      if (el) el.textContent = acc.name;
    }
  } catch (e) { /* ignore */ }

  //Проверка текущей даты
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
}

// ══════════════════════════════════════════════════════════════
// ОТМЕНА ДЕЙСТВИЙ (UNDO)
// ══════════════════════════════════════════════════════════════

let _undoInProgress = false;

async function undoLastAction() {
  if (_undoInProgress) return;

  if (UndoHistory.isEmpty()) {
    showToast('Нечего отменять', 'info');
    return;
  }

  _undoInProgress = true;
  closeActiveCellEditor(true);

  const action = UndoHistory.pop();

  try {
    if (action.type === ACTION_TYPES.CELL_EDIT) {
      await undoCellEdit(action);
    } else if (action.type === ACTION_TYPES.AUTOFILL) {
      await undoAutofill(action);
    } else if (action.type === ACTION_TYPES.LOAN_REPAYMENT) {
      await undoLoanRepayment(action);
    }
    showToast('Действие отменено', 'success');
    await reloadData();
  } catch (e) {
    console.error('Ошибка отмены:', e);
    showToast('Ошибка при отмене действия', 'error');
    UndoHistory.push(action);
  } finally {
    _undoInProgress = false;
    setTimeout(() => { _undoInProgress = false; }, 5000);
  }
}

async function undoCellEdit(action) {
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
  const { weekStart, weekEnd } = action;
  await pywebview.api.undo_loan_repayment({
    week_start: weekStart,
    week_end:   weekEnd,
  });
}

// Горячая клавиша Ctrl+Z — capture:true чтобы перехватить ДО input
window.addEventListener('keydown', (e) => {
  if (!isUndoShortcut(e)) return;
  e.preventDefault();
  e.stopPropagation();
  undoLastAction();
}, true);

// Закрываем редактор при потере фокуса окном (alt+tab и т.д.)
window.addEventListener('blur', () => {
  closeActiveCellEditor(true);
});


// ══════════════════════════════════════════════════════════════
// EMOJI PICKER
// ══════════════════════════════════════════════════════════════

const EMOJI_CATEGORIES = {
  '😊 Смайлики': [
    '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', 
    '😉', '😌', '😍', '🥰', '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪',
    '😌', '😔', '😑', '🤐', '🤨', '😐', '😏', '😒', '🙁', '☹️', '🥺', '😲',
    '😞', '😖', '😢', '😭', '😤', '😠', '😡', '🤬', '😈', '👿', '💀', '☠️',
    '💩', '🤡', '👹', '👺', '👻', '👽', '👾', '🤖', '😺', '😸', '😹', '😻',
    '😼', '😽', '🙀', '😿', '😾',
  ],

  '👋 Жесты': [
    '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🫰', '🤟',
    '🤘', '🤙', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲',
    '🤝', '💅', '🤳', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '👃', '🧠', '🦷',
    '🦴', '👀', '👁️', '👅', '👄',
  ],

  '🐶 Животные': [
    '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮',
    '🐷', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🦆',
    '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞',
    '🐜', '🪰', '🪲', '🦟', '🦗', '🕷️', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕',
    '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈',
    '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒',
    '🦘', '🐃', '🐂', '🐄', '🐎', '🐖', '🐏', '🐑', '🦉', '🐐', '🦌', '🐕',
    '🐩', '🦮', '🐈', '🐓', '🦃', '🦚', '🦜', '🦢', '🦗', '🕷️',
  ],

  '🍔 Еда и напитки': [
    '🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍈', '🍒', '🍑',
    '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🌽',
    '🥕', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🧈',
    '🥞', '🥓', '🥔', '🌭', '🍔', '🍟', '🍕', '🥪', '🥙', '🧆', '🌮', '🌯',
    '🥗', '🥘', '🥫', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🦪', '🍤',
    '🍙', '🍚', '🍘', '🍥', '🥠', '🥮', '🍢', '🍡', '🍧', '🍨', '🍦', '🍰',
    '🎂', '🧁', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪', '🌰', '🍯', '☕',
    '🍵', '🍶', '🍾', '🍷', '🍸', '🍹', '🍺', '🍻', '🥂', '🥃', '🥤', '🧃',
    '🧉', '🧊',
  ],

  '⚽ Спорт': [
    '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎳', '🏓', '🏸',
    '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳', '⛸️', '🎣', '🎽', '🎿', '⛷️',
    '🏂', '🪂', '🛷', '🥌', '🎯', '🪀', '🪁', '🎮', '🎲', '🏈', '🏀', '⚽',
  ],

  '🚗 Транспорт': [
    '🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚',
    '🚛', '🚜', '🏍️', '🛵', '🦯', '🦽', '🦼', '🛺', '🚲', '🛴', '🛹', '🛼',
    '🚨', '🚔', '🚍', '🚘', '🚖', '🚡', '🚠', '🚟', '🚃', '🚋', '🚞', '🚝',
    '🚄', '🚅', '🚈', '🚆', '🚇', '🚉', '✈️', '🛫', '🛬', '🛰️', '🚁', '🛶',
    '⛵', '🚤', '🛳️', '⛴️', '🛥️', '🚢', '⚓',
  ],

  '🌍 Путешествия': [
    '🌍', '🌎', '🌏', '🌐', '🗺️', '🗿', '🗽', '⛪', '🕌', '🕍', '🛕', '🕋',
    '⛩️', '🛤️', '🛣️', '🗾', '⛲', '⛺', '🏠', '🏡', '🏢', '🏣', '🏤', '🏥',
    '🏦', '🏨', '🏪', '🏫', '🏬', '🏭', '🏯', '🏰', '💒', '🗼', '🗻', '🌁',
    '🌃', '🌄', '🌅', '🌆', '🌇', '🌉', '🌁', '⛰️', '🏔️', '🗻', '🌋', '⛰️',
    '🏕️', '⛺',
  ],

  '💰 Деньги': [
    '💰', '💴', '💵', '💶', '💷', '💸', '💳', '🧾', '💎', '⌚', '👜', '👝',
    '🎁', '🏠', '🚗', '✈️',
  ],

  '❤️ Символы': [
    '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '❤️‍🔥', '❤️‍🩹',
    '💔', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '💌', '💛', '💜',
    '💚', '💙', '🤍', '🤎', '🖤', '💔', '✨', '⭐', '🌟', '💫', '⚡', '☄️',
    '💥', '🔥', '🌪️', '🌈', '☀️', '🌤️', '⛅', '🌥️', '☁️', '🌦️', '🌧️', '⛈️',
    '🌩️', '🌨️', '❄️', '☃️', '⛄', '🌬️', '💨', '💧', '💦', '☔', '🌊', '🏄',
    '🏊', '🤽', '🚣', '🧗', '🚴', '🚵', '🤸', '⛹️', '🏋️', '🤼', '🤸', '⛹️',
  ],

  '🌸 Природа': [
    '🌷', '🌹', '🥀', '🌺', '🌻', '🌼', '🌸', '🌞', '🌝', '🌛', '🌜', '⭐',
    '🌟', '✨', '⚡', '☄️', '💥', '🔥', '🌪️', '🌈', '☀️', '🌤️', '⛅', '🌥️',
    '☁️', '🌦️', '🌧️', '⛈️', '🌩️', '⛈️', '🌨️', '❄️', '☃️', '⛄', '🌬️', '💨',
    '💧', '💦', '☔', '🍀', '🌿', '☘️', '🎍', '🎋', '🍃', '🍂', '🍁', '🍄',
    '🌾', '💐', '🌷', '🌹', '🥀', '🌺', '🌻', '🌼', '🌸',
  ],

  '⏰ Время': [
    '⏰', '🕰️', '⏱️', '⏲️', '🕐', '🕑', '🕒', '🕓', '🕔', '🕕', '🕖', '🕗',
    '🕘', '🕙', '🕚', '🕛', '🕧', '🕜', '🕝', '🕞', '🕟', '🕠', '🕡', '🕢',
    '🕣', '🕤', '🕥',
  ],

  '🎨 Развлечения': [
    '🎪', '🎨', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁', '🎷', '🎺', '🎸', '🎻',
    '🎲', '🎯', '🎳', '🎮', '🎰', '🧩', '🚗', '🎭', '🎪', '🎨', '🎬',
  ],
};

function initEmojiPicker() {
  const grid = document.getElementById('emoji-grid');
  if (!grid) return;
  
  grid.innerHTML = '';
  
  // Создаём контейнер с вкладками
  const container = grid.parentElement;
  container.innerHTML = '';
  
  const tabs = document.createElement('div');
  tabs.style.cssText = `
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
    border-bottom: 1px solid #e2e8f0;
    overflow-x: auto;
    padding-bottom: 8px;
  `;
  
  const gridContainer = document.createElement('div');
  gridContainer.id = 'emoji-grid';
  gridContainer.style.cssText = `
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    gap: 6px;
  `;
  
  let firstTab = true;
  
  Object.entries(EMOJI_CATEGORIES).forEach(([category, emojis]) => {
    // Кнопка вкладки
    const tabBtn = document.createElement('button');
    tabBtn.type = 'button';
    tabBtn.style.cssText = `
      padding: 6px 12px;
      border: none;
      background: transparent;
      cursor: pointer;
      font-size: 16px;
      opacity: ${firstTab ? '1' : '0.5'};
      border-bottom: ${firstTab ? '2px solid #3b82f6' : 'none'};
      transition: all 0.2s ease;
      white-space: nowrap;
    `;
    tabBtn.textContent = category.split(' ')[0];
    tabBtn.className = firstTab ? 'emoji-tab active' : 'emoji-tab';
    
    tabBtn.addEventListener('mouseover', () => {
      tabBtn.style.opacity = '1';
    });
    
    tabBtn.addEventListener('mouseout', () => {
      if (!tabBtn.classList.contains('active')) {
        tabBtn.style.opacity = '0.5';
      }
    });
    
    tabBtn.addEventListener('click', (e) => {
      e.preventDefault();
      
      // Обновляем активную вкладку
      document.querySelectorAll('.emoji-tab').forEach(t => {
        t.classList.remove('active');
        t.style.opacity = '0.5';
        t.style.borderBottom = 'none';
      });
      tabBtn.classList.add('active');
      tabBtn.style.opacity = '1';
      tabBtn.style.borderBottom = '2px solid #3b82f6';
      
      // Рендерим эмодзи для этой категории
      gridContainer.innerHTML = '';
      emojis.forEach(emoji => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'emoji-btn';
        btn.textContent = emoji;
        btn.title = emoji;
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          insertEmoji(emoji);
        });
        gridContainer.appendChild(btn);
      });
    });
    
    tabs.appendChild(tabBtn);
    firstTab = false;
  });
  
  container.appendChild(tabs);
  container.appendChild(gridContainer);
  
  // Рендерим первую категорию по умолчанию
  const firstCategory = Object.values(EMOJI_CATEGORIES)[0];
  firstCategory.forEach(emoji => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'emoji-btn';
    btn.textContent = emoji;
    btn.title = emoji;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      insertEmoji(emoji);
    });
    gridContainer.appendChild(btn);
  });
}

function toggleEmojiPicker(event) {
  event.preventDefault();
  event.stopPropagation();
  
  const panel = document.getElementById('emoji-picker-panel');
  const isHidden = panel.classList.contains('hidden');
  
  if (isHidden) {
    initEmojiPicker();
    panel.classList.remove('hidden');
    
    const input = document.getElementById('s-new-cat-name');
    const rect = input.getBoundingClientRect();
    
    // Позиционирование с учётом границ окна
    let top = rect.bottom + 5;
    let left = rect.left;
    
    // Если панель выходит за границы экрана
    const windowHeight = window.innerHeight;
    const panelHeight = 380;
    
    if (top + panelHeight > windowHeight - 20) {
      top = rect.top - panelHeight - 5;
    }
    
    panel.style.top = top + 'px';
    panel.style.left = left + 'px';
    
    setTimeout(() => {
      document.addEventListener('click', closeEmojiPicker);
    }, 0);
  } else {
    panel.classList.add('hidden');
    document.removeEventListener('click', closeEmojiPicker);
  }
}

function closeEmojiPicker(e) {
  const panel = document.getElementById('emoji-picker-panel');
  const btn = document.getElementById('emoji-picker-btn');
  const input = document.getElementById('s-new-cat-name');
  
  if (!panel.contains(e.target) && !btn.contains(e.target) && !input.contains(e.target)) {
    panel.classList.add('hidden');
    document.removeEventListener('click', closeEmojiPicker);
  }
}

function insertEmoji(emoji) {
  const input = document.getElementById('s-new-cat-name');
  const cursorPos = input.selectionStart;
  const text = input.value;
  
  const newText = text.slice(0, cursorPos) + emoji + text.slice(cursorPos);
  input.value = newText;
  
  input.focus();
  input.setSelectionRange(cursorPos + emoji.length, cursorPos + emoji.length);
  
  document.getElementById('emoji-picker-panel').classList.add('hidden');
  document.removeEventListener('click', closeEmojiPicker);
}


// ══════════════════════════════════════════════════════════════
// EMOJI PICKER ДЛЯ РЕДАКТИРОВАНИЯ СУЩЕСТВУЮЩИХ КАТЕГОРИЙ
// ══════════════════════════════════════════════════════════════

// Хранит catId текущего открытого пикера редактирования
let _activeEditEmojiCatId = null;

function toggleEmojiPickerForEdit(event, catId) {
  event.preventDefault();
  event.stopPropagation();

  const panel = document.getElementById(`emoji-picker-edit-panel-${catId}`);
  if (!panel) return;

  const isHidden = panel.classList.contains('hidden');

  // Закрываем все открытые edit-пикеры
  closeAllEditEmojiPickers();

  if (!isHidden) return; // Был открыт — просто закрыли

  // Инициализируем содержимое
  initEmojiPickerForEdit(catId);

  // Позиционируем панель
  const input = document.getElementById(`cat-edit-input-${catId}`);
  if (input) {
    const rect = input.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    const panelHeight  = 400;

    let top  = rect.bottom + 5;
    let left = rect.left;

    // Не вылезаем за нижнюю границу
    if (top + panelHeight > windowHeight - 20) {
      top = rect.top - panelHeight - 5;
    }
    // Не вылезаем за правую границу
    const windowWidth  = window.innerWidth;
    const panelWidth   = 380;
    if (left + panelWidth > windowWidth - 20) {
      left = windowWidth - panelWidth - 20;
    }

    panel.style.top  = `${top}px`;
    panel.style.left = `${left}px`;
  }

  panel.classList.remove('hidden');
  _activeEditEmojiCatId = catId;

  // Закрывать по клику вне панели
  setTimeout(() => {
    document.addEventListener('click', _onOutsideEditEmojiClick);
  }, 0);
}

function _onOutsideEditEmojiClick(e) {
  if (_activeEditEmojiCatId === null) return;

  const panel = document.getElementById(
    `emoji-picker-edit-panel-${_activeEditEmojiCatId}`
  );
  const btn   = document.querySelector(
    `#cat-edit-${_activeEditEmojiCatId} button[title="Добавить эмодзи"]`
  );

  if (
    (!panel || !panel.contains(e.target)) &&
    (!btn   || !btn.contains(e.target))
  ) {
    closeAllEditEmojiPickers();
  }
}

function closeAllEditEmojiPickers() {
  document.querySelectorAll('[id^="emoji-picker-edit-panel-"]').forEach(p => {
    p.classList.add('hidden');
  });
  document.removeEventListener('click', _onOutsideEditEmojiClick);
  _activeEditEmojiCatId = null;
}

function initEmojiPickerForEdit(catId) {
  const panel = document.getElementById(`emoji-picker-edit-panel-${catId}`);
  if (!panel) return;

  // Очищаем и строим структуру с вкладками
  panel.innerHTML = '';

  const tabs = document.createElement('div');
  tabs.style.cssText = `
    display: flex;
    gap: 8px;
    margin-bottom: 10px;
    border-bottom: 1px solid #e2e8f0;
    overflow-x: auto;
    padding-bottom: 8px;
  `;

  const gridContainer = document.createElement('div');
  gridContainer.style.cssText = `
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    gap: 6px;
  `;

  let firstTab = true;

  Object.entries(EMOJI_CATEGORIES).forEach(([category, emojis]) => {
    const tabBtn = document.createElement('button');
    tabBtn.type = 'button';
    tabBtn.style.cssText = `
      padding: 5px 10px;
      border: none;
      background: transparent;
      cursor: pointer;
      font-size: 16px;
      opacity: ${firstTab ? '1' : '0.5'};
      border-bottom: ${firstTab ? '2px solid #3b82f6' : '2px solid transparent'};
      transition: all 0.15s ease;
      white-space: nowrap;
      flex-shrink: 0;
    `;
    tabBtn.textContent = category.split(' ')[0];
    tabBtn.className   = firstTab ? 'emoji-tab-edit active' : 'emoji-tab-edit';

    tabBtn.addEventListener('mouseover', () => {
      if (!tabBtn.classList.contains('active')) tabBtn.style.opacity = '0.8';
    });
    tabBtn.addEventListener('mouseout', () => {
      if (!tabBtn.classList.contains('active')) tabBtn.style.opacity = '0.5';
    });

    tabBtn.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();

      // Активируем вкладку
      panel.querySelectorAll('.emoji-tab-edit').forEach(t => {
        t.classList.remove('active');
        t.style.opacity = '0.5';
        t.style.borderBottom = '2px solid transparent';
      });
      tabBtn.classList.add('active');
      tabBtn.style.opacity = '1';
      tabBtn.style.borderBottom = '2px solid #3b82f6';

      // Рендерим эмодзи
      renderEmojiGrid(gridContainer, emojis, catId);
    });

    tabs.appendChild(tabBtn);

    // Первая категория рендерится сразу
    if (firstTab) {
      firstTab = false;
      // рендер будет после цикла
    }
  });

  panel.appendChild(tabs);
  panel.appendChild(gridContainer);

  // Рендерим первую категорию
  const firstEmojis = Object.values(EMOJI_CATEGORIES)[0];
  renderEmojiGrid(gridContainer, firstEmojis, catId);
}

function renderEmojiGrid(gridContainer, emojis, catId) {
  gridContainer.innerHTML = '';
  emojis.forEach(emoji => {
    const btn = document.createElement('button');
    btn.type      = 'button';
    btn.className = 'emoji-btn';
    btn.textContent = emoji;
    btn.title       = emoji;
    btn.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      insertEmojiForEdit(emoji, catId);
    });
    gridContainer.appendChild(btn);
  });
}

function insertEmojiForEdit(emoji, catId) {
  const input = document.getElementById(`cat-edit-input-${catId}`);
  if (!input) return;

  const cursorPos = input.selectionStart ?? input.value.length;
  const text      = input.value;

  input.value = text.slice(0, cursorPos) + emoji + text.slice(cursorPos);

  input.focus();
  const newPos = cursorPos + emoji.length;
  input.setSelectionRange(newPos, newPos);

  // Закрываем пикер после выбора
  closeAllEditEmojiPickers();
}

init();