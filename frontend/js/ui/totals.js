window.recalcTotalsAndBalance = function() {
  /**
   * Пересчитывает итоги и баланс без полного ре-рендера таблицы.
   */
  if (!App.data) return;
  
  const { weeks, categories, plans, facts, initial_balance } = App.data;
  const vc = App.data.settings.visual_config || {};
  const cwColor = vc.currentWeekColor || '#fef08a';

  const incomeCats = categories.filter(c => c.type === 'income');
  const expenseCats = categories.filter(c => c.type === 'expense');

  const weekTotals = weeks.map(week => {
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

    return { weekStart: week.week_start, inc, exp };
  });

  const incTotalCells = document.querySelectorAll('.row-total-income td.data-cell-total');
  incTotalCells.forEach((td, i) => {
    const { inc } = weekTotals[i] || {};
    const div = td.querySelector('div');
    if (!div) return;
    div.textContent = inc ? formatAmount(inc) : '';
    div.style.setProperty('color', vc.totalIncomeColor || '#16a34a', 'important');
  });

  const expTotalCells = document.querySelectorAll('.row-total-expense td.data-cell-total');
  expTotalCells.forEach((td, i) => {
    const { exp } = weekTotals[i] || {};
    const div = td.querySelector('div');
    if (!div) return;
    div.textContent = exp ? `-${formatAmount(exp)}` : '';
    div.style.color = vc.totalExpenseColor || '#ef4444';
  });

  const negColor = vc.negativeBalanceColor || '#f87171';
  const weekColor = vc.weekColor || '#3b82f6';
  let running = initial_balance;

  const balanceCells = document.querySelectorAll('.row-balance td.balance-data-cell');
  balanceCells.forEach((td, i) => {
    const week = weeks[i];
    const wt = weekTotals[i];
    if (!wt) return;
    running += wt.inc - wt.exp;

    const inner = td.querySelector('.balance-cell-inner');
    const isNeg = running < 0;
    const isCurrent = isCurrentWeek(week.week_start, week.week_end);
    const isPast = isPastWeek(week.week_start, week.week_end);
    
    let bgColor;
    if (isCurrent) {
      bgColor = cwColor;
    } else if (isPast) {
      bgColor = PAST_WEEK_COLOR;
    } else {
      bgColor = weekColor;
    }
    
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
        </button>
      ` : ''}
      <span style="color:${textColor}">${formatAmount(running)}</span>`;
  });
}