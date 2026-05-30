function openCellEditor(td, mode) {
  /**
   * Открывает редактор ячейки. 
   * Динамически проверяет базу: если факты есть - открывает вкладку "Факт", иначе "План".
   */
  closeActiveCellEditor(true);

  const catId = parseInt(td.dataset.categoryId);
  const weekStart = td.dataset.weekStart;
  const weekEnd = td.dataset.weekEnd;
  const key = `${catId}:${weekStart}`;
  const hasFacts = App.data?.facts?.[key] && App.data.facts[key].length > 0;
  
  const editorMode = mode || (hasFacts ? 'fact' : 'plan');
  
  App.editing = {
    categoryId: catId,
    weekStart: weekStart,
    weekEnd: weekEnd,
    mode: mode,
    unlocked: false,
    el: td
  };

  const editor = document.createElement('div');
  editor.className = `cell-editor mode-${editorMode}`;
  editor.id = 'active-cell-editor';
  
  const rect = td.getBoundingClientRect();
  editor.style.position = 'fixed';
  editor.style.top = `${rect.top}px`;
  editor.style.left = `${rect.left}px`;
  editor.style.zIndex = '9999';

  editor.addEventListener('click', e => e.stopPropagation());

  editor.innerHTML = `
    <div class="cell-editor-tabs">
      <button class="cell-editor-tab ${editorMode === 'plan' ? 'active' : ''}" data-mode="plan" type="button">План</button>
      <button class="cell-editor-tab ${editorMode === 'fact' ? 'active' : ''}" data-mode="fact" type="button">Факт</button>
    </div>
    <div id="cell-editor-body"></div>
  `;

  document.body.appendChild(editor);

  editor.querySelectorAll('.cell-editor-tab').forEach(btn => {
    btn.addEventListener('click', (e) => {
      App.editing.mode = e.target.dataset.mode;
      editor.className = `cell-editor mode-${App.editing.mode}`;
      editor.querySelectorAll('.cell-editor-tab').forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');
      renderEditorBody();
    });
  });

  renderEditorBody();

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.addEventListener('click', onOutsideClick);
    });
  });
}

function onOutsideClick(e) {
  /**
   * Обрабатывает клик вне редактора для его автоматического закрытия.
   */
  const editor = document.getElementById('active-cell-editor');
  if (!editor) {
    document.removeEventListener('click', onOutsideClick);
    return;
  }
  
  if (!editor.contains(e.target)) {
    document.removeEventListener('click', onOutsideClick);
    closeActiveCellEditor(true);
  }
}

function closeActiveCellEditor(cancel = false) {
  /**
   * Закрывает редактор ячейки и сбрасывает временное состояние.
   */
  document.removeEventListener('click', onOutsideClick);
  const editor = document.getElementById('active-cell-editor');
  if (editor) editor.remove();
  
  if (cancel && App.editing.el) {
    const { categoryId, weekStart } = App.editing;
    const key = `${categoryId}:${weekStart}`;
    
    refreshCellContent(App.editing.el, App.data?.plans, App.data?.facts);
    updateCellCommentIcon(key);
  }
  
  App.editing = {
    categoryId: null,
    weekStart: null,
    weekEnd: null,
    mode: 'plan',
    el: null,
  };
}

window.saveCellEditor = async function() {
  /**
   * Сохраняет плановое значение ячейки и отправляет на бэкенд.
   */
  const input = document.getElementById('cell-editor-input');
  if (!input) return;

  const amount = evalAmount(input.value);
  const { categoryId, weekStart, weekEnd, mode, el } = App.editing;

  if (amount < 0) {
    showToast('Сумма не может быть отрицательной', 'error');
    if (el && typeof Anim !== 'undefined') Anim.flashCellError(el);
    refreshCellContent(el, App.data.plans, App.data.facts);
    return;
  }

  const editor = document.getElementById('active-cell-editor');
  if (editor) editor.remove();

  if (!categoryId || !weekStart) return;

  const key = `${categoryId}:${weekStart}`;
  const oldValue = App.data.plans[key]?.amount || 0;

  if (amount === 0) {
    delete App.data.plans[key];
  } else {
    App.data.plans[key] = { amount };
  }

  if (el) {
    refreshCellContent(el, App.data.plans, App.data.facts);
    updateCellCommentIcon(key);
  }

  recalcTotalsAndBalance();

  UndoHistory.push({
    type: ACTION_TYPES.CELL_EDIT,
    categoryId,
    weekStart,
    weekEnd,
    mode: 'plan',
    oldValue,
    newValue: amount,
    timestamp: Date.now(),
  });

  App.editing = {
    categoryId: null,
    weekStart: null,
    weekEnd: null,
    mode: 'plan',
    el: null
  };

  try {
    await pywebview.api.save_cell({
      category_id: categoryId,
      week_start_date: weekStart,
      week_end_date: weekEnd,
      amount,
      mode: 'plan',
    });
  } catch (e) {
    console.error('Ошибка сохранения плана:', e);
    showToast('Ошибка сохранения', 'error');
    await reloadData();
  }
}

