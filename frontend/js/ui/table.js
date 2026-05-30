window.renderTable = function(data) {
  /**
   * Отображает полную таблицу кассового потока.
   */
  const { weeks, categories, plans, facts, initial_balance } = data;
  const vc = data.settings?.visual_config || {};

  const thead = document.getElementById('table-head');
  const tbody = document.getElementById('table-body');
  thead.innerHTML = '';
  tbody.innerHTML = '';

  const incomeCats = categories.filter(c => c.type === 'income');
  const expenseCats = categories.filter(c => c.type === 'expense');
  const weekColor = vc.weekColor || '#3b82f6';
  const cwColor = vc.currentWeekColor || '#fef08a';
  
  const tr = document.createElement('tr');

  const thCorner = document.createElement('th');
  thCorner.className = 'th-sticky';
  thCorner.style.top = '0';
  thCorner.innerHTML = `<span class="text-xs font-semibold text-slate-500
                               uppercase tracking-wide">
    Начало недели - Конец недели
  </span>`;
  tr.appendChild(thCorner);

  weeks.forEach((week, i) => {
    const th = document.createElement('th');
    th.className = 'th-week';
    th.id = `week-col-${week.week_start}`;
    th.dataset.weekStart = week.week_start;

    const isCurrent = isCurrentWeek(week.week_start, week.week_end);
    const isPast = isPastWeek(week.week_start, week.week_end);

    const startD = new Date(week.week_start + 'T00:00:00');
    const endD = new Date(week.week_end + 'T00:00:00');
    const fmt = d => `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}`;

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
    } else if (isPast) {
      th.style.backgroundColor = PAST_WEEK_COLOR;
      th.innerHTML = `
        <div class="week-number" style="color:#64748b">
          Неделя ${week.week_number}
        </div>
        <div class="week-dates" style="color:#475569">
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

  tbody.appendChild(makeSectionRow('income', weeks.length));
  incomeCats.forEach(cat => {
    tbody.appendChild(makeCategoryRow(cat, weeks, plans, facts, cwColor));
  });
  tbody.appendChild(makeTotalRow(
    'income', 'Итого доходы',
    weeks, incomeCats, plans, facts,
    vc.totalIncomeColor || '#16a34a', cwColor
  ));

  tbody.appendChild(makeSectionRow('expense', weeks.length));
  expenseCats.forEach(cat => {
    tbody.appendChild(makeCategoryRow(cat, weeks, plans, facts, cwColor));
  });
  tbody.appendChild(makeTotalRow(
    'expense', 'Итого расходы',
    weeks, expenseCats, plans, facts,
    vc.totalExpenseColor || '#ef4444', cwColor
  ));

  tbody.appendChild(makeBalanceRow(
    weeks, categories, plans, facts,
    initial_balance, weekColor, cwColor,
    vc.negativeBalanceColor || '#f87171'
  ));
  refreshAllCommentIcons();
  initCategorySearch(); 
  applyCategorySearch(); 
}

function makeSectionRow(type, weeksCount) {
  /**
   * Создаёт строку-разделитель секции (доходы/расходы).
   */
  const tr = document.createElement('tr');
  tr.className = `row-section ${type}-section`;

  const td = document.createElement('td');
  td.colSpan = weeksCount + 1;

  const label = document.createElement('div');
  label.className = 'section-label';
  label.textContent = type === 'income' ? '+ Доходы' : '− Расходы';
  td.appendChild(label);
  tr.appendChild(td);
  return tr;
}

function makeCategoryRow(cat, weeks, plans, facts, cwColor) {
  /**
   * Создаёт строку категории с ячейками данных.
   */
  const tr = document.createElement('tr');
  tr.className = 'row-category';
  tr.draggable = true;
  tr.dataset.categoryId = cat.id;

  tr.addEventListener('dragstart', onDragStart);
  tr.addEventListener('dragover', onDragOver);
  tr.addEventListener('drop', onDrop);
  tr.addEventListener('dragend', onDragEnd);

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
              title="Автозаполнение плана">
        <svg width="13" height="13" fill="none" viewBox="0 0 24 24"
             stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0
               0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357
               2H15"/>
        </svg>
      </button>
    </div>`;

  const btn = tdName.querySelector('.autofill-btn');
  btn.addEventListener('click', (e) => {
    if (typeof Anim !== 'undefined' && Anim.spinAutofillBtn) {
      Anim.spinAutofillBtn(btn, new Promise(r => setTimeout(r, 200))).then(() => {
        openAutofill(e, cat.id);
      });
    } else {
      openAutofill(e, cat.id);
    }
  });

  tr.appendChild(tdName);

  weeks.forEach(week => {
    tr.appendChild(makeDataCell(cat, week, plans, facts, cwColor));
  });

  return tr;
}

function makeDataCell(cat, week, plans, facts, cwColor) {
  /**
   * Создаёт ячейку данных для категории и недели.
   */
  const td = document.createElement('td');
  td.className = 'data-cell';
  td.dataset.categoryId = cat.id;
  td.dataset.weekStart = week.week_start;
  td.dataset.weekEnd = week.week_end;
  td.dataset.catType = cat.type;
  td.dataset.colorCode = cat.color_code;
  td.unselectable = 'on';

  const isCurrent = isCurrentWeek(week.week_start, week.week_end);
  const isPast = isPastWeek(week.week_start, week.week_end);
  
  if (isCurrent) {
    td.style.backgroundColor = cwColor;
  } else if (isPast) {
    td.style.backgroundColor = PAST_WEEK_COLOR;
  }

  td.style.userSelect = 'none';
  td.style.webkitUserSelect = 'none';

  refreshCellContent(td, plans, facts);

  td.addEventListener('click', e => {
    e.stopPropagation();
    const key = `${cat.id}:${week.week_start}`;
    const hasFact = !!(facts[key] && facts[key].length > 0);
    openCellEditor(td, hasFact ? 'fact' : 'plan');
  });

  td.addEventListener('contextmenu', e => {
    e.preventDefault();
    e.stopPropagation();
    showCellContextMenu(td, e);
  });

  return td;
}

function refreshCellContent(td, plans, facts) {
  /**
   * Обновляет содержимое ячейки (план/факт).
   */
  const catId = parseInt(td.dataset.categoryId);
  const weekStart = td.dataset.weekStart;
  const catType = td.dataset.catType;
  const colorCode = td.dataset.colorCode;
  const key = `${catId}:${weekStart}`;

  const plan = plans?.[key];
  const factArr = facts?.[key];
  const factTotal = factArr ? factArr.reduce((s, f) => s + f.amount, 0) : null;
  const planAmt = plan ? plan.amount : null;
  const isFact = factTotal !== null && factTotal !== 0;
  const isPlan = planAmt !== null && planAmt !== 0;

  td.classList.remove('has-plan', 'current-week');
  
  if (isPlan && !isFact) {
    td.classList.add('has-plan');
    const isCurrent = isCurrentWeek(td.dataset.weekStart, td.dataset.weekEnd);
    if (isCurrent) {
      td.classList.add('current-week');
    }
  }

  let html = '';
  let indicatorHtml = '';

  if (isFact) {
    if (factArr.length > 1) {
      indicatorHtml = `<span class="fact-multiple-indicator" title="${factArr.length} операции">x${factArr.length}</span>`;
    }

    let factColor = (catType === 'income') ? (colorCode || '#10b981') : 'inherit';
    let factClass = (catType === 'income') ? 'val-fact-income' : 'val-fact-expense';
    let factDisplay = `<span class="${factClass}" style="color:${factColor}; display:block; line-height:1.2;">${formatAmount(factTotal)}</span>`;

    if (isPlan) {
      let isOverBudget = false;
      if (catType === 'expense' && factTotal > planAmt) isOverBudget = true;
      if (catType === 'income' && factTotal < planAmt) isOverBudget = true;

      let subTextColor = isOverBudget ? '#ef4444' : '#94a3b8';
      let prefix = catType === 'expense' ? 'из' : 'цель:';

      factDisplay += `
        <span style="display:block; font-size:9.5px; color:${subTextColor}; font-weight:600; line-height:1; margin-top:2px;">
          ${prefix} ${formatAmount(planAmt)}
        </span>
      `;
    }

    html = factDisplay;

  } else if (isPlan) {
    const cls = catType === 'income' ? 'val-plan-income' : 'val-plan-expense';
    html = `<span class="${cls}">${formatAmount(planAmt)}</span>`;
  }

  const isPast = isPastWeek(td.dataset.weekStart, td.dataset.weekEnd);
  let warningHtml = '';
  
  if (isPast && isPlan && !isFact) {
    warningHtml = `<div class="fact-warning-indicator" title="Забыли внести факт!">⚠️</div>`;
  }

  td.style.position = 'relative';
  
  td.innerHTML = `<div class="data-cell-inner" style="
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    pointer-events: none;
  ">
    ${html}
    ${indicatorHtml}
    ${warningHtml} <!-- Вставляем индикатор сюда -->
  </div>`;
}

function makeTotalRow(type, label, weeks, typeCats, plans, facts, color, cwColor) {
  /**
   * Создаёт итоговую строку (доходы/расходы) для таблицы.
   */
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
    const isPast = isPastWeek(week.week_start, week.week_end);
    
    if (isCurrent) {
      td.style.backgroundColor = cwColor;
    } else if (isPast) {
      td.style.backgroundColor = PAST_WEEK_COLOR;
    } else {
      td.style.backgroundColor = 'transparent';
    }

    let total = 0;
    typeCats.forEach(cat => {
      const key = `${cat.id}:${week.week_start}`;
      const fa = facts[key];
      const p = plans[key];
      total += fa && fa.length ? fa.reduce((s, f) => s + f.amount, 0) : (p ? p.amount : 0);
    });

    const display = type === 'expense' && total ? `-${formatAmount(total)}` : (total ? formatAmount(total) : '');

    td.innerHTML = `
      <div style="padding:4px 8px;font-weight:700;text-align:right;
                  font-variant-numeric:tabular-nums;">
        ${display}
      </div>`;
    
    const div = td.querySelector('div');
    if (div) {
      div.style.setProperty('color', color, 'important');
    }

    tr.appendChild(td);
  });

  return tr;
}

