(function(){
  const s=document.createElement('script');
  s.src='https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js';
  s.onload=()=>window.confetti({particleCount:100,spread:60,origin:{y:0.6}});
  document.head.appendChild(s);
})();