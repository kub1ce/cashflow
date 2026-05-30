window.renderSettingsView = async function() {
  /**
   * Загружает данные с бэкенда и рендерит страницу настроек: 
   * параметры планирования, категории, оформление и гайд.
   */
  const container = document.getElementById('settings-content');
  container.innerHTML = '<div class="text-slate-400 text-sm">Загрузка...</div>';

  let settings, categories, account;
  try {
    [settings, categories, account] = await Promise.all([
      pywebview.api.get_settings(),
      pywebview.api.get_categories(),
      pywebview.api.get_account(),
    ]);
  } catch (e) {
    container.innerHTML = '<div class="text-rose-500 text-sm">Ошибка загрузки</div>';
    return;
  }

  const vc = settings?.visual_config || {};

  let warningHtml = '';
  if (App.data && App.data.weeks && App.data.weeks.length > 0) {
    const today = getTodayISO();
    const firstWeek = App.data.weeks[0];
    const lastWeek = App.data.weeks[App.data.weeks.length - 1];
    
    if (today < firstWeek.week_start) {
      warningHtml = `
        <div style="padding:12px; background:#fef3c7; border:1px solid #fcd34d; 
                    border-radius:8px; font-size:13px; color:#92400e; margin-bottom:20px;">
          ⚠️ <strong>Внимание:</strong> Период планирования начинается ${firstWeek.week_start}, 
          а текущая дата ${today}. Текущая неделя не будет выделена.
        </div>`;
    } else if (today > lastWeek.week_end) {
      warningHtml = `
        <div style="padding:12px; background:#fef3c7; border:1px solid #fcd34d; 
                    border-radius:8px; font-size:13px; color:#92400e; margin-bottom:20px;">
          ⚠️ <strong>Внимание:</strong> Период планирования заканчивается ${lastWeek.week_end}, 
          а текущая дата ${today}. Текущая неделя не будет выделена.
        </div>`;
    }
  }

  container.innerHTML = `
    <div class="settings-section">
      <h2>Параметры планирования</h2>
      <div class="space-y-4">
        <div>
          <label class="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wide">
            Дата начала периода
          </label>
          <input type="date" id="s-start-date"
                 class="settings-input"
                 value="${settings.planning_start_date || ''}"/>
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wide">
            Стратегия при кассовых разрывах
          </label>
          <select id="s-strategy" class="settings-select w-full max-w-sm">
            <option value="manual"       ${settings.financial_strategy==='manual'       ? 'selected':''}>
              Ручное управление (только подсветка)
            </option>
            <option value="saving_first" ${settings.financial_strategy==='saving_first' ? 'selected':''}>
              Приоритет: Накопления (Копилка)
            </option>
            <option value="credit_first" ${settings.financial_strategy==='credit_first' ? 'selected':''}>
              Приоритет: Кредитка (Заёмные средства)
            </option>
          </select>
          <p class="text-xs text-slate-500 mt-1.5">
            Система будет предлагать покрытие отрицательного остатка за счёт выбранного источника.
          </p>
        </div>
        <div>
          <button onclick="saveMainSettings()"
                  class="btn-settings-primary">
            Сохранить
          </button>
        </div>
      </div>
    </div>

    <div class="settings-section">
      <h2>Статьи доходов и расходов</h2>

      <div class="grid grid-cols-2 gap-8 mb-6">
        <div>
          <h3 class="text-xs font-bold text-emerald-600 uppercase mb-3
                     border-b border-slate-100 pb-2">Доходы</h3>
          <div id="s-income-cats"
               class="space-y-2 max-h-[300px] overflow-y-auto pr-1">
          </div>
        </div>

        <div>
          <h3 class="text-xs font-bold text-rose-600 uppercase mb-3
                     border-b border-slate-100 pb-2">Расходы</h3>
          <div id="s-expense-cats"
               class="space-y-2 max-h-[300px] overflow-y-auto pr-1">
          </div>
        </div>
      </div>

      <div class="pt-4 border-t border-slate-100 flex items-end gap-3 max-w-2xl">
        <div class="flex-1">
          <label class="block text-[10px] font-bold text-slate-500 mb-1 uppercase">
            Добавить статью
          </label>
          <div class="flex gap-2">
            <div class="relative flex-[2]">
              <input type="text" id="s-new-cat-name"
                    placeholder="Название"
                    class="settings-input w-full pr-10"
                    onkeydown="if(event.key==='Enter') submitAddCategorySettings()"/>
              <button type="button"
                      id="emoji-picker-btn"
                      class="absolute right-2 top-1/2 transform -translate-y-1/2"
                      title="Добавить эмодзи"
                      onclick="toggleEmojiPicker(event)">
                😊
              </button>
            </div>
            
            <select id="s-new-cat-type" class="settings-select flex-1">
              <option value="expense">Расход</option>
              <option value="income">Доход</option>
            </select>
          </div>
          
          <div id="emoji-picker-panel" 
          class="hidden"
          style="position: fixed; z-index: 9999; width: 380px; max-height: 500px; overflow-y: auto;">
            <div class="grid grid-cols-8 gap-1.5" id="emoji-grid">
            </div>
          </div>
        </div>
        
        <button onclick="submitAddCategorySettings()"
                class="btn-settings-primary">
          Добавить
        </button>
      </div>
    </div>

    <div class="settings-section">
      <h2>Оформление</h2>
      <div class="grid grid-cols-2 md:grid-cols-5 gap-6">
        ${[
          ['weekColor',            vc.weekColor            || '#3b82f6', 'Цвет темы / баланс'],
          ['currentWeekColor',     vc.currentWeekColor     || '#fef08a', 'Текущая неделя'],
          ['negativeBalanceColor', vc.negativeBalanceColor || '#f87171', 'Дефицит (< 0)'],
          ['totalIncomeColor',     vc.totalIncomeColor     || '#16a34a', 'Итого доходы'],
          ['totalExpenseColor',    vc.totalExpenseColor    || '#ef4444', 'Итого расходы'],
        ].map(([key, val, label]) => `
          <div>
            <label class="block text-[10px] font-bold text-slate-500 mb-1 uppercase">
              ${label}
            </label>
            <input type="color"
                   class="w-full h-10 border border-slate-200 rounded outline-none
                          cursor-pointer"
                   value="${val}"
                   data-vc-key="${key}"
                   onchange="updateVisualColor('${key}', this.value)"/>
          </div>`).join('')}
      </div>
    </div>

    <div class="settings-section flex items-center justify-between">
      <div>
        <h2 style="margin-bottom:4px;">Анимации интерфейса</h2>
        <p class="text-xs text-slate-500">
          Включите или отключите все анимации и переходы приложения
        </p>
      </div>
      <label class="flex items-center gap-3 cursor-pointer select-none">
        <span class="text-sm font-medium text-slate-700" id="animations-label">
          ${_animationsEnabled ? 'Включены' : 'Отключены'}
        </span>
        <div class="relative">
          <input type="checkbox" id="animations-toggle" class="sr-only"
                ${_animationsEnabled ? 'checked' : ''}
                onchange="_onAnimationsToggle(this.checked)"/>
          <div class="toggle-track w-11 h-6 rounded-full transition-colors duration-200"
              style="background: ${_animationsEnabled ? '#2563eb' : '#cbd5e1'};"
              id="animations-track">
          </div>
          <div class="toggle-thumb absolute top-0.5 left-0.5 w-5 h-5 bg-white 
                      rounded-full shadow transition-transform duration-200"
              id="animations-thumb"
              style="transform: translateX(${_animationsEnabled ? '20px' : '0px'})">
          </div>
        </div>
      </label>
    </div>

    <div class="settings-section flex items-center justify-between">
      <div>
        <h2 style="margin-bottom:4px;">Управление данных</h2>
        <p class="text-xs text-slate-500">
          Экспорт и импорт всех настроек, статей и транзакций в формате JSON
        </p>
      </div>
      <div class="flex gap-3">
        <button onclick="handleExport()"
                class="btn-settings-secondary">
          Экспорт JSON
        </button>
        <button onclick="handleImport()"
                class="btn-settings-blue">
          Импорт JSON
        </button>
      </div>
    </div>

    <div class="settings-section">
      <h2>📖 Как пользоваться CashFlow</h2>
      <div class="space-y-4 text-sm text-slate-600">

      <details class="group border border-slate-100 rounded-lg overflow-hidden">
        <summary class="flex items-center justify-between p-4 cursor-pointer 
                        font-semibold text-slate-700 hover:bg-slate-50 select-none
                        list-none">
          <div class="flex items-center gap-3">
            <span class="text-lg">📋</span>
            Работа с таблицей
          </div>
          <svg class="w-4 h-4 text-slate-400 transition-transform duration-200 
                      group-open:rotate-180" fill="none" viewBox="0 0 24 24" 
              stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
          </svg>
        </summary>
        <div class="px-4 pb-4 space-y-2 text-slate-600 border-t border-slate-100 pt-3">
          <p>• <strong>Левый клик</strong> по ячейке - открыть редактор (план или факт)</p>
          <p>• <strong>Правый клик</strong> по ячейке - добавить/редактировать комментарий</p>
          <p>• <strong>Вкладка «План»</strong> - плановая сумма на неделю</p>
          <p>• <strong>Вкладка «Факт»</strong> - список реальных транзакций с датами</p>
          <p>• Ячейки с серым фоном - есть плановые данные, белые (или темные) - пустые</p>
          <p>• Иконка 💬 в ячейке означает наличие комментария</p>
          <p>• Маркер <code style="background:#f1f5f9;padding:1px 4px;border-radius:3px">x3</code> - несколько транзакций в этой ячейке</p>
          <p>• Значок <strong>⚠️</strong> в углу означает, что План задан, а Факт забыли внести (для прошлых недель)</p>
          <p>• 🔒 <strong>Прошлые недели заблокированы</strong> от случайного редактирования. Для внесения изменений нажмите «Редактировать»</p>
        </div>
      </details>

        <details class="group border border-slate-100 rounded-lg overflow-hidden">
          <summary class="flex items-center justify-between p-4 cursor-pointer 
                          font-semibold text-slate-700 hover:bg-slate-50 select-none
                          list-none">
            <div class="flex items-center gap-3">
              <span class="text-lg">⚡</span>
              Горячие клавиши
            </div>
            <svg class="w-4 h-4 text-slate-400 transition-transform duration-200 
                        group-open:rotate-180" fill="none" viewBox="0 0 24 24" 
                stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
            </svg>
          </summary>
          <div class="px-4 pb-4 border-t border-slate-100 pt-3">
            <div class="grid grid-cols-2 gap-x-8 gap-y-2">
              ${[
                ['Ctrl + Z', 'Отменить последнее действие'],
                ['Enter', 'Подтвердить ввод в редакторе'],
                ['Escape', 'Закрыть редактор/меню'],
              ].map(([key, desc]) => `
                <div class="flex items-center gap-2">
                  <kbd style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:4px;
                              padding:2px 8px;font-size:11px;font-family:monospace;
                              font-weight:600;color:#475569;">${key}</kbd>
                </div>
                <div class="text-slate-600 text-xs flex items-center">${desc}</div>
              `).join('')}
            </div>
          </div>
        </details>

        <details class="group border border-slate-100 rounded-lg overflow-hidden">
          <summary class="flex items-center justify-between p-4 cursor-pointer 
                          font-semibold text-slate-700 hover:bg-slate-50 select-none
                          list-none">
            <div class="flex items-center gap-3">
              <span class="text-lg">🔄</span>
              Автозаполнение плана
            </div>
            <svg class="w-4 h-4 text-slate-400 transition-transform duration-200 
                        group-open:rotate-180" fill="none" viewBox="0 0 24 24" 
                stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
            </svg>
          </summary>
          <div class="px-4 pb-4 space-y-2 text-slate-600 border-t border-slate-100 pt-3">
            <p>• Наведите на строку категории - появится кнопка <strong>↻</strong></p>
            <p>• Режим <strong>«На недели»</strong> - заполняет выбранное количество недель подряд одной суммой</p>
            <p>• Режим <strong>«На месяцы»</strong> - заполняет конкретный день каждого месяца</p>
            <p>• <strong>Ctrl+Z</strong> отменяет автозаполнение</p>
          </div>
        </details>

        <details class="group border border-slate-100 rounded-lg overflow-hidden">
          <summary class="flex items-center justify-between p-4 cursor-pointer 
                          font-semibold text-slate-700 hover:bg-slate-50 select-none
                          list-none">
            <div class="flex items-center gap-3">
              <span class="text-lg">💸</span>
              Кассовый разрыв (дефицит)
            </div>
            <svg class="w-4 h-4 text-slate-400 transition-transform duration-200 
                        group-open:rotate-180" fill="none" viewBox="0 0 24 24" 
                stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
            </svg>
          </summary>
          <div class="px-4 pb-4 space-y-2 text-slate-600 border-t border-slate-100 pt-3">
            <p>• Отрицательный баланс - появляется иконка 🪄 в строке баланса</p>
            <p>• <strong>Копилка</strong> - дефицит автоматически покрывается из накоплений (парные операции)</p>
            <p>• <strong>Займ</strong> - создаётся доход «Займ» и расход «Возврат займа» с выбранной датой</p>
            <p>• Возврат можно разбить на несколько платежей по неделям или месяцам</p>
            <p>• <strong>Ctrl+Z</strong> удаляет займ вместе со всеми запланированными возвратами</p>
          </div>
        </details>

        <details class="group border border-slate-100 rounded-lg overflow-hidden">
          <summary class="flex items-center justify-between p-4 cursor-pointer 
                          font-semibold text-slate-700 hover:bg-slate-50 select-none
                          list-none">
            <div class="flex items-center gap-3">
              <span class="text-lg">⚖️</span>
              Сверка баланса
            </div>
            <svg class="w-4 h-4 text-slate-400 transition-transform duration-200 
                        group-open:rotate-180" fill="none" viewBox="0 0 24 24" 
                stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
            </svg>
          </summary>
          <div class="px-4 pb-4 space-y-2 text-slate-600 border-t border-slate-100 pt-3">
            <p>• Откройте «Сверка баланса» в боковом меню</p>
            <p>• Введите реальный остаток на счёте</p>
            <p>• Приложение автоматически добавит корректирующую запись</p>
            <p>• <strong>Профицит</strong> → «Незапланированные доходы»</p>
            <p>• <strong>Недостача</strong> → «Незапланированные расходы»</p>
          </div>
        </details>

        <details class="group border border-slate-100 rounded-lg overflow-hidden">
          <summary class="flex items-center justify-between p-4 cursor-pointer 
                          font-semibold text-slate-700 hover:bg-slate-50 select-none
                          list-none">
            <div class="flex items-center gap-3">
              <span class="text-lg">💾</span>
              Экспорт и импорт
            </div>
            <svg class="w-4 h-4 text-slate-400 transition-transform duration-200 
                        group-open:rotate-180" fill="none" viewBox="0 0 24 24" 
                stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
            </svg>
          </summary>
          <div class="px-4 pb-4 space-y-2 text-slate-600 border-t border-slate-100 pt-3">
            <p>• <strong>Экспорт JSON</strong> - сохраняет все данные (категории, планы, факты, настройки)</p>
            <p>• <strong>Импорт JSON</strong> - полностью заменяет данные из файла</p>
            <p>• Дата начала периода при импорте <strong>не меняется</strong></p>
            <p>• Рекомендуется делать резервную копию перед импортом</p>
          </div>
        </details>

      </div>
    </div>`;

  renderSettingsCategoryList(
    categories.filter(c => c.type === 'income'),
    document.getElementById('s-income-cats')
  );
  renderSettingsCategoryList(
    categories.filter(c => c.type === 'expense'),
    document.getElementById('s-expense-cats')
  );
}

