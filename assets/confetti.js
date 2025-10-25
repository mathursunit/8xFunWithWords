
export function fireConfetti(){
  const duration = 900;
  const end = Date.now() + duration;
  (function frame(){
    const colors=['#6aaa64','#c9b458','#787c7e','#60a5fa','#f59e0b'];
    for(let i=0;i<14;i++){
      const d=document.createElement('div');
      d.className='confetti-piece';
      d.style.left=(Math.random()*100)+'vw';
      d.style.background=colors[Math.floor(Math.random()*colors.length)];
      d.style.transform=`rotate(${Math.random()*360}deg)`;
      document.body.appendChild(d);
      setTimeout(()=>d.remove(),900);
    }
    if(Date.now()<end) requestAnimationFrame(frame);
  })();
}
