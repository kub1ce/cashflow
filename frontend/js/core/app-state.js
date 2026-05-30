const App = {
  data: null,
  activeView: 'dashboard',
  editing: {
    categoryId: null,
    weekStart: null,
    weekEnd: null,
    mode: 'plan',
    el: null,
  },
};

let CellComments = {};

const Deficit = {
  weekStart: null,
  weekEnd: null,
  amount: 0,
  mode: 'single',
};

const Autofill = {
  categoryId: null,
  mode: 'weeks',
};

const PROTECTED_CATS = [
  'Незапланированные расходы',
  'Незапланированные доходы',
  'Возврат займа',
  'Покрытие из копилки',
  'Займ',
  'В копилку',
];

const SAVING_CATEGORIES = ['Покрытие из копилки', 'В копилку'];

const PAST_WEEK_COLOR = 'var(--past-week-bg)';