let _isSavingFact = false;

async function addNewFact() {
  /**
   * Сохраняет новую фактическую транзакцию и точечно обновляет UI.
   */
  if (_isSavingFact) return;
  
  const dateInput = document.getElementById('new-fact-date').value;
  const amtInput = document.getElementById('new-fact-amount');
  const amount = evalAmount(amtInput.value);
  const { categoryId, weekStart, weekEnd, el } = App.editing;

  if (amount <= 0) {
    showToast('Введите сумму больше нуля', 'error');
    if (typeof Anim !== 'undefined') Anim.shakeEditor();
    return;
  }

  _isSavingFact = true;
  const btn = document.querySelector('.fact-btn-primary');
  if (btn) btn.disabled = true;

  try {
    const res = await pywebview.api.add_fact_transaction({
      category_id: categoryId,
      week_start: weekStart,
      week_end: weekEnd,
      amount: amount,
      date: dateInput
    });

    if (res.success) {
      UndoHistory.push({
        type: 'ADD_FACT',
        factIds: res.fact_ids,
        timestamp: Date.now(),
      });
      
      await reloadData(true);
      
      if (el) {
        refreshCellContent(el, App.data.plans, App.data.facts);
        updateCellCommentIcon(`${categoryId}:${weekStart}`);
        recalcTotalsAndBalance();
        if (typeof Anim !== 'undefined') Anim.flashCellSaved(el);
      }
      
      renderEditorBody(true);
      amtInput.value = '';
      amtInput.focus();
      
    } else {
      showToast(res.error, 'error');
      if (typeof Anim !== 'undefined') Anim.shakeEditor();
    }
  } catch (e) {
    showToast('Ошибка связи', 'error');
  } finally {
    _isSavingFact = false;
    if (btn) btn.disabled = false;
  }
}

async function deleteFact(factId) {
  /**
   * Удаляет фактическую транзакцию с анимацией исчезновения.
   */
  const itemEl = document.getElementById(`fact-item-${factId}`);
  if (itemEl) {
    itemEl.style.animationDelay = '0ms';
    itemEl.classList.add('fact-item-exit');
    await new Promise(r => setTimeout(r, 200));
  }

  try {
    const res = await pywebview.api.delete_fact_transaction({ fact_id: factId });
    if (res.success) {
      UndoHistory.push({
        type: 'DELETE_FACT',
        deletedData: res.deleted_data,
        timestamp: Date.now(),
      });
      
      await reloadData(true);
      
      const { el, categoryId, weekStart } = App.editing;
      if (el) {
        refreshCellContent(el, App.data.plans, App.data.facts);
        updateCellCommentIcon(`${categoryId}:${weekStart}`);
        recalcTotalsAndBalance();
        if (typeof Anim !== 'undefined') Anim.flashCellSaved(el);
      }
      
      renderEditorBody(true);
    }
  } catch (e) {
    showToast('Ошибка связи', 'error');
    renderEditorBody(true);
  }
}

async function saveEditFact(factId) {
  /**
   * Обновляет сумму существующей фактической транзакции.
   */
  const input = document.getElementById(`edit-fact-input-${factId}`);
  const amount = evalAmount(input.value);

  if (amount <= 0) {
    showToast('Сумма должна быть больше нуля', 'error');
    if (typeof Anim !== 'undefined') Anim.shakeEditor();
    return;
  }

  try {
    const res = await pywebview.api.update_fact_transaction({
      fact_id: factId,
      amount: amount
    });
    
    if (res.success) {
      UndoHistory.push({
        type: 'EDIT_FACT',
        factId: factId,
        oldAmount: res.old_amount,
        newAmount: amount,
        timestamp: Date.now()
      });
      
      await reloadData(true);
      
      const { el, categoryId, weekStart } = App.editing;
      if (el) {
        refreshCellContent(el, App.data.plans, App.data.facts);
        updateCellCommentIcon(`${categoryId}:${weekStart}`);
        recalcTotalsAndBalance();
        if (typeof Anim !== 'undefined') Anim.flashCellSaved(el);
      }
      
      renderEditorBody(true);
    }
  } catch (e) {
    showToast('Ошибка связи', 'error');
  }
}