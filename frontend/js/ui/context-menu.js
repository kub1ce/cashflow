let _activeContextMenuListener = null;
let _contextMenuEscapeListener = null;

function showCellContextMenu(td, event) {
  /**
   * Открывает контекстное меню для редактирования или удаления комментария.
   */
  const key = `${td.dataset.categoryId}:${td.dataset.weekStart}`;
  const hasComment = !!CellComments[key];
  
  const oldMenu = document.getElementById('cell-context-menu');
  if (oldMenu) oldMenu.remove();
  
  const isDark = document.body.classList.contains('dark');
  
  const menu = document.createElement('div');
  menu.id = 'cell-context-menu';
  menu.className = 'cell-context-menu';
  menu.style.cssText = `
    position: fixed;
    top: ${event.clientY}px;
    left: ${event.clientX}px;
    background: ${isDark ? '#334155' : '#ffffff'};
    border: 1px solid ${isDark ? '#475569' : '#e2e8f0'};
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10000;
    min-width: 200px;
    overflow: hidden;
  `;
  
  menu.innerHTML = `
    <button class="context-menu-item" onclick="openCellCommentDialog('${key}')" style="color: ${isDark ? '#e2e8f0' : '#334155'}; background: none; border: none; width: 100%; text-align: left; padding: 12px 16px; cursor: pointer; display: flex; align-items: center; gap: 12px; font-size: 14px; transition: all 150ms ease;">
      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"/>
      </svg>
      ${hasComment ? 'Редактировать' : 'Добавить'} комментарий
    </button>
    ${hasComment ? `
      <button class="context-menu-item" onclick="deleteCellComment('${key}')" style="color: ${isDark ? '#e2e8f0' : '#334155'}; background: none; border: none; border-top: 1px solid ${isDark ? '#475569' : '#f1f5f9'}; width: 100%; text-align: left; padding: 12px 16px; cursor: pointer; display: flex; align-items: center; gap: 12px; font-size: 14px; transition: all 150ms ease;">
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
        </svg>
        Удалить комментарий
      </button>
    ` : ''}
  `;
  
  document.body.appendChild(menu);
  
  if (_activeContextMenuListener) {
    document.removeEventListener('click', _activeContextMenuListener);
  }

  _activeContextMenuListener = function closeMenu(e) {
    if (!menu.contains(e.target)) {
      menu.remove();
      document.removeEventListener('click', _activeContextMenuListener);
      _activeContextMenuListener = null;
      document.removeEventListener('keydown', _contextMenuEscapeListener);
      _contextMenuEscapeListener = null;
    }
  };

  setTimeout(() => {
    document.addEventListener('click', _activeContextMenuListener);
  }, 0);

  if (typeof _contextMenuEscapeListener === 'function') {
    document.removeEventListener('keydown', _contextMenuEscapeListener);
  }
  
  _contextMenuEscapeListener = function(e) {
    if (e.key === 'Escape') {
      menu.remove();
      document.removeEventListener('click', _activeContextMenuListener);
      document.removeEventListener('keydown', _contextMenuEscapeListener);
      _activeContextMenuListener = null;
      _contextMenuEscapeListener = null;
    }
  };
  document.addEventListener('keydown', _contextMenuEscapeListener);
}