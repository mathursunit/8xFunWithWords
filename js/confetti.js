
// Minimal confetti (no deps)
window.fwwConfetti = function(x=0.5,y=0.32){
  const c=document.createElement('canvas');c.style.position='fixed';c.style.left=0;c.style.top=0;c.style.pointerEvents='none';c.width=innerWidth;c.height=innerHeight;document.body.appendChild(c);
  const ctx=c.getContext('2d');const N=120,P=[];for(let i=0;i<N;i++){P.push({x:innerWidth*x,y:innerHeight*y+Math.random()*50-25,r:Math.random()*6+3,c:`hsl(${Math.random()*360|0}deg 90% 60%)`,vx:(Math.random()*2-1)*4,vy:-(Math.random()*6+5),g:0.2,rt:Math.random()*Math.PI})}
  let t=0;const anim=()=>{t++;ctx.clearRect(0,0,c.width,c.height);P.forEach(p=>{p.vy+=p.g;p.x+=p.vx;p.y+=p.vy;p.rt+=0.1;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rt);ctx.fillStyle=p.c;ctx.fillRect(-p.r,-p.r,p.r*2,p.r*2);ctx.restore();}); if(t<120) requestAnimationFrame(anim); else c.remove();}; anim();
};
