
import { fireConfetti } from '../assets/confetti.js';
const $ = s => document.querySelector(s);
const elBoards = $('#boards');
const navRow = $('#navRow');
const navNumbers = $('#navNumbers');
$('#verBadge').textContent = 'v2.1.12 · 1782';

// Toast controls
const toast = $('#toast'), scrim = $('#scrim');
$('#toastClose').addEventListener('click', () => {toast.classList.add('hidden'); scrim.classList.add('hidden');});
scrim.addEventListener('click', () => {toast.classList.add('hidden'); scrim.classList.add('hidden');});
document.addEventListener('keydown', e=>{ if(e.key==='Escape'){ toast.classList.add('hidden'); scrim.classList.add('hidden'); }});
function showToast({title, html}){
  $('#toastTitle').textContent = title;
  $('#toastBody').innerHTML = html;
  toast.classList.remove('hidden'); scrim.classList.remove('hidden');
}

// core state
const BOARDS=8, TRIES=15;
let active=0;
let answers=new Array(BOARDS).fill('APPLE');
let guesses=Array.from({length:BOARDS},()=>[]);

function dayIndex(){
  const utc = Date.now();
  const et = utc - 4*3600000;
  return Math.floor(et/86400000);
}
async function loadWordList(){
  try{
    const res = await fetch('assets/valid_words.txt');
    const txt = await res.text();
    const list = txt.split(/\r?\n/).map(s=>s.trim()).filter(Boolean).map(s=>s.toUpperCase());
    window.__valid = list;
    const start = (dayIndex()*8) % Math.max(8, list.length-8);
    answers = list.slice(start, start+8);
  }catch(e){
    window.__valid = ['APPLE','BRAIN','CRANE','SUGAR','AMBER','SPICE','CROWN','FLAME'];
    answers = window.__valid.slice(0,8);
  }
}

function buildBoards(){
  elBoards.innerHTML='';
  for(let b=0;b<BOARDS;b++){
    const wrap=document.createElement('div');
    wrap.className='board';
    wrap.innerHTML=`<h3>Board ${b+1}</h3><div class="grid" id="grid-${b}"></div>`;
    elBoards.appendChild(wrap);
    const grid=wrap.querySelector('.grid');
    for(let r=0;r<TRIES;r++){
      for(let c=0;c<5;c++){
        const t=document.createElement('div'); t.className='tile tile--ghost'; grid.appendChild(t);
      }
    }
  }
}

function buildNav(){
  navRow.innerHTML=''; navNumbers.innerHTML='';
  for(let i=0;i<BOARDS;i++){
    const btn=document.createElement('button');
    btn.className='navbtn'+(i===active?' active':'');
    btn.textContent=i+1;
    btn.addEventListener('click',()=>{document.querySelectorAll('.navbtn').forEach(b=>b.classList.remove('active')); btn.classList.add('active');});
    navRow.appendChild(btn);
    const n=document.createElement('button'); n.className='kb-key'; n.textContent=i+1;
    n.addEventListener('click',()=>{document.querySelectorAll('.navbtn').forEach(b=>b.classList.remove('active')); navRow.children[i].classList.add('active');});
    navNumbers.appendChild(n);
  }
  updateSolvedButtons();
}
function updateSolvedButtons(){
  for(let i=0;i<BOARDS;i++){
    const solved = guesses[i].some(g=>g.toUpperCase()===answers[i]);
    navRow.children[i].classList.toggle('solved', solved);
  }
}

function paintRow(b,r,letters,colors=null){
  const grid = document.querySelector(`#grid-${b}`);
  const start=r*5;
  for(let i=0;i<5;i++){
    const t=grid.children[start+i];
    t.textContent = letters[i] || '';
    t.classList.remove('tile--ghost','tile--correct','tile--present','tile--absent');
    t.classList.add(colors?('tile--'+colors[i]):'tile--ghost');
  }
}
function mirrorGuessEverywhere(rowIdx, letters){
  for(let b=0;b<BOARDS;b++) paintRow(b,rowIdx,letters,null);
}
function score(guess, ans){
  const res=Array(5).fill('absent'); const used=Array(5).fill(false);
  for(let i=0;i<5;i++){ if(guess[i]===ans[i]){res[i]='correct'; used[i]=true;} }
  for(let i=0;i<5;i++){
    if(res[i]==='correct') continue;
    const ch=guess[i]; let pos=-1;
    for(let j=0;j<5;j++){ if(!used[j] && ans[j]===ch){pos=j;break;} }
    if(pos>-1){res[i]='present'; used[pos]=true;}
  }
  return res;
}

