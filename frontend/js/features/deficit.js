function setDeficitMode(mode) {
  /**
   * Устанавливает режим покрытия кассового разрыва.
   */
  Deficit.mode = mode;

  document.getElementById('def-mode-single').classList.toggle('active', mode === 'single');
  document.getElementById('def-mode-parts').classList.toggle('active', mode === 'parts');

  document.getElementById('def-single-wrap').classList.toggle('hidden', mode !== 'single');
  document.getElementById('def-parts-wrap').classList.toggle('hidden', mode !== 'parts');

  if (mode === 'parts') updateDeficitPartsPreview();
}

function updateDeficitPartsPreview() {
  /**
   * Обновляет превью для частичного покрытия разрыва.
   */
  const count = parseInt(document.getElementById('def-parts-count').value) || 0;
  const period = document.getElementById('def-parts-period').value;
  const startDate = document.getElementById('def-parts-start-date').value;
  const preview = document.getElementById('def-parts-preview');

  if (!count || count < 2 || !startDate) {
    preview.classList.add('hidden');
    return;
  }

  const perPayment = Deficit.amount / count;
  const periodLabel = period === 'weeks' ? `${count} ${pluralWeeks(count)}` : `${count} мес.`;

  preview.innerHTML = `
    Сумма каждой выплаты: <strong>${formatAmount(perPayment)} ₽</strong><br>
    Период: <strong>${periodLabel}</strong> начиная с выбранной даты`;
  preview.classList.remove('hidden');
}

async function handleDeficit(event, weekStart, weekEnd, deficitAmount) {
  /**
   * Обрабатывает кассовый разрыв согласно выбранной стратегии.
   */
  event.stopPropagation();
  if (!App.data) return;

  const strategy = App.data.settings.financial_strategy;
  Deficit.weekStart = weekStart;
  Deficit.weekEnd = weekEnd;
  Deficit.amount = deficitAmount;
  Deficit.mode = 'single';

  if (strategy === 'manual') {
    showToast('Ручное управление: автодействия отключены', 'info');
    return;
  }

  if (strategy === 'saving_first') {
    const result = await pywebview.api.handle_deficit({
      week_start: weekStart,
      week_end: weekEnd,
      deficit: deficitAmount,
      strategy: 'saving_first',
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
    document.getElementById('deficit-amount-display').textContent = `${formatAmount(deficitAmount)} ₽`;
    setDeficitMode('single');

    const ret = new Date(weekStart + 'T00:00:00');
    ret.setDate(ret.getDate() + 28);
    
    document.getElementById('deficit-return-date').value = ret.toISOString().split('T')[0];
    document.getElementById('def-parts-start-date').value = ret.toISOString().split('T')[0];
    document.getElementById('def-parts-count').value = 4;
    document.getElementById('def-parts-preview').classList.add('hidden');

    showModal('deficit-modal');
  }
}

function closeDeficitModal() {
  /**
   * Закрывает окно покрытия разрыва.
   */
  hideModal('deficit-modal');
}

async function submitDeficit() {
  /**
   * Подтверждает покрытие кассового разрыва.
   */
  if (Deficit.mode === 'single') {
    const returnDate = document.getElementById('deficit-return-date').value;
    if (!returnDate) { showToast('Укажите дату возврата', 'error'); return; }

    try {
      const result = await pywebview.api.handle_deficit({
        week_start: Deficit.weekStart,
        week_end: Deficit.weekEnd,
        deficit: Deficit.amount,
        strategy: 'credit_first',
        return_date: returnDate,
      });
      
      if (result.success) {
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
    const count = parseInt(document.getElementById('def-parts-count').value);
    const period = document.getElementById('def-parts-period').value;
    const startDate = document.getElementById('def-parts-start-date').value;

    if (!count || count < 2) { showToast('Укажите количество выплат (минимум 2)', 'error'); return; }
    if (!startDate) { showToast('Укажите дату первой выплаты', 'error'); return; }

    try {
      const result = await pywebview.api.handle_deficit({
        week_start: Deficit.weekStart,
        week_end: Deficit.weekEnd,
        deficit: Deficit.amount,
        strategy: 'credit_first',
        repayment_mode: 'parts',
        parts_count: count,
        parts_period: period,
        parts_start_date: startDate,
      });
      
      if (result.success) {
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
        let periodLabel = '';
        
        if (period === 'weeks') {
          periodLabel = pluralWeeks(count);
        } else {
          const m10 = count % 10, m100 = count % 100;
          if (m100 >= 11 && m100 <= 19) periodLabel = 'месяцев';
          else if (m10 === 1) periodLabel = 'месяц';
          else if (m10 >= 2 && m10 <= 4) periodLabel = 'месяца';
          else periodLabel = 'месяцев';
        }
        
        showToast(`Займ оформлен, ${count} ${periodLabel} запланировано`, 'success');
        await reloadData();
      } else {
        showToast('Ошибка: ' + result.error, 'error');
      }
    } catch (e) {
      showToast('Ошибка соединения', 'error');
    }
  }
}