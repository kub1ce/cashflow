async function initPyWebview() {
  /**
   * Инициализирует pywebview API.
   */
  return new Promise(resolve => {
    if (window.pywebview && window.pywebview.api) {
      resolve();
    } else {
      window.addEventListener('pywebviewready', resolve, { once: true });
    }
  });
}

const DEFAULT_CATEGORIES = {
  income: [
    { name: 'Зарплата',         color_code: '#22c55e' },
    { name: 'Фриланс',          color_code: '#3b82f6' },
    { name: 'Инвестиции',       color_code: '#8b5cf6' },
    { name: 'Подработка',       color_code: '#06b6d4' },
  ],
  expense: [
    { name: 'Продукты',         color_code: '#f97316' },
    { name: 'Транспорт',        color_code: '#8b5cf6' },
    { name: 'Коммунальные',     color_code: '#ec4899' },
    { name: 'Развлечения',      color_code: '#f59e0b' },
    { name: 'Здоровье',         color_code: '#ef4444' },
    { name: 'Одежда',           color_code: '#14b8a6' },
    { name: 'Кафе и рестораны', color_code: '#f43f5e' },
    { name: 'Связь и интернет', color_code: '#64748b' },
  ],
};

const state = {
  currentStep: 1,
  totalSteps: 4,

  account: {
    name: '',
    initial_balance: 0,
  },

  settings: {
    planning_start_date: '',
    financial_strategy: 'manual',
  },

  selectedCategories: {
    income: new Set([0, 1]),
    expense: new Set([0, 1, 2]),
  },
};

const STEP_TITLES = {
  1: 'Основной счёт',
  2: 'Период планирования',
  3: 'Стратегия кассовых разрывов',
  4: 'Категории по умолчанию',
};

function showError(msg) {
  /**
   * Показывает сообщение об ошибке в баннере.
   */
  const el = document.getElementById('error-banner');
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 4000);
}

function hideError() {
  /**
   * Скрывает баннер с ошибкой.
   */
  document.getElementById('error-banner').classList.add('hidden');
}

function getMondayISO(dateStr) {
  /**
   * Возвращает ISO дату понедельника для указанной даты.
   */
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();

  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const date = String(d.getDate()).padStart(2, '0');

  return `${year}-${month}-${date}`;
}

async function handleToggleMaximize() {
  /**
   * Переключает состояние максимизации окна.
   */
  try {
    const result = await pywebview.api.toggle_maximize();
    
    const btn = document.getElementById('btn-maximize');
    if (!btn) return;

    const isMax = result?.maximized;

    btn.innerHTML = isMax
      ? `<svg viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1">
           <rect x="2" y="0" width="8" height="8"/>
           <path d="M0 2v8h8" fill="none"/>
         </svg>`
      : `<svg viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1">
           <rect x="0.5" y="0.5" width="9" height="9"/>
         </svg>`;

  } catch (e) {
    console.error('Ошибка toggle_maximize:', e);
  }
}

function updateUI(step) {
  /**
   * Обновляет интерфейс при смене шага.
   */
  document.querySelectorAll('.wizard-step').forEach(el => {
    el.classList.add('hidden');
  });
  document.getElementById(`step-${step}`).classList.remove('hidden');

  document.getElementById('step-header-title').textContent =
    STEP_TITLES[step] || '';

  document.getElementById('btn-back')
    .classList.toggle('hidden', step === 1);

  const btnNext = document.getElementById('btn-next');
  if (step === state.totalSteps) {
    btnNext.textContent = '✓ Готово';
    btnNext.style.background = '#059669';
  } else {
    btnNext.textContent = 'Далее →';
    btnNext.style.background = '';
  }

  for (let i = 1; i <= state.totalSteps; i++) {
    const el = document.getElementById(`sidebar-step-${i}`);
    el.classList.remove('active', 'done');
    if (i < step) el.classList.add('done');
    if (i === step) el.classList.add('active');
  }

  if (step === 4) renderCategories();
}