function makeBalanceRow(weeks, categories, plans, facts, initialBalance, weekColor, cwColor, negColor) {
  /**
   * Создаёт строку баланса с кнопками покрытия дефицита.
   */
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

  const incomeCats = categories.filter(c => c.type === 'income');
  const expenseCats = categories.filter(c => c.type === 'expense');
  let running = initialBalance;

  weeks.forEach((week, i) => {
    let inc = 0, exp = 0;
  
    incomeCats.forEach(cat => {
      const key = `${cat.id}:${week.week_start}`;
      const fa = facts[key];
      const p = plans[key];
      inc += fa && fa.length ? fa.reduce((s, f) => s + f.amount, 0) : (p ? p.amount : 0);
    });
  
    expenseCats.forEach(cat => {
      const key = `${cat.id}:${week.week_start}`;
      const fa = facts[key];
      const p = plans[key];
      exp += fa && fa.length ? fa.reduce((s, f) => s + f.amount, 0) : (p ? p.amount : 0);
    });
  
    running += inc - exp;
    const isNeg = running < 0;
  
    const td = document.createElement('td');
    td.className = 'balance-data-cell';
    td.dataset.weekStart = week.week_start;
    td.style.borderColor = 'rgba(255,255,255,0.3)';
    td.style.textAlign = 'right';
  
    const isCurrent = isCurrentWeek(week.week_start, week.week_end);
    const isPast = isPastWeek(week.week_start, week.week_end);
    
    let cellBgColor;
    if (isCurrent) {
      cellBgColor = cwColor;
    } else if (isPast) {
      cellBgColor = PAST_WEEK_COLOR;
    } else {
      cellBgColor = weekColor;
    }
    
    td.style.backgroundColor = cellBgColor;
    const cellTextColor = getContrastColor(cellBgColor);
  
    td.innerHTML = `
      <div class="balance-cell-inner" style="padding:0 8px;">
        ${isNeg ? `
          <button class="wand-btn"
            onclick="handleDeficit(event,'${week.week_start}','${week.week_end}',${Math.abs(running).toFixed(2)})"
            title="Покрыть дефицит">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-magic" viewBox="0 0 16 16">
              <path d="M9.5 2.672a.5.5 0 1 0 1 0V.843a.5.5 0 0 0-1 0zm4.5.035A.5.5 0 0 0 13.293 2L12 3.293a.5.5 0 1 0 .707.707zM7.293 4A.5.5 0 1 0 8 3.293L6.707 2A.5.5 0 0 0 6 2.707zm-.621 2.5a.5.5 0 1 0 0-1H4.843a.5.5 0 1 0 0 1zm8.485 0a.5.5 0 1 0 0-1h-1.829a.5.5 0 0 0 0 1zM13.293 10A.5.5 0 1 0 14 9.293L12.707 8a.5.5 0 1 0-.707.707zM9.5 11.157a.5.5 0 0 0 1 0V9.328a.5.5 0 0 0-1 0zm1.854-5.097a.5.5 0 0 0 0-.706l-.708-.708a.5.5 0 0 0-.707 0L8.646 5.94a.5.5 0 0 0 0 .707l.708.708a.5.5 0 0 0 .707 0l1.293-1.293Zm-3 3a.5.5 0 0 0 0-.706l-.708-.708a.5.5 0 0 0-.707 0L.646 13.94a.5.5 0 0 0 0 .707l.708.708a.5.5 0 0 0 .707 0z"/>
            </svg>
          </button>
        ` : ''}
        <span style="color:${isNeg ? negColor : cellTextColor}">
          ${formatAmount(running)}
        </span>
      </div>`;
  
    tr.appendChild(td);
  });

  return tr;
}

