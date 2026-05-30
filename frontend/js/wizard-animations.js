const WizardAnim = {
  switchStep(fromStep, toStep, onMidpoint) {
    /**
     * Плавное переключение шагов.
     */
    const fromEl = document.getElementById(`step-${fromStep}`);
    const toEl   = document.getElementById(`step-${toStep}`);

    if (!fromEl || !toEl) {
      if (onMidpoint) onMidpoint();
      return Promise.resolve();
    }

    return new Promise(resolve => {
      fromEl.style.animation = 'stepExit 250ms var(--ease-in-out) forwards';
      
      setTimeout(() => {
        fromEl.classList.add('hidden');
        fromEl.style.animation = '';
        
        if (onMidpoint) onMidpoint();
        
        toEl.classList.remove('hidden');
        
        void toEl.offsetHeight; 
        
        toEl.style.animation = 'stepEnter 300ms var(--ease-spring) forwards';
        
        setTimeout(() => {
          toEl.style.animation = '';
          resolve();
        }, 300);
      }, 250);
    });
  },

  toggleCategoryCard(card, isSelected) {
    if (isSelected) {
      card.style.animation = 'catCardSelect 300ms var(--ease-spring) forwards';
    } else {
      card.style.animation = 'catCardDeselect 300ms var(--ease-in-out) forwards';
    }
    setTimeout(() => { card.style.animation = ''; }, 300);
  },

  selectStrategyCard(card) {
    card.style.animation = 'strategySelect 300ms var(--ease-spring) forwards';
    setTimeout(() => { card.style.animation = ''; }, 300);
  },

  updateSidebarStep(stepNum) {
    const el = document.getElementById(`sidebar-step-${stepNum}`);
    if (!el) return;
    el.style.animation = 'sidebarStepPulse 400ms var(--ease-spring) forwards';
    setTimeout(() => { el.style.animation = ''; }, 400);
  },

  shakeError() {
    const banner = document.getElementById('error-banner');
    if (!banner) return;
    banner.style.animation = 'errorShake 500ms var(--ease-in-out)';
    setTimeout(() => { banner.style.animation = ''; }, 500);
  },

  pulseButton(btn) {
    if (!btn) return;
    btn.style.animation = 'buttonPulse 500ms var(--ease-spring)';
    setTimeout(() => { btn.style.animation = ''; }, 500);
  },
};

function animateCategoriesIn() {
  /**
   * Стагжер анимация последовательного появления категорий.
   */
  const cards = document.querySelectorAll('.cat-card');
  cards.forEach((card, i) => {
    card.style.animation = `catCardAppear 300ms var(--ease-out) both`;
    card.style.animationDelay = `${i * 30}ms`;
  });
}

function initWizardRipple() {
  /**
   * Инициализирует ripple эффект (эффект волны) для кнопок мастера.
   */
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

const _origUpdateUI = window.updateUI;
const _origToggleCategory = window.toggleCategory;
const _origSelectStrategy = window.selectStrategy;
const _origShowError = window.showError;
const _origFinish = window.finish;
const _origWizardNext = window.wizardNext;
const _origWizardBack = window.wizardBack;

let _isStepSwitching = false;
let _activeVisualStep = 1;
let _isFinishing = false;

window.wizardNext = function() {
  /**
   * Переопределение перехода вперед с защитой от клик-спама.
   */
  if (_isStepSwitching || _isFinishing) return;
  if (typeof _origWizardNext === 'function') _origWizardNext.call(this);
};

window.wizardBack = function() {
  /**
   * Переопределение перехода назад с защитой от клик-спама.
   */
  if (_isStepSwitching || _isFinishing) return;
  if (typeof _origWizardBack === 'function') _origWizardBack.call(this);
};

window.updateUI = function(step) {
  /**
   * Переопределение updateUI с бесшовной подменой контента.
   */
  if (_activeVisualStep !== step) {
    _isStepSwitching = true;
    
    WizardAnim.switchStep(_activeVisualStep, step, () => {
      
      document.getElementById('step-header-title').textContent = STEP_TITLES[step] || '';
      document.getElementById('btn-back').classList.toggle('hidden', step === 1);

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
        if (!el) continue;

        el.classList.remove('active', 'done');
        if (i < step)  el.classList.add('done');
        if (i === step) {
          el.classList.add('active');
          WizardAnim.updateSidebarStep(step);
        }
      }

      if (step === 4) {
        renderCategories();
        animateCategoriesIn();
      }
      
    }).then(() => {
      _activeVisualStep = step;
      _isStepSwitching = false;
    });
    
  } else {
    _origUpdateUI.call(this, step);
  }
};

window.toggleCategory = function(type, idx, card) {
  /**
   * Переопределение toggleCategory с применением анимации выбора.
   */
  const set = state.selectedCategories[type];
  const isSelected = !set.has(idx);
  
  WizardAnim.toggleCategoryCard(card, isSelected);
  _origToggleCategory.call(this, type, idx, card);
};

window.selectStrategy = function(btn) {
  /**
   * Переопределение selectStrategy с применением анимации.
   */
  _origSelectStrategy.call(this, btn);
  WizardAnim.selectStrategyCard(btn);
};

window.showError = function(msg) {
  /**
   * Переопределение showError с добавлением эффекта тряски (shake).
   */
  _origShowError.call(this, msg);
  WizardAnim.shakeError();
};

window.finish = async function() {
  /**
   * Переопределение finish с пульсацией кнопки и защитой от двойного сохранения.
   */
  if (_isFinishing) return;
  _isFinishing = true;
  
  const btn = document.getElementById('btn-next');
  WizardAnim.pulseButton(btn);
  
  await _origFinish.call(this);
  _isFinishing = false;
};

document.addEventListener('DOMContentLoaded', () => {
  initWizardRipple();
});