function selectStrategy(btn) {
  /**
   * Устанавливает выбранную стратегию.
   */
  document.querySelectorAll('.strategy-card').forEach(b => {
    b.classList.remove('active');
  });
  btn.classList.add('active');
  state.settings.financial_strategy = btn.dataset.value;
}

function renderCategories() {
  /**
   * Отображает карточки категорий доходов и расходов.
   */
  ['income', 'expense'].forEach(type => {
    const container = document.getElementById(`${type}-categories`);
    container.innerHTML = '';

    DEFAULT_CATEGORIES[type].forEach((cat, idx) => {
      const selected = state.selectedCategories[type].has(idx);
      const card = document.createElement('div');
      card.className = `cat-card${selected ? ' selected' : ''}`;

      card.innerHTML = `
        <div class="w-2.5 h-2.5 rounded-full flex-shrink-0"
             style="background:${cat.color_code}"></div>
        <span class="text-sm text-slate-700 font-medium">${cat.name}</span>
        <div class="cat-check">
          <svg class="w-2.5 h-2.5 text-white ${selected ? '' : 'hidden'}"
               fill="none" viewBox="0 0 24 24"
               stroke="currentColor" stroke-width="3">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
          </svg>
        </div>`;

      card.addEventListener('click', () => toggleCategory(type, idx, card));
      container.appendChild(card);
    });
  });
}

function toggleCategory(type, idx, card) {
  /**
   * Переключает выбранное состояние категории.
   */
  const set = state.selectedCategories[type];
  if (set.has(idx)) {
    set.delete(idx);
    card.classList.remove('selected');
    card.querySelector('svg').classList.add('hidden');
  } else {
    set.add(idx);
    card.classList.add('selected');
    card.querySelector('svg').classList.remove('hidden');
  }
}

function validateStep(step) {
  /**
   * Валидирует данные текущего шага.
   */
  if (step === 1) {
    const name = document.getElementById('account-name').value.trim();
    if (!name) {
      showError('Введите название счёта');
      return false;
    }
    state.account.name = name;
    state.account.initial_balance =
      parseFloat(document.getElementById('account-balance').value) || 0;
    return true;
  }

  if (step === 2) {
    const start = document.getElementById('period-start').value;
    if (!start) {
      showError('Укажите дату начала периода');
      return false;
    }
    state.settings.planning_start_date = getMondayISO(start);
    return true;
  }

  if (step === 3) {
    return true;
  }

  if (step === 4) {
    const total =
      state.selectedCategories.income.size +
      state.selectedCategories.expense.size;
    if (total === 0) {
      showError('Выберите хотя бы одну категорию');
      return false;
    }
    return true;
  }

  return true;
}

function wizardNext() {
  /**
   * Переходит на следующий шаг или завершает мастер.
   */
  hideError();
  if (!validateStep(state.currentStep)) return;

  if (state.currentStep === state.totalSteps) {
    finish();
    return;
  }

  state.currentStep++;
  updateUI(state.currentStep);
}

function wizardBack() {
  /**
   * Возвращается на предыдущий шаг.
   */
  hideError();
  if (state.currentStep <= 1) return;
  state.currentStep--;
  updateUI(state.currentStep);
}

async function finish() {
  /**
   * Сохраняет данные мастера и переходит в приложение.
   */
  const btn = document.getElementById('btn-next');
  btn.disabled = true;

  const categories = [];
  let order = 0;

  state.selectedCategories.income.forEach(idx => {
    categories.push({
      ...DEFAULT_CATEGORIES.income[idx],
      type: 'income',
      sort_order: order++,
    });
  });

  state.selectedCategories.expense.forEach(idx => {
    categories.push({
      ...DEFAULT_CATEGORIES.expense[idx],
      type: 'expense',
      sort_order: order++,
    });
  });

  const payload = {
    account: state.account,
    settings: state.settings,
    categories: categories,
  };

  try {
    await new Promise(resolve => {
      if (window.pywebview) resolve();
      else window.addEventListener('pywebviewready', resolve, { once: true });
    });

    const result = await pywebview.api.save_wizard_data(payload);

    if (result && result.success) {
      btn.textContent = 'Генерирую таблицу...';
      setTimeout(async () => {
        await pywebview.api.navigate_to('index.html');
      }, 300);
    } else {
      showError('Ошибка: ' + (result?.error || 'неизвестная ошибка'));
      btn.disabled = false;
      btn.textContent = '✓ Готово';
    }
  } catch (e) {
    showError('Ошибка соединения: ' + e.toString());
    btn.disabled = false;
    btn.textContent = '✓ Готово';
  }
}

