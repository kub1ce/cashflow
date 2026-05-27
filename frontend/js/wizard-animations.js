// ══════════════════════════════════════════════════════════════
// WIZARD ANIMATIONS
// ══════════════════════════════════════════════════════════════

const WizardAnim = {

    // ── Step Transition ────────────────────────────────────────
  
    /**
     * Плавное переключение шагов в wizard
     */
    switchStep(fromStep, toStep) {
      const fromEl = document.getElementById(`step-${fromStep}`);
      const toEl   = document.getElementById(`step-${toStep}`);
  
      if (!fromEl || !toEl) return Promise.resolve();
  
      return new Promise(resolve => {
        // Выход текущего шага
        fromEl.style.animation = 'stepExit 250ms var(--ease-in-out) forwards';
        
        setTimeout(() => {
          fromEl.classList.add('hidden');
          fromEl.style.animation = '';
          
          // Вход нового шага
          toEl.classList.remove('hidden');
          toEl.offsetHeight; // форсируем reflow
          toEl.style.animation = 'stepEnter 300ms var(--ease-spring) forwards';
          
          setTimeout(() => {
            toEl.style.animation = '';
            resolve();
          }, 300);
        }, 250);
      });
    },
  
    // ── Category Card Toggle ───────────────────────────────────
  
    /**
     * Анимация выбора категории
     */
    toggleCategoryCard(card, isSelected) {
      if (isSelected) {
        card.style.animation = 'catCardSelect 300ms var(--ease-spring) forwards';
      } else {
        card.style.animation = 'catCardDeselect 300ms var(--ease-in-out) forwards';
      }
      
      setTimeout(() => {
        card.style.animation = '';
      }, 300);
    },
  
    // ── Strategy Card Select ───────────────────────────────────
  
    /**
     * Анимация выбора стратегии
     */
    selectStrategyCard(card) {
      card.style.animation = 'strategySelect 300ms var(--ease-spring) forwards';
      setTimeout(() => {
        card.style.animation = '';
      }, 300);
    },
  
    // ── Sidebar Step Indicator ─────────────────────────────────
  
    /**
     * Анимация появления индикатора шага
     */
    updateSidebarStep(stepNum) {
      const el = document.getElementById(`sidebar-step-${stepNum}`);
      if (!el) return;
  
      el.style.animation = 'sidebarStepPulse 400ms var(--ease-spring) forwards';
      setTimeout(() => {
        el.style.animation = '';
      }, 400);
    },
  
    // ── Error Banner ───────────────────────────────────────────
  
    /**
     * Shake при ошибке
     */
    shakeError() {
      const banner = document.getElementById('error-banner');
      if (!banner) return;
  
      banner.style.animation = 'errorShake 500ms var(--ease-in-out)';
      setTimeout(() => {
        banner.style.animation = '';
      }, 500);
    },
  
    // ── Button State ───────────────────────────────────────────
  
    /**
     * Пульс при сохранении
     */
    pulseButton(btn) {
      if (!btn) return;
      btn.style.animation = 'buttonPulse 500ms var(--ease-spring)';
      setTimeout(() => {
        btn.style.animation = '';
      }, 500);
    },
  };
  
  // ══════════════════════════════════════════════════════════════
  // STAGGER АНИМАЦИЯ КАТЕГОРИЙ
  // ══════════════════════════════════════════════════════════════
  
  function animateCategoriesIn() {
    const cards = document.querySelectorAll('.cat-card');
    cards.forEach((card, i) => {
      card.style.animation = `catCardAppear 300ms var(--ease-out) both`;
      card.style.animationDelay = `${i * 30}ms`;
    });
  }
  
  // ══════════════════════════════════════════════════════════════
  // RIPPLE ЭФФЕКТ
  // ══════════════════════════════════════════════════════════════
  
  function initWizardRipple() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest(
        '#btn-next, #btn-back, .strategy-card, .cat-card'
      );
      if (!btn) return;
      
      const rect = btn.getBoundingClientRect();
      const circle = document.createElement('span');
      circle.className = 'ripple-circle';
      circle.style.left = `${e.clientX - rect.left}px`;
      circle.style.top = `${e.clientY - rect.top}px`;
      
      btn.classList.add('btn-ripple');
      btn.appendChild(circle);
      
      setTimeout(() => circle.remove(), 600);
    });
  }
  
  // ══════════════════════════════════════════════════════════════
  // HOOK В wizard.js ФУНКЦИИ
  // ══════════════════════════════════════════════════════════════
  
  // Сохраняем оригинальные функции
  const _origUpdateUI = window.updateUI;
  const _origToggleCategory = window.toggleCategory;
  const _origSelectStrategy = window.selectStrategy;
  const _origShowError = window.showError;
  const _origFinish = window.finish;
  
  // Переопределяем updateUI с анимацией
  window.updateUI = function(step) {
    const prevStep = state.currentStep;
    
    if (prevStep !== step) {
      // Анимируем переход между шагами
      WizardAnim.switchStep(prevStep, step).then(() => {
        // После анимации обновляем остальное
        const fromEl = document.getElementById(`step-${prevStep}`);
        const toEl = document.getElementById(`step-${step}`);
        
        if (fromEl) fromEl.classList.add('hidden');
        if (toEl) toEl.classList.remove('hidden');
        
        // Обновляем заголовок
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
          if (i === step) {
            el.classList.add('active');
            WizardAnim.updateSidebarStep(step);
          }
        }
  
        // Рендерим категории и анимируем их
        if (step === 4) {
          renderCategories();
          setTimeout(() => animateCategoriesIn(), 50);
        }
      });
    } else {
      // Если шаг не изменился
      _origUpdateUI.call(this, step);
    }
  };
  
  // Переопределяем toggleCategory с анимацией
  window.toggleCategory = function(type, idx, card) {
    const set = state.selectedCategories[type];
    const isSelected = !set.has(idx);
    
    WizardAnim.toggleCategoryCard(card, isSelected);
    _origToggleCategory.call(this, type, idx, card);
  };
  
  // Переопределяем selectStrategy с анимацией
  window.selectStrategy = function(btn) {
    _origSelectStrategy.call(this, btn);
    WizardAnim.selectStrategyCard(btn);
  };
  
  // Переопределяем showError с shake
  window.showError = function(msg) {
    _origShowError.call(this, msg);
    WizardAnim.shakeError();
  };
  
  // Переопределяем finish с пульсом
  window.finish = async function() {
    const btn = document.getElementById('btn-next');
    WizardAnim.pulseButton(btn);
    await _origFinish.call(this);
  };
  
  // ══════════════════════════════════════════════════════════════
  // ИНИЦИАЛИЗАЦИЯ
  // ══════════════════════════════════════════════════════════════
  
  document.addEventListener('DOMContentLoaded', () => {
    initWizardRipple();
  });