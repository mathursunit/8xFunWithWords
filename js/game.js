
(() => {
  'use strict';

  const VERSION = 'v2.1.10 · 1779';

  // Utilities --------------------------------------------------
  const $ = (sel, el=document) => el.querySelector(sel);
  const $$ = (sel, el=document) => [...el.querySelectorAll(sel)];
  const clamp = (n, a, b) => Math.max(a, Math.min(n, b));
  const todayETKey = () => {
    // 8AM ET rollover. ET = UTC-5 (standard) / UTC-4 (DST). We approximate by using IANA 'America/New_York' if supported.
    try {
      const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York',
        year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', hour12:false });
      const parts = Object.fromEntries(fmt.formatToParts(new Date()).map(p=>[p.type,p.value]));
      const h = parseInt(parts.hour,10);
      // date string YYYY-MM-DD for ET "game day" that flips at 08
      const d = `${parts.year}-${parts.month}-${parts.day}`;
      // shift if before 8 -> use previous day key
      const dt = new Date(`${d}T${h.toString().padStart(2,'0')}:00:00-05:00`); // offset hint; NY tz wins
      // compute key with rollover at 8
      let gameDate = new Date(dt);
      if (h < 8) gameDate.setDate(gameDate.getDate()-1);
      const y = gameDate.getFullYear();
      const m = (gameDate.getMonth()+1).toString().padStart(2,'0');
      const da = gameDate.getDate().toString().padStart(2,'0');
      return `${y}-${m}-${da}`;
    } catch(e){
      // fallback UTC (8am ET ~ 13:00/12:00 UTC). Use 13:00 UTC as cutoff.
      const now = new Date();
      const cutoff = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 13,0,0));
      const day = now.getTime() < cutoff.getTime() ? new Date(now.getTime()-86400000) : now;
      return `${day.getUTCFullYear()}-${(day.getUTCMonth()+1+'').padStart(2,'0')}-${(day.getUTCDate()+'').padStart(2,'0')}`;
    }
  };

  // DOM Mounts --------------------------------------------------
  const root = $('#app');
  const kb = $('#kb');
  const nav = $('#navRow');
  $('#verBadge').textContent = VERSION;

  // Theme toggle
  $('#lightBtn').onclick = () => { document.body.classList.remove('dark'); localStorage.setItem('theme','light'); };
  $('#darkBtn').onclick = () => { document.body.classList.add('dark'); localStorage.setItem('theme','dark'); };
  if(localStorage.getItem('theme')==='dark') document.body.classList.add('dark');

  // Toasts
  const openToast = id => { const el = $(id); if(el){ el.classList.add('show'); } };
  $('#statsLink').onclick = () => showStats();
  $('#aboutLink').onclick = () => openToast('#aboutToast');

  // Game State --------------------------------------------------
  const GAME_VERSION_KEY = '8xfww.v2.1.10';
  const gameDayKey = todayETKey();
  const STORE_KEY = `${GAME_VERSION_KEY}.${gameDayKey}`;

  const state = {
    answers: [],
    boardCount: 8,
    triesPerBoard: 15,
    board: 0, // active logical board index (sequence)
    rows: Array.from({length:8}, _=>[]), // arrays of string guesses
    evaluations: Array.from({length:8}, _=>[]), // 'green'|'yellow'|'gray' per letter
    solved: Array(8).fill(false),
  };

  // Local storage restore
  try{
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if(saved && saved.boardCount===state.boardCount){
      Object.assign(state, saved);
    }
  }catch{}

  // Build boards grid
  function buildBoards(){
    root.innerHTML = '';
    for(let i=0;i<state.boardCount;i++){
      const card = document.createElement('section');
      card.className = 'board';
      card.dataset.index = i;
      card.innerHTML = `<h3>Board ${i+1}</h3>
        <div class="tiles" aria-label="Board ${i+1} grid"></div>`;
      root.appendChild(card);

      const tiles = $('.tiles', card);
      const total = state.triesPerBoard*5;
      for(let t=0;t<total;t++){
        const div = document.createElement('div');
        div.className = 'tile';
        tiles.appendChild(div);
      }
    }
  }

  // Navigator row and keyboard
  function buildNav(){
    nav.innerHTML = '';
    for(let i=0;i<state.boardCount;i++){
      const p = document.createElement('div');
      p.className = 'pill';
      p.textContent = (i+1);
      p.dataset.index = i;
      p.onclick = () => { scrollToBoard(i); }
      nav.appendChild(p);
    }
    refreshNav();
  }
  function refreshNav(){
    const pills = $$('#navRow .pill');
    pills.forEach((p,idx)=>{
      p.classList.toggle('active', idx===state.board);
      p.classList.toggle('solved', !!state.solved[idx]);
    });
  }
  function scrollToBoard(i){
    const el = $(`.board[data-index="${i}"]`);
    if(el) el.scrollIntoView({behavior:'smooth', block:'center'});
  }
  function buildKeyboard(){
    const rows = [
      "Q W E R T Y U I O P".split(' '),
      "A S D F G H J K L".split(' '),
      ["ENTER","Z","X","C","V","B","N","M","⌫"]
    ];
    kb.innerHTML='';
    const navRow = document.createElement('div');
    navRow.className='row';
    // navigator in keyboard area? kept separate — already above.
    rows.forEach((arr,ri)=>{
      const r = document.createElement('div'); r.className='row';
      arr.forEach(k=>{
        const b = document.createElement('div'); b.className='key'; b.textContent=k;
        if(k==='ENTER'||k==='⌫') b.classList.add('wide','icon');
        b.onclick = () => simulateKey(k);
        r.appendChild(b);
      });
      kb.appendChild(r);
    });
  }
  function simulateKey(label){
    let key = label;
    if(label==='⌫') key = 'Backspace';
    if(label==='ENTER') key = 'Enter';
    window.dispatchEvent(new KeyboardEvent('keydown', { key }));
  }

  // Load words & decide answers
  async function loadWords(){
    const res = await fetch('assets/valid_words.txt?v=1779');
    const text = await res.text();
    const raw = text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
    // words to lower-case; dedupe
    const all = Array.from(new Set(raw.map(w=>w.toLowerCase()))).filter(w=>w.length===5);
    // Deterministic rotation by day index using a fixed base
    const base = new Date('2025-01-01T13:00:00Z'); // ~8AM ET
    const now = new Date();
    const dayIndex = Math.floor((now - base)/86400000);
    const start = (dayIndex*8) % all.length;
    const answers = [];
    for(let i=0;i<8;i++) answers.push(all[(start+i) % all.length]);
    state.answers = answers;
    // If restored answers differ (e.g., version change), reset
    if(!state.rows.some(r=>r.length)){
      save();
    }
  }

  // Rendering ---------------------------------------------------
  function render(){
    // Fill tiles for each board
    for(let b=0;b<state.boardCount;b++){
      const card = $(`.board[data-index="${b}"]`);
      const tiles = $$('.tile', card);
      const guesses = state.rows[b];
      for(let r=0;r<state.triesPerBoard;r++){
        const word = guesses[r] || '';
        for(let c=0;c<5;c++){
          const idx = r*5+c;
          const t = tiles[idx];
          t.textContent = word[c]?.toUpperCase() || '';
          // color rule: only color the active logical board (b==active) for submitted rows;
          // non-active boards keep 'neutral' even if the answer would match positions
          t.className = 'tile';
          if(word){
            if(b===state.board && state.evaluations[b][r]){
              t.classList.add(state.evaluations[b][r][c]);
            }else{
              t.classList.add('neutral'); // persist as gray/neutral
            }
          }
        }
      }
    }
    refreshNav();
  }

  // Input handling ----------------------------------------------
  let composing = ''; // current row composing input
  let invalidHold = false;

  function currentRowIndex(){
    return state.rows[state.board].length; // next row index is current composing row
  }
  function setComposing(s){
    composing = s.slice(0,5);
    drawComposing();
  }
  function drawComposing(){
    const card = $(`.board[data-index="${state.board}"]`);
    const tiles = $$('.tile', card);
    const r = currentRowIndex();
    for(let c=0;c<5;c++){
      const idx = r*5+c;
      const t = tiles[idx];
      t.textContent = composing[c]?.toUpperCase() || '';
      t.classList.remove('invalid');
      if(invalidHold) t.classList.add('invalid');
      if(composing[c]) t.classList.add('filled');
    }
  }

  function isAlpha(ch){ return /^[a-z]$/i.test(ch); }

  window.addEventListener('keydown', (e) => {
    if(e.metaKey || e.ctrlKey || e.altKey) return;
    const b = state.board;
    if(state.solved[b]) return; // solved, wait for next

    if(e.key==='Backspace'){
      if(invalidHold){ invalidHold=false; }
      setComposing(composing.slice(0,-1));
    } else if(e.key==='Enter'){
      if(composing.length===5){
        submit(composing.toLowerCase());
      }
    } else if(isAlpha(e.key)){
      if(composing.length<5){
        setComposing(composing + e.key.toLowerCase());
      }
    }
  });

  // Evaluate a guess
  function evalGuess(guess, answer){
    // build frequency
    const res = Array(5).fill('gray');
    const freq = {};
    for(const ch of answer) freq[ch]=(freq[ch]||0)+1;
    // greens
    for(let i=0;i<5;i++){
      if(guess[i]===answer[i]){
        res[i]='green';
        freq[guess[i]]--;
      }
    }
    // yellows
    for(let i=0;i<5;i++){
      if(res[i]==='green') continue;
      const ch = guess[i];
      if(freq[ch]>0){
        res[i]='yellow';
        freq[ch]--;
      }
    }
    return res;
  }

  function confettiBlast(){
    const c = document.createElement('canvas');
    c.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:60';
    document.body.appendChild(c);
    const ctx = c.getContext('2d');
    const dpr = window.devicePixelRatio||1;
    function resize(){ c.width=innerWidth*dpr; c.height=innerHeight*dpr; }
    resize(); window.addEventListener('resize', resize, {once:true});
    const parts = Array.from({length:140}, _=> ({
      x:Math.random()*c.width, y:-20*dpr, vy:2*dpr+Math.random()*5*dpr, vx:(Math.random()-0.5)*3*dpr,
      r:4*dpr+Math.random()*6*dpr, a:1, hue: ~~(200+Math.random()*160)
    }));
    let t=0;
    (function loop(){
      t++;
      ctx.clearRect(0,0,c.width,c.height);
      parts.forEach(p=>{
        p.x+=p.vx; p.y+=p.vy; p.a-=0.008;
        ctx.fillStyle = `hsla(${p.hue},95%,60%,${Math.max(p.a,0)})`;
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
      });
      if(t<180) requestAnimationFrame(loop); else c.remove();
    })();
  }

  async function submit(word){
    // dictionary check
    const allow = await ensureDict();
    if(!allow.has(word)){
      invalidHold = true;
      drawComposing();
      return;
    }
    invalidHold = false;

    // Apply to all boards visually (neutral on others)
    for(let b=0;b<state.boardCount;b++){
      if(state.rows[b].length < state.triesPerBoard){
        state.rows[b].push(word);
        state.evaluations[b].push(null); // placeholder until evaluated on its turn
      }
    }

    // Evaluate only current logical board
    const b = state.board;
    const rowIndex = state.rows[b].length-1;
    const ev = evalGuess(word, state.answers[b]);
    state.evaluations[b][rowIndex] = ev;

    if(word===state.answers[b]){
      state.solved[b]=true;
      confettiBlast();
      // advance to next board if any
      if(state.board < state.boardCount-1){
        state.board++;
      }
    } else {
      // if out of tries on the active board, stay but no op
    }

    composing='';
    save();
    render();
  }

  // Dictionary caching
  let dictPromise = null;
  function ensureDict(){
    if(dictPromise) return dictPromise;
    dictPromise = fetch('assets/valid_words.txt?v=1779').then(r=>r.text()).then(t=>{
      const s = new Set(t.split(/\r?\n/).map(x=>x.trim().toLowerCase()).filter(Boolean));
      return s;
    });
    return dictPromise;
  }

  // Save
  function save(){
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  }

  // Stats popup
  function showStats(){
    // Compute solved boards today & streak basics
    const solvedCount = state.solved.filter(Boolean).length;
    const solvedAll = solvedCount===state.boardCount;
    const STREAK_KEY = `${GAME_VERSION_KEY}.streak`;
    const BEST_KEY = `${GAME_VERSION_KEY}.best`;
    let streak = parseInt(localStorage.getItem(STREAK_KEY)||'0',10);
    let best = parseInt(localStorage.getItem(BEST_KEY)||'0',10);
    const FLAG_KEY = `${STORE_KEY}.complete`;
    if(solvedAll && !localStorage.getItem(FLAG_KEY)){
      streak = streak+1;
      best = Math.max(best, streak);
      localStorage.setItem(STREAK_KEY, String(streak));
      localStorage.setItem(BEST_KEY, String(best));
      localStorage.setItem(FLAG_KEY, '1');
    } else if(!solvedAll && !localStorage.getItem(FLAG_KEY)) {
      // do not modify streak
    }
    $('#statsBody').innerHTML = `
      <div><strong>Streak:</strong> ${streak}</div>
      <div><strong>Best:</strong> ${best}</div>
      <div><strong>Today:</strong> ${solvedCount} / ${state.boardCount} solved</div>
    `;
    openToast('#statsToast');
  }

  // Init --------------------------------------------------------
  buildBoards();
  buildNav();
  buildKeyboard();
  loadWords().then(()=>{
    render();
  });

})();
