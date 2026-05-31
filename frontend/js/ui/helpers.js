const EMOJI_CATEGORIES = {
  '😊 Смайлики': [
    '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃',
    '😉', '😌', '😍', '🥰', '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪',
    '😔', '😑', '🤐', '🤨', '😐', '😏', '😒', '🙁', '☹️', '🥺', '😲',
    '😞', '😖', '😢', '😭', '😤', '😠', '😡', '🤬', '😈', '👿', '💀', '☠️',
    '💩', '🤡', '👹', '👺', '👻', '👽', '👾', '🤖',
    '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾',
  ],
  '👋 Жесты': [
    '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🫰', '🤟',
    '🤘', '🤙', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲',
    '🤝', '💅', '🤳', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '👃', '🧠', '🦷',
    '🦴', '👀', '👁️', '👅', '👄',
  ],
  '🐶 Животные': [
    '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮',
    '🐷', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🦆',
    '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞',
    '🐜', '🪰', '🪲', '🦟', '🦗', '🕷️', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕',
    '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈',
    '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒',
    '🦘', '🐃', '🂄', '🐄', '🐎', '🐖', '🐏', '🐑', '🐐', '🦌',
    '🐕', '🐩', '🦮', '🐈', '🐓', '🦃', '🦚', '🦜', '🦢',
  ],
  '🍔 Еда и напитки': [
    '🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍈', '🍒', '🍑',
    '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🌽',
    '🥕', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🧈',
    '🥞', '🥓', '🌭', '🍔', '🍟', '🍕', '🥪', '🥙', '🧆', '🌮', '🌯',
    '🥗', '🥘', '🥫', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🦪', '🍤',
    '🍙', '🍚', '🍘', '🍥', '🥠', '🥮', '🍢', '🍡', '🍧', '🍨', '🍦', '🍰',
    '🎂', '🧁', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪', '🌰', '🍯',
    '☕', '🍵', '🍶', '🍾', '🍷', '🍸', '🍹', '🍺', '🍻', '🥂', '🥃', '🥤',
    '🧃', '🧉', '🧊',
  ],
  '⚽ Спорт': [
    '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎳', '🏓', '🏸',
    '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳', '⛸️', '🎣', '🎽', '🎿', '⛷️',
    '🏂', '🪂', '🛷', '🥌', '🎯', '🪀', '🪁',
    '🏄', '🏊', '🤽', '🚣', '🧗', '🚴', '🚵', '🤸', '⛹️', '🏋️', '🤼',
  ],
  '🚗 Транспорт': [
    '🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚',
    '🚛', '🚜', '🏍️', '🛵', '🦯', '🦽', '🦼', '🛺', '🚲', '🛴', '🛹', '🛼',
    '🚨', '🚔', '🚍', '🚘', '🚖', '🚡', '🚠', '🚟', '🚃', '🚋', '🚞', '🚝',
    '🚄', '🚅', '🚈', '🚆', '🚇', '🚉', '✈️', '🛫', '🛬', '🛰️', '🚁',
    '🛶', '⛵', '🚤', '🛳️', '⛴️', '🛥️', '🚢', '⚓',
  ],
  '🌍 Путешествия': [
    '🌍', '🌎', '🌏', '🌐', '🗺️', '🗿', '🗽', '⛪', '🕌', '🕍', '🛕', '🕋',
    '⛩️', '🛤️', '🛣️', '🗾', '⛲', '⛺', '🏕️',
    '🏠', '🏡', '🏢', '🏣', '🏤', '🏥', '🏦', '🏨', '🏪', '🏫', '🏬', '🏭',
    '🏯', '🏰', '💒', '🗼',
    '🌁', '🌃', '🌄', '🌅', '🌆', '🌇', '🌉',
    '⛰️', '🏔️', '🗻', '🌋',
  ],
  '💰 Деньги': [
    '💰', '💴', '💵', '💶', '💷', '💸', '💳', '🧾', '💎', '⌚', '👜', '👝',
    '🎁', '🏧', '💹', '📈', '📉', '🪙', '💱', '💲',
  ],
  '❤️ Символы': [
    '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '❤️‍🔥', '❤️‍🩹',
    '💔', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '💌',
    '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓',
    '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪', '🟤',
    '🔶', '🔷', '🔸', '🔹', '🔺', '🔻', '💠', '🔘', '🔲', '🔳',
    '✅', '❎', '❌', '⭕', '🚫', '⚠️', '🔞', '📵', '🆗', '🆕', '🆙', '🆒',
    '🆓', '🆖', '🅰️', '🅱️', '🆎', '🆑', '🅾️', '🆘', '🛑',
  ],
  '🌸 Природа': [
    '🌷', '🌹', '🥀', '🌺', '🌻', '🌼', '🌸', '💐',
    '🍀', '🌿', '☘️', '🎍', '🎋', '🍃', '🍂', '🍁', '🍄', '🌾',
    '🌞', '🌝', '🌛', '🌜', '🌙', '🌚', '🌑', '🌒', '🌓', '🌔', '🌕', '🌖',
    '🌗', '🌘',
    '☀️', '🌤️', '⛅', '🌥️', '☁️', '🌦️', '🌧️', '⛈️', '🌩️', '🌨️',
    '❄️', '☃️', '⛄', '🌬️', '💨', '💧', '💦', '☔', '🌊', '🌈',
    '⭐', '🌟', '✨', '💫', '⚡', '☄️', '💥', '🔥', '🌪️',
  ],
  '⏰ Время': [
    '⏰', '🕰️', '⏱️', '⏲️', '📅', '📆', '🗓️',
    '🕐', '🕑', '🕒', '🕓', '🕔', '🕕', '🕖', '🕗',
    '🕘', '🕙', '🕚', '🕛', '🕧', '🕜', '🕝', '🕞', '🕟', '🕠', '🕡', '🕢',
    '🕣', '🕤', '🕥', '🕦',
  ],
  '🎨 Развлечения': [
    '🎪', '🎨', '🖼️', '🎭', '🎬', '🎥', '📽️', '🎞️',
    '🎤', '🎧', '🎼', '🎹', '🥁', '🪘', '🎷', '🎺', '🎸', '🎻', '🪕', '🪗',
    '🎲', '🎮', '🕹️', '🎰', '🧩', '🎯', '🎳',
    '🎡', '🎢', '🎠',
    '🎟️', '🎫', '🎖️', '🏆', '🥇', '🥈', '🥉', '🏅',
  ],
};

