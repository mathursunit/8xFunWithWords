
(() => {
  const VERSION = "v2.1.11";
  const BUILD = "1781";
  const BOARDS = 8;
  const TRIES = 15;
  const WORDLEN = 5;

  const qs = s => document.querySelector(s);
  const qsa = s => Array.from(document.querySelectorAll(s));

  const html = document.documentElement;
  function setTheme(mode){
    if(mode === 'dark') html.classList.add('dark'); else html.classList.remove('dark');
    localStorage.setItem('fww_theme', mode);
    qs('#themeLight').classList.toggle('active', mode!=='dark');
    qs('#themeDark').classList.toggle('active', mode==='dark');
  }
  setTheme(localStorage.getItem('fww_theme')||'light');
  qs('#themeLight').onclick = ()=>setTheme('light');
  qs('#themeDark').onclick = ()=>setTheme('dark');

  // Toast
  const toast = qs('#toast');
  const toastBody = qs('#toastBody');
  const toastClose = qs('#toastClose');
  const showToast = (html) => { toastBody.innerHTML = html; toast.classList.remove('hidden'); };
  const hideToast = () => toast.classList.add('hidden');
  toastClose.onclick = hideToast;
  toast.addEventListener('click', e => { if(e.target===toast) hideToast(); });

  // Stats/About
  function loadStats(){
    try{ return JSON.parse(localStorage.getItem('fww_stats'))||{}; }catch{ return {}; }
  }
  function saveStats(s){ localStorage.setItem('fww_stats', JSON.stringify(s)); }
  function openStats(){
    const s = loadStats();
    const today = s.today||{plays:0, solved:0, time:0};
    const html = `
      <div class="stats">
        <h4>Daily Stats</h4>
        <div class="statsRow"><span>Boards Solved</span><b>${today.solved||0} / ${BOARDS}</b></div>
        <div class="statsRow"><span>Tries Used</span><b>${s.triesUsed||0}</b></div>
        <div class="statsRow"><span>Current Streak</span><b>${s.streak||0}</b></div>
        <div class="statsRow"><span>Best Streak</span><b>${s.best||0}</b></div>
      </div>`;
    showToast(html);
  }
  qs('#statsBtn').onclick = openStats;
  qs('#aboutBtn').onclick = ()=> showToast(`<div class="aboutText">Disclaimer: This is a fun project to learn coding and has no commercial value. All rights are with the amazing Britannica only.</div>`);

  const boardsWrap = qs('#boardsWrap');
  const kb = qs('#keyboard');
  const pills = qs('#navPills');

  const boards = [];
  for(let b=0;b<BOARDS;b++){
    const el = document.createElement('section');
    el.className='board';
    el.innerHTML = `<h3>Board ${b+1}</h3><div class="grid" data-board="${b}"></div>`;
    boardsWrap.appendChild(el);
    const grid = el.querySelector('.grid');
    const rows = [];
    for(let r=0;r<TRIES;r++){
      const row = [];
      for(let c=0;c<WORDLEN;c++){
        const t = document.createElement('div'); t.className='tile neutral';
        row.push(t); grid.appendChild(t);
      }
      rows.push(row);
    }
    boards.push({el, grid, rows});
  }

  for(let i=0;i<BOARDS;i++){
    const p = document.createElement('button');
    p.className='navPill';
    p.textContent = i+1;
    p.title = `View Board ${i+1}`;
    p.addEventListener('click', ()=> setViewing(i));
    pills.appendChild(p);
  }

  const KB_ROWS = [
    "QWERTYUIOP".split(''),
    "ASDFGHJKL".split(''),
    ["ENTER","Z","X","C","V","B","N","M","⌫"]
  ];
  KB_ROWS.forEach((row, idx)=>{
    const r = document.createElement('div'); r.className='kRow';
    row.forEach(k=>{
      const b = document.createElement('div'); b.className='key'; b.textContent=k;
      if(k==='ENTER'||k==='⌫') b.classList.add('wide');
      b.addEventListener('click', ()=> onKey(k));
      r.appendChild(b);
    });
    kb.appendChild(r);
  });

  let WORDS = [];
  async function loadValid(){
    try{
      const res = await fetch('assets/valid_words.txt?v='+BUILD);
      const txt = await res.text();
      WORDS = txt.split(/\r?\n/).map(w=>w.trim()).filter(Boolean).map(w=>w.toLowerCase());
    }catch(e){ console.warn('valid_words load failed', e); }
  }

  function dayIndexET(){
    const et = new Date().toLocaleString('en-US', { timeZone:'America/New_York' });
    const d = new Date(et);
    d.setHours(8,0,0,0);
    const epoch = new Date('2025-01-01T08:00:00-05:00').getTime();
    return Math.floor((d.getTime()-epoch)/(24*3600*1000));
  }
  function todaysAnswers(valid){
    const idx = dayIndexET();
    const start = (idx*BOARDS) % valid.length;
    return valid.slice(start, start+BOARDS);
  }

  let active = 0;
  let viewing = 0;
  let answers = [];
  let guesses = Array.from({length:BOARDS},()=>[]);
  let cursor = 0;

  function keyForDay(){
    const et = new Date().toLocaleString('en-US', { timeZone:'America/New_York' });
    const d = new Date(et);
    return 'fww_'+d.toISOString().slice(0,10);
  }
  function saveProgress(){
    const data = { active, viewing, guesses, answers };
    localStorage.setItem(keyForDay(), JSON.stringify(data));
  }
  function loadProgress(){
    try{
      const raw = localStorage.getItem(keyForDay());
      if(!raw) return false;
      const data = JSON.parse(raw);
      active=data.active; viewing=data.viewing; guesses=data.guesses; answers=data.answers;
      return true;
    }catch{ return false; }
  }

  function setViewing(i){
    viewing = i;
    qsa('.navPill').forEach((p,idx)=> p.classList.toggle('activeView', idx===i));
    render();
    saveProgress();
  }

  function evalGuess(guess, ans){
    const res = Array(WORDLEN).fill('absent');
    const a = ans.split('');
    const g = guess.split('');
    for(let i=0;i<WORDLEN;i++) if(g[i]===a[i]){ res[i]='correct'; a[i]=null; g[i]=null; }
    for(let i=0;i<WORDLEN;i++) if(g[i]){
      const pos = a.indexOf(g[i]); if(pos>-1){ res[i]='present'; a[pos]=null; } else res[i]='absent';
    }
    return res;
  }

  function render(){
    for(let b=0;b<BOARDS;b++){
      const rows = boards[b].rows;
      const list = guesses[b];
      for(let r=0;r<TRIES;r++){
        const word = list[r] || ''.padEnd(WORDLEN);
        for(let c=0;c<WORDLEN;c++){
          const t = rows[r][c];
          t.textContent = word[c] && word[c]!==' ' ? word[c].toUpperCase() : '';
          t.className='tile neutral';
        }
      }
      if(b<active && list.length){
        const solvedRow = list.findIndex(w=>w===answers[b]);
        const rowIdx = solvedRow===-1? (list.length-1): solvedRow;
        if(rowIdx>=0){
          for(let c=0;c<WORDLEN;c++) boards[b].rows[rowIdx][c].classList.add('correct');
        }
      }
      if(b===active){
        for(let r=0;r<list.length;r++){
          const res = evalGuess(list[r], answers[b]);
          for(let c=0;c<WORDLEN;c++){
            boards[b].rows[r][c].classList.remove('neutral');
            boards[b].rows[r][c].classList.add(res[c]);
          }
        }
      }
    }
    qsa('.navPill').forEach((p,idx)=>{ p.classList.toggle('solved', idx<active); });
  }

  function ensureCurrentRow(){
    if(!guesses[active].length) guesses[active].push('');
  }

  function addLetter(ch){
    ensureCurrentRow();
    const row = guesses[active][guesses[active].length-1] || '';
    if(row.length>=WORDLEN) return;
    guesses[active][guesses[active].length-1]= row + ch;
    for(let b=0;b<BOARDS;b++) if(b!==active){
      if(!guesses[b].length) guesses[b].push('');
      const r = guesses[b][guesses[b].length-1];
      if(r.length<WORDLEN) guesses[b][guesses[b].length-1]= (r+ch).slice(0,WORDLEN);
    }
    render(); saveProgress();
  }

  function backspace(){
    ensureCurrentRow();
    const row = guesses[active][guesses[active].length-1] || '';
    if(!row) return;
    guesses[active][guesses[active].length-1]= row.slice(0,-1);
    for(let b=0;b<BOARDS;b++) if(b!==active){
      if(!guesses[b].length) continue;
      const r = guesses[b][guesses[b].length-1] || '';
      guesses[b][guesses[b].length-1]= r.slice(0,-1);
    }
    render(); saveProgress();
  }

  function submit(){
    ensureCurrentRow();
    const row = guesses[active][guesses[active].length-1] || '';
    if(row.length!==WORDLEN) return;
    if(!WORDS.includes(row)){
      // invalid guess
      smallConfetti(boards[active].el);
      return;
    }
    if(guesses[active].length<TRIES) guesses[active].push('');
    if(row===answers[active]){
      render();
      smallConfetti(boards[active].el);
      active = Math.min(active+1, BOARDS-1);
    }
    render(); saveProgress();
  }

  function onKey(k){
    if(k==='ENTER') return submit();
    if(k==='⌫') return backspace();
    if(/^[A-Z]$/.test(k)) return addLetter(k.toLowerCase());
  }

  document.addEventListener('keydown', (e)=>{
    if(e.metaKey||e.ctrlKey) return;
    if(e.key==='Enter') submit();
    else if(e.key==='Backspace') backspace();
    else if(/^[a-zA-Z]$/.test(e.key)) addLetter(e.key.toLowerCase());
  });

  (async function init(){
    try{
      await loadValid();
      if(!loadProgress() || !answers || !answers.length){
        answers = todaysAnswers(WORDS);
        guesses = Array.from({length:BOARDS},()=>[]);
        active = 0; viewing = 0;
      }
      setViewing(viewing);
      render();
    }catch(e){
      console.error(e);
    }
  })();
})();