function renderSettingsCategoryList(cats, container) {
  /**
   * Отрисовывает список категорий с возможностью редактирования цвета и названия.
   */
  container.innerHTML = '';

  cats.forEach(cat => {
    const item = document.createElement('div');
    item.className = 'settings-cat-item';
    item.dataset.catId = cat.id;

    item.innerHTML = `
      <div class="settings-cat-name-wrap" id="cat-display-${cat.id}">
        <label class="cursor-pointer flex items-center justify-center
                      relative w-5 h-5 flex-shrink-0"
               title="Изменить цвет">
          <div class="w-3 h-3 rounded-full"
               style="background:${cat.color_code || '#94a3b8'}"></div>
          <input type="color"
                 value="${cat.color_code || '#94a3b8'}"
                 class="absolute w-0 h-0 opacity-0"
                 onchange="updateCategoryColor(${cat.id}, this.value, this)"/>
        </label>
        <span class="font-semibold text-slate-800 text-sm truncate">
          ${cat.name}
        </span>
      </div>

      <div class="settings-cat-name-wrap hidden" id="cat-edit-${cat.id}">
        <div class="relative flex items-center flex-1">
          <input type="text"
                 class="settings-cat-edit-input w-full pr-8"
                 id="cat-edit-input-${cat.id}"
                 value="${cat.name}"
                 onkeydown="if(event.key==='Enter') saveCategoryName(${cat.id});
                            if(event.key==='Escape') cancelCategoryEdit(${cat.id});"/>
          <button type="button"
                  class="absolute right-2 top-1/2 -translate-y-1/2 text-base leading-none"
                  title="Добавить эмодзи"
                  onclick="toggleEmojiPickerForEdit(event, ${cat.id})">
            😊
          </button>
        </div>
        <button onclick="saveCategoryName(${cat.id})"
                class="px-2 py-1 bg-blue-600 text-white text-[10px]
                       font-bold rounded whitespace-nowrap">OK</button>
      </div>
      
      <div id="emoji-picker-edit-panel-${cat.id}"
           class="hidden"
           style="
             position: fixed;
             z-index: 9999;
             background: white;
             border: 1px solid #e2e8f0;
             border-radius: 12px;
             padding: 12px;
             box-shadow: 0 8px 32px rgba(0,0,0,0.15);
             width: 380px;
             max-height: 400px;
             overflow-y: auto;
           ">
        <div class="emoji-edit-grid-${cat.id}"></div>
      </div>

      <div class="flex items-center gap-1 shrink-0">
        ${!PROTECTED_CATS.includes(cat.name) ? `
          <button class="settings-icon-btn"
                  onclick="startCategoryEdit(${cat.id})"
                  title="Переименовать">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
            </svg>
          </button>
          <button class="settings-icon-btn danger"
                  onclick="deleteCategorySettings(${cat.id}, '${cat.name.replace(/'/g, "\\'")}')"
                  title="Удалить">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
          </button>
        ` : ''}
      </div>`;

    container.appendChild(item);
  });
}

async function saveMainSettings() {
  /**
   * Сохраняет основные параметры планирования и перезагружает приложение.
   */
  const startDate = document.getElementById('s-start-date')?.value;
  const strategy  = document.getElementById('s-strategy')?.value;

  if (!startDate) { showToast('Укажите дату начала', 'error'); return; }

  try {
    const result = await pywebview.api.save_settings({
      planning_start_date: startDate,
      financial_strategy:  strategy,
    });
    if (result.success) {
      showToast('Настройки сохранены', 'success');
      switchView('dashboard');
      location.reload();
    } else {
      showToast('Ошибка: ' + result.error, 'error');
    }
  } catch (e) {
    showToast('Ошибка соединения', 'error');
  }
}