let _activeEditEmojiCatId = null;

function initEmojiPicker() {
  /**
   * Инициализирует панель выбора эмодзи при первом открытии.
   */
  const grid = document.getElementById('emoji-grid');
  if (!grid) return;
  
  grid.innerHTML = '';
  
  const container = grid.parentElement;
  container.innerHTML = '';
  
  const tabs = document.createElement('div');
  tabs.style.cssText = `
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
    border-bottom: 1px solid #e2e8f0;
    overflow-x: auto;
    padding-bottom: 8px;
  `;
  
  const gridContainer = document.createElement('div');
  gridContainer.id = 'emoji-grid';
  gridContainer.style.cssText = `
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    gap: 6px;
  `;
  
  let firstTab = true;
  
  Object.entries(EMOJI_CATEGORIES).forEach(([category, emojis]) => {
    const tabBtn = document.createElement('button');
    tabBtn.type = 'button';
    tabBtn.style.cssText = `
      padding: 6px 12px;
      border: none;
      background: transparent;
      cursor: pointer;
      font-size: 16px;
      opacity: ${firstTab ? '1' : '0.5'};
      border-bottom: ${firstTab ? '2px solid #3b82f6' : 'none'};
      transition: all 0.2s ease;
      white-space: nowrap;
    `;
    tabBtn.textContent = category.split(' ')[0];
    tabBtn.className = firstTab ? 'emoji-tab active' : 'emoji-tab';
    
    tabBtn.addEventListener('mouseover', () => {
      tabBtn.style.opacity = '1';
    });
    
    tabBtn.addEventListener('mouseout', () => {
      if (!tabBtn.classList.contains('active')) {
        tabBtn.style.opacity = '0.5';
      }
    });
    
    tabBtn.addEventListener('click', (e) => {
      e.preventDefault();
      
      document.querySelectorAll('.emoji-tab').forEach(t => {
        t.classList.remove('active');
        t.style.opacity = '0.5';
        t.style.borderBottom = 'none';
      });
      tabBtn.classList.add('active');
      tabBtn.style.opacity = '1';
      tabBtn.style.borderBottom = '2px solid #3b82f6';
      
      gridContainer.innerHTML = '';
      emojis.forEach(emoji => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'emoji-btn';
        btn.textContent = emoji;
        btn.title = emoji;
        btn.addEventListener('click', (ev) => {
          ev.preventDefault();
          insertEmoji(emoji);
        });
        gridContainer.appendChild(btn);
      });
    });
    
    tabs.appendChild(tabBtn);
    firstTab = false;
  });
  
  container.appendChild(tabs);
  container.appendChild(gridContainer);
  
  const firstCategory = Object.values(EMOJI_CATEGORIES)[0];
  firstCategory.forEach(emoji => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'emoji-btn';
    btn.textContent = emoji;
    btn.title = emoji;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      insertEmoji(emoji);
    });
    gridContainer.appendChild(btn);
  });
}

