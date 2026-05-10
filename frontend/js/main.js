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
};

const Autofill = {
  categoryId: null,
};

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
    view === 'dashboard' ? 'Таблица планирования' : 'Настройки приложения';

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
    if (isCurrent) {
      th.style.backgroundColor = cwColor;
    }

    const startD = new Date(week.week_start + 'T00:00:00');
    const endD   = new Date(week.week_end   + 'T00:00:00');
    const fmt    = d => `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}`;

    th.innerHTML = `
      <div class="week-number">Неделя ${week.week_number}</div>
      <div class="week-dates">${fmt(startD)} - ${fmt(endD)}</div>`;
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
        <!-- Repeat icon -->
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24"
             stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round"
            d="M17 1l4 4-4 4M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4m14
               4H3v-2a4 4 0 014-4h14"/>
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
    td.style.backgroundColor = `${cwColor}40`;
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
  // Закрываем предыдущий
  closeActiveCellEditor();

  const catId    = parseInt(td.dataset.categoryId);
  const weekStart = td.dataset.weekStart;
  const weekEnd   = td.dataset.weekEnd;
  const key       = `${catId}:${weekStart}`;
  const plan      = App.data.plans[key];
  const factArr   = App.data.facts[key];
  const factTotal = factArr ? factArr.reduce((s, f) => s + f.amount, 0) : 0;

  App.editing = { categoryId: catId, weekStart, weekEnd, mode: initialMode, el: td };

  // Начальное значение
  let initVal = '';
  if (initialMode === 'fact' && factTotal) initVal = factTotal.toString();
  else if (initialMode === 'plan' && plan)  initVal = plan.amount.toString();

  // Строим редактор
  const editor = document.createElement('div');
  editor.className = 'cell-editor';
  editor.id        = 'active-cell-editor';

  editor.innerHTML = `
    <div class="cell-editor-tabs">
      <button class="cell-editor-tab ${initialMode === 'plan' ? 'active' : ''}"
              data-mode="plan"
              onmousedown="event.preventDefault(); setCellEditorMode('plan')">
        План
      </button>
      <span style="color:#e2e8f0">|</span>
      <button class="cell-editor-tab ${initialMode === 'fact' ? 'active' : ''}"
              data-mode="fact"
              onmousedown="event.preventDefault(); setCellEditorMode('fact')">
        Факт
      </button>
    </div>
    <input
      id="cell-editor-input"
      type="text"
      value="${initVal}"
      autocomplete="off"
    />`;

  td.style.position = 'relative';
  td.appendChild(editor);

  const input = document.getElementById('cell-editor-input');
  input.focus();
  input.select();

  input.addEventListener('blur',    () => saveCellEditor());
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); saveCellEditor(); }
    if (e.key === 'Escape') { e.preventDefault(); closeActiveCellEditor(true); }
  });
}

function setCellEditorMode(mode) {
  App.editing.mode = mode;
  document.querySelectorAll('.cell-editor-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.mode === mode);
  });
}

