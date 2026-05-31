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
        <div class="flex items-center justify-between">
          <button onclick="saveMainSettings()"
                  class="btn-settings-primary">
            Сохранить
          </button>
          
          <div class="text-right">
            <p class="text-xs text-slate-400 mb-1.5">
              Использовали все 52 недели?
            </p>
            <button onclick="startNewPeriod()"
                    style="padding:7px 14px; background:transparent;
                           color:#ef4444; border:1.5px solid #ef4444;
                           border-radius:6px; font-size:11px; font-weight:700;
                           text-transform:uppercase; letter-spacing:0.05em;
                           cursor:pointer; transition:all 0.15s;"
                    onmouseover="this.style.background='#fef2f2'"
                    onmouseout="this.style.background='transparent'">
              Новый период
            </button>
          </div>
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

        <details class="group border border-slate-100 rounded-lg overflow-hidden">
          <summary class="flex items-center justify-between p-4 cursor-pointer 
                          font-semibold text-slate-700 hover:bg-slate-50 select-none
                          list-none">
            <div class="flex items-center gap-3">
              <span class="text-lg">🔄</span>
              Начало нового периода
            </div>
            <svg class="w-4 h-4 text-slate-400 transition-transform duration-200 
                        group-open:rotate-180" fill="none" viewBox="0 0 24 24" 
                stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
            </svg>
          </summary>
          <div class="px-4 pb-4 space-y-2 text-slate-600 border-t border-slate-100 pt-3">
            <p>• <strong>Кнопка «Новый период»</strong> в разделе параметров планирования - для сброса периода</p>
            <p>• Используется когда вы <strong>исчерпали все 52 недели</strong> текущего периода</p>
            <p>• При нажатии удаляются <strong>все планы и факты</strong>, но <strong>категории и счёт сохраняются</strong></p>
            <p>• <strong>Шаг 1:</strong> подтверждение удаления данных</p>
            <p>• <strong>Шаг 2:</strong> предложение сохранить резервную копию (экспорт, пропуск или отмена)</p>
            <p>• <strong>Шаг 3:</strong> выбор даты начала нового периода (предлагается следующий понедельник)</p>
            <p>• <strong>Шаг 4:</strong> финальное подтверждение - требует ввода текста «<strong>НОВЫЙ ПЕРИОД</strong>» для защиты от случайного клика</p>
            <p>• После сброса таблица <strong>мгновенно обновляется</strong> - перезагрузка страницы не требуется</p>
            <p>• История действий (Ctrl+Z) очищается при начале нового периода</p>
            <p>• Рекомендуется экспортировать архив перед началом нового периода</p>
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
   * Сохраняет основные параметры планирования (дату начала и стратегию)
   * и перезагружает приложение для применения изменений.
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

async function startNewPeriod() {
  /**
   * Запускает процесс создания нового периода планирования.
   * Включает подтверждение, экспорт архива, выбор даты и финальную подготовку.
   */
  const ok = await showConfirm(
    'Начать новый период?',
    'Все планы и факты будут удалены. Категории и счёт сохранятся.'
  );
  if (!ok) return;

  const exportChoice = await showExportConfirm();
  if (exportChoice === 'cancel') return;
  if (exportChoice === 'export') {
    await handleExport();
  }

  const newStartDate = await showNewPeriodDatePicker();
  if (!newStartDate) return;

  const formattedDate = formatDateForDisplay(newStartDate);

  const confirmed = await showTextConfirm(
    'Введите "НОВЫЙ ПЕРИОД" для подтверждения',
    `Все транзакции будут удалены.<br>Новый период начнётся <strong>${formattedDate}</strong>`
  );
  if (!confirmed) return;

  try {
    showToast('⏳ Сбрасываем период...', 'info');

    const result = await pywebview.api.reset_period({
      new_start_date: newStartDate,
    });

    if (!result.success) {
      showToast('Ошибка: ' + result.error, 'error');
      return;
    }

    showToast('Новый период создан', 'success');
    UndoHistory.clear();

    App.data = null;
    localStorage.removeItem('cached_weeks');
    sessionStorage.clear();

    switchView('dashboard');
    
    setTimeout(async () => {
      try {
        const newSettings = await pywebview.api.get_settings();
        
        if (!newSettings || !newSettings.planning_start_date) {
          throw new Error('Не удалось загрузить новые настройки');
        }

        const newWeeks = generateWeeks(newSettings.planning_start_date, 52);

        const [cashflowData, categories, account] = await Promise.all([
          pywebview.api.get_cashflow_data(),
          pywebview.api.get_categories(),
          pywebview.api.get_account(),
        ]);

        App.data = {
          settings: newSettings,
          weeks: newWeeks,
          plans: cashflowData.plans || {},
          facts: cashflowData.facts || {},
          categories: categories,
          account: account,
          initial_balance: account?.initial_balance || 0,
        };

        CellComments = {};

        renderTable(App.data);
        
        const today = getTodayISO();
        setTimeout(() => scrollToWeek(today), 100);

      } catch (e) {
        showToast('Ошибка загрузки новых данных: ' + e.message, 'error');
        console.error('Ошибка:', e);
      }
    }, 500);

  } catch (e) {
    showToast('Ошибка соединения', 'error');
  }
}

