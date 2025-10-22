(function(){
  const CDN = "https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js";
  function ensureScript(cb){
    if (window.confetti){ cb(); return; }
    const s = document.createElement('script');
    s.src = CDN; s.async = true;
    s.onload = cb;
    document.head.appendChild(s);
  }
  window.launchConfetti = function(){
    ensureScript(function(){
      const duration = 1200, end = Date.now() + duration;
      (function frame(){
        window.confetti({particleCount: 50, spread: 70, origin:{y:0.6}});
        if (Date.now() < end) requestAnimationFrame(frame);
      })();
    });
  };
})();