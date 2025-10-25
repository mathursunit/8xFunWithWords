import { fireConfetti } from '../assets/confetti.js';
const $ = s => document.querySelector(s);
const VERSION = (window.AppVersion && window.AppVersion.version) || "0.0.0";
const BUILD = (window.AppVersion && window.AppVersion.build) || 0;
const verBadge = $('#verBadge'); if (verBadge) verBadge.textContent = `v${VERSION} · ${BUILD}`;

const BOARDS=8, TRIES=15;
let active=0, viewingBoard=0;
let answers=new Array(BOARDS).fill('APPLE');
let guesses=Array.from({length:BOARDS},()=>[]);
let boardSolved=Array(BOARDS).fill(false);

const toast=$('#toast'), scrim=$('#scrim');
$('#toastClose').addEventListener('click', ()=>{toast.classList.add('hidden');scrim.classList.add('hidden');});
scrim.addEventListener('click', ()=>{toast.classList.add('hidden');scrim.classList.add('hidden');});
document.addEventListener('keydown', e=>{ if(e.key==='Escape' && !toast.classList.contains('hidden')){toast.classList.add('hidden');scrim.classList.add('hidden');}});
function showToast({title='Info', html=''}){ $('#toastTitle').textContent=title; $('#toastBody').innerHTML=html; toast.classList.remove('hidden'); scrim.classList.remove('hidden'); }

$('#statsLink').addEventListener('click', e=>{e.preventDefault(); const s=stats(); showToast({title:'Stats', html:`<p><strong>Today’s Stats</strong></p><p>Solved: ${s.solved}/8<br/>Total tries used: ${s.tries}</p>`});});
$('#aboutLink').addEventListener('click', e=>{e.preventDefault(); showToast({title:'About', html:`Disclaimer: This is a fun project to learn coding and has no commercial value. All rights are with the amazing Britannica only.`});});

// Boards
const elBoards = $('#boards');
function buildBoards(){
  elBoards.innerHTML='';
  for(let b=0;b<BOARDS;b++){
    const wrap=document.createElement('div'); wrap.className='board'; wrap.dataset.board=b;
    wrap.innerHTML=`<h3>Board ${b+1}</h3><div class="grid" id="grid-${b}"></div>`;
    elBoards.appendChild(wrap);
    const grid=wrap.querySelector('.grid');
    for(let r=0;r<TRIES;r++){ for(let c=0;c<5;c++){ const t=document.createElement('div'); t.className='tile tile--ghost'; grid.appendChild(t);} }
  }
}

// Navigator
function wireNavigator(){
  document.querySelectorAll('.nav-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{ const b=parseInt(btn.dataset.b,10); focusBoard(b,true); });
  });
  updateNavUI();
}
function focusBoard(b){ viewingBoard=Math.max(0,Math.min(BOARDS-1,b)); updateNavUI(); scrollToBoard(viewingBoard); }
function updateNavUI(){ document.querySelectorAll('.nav-btn').forEach((btn,i)=>{ btn.classList.toggle('current', i===viewingBoard); btn.classList.toggle('solved', !!boardSolved[i]); }); }
function markBoardSolved(b){ boardSolved[b]=true; updateNavUI(); persist(); }
function scrollToBoard(b){ const el=document.querySelector(`[data-board="${b}"]`); if(!el) return; el.scrollIntoView({behavior:'smooth',block:'center',inline:'center'}); }

// Keyboard (onscreen)
const row1="QWERTYUIOP".split(''), row2="ASDFGHJKL".split(''), row3="ZXCVBNM".split('');
function buildKeyboard(){
  const r1=$('#kbRow1'), r2=$('#kbRow2'), r3=$('#kbRow3'); r1.innerHTML=r2.innerHTML=r3.innerHTML='';
  row1.forEach(ch=>addKey(r1,ch)); row2.forEach(ch=>addKey(r2,ch));
  addKey(r3,'ENTER','wide'); row3.forEach(ch=>addKey(r3,ch)); addKey(r3,'⌫','');
}
function addKey(row,label,cls=''){ const b=document.createElement('button'); b.className='kb-key '+cls; b.textContent=label; b.dataset.k=label; row.appendChild(b); b.addEventListener('click',()=>handleKey(label)); }

// Physical keyboard
(function attachPhysicalKeyboard(){
  const isTypingInto = el => el && (el.tagName==='INPUT'||el.tagName==='TEXTAREA'||el.isContentEditable);
  window.addEventListener('keydown', (e)=>{
    if(isTypingInto(document.activeElement)) return;
    if(e.ctrlKey||e.metaKey||e.altKey) return;
    const k=e.key;
    if(/^[1-8]$/.test(k)){ focusBoard(parseInt(k,10)-1,true); e.preventDefault(); return; }
    if(k==='Backspace'){ handleKey('⌫'); e.preventDefault(); return; }
    if(k==='Enter'){ handleKey('ENTER'); e.preventDefault(); return; }
    if(/^[a-z]$/i.test(k)){ handleKey(k.toUpperCase()); e.preventDefault(); return; }
  }, {passive:false});
})();

