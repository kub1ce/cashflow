if (!window.confetti) {
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.0/dist/confetti.browser.min.js';
  document.head.appendChild(script);
}
  
window.triggerConfetti = function() {
  /**
   * Запускает конфетти на 2 секунды.
   * Используется при идеальной сверке баланса (diff === 0).
   */
  if (typeof confetti !== 'undefined') {
    const duration = 2000; // 2 секунды
    const animationEnd = Date.now() + duration;
      
    const defaults = {
      startVelocity: 30,
      spread: 360,
      ticks: 60,
      zIndex: 0,
    };
  
    function randomInRange(min, max) {
      return Math.random() * (max - min) + min;
    }
  
    const interval = setInterval(function() {
      const timeLeft = animationEnd - Date.now();
  
      if (timeLeft <= 0) {
        return clearInterval(interval);
      }
  
      const particleCount = 50 * (timeLeft / duration);
        
      confetti(
        Object.assign({}, defaults, {
          particleCount,
          origin: { x: randomInRange(0.1, 0.9), y: Math.random() - 0.2 },
        })
      );
    }, 250);
  }
};