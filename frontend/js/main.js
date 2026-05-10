// ══════════════════════════════════════════════════════════════
// СОСТОЯНИЕ
// ══════════════════════════════════════════════════════════════
const App = {
  data: null,
  popover: {
    visible:    false,
    categoryId: null,
    weekStart:  null,
    weekEnd:    null,
    mode:       'plan',
    cellEl:     null,
    catType:    null,
    colorCode:  null,
  },
};

// ══════════════════════════════════════════════════════════════
// УТИЛИТЫ
// ══════════════════════════════════════════════════════════════

function formatAmount(value) {
  if (value === null || value === undefined || value === 0) return '';
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function getTodayISO() {
  return new Date().toISOString().split('T')[0];
}

function getMondayOf(dateStr) {
  const d   = new Date(dateStr);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

function isCurrentWeek(weekStart, weekEnd) {
  const today = getTodayISO();
  return today >= weekStart && today <= weekEnd;
}

function formatDateRu(dateStr) {
  const MONTHS = [
    'янв','фев','мар','апр','май','июн',
    'июл','авг','сен','окт','ноя','дек',
  ];
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

function pluralWeeks(n) {
  const mod10  = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 19) return 'недель';
  if (mod10 === 1)                   return 'неделю';
  if (mod10 >= 2 && mod10 <= 4)     return 'недели';
  return 'недель';
}

// ══════════════════════════════════════════════════════════════
// РЕНДЕР ТАБЛИЦЫ
// ══════════════════════════════════════════════════════════════

function renderTable(data) {
  const { weeks, categories, plans, facts, initial_balance } = data;

  const thead = document.getElementById('table-head');
  const tbody = document.getElementById('table-body');
  thead.innerHTML = '';
  tbody.innerHTML = '';

  const incomeCategories  = categories.filter(c => c.type === 'income');
  const expenseCategories = categories.filter(c => c.type === 'expense');

  // ── Шапка ──────────────────────────────────────────────────
  const headerRow = document.createElement('tr');

  const cornerTh = document.createElement('th');
  cornerTh.className = 'col-sticky';
  cornerTh.innerHTML = `
    <span class="text-xs font-semibold text-slate-400 uppercase tracking-wide">
      Категория
    </span>`;
  headerRow.appendChild(cornerTh);

  weeks.forEach(week => {
    const th = document.createElement('th');
    th.className = 'col-week';
    th.dataset.weekStart = week.week_start;

    if (isCurrentWeek(week.week_start, week.week_end)) {
      th.classList.add('current-week');
    }

    th.innerHTML = `
      <div class="flex flex-col items-center gap-0.5">
        <span>${week.label}</span>
      </div>`;
    headerRow.appendChild(th);
  });

  thead.appendChild(headerRow);

  // ── Секция ДОХОДЫ ───────────────────────────────────────────
  tbody.appendChild(createSectionHeader('Доходы', weeks.length));
  incomeCategories.forEach(cat => {
    tbody.appendChild(createCategoryRow(cat, weeks, plans, facts));
  });
  tbody.appendChild(
    createTotalRow('income', 'Итого доходы', weeks, categories, plans, facts)
  );

  // ── Секция РАСХОДЫ ──────────────────────────────────────────
  tbody.appendChild(createSectionHeader('Расходы', weeks.length));
  expenseCategories.forEach(cat => {
    tbody.appendChild(createCategoryRow(cat, weeks, plans, facts));
  });
  tbody.appendChild(
    createTotalRow('expense', 'Итого расходы', weeks, categories, plans, facts)
  );

  // ── Строка ОСТАТОК ──────────────────────────────────────────
  tbody.appendChild(
    createBalanceRow(weeks, categories, plans, facts, initial_balance)
  );
}

function createSectionHeader(title, weeksCount) {
  const tr = document.createElement('tr');
  tr.className = 'row-section-header';
  const td = document.createElement('td');
  td.colSpan = weeksCount + 1;
  td.textContent = title;
  tr.appendChild(td);
  return tr;
}

function createCategoryRow(cat, weeks, plans, facts) {
  const tr = document.createElement('tr');
  tr.className = 'row-category';
  tr.dataset.categoryId = cat.id;
  tr.draggable = true;

  // Drag-and-drop события
  tr.addEventListener('dragstart', onDragStart);
  tr.addEventListener('dragover',  onDragOver);
  tr.addEventListener('drop',      onDrop);
  tr.addEventListener('dragend',   onDragEnd);

  const tdName = document.createElement('td');
  tdName.className = 'col-sticky';
  tdName.innerHTML = `
    <div class="category-name-cell">
      <div class="drag-handle" title="Перетащить">
        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"
             stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round"
            d="M4 8h16M4 16h16"/>
        </svg>
      </div>
      <div class="category-color-bar" style="background:${cat.color_code}"></div>
      <span class="category-name-text">${cat.name}</span>
      <button class="autofill-btn"
              title="Автозаполнение"
              onclick="openAutofill(event, ${cat.id})">
        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"
             stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round"
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2
               2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0
               00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
        </svg>
      </button>
    </div>`;
  tr.appendChild(tdName);

  weeks.forEach(week => {
    tr.appendChild(createDataCell(cat, week, plans, facts));
  });

  return tr;
}

function createDataCell(cat, week, plans, facts) {
  const td = document.createElement('td');
  td.className = 'data-cell';
  td.dataset.categoryId = cat.id;
  td.dataset.weekStart  = week.week_start;
  td.dataset.weekEnd    = week.week_end;
  td.dataset.catType    = cat.type;
  td.dataset.colorCode  = cat.color_code;

  if (isCurrentWeek(week.week_start, week.week_end)) {
    td.classList.add('current-week-col');
  }

  const key      = `${cat.id}:${week.week_start}`;
  const plan     = plans[key];
  const factArr  = facts[key];
  const factTotal = factArr
    ? factArr.reduce((s, f) => s + f.amount, 0)
    : null;
  const planAmount = plan ? plan.amount : null;

  td.innerHTML = `
    <div class="data-cell-inner">
      ${renderCellValue(cat.type, planAmount, factTotal, cat.color_code)}
    </div>`;

  td.addEventListener('click', e => {
    e.stopPropagation();
    openPopover(td);
  });

  return td;
}

function renderCellValue(catType, planAmount, factAmount, colorCode) {
  if (factAmount !== null && factAmount !== 0) {
    if (catType === 'income') {
      return `<span class="cell-value-fact-income" style="color:${colorCode}">
                ${formatAmount(factAmount)}
              </span>`;
    } else {
      return `<span class="cell-value-fact-expense">
                ${formatAmount(factAmount)}
              </span>`;
    }
  }
  if (planAmount !== null && planAmount !== 0) {
    return `<span class="cell-value-plan">${formatAmount(planAmount)}</span>`;
  }
  return `<span class="cell-empty">—</span>`;
}

function createTotalRow(type, label, weeks, categories, plans, facts) {
  const tr = document.createElement('tr');
  tr.className = `row-total row-total-${type}`;

  const tdLabel = document.createElement('td');
  tdLabel.className = 'col-sticky';
  tdLabel.innerHTML = `
    <div class="category-name-cell">
      <span class="font-semibold text-sm">${label}</span>
    </div>`;
  tr.appendChild(tdLabel);

  const typeCats = categories.filter(c => c.type === type);

  weeks.forEach(week => {
    const td = document.createElement('td');
    td.className = 'data-cell';
    if (isCurrentWeek(week.week_start, week.week_end)) {
      td.classList.add('current-week-col');
    }

    let total = 0;
    typeCats.forEach(cat => {
      const key     = `${cat.id}:${week.week_start}`;
      const factArr = facts[key];
      const plan    = plans[key];
      if (factArr && factArr.length > 0) {
        total += factArr.reduce((s, f) => s + f.amount, 0);
      } else if (plan) {
        total += plan.amount;
      }
    });

    td.innerHTML = `
      <div class="data-cell-inner font-semibold">
        ${total
          ? formatAmount(total)
          : '<span class="cell-empty">—</span>'}
      </div>`;
    tr.appendChild(td);
  });

  return tr;
}

function createBalanceRow(weeks, categories, plans, facts, initialBalance) {
  const tr = document.createElement('tr');
  tr.className = 'row-balance';

  const tdLabel = document.createElement('td');
  tdLabel.className = 'col-sticky';
  tdLabel.innerHTML = `
    <div class="category-name-cell">
      <span>Остаток</span>
    </div>`;
  tr.appendChild(tdLabel);

  const incomeCats  = categories.filter(c => c.type === 'income');
  const expenseCats = categories.filter(c => c.type === 'expense');

  let runningBalance = initialBalance;

  weeks.forEach(week => {
    const td = document.createElement('td');
    td.className = 'data-cell';
    td.dataset.weekStart = week.week_start;
    td.dataset.weekEnd   = week.week_end;

    let weekIncome = 0;
    incomeCats.forEach(cat => {
      const key     = `${cat.id}:${week.week_start}`;
      const factArr = facts[key];
      const plan    = plans[key];
      if (factArr && factArr.length > 0) {
        weekIncome += factArr.reduce((s, f) => s + f.amount, 0);
      } else if (plan) {
        weekIncome += plan.amount;
      }
    });

    let weekExpense = 0;
    expenseCats.forEach(cat => {
      const key     = `${cat.id}:${week.week_start}`;
      const factArr = facts[key];
      const plan    = plans[key];
      if (factArr && factArr.length > 0) {
        weekExpense += factArr.reduce((s, f) => s + f.amount, 0);
      } else if (plan) {
        weekExpense += plan.amount;
      }
    });

    runningBalance = runningBalance + weekIncome - weekExpense;
    const isNegative = runningBalance < 0;

    td.innerHTML = `
      <div class="data-cell-inner justify-between">
        <span></span>
        <div class="flex items-center gap-1">
          <span>${formatAmount(runningBalance) || '0'}</span>
          ${isNegative ? `
            <span class="deficit-wand"
                  title="Покрыть дефицит"
                  onclick="handleDeficit(
                    event,
                    '${week.week_start}',
                    '${week.week_end}',
                    ${Math.abs(runningBalance).toFixed(2)}
                  )">🪄</span>` : ''}
        </div>
      </div>`;

    if (isNegative) td.classList.add('balance-negative');
    tr.appendChild(td);
  });

  return tr;
}

// ══════════════════════════════════════════════════════════════
// POPOVER
// ══════════════════════════════════════════════════════════════

function openPopover(cellEl) {
  if (!cellEl.dataset.categoryId) return;

  const popover = document.getElementById('cell-popover');
  const overlay = document.getElementById('popover-overlay');

  App.popover.categoryId = parseInt(cellEl.dataset.categoryId);
  App.popover.weekStart  = cellEl.dataset.weekStart;
  App.popover.weekEnd    = cellEl.dataset.weekEnd;
  App.popover.catType    = cellEl.dataset.catType;
  App.popover.colorCode  = cellEl.dataset.colorCode;
  App.popover.cellEl     = cellEl;

  const cat      = App.data.categories.find(c => c.id === App.popover.categoryId);
  const weekData = App.data.weeks.find(w => w.week_start === App.popover.weekStart);
  document.getElementById('popover-title').textContent =
    `${cat?.name || ''} · ${weekData?.label || ''}`;

  const key       = `${App.popover.categoryId}:${App.popover.weekStart}`;
  const plan      = App.data.plans[key];
  const factArr   = App.data.facts[key];
  const factTotal = factArr
    ? factArr.reduce((s, f) => s + f.amount, 0)
    : null;

  if (factTotal) {
    setPopoverMode('fact');
    document.getElementById('popover-amount').value = factTotal;
  } else if (plan) {
    setPopoverMode('plan');
    document.getElementById('popover-amount').value = plan.amount;
  } else {
    setPopoverMode('plan');
    document.getElementById('popover-amount').value = '';
  }

  positionPopover(cellEl, popover);
  popover.classList.remove('hidden');
  overlay.classList.remove('hidden');
  App.popover.visible = true;

  setTimeout(() => document.getElementById('popover-amount').focus(), 50);
}

function positionPopover(cellEl, popover) {
  const rect  = cellEl.getBoundingClientRect();
  const vpW   = window.innerWidth;
  const vpH   = window.innerHeight;
  const popW  = 220;
  const popH  = 180;

  let left = rect.left + rect.width / 2 - popW / 2;
  let top  = rect.bottom + 8;

  if (left + popW > vpW - 8) left = vpW - popW - 8;
  if (left < 8)              left = 8;
  if (top + popH > vpH - 8)  top  = rect.top - popH - 8;

  popover.style.left = `${left}px`;
  popover.style.top  = `${top}px`;
}

function closePopover() {
  document.getElementById('cell-popover').classList.add('hidden');
  document.getElementById('popover-overlay').classList.add('hidden');
  App.popover.visible = false;
}

function setPopoverMode(mode) {
  App.popover.mode = mode;
  document.querySelectorAll('.popover-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.mode === mode);
  });
}

document.querySelectorAll('.popover-tab').forEach(tab => {
  tab.addEventListener('click', () => setPopoverMode(tab.dataset.mode));
});

document.getElementById('popover-close').addEventListener('click', closePopover);
document.getElementById('popover-overlay').addEventListener('click', closePopover);

document.getElementById('popover-amount').addEventListener('keydown', e => {
  if (e.key === 'Enter')  saveCell();
  if (e.key === 'Escape') closePopover();
});

document.getElementById('popover-clear').addEventListener('click', () => {
  document.getElementById('popover-amount').value = '';
  saveCell();
});

document.getElementById('popover-save').addEventListener('click', saveCell);

async function saveCell() {
  const amount = parseFloat(document.getElementById('popover-amount').value) || 0;

  const payload = {
    category_id:     App.popover.categoryId,
    week_start_date: App.popover.weekStart,
    week_end_date:   App.popover.weekEnd,
    amount:          amount,
    mode:            App.popover.mode,
  };

  const savedCellEl    = App.popover.cellEl;
  const savedCatType   = App.popover.catType;
  const savedMode      = App.popover.mode;
  const savedColorCode = App.popover.colorCode;

  closePopover();

  // Оптимистичное обновление
  updateCellUI(savedCellEl, savedCatType, savedMode, amount, savedColorCode);

  try {
    await pywebview.api.save_cell(payload);
    await reloadData();
  } catch (e) {
    console.error('Ошибка сохранения:', e);
    showToast('Ошибка сохранения', 'error');
  }
}

function updateCellUI(cellEl, catType, mode, amount, colorCode) {
  if (!cellEl) return;
  const inner = cellEl.querySelector('.data-cell-inner');
  if (!inner) return;
  inner.innerHTML = renderCellValue(
    catType,
    mode === 'plan' ? amount : null,
    mode === 'fact' ? amount : null,
    colorCode,
  );
}

// ══════════════════════════════════════════════════════════════
// DRAG AND DROP
// ══════════════════════════════════════════════════════════════

const DnD = {
  draggingEl:   null,
  draggingType: null,  // 'income' | 'expense'
  placeholder:  null,
};

function onDragStart(e) {
  DnD.draggingEl   = this;
  DnD.draggingType = this.dataset.categoryId
    ? App.data.categories.find(
        c => c.id === parseInt(this.dataset.categoryId)
      )?.type
    : null;

  this.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', this.dataset.categoryId);

  // Создаём плейсхолдер
  DnD.placeholder = document.createElement('tr');
  DnD.placeholder.className = 'dnd-placeholder';
  DnD.placeholder.innerHTML = `<td colspan="999"></td>`;
}

function onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';

  if (!DnD.draggingEl || this === DnD.draggingEl) return;

  // Проверяем что перетаскиваем в ту же секцию
  const targetCatId   = parseInt(this.dataset.categoryId);
  const targetCat     = App.data.categories.find(c => c.id === targetCatId);
  if (!targetCat || targetCat.type !== DnD.draggingType) return;

  const tbody    = this.parentNode;
  const rows     = [...tbody.querySelectorAll('tr.row-category')];
  const dragIdx  = rows.indexOf(DnD.draggingEl);
  const targetIdx = rows.indexOf(this);

  if (dragIdx < targetIdx) {
    this.parentNode.insertBefore(DnD.draggingEl, this.nextSibling);
  } else {
    this.parentNode.insertBefore(DnD.draggingEl, this);
  }
}

function onDrop(e) {
  e.preventDefault();
}

async function onDragEnd() {
  this.classList.remove('dragging');
  if (DnD.placeholder && DnD.placeholder.parentNode) {
    DnD.placeholder.parentNode.removeChild(DnD.placeholder);
  }
  DnD.draggingEl = null;

  // Собираем новый порядок по секциям
  const tbody      = document.getElementById('table-body');
  const allRows    = [...tbody.querySelectorAll('tr.row-category')];
  const orderedIds = allRows.map(r => parseInt(r.dataset.categoryId));

  try {
    await pywebview.api.update_category_order(orderedIds);
    // Обновляем локальное состояние без полного рефреша
    await reloadData();
  } catch (e) {
    console.error('Ошибка сортировки:', e);
  }
}

// ══════════════════════════════════════════════════════════════
// КАССОВЫЙ РАЗРЫВ
// ══════════════════════════════════════════════════════════════

const Deficit = {
  weekStart:  null,
  weekEnd:    null,
  amount:     0,
  strategy:   null,
};

async function handleDeficit(event, weekStart, weekEnd, deficitAmount) {
  event.stopPropagation();

  if (!App.data) return;

  const strategy = App.data.settings.financial_strategy;
  Deficit.weekStart = weekStart;
  Deficit.weekEnd   = weekEnd;
  Deficit.amount    = deficitAmount;
  Deficit.strategy  = strategy;

  if (strategy === 'manual') {
    showToast('Ручное управление: автодействия отключены', 'info');
    return;
  }

  if (strategy === 'saving_first') {
    // Сразу применяем без подтверждения
    const result = await pywebview.api.handle_deficit({
      week_start: weekStart,
      week_end:   weekEnd,
      deficit:    deficitAmount,
      strategy:   'saving_first',
    });

    if (result.success) {
      showToast(`Дефицит покрыт из копилки: ${formatAmount(deficitAmount)} ₽`, 'success');
      await reloadData();
    } else {
      showToast('Ошибка: ' + result.error, 'error');
    }
    return;
  }

  if (strategy === 'credit_first') {
    // Открываем модалку с датой возврата
    document.getElementById('deficit-amount-display').textContent =
      `${formatAmount(deficitAmount)} ₽`;

    // Дата возврата по умолчанию: через 4 недели
    const returnDefault = new Date(weekStart);
    returnDefault.setDate(returnDefault.getDate() + 28);
    document.getElementById('deficit-return-date').value =
      returnDefault.toISOString().split('T')[0];

    updateDeficitPreview();
    document.getElementById('deficit-modal').classList.remove('hidden');
  }
}

function updateDeficitPreview() {
  const returnDate = document.getElementById('deficit-return-date').value;
  const preview    = document.getElementById('deficit-result-preview');
  if (!returnDate) { preview.classList.add('hidden'); return; }

  const returnMonday = getMondayOf(returnDate);
  preview.innerHTML = `
    <div class="flex items-start gap-2">
      <span class="text-amber-500">⚡</span>
      <div>
        Доход <strong>«Займ» ${formatAmount(Deficit.amount)} ₽</strong>
        будет добавлен на текущую неделю.<br>
        Расход <strong>«Возврат займа» ${formatAmount(Deficit.amount)} ₽</strong>
        — на неделю с <strong>${formatDateRu(returnMonday)}</strong>.
      </div>
    </div>`;
  preview.classList.remove('hidden');
}

document.getElementById('deficit-return-date')
  ?.addEventListener('change', updateDeficitPreview);

function closeDeficitModal() {
  document.getElementById('deficit-modal').classList.add('hidden');
}

async function submitDeficit() {
  const returnDate = document.getElementById('deficit-return-date').value;
  if (!returnDate) {
    showToast('Укажите дату возврата', 'error');
    return;
  }

  const btn = document.getElementById('deficit-confirm-btn');
  btn.disabled    = true;
  btn.textContent = 'Сохраняю...';

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
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Подтвердить займ';
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
  const modal = document.getElementById('reconcile-modal');

  // Берём текущую неделю
  const today   = getTodayISO();
  const monday  = getMondayOf(today);
  const sunday  = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const weekEnd = sunday.toISOString().split('T')[0];

  // Получаем расчётный баланс
  document.getElementById('reconcile-calculated').textContent = '...';
  modal.classList.remove('hidden');
  document.getElementById('reconcile-actual').value = '';
  document.getElementById('reconcile-diff-preview').classList.add('hidden');

  try {
    const res = await pywebview.api.get_calculated_balance(monday);
    if (res.success) {
      const calcEl = document.getElementById('reconcile-calculated');
      calcEl.textContent = `${formatAmount(res.balance) || '0'} ₽`;
      calcEl.dataset.value   = res.balance;
      calcEl.dataset.weekStart = monday;
      calcEl.dataset.weekEnd   = weekEnd;
    }
  } catch (e) {
    document.getElementById('reconcile-calculated').textContent = 'Ошибка';
  }

  setTimeout(() => document.getElementById('reconcile-actual').focus(), 100);
}

function closeReconcileModal() {
  document.getElementById('reconcile-modal').classList.add('hidden');
}

document.getElementById('reconcile-actual')
  ?.addEventListener('input', updateReconcilePreview);

function updateReconcilePreview() {
  const actualVal     = parseFloat(document.getElementById('reconcile-actual').value);
  const calcEl        = document.getElementById('reconcile-calculated');
  const calculatedVal = parseFloat(calcEl.dataset.value || 0);
  const preview       = document.getElementById('reconcile-diff-preview');

  if (isNaN(actualVal)) {
    preview.classList.add('hidden');
    return;
  }

  const diff = actualVal - calculatedVal;

  if (Math.abs(diff) < 0.01) {
    preview.className = 'px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-700';
    preview.innerHTML = `<strong>✓ Балансы совпадают!</strong> Корректировка не нужна.`;
  } else if (diff > 0) {
    preview.className = 'px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700';
    preview.innerHTML = `
      Будет добавлен доход <strong>«Корректировка баланса»
      ${formatAmount(diff)} ₽</strong> на текущую неделю.`;
  } else {
    preview.className = 'px-4 py-3 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-700';
    preview.innerHTML = `
      Будет добавлен расход <strong>«Корректировка баланса»
      ${formatAmount(Math.abs(diff))} ₽</strong> на текущую неделю.`;
  }

  preview.classList.remove('hidden');
}

async function submitReconcile() {
  const actualVal     = parseFloat(document.getElementById('reconcile-actual').value);
  const calcEl        = document.getElementById('reconcile-calculated');
  const calculatedVal = parseFloat(calcEl.dataset.value || 0);
  const weekStart     = calcEl.dataset.weekStart;
  const weekEnd       = calcEl.dataset.weekEnd;

  if (isNaN(actualVal)) {
    showToast('Введите фактический баланс', 'error');
    return;
  }

  const btn = document.getElementById('reconcile-confirm-btn');
  btn.disabled    = true;
  btn.textContent = 'Сохраняю...';

  try {
    const result = await pywebview.api.reconcile_balance({
      actual_balance:      actualVal,
      calculated_balance:  calculatedVal,
      week_start:          weekStart,
      week_end:            weekEnd,
    });

    if (result.success) {
      closeReconcileModal();
      if (result.action === 'none') {
        showToast('Балансы совпадают, корректировка не нужна', 'info');
      } else {
        showToast('Баланс выровнен', 'success');
        await reloadData();
      }
    } else {
      showToast('Ошибка: ' + result.error, 'error');
    }
  } catch (e) {
    showToast('Ошибка соединения', 'error');
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Выровнять баланс';
  }
}

document.getElementById('reconcile-modal')
  ?.addEventListener('click', function(e) {
    if (e.target === this) closeReconcileModal();
  });

// ══════════════════════════════════════════════════════════════
// НАСТРОЙКИ
// ══════════════════════════════════════════════════════════════

async function openSettingsModal() {
  const modal = document.getElementById('settings-modal');

  // Загружаем текущие настройки
  try {
    const settings = await pywebview.api.get_settings();
    if (settings.planning_start_date) {
      document.getElementById('settings-start').value = settings.planning_start_date;
    }
    if (settings.planning_end_date) {
      document.getElementById('settings-end').value = settings.planning_end_date;
    }
    // Устанавливаем стратегию
    const strategyInput = document.querySelector(
      `#settings-strategy-group input[value="${settings.financial_strategy}"]`
    );
    if (strategyInput) strategyInput.checked = true;

  } catch (e) {
    console.error('Ошибка загрузки настроек:', e);
  }

  // Загружаем категории
  renderSettingsCategories();

  modal.classList.remove('hidden');
}

function closeSettingsModal() {
  document.getElementById('settings-modal').classList.add('hidden');
  closeAddCategoryForm();
}

async function renderSettingsCategories() {
  const list = document.getElementById('settings-categories-list');
  list.innerHTML = '<div class="text-xs text-slate-400 py-2">Загрузка...</div>';

  try {
    const cats = await pywebview.api.get_categories();
    list.innerHTML = '';

    ['income', 'expense'].forEach(type => {
      const typeCats = cats.filter(c => c.type === type);
      if (typeCats.length === 0) return;

      const label = document.createElement('div');
      label.className = 'text-xs font-semibold text-slate-400 uppercase tracking-wide mt-2 mb-1 px-1';
      label.textContent = type === 'income' ? 'Доходы' : 'Расходы';
      list.appendChild(label);

      typeCats.forEach(cat => {
        const item = document.createElement('div');
        item.className = 'settings-cat-item';
        item.innerHTML = `
          <div class="w-3 h-3 rounded-full flex-shrink-0"
               style="background:${cat.color_code}"></div>
          <span class="text-sm text-slate-700 flex-1">${cat.name}</span>
          <button class="settings-cat-delete"
                  onclick="deleteCategory(${cat.id}, '${cat.name}')"
                  title="Удалить">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"
                 stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round"
                d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>`;
        list.appendChild(item);
      });
    });

  } catch (e) {
    list.innerHTML = '<div class="text-xs text-rose-500 py-2">Ошибка загрузки</div>';
  }
}

function openAddCategoryForm() {
  document.getElementById('add-category-form').classList.remove('hidden');
  document.getElementById('new-cat-name').focus();
}

function closeAddCategoryForm() {
  document.getElementById('add-category-form').classList.add('hidden');
  document.getElementById('new-cat-name').value = '';
}

async function submitAddCategory() {
  const name  = document.getElementById('new-cat-name').value.trim();
  const type  = document.getElementById('new-cat-type').value;
  const color = document.getElementById('new-cat-color').value;

  if (!name) {
    showToast('Введите название категории', 'error');
    return;
  }

  try {
    const result = await pywebview.api.add_category({
      name:       name,
      type:       type,
      color_code: color,
    });

    if (result.success) {
      closeAddCategoryForm();
      showToast(`Категория «${name}» добавлена`, 'success');
      renderSettingsCategories();
      await reloadData();
    } else {
      showToast('Ошибка: ' + result.error, 'error');
    }
  } catch (e) {
    showToast('Ошибка соединения', 'error');
  }
}

async function deleteCategory(categoryId, categoryName) {
  const confirmed = await showConfirm(
    `Удалить категорию «${categoryName}»?`,
    'Все связанные планы и факты будут также удалены.'
  );
  if (!confirmed) return;

  try {
    const result = await pywebview.api.delete_category(categoryId);
    if (result.success) {
      showToast(`Категория удалена`, 'success');
      renderSettingsCategories();
      await reloadData();
    } else {
      showToast('Ошибка: ' + result.error, 'error');
    }
  } catch (e) {
    showToast('Ошибка соединения', 'error');
  }
}

async function submitSettings() {
  const startDate = document.getElementById('settings-start').value;
  const endDate   = document.getElementById('settings-end').value;
  const strategy  = document.querySelector(
    '#settings-strategy-group input[name="strategy"]:checked'
  )?.value;

  if (!startDate || !endDate) {
    showToast('Укажите период планирования', 'error');
    return;
  }
  if (startDate >= endDate) {
    showToast('Дата начала должна быть раньше даты конца', 'error');
    return;
  }

  try {
    const result = await pywebview.api.save_settings({
      planning_start_date: startDate,
      planning_end_date:   endDate,
      financial_strategy:  strategy || 'manual',
    });

    if (result.success) {
      closeSettingsModal();
      showToast('Настройки сохранены', 'success');
      await reloadData();
    } else {
      showToast('Ошибка: ' + result.error, 'error');
    }
  } catch (e) {
    showToast('Ошибка соединения', 'error');
  }
}

document.getElementById('settings-modal')
  ?.addEventListener('click', function(e) {
    if (e.target === this) closeSettingsModal();
  });

// ══════════════════════════════════════════════════════════════
// ДИАЛОГ ПОДТВЕРЖДЕНИЯ
// ══════════════════════════════════════════════════════════════

function showConfirm(title, subtitle = '') {
  return new Promise(resolve => {
    const existing = document.getElementById('confirm-dialog');
    if (existing) existing.remove();

    const dialog = document.createElement('div');
    dialog.id = 'confirm-dialog';
    dialog.className = 'modal-overlay';
    dialog.innerHTML = `
      <div class="modal-box w-full max-w-xs">
        <div class="modal-body text-center py-6">
          <div class="text-3xl mb-3">⚠️</div>
          <h3 class="font-semibold text-slate-800 text-sm mb-1">${title}</h3>
          ${subtitle
            ? `<p class="text-xs text-slate-500">${subtitle}</p>`
            : ''}
        </div>
        <div class="modal-footer justify-center gap-3">
          <button id="confirm-cancel" class="btn-secondary">Отмена</button>
          <button id="confirm-ok"
                  class="btn-primary"
                  style="background:#ef4444"
                  onmouseover="this.style.background='#dc2626'"
                  onmouseout="this.style.background='#ef4444'">
            Удалить
          </button>
        </div>
      </div>`;

    document.body.appendChild(dialog);

    dialog.querySelector('#confirm-cancel').addEventListener('click', () => {
      dialog.remove();
      resolve(false);
    });
    dialog.querySelector('#confirm-ok').addEventListener('click', () => {
      dialog.remove();
      resolve(true);
    });
    dialog.addEventListener('click', e => {
      if (e.target === dialog) { dialog.remove(); resolve(false); }
    });
  });
}

// ══════════════════════════════════════════════════════════════
// AUTOFILL
// ══════════════════════════════════════════════════════════════

const Autofill = { categoryId: null };

function openAutofill(event, categoryId) {
  event.stopPropagation();
  Autofill.categoryId = categoryId;

  const cat = App.data.categories.find(c => c.id === categoryId);
  document.getElementById('autofill-cat-name').textContent = cat?.name || '';

  const monday = getMondayOf(getTodayISO());
  document.getElementById('autofill-start-date').value = monday;
  document.getElementById('autofill-weeks').value       = 4;

  const lastAmount = getLastPlanAmount(categoryId);
  document.getElementById('autofill-amount').value =
    lastAmount ? lastAmount : '';

  updateAutofillPreview();
  document.getElementById('autofill-modal').classList.remove('hidden');
  setTimeout(() => document.getElementById('autofill-amount').focus(), 100);
}

function closeAutofillModal() {
  document.getElementById('autofill-modal').classList.add('hidden');
  Autofill.categoryId = null;
}

function getLastPlanAmount(categoryId) {
  if (!App.data) return null;
  const today = getTodayISO();
  let lastAmount = null;
  let lastDate   = null;

  Object.entries(App.data.plans).forEach(([key, plan]) => {
    const [catId, weekStart] = key.split(':');
    if (parseInt(catId) === categoryId && weekStart <= today) {
      if (!lastDate || weekStart > lastDate) {
        lastDate   = weekStart;
        lastAmount = plan.amount;
      }
    }
  });
  return lastAmount;
}

function updateAutofillPreview() {
  const startVal  = document.getElementById('autofill-start-date').value;
  const weeksVal  = parseInt(document.getElementById('autofill-weeks').value) || 0;
  const amountVal = parseFloat(document.getElementById('autofill-amount').value) || 0;
  const preview   = document.getElementById('autofill-preview');

  if (!startVal || weeksVal <= 0 || amountVal <= 0) {
    preview.classList.add('hidden');
    return;
  }

  const monday  = getMondayOf(startVal);
  const endDate = new Date(monday + 'T00:00:00');
  endDate.setDate(endDate.getDate() + (weeksVal - 1) * 7 + 6);
  const endStr = endDate.toISOString().split('T')[0];

  preview.innerHTML = `
    <div class="flex items-start gap-2">
      <span class="text-emerald-500 mt-0.5">✓</span>
      <div>
        Будет проставлено <strong>${formatAmount(amountVal)} ₽</strong>
        на <strong>${weeksVal} ${pluralWeeks(weeksVal)}</strong><br>
        с <strong>${formatDateRu(monday)}</strong>
        по <strong>${formatDateRu(endStr)}</strong><br>
        <span class="text-emerald-600 font-medium">
          Итого: ${formatAmount(amountVal * weeksVal)} ₽
        </span>
      </div>
    </div>`;
  preview.classList.remove('hidden');
}

function changeWeeksCount(delta) {
  const input = document.getElementById('autofill-weeks');
  const val   = parseInt(input.value) || 1;
  input.value = Math.max(1, Math.min(52, val + delta));
  updateAutofillPreview();
}

async function submitAutofill() {
  const startDate  = document.getElementById('autofill-start-date').value;
  const weeksCount = parseInt(document.getElementById('autofill-weeks').value);
  const amount     = parseFloat(document.getElementById('autofill-amount').value);

  if (!startDate)               { showToast('Укажите начальную дату', 'error');    return; }
  if (!weeksCount || weeksCount <= 0) { showToast('Укажите количество недель', 'error'); return; }
  if (!amount || amount <= 0)   { showToast('Укажите сумму', 'error');             return; }

  const btn = document.querySelector('#autofill-modal .btn-primary');
  btn.disabled    = true;
  btn.textContent = 'Заполняю...';

  try {
    const result = await pywebview.api.autofill({
      category_id:  Autofill.categoryId,
      start_date:   startDate,
      weeks_count:  weeksCount,
      amount:       amount,
    });

    if (result.success) {
      closeAutofillModal();
      showToast(
        `Заполнено ${result.filled} ${pluralWeeks(result.filled)}`,
        'success'
      );
      await reloadData();
    } else {
      showToast('Ошибка: ' + result.error, 'error');
    }
  } catch (e) {
    showToast('Ошибка соединения', 'error');
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Заполнить';
  }
}

document.getElementById('autofill-start-date')
  ?.addEventListener('change', updateAutofillPreview);
document.getElementById('autofill-weeks')
  ?.addEventListener('input', updateAutofillPreview);
document.getElementById('autofill-amount')
  ?.addEventListener('input', updateAutofillPreview);
document.getElementById('autofill-modal')
  ?.addEventListener('click', function(e) {
    if (e.target === this) closeAutofillModal();
  });

// ══════════════════════════════════════════════════════════════
// НАВИГАЦИЯ К ДАТЕ
// ══════════════════════════════════════════════════════════════

function scrollToWeek(dateStr) {
  if (!dateStr || !App.data) return;
  const monday = getMondayOf(dateStr);
  const th = document.querySelector(`th[data-week-start="${monday}"]`);
  if (th) {
    th.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }
}

document.getElementById('date-picker')
  .addEventListener('change', e => scrollToWeek(e.target.value));

document.getElementById('btn-today').addEventListener('click', () => {
  const today = getTodayISO();
  document.getElementById('date-picker').value = today;
  scrollToWeek(today);
});

document.getElementById('btn-reconcile')
  .addEventListener('click', openReconcileModal);

document.getElementById('btn-settings')
  .addEventListener('click', openSettingsModal);

// ══════════════════════════════════════════════════════════════
// TOAST
// ══════════════════════════════════════════════════════════════

function showToast(message, type = 'success') {
  const existing = document.getElementById('app-toast');
  if (existing) existing.remove();

  const colors = {
    success: '#059669',
    error:   '#dc2626',
    info:    '#475569',
  };

  const icons = {
    success: '✓',
    error:   '✕',
    info:    'ℹ',
  };

  const toast = document.createElement('div');
  toast.id = 'app-toast';
  toast.style.cssText = `
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%) translateY(20px);
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 20px;
    border-radius: 12px;
    background: ${colors[type] || colors.info};
    color: white;
    font-size: 13px;
    font-weight: 500;
    font-family: inherit;
    z-index: 9999;
    opacity: 0;
    transition: opacity 0.25s ease, transform 0.25s ease;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    white-space: nowrap;
  `;
  toast.innerHTML = `
    <span style="font-weight:700">${icons[type]}</span>
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
    if (data.error) {
      console.error('Ошибка данных:', data.error);
      return;
    }
    App.data = data;
    renderTable(data);
  } catch (e) {
    console.error('Ошибка загрузки:', e);
  }
}

async function init() {
  await new Promise(resolve => {
    if (window.pywebview) {
      resolve();
    } else {
      window.addEventListener('pywebviewready', resolve, { once: true });
    }
  });

  document.getElementById('date-picker').value = getTodayISO();
  await reloadData();
  scrollToWeek(getTodayISO());
  document.getElementById('loader').classList.add('hidden');
}

init();