function closeActiveCellEditor(cancel = false) {
  const editor = document.getElementById('active-cell-editor');
  if (editor) {
    editor.remove();
  }
  if (cancel && App.editing.el) {
    refreshCellContent(App.editing.el, App.data?.plans, App.data?.facts);
  }
  App.editing = {
    categoryId: null, weekStart: null,
    weekEnd: null, mode: 'plan', el: null,
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

  // Оптимистичное обновление локального кэша
  const key = `${categoryId}:${weekStart}`;
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
    const wt = weekTotals[i];
    if (!wt) return;
    running += wt.inc - wt.exp;

    const inner = td.querySelector('.balance-cell-inner');
    const isNeg = running < 0;

    inner.innerHTML = `
      ${isNeg ? `
        <button class="wand-btn"
                onclick="handleDeficit(event,'${wt.weekStart}',
                         '${weeks[i].week_end}',
                         ${Math.abs(running).toFixed(2)})"
                title="Покрыть дефицит">🪄</button>` : ''}
      <span style="${isNeg ? `color:${negColor}` : ''}">${formatAmount(running)}</span>`;
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

    const isCurrent = isCurrentWeek(week.week_start, week.week_end);
    if (isCurrent) td.style.backgroundColor = `${cwColor}30`;
    if (type === 'income') td.style.background = 'rgba(236,253,245,0.3)';
    if (type === 'expense') td.style.background = 'rgba(255,241,242,0.3)';

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

  const tdLabel = document.createElement('td');
  tdLabel.className = 'td-sticky balance-init-cell';
  tdLabel.style.backgroundColor = weekColor;
  tdLabel.innerHTML = `
    <div style="padding:6px 16px;font-size:11px;font-weight:700;
                text-transform:uppercase;letter-spacing:0.04em;
                color:rgba(255,255,255,0.7);"
         title="Кликните чтобы изменить начальный баланс">
      Остаток (Баланс)
    </div>`;

  // Клик на первую ячейку = редактирование initial_balance
  tdLabel.addEventListener('click', () => openInitBalanceEditor(tdLabel, initialBalance));
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
    td.style.backgroundColor = weekColor;
    td.style.borderColor = 'rgba(255,255,255,0.3)';
    td.style.textAlign = 'right';

    const isCurrent = isCurrentWeek(week.week_start, week.week_end);
    if (isCurrent) td.style.backgroundColor = `${cwColor}90`;

    td.innerHTML = `
      <div class="balance-cell-inner" style="padding:0 8px;">
        ${isNeg ? `
          <button class="wand-btn"
                  onclick="handleDeficit(event,'${week.week_start}',
                           '${week.week_end}',
                           ${Math.abs(running).toFixed(2)})"
                  title="Покрыть дефицит">🪄</button>` : ''}
        <span style="${isNeg ? `color:${negColor}` : 'color:white'}">
          ${formatAmount(running)}
        </span>
      </div>`;

    tr.appendChild(td);
  });

  return tr;
}

// ── Редактирование initial_balance ─────────────────────────────────────────────
function openInitBalanceEditor(td, currentValue) {
  // Убираем редактор если уже открыт
  const existing = document.getElementById('init-balance-editor');
  if (existing) existing.remove();

  const editor = document.createElement('div');
  editor.id = 'init-balance-editor';
  editor.style.cssText = `
    position: absolute; inset: 0; background: white; z-index: 30;
    display: flex; flex-direction: column; padding: 4px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    border-radius: 4px; border: 1px solid #93c5fd;`;
  editor.innerHTML = `
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;
                color:#94a3b8;margin-bottom:4px;text-align:center;">
      Начальный баланс
    </div>
    <input id="init-balance-input" type="text"
           value="${currentValue}"
           style="border:1px solid #93c5fd;border-radius:4px;padding:2px 6px;
                  text-align:right;font-size:13px;outline:none;
                  font-family:inherit;font-variant-numeric:tabular-nums;
                  color:#1e293b;"/>`;

  td.style.position = 'relative';
  td.appendChild(editor);

  const input = document.getElementById('init-balance-input');
  input.focus();
  input.select();

  const save = async () => {
    const amount = evalAmount(input.value);
    editor.remove();
    td.style.position = '';

    try {
      await pywebview.api.update_account({ initial_balance: amount });
      await reloadData();
    } catch (e) {
      showToast('Ошибка сохранения', 'error');
    }
  };

  input.addEventListener('blur', save);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); save(); }
    if (e.key === 'Escape') { e.preventDefault(); editor.remove(); }
  });
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

function openAutofill(event, categoryId) {
  event.stopPropagation();
  Autofill.categoryId = categoryId;

  const cat = App.data.categories.find(c => c.id === categoryId);
  document.getElementById('autofill-cat-name').textContent = cat?.name || '';

  // Начальная дата = понедельник текущей недели
  const monday = getMondayOf(getTodayISO());
  document.getElementById('autofill-start-date').value = monday;
  document.getElementById('autofill-weeks').value       = 12;
  document.getElementById('autofill-amount').value      = '';
  document.getElementById('autofill-week-hint').classList.add('hidden');

  showModal('autofill-modal');
}

function closeAutofillModal() {
  hideModal('autofill-modal');
}

// Подсказка какая неделя будет выбрана
document.getElementById('autofill-start-date')
  ?.addEventListener('change', function() {
    const val   = this.value;
    const hint  = document.getElementById('autofill-week-hint');
    if (!val || !App.data) { hint.classList.add('hidden'); return; }

    const monday = getMondayOf(val);
    const week   = App.data.weeks.find(w => w.week_start === monday);
    if (week) {
      hint.textContent = `Начнётся с: ${week.label}`;
      hint.classList.remove('hidden');
    }
  });

