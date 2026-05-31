function getSavingCategoryName(catId) {
  /**
   * Возвращает название копилочной категории или null.
   */
  if (!App.data) return null;
  const cat = App.data.categories.find(c => c.id === catId);
  if (!cat) return null;
  return SAVING_CATEGORIES.includes(cat.name) ? cat.name : null;
}

function formatAmount(value) {
  /**
   * Форматирует число в локальный формат (RU).
   */
  if (value === null || value === undefined) return '';
  return value.toLocaleString('ru-RU', { minimumFractionDigits: 2 });
}

function getTodayISO() {
  /**
   * Возвращает сегодняшнюю дату в формате YYYY-MM-DD.
   */
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getMondayOf(dateStr) {
  /**
   * Возвращает дату понедельника для заданной даты.
   */
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return d.toISOString().split('T')[0];
}

function isCurrentWeek(weekStart, weekEnd) {
  /**
   * Проверяет является ли неделя текущей.
   */
  const today = getTodayISO();
  return today >= weekStart && today <= weekEnd;
}

function isPastWeek(weekStart, weekEnd) {
  /**
   * Проверяет является ли неделя прошедшей.
   */
  const today = getTodayISO();
  return today > weekEnd;
}

function evalAmount(str) {
  /**
   * Безопасно вычисляет математическое выражение из строки.
   * Поддерживает: числа, точки, запятые, плюс, минус.
   */
  if (!str) return 0;

  const cleaned = str.toString().replace(/\s/g, '').replace(/,/g, '.').trim();

  if (!/^[0-9.+\-]+$/.test(cleaned)) return 0;

  try {
    const result = new Function(`return ${cleaned}`)();

    if (typeof result !== 'number' || isNaN(result) || !isFinite(result)) {
      return 0;
    }

    return result;
  } catch (e) {
    return 0;
  }
}

function getVisualConfig() {
  /**
   * Возвращает визуальную конфигурацию из настроек.
   */
  return App.data?.settings?.visual_config || {};
}

function getWeekColor() {
  /**
   * Возвращает цвет обычной недели.
   */
  return getVisualConfig().weekColor || '#3b82f6';
}

function getCurrentWeekColor() {
  /**
   * Возвращает цвет текущей недели.
   */
  return getVisualConfig().currentWeekColor || '#fef08a';
}

function pluralWeeks(n) {
  /**
   * Возвращает правильное окончание для числительного "неделя".
   */
  const m10 = n % 10, m100 = n % 100;
  if (m100 >= 11 && m100 <= 19) return 'недель';
  if (m10 === 1) return 'неделю';
  if (m10 >= 2 && m10 <= 4) return 'недели';
  return 'недель';
}

function getContrastColor(color) {
  /**
   * Определяет светлый или тёмный текст для фона.
   * Поддерживает #hex, rgb(), rgba() и CSS переменные.
   */
  if (!color) return '#0f172a';

  if (color.startsWith('var(')) {
    const varName = color.match(/var\(([^)]+)\)/)[1];
    color = getComputedStyle(document.body).getPropertyValue(varName).trim();
  }

  let r, g, b;

  if (color.startsWith('#')) {
    let hex = color.slice(1);
    if (hex.length === 3) {
      hex = hex.split('').map(ch => ch + ch).join('');
    }
    if (hex.length !== 6) return '#0f172a';
    
    r = parseInt(hex.slice(0, 2), 16);
    g = parseInt(hex.slice(2, 4), 16);
    b = parseInt(hex.slice(4, 6), 16);
  } else {
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (!match) return '#0f172a';
    
    r = parseInt(match[1], 10);
    g = parseInt(match[2], 10);
    b = parseInt(match[3], 10);
  }

  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  return luminance > 0.5 ? '#0f172a' : '#ffffff';
}

function isUndoShortcut(e) {
  /**
   * Проверяет является ли комбинация Ctrl/Cmd+Z.
   */
  return (e.ctrlKey || e.metaKey) &&
         !e.shiftKey &&
         (e.code === 'KeyZ' || e.key === 'z' || e.key === 'Z' || e.key === 'я' || e.key === 'Я');
}

function pluralMonths(n) {
  /**
   * Возвращает правильное окончание для слова "месяц".
   */
  const m10 = n % 10, m100 = n % 100;
  if (m100 >= 11 && m100 <= 19) return 'месяцев';
  if (m10 === 1) return 'месяц';
  if (m10 >= 2 && m10 <= 4) return 'месяца';
  return 'месяцев';
}

function generateWeeks(startDateStr, weeksCount = 52) {
  /**
   * Генерирует массив недель от startDate на количество weeks.
   */
  if (!startDateStr) return [];

  const weeks = [];
  const startDate = new Date(startDateStr + 'T00:00:00');

  for (let i = 0; i < weeksCount; i++) {
    const weekStart = new Date(startDate);
    weekStart.setDate(weekStart.getDate() + i * 7);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const weekStartStr = weekStart.toISOString().split('T')[0];
    const weekEndStr = weekEnd.toISOString().split('T')[0];

    weeks.push({
      week_start: weekStartStr,
      week_end: weekEndStr,
      week_number: i + 1,
    });
  }

  return weeks;
}