function toggleEmojiPicker(event) {
  /**
   * Открывает или закрывает панель эмодзи, корректируя позицию на экране.
   */
  event.preventDefault();
  event.stopPropagation();
  
  const panel = document.getElementById('emoji-picker-panel');
  const isHidden = panel.classList.contains('hidden');
  
  if (isHidden) {
    initEmojiPicker();
    panel.classList.remove('hidden');
    
    const input = document.getElementById('s-new-cat-name');
    const rect = input.getBoundingClientRect();
    
    let top = rect.bottom + 5;
    let left = rect.left;
    
    const windowHeight = window.innerHeight;
    const panelHeight = 380;
    
    if (top + panelHeight > windowHeight - 20) {
      top = rect.top - panelHeight - 5;
    }
    
    panel.style.top = top + 'px';
    panel.style.left = left + 'px';
    
    setTimeout(() => {
      document.addEventListener('click', closeEmojiPicker);
    }, 0);
  } else {
    panel.classList.add('hidden');
    document.removeEventListener('click', closeEmojiPicker);
  }
}

function closeEmojiPicker(e) {
  /**
   * Закрывает панель эмодзи, если клик произошел вне её области.
   */
  const panel = document.getElementById('emoji-picker-panel');
  const btn = document.getElementById('emoji-picker-btn');
  const input = document.getElementById('s-new-cat-name');
  
  if (
    (!panel || !panel.contains(e.target)) &&
    (!btn   || !btn.contains(e.target)) &&
    (!input || !input.contains(e.target))
  ) {
    panel.classList.add('hidden');
    document.removeEventListener('click', closeEmojiPicker);
  }
}

function insertEmoji(emoji) {
  /**
   * Вставляет выбранный эмодзи в поле ввода на позицию курсора.
   */
  const input = document.getElementById('s-new-cat-name');
  if (!input) return;

  const cursorPos = input.selectionStart ?? input.value.length;
  const text = input.value;

  input.value = text.slice(0, cursorPos) + emoji + text.slice(cursorPos);

  input.focus();
  input.setSelectionRange(cursorPos + emoji.length, cursorPos + emoji.length);

  document.getElementById('emoji-picker-panel').classList.add('hidden');
  document.removeEventListener('click', closeEmojiPicker);
}

function toggleEmojiPickerForEdit(event, catId) {
  /**
   * Открывает или закрывает панель эмодзи для редактируемой категории.
   */
  event.preventDefault();
  event.stopPropagation();

  const panel = document.getElementById(`emoji-picker-edit-panel-${catId}`);
  if (!panel) return;

  const isHidden = panel.classList.contains('hidden');

  closeAllEditEmojiPickers();

  if (!isHidden) return;

  initEmojiPickerForEdit(catId);

  const input = document.getElementById(`cat-edit-input-${catId}`);
  if (input) {
    const rect = input.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    const panelHeight  = 400;

    let top  = rect.bottom + 5;
    let left = rect.left;

    if (top + panelHeight > windowHeight - 20) {
      top = rect.top - panelHeight - 5;
    }
    
    const windowWidth  = window.innerWidth;
    const panelWidth   = 380;
    if (left + panelWidth > windowWidth - 20) {
      left = windowWidth - panelWidth - 20;
    }

    panel.style.top  = `${top}px`;
    panel.style.left = `${left}px`;
  }

  panel.classList.remove('hidden');
  _activeEditEmojiCatId = catId;

  setTimeout(() => {
    document.addEventListener('click', _onOutsideEditEmojiClick);
  }, 0);
}

function _onOutsideEditEmojiClick(e) {
  /**
   * Закрывает панель эмодзи при клике вне её области.
   */
  if (_activeEditEmojiCatId === null) return;

  const panel = document.getElementById(
    `emoji-picker-edit-panel-${_activeEditEmojiCatId}`
  );
  const btn   = document.querySelector(
    `#cat-edit-${_activeEditEmojiCatId} button[title="Добавить эмодзи"]`
  );

  if (
    (!panel || !panel.contains(e.target)) &&
    (!btn   || !btn.contains(e.target))
  ) {
    closeAllEditEmojiPickers();
  }
}

