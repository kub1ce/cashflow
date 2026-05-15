// ══════════════════════════════════════════════════════════════
// ДАННЫЕ
// ══════════════════════════════════════════════════════════════

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

// ══════════════════════════════════════════════════════════════
// СОСТОЯНИЕ
// ══════════════════════════════════════════════════════════════

const state = {
  currentStep: 1,
  totalSteps:  4,

  account: {
    name:            '',
    initial_balance: 0,
  },

  settings: {
    planning_start_date: '',
    financial_strategy:  'manual',
  },

  selectedCategories: {
    income:  new Set([0, 1]),
    expense: new Set([0, 1, 2]),
  },
};

// ══════════════════════════════════════════════════════════════
// УТИЛИТЫ
// ══════════════════════════════════════════════════════════════

const STEP_TITLES = {
  1: 'Основной счёт',
  2: 'Период планирования',
  3: 'Стратегия кассовых разрывов',
  4: 'Категории по умолчанию',
};

function showError(msg) {
  const el = document.getElementById('error-banner');
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 4000);
}

function hideError() {
  document.getElementById('error-banner').classList.add('hidden');
}

function getMondayISO(dateStr) {
  const d   = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();

  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));

  const year  = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const date  = String(d.getDate()).padStart(2, '0');

  return `${year}-${month}-${date}`;
}

// ══════════════════════════════════════════════════════════════
// ОБНОВЛЕНИЕ UI
// ══════════════════════════════════════════════════════════════

function updateUI(step) {
  // Шаги
  document.querySelectorAll('.wizard-step').forEach(el => {
    el.classList.add('hidden');
  });
  document.getElementById(`step-${step}`).classList.remove('hidden');

  // Заголовок
  document.getElementById('step-header-title').textContent =
    STEP_TITLES[step] || '';

  // Кнопка Назад
  document.getElementById('btn-back')
    .classList.toggle('hidden', step === 1);

  // Кнопка Далее/Готово
  const btnNext = document.getElementById('btn-next');
  if (step === state.totalSteps) {
    btnNext.textContent = '✓ Готово';
    btnNext.style.background = '#059669';
  } else {
    btnNext.textContent = 'Далее →';
    btnNext.style.background = '';
  }

  // Сайдбар
  for (let i = 1; i <= state.totalSteps; i++) {
    const el = document.getElementById(`sidebar-step-${i}`);
    el.classList.remove('active', 'done');
    if (i < step)  el.classList.add('done');
    if (i === step) el.classList.add('active');
  }

  // Рендерим категории при переходе на шаг 4
  if (step === 4) renderCategories();
}

// ══════════════════════════════════════════════════════════════
// СТРАТЕГИЯ
// ══════════════════════════════════════════════════════════════

function selectStrategy(btn) {
  document.querySelectorAll('.strategy-card').forEach(b => {
    b.classList.remove('active');
  });
  btn.classList.add('active');
  state.settings.financial_strategy = btn.dataset.value;
}

// ══════════════════════════════════════════════════════════════
// КАТЕГОРИИ
// ══════════════════════════════════════════════════════════════

function renderCategories() {
  ['income', 'expense'].forEach(type => {
    const container = document.getElementById(`${type}-categories`);
    container.innerHTML = '';

    DEFAULT_CATEGORIES[type].forEach((cat, idx) => {
      const selected = state.selectedCategories[type].has(idx);
      const card     = document.createElement('div');
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

// ══════════════════════════════════════════════════════════════
// ВАЛИДАЦИЯ
// ══════════════════════════════════════════════════════════════

function validateStep(step) {
  if (step === 1) {
    const name = document.getElementById('account-name').value.trim();
    if (!name) { showError('Введите название счёта'); return false; }
    state.account.name            = name;
    state.account.initial_balance =
      parseFloat(document.getElementById('account-balance').value) || 0;
    return true;
  }

  if (step === 2) {
    const start = document.getElementById('period-start').value;
    if (!start) { showError('Укажите дату начала периода'); return false; }
    state.settings.planning_start_date = getMondayISO(start);
    return true;
  }

  if (step === 3) {
    // Стратегия сохраняется по клику
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

// ══════════════════════════════════════════════════════════════
// НАВИГАЦИЯ
// ══════════════════════════════════════════════════════════════

function wizardNext() {
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
  hideError();
  if (state.currentStep <= 1) return;
  state.currentStep--;
  updateUI(state.currentStep);
}

// ══════════════════════════════════════════════════════════════
// СОХРАНЕНИЕ
// ══════════════════════════════════════════════════════════════

async function finish() {
  const btn = document.getElementById('btn-next');
  btn.disabled    = true;
  btn.textContent = 'Сохраняю...';

  const categories = [];
  let order = 0;

  state.selectedCategories.income.forEach(idx => {
    categories.push({
      ...DEFAULT_CATEGORIES.income[idx],
      type:       'income',
      sort_order: order++,
    });
  });

  state.selectedCategories.expense.forEach(idx => {
    categories.push({
      ...DEFAULT_CATEGORIES.expense[idx],
      type:       'expense',
      sort_order: order++,
    });
  });

  const payload = {
    account:    state.account,
    settings:   state.settings,
    categories: categories,
  };

  try {
    // Ждём готовности pywebview
    await new Promise(resolve => {
      if (window.pywebview) resolve();
      else window.addEventListener('pywebviewready', resolve, { once: true });
    });

    const result = await pywebview.api.save_wizard_data(payload);

    if (result && result.success) {
      // Небольшая задержка перед навигацией
      btn.textContent = '✓ Готово!';
      setTimeout(async () => {
        await pywebview.api.navigate_to('index.html');
      }, 300);
    } else {
      showError('Ошибка: ' + (result?.error || 'неизвестная ошибка'));
      btn.disabled    = false;
      btn.textContent = '✓ Готово';
    }
  } catch (e) {
    showError('Ошибка соединения: ' + e.toString());
    btn.disabled    = false;
    btn.textContent = '✓ Готово';
  }
}

// ══════════════════════════════════════════════════════════════
// ИНИЦИАЛИЗАЦИЯ
// ══════════════════════════════════════════════════════════════

// Предустанавливаем дату начала = первый понедельник текущего года
document.addEventListener('DOMContentLoaded', function() {
  // Устанавливаем понедельник текущей недели
  const today = new Date();
  const day   = today.getDay();
  const diff  = day === 0 ? -6 : 1 - day; // сдвиг до понедельника
  today.setDate(today.getDate() + diff);
  
  const year  = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const dayNum = String(today.getDate()).padStart(2, '0');

  document.getElementById('period-start').value =
    `${year}-${month}-${dayNum}`;

// Показываем первый шаг
updateUI(1);
});