(function initTitleBarDrag() {
  /**
   * Инициализирует перетаскивание окна за title bar.
   */
  const titleBar = document.getElementById('title-bar');
  if (!titleBar) return;

  let isDragging = false;
  let startMouseX = 0;
  let startMouseY = 0;
  let startWinX = 0;
  let startWinY = 0;

  titleBar.addEventListener('mousedown', async (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('button')) return;

    isDragging = false;

    startMouseX = e.screenX;
    startMouseY = e.screenY;

    try {
      const pos = await pywebview.api.get_window_pos();
      if (!pos.success) return;
      startWinX = pos.x;
      startWinY = pos.y;
      isDragging = true;
    } catch (err) {
      return;
    }

    e.preventDefault();
  });

  document.addEventListener('mousemove', async (e) => {
    if (!isDragging) return;

    const dx = e.screenX - startMouseX;
    const dy = e.screenY - startMouseY;

    const newX = startWinX + dx;
    const newY = startWinY + dy;

    try {
      await pywebview.api.move_window(newX, newY);
    } catch (err) {
      isDragging = false;
    }
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
  });

  titleBar.addEventListener('dblclick', (e) => {
    if (e.target.closest('button')) return;
    pywebview.api.toggle_maximize();
  });
})();

async function initWindowResize() {
  /**
   * Включает возможность ресайзирования окна.
   */
  try {
    await pywebview.api.enable_window_resize();
    console.log('Window resize enabled');
  } catch (e) {
    console.error('Ошибка включения ресайза:', e);
  }
}

function applyTheme(isDark) {
  /**
   * Применяет светлую или тёмную тему.
   */
  document.body.classList.toggle('dark', isDark);
  document.documentElement.classList.toggle('dark', isDark);

  const sun = document.getElementById('theme-icon-sun');
  const moon = document.getElementById('theme-icon-moon');

  if (isDark) {
    if (sun) sun.classList.add('hidden');
    if (moon) moon.classList.remove('hidden');
    const btn = document.getElementById('btn-theme');
    if (btn) btn.title = 'Светлая тема';
  } else {
    if (sun) sun.classList.remove('hidden');
    if (moon) moon.classList.add('hidden');
    const btn = document.getElementById('btn-theme');
    if (btn) btn.title = 'Тёмная тема';
  }
}

async function toggleTheme() {
  /**
   * Переключает тему с плавной анимацией.
   */
  const isDark = !document.body.classList.contains('dark');

  document.body.classList.add('theme-transitioning');
  void document.body.offsetWidth;

  applyTheme(isDark);

  setTimeout(() => {
    document.body.classList.remove('theme-transitioning');
  }, 300);

  localStorage.setItem('cashflow-theme', isDark ? 'dark' : 'light');
}

document.addEventListener('DOMContentLoaded', async function() {
  /**
   * Инициализирует приложение при загрузке страницы.
   */
  await initPyWebview();
  await initWindowResize();

  const href = window.location.href;
  const savedTheme = localStorage.getItem('cashflow-theme');

  if (href.includes('theme=dark')) {
    applyTheme(true);
  } else if (href.includes('theme=light')) {
    applyTheme(false);
  } else if (savedTheme) {
    applyTheme(savedTheme === 'dark');
  } else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(prefersDark);
  }

  const today = new Date();
  const day = today.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  today.setDate(today.getDate() + diff);

  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const dayNum = String(today.getDate()).padStart(2, '0');

  document.getElementById('period-start').value =
    `${year}-${month}-${dayNum}`;

  updateUI(1);
});