function closeAllEditEmojiPickers() {
  /**
   * Скрывает все открытые панели эмодзи для редактирования.
   */
  document.querySelectorAll('[id^="emoji-picker-edit-panel-"]').forEach(p => {
    p.classList.add('hidden');
  });
  document.removeEventListener('click', _onOutsideEditEmojiClick);
  _activeEditEmojiCatId = null;
}

function initEmojiPickerForEdit(catId) {
  /**
   * Инициализирует вкладки и сетку эмодзи для конкретной категории.
   */
  const panel = document.getElementById(`emoji-picker-edit-panel-${catId}`);
  if (!panel) return;

  panel.innerHTML = '';

  const tabs = document.createElement('div');
  tabs.style.cssText = `
    display: flex;
    gap: 8px;
    margin-bottom: 10px;
    border-bottom: 1px solid #e2e8f0;
    overflow-x: auto;
    padding-bottom: 8px;
  `;

  const gridContainer = document.createElement('div');
  gridContainer.style.cssText = `
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    gap: 6px;
  `;

  let firstTab = true;

  Object.entries(EMOJI_CATEGORIES).forEach(([category, emojis]) => {
    const tabBtn = document.createElement('button');
    tabBtn.type = 'button';
    tabBtn.style.cssText = `
      padding: 5px 10px;
      border: none;
      background: transparent;
      cursor: pointer;
      font-size: 16px;
      opacity: ${firstTab ? '1' : '0.5'};
      border-bottom: ${firstTab ? '2px solid #3b82f6' : '2px solid transparent'};
      transition: all 0.15s ease;
      white-space: nowrap;
      flex-shrink: 0;
    `;
    tabBtn.textContent = category.split(' ')[0];
    tabBtn.className   = firstTab ? 'emoji-tab-edit active' : 'emoji-tab-edit';

    tabBtn.addEventListener('mouseover', () => {
      if (!tabBtn.classList.contains('active')) tabBtn.style.opacity = '0.8';
    });
    tabBtn.addEventListener('mouseout', () => {
      if (!tabBtn.classList.contains('active')) tabBtn.style.opacity = '0.5';
    });

    tabBtn.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();

      panel.querySelectorAll('.emoji-tab-edit').forEach(t => {
        t.classList.remove('active');
        t.style.opacity = '0.5';
        t.style.borderBottom = '2px solid transparent';
      });
      tabBtn.classList.add('active');
      tabBtn.style.opacity = '1';
      tabBtn.style.borderBottom = '2px solid #3b82f6';

      renderEmojiGrid(gridContainer, emojis, catId);
    });

    tabs.appendChild(tabBtn);

    if (firstTab) {
      firstTab = false;
    }
  });

  panel.appendChild(tabs);
  panel.appendChild(gridContainer);

  const firstEmojis = Object.values(EMOJI_CATEGORIES)[0];
  renderEmojiGrid(gridContainer, firstEmojis, catId);
}

function renderEmojiGrid(gridContainer, emojis, catId) {
  /**
   * Отрисовывает кнопки с эмодзи в переданном контейнере.
   */
  gridContainer.innerHTML = '';
  emojis.forEach(emoji => {
    const btn = document.createElement('button');
    btn.type      = 'button';
    btn.className = 'emoji-btn';
    btn.textContent = emoji;
    btn.title       = emoji;
    btn.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      insertEmojiForEdit(emoji, catId);
    });
    gridContainer.appendChild(btn);
  });
}

function insertEmojiForEdit(emoji, catId) {
  /**
   * Вставляет эмодзи в поле ввода при редактировании названия.
   */
  const input = document.getElementById(`cat-edit-input-${catId}`);
  if (!input) return;

  const cursorPos = input.selectionStart ?? input.value.length;
  const text      = input.value;

  input.value = text.slice(0, cursorPos) + emoji + text.slice(cursorPos);

  input.focus();
  const newPos = cursorPos + emoji.length;
  input.setSelectionRange(newPos, newPos);

  closeAllEditEmojiPickers();
}

function scrollToWeek(dateStr, highlight = false) {
  /**
   * Скроллит таблицу к указанной неделе и опционально подсвечивает её.
   */
  if (!dateStr || !App.data) return;

  const target = dateStr.slice(0, 10);

  let targetWeek = App.data.weeks.find(w =>
    target >= w.week_start && target <= w.week_end
  );

  if (!targetWeek) {
    const first = App.data.weeks[0];
    const last  = App.data.weeks[App.data.weeks.length - 1];
    targetWeek  = target < first.week_start ? first : last;
  }

  const container = document.getElementById('table-scroll-container');
  const th        = document.getElementById(`week-col-${targetWeek.week_start}`);

  if (!container || !th) return;

  const sticky = document.querySelector('.th-sticky');
  const STICKY_WIDTH = sticky ? sticky.offsetWidth : 250;
  const targetScrollLeft = th.offsetLeft - STICKY_WIDTH;

  container.scrollTo({
    left:     Math.max(0, targetScrollLeft),
    behavior: 'smooth',
  });

  if (highlight) highlightWeekColumn(targetWeek.week_start);
}

