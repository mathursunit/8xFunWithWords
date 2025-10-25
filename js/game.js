
(() => {
  const VERSION = 'v2.1.14';
  const BUILD = 1784;
  const LS_KEY = 'fww2_state_v1';
  const WORDS_URL = 'assets/valid_words.txt?v=1784';

  const state = {
    theme: localStorage.getItem('theme') || 'light',
    activeBoard: 0, // 0..7
    solved: Array(8).fill(false),
    tries: Array(8).fill(0),
    rows: Array.from({length:8}, () => []), // array of guesses per board
    current: '', // current input letters
    answers: Array(8).fill('APPLE'), // default; replaced from list per day
  };

  // Apply theme
  function applyTheme(t){
    state.theme = t;
    document.documentElement.setAttribute('data-theme', t === 'dark' ? 'dark' : 'light');
    document.getElementById('lightBtn').setAttribute('aria-pressed', t==='light'?'true':'false');
    document.getElementById('darkBtn').setAttribute('aria-pressed', t==='dark'?'true':'false');
    localStorage.setItem('theme', t);
  }

  // Make daily answers from the list: 8 per day chunk
  async function loadAnswers() {
    try {
      const res = await fetch(WORDS_URL);
      const text = await res.text();
      const list = text.split(/\r?\n/).map(s=>s.trim().toUpperCase()).filter(Boolean);
      // 8-am ET rotation
      const now = new Date();
      const utc = now.getTime() + now.getTimezoneOffset()*60000;
      // ET offset (UTC-5 or UTC-4 for DST). Keep simple: assume -4 (most of year).
      const et = new Date(utc - 4*3600000);
      const base = new Date(Date.UTC(2024,0,1,13,0,0)); // Jan 1 2024 8am ET
      const dayIndex = Math.floor((et - base)/86400000);
      const start = (dayIndex*8) % Math.max(list.length,8);
      const today = [];
      for (let i=0;i<8;i++) today.push(list[(start+i)%list.length]);
      state.answers = today;
    } catch(e) {
      console.error('words load failed', e);
      state.answers = Array(8).fill('APPLE');
    }
  }

  // Build boards UI
  function buildBoards(){
    const host = document.getElementById('boards');
    host.innerHTML='';
    for(let b=0;b<8;b++){
      const sec = document.createElement('div');
      sec.className='board';
      sec.innerHTML = `<h3>Board ${b+1}</h3>
        <div class="grid" id="grid-${b}"></div>`;
      host.appendChild(sec);

      // build grid (15 rows × 5 cols)
      const grid = sec.querySelector('.grid');
      for(let r=0;r<15;r++){
        for(let c=0;c<5;c++){
          const t=document.createElement('div');
          t.className='tile ghost';
          t.id=`t-${b}-${r}-${c}`;
          t.textContent='';
          grid.appendChild(t);
        }
      }
    }
  }

  // Build nav & keyboard
  function buildNavAndKeyboard(){
    // Nav
    const nav = document.getElementById('navBar');
    nav.innerHTML = '';
    for(let i=0;i<8;i++){
      const n = document.createElement('button');
      n.className='navbtn';
      n.textContent = String(i+1);
      n.addEventListener('click', () => {
        // scroll to board but do not advance sequence
        document.getElementById(`grid-${i}`).scrollIntoView({behavior:'smooth', block:'center'});
      });
      n.dataset.idx=i;
      nav.appendChild(n);
    }

    // Keyboard
    const keysTop = 'Q W E R T Y U I O P'.split(' ');
    const keysMid = 'A S D F G H J K L'.split(' ');
    const keysBot = 'Z X C V B N M'.split(' ');
    const kb = document.getElementById('kb');
    kb.innerHTML='';

    const numberRow = document.createElement('div');
    numberRow.className='kb-row';
    for(let i=0;i<8;i++){
      const k=document.createElement('div');
      k.className='key';
      k.textContent=String(i+1);
      k.addEventListener('click',()=> jumpTo(i));
      numberRow.appendChild(k);
    }
    kb.appendChild(numberRow);

    const row1 = document.createElement('div');
    row1.className='kb-row';
    keysTop.forEach(ch=>{
      const k=document.createElement('div');
      k.className='key'; k.textContent=ch;
      k.addEventListener('click',()=> typeChar(ch));
      row1.appendChild(k);
    });
    kb.appendChild(row1);

    const row2 = document.createElement('div');
    row2.className='kb-row';
    keysMid.forEach(ch=>{
      const k=document.createElement('div');
      k.className='key'; k.textContent=ch;
      k.addEventListener('click',()=> typeChar(ch));
      row2.appendChild(k);
    });
    kb.appendChild(row2);

    const row3 = document.createElement('div');
    row3.className='kb-row';
    const enter=document.createElement('div');
    enter.className='key wide'; enter.textContent='ENTER';
    enter.addEventListener('click', submitGuess);
    row3.appendChild(enter);
    keysBot.forEach(ch=>{
      const k=document.createElement('div');
      k.className='key'; k.textContent=ch;
      k.addEventListener('click',()=> typeChar(ch));
      row3.appendChild(k);
    });
    const back=document.createElement('div');
    back.className='key back'; back.textContent='⌫';
    back.addEventListener('click', backspace);
    row3.appendChild(back);
    kb.appendChild(row3);
  }

  function jumpTo(i){
    document.getElementById(`grid-${i}`).scrollIntoView({behavior:'smooth', block:'center'});
  }

  function updateNav(){
    const nav = document.getElementById('navBar').children;
    for(let i=0;i<8;i++){
      const el = nav[i];
      el.classList.toggle('active', i === state.activeBoard);
      el.classList.toggle('solved', !!state.solved[i]);
    }
  }

  function renderBoard(b){
    const rows = state.rows[b];
    const answer = state.answers[b];
    for(let r=0;r<15;r++){
      const word = rows[r] || '';
      for(let c=0;c<5;c++){
        const t = document.getElementById(`t-${b}-${r}-${c}`);
        const ch = word[c] || '';
        t.textContent = ch;
        t.classList.remove('good','ok','bad');
        // ghost (just show gray letters) for future boards
        if (r < rows.length){
          if (state.solved[b] || b < state.activeBoard){
            // colorized only when this board has been reached (or solved)
            const a = answer[c];
            if (ch){
              if (a === ch) t.classList.add('good');
              else if (answer.includes(ch)) t.classList.add('ok');
              else t.classList.add('bad');
            }
          } else {
            t.classList.add('ghost');
          }
        } else {
          t.classList.add('ghost');
        }
      }
    }
  }

  function renderAll(){
    for(let b=0;b<8;b++) renderBoard(b);
    updateNav();
  }

  function typeChar(ch){
    if (state.solved[state.activeBoard]) return;
    if (state.current.length<5){
      state.current += ch;
      placeCurrent();
    }
  }
  function backspace(){
    if (!state.current) return;
    state.current = state.current.slice(0,-1);
    placeCurrent();
  }
  function placeCurrent(){
    const b = state.activeBoard;
    const r = state.rows[b].length;
    for(let c=0;c<5;c++){
      const t = document.getElementById(`t-${b}-${r}-${c}`);
      t.textContent = state.current[c]||'';
      t.classList.remove('good','ok','bad');
      t.classList.add('ghost');
    }
  }

  function submitGuess(){
    const word = state.current;
    if (word.length!==5) return;
    const b = state.activeBoard;
    state.rows[b].push(word);
    state.tries[b]++;
    state.current='';
    // solved?
    if (word === state.answers[b]){
      state.solved[b]=true;
      // advance active board (sequence)
      if (b<7) state.activeBoard=b+1;
    }
    renderAll();
    save();
  }

  // keyboard -> physical input
  window.addEventListener('keydown', (e)=>{
    if (document.getElementById('toast') && !document.getElementById('toast').classList.contains('hidden')) return;
    const k=e.key;
    if (/^[a-zA-Z]$/.test(k)) typeChar(k.toUpperCase());
    else if (k==='Backspace') backspace();
    else if (k==='Enter') submitGuess();
    else if (/^[1-8]$/.test(k)) jumpTo(+k-1);
  });

  // Save/Load
  function save(){
    localStorage.setItem(LS_KEY, JSON.stringify({
      theme: state.theme, activeBoard: state.activeBoard,
      solved: state.solved, tries: state.tries, rows: state.rows, answers: state.answers
    }));
  }
  function load(){
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    try{ 
      const s = JSON.parse(raw);
      Object.assign(state, s);
    }catch{}
  }

  // Stats & About
  function showStats(){
    const solved = state.solved.filter(Boolean).length;
    const totalTries = state.tries.reduce((a,b)=>a+b,0);
    showToast(`<h3>Today's Stats</h3>
      <p>Solved: <strong>${solved}/8</strong></p>
      <p>Total tries used: <strong>${totalTries}</strong></p>`);
  }
  function showAbout(){
    showToast(`<h3>About</h3>
      <p>Disclaimer: This is a fun project to learn coding and has no commercial value.
      All rights are with the amazing Britannica only.</p>`);
  }
  function showToast(html){
    const t = document.getElementById('toast');
    document.getElementById('toastContent').innerHTML = html;
    t.classList.remove('hidden');
  }
  function hideToast(){ document.getElementById('toast').classList.add('hidden'); }

  // Wire buttons
  document.addEventListener('click', (e)=>{
    if (e.target.id==='statsBtn') showStats();
    else if (e.target.id==='aboutBtn') showAbout();
    else if (e.target.id==='toastClose') hideToast();
    else if (e.target.id==='lightBtn') applyTheme('light');
    else if (e.target.id==='darkBtn') applyTheme('dark');
  });

  // Init
  (async function init(){
    load();
    applyTheme(state.theme);
    await loadAnswers();
    buildBoards();
    buildNavAndKeyboard();
    renderAll();
    // ensure bottom spacing (content not hidden by sticky area)
    const spacer = document.createElement('div');
    spacer.style.height='220px';
    document.querySelector('main').appendChild(spacer);
  })();
})();