// keyboard
const row1='QWERTYUIOP'.split(''), row2='ASDFGHJKL'.split(''), row3='ZXCVBNM'.split('');
const kb1=$('#kbRow1'), kb2=$('#kbRow2'), kb3=$('#kbRow3');
function buildKeyboard(){
  kb1.innerHTML=''; kb2.innerHTML=''; kb3.innerHTML='';
  row1.forEach(ch=>addKey(kb1,ch));
  row2.forEach(ch=>addKey(kb2,ch));
  addKey(kb3,'ENTER','wide');
  row3.forEach(ch=>addKey(kb3,ch));
  addKey(kb3,'⌫','');
}
function addKey(row,label,cls=''){ const b=document.createElement('button'); b.className='kb-key '+cls; b.textContent=label; row.appendChild(b); b.addEventListener('click',()=>key(label)); }

let current=[];
function key(k){
  if(k==='ENTER'){ submit(); return; }
  if(k==='⌫'){ current.pop(); renderCurrent(); return; }
  if(/^[A-Z]$/.test(k) && current.length<5){ current.push(k); renderCurrent(); }
}
function renderCurrent(){
  const rowIdx = guesses[active].length;
  const letters = (current.join('')+'     ').slice(0,5).split('');
  paintRow(active,rowIdx,letters,null);
}
function submit(){
  if(current.length!==5) return;
  const guess=current.join('');
  if(!window.__valid.includes(guess)){
    const grid=document.querySelector(`#grid-${active}`);
    const start=guesses[active].length*5;
    for(let i=0;i<5;i++) grid.children[start+i].style.borderColor='#ef4444';
    setTimeout(()=>{for(let i=0;i<5;i++) grid.children[start+i].style.borderColor='var(--tile-b)';},600);
    return;
  }
  const rowIdx=guesses[active].length;
  const letters=guess.split('');
  mirrorGuessEverywhere(rowIdx,letters);
  const colors=score(letters,answers[active]);
  paintRow(active,rowIdx,letters,colors);
  guesses[active].push(guess);
  if(colors.every(s=>s==='correct')){ updateSolvedButtons(); fireConfetti(); active++; }
  current=[]; renderCurrent(); persist();
}

// persistence
const LS_KEY='fww-v2-progress';
function persist(){ localStorage.setItem(LS_KEY, JSON.stringify({answers,guesses,active})); }
function restore(){
  const s=localStorage.getItem(LS_KEY); if(!s) return;
  try{ const d=JSON.parse(s); answers=d.answers||answers; guesses=d.guesses||guesses; active=d.active||0;
    for(let b=0;b<BOARDS;b++){ for(let r=0;r<guesses[b].length;r++){ const g=guesses[b][r].toUpperCase().split(''); mirrorGuessEverywhere(r,g); const c=score(g,answers[b]); paintRow(b,r,g,c); } }
    updateSolvedButtons();
  }catch{}
}

// stats/about
function stats(){ let solved=0, tries=0; for(let b=0;b<BOARDS;b++){ const idx=guesses[b].findIndex(g=>g.toUpperCase()===answers[b]); if(idx>-1){solved++; tries+=idx+1;} else tries+=guesses[b].length; } return {solved,tries}; }
document.querySelector('#statsLink').addEventListener('click',e=>{e.preventDefault(); const s=stats(); showToast({title:'Stats', html:`<p><strong>Today’s Stats</strong></p><p>Solved: ${s.solved}/8<br/>Total tries used: ${s.tries}</p>`});});
document.querySelector('#aboutLink').addEventListener('click',e=>{e.preventDefault(); showToast({title:'About', html:`Disclaimer: This is a fun project to learn coding and has no commercial value. All rights are with the amazing Britannica only.`});});

(async function init(){ buildBoards(); buildNav(); buildKeyboard(); await loadWordList(); restore(); })();
