function handleReconcileInput() {
  /**
   * Обновляет превью при вводе фактического баланса.
   */
  const actual = parseFloat(this.value);
  const calcEl = document.getElementById('reconcile-calculated');
  const calculated = parseFloat(calcEl.dataset.value || '0');
  const preview = document.getElementById('reconcile-diff-preview');

  if (isNaN(actual)) { 
    preview.classList.add('hidden'); 
    return; 
  }

  const diff = actual - calculated;
  if (Math.abs(diff) < 0.01) {
    preview.style.cssText = 'padding:12px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;font-size:12px;color:#166534;';
    preview.textContent = '✓ Балансы совпадают. Корректировка не нужна.';
  } else if (diff > 0) {
    preview.style.cssText = 'padding:12px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;font-size:12px;color:#1d4ed8;';
    preview.innerHTML = `Будет добавлен доход <strong>«Незапланированные доходы» ${formatAmount(diff)} ₽</strong>`;
  } else {
    preview.style.cssText = 'padding:12px;background:#fff1f2;border:1px solid #fecdd3;border-radius:8px;font-size:12px;color:#be123c;';
    preview.innerHTML = `Будет добавлен расход <strong>«Незапланированные расходы» ${formatAmount(Math.abs(diff))} ₽</strong>`;
  }
  preview.classList.remove('hidden');
}

async function openReconcileModal() {
  /**
   * Открывает окно сверки баланса.
   */
  const today = getTodayISO();

  document.getElementById('reconcile-date').value = today;
  document.getElementById('reconcile-actual').value = '';
  document.getElementById('reconcile-diff-preview').classList.add('hidden');
  
  const calcEl = document.getElementById('reconcile-calculated');
  calcEl.textContent = '...';
  calcEl.dataset.value = '';
  calcEl.dataset.weekStart = '';
  calcEl.dataset.weekEnd = '';

  showModal('reconcile-modal');
  await updateReconcileCalculated(today);
  setTimeout(() => document.getElementById('reconcile-actual').focus(), 100);
}

async function updateReconcileCalculated(dateStr) {
  /**
   * Загружает расчетный баланс для выбранной даты.
   */
  if (!dateStr) return;

  const targetWeek = App.data?.weeks?.find(w => dateStr >= w.week_start && dateStr <= w.week_end);
  const weekStart = targetWeek?.week_start;
  const weekEnd = targetWeek?.week_end;

  const calcEl = document.getElementById('reconcile-calculated');

  if (!weekStart) {
    calcEl.textContent = 'Вне периода';
    return;
  }

  calcEl.textContent = '...';

  try {
    const res = await pywebview.api.get_calculated_balance(weekStart);
    if (res.success) {
      calcEl.textContent = `${formatAmount(res.balance)} ₽`;
      calcEl.dataset.value = res.balance;
      calcEl.dataset.weekStart = weekStart;
      calcEl.dataset.weekEnd = weekEnd;
    } else {
      calcEl.textContent = 'Ошибка';
    }
  } catch (e) {
    calcEl.textContent = 'Ошибка';
  }

  setTimeout(() => document.getElementById('reconcile-actual').focus(), 100);
}

function closeReconcileModal() {
  /**
   * Закрывает окно сверки баланса.
   */
  hideModal('reconcile-modal');
}

document.getElementById('reconcile-actual')?.addEventListener('input', handleReconcileInput);
document.getElementById('reconcile-modal')?.addEventListener('click', function(e) {
  if (e.target === this) closeReconcileModal();
});

async function submitReconcile() {
  /**
   * Подтверждает сверку баланса и отправляет данные.
   */
  const actualVal = parseFloat(document.getElementById('reconcile-actual').value);
  const calcEl = document.getElementById('reconcile-calculated');
  const calcVal = parseFloat(calcEl.dataset.value || '0');
  const weekStart = calcEl.dataset.weekStart;
  const weekEnd = calcEl.dataset.weekEnd;

  if (isNaN(actualVal)) { 
    showToast('Введите фактический баланс', 'error'); 
    return; 
  }
  
  if (actualVal < 0) { 
    showToast('Введите корректный баланс (≥ 0)', 'error'); 
    return; 
  }

  try {
    const result = await pywebview.api.reconcile_balance({
      actual_balance: actualVal,
      calculated_balance: calcVal,
      week_start: weekStart,
      week_end: weekEnd,
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