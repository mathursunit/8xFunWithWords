
// Very small confetti burst (no deps).
(function(){
  const COLORS = ['#ffd166','#06d6a0','#118ab2','#ef476f','#26547c'];
  function burst(x, y){
    const n = 24;
    for(let i=0;i<n;i++){
      const s = document.createElement('div');
      s.className = 'confettiPiece';
      const size = 6 + Math.random()*6;
      s.style.position='fixed';
      s.style.left = x+'px'; s.style.top=y+'px';
      s.style.width=size+'px'; s.style.height=size+'px';
      s.style.background = COLORS[Math.floor(Math.random()*COLORS.length)];
      s.style.borderRadius='2px';
      s.style.pointerEvents='none';
      s.style.zIndex=9999;
      document.body.appendChild(s);
      const ang = Math.random()*Math.PI*2;
      const vel = 3+Math.random()*6;
      const dx = Math.cos(ang)*vel;
      const dy = Math.sin(ang)*vel - 6;
      let t=0;
      const anim = ()=>{
        t+=0.016;
        s.style.transform=`translate(${dx*60*t}px, ${dy*60*t+60*t*t}px) rotate(${t*600}deg)`;
        s.style.opacity=String(Math.max(0,1-t/1.2));
        if(t<1.2) requestAnimationFrame(anim); else s.remove();
      };
      requestAnimationFrame(anim);
    }
  }
  window.smallConfetti = (el)=>{
    const r = el.getBoundingClientRect();
    burst(r.left+r.width/2, r.top+r.height/2);
  };
})();