// Render helpers
function paintRow(b,r,letters,colors=null){
  const grid=document.querySelector(`#grid-${b}`); const start=r*5;
  for(let i=0;i<5;i++){ const t=grid.children[start+i];
    t.textContent=letters[i]||''; t.classList.remove('tile--ghost','tile--correct','tile--present','tile--absent');
    t.classList.add(colors?('tile--'+colors[i]):'tile--ghost');
  }
}
function mirrorEverywhere(r,letters){ for(let b=0;b<BOARDS;b++) paintRow(b,r,letters,null); }
function score(guess,ans){
  const res=Array(5).fill('absent'), used=Array(5).fill(false);
  for(let i=0;i<5;i++){ if(guess[i]===ans[i]){res[i]='correct'; used[i]=true;} }
  for(let i=0;i<5;i++){ if(res[i]==='correct') continue; const ch=guess[i]; let hit=-1;
    for(let j=0;j<5;j++){ if(!used[j] && ans[j]===ch){ hit=j; break; } }
    if(hit>-1){ res[i]='present'; used[hit]=true; }
  }
  return res;
}

// Input buffer
let buf=[];
function handleKey(k){
  if(k==='ENTER'){ submit(); return; }
  if(k==='⌫'){ buf.pop(); renderCurrent(); return; }
  if(/^[A-Z]$/.test(k) && buf.length<5){ buf.push(k); renderCurrent(); }
}
function renderCurrent(){
  const rowIdx=guesses[active].length;
  const letters=(buf.join('')+'     ').slice(0,5).split('');
  paintRow(active,rowIdx,letters,null);
}
function submit(){
  if(buf.length!==5) return;
  const guess=buf.join('');
  if(!window.__valid || !window.__valid.includes(guess)){
    const grid=document.querySelector(`#grid-${active}`); const start=guesses[active].length*5;
    for(let i=0;i<5;i++) grid.children[start+i].style.borderColor='#ef4444';
    setTimeout(()=>{for(let i=0;i<5;i++) grid.children[start+i].style.borderColor='var(--tile-b)';},600);
    return;
  }
  const rowIdx=guesses[active].length, letters=guess.split('');
  mirrorEverywhere(rowIdx,letters);
  const colors=score(letters,answers[active]); paintRow(active,rowIdx,letters,colors);
  guesses[active].push(guess);
  if(colors.every(s=>s==='correct')){ markBoardSolved(active); fireConfetti(); active=Math.min(active+1,BOARDS-1);
    for(let r=0;r<guesses[active].length;r++){ const g=guesses[active][r].toUpperCase().split(''); const cs=score(g,answers[active]); paintRow(active,r,g,cs); } }
  buf=[]; renderCurrent(); persist();
}

// Daily rotation from valid_words.txt at 8AM ET
function dayIndexET(){
  const now=new Date(); const utcMs=now.getTime()+now.getTimezoneOffset()*60000; const etMs=utcMs-4*3600000;
  const et=new Date(etMs); if(et.getHours()<8) et.setDate(et.getDate()-1);
  const epoch=new Date('2024-01-01T08:00:00-05:00').getTime();
  return Math.floor((et.getTime()-epoch)/(24*60*60*1000));
}
async function loadAnswers(){
  try{
    const res=await fetch('assets/valid_words.txt',{cache:'no-store'});
    const txt=await res.text();
    const list=txt.split(/\r?\n/).map(s=>s.trim()).filter(Boolean).map(s=>s.toUpperCase());
    window.__valid=list;
    const start=(dayIndexET()*8) % Math.max(8, list.length-8);
    answers=list.slice(start,start+8);
  }catch(e){
    window.__valid=['APPLE','BRAIN','CRANE','SUGAR','AMBER','SPICE','CROWN','FLAME','CHAIR','PLANT','GRAPH','SMILE','PROUD','STORM','PATCH','WRIST'];
    answers=window.__valid.slice(0,8);
  }
}

// Persistence
const LS_KEY='fww-v2-progress';
function persist(){ localStorage.setItem(LS_KEY, JSON.stringify({answers,guesses,active,boardSolved})); }
function restore(){
  const s=localStorage.getItem(LS_KEY); if(!s) return;
  try{ const d=JSON.parse(s); answers=d.answers||answers; guesses=d.guesses||guesses; active=d.active||0; boardSolved=d.boardSolved||boardSolved;
    for(let b=0;b<BOARDS;b++){ for(let r=0;r<guesses[b].length;r++){ const g=guesses[b][r].toUpperCase().split(''); mirrorEverywhere(r,g); const cs=score(g,answers[b]); paintRow(b,r,g,cs);} }
    updateNavUI();
  }catch{}
}

// Stats
function stats(){ let solved=0, tries=0; for(let b=0;b<BOARDS;b++){ const idx=guesses[b].findIndex(g=>g.toUpperCase()===answers[b]); if(idx>-1){solved++; tries+=idx+1;} else tries+=guesses[b].length; } return {solved,tries}; }

(async function init(){ buildBoards(); wireNavigator(); buildKeyboard(); await loadAnswers(); restore(); })();