function scrollToToday() {
  /**
   * Скроллит таблицу к текущей дате с подсветкой.
   */
  scrollToWeek(getTodayISO(), true);
}

function highlightWeekColumn(weekStart) {
  /**
   * Временно подсвечивает заголовок столбца выбранной недели.
   */
  document.querySelectorAll('.week-highlight').forEach(el => {
    el.classList.remove('week-highlight');
    el.style.removeProperty('background-color');
    el.style.removeProperty('transition');
  });

  const th = document.getElementById(`week-col-${weekStart}`);
  if (!th) return;

  const original = th.style.backgroundColor;
  const isDark = document.body.classList.contains('dark');
  const highlightColor = isDark ? '#ef5350' : '#fca5a5';

  th.style.transition = 'background-color 0.3s ease';
  th.style.backgroundColor = highlightColor;
  th.classList.add('week-highlight');

  setTimeout(() => {
    th.style.backgroundColor = original || '';
    th.classList.remove('week-highlight');
    setTimeout(() => {
      th.style.removeProperty('transition');
    }, 300);
  }, 3000);
}

async function handleExport() {
  /**
   * Выгружает все данные пользователя (настройки, категории, транзакции) в JSON файл.
   */
  try {
    const result = await pywebview.api.export_data();
    if (!result.success) { showToast('Ошибка экспорта', 'error'); return; }

    const content  = JSON.stringify(result.data, null, 2);
    const today = getTodayISO();
    const filename = `cashflow_backup_${today}.json`;

    const saved = await pywebview.api.save_file_dialog(content, filename);
    if (saved.success) {
      showToast('Данные экспортированы', 'success');
    }
  } catch (e) {
    showToast('Ошибка экспорта', 'error');
  }
}

async function handleImport() {
  /**
   * Импортирует данные из JSON файла, заменяя текущую базу данных.
   */
  try {
    const result = await pywebview.api.open_file_dialog();
    if (!result.success) return;

    const data = JSON.parse(result.content);
    if (!data.version || !data.settings) {
      showToast('Неверный формат файла', 'error');
      return;
    }

    const ok = await showConfirm(
      'Импортировать данные?',
      'Все текущие данные будут заменены.'
    );
    if (!ok) return;

    const importResult = await pywebview.api.import_data(data);
    if (importResult.success) {
      showToast('Данные импортированы', 'success');
      
      switchView('dashboard');
      await reloadData();
      
      if (App.data) {
        renderTable(App.data);
      }
      
      UndoHistory.clear();
      
      const today = getTodayISO();
      setTimeout(() => scrollToWeek(today), 150);
    } else {
      showToast('Ошибка импорта: ' + importResult.error, 'error');
    }
  } catch (e) {
    showToast('Ошибка при чтении файла', 'error');
  }
}

async function handleToggleMaximize() {
  /**
   * Переключает состояние окна между развернутым и оконным режимом.
   */
  await pywebview.api.toggle_maximize();

  setTimeout(() => {
    const btn = document.getElementById('btn-maximize');
    if (!btn) return;

    const isMax = (
      window.outerWidth  >= screen.availWidth  - 20 &&
      window.outerHeight >= screen.availHeight - 20
    );

    btn.innerHTML = isMax
      ? `<svg viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1">
           <rect x="2" y="0" width="8" height="8"/>
           <path d="M0 2v8h8" fill="none"/>
         </svg>`
      : `<svg viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1">
           <rect x="0.5" y="0.5" width="9" height="9"/>
         </svg>`;

    btn.title = isMax ? 'Восстановить' : 'Развернуть';
  }, 100);
}

function initWindowControls() {
  /**
   * Навешивает обработчики на системные кнопки управления окном.
   */
  const btnMin = document.getElementById('btn-minimize');
  const btnMax = document.getElementById('btn-maximize');
  const btnClose = document.getElementById('btn-close');

  btnMin?.addEventListener('click', async () => {
    try {
      if (!window.pywebview?.api?.minimize_window) return;
      await pywebview.api.minimize_window();
    } catch (e) {
      console.error('Ошибка minimize:', e);
    }
  });

  btnMax?.addEventListener('click', async () => {
    try {
      if (!window.pywebview?.api?.toggle_maximize) return;
      await handleToggleMaximize();
    } catch (e) {
      console.error('Ошибка maximize:', e);
    }
  });

  btnClose?.addEventListener('click', async () => {
    try {
      if (!window.pywebview?.api?.close_window) return;
      await pywebview.api.close_window();
    } catch (e) {
      console.error('Ошибка close:', e);
    }
  });
}