function showNewPeriodDatePicker() {
  /**
   * Диалог выбора даты начала нового периода.
   * Предлагает следующий понедельник по умолчанию и подсказывает рекомендации.
   */
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed; inset: 0; background: rgba(0,0,0,0.45);
      display: flex; align-items: center; justify-content: center;
      z-index: 10002; backdrop-filter: blur(3px);
    `;
    overlay.classList.add('np-overlay-enter');

    const isDark = document.body.classList.contains('dark');
    const box = document.createElement('div');
    box.classList.add('np-box-enter');
    box.style.cssText = `
      background: ${isDark ? '#1e293b' : 'white'};
      border-radius: 14px; padding: 28px 24px; width: 440px;
      box-shadow: 0 24px 64px rgba(0,0,0,0.25);
      border: 1px solid ${isDark ? '#334155' : '#f1f5f9'};
    `;

    const today = getTodayISO();
    const nextMonday = getNextMonday(today);

    box.innerHTML = `
      <div class="np-icon"
           style="font-size:32px; text-align:center;
                  margin-bottom:14px;">
        📅
      </div>
      <div class="np-title"
           style="font-size:16px; font-weight:700; text-align:center;
                  color:${isDark ? '#f1f5f9' : '#0f172a'};
                  margin-bottom:6px;">
        Дата начала нового периода
      </div>
      <div class="np-subtitle"
           style="font-size:13px; color:#64748b; text-align:center;
                  margin-bottom:22px;">
        С какого дня вы хотите начать новый период планирования?
      </div>
      <div class="np-input">
        <input id="new-period-date" type="date"
               value="${nextMonday}"
               style="width:100%; padding:11px 14px;
                      border:2px solid ${isDark ? '#475569' : '#e2e8f0'};
                      border-radius:9px; font-size:14px; outline:none;
                      background:${isDark ? '#0f172a' : '#f8fafc'};
                      color:${isDark ? '#f1f5f9' : '#0f172a'};
                      font-family:inherit; box-sizing:border-box;
                      transition: border-color 0.2s, box-shadow 0.2s;
                      text-align:center;
                      accent-color: ${isDark ? '#3b82f6' : '#2563eb'};"/>
      </div>
      <div style="margin-top:16px; padding:12px; background:${isDark ? '#0f172a' : '#f8fafc'};
                  border:1px solid ${isDark ? '#334155' : '#e2e8f0'};
                  border-radius:8px;">
        <div style="font-size:11px; font-weight:600;
                    text-transform:uppercase; letter-spacing:0.05em;
                    color:${isDark ? '#94a3b8' : '#64748b'};
                    margin-bottom:4px;">
          Информация
        </div>
        <div style="font-size:12px;
                    color:${isDark ? '#cbd5e1' : '#475569'};
                    line-height:1.5;">
          Рекомендуется начинать период с <strong>понедельника</strong>
          или первого числа месяца.
        </div>
      </div>
      <div class="np-actions"
           style="display:flex; gap:10px; margin-top:20px;
                  justify-content:flex-end;">
        <button id="date-picker-cancel" style="
          padding:9px 18px; border-radius:8px; cursor:pointer;
          background:${isDark ? '#334155' : '#f1f5f9'};
          color:${isDark ? '#cbd5e1' : '#475569'};
          border:1px solid ${isDark ? '#475569' : '#e2e8f0'};
          font-size:13px; font-family:inherit;
          transition: all 0.15s;">
          Отмена
        </button>
        <button id="date-picker-ok" style="
          padding:9px 18px; border-radius:8px; cursor:pointer;
          background:#2563eb; color:white; border:none;
          font-size:13px; font-weight:600; font-family:inherit;
          transition: all 0.15s;
          box-shadow: 0 2px 8px rgba(37,99,235,0.25);">
          Продолжить →
        </button>
      </div>
    `;

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    const dateInput = document.getElementById('new-period-date');
    const okBtn = document.getElementById('date-picker-ok');
    const cancelBtn = document.getElementById('date-picker-cancel');

    _npAddHover('date-picker-ok', {
      bg: '#1d4ed8',
      transform: 'translateY(-1px)',
      shadow: '0 4px 12px rgba(37,99,235,0.35)',
    });
    _npAddHover('date-picker-cancel', {
      bg: isDark ? '#3d4f66' : '#f1f5f9',
    });

    dateInput.addEventListener('focus', () => {
      dateInput.style.borderColor = '#3b82f6';
      dateInput.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.15)';
    });
    dateInput.addEventListener('blur', () => {
      dateInput.style.borderColor = isDark ? '#475569' : '#e2e8f0';
      dateInput.style.boxShadow = 'none';
    });

    const cleanup = () => overlay.remove();

    okBtn.addEventListener('click', () => {
      const selectedDate = dateInput.value;
      if (!selectedDate) {
        showToast('Выберите дату', 'error');
        return;
      }
      cleanup();
      resolve(selectedDate);
    });

    cancelBtn.addEventListener('click', () => {
      cleanup();
      resolve(null);
    });

    overlay.addEventListener('click', e => {
      if (e.target === overlay) {
        cleanup();
        resolve(null);
      }
    });

    document.addEventListener('keydown', function handler(e) {
      if (e.key === 'Escape') {
        cleanup();
        resolve(null);
        document.removeEventListener('keydown', handler);
      }
      if (e.key === 'Enter' && dateInput.value) {
        cleanup();
        resolve(dateInput.value);
        document.removeEventListener('keydown', handler);
      }
    });

    setTimeout(() => dateInput.focus(), 120);
  });
}

function showExportConfirm() {
  /**
   * Диалог подтверждения экспорта резервной копии перед сбросом периода.
   * Предлагает три варианта: экспорт, пропуск или отмена всей операции.
   */
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed; inset: 0; background: rgba(0,0,0,0.45);
      display: flex; align-items: center; justify-content: center;
      z-index: 10002; backdrop-filter: blur(3px);
    `;
    overlay.classList.add('np-overlay-enter');

    const isDark = document.body.classList.contains('dark');
    const box = document.createElement('div');
    box.classList.add('np-box-enter');
    box.style.cssText = `
      background: ${isDark ? '#1e293b' : 'white'};
      border-radius: 14px; padding: 28px 24px; width: 420px;
      box-shadow: 0 24px 64px rgba(0,0,0,0.25);
      border: 1px solid ${isDark ? '#334155' : '#f1f5f9'};
    `;

    box.innerHTML = `
      <div class="np-icon"
           style="font-size:32px; text-align:center; margin-bottom:14px;
                  display:block;">
        💾
      </div>
      <div class="np-title"
           style="font-size:16px; font-weight:700; text-align:center;
                  color:${isDark ? '#f1f5f9' : '#0f172a'};
                  margin-bottom:8px;">
        Сохранить резервную копию?
      </div>
      <div class="np-subtitle"
           style="font-size:13px; color:#64748b; text-align:center;
                  margin-bottom:24px; line-height:1.6;">
        Рекомендуется сохранить архив текущих данных<br>
        перед сбросом периода.
      </div>
      <div style="display:flex; flex-direction:column; gap:8px;">
        <button id="export-choice-save" class="np-btn-1" style="
          padding:12px 16px; border-radius:9px; cursor:pointer;
          background:#2563eb; color:white; border:none;
          font-size:13px; font-weight:600; font-family:inherit;
          transition: background 0.15s, transform 0.1s, box-shadow 0.15s;
          box-shadow: 0 2px 8px rgba(37,99,235,0.25);">
          💾 Сохранить архив и продолжить
        </button>
        <button id="export-choice-skip" class="np-btn-2" style="
          padding:12px 16px; border-radius:9px; cursor:pointer;
          background:${isDark ? '#334155' : '#f8fafc'};
          color:${isDark ? '#cbd5e1' : '#475569'};
          border:1px solid ${isDark ? '#475569' : '#e2e8f0'};
          font-size:13px; font-weight:500; font-family:inherit;
          transition: background 0.15s, border-color 0.15s, transform 0.1s;">
          Пропустить и продолжить без архива
        </button>
        <button id="export-choice-cancel" class="np-btn-3" style="
          padding:10px 16px; border-radius:9px; cursor:pointer;
          background:transparent; color:#94a3b8; border:none;
          font-size:12px; font-family:inherit;
          transition: color 0.15s, transform 0.1s;">
          Отмена
        </button>
      </div>
    `;

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    _npAddHover('export-choice-save',  { bg: '#1d4ed8', transform: 'translateY(-1px)', shadow: '0 4px 12px rgba(37,99,235,0.35)' });
    _npAddHover('export-choice-skip',  { bg: isDark ? '#3d4f66' : '#f1f5f9' });
    _npAddHover('export-choice-cancel',{ color: '#64748b' });

    const cleanup = () => overlay.remove();

    document.getElementById('export-choice-save').addEventListener('click', () => {
      cleanup(); resolve('export');
    });
    document.getElementById('export-choice-skip').addEventListener('click', () => {
      cleanup(); resolve('skip');
    });
    document.getElementById('export-choice-cancel').addEventListener('click', () => {
      cleanup(); resolve('cancel');
    });

    overlay.addEventListener('click', e => {
      if (e.target === overlay) { cleanup(); resolve('cancel'); }
    });

    document.addEventListener('keydown', function handler(e) {
      if (e.key === 'Escape') {
        cleanup(); resolve('cancel');
        document.removeEventListener('keydown', handler);
      }
    });
  });
}

