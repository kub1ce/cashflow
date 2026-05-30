function openAutofill(event, categoryId) {
  /**
   * Открывает окно автозаполнения для выбранной категории.
   */
  event.stopPropagation();
  Autofill.categoryId = categoryId;
  Autofill.mode = 'weeks';

  const cat = App.data.categories.find(c => c.id === categoryId);
  document.getElementById('autofill-cat-name').textContent = cat?.name || '';

  setAutofillMode('weeks');
  
  const monday = getMondayOf(getTodayISO());
  document.getElementById('autofill-start-date').value = monday;
  document.getElementById('autofill-weeks').value = 12;
  document.getElementById('autofill-amount').value = '';
  document.getElementById('autofill-day-of-month').value = 1;
  document.getElementById('autofill-week-hint').classList.add('hidden');
  document.getElementById('af-preview').classList.add('hidden');

  showModal('autofill-modal');
  setTimeout(() => document.getElementById('autofill-amount').focus(), 100);
}

function closeAutofillModal() {
  /**
   * Закрывает модальное окно автозаполнения.
   */
  hideModal('autofill-modal');
  Autofill.categoryId = null;
}

function setAutofillMode(mode) {
  /**
   * Переключает режим автозаполнения и обновляет элементы интерфейса.
   */
  Autofill.mode = mode;

  document.getElementById('af-mode-weeks').classList.toggle('active', mode === 'weeks');
  document.getElementById('af-mode-months').classList.toggle('active', mode === 'months');
  document.getElementById('af-day-of-month-wrap').classList.toggle('hidden', mode === 'weeks');

  document.getElementById('af-count-label').textContent =
    mode === 'weeks' ? 'Количество недель' : 'Количество месяцев';

  document.getElementById('autofill-weeks').max = mode === 'weeks' ? 52 : 24;

  if (mode === 'months') {
    const catId = Autofill.categoryId;
    const cat = App.data?.categories?.find(c => c.id === catId);
    const isExpense = cat?.type === 'expense';
    
    document.getElementById('af-day-label').textContent =
      isExpense ? 'День месяца (день траты)' : 'День месяца (день поступления)';
  }

  updateAutofillPreview();
}

function updateAutofillPreview() {
  /**
   * Рассчитывает и обновляет информацию в превью автозаполнения.
   */
  const startVal = document.getElementById('autofill-start-date').value;
  const count = parseInt(document.getElementById('autofill-weeks').value) || 0;
  const amount = parseFloat(document.getElementById('autofill-amount').value) || 0;
  const dayOfMonth = parseInt(document.getElementById('autofill-day-of-month').value) || 1;
  const preview = document.getElementById('af-preview');

  if (!startVal || count <= 0 || amount <= 0) {
    preview.classList.add('hidden');
    return;
  }

  if (Autofill.mode === 'weeks') {
    const monday = getMondayOf(startVal);
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

document.getElementById('autofill-start-date')?.addEventListener('change', function() {
  const val = this.value;
  const hint = document.getElementById('autofill-week-hint');
  
  if (!val || !App.data) { 
    hint.classList.add('hidden'); 
    return; 
  }

  const monday = getMondayOf(val);
  const week = App.data.weeks.find(w => w.week_start === monday);
  
  if (week) {
    hint.textContent = `Начнётся с: Неделя ${week.week_number} (${week.label})`;
    hint.classList.remove('hidden');
  }
  updateAutofillPreview();
});

document.getElementById('autofill-weeks')?.addEventListener('input', updateAutofillPreview);
document.getElementById('autofill-amount')?.addEventListener('input', updateAutofillPreview);
document.getElementById('autofill-day-of-month')?.addEventListener('input', updateAutofillPreview);

async function submitAutofill() {
  /**
   * Отправляет данные автозаполнения на бэкенд и сохраняет в историю.
   */
  const startDate = document.getElementById('autofill-start-date').value;
  const count = parseInt(document.getElementById('autofill-weeks').value);
  const amount = parseFloat(document.getElementById('autofill-amount').value);
  const dayOfMonth = parseInt(document.getElementById('autofill-day-of-month').value) || 1;

  if (!startDate) { showToast('Укажите начальную дату', 'error'); return; }
  if (!count || count <= 0) { showToast('Укажите количество', 'error'); return; }
  if (!amount || amount <= 0) { showToast('Укажите сумму', 'error'); return; }

  try {
    const result = await pywebview.api.autofill({
      category_id: Autofill.categoryId,
      start_date: startDate,
      amount,
      mode: Autofill.mode,
      count,
      day_of_month: dayOfMonth,
    });

    if (result.success) {
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
      
      const periodLabel = Autofill.mode === 'weeks' 
        ? pluralWeeks(result.filled) 
        : pluralMonths(result.filled);
        
      showToast(`Заполнено ${result.filled} ${periodLabel}`, 'success');
      await reloadData()
    } else {
      showToast('Ошибка: ' + result.error, 'error');
    }
  } catch (e) {
    showToast('Ошибка соединения', 'error');
  }
}