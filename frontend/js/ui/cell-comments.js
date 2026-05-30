let _activeCommentEscapeListener = null;

async function saveCellComment(key) {
  /**
   * Сохраняет или удаляет комментарий к ячейке.
   */
  const textarea = document.getElementById('comment-textarea');
  if (!textarea) return;

  const text = textarea.value.trim();
  const [categoryId, weekStart] = key.split(':');
  const week = App.data.weeks.find(w => w.week_start === weekStart);

  const td = document.querySelector(
    `td[data-category-id="${categoryId}"][data-week-start="${weekStart}"]`
  );

  try {
    const result = await pywebview.api.save_cell_comment({
      category_id: parseInt(categoryId),
      week_start_date: weekStart,
      week_end_date: week.week_end,
      comment: text || null
    });

    if (!result.success) {
      showToast('Ошибка сохранения', 'error');
      return;
    }

    if (text) {
      CellComments[key] = text;
      showToast('Комментарий сохранён', 'success');
    } else {
      delete CellComments[key];
      showToast('Комментарий удалён', 'success');
    }
    
    closeCellCommentDialog();

    if (td) {
      refreshCellContent(td, App.data.plans, App.data.facts);
      updateCellCommentIcon(key);
    }

  } catch (e) {
    console.error('Ошибка сохранения комментария:', e);
    showToast('Ошибка соединения', 'error');
  }
}

function closeCellCommentDialog() {
  /**
   * Закрывает диалог комментария и удаляет слушатель Escape.
   */
  const dialog = document.getElementById('comment-dialog');
  if (dialog) {
    dialog.remove();
  }
  
  if (_activeCommentEscapeListener) {
    document.removeEventListener('keydown', _activeCommentEscapeListener);
    _activeCommentEscapeListener = null;
  }
}

function updateCellCommentIcon(key) {
  /**
   * Обновляет или удаляет иконку комментария в ячейке.
   */
  const [categoryId, weekStart] = key.split(':');
  const td = document.querySelector(
    `td[data-category-id="${categoryId}"][data-week-start="${weekStart}"]`
  );
  
  if (!td) return;
  
  const oldIcon = td.querySelector('.comment-icon');
  if (oldIcon) oldIcon.remove();
  
  if (CellComments[key]) {
    const icon = document.createElement('button');
    icon.className = 'comment-icon';
    icon.type = 'button';
    icon.title = CellComments[key];
    icon.innerHTML = '💬';
    icon.style.cssText = `
      position: absolute;
      top: 4px;
      right: 4px;
      background: none;
      border: none;
      font-size: 14px;
      cursor: pointer;
      padding: 0;
      line-height: 1;
      transition: transform 0.2s ease;
      z-index: 10;
      width: auto;
      height: auto;
    `;
    
    icon.addEventListener('mouseover', () => {
      icon.style.transform = 'scale(1.3)';
    });
    icon.addEventListener('mouseout', () => {
      icon.style.transform = 'scale(1)';
    });
    icon.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      openCellCommentDialog(key);
    });
    
    td.style.position = 'relative';
    td.appendChild(icon);
  }
}

async function deleteCellComment(key) {
  /**
   * Удаляет комментарий к ячейке.
   */
  const [categoryId, weekStart] = key.split(':');

  try {
    const result = await pywebview.api.save_cell_comment({
      category_id: parseInt(categoryId),
      week_start_date: weekStart,
      comment: null
    });

    if (!result.success) {
      showToast('Ошибка удаления', 'error');
      return;
    }

    delete CellComments[key];
    showToast('Комментарий удалён', 'success');

    const menu = document.getElementById('cell-context-menu');
    if (menu) menu.remove();

    updateCellCommentIcon(key);

  } catch (e) {
    showToast('Ошибка соединения', 'error');
  }
}