function showTextConfirm(title, subtitle) {
  /**
   * Диалог финального подтверждения с требованием ввода текста "НОВЫЙ ПЕРИОД".
   * Активирует кнопку подтверждения только при совпадении текста.
   */
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed; inset: 0; background: rgba(0,0,0,0.45);
      display: flex; align-items: center; justify-content: center;
      z-index: 10002; backdrop-filter: blur(3px);
    `;
    overlay.classList.add('np-overlay-enter');

    const isDark = document.body.classList.contains('dark');
    const box = document.createElement('div');
    box.classList.add('np-box-enter');
    box.style.cssText = `
      background: ${isDark ? '#1e293b' : 'white'};
      border-radius: 14px; padding: 28px 24px; width: 420px;
      box-shadow: 0 24px 64px rgba(0,0,0,0.25);
      border: 1px solid ${isDark ? '#334155' : '#f1f5f9'};
    `;

    box.innerHTML = `
      <div class="np-icon"
           style="font-size:28px; text-align:center;
                  margin-bottom:12px; display:block;">
        ⚠️
      </div>
      <div class="np-title"
           style="font-size:15px; font-weight:700;
                  color:${isDark ? '#f1f5f9' : '#0f172a'};
                  margin-bottom:6px; text-align:center;">
        ${title}
      </div>
      <div class="np-subtitle"
           style="font-size:13px; color:#64748b;
                  margin-bottom:20px; line-height:1.5;
                  text-align:center;">
        ${subtitle}
      </div>
      <div class="np-input">
        <input id="text-confirm-input" type="text"
          placeholder="НОВЫЙ ПЕРИОД"
          style="width:100%; padding:11px 14px;
                 border:2px solid ${isDark ? '#475569' : '#e2e8f0'};
                 border-radius:9px; font-size:14px; outline:none;
                 background:${isDark ? '#0f172a' : '#f8fafc'};
                 color:${isDark ? '#f1f5f9' : '#0f172a'};
                 font-family:inherit; box-sizing:border-box;
                 transition: border-color 0.2s, box-shadow 0.2s;
                 text-align:center; letter-spacing:0.05em;"/>
      </div>
      <div class="np-actions"
           style="display:flex; gap:10px; margin-top:16px;
                  justify-content:flex-end;">
        <button id="text-confirm-cancel" style="
          padding:9px 18px; border-radius:8px; cursor:pointer;
          background:${isDark ? '#334155' : '#f1f5f9'};
          color:${isDark ? '#cbd5e1' : '#475569'};
          border:1px solid ${isDark ? '#475569' : '#e2e8f0'};
          font-size:13px; font-family:inherit;
          transition: background 0.15s, transform 0.1s;">
          Отмена
        </button>
        <button id="text-confirm-ok" style="
          padding:9px 18px; border-radius:8px; cursor:pointer;
          background:#ef4444; color:white; border:none;
          font-size:13px; font-weight:600; font-family:inherit;
          opacity:0.4; cursor:not-allowed;
          transition: opacity 0.2s, transform 0.1s, box-shadow 0.2s;">
          Подтвердить
        </button>
      </div>
    `;

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    const input  = document.getElementById('text-confirm-input');
    const okBtn  = document.getElementById('text-confirm-ok');
    const cancelBtn = document.getElementById('text-confirm-cancel');

    input.addEventListener('focus', () => {
      input.style.borderColor = '#3b82f6';
      input.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.15)';
    });
    input.addEventListener('blur', () => {
      input.style.borderColor = isDark ? '#475569' : '#e2e8f0';
      input.style.boxShadow = 'none';
    });

    input.addEventListener('input', () => {
      const valid = input.value.trim() === 'НОВЫЙ ПЕРИОД';
      okBtn.style.opacity  = valid ? '1'           : '0.4';
      okBtn.style.cursor   = valid ? 'pointer'     : 'not-allowed';

      if (valid) {
        okBtn.classList.remove('np-confirm-ready');
        void okBtn.offsetWidth;
        okBtn.classList.add('np-confirm-ready');
      }
    });

    const cleanup = () => overlay.remove();

    okBtn.addEventListener('click', () => {
      if (input.value.trim() !== 'НОВЫЙ ПЕРИОД') {
        input.classList.remove('np-input-shake');
        void input.offsetWidth;
        input.classList.add('np-input-shake');
        setTimeout(() => input.classList.remove('np-input-shake'), 350);
        return;
      }
      cleanup();
      resolve(true);
    });

    cancelBtn.addEventListener('click', () => { cleanup(); resolve(false); });

    overlay.addEventListener('click', e => {
      if (e.target === overlay) { cleanup(); resolve(false); }
    });

    document.addEventListener('keydown', function handler(e) {
      if (e.key === 'Escape') {
        cleanup(); resolve(false);
        document.removeEventListener('keydown', handler);
      }
      if (e.key === 'Enter' && input.value.trim() === 'НОВЫЙ ПЕРИОД') {
        cleanup(); resolve(true);
        document.removeEventListener('keydown', handler);
      }
    });

    setTimeout(() => input.focus(), 120);
  });
}

function getNextMonday(dateStr) {
  /**
   * Вспомогательная функция: найти следующий понедельник.
   * Если сегодня понедельник - вернуть понедельник следующей недели.
   */
  const date = new Date(dateStr + 'T00:00:00');
  const day = date.getDay();
  
  let daysUntilMonday = (1 - day + 7) % 7;
  
  if (daysUntilMonday === 0) daysUntilMonday = 7;
  
  const nextMonday = new Date(date);
  nextMonday.setDate(nextMonday.getDate() + daysUntilMonday);
  
  const yyyy = nextMonday.getFullYear();
  const mm = String(nextMonday.getMonth() + 1).padStart(2, '0');
  const dd = String(nextMonday.getDate()).padStart(2, '0');
  
  return `${yyyy}-${mm}-${dd}`;
}

function formatDateForDisplay(dateStr) {
  /**
   * Форматирует дату для красивого отображения пользователю.
   * Пример: 2026-06-01 → 1 июня 2026 г.
   */
  if (!dateStr) return '';
  
  const date = new Date(dateStr + 'T00:00:00');
  
  const months = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
  ];
  
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  
  return `${day} ${month} ${year} г.`;
}

function _npAddHover(id, over) {
  /**
   * Вспомогательная функция: добавляет интерактивные hover-эффекты на кнопку.
   * Поддерживает изменения фона, цвета, трансформации и тени.
   */
  const el = document.getElementById(id);
  if (!el) return;

  const orig = {
    bg:        el.style.background,
    color:     el.style.color,
    transform: el.style.transform || '',
    shadow:    el.style.boxShadow || '',
  };

  el.addEventListener('mouseenter', () => {
    if (over.bg)        el.style.background  = over.bg;
    if (over.color)     el.style.color       = over.color;
    if (over.transform) el.style.transform   = over.transform;
    if (over.shadow)    el.style.boxShadow   = over.shadow;
  });

  el.addEventListener('mouseleave', () => {
    el.style.background  = orig.bg;
    el.style.color       = orig.color;
    el.style.transform   = orig.transform;
    el.style.boxShadow   = orig.shadow;
  });

  el.addEventListener('mousedown', () => {
    el.style.transform = 'translateY(0) scale(0.98)';
  });

  el.addEventListener('mouseup', () => {
    el.style.transform = over.transform || orig.transform;
  });
}