async function submitAutofill() {
  const startDate  = document.getElementById('autofill-start-date').value;
  const weeksCount = parseInt(document.getElementById('autofill-weeks').value);
  const amount     = parseFloat(document.getElementById('autofill-amount').value);

  if (!startDate)           { showToast('Укажите начальную дату', 'error'); return; }
  if (!weeksCount || weeksCount <= 0) { showToast('Укажите количество недель', 'error'); return; }
  if (!amount || amount <= 0) { showToast('Укажите сумму', 'error'); return; }

  try {
    const result = await pywebview.api.autofill({
      category_id:  Autofill.categoryId,
      start_date:   startDate,
      weeks_count:  weeksCount,
      amount,
    });
    if (result.success) {
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

document.getElementById('autofill-modal')
  ?.addEventListener('click', function(e) {
    if (e.target === this) closeAutofillModal();
  });

// ══════════════════════════════════════════════════════════════
// КАССОВЫЙ РАЗРЫВ
// ══════════════════════════════════════════════════════════════

async function handleDeficit(event, weekStart, weekEnd, deficitAmount) {
  event.stopPropagation();
  if (!App.data) return;

  const strategy = App.data.settings.financial_strategy;
  Deficit.weekStart = weekStart;
  Deficit.weekEnd   = weekEnd;
  Deficit.amount    = deficitAmount;

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

    // Дата возврата: +4 недели от weekStart
    const ret = new Date(weekStart + 'T00:00:00');
    ret.setDate(ret.getDate() + 28);
    document.getElementById('deficit-return-date').value =
      ret.toISOString().split('T')[0];

    showModal('deficit-modal');
  }
}

function closeDeficitModal() {
  hideModal('deficit-modal');
}

async function submitDeficit() {
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
      closeDeficitModal();
      showToast('Займ оформлен, возврат запланирован', 'success');
      await reloadData();
    } else {
      showToast('Ошибка: ' + result.error, 'error');
    }
  } catch (e) {
    showToast('Ошибка соединения', 'error');
  }
}

document.getElementById('deficit-modal')
  ?.addEventListener('click', function(e) {
    if (e.target === this) closeDeficitModal();
  });

// ══════════════════════════════════════════════════════════════
// СВЕРКА БАЛАНСА
// ══════════════════════════════════════════════════════════════