function openCellCommentDialog(key) {
  /**
   * Открывает диалог редактирования комментария к ячейке.
   */
  const menu = document.getElementById('cell-context-menu');
  if (menu) menu.remove();
  
  const oldDialog = document.getElementById('comment-dialog');
  if (oldDialog) oldDialog.remove();
  
  const [categoryId, weekStart] = key.split(':');
  const td = document.querySelector(
    `td[data-category-id="${categoryId}"][data-week-start="${weekStart}"]`
  );
  
  if (td && !td.querySelector('.data-cell-inner')?.textContent?.trim()) {
    showToast('Нельзя делать комментарии в пустой ячейке', 'error');
    return;
  }

  const currentComment = CellComments[key] || '';
  const isDark = document.body.classList.contains('dark');
  
  const dialog = document.createElement('div');
  dialog.id = 'comment-dialog';
  dialog.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex !important;
    align-items: center;
    justify-content: center;
    z-index: 10001;
    backdrop-filter: blur(2px);
  `;
  
  const content = document.createElement('div');
  content.style.cssText = `
    background: ${isDark ? '#334155' : '#ffffff'};
    border-radius: 12px;
    padding: 24px;
    width: 90%;
    max-width: 500px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    animation: modalIn 250ms cubic-bezier(0.34, 1.56, 0.64, 1);
  `;
  
  content.innerHTML = `
    <h3 style="
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 16px;
      color: ${isDark ? '#f1f5f9' : '#0f172a'};
    ">Комментарий к ячейке</h3>
    
    <textarea id="comment-textarea"
      placeholder="Введите комментарий..."
      style="
        width: 100%;
        height: 120px;
        border: 2px solid ${isDark ? '#475569' : '#e2e8f0'};
        border-radius: 8px;
        padding: 12px;
        font-family: inherit;
        font-size: 14px;
        resize: none;
        outline: none;
        background: ${isDark ? '#1e293b' : '#f8fafc'};
        color: ${isDark ? '#f1f5f9' : '#0f172a'};
        box-sizing: border-box;
      "
    >${currentComment}</textarea>
    
    <div style="display: flex; gap: 12px; margin-top: 20px; justify-content: flex-end;">
      <button id="comment-cancel"
        style="
          padding: 10px 20px;
          background: ${isDark ? '#475569' : '#f1f5f9'};
          color: ${isDark ? '#f1f5f9' : '#0f172a'};
          border: 1px solid ${isDark ? '#64748b' : '#e2e8f0'};
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s ease;
          font-size: 14px;
        ">
        Отмена
      </button>
      <button id="comment-save"
        style="
          padding: 10px 20px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s ease;
          font-size: 14px;
        ">
        Сохранить
      </button>
    </div>
  `;
  
  dialog.appendChild(content);
  document.body.appendChild(dialog);
  
  const textarea = document.getElementById('comment-textarea');
  const cancelBtn = document.getElementById('comment-cancel');
  const saveBtn = document.getElementById('comment-save');
  
  setTimeout(() => {
    if (textarea) textarea.focus();
  }, 100);
  
  const closeOnOverlay = (e) => {
    if (e.target === dialog) {
      closeCellCommentDialog();
    }
  };
  dialog.addEventListener('click', closeOnOverlay);
  
  cancelBtn.addEventListener('click', () => {
    closeCellCommentDialog();
  });
  
  saveBtn.addEventListener('click', () => {
    saveCellComment(key);
  });
  
  if (_activeCommentEscapeListener) {
    document.removeEventListener('keydown', _activeCommentEscapeListener);
  }
  
  _activeCommentEscapeListener = (e) => {
    if (e.key === 'Escape') {
      closeCellCommentDialog();
    }
  };
  document.addEventListener('keydown', _activeCommentEscapeListener);
}

function refreshAllCommentIcons() {
  /**
   * Обновляет все иконки комментариев в таблице.
   */
  document.querySelectorAll('.comment-icon').forEach(el => el.remove());
  
  Object.entries(CellComments).forEach(([key, comment]) => {
    if (!comment) return;
    updateCellCommentIcon(key);
  });
}