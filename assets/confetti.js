(function(){
  const CDN="https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js";
  function ensure(cb){if(window.confetti)cb();else{const s=document.createElement('script');s.src=CDN;s.onload=cb;document.head.appendChild(s);}}
  window.launchConfetti=function(){ensure(function(){const end=Date.now()+1200;(function frame(){window.confetti({particleCount:50,spread:70,origin:{y:0.6}});if(Date.now()<end)requestAnimationFrame(frame);})();});};
})();