async function openReconcileModal() {
  const today  = getTodayISO();
  const monday = getMondayOf(today);
  const sun    = new Date(monday + 'T00:00:00');
  sun.setDate(sun.getDate() + 6);
  const weekEnd = sun.toISOString().split('T')[0];

  document.getElementById('reconcile-date').value   = today;
  document.getElementById('reconcile-actual').value = '';
  document.getElementById('reconcile-diff-preview').classList.add('hidden');
  document.getElementById('reconcile-calculated').textContent = '...';

  showModal('reconcile-modal');

  try {
    const res = await pywebview.api.get_calculated_balance(monday);
    const el  = document.getElementById('reconcile-calculated');
    if (res.success) {
      el.textContent         = `${formatAmount(res.balance)} ₽`;
      el.dataset.value       = res.balance;
      el.dataset.weekStart   = monday;
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

      <!-- Форма добавления -->
      <div class="pt-4 border-t border-slate-100 flex items-end gap-3 max-w-2xl">
        <div class="flex-1">
          <label class="block text-[10px] font-bold text-slate-500 mb-1 uppercase">
            Добавить статью
          </label>
          <div class="flex gap-2">
            <input type="text" id="s-new-cat-name"
                   placeholder="Название (можно с эмодзи 🎯)"
                   class="settings-input flex-[2]"
                   onkeydown="if(event.key==='Enter') submitAddCategorySettings()"/>
            <select id="s-new-cat-type" class="settings-select flex-1">
              <option value="expense">Расход</option>
              <option value="income">Доход</option>
            </select>
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
        <input type="text"
               class="settings-cat-edit-input"
               id="cat-edit-input-${cat.id}"
               value="${cat.name}"
               onkeydown="if(event.key==='Enter') saveCategoryName(${cat.id});
                          if(event.key==='Escape') cancelCategoryEdit(${cat.id});"/>
        <button onclick="saveCategoryName(${cat.id})"
                class="px-2 py-1 bg-blue-600 text-white text-[10px]
                       font-bold rounded whitespace-nowrap">OK</button>
      </div>

      <div class="flex items-center gap-1 shrink-0">
        <button class="settings-icon-btn"
                onclick="startCategoryEdit(${cat.id})"
                title="Переименовать">
          <!-- Edit icon -->
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24"
               stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5
                 m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586
                 -8.586z"/>
          </svg>
        </button>
        ${cat.is_custom ? `
          <button class="settings-icon-btn danger"
                  onclick="deleteCategorySettings(${cat.id}, '${cat.name.replace(/'/g, "\\'")}')"
                  title="Удалить">
            <!-- Trash icon -->
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24"
                 stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0
                   01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1
                   1 0 00-1 1v3M4 7h16"/>
            </svg>
          </button>` : ''}
      </div>`;

    container.appendChild(item);
  });
}

function startCategoryEdit(catId) {
  document.getElementById(`cat-display-${catId}`)?.classList.add('hidden');
  const editWrap = document.getElementById(`cat-edit-${catId}`);
  editWrap?.classList.remove('hidden');
  document.getElementById(`cat-edit-input-${catId}`)?.focus();
}

function cancelCategoryEdit(catId) {
  document.getElementById(`cat-display-${catId}`)?.classList.remove('hidden');
  document.getElementById(`cat-edit-${catId}`)?.classList.add('hidden');
}

async function saveCategoryName(catId) {
  const input = document.getElementById(`cat-edit-input-${catId}`);
  const name  = input?.value.trim();
  if (!name) return;

  try {
    const result = await pywebview.api.update_category(catId, { name });
    if (result.success) {
      showToast('Категория обновлена', 'success');
      await reloadData();
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
      await reloadData();
      renderSettingsView();
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
      await reloadData();
      renderSettingsView();
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

  clearTimeout(_vcUpdateTimer);
  _vcUpdateTimer = setTimeout(async () => {
    const current = App.data?.settings?.visual_config || {};
    const updated = { ...current, ..._pendingVcUpdate };

    try {
      await pywebview.api.save_settings({ visual_config: updated });
      await reloadData();
    } catch (e) {
      showToast('Ошибка сохранения цвета', 'error');
    }
  }, 600);   // debounce 600ms пока тянут пикер
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
      await reloadData();
      renderSettingsView();
      switchView('dashboard');
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

function scrollToWeek(dateStr) {
  if (!dateStr || !App.data) return;
  const monday = getMondayOf(dateStr);

  // Ищем ближайшую неделю
  let targetWeek = App.data.weeks.find(w => w.week_start === monday);
  if (!targetWeek) {
    // Снапаем к первой или последней
    const t = new Date(dateStr).getTime();
    const first = new Date(App.data.weeks[0].week_start).getTime();
    targetWeek = t < first
      ? App.data.weeks[0]
      : App.data.weeks[App.data.weeks.length - 1];
  }

  const el        = document.getElementById(`week-col-${targetWeek.week_start}`);
  const container = document.getElementById('table-scroll-container');
  if (el && container) {
    const containerRect = container.getBoundingClientRect();
    const elRect        = el.getBoundingClientRect();
    const targetLeft    =
      container.scrollLeft + (elRect.left - containerRect.left) - 280;
    container.scrollTo({ left: targetLeft, behavior: 'smooth' });
  }
}

document.getElementById('date-picker')
  ?.addEventListener('change', e => scrollToWeek(e.target.value));

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
// ЗАГРУЗКА ДАННЫХ
// ══════════════════════════════════════════════════════════════

async function reloadData() {
  try {
    const data = await pywebview.api.get_cashflow_data();
    if (data.error) { console.error('Ошибка данных:', data.error); return; }
    App.data = data;
    if (App.activeView === 'dashboard') renderTable(data);
  } catch (e) {
    console.error('Ошибка загрузки:', e);
  }
}

async function init() {
  await new Promise(resolve => {
    if (window.pywebview) resolve();
    else window.addEventListener('pywebviewready', resolve, { once: true });
  });

  document.getElementById('date-picker').value = getTodayISO();

  await reloadData();

  scrollToWeek(getTodayISO());

  document.getElementById('loader').classList.add('hidden');
}

init();