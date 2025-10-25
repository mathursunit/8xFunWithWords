// 8× Fun With Words — compact build with visual tweaks
(() => {
  const VERSION = 'v2.1.11';
  const BUILD = 1779;
  const state = {
    boards: 8,
    tries: 15,
    wordLen: 5,
    activeBoard: 1,
    answers: [],
    guesses: Array.from({length:8}, () => []), // per-board guesses
    keyboardState: {}, // letter-> bad|warn|good
    theme: localStorage.getItem('theme') || 'light',
    seedDateKey: getDateKeyET()
  };

  // Theme
  document.documentElement.setAttribute('data-theme', state.theme);
  document.getElementById('lightBtn').classList.toggle('chip-on', state.theme==='light');
  document.getElementById('darkBtn').classList.toggle('chip-on', state.theme==='dark');
  document.getElementById('lightBtn').addEventListener('click',()=>setTheme('light'));
  document.getElementById('darkBtn').addEventListener('click',()=>setTheme('dark'));
  function setTheme(t){
    state.theme = t;
    localStorage.setItem('theme', t);
    document.documentElement.setAttribute('data-theme', t);
  }

  // Build boards
  const boardsEl = document.getElementById('boards');
  for(let b=1;b<=state.boards;b++){
    const board = document.createElement('div'); board.className='board'; board.id = `board-${b}`;
    board.innerHTML = `<h3>Board ${b}</h3><div class="grid" id="grid-${b}"></div>`;
    boardsEl.appendChild(board);
    const grid = board.querySelector('.grid');
    for(let r=0;r<state.tries;r++){
      for(let c=0;c<state.wordLen;c++){
        const t = document.createElement('div'); t.className='tile state-idle'; t.dataset.r=r; t.dataset.c=c;
        grid.appendChild(t);
      }
    }
  }

  // Navigator buttons
  const nav = document.getElementById('navButtons');
  nav.querySelectorAll('.nav-btn').forEach(btn=>{
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.board);
      document.getElementById(`board-${idx}`).scrollIntoView({behavior:'smooth', block:'center'});
      // do NOT change active board unless it's the next-in-sequence
    });
  });

  // Keyboard
  const row1 = "QWERTYUIOP".split('');
  const row2 = "ASDFGHJKL".split('');
  const row3 = ["ENTER","Z","X","C","V","B","N","M","⌫"];
  function buildRow(container, keys){
    keys.forEach(k => {
      const b = document.createElement('button');
      b.className = 'key' + ((k==='ENTER'||k==='⌫')?' wide':'');
      b.textContent = k;
      b.dataset.key = k;
      container.appendChild(b);
    });
  }
  buildRow(document.querySelector('.row1'), row1);
  buildRow(document.querySelector('.row2'), row2);
  buildRow(document.querySelector('.row3'), row3);

  document.getElementById('keyboard').addEventListener('click', e => {
    const k = e.target.closest('.key'); if(!k) return;
    handleKey(k.dataset.key);
  });
  window.addEventListener('keydown', e => {
    const k = e.key;
    if (/^[a-zA-Z]$/.test(k)) handleKey(k.toUpperCase());
    else if (k === 'Backspace') handleKey('⌫');
    else if (k === 'Enter') handleKey('ENTER');
  });

  // Toasts
  const toast = document.getElementById('toast');
  const toastBody = document.getElementById('toastBody');
  document.getElementById('toastClose').addEventListener('click', ()=> toast.classList.add('hide'));
  function showToast(html){ toastBody.innerHTML = html; toast.classList.remove('hide'); }

  document.getElementById('statsBtn').addEventListener('click', () => {
    const key = state.seedDateKey;
    const prog = JSON.parse(localStorage.getItem(`progress_${key}`)||'{}');
    const solved = Object.values(prog.solved||{}).filter(Boolean).length || 0;
    const triesUsed = Object.values(prog.tries||{}).reduce((a,b)=>a+(b||0),0);
    showToast(`<h4>Today’s Stats</h4><div>Solved: <b>${solved}/8</b></div><div>Total tries used: <b>${triesUsed}</b></div>`);
  });

  document.getElementById('aboutBtn').addEventListener('click', () => {
    showToast(`<h4>About</h4><p>Disclaimer: This is a fun project to learn coding and has no commercial value. All rights are with the amazing Britannica only.</p>`);
  });

  // Answers loader (daily rotation at 8AM ET)
  const fallback = ["APPLE","BRAIN","CRANE","DELTA","EAGER","FORGE","GRASS","HONEY",
                    "IVORY","JELLY","KNIFE","LEMON","MANGO","NINJA","OLIVE","PIZZA"];
  async function loadAnswers(){
    let words = [];
    try{
      const res = await fetch('assets/valid_words.txt', {cache:'no-store'});
      const txt = await res.text();
      words = txt.split(/[\r\n]+/).map(w=>w.trim().toUpperCase()).filter(Boolean);
    }catch(e){
      words = fallback;
    }
    // pick slice by day index
    const dayIdx = getDayIndexET();
    const start = (dayIdx * 8) % Math.max(8, words.length);
    const slice = [];
    for(let i=0;i<8;i++) slice.push(words[(start+i) % words.length]);
    state.answers = slice;
  }

  // Progress
  function getStoreKey(){ return `progress_${state.seedDateKey}`; }
  function saveProgress(){
    const key = getStoreKey();
    const solved = {}; const tries = {};
    for(let i=1;i<=8;i++){
      solved[i] = isSolved(i);
      tries[i]  = state.guesses[i-1].length;
    }
    localStorage.setItem(key, JSON.stringify({solved, tries, answers: state.answers}));
  }
  function restoreProgress(){
    const key = getStoreKey();
    const data = JSON.parse(localStorage.getItem(key)||'{}');
    if(!data.answers || !Array.isArray(data.answers) || data.answers.length!==8) return;
    state.answers = data.answers;
    for(let b=1;b<=8;b++){
      const tries = data.tries?.[b] || 0;
      const solved = !!data.solved?.[b];
      // render any existing tries as grey on all boards
      for(let r=0;r<tries;r++){
        const word = state.guesses[b-1][r] || ''.padEnd(state.wordLen);
        renderRowGhost(r, word);
      }
      if(solved) markNavSolved(b);
    }
  }

  function nextActiveBoard(){
    for(let b=1;b<=8;b++){
      if(!isSolved(b)) return b;
    }
    return 8;
  }

  function isSolved(b){ return state.guesses[b-1]?.includes(state.answers[b-1]); }

  // Render helpers
  function getGrid(b){ return document.getElementById(`grid-${b}`); }
  function renderRow(b, r, word, colorsOnly){
    // active board colors
    word = (word||'').toUpperCase().padEnd(state.wordLen).slice(0,state.wordLen);
    const ans = state.answers[b-1];
    const grid = getGrid(b);
    for(let c=0;c<state.wordLen;c++){
      const tile = grid.children[r*state.wordLen + c];
      tile.textContent = word[c].trim();
      tile.className = 'tile state-idle';
    }
    if (!colorsOnly) return;
    const used = {}; for(const ch of ans) used[ch]=(used[ch]||0)+1;
    // greens first
    for(let c=0;c<state.wordLen;c++){
      const tile = grid.children[r*state.wordLen + c];
      const ch = word[c];
      if (ans[c]===ch){ tile.classList.replace('state-idle', 'state-good'); used[ch]--; }
    }
    // then yellows
    for(let c=0;c<state.wordLen;c++){
      const tile = grid.children[r*state.wordLen + c];
      const ch = word[c];
      if (tile.classList.contains('state-good')) continue;
      if (used[ch]>0){ tile.classList.replace('state-idle','state-warn'); used[ch]--; }
      else { tile.classList.replace('state-idle','state-bad'); }
    }
  }
  function renderRowGhost(r, word){
    for(let b=1;b<=8;b++){
      const grid = getGrid(b);
      for(let c=0;c<state.wordLen;c++){
        const tile = grid.children[r*state.wordLen + c];
        if(!tile.textContent) tile.textContent = (word||' ')[c]||'';
        // keep as idle grey
      }
    }
  }

  // Input buffer mirrors on all boards as ghost
  let buffer = '';
  function handleKey(k){
    const b = nextActiveBoard();
    state.activeBoard = b;
    highlightNav();
    if (/^[A-Z]$/.test(k)){
      if(buffer.length<state.wordLen){ buffer+=k; mirrorBuffer(); }
      return;
    }
    if (k==='⌫'){
      buffer = buffer.slice(0,-1); mirrorBuffer();
      return;
    }
    if (k==='ENTER'){
      if(buffer.length<state.wordLen) return;
      submitGuess(buffer);
      buffer=''; mirrorBuffer();
      return;
    }
  }
  function mirrorBuffer(){
    const r = state.guesses[state.activeBoard-1].length;
    // clear row r, then place buffer across all boards
    for(let b=1;b<=8;b++){
      const grid = getGrid(b);
      for(let c=0;c<state.wordLen;c++){
        const tile = grid.children[r*state.wordLen + c];
        tile.textContent = (buffer[c]||''); tile.className = 'tile state-idle';
      }
    }
  }

  async function submitGuess(word){
    const b = state.activeBoard;
    const r = state.guesses[b-1].length;
    state.guesses[b-1].push(word.toUpperCase());
    // render: active board colored, others stay grey
    renderRow(b, r, word, true);
    for(let bb=1;bb<=8;bb++){
      if (bb===b) continue;
      renderRow(bb, r, word, false);
    }
    // solved?
    if (word.toUpperCase()===state.answers[b-1]){
      markNavSolved(b); blastConfetti();
    }
    saveProgress();
  }

  function markNavSolved(b){
    document.querySelector(`.nav-btn[data-board="${b}"]`)?.classList.add('solved');
  }
  function highlightNav(){
    nav.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.board)===state.activeBoard);
    });
  }

  // Confetti (lightweight)
  const canvas = document.getElementById('confetti');
  const ctx = canvas.getContext('2d'); let pieces=[]; let raf;
  function resize(){ canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
  window.addEventListener('resize', resize); resize();
  function blastConfetti(){
    const colors = ['#24a148','#1a73e8','#dba21b','#ef4444'];
    for(let i=0;i<120;i++){
      pieces.push({
        x: canvas.width/2, y: canvas.height/3, r: Math.random()*6+3,
        dx: (Math.random()-0.5)*6, dy: Math.random()*-4-3,
        c: colors[Math.floor(Math.random()*colors.length)], a:1
      });
    }
    if(!raf) raf=requestAnimationFrame(tick);
    setTimeout(()=>{ pieces=[]; cancelAnimationFrame(raf); raf=null; }, 1200);
  }
  function tick(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    pieces.forEach(p => {
      p.x += p.dx; p.y += p.dy; p.dy += 0.15; p.a -= 0.01;
      ctx.globalAlpha = Math.max(p.a,0); ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
    });
    raf = requestAnimationFrame(tick);
  }

  // Date helpers (ET 8am cutoff)
  function getDateKeyET(){
    const et = new Date().toLocaleString('en-US',{timeZone:'America/New_York'});
    const d = new Date(et);
    // if before 8am ET, use previous day
    if (d.getHours() < 8){ d.setDate(d.getDate()-1); }
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    return `${y}${m}${day}`;
  }
  function getDayIndexET(){
    const et = new Date().toLocaleString('en-US',{timeZone:'America/New_York'});
    const d = new Date(et);
    if (d.getHours() < 8){ d.setDate(d.getDate()-1); }
    const epoch = new Date('2024-01-01T08:00:00-05:00'); // baseline at 8am ET
    const diff = Math.floor((d - epoch)/(24*60*60*1000));
    return Math.max(0,diff);
  }

  // Init
  (async () => {
    await loadAnswers();
    // render first empty row as ghost on all boards
    renderRowGhost(0, ''.padEnd(state.wordLen,' '));
    // activate first unsolved
    state.activeBoard = nextActiveBoard();
    highlightNav();
    // restore progress if any
    restoreProgress();
  })();

})();