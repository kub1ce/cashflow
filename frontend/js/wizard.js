// ── Данные по умолчанию ────────────────────────────────────────────────────────
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

// ── Состояние мастера ──────────────────────────────────────────────────────────
const state = {
  currentStep: 1,
  totalSteps: 4,

  account: {
    name: '',
    type: 'cash',
    initial_balance: 0,
  },

  settings: {
    planning_start_date: '',
    planning_end_date: '',
    financial_strategy: 'manual',
  },

  // id выбранных категорий (индексы в DEFAULT_CATEGORIES)
  selectedCategories: {
    income: new Set([0, 1]),       // Зарплата, Фриланс
    expense: new Set([0, 1, 2]),   // Продукты, Транспорт, Коммунальные
  },
};

// ── Утилиты ────────────────────────────────────────────────────────────────────
function showError(msg) {
  const el = document.getElementById('error-msg');
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 4000);
}

function hideError() {
  document.getElementById('error-msg').classList.add('hidden');
}

function getMondayOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0) ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

// ── Обновление индикатора шагов ────────────────────────────────────────────────
function updateStepIndicator(step) {
  document.querySelectorAll('.step-dot').forEach((dot, idx) => {
    const dotStep = idx + 1;
    dot.classList.remove('active', 'done');
    if (dotStep < step)  dot.classList.add('done');
    if (dotStep === step) dot.classList.add('active');
  });

  document.querySelectorAll('.step-line').forEach((line, idx) => {
    line.classList.toggle('done', idx + 1 < step);
  });
}

// ── Показ нужного шага ─────────────────────────────────────────────────────────
function showStep(step) {
  document.querySelectorAll('.wizard-step').forEach(el => el.classList.add('hidden'));
  document.getElementById(`step-${step}`).classList.remove('hidden');

  const btnBack = document.getElementById('btn-back');
  const btnNext = document.getElementById('btn-next');

  btnBack.classList.toggle('hidden', step === 1);
  btnNext.textContent = (step === state.totalSteps) ? '✓ Готово' : 'Далее →';

  updateStepIndicator(step);
}

// ── Валидация шагов ────────────────────────────────────────────────────────────
function validateStep(step) {
  if (step === 1) {
    const name = document.getElementById('account-name').value.trim();
    if (!name) { showError('Введите название счёта'); return false; }
    state.account.name            = name;
    state.account.initial_balance = parseFloat(document.getElementById('account-balance').value) || 0;
    return true;
  }

  if (step === 2) {
    const start = document.getElementById('period-start').value;
    const end   = document.getElementById('period-end').value;
    if (!start || !end) { showError('Укажите обе даты периода'); return false; }
    if (start >= end)   { showError('Дата начала должна быть раньше даты конца'); return false; }
    state.settings.planning_start_date = start;
    state.settings.planning_end_date   = end;
    return true;
  }

  if (step === 3) {
    // стратегия уже сохраняется при клике
    return true;
  }

  if (step === 4) {
    const totalSelected =
      state.selectedCategories.income.size +
      state.selectedCategories.expense.size;
    if (totalSelected === 0) { showError('Выберите хотя бы одну категорию'); return false; }
    return true;
  }

  return true;
}

// ── Подсчёт недель ─────────────────────────────────────────────────────────────
function updateWeeksHint() {
  const start = document.getElementById('period-start').value;
  const end   = document.getElementById('period-end').value;
  const hint  = document.getElementById('weeks-hint');

  if (start && end && start < end) {
    const ms    = new Date(end) - new Date(start);
    const weeks = Math.ceil(ms / (7 * 24 * 60 * 60 * 1000));
    document.getElementById('weeks-count').textContent = weeks;
    hint.classList.remove('hidden');
  } else {
    hint.classList.add('hidden');
  }
}

