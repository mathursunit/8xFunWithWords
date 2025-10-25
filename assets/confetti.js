export function fireConfetti(){
  const duration = 900, end = Date.now() + duration;
  (function frame(){
    const colors=['#24a148','#1a73e8','#dba21b','#ef4444','#10b981'];
    for(let i=0;i<12;i++){
      const d=document.createElement('div'); d.className='confetti-piece';
      d.style.left=(Math.random()*100)+'vw';
      d.style.background=colors[Math.floor(Math.random()*colors.length)];
      d.style.transform=`rotate(${Math.random()*360}deg)`;
      document.body.appendChild(d); setTimeout(()=>d.remove(),900);
    }
    if(Date.now()<end) requestAnimationFrame(frame);
  })();
}