window.applyCategorySearch = function() {
  /**
   * Применяет текущий фильтр к строкам таблицы.
   */
  const searchInput = document.getElementById('category-search');
  if (!searchInput) return;

  const query = searchInput.value.toLowerCase().trim();
  const rows = document.querySelectorAll('#table-body tr');

  if (!query) {
    rows.forEach(row => {
      if (row.classList.contains('hidden')) {
        row.classList.remove('hidden');
        row.classList.remove('search-reveal');
        void row.offsetWidth;
        row.classList.add('search-reveal');
      }
    });
    return;
  }

  let currentGroup = 'unknown';
  let incomeMatches = 0;
  let expenseMatches = 0;

  rows.forEach(row => {
    const nameCell = row.querySelector('td:first-child, th:first-child');
    if (!nameCell) return;
    
    const text = nameCell.textContent.toLowerCase().trim();
    const isCategory = row.querySelector('[data-category-id]') !== null;

    if (text.includes('итого') && text.includes('доход')) {
      row.dataset.role = 'income-total';
    } else if (text.includes('итого') && text.includes('расход')) {
      row.dataset.role = 'expense-total';
    } else if (text.includes('остаток') || text.includes('баланс')) {
      row.dataset.role = 'balance';
    } else if (!isCategory && text.includes('доход')) {
      currentGroup = 'income';
      row.dataset.role = 'income-header';
    } else if (!isCategory && text.includes('расход')) {
      currentGroup = 'expense';
      row.dataset.role = 'expense-header';
    } else if (isCategory) {
      row.dataset.role = 'category';
      if (text.includes(query)) {
        row.dataset.match = 'true';
        if (currentGroup === 'income') incomeMatches++;
        if (currentGroup === 'expense') expenseMatches++;
      } else {
        row.dataset.match = 'false';
      }
    }
  });

  rows.forEach(row => {
    const role = row.dataset.role;
    let shouldShow = false;

    if (role === 'balance') {
      shouldShow = true;
    } else if (role === 'income-header' || role === 'income-total') {
      shouldShow = incomeMatches > 0;
    } else if (role === 'expense-header' || role === 'expense-total') {
      shouldShow = expenseMatches > 0;
    } else if (role === 'category') {
      shouldShow = (row.dataset.match === 'true');
    }

    if (shouldShow) {
      if (row.classList.contains('hidden')) {
        row.classList.remove('hidden');
        row.classList.remove('search-reveal');
        void row.offsetWidth;
        row.classList.add('search-reveal');
      }
    } else {
      row.classList.add('hidden');
      row.classList.remove('search-reveal');
    }
  });
};

window.initCategorySearch = function() {
  /**
   * Вешает слушатель на поле поиска.
   */
  const searchInput = document.getElementById('category-search');
  if (!searchInput) return;
  
  searchInput.removeEventListener('input', applyCategorySearch);
  searchInput.addEventListener('input', applyCategorySearch);
};