// ── Рендер категорий ───────────────────────────────────────────────────────────
function renderCategories() {
  ['income', 'expense'].forEach(type => {
    const container = document.getElementById(`${type}-categories`);
    container.innerHTML = '';

    DEFAULT_CATEGORIES[type].forEach((cat, idx) => {
      const isSelected = state.selectedCategories[type].has(idx);
      const card = document.createElement('div');
      card.className = `category-card ${isSelected ? 'selected' : ''}`;
      card.dataset.idx  = idx;
      card.dataset.type = type;

      card.innerHTML = `
        <div class="color-dot" style="background:${cat.color_code}"></div>
        <span class="text-sm text-slate-700">${cat.name}</span>
        <div class="check-icon">
          <svg class="w-3 h-3 ${isSelected ? '' : 'hidden'}"
               fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
          </svg>
        </div>
      `;

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
    card.querySelector('.check-icon').style.background   = '';
    card.querySelector('.check-icon').style.borderColor  = '';
  } else {
    set.add(idx);
    card.classList.add('selected');
    card.querySelector('svg').classList.remove('hidden');
  }
}

// ── Сохранение и переход к таблице ────────────────────────────────────────────
async function finish() {
  const categories = [];

  let incomeOrder = 0;
  state.selectedCategories.income.forEach(idx => {
    const cat = DEFAULT_CATEGORIES.income[idx];
    categories.push({ ...cat, type: 'income', sort_order: incomeOrder++ });
  });

  let expenseOrder = 0;
  state.selectedCategories.expense.forEach(idx => {
    const cat = DEFAULT_CATEGORIES.expense[idx];
    categories.push({ ...cat, type: 'expense', sort_order: expenseOrder++ });
  });

  const payload = {
    account:    state.account,
    settings:   state.settings,
    categories: categories,
  };

  try {
    const result = await pywebview.api.save_wizard_data(payload);
    if (result.success) {
      await pywebview.api.navigate_to('index.html');
    } else {
      showError('Ошибка сохранения: ' + result.error);
    }
  } catch (e) {
    showError('Не удалось подключиться к приложению: ' + e.toString());
  }
}

// ── Навигация ──────────────────────────────────────────────────────────────────
document.getElementById('btn-next').addEventListener('click', async () => {
  hideError();
  if (!validateStep(state.currentStep)) return;

  if (state.currentStep === state.totalSteps) {
    await finish();
    return;
  }

  state.currentStep++;
  showStep(state.currentStep);

  // Рендерим категории когда доходим до шага 4
  if (state.currentStep === 4) renderCategories();
});

document.getElementById('btn-back').addEventListener('click', () => {
  hideError();
  state.currentStep--;
  showStep(state.currentStep);
});

// ── Обработчики полей ──────────────────────────────────────────────────────────

// Тип счёта
document.getElementById('account-type-group').addEventListener('click', e => {
  const btn = e.target.closest('.type-btn');
  if (!btn) return;
  document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  state.account.type = btn.dataset.value;
});

// Стратегия
document.getElementById('strategy-group').addEventListener('click', e => {
  const btn = e.target.closest('.strategy-btn');
  if (!btn) return;
  document.querySelectorAll('.strategy-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  state.settings.financial_strategy = btn.dataset.value;
});

// Подсчёт недель при изменении дат
document.getElementById('period-start').addEventListener('change', updateWeeksHint);
document.getElementById('period-end').addEventListener('change',   updateWeeksHint);

// ── Предзаполнение дат (текущий год, понедельники) ─────────────────────────────
(function setDefaultDates() {
  const today    = new Date();
  const year     = today.getFullYear();
  const monday   = getMondayOfWeek(new Date(year, 0, 1));  // первый пн года
  const lastDay  = new Date(year, 11, 31);
  const lastMon  = getMondayOfWeek(lastDay);
  // конец последней недели = воскресенье
  const lastSun  = new Date(lastMon);
  lastSun.setDate(lastSun.getDate() + 6);

  document.getElementById('period-start').value = formatDate(monday);
  document.getElementById('period-end').value   = formatDate(lastSun);
  updateWeeksHint();
})();

// ── Старт ──────────────────────────────────────────────────────────────────────
showStep(1);