function initSidebarNavigation() {
  /**
   * Назначает обработчики событий для элементов бокового меню.
   */
  const btnDashboard = document.getElementById('nav-dashboard');
  const btnSettings  = document.getElementById('nav-settings');
  const btnReconcile = document.getElementById('btn-reconcile');

  btnDashboard?.addEventListener('click', () => {
    switchView('dashboard');
  });

  btnSettings?.addEventListener('click', () => {
    switchView('settings');
  });

  btnReconcile?.addEventListener('click', () => {
    openReconcileModal();
  });
}

function renderEditorBody(isUpdate = false) {
  /**
   * Отрисовывает содержимое редактора ячейки (план или факт).
   */
  const body = document.getElementById('cell-editor-body');
  if (!body) return;

  const { categoryId, weekStart, mode } = App.editing;
  const key = `${categoryId}:${weekStart}`;
  
  const today = getTodayISO();
  const isPastWeek = App.editing.weekEnd < today;
  const isFutureWeek = App.editing.weekStart > today;
  const isLocked = isPastWeek && !App.editing.unlocked;

  const editorPopup = body.closest('.cell-editor');
  if (editorPopup) {
    if (isLocked) {
      editorPopup.style.setProperty('width', '240px', 'important');
      editorPopup.style.setProperty('min-width', '240px', 'important');
    } else {
      editorPopup.style.removeProperty('width');
      editorPopup.style.removeProperty('min-width');
    }
  }
  const plan = App.data.plans[key];
  const hasPlan = plan && plan.amount > 0;
  const facts = App.data.facts[key] ? [...App.data.facts[key]] : [];
  facts.sort((a, b) => {
    const dateDiff = new Date(a.date) - new Date(b.date);
    return dateDiff !== 0 ? dateDiff : a.id - b.id;
  });
  const factTotal = facts.reduce((sum, f) => sum + f.amount, 0);

  let reminderHtml = '';
  if (hasPlan && factTotal === 0 && isLocked) {
    reminderHtml = `
      <div class="fact-reminder-box" style="margin-bottom: 8px;">
        ⚠️ Вы забыли внести фактические данные за эту неделю!
      </div>
    `;
  }

  if (mode === 'plan') {
    const initVal = plan ? plan.amount.toString() : '';
    
    if (isLocked) {
      body.innerHTML = `
        <div class="fact-locked-container">
          <div class="fact-locked-icon">🔒</div>
          <div class="fact-locked-text" style="margin-bottom: 8px;">
            Прошлый период. Изменения заблокированы.<br>
            Текущий план: <b>${formatAmount(plan ? plan.amount : 0)}</b>
          </div>
          ${reminderHtml}
          <button type="button" class="fact-btn-unlock" onclick="unlockPastPeriod()">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Редактировать
          </button>
        </div>
      `;
      return;
    }

    body.innerHTML = `
      <input id="cell-editor-input" type="text" value="${initVal}" autocomplete="off" placeholder="0" 
             oninput="this.value = this.value.replace(/[^0-9.,+-]/g, '')" />
      <div class="cell-editor-actions" style="margin-top: 4px;">
        <button type="button" class="cell-editor-cancel" onclick="closeActiveCellEditor(true)">✕</button>
        <button type="button" class="cell-editor-confirm" onclick="saveCellEditor()">ОК</button>
      </div>
    `;
    
    const input = document.getElementById('cell-editor-input');
    if (!isUpdate) setTimeout(() => input.focus(), 50);
    
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter')  { e.preventDefault(); saveCellEditor(); }
      if (e.key === 'Escape') { e.preventDefault(); closeActiveCellEditor(true); }
      if (isUndoShortcut(e)) { e.preventDefault(); e.stopPropagation(); undoLastAction(); }
    });

  } else {
    const fmt = d => d ? d.split('-').reverse().slice(0,2).join('.') : '';
    const editIcon = `<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>`;
    const trashIcon = `<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>`;

    let listHtml = '';
    if (facts.length === 0) {
      listHtml = `<div style="text-align:center; font-size:11px; color:#94a3b8; padding: 16px 0;">Нет операций за эту неделю</div>`;
    } else {
      listHtml = `<div class="fact-section-title">История операций</div>`;
      facts.forEach((f, i) => {
        const animClass = isUpdate ? '' : 'fact-item-animate';
        const delay = isUpdate ? 0 : 150 + i * 40; 
        const actionsStyle = isLocked ? 'display: none;' : 'display: flex; gap: 2px;';
        
        listHtml += `
          <div class="fact-item ${animClass}" id="fact-item-${f.id}" style="animation-delay: ${delay}ms;">
            <span class="fact-item-date">${fmt(f.date)}</span>
            <span class="fact-item-amount" id="fact-amount-text-${f.id}">${formatAmount(f.amount)}</span>
            <div class="fact-item-actions" id="fact-actions-${f.id}" style="${actionsStyle}">
              <button type="button" class="fact-icon-btn edit" onclick="startEditFact(${f.id}, ${f.amount})" title="Изменить">${editIcon}</button>
              <button type="button" class="fact-icon-btn delete" onclick="deleteFact(${f.id})" title="Удалить">${trashIcon}</button>
            </div>
          </div>
        `;
      });
    }

    if (isUpdate && document.getElementById('fact-list-container') && !isLocked) {
      document.getElementById('fact-list-container').innerHTML = listHtml;
      const amtInput = document.getElementById('new-fact-amount');
      if (amtInput) {
        amtInput.value = '';
        amtInput.focus();
      }
      return;
    }

    let bottomHtml = '';
    if (isFutureWeek) {
      bottomHtml = `
        <div class="fact-locked-container">
          <div class="fact-locked-icon">🔮</div>
          <div class="fact-locked-text">
            Будущая неделя.<br>
            Факты вносятся только в текущем периоде.<br>
            Используйте вкладку <strong>«План»</strong>.
          </div>
        </div>
      `;
    } else if (isLocked) {
      bottomHtml = `...`;
    } else {
      bottomHtml = `...`;
    }
    
    if (isLocked) {
      bottomHtml = `
        <div class="fact-locked-container">
          <div class="fact-locked-icon">🔒</div>
          <div class="fact-locked-text" style="margin-bottom: 8px;">Прошлый период. Изменения заблокированы.</div>
          ${reminderHtml}
          <button type="button" class="fact-btn-unlock" onclick="unlockPastPeriod()">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Редактировать
          </button>
        </div>
      `;
    } else {
      const defaultDate = (today >= weekStart && today <= App.editing.weekEnd) ? today : weekStart;
      bottomHtml = `
        <div class="fact-add-form">
          <div class="fact-section-title" style="margin-bottom:0;">Новая операция</div>
          <div class="fact-inputs-row">
            <input type="date" id="new-fact-date" value="${defaultDate}" min="${weekStart}" max="${App.editing.weekEnd}">
            <input type="text" id="new-fact-amount" placeholder="Сумма" oninput="this.value = this.value.replace(/[^0-9.,+-]/g, '')">
          </div>
          <button type="button" class="fact-btn-primary" onclick="addNewFact()">Добавить сумму</button>
        </div>
      `;
    }

    body.innerHTML = `
      <div id="fact-list-container" class="fact-list-container">${listHtml}</div>
      ${bottomHtml}
    `;

    if (!isLocked) {
      const amtInput = document.getElementById('new-fact-amount');
      if (amtInput) {
        setTimeout(() => amtInput.focus(), 50);
        amtInput.addEventListener('keydown', e => {
          if (e.key === 'Enter') { e.preventDefault(); addNewFact(); }
          if (e.key === 'Escape') { e.preventDefault(); closeActiveCellEditor(true); }
          if (isUndoShortcut(e)) { e.preventDefault(); e.stopPropagation(); undoLastAction(); }
        });
      }
    }
  }
}

function unlockPastPeriod() {
  /**
   * Разблокирует ячейку.
   */
  App.editing.unlocked = true;
  renderEditorBody();
}

function startEditFact(factId, currentAmount) {
  /**
   * Заменяет отображение суммы факта на инпут для редактирования.
   */
  const amtSpan = document.getElementById(`fact-amount-text-${factId}`);
  const actionsDiv = document.getElementById(`fact-actions-${factId}`);
  
  const saveIcon = `<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>`;
  const cancelIcon = `<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>`;

  amtSpan.innerHTML = `<input type="text" id="edit-fact-input-${factId}" value="${currentAmount}" style="width:100%; max-width:80px; text-align:right; padding:2px 4px; font-size:12px; border:1px solid #3b82f6; border-radius:4px; outline:none; background:transparent; color:inherit;" oninput="this.value = this.value.replace(/[^0-9.,+-]/g, '')">`;
  
  actionsDiv.innerHTML = `
    <button type="button" class="fact-icon-btn save" onclick="saveEditFact(${factId})" title="Сохранить">${saveIcon}</button>
    <button type="button" class="fact-icon-btn cancel" onclick="renderEditorBody(true)" title="Отмена">${cancelIcon}</button>
  `;
  
  const input = document.getElementById(`edit-fact-input-${factId}`);
  input.focus();
  input.select();
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') saveEditFact(factId);
    if (e.key === 'Escape') renderEditorBody(true);
  });
}

let _animationsEnabled = localStorage.getItem('cashflow-animations') !== 'false';

function applyAnimationsSetting(enabled) {
  /**
   * Включает или отключает все CSS-анимации в приложении.
   */
  _animationsEnabled = enabled;
  localStorage.setItem('cashflow-animations', enabled ? 'true' : 'false');

  if (enabled) {
    document.documentElement.style.removeProperty('--anim-fast');
    document.documentElement.style.removeProperty('--anim-normal');
    document.documentElement.style.removeProperty('--anim-slow');
    document.body.classList.remove('no-animations');
    const earlyStyle = document.querySelector('style[data-animations-disabled]');
    if (earlyStyle) earlyStyle.remove();
    delete document.documentElement.dataset.animationsDisabled;
  } else {
    document.documentElement.style.setProperty('--anim-fast',   '0ms');
    document.documentElement.style.setProperty('--anim-normal', '0ms');
    document.documentElement.style.setProperty('--anim-slow',   '0ms');
    document.body.classList.add('no-animations');
  }

  const toggle = document.getElementById('animations-toggle');
  if (toggle) toggle.checked = enabled;

  if (App.data?.settings) {
    if (!App.data.settings.visual_config) App.data.settings.visual_config = {};
    App.data.settings.visual_config.animations = enabled ? 'true' : 'false';

    pywebview.api.save_settings({
      visual_config: App.data.settings.visual_config
    }).catch(e => console.error('Ошибка сохранения анимаций:', e));
  }
}

function _onAnimationsToggle(checked) {
  /**
   * Обрабатывает переключение тумблера анимаций в настройках.
   */
  const track = document.getElementById('animations-track');
  const thumb = document.getElementById('animations-thumb');
  const label = document.getElementById('animations-label');

  if (track) {
    track.style.transition = 'background-color 0.2s ease';
    track.style.background = checked ? '#2563eb' : '#cbd5e1';
  }
  if (thumb) {
    thumb.style.transition = 'transform 0.2s ease';
    thumb.style.transform  = `translateX(${checked ? '20px' : '0px'})`;
  }
  if (label) {
    label.textContent = checked ? 'Включены' : 'Отключены';
  }

  setTimeout(() => {
    applyAnimationsSetting(checked);
    showToast(
      checked ? 'Анимации включены' : 'Анимации отключены',
      'info'
    );
  }, 220);
}

function applyTheme(isDark) {
  /**
   * Применяет тёмную или светлую тему к интерфейсу.
   */
  document.body.classList.toggle('dark', isDark);

  const sun  = document.getElementById('theme-icon-sun');
  const moon = document.getElementById('theme-icon-moon');

  if (isDark) {
    sun?.classList.add('hidden');
    moon?.classList.remove('hidden');
    document.getElementById('btn-theme').title = 'Светлая тема';
  } else {
    sun?.classList.remove('hidden');
    moon?.classList.add('hidden');
    document.getElementById('btn-theme').title = 'Тёмная тема';
  }
}

async function toggleTheme() {
  /**
   * Переключает тему с плавной анимацией и сохраняет выбор в базе данных.
   */
  const isDark = !document.body.classList.contains('dark');

  const performThemeSwitch = () => {
    applyTheme(isDark);
    localStorage.setItem('cashflow-theme', isDark ? 'dark' : 'light');

    if (App.data?.settings) {
      if (!App.data.settings.visual_config) App.data.settings.visual_config = {};
      App.data.settings.visual_config.theme = isDark ? 'dark' : 'light';

      try {
        pywebview.api.save_settings({
          visual_config: App.data.settings.visual_config
        });
      } catch (e) {
        console.error('Ошибка сохранения темы', e);
      }
    }
  };

  if (document.startViewTransition) {
    document.startViewTransition(() => {
      performThemeSwitch();
    });
  } else {
    performThemeSwitch();
  }
}