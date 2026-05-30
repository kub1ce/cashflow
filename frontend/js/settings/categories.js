function startCategoryEdit(catId) {
  /**
   * Включает режим редактирования названия категории.
   */
  closeAllEditEmojiPickers();

  document.getElementById(`cat-display-${catId}`)?.classList.add('hidden');
  const editWrap = document.getElementById(`cat-edit-${catId}`);
  editWrap?.classList.remove('hidden');
  document.getElementById(`cat-edit-input-${catId}`)?.focus();
}

function cancelCategoryEdit(catId) {
  /**
   * Отменяет редактирование категории и возвращает режим просмотра.
   */
  closeAllEditEmojiPickers();
  document.getElementById(`cat-display-${catId}`)?.classList.remove('hidden');
  document.getElementById(`cat-edit-${catId}`)?.classList.add('hidden');
}

async function saveCategoryName(catId) {
  /**
   * Сохраняет новое название категории и обновляет интерфейс.
   */
  closeAllEditEmojiPickers();
  
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
  /**
   * Мгновенно обновляет цвет категории в UI (в настройках и таблице) 
   * и асинхронно сохраняет изменения в базу данных.
   */
  const dot = inputEl.previousElementSibling;
  if (dot) dot.style.background = colorValue;

  const tableRow = document.querySelector(
    `tr[data-category-id="${catId}"] .cat-color-dot`
  );
  if (tableRow) tableRow.style.background = colorValue;

  document.querySelectorAll(
    `td[data-category-id="${catId}"]`
  ).forEach(td => {
    td.dataset.colorCode = colorValue;
  });

  if (App.data) {
    const cat = App.data.categories.find(c => c.id === catId);
    if (cat) cat.color_code = colorValue;
  }

  document.querySelectorAll(
    `td.data-cell[data-category-id="${catId}"]`
  ).forEach(td => {
    refreshCellContent(td, App.data?.plans, App.data?.facts);
  });

  try {
    await pywebview.api.update_category(catId, { color_code: colorValue });
  } catch (e) {
    showToast('Ошибка обновления цвета', 'error');
  }
}

async function submitAddCategorySettings() {
  /**
   * Добавляет новую категорию через настройки и точечно обновляет UI.
   */
  const nameInput = document.getElementById('s-new-cat-name');
  const name = nameInput?.value.trim();
  const type = document.getElementById('s-new-cat-type')?.value;

  if (!name) { showToast('Введите название категории', 'error'); return; }

  try {
    const result = await pywebview.api.add_category({
      name,
      type,
      color_code: type === 'income' ? '#10b981' : '#f43f5e',
    });

    if (result.success) {
      nameInput.value = '';
      showToast(`Категория «${name}» добавлена`, 'success');

      await reloadData(true);

      if (App.activeView === 'settings' && App.data) {
        const allCats = App.data.categories;

        const incomeContainer = document.getElementById('s-income-cats');
        const expenseContainer = document.getElementById('s-expense-cats');

        if (incomeContainer) {
          renderSettingsCategoryList(
            allCats.filter(c => c.type === 'income'),
            incomeContainer
          );
        }
        if (expenseContainer) {
          renderSettingsCategoryList(
            allCats.filter(c => c.type === 'expense'),
            expenseContainer
          );
        }
      }

      if (App.data) renderTable(App.data);

    } else {
      showToast('Ошибка: ' + result.error, 'error');
    }
  } catch (e) {
    showToast('Ошибка соединения', 'error');
  }
}

async function deleteCategorySettings(catId, catName) {
  /**
   * Запрашивает подтверждение и удаляет категорию со всеми связанными данными.
   */
  const ok = await showConfirm(
    `Удалить «${catName}»?`,
    'Все связанные планы и факты будут удалены.'
  );
  if (!ok) return;

  try {
    const result = await pywebview.api.delete_category(catId);
    if (result.success) {
      showToast('Категория удалена', 'success');
      UndoHistory.clear();

      await reloadData(true);

      if (App.activeView === 'settings' && App.data) {
        const allCats = App.data.categories;

        const incomeContainer = document.getElementById('s-income-cats');
        const expenseContainer = document.getElementById('s-expense-cats');

        if (incomeContainer) {
          renderSettingsCategoryList(
            allCats.filter(c => c.type === 'income'),
            incomeContainer
          );
        }
        if (expenseContainer) {
          renderSettingsCategoryList(
            allCats.filter(c => c.type === 'expense'),
            expenseContainer
          );
        }
      }

      if (App.data) renderTable(App.data);

    } else {
      showToast('Ошибка: ' + result.error, 'error');
    }
  } catch (e) {
    showToast('Ошибка соединения', 'error');
  }
}