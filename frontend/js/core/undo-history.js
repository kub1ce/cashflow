const ACTION_TYPES = {
  CELL_EDIT: 'cell_edit',
  AUTOFILL: 'autofill',
  LOAN_REPAYMENT: 'loan_repayment',
};

const UndoHistory = {
  stack: [],
  maxSize: 50,

  push(action) {
    /**
     * Добавляет действие в историю.
     */
    this.stack.push(action);
    if (this.stack.length > this.maxSize) {
      this.stack.shift();
    }
  },

  pop() {
    /**
     * Извлекает последнее действие из истории.
     */
    return this.stack.pop();
  },

  clear() {
    /**
     * Очищает историю действий.
     */
    this.stack = [];
  },

  isEmpty() {
    /**
     * Проверяет, пуста ли история.
     */
    return this.stack.length === 0;
  },
};