
(() => {
  const VERSION = window.__APP_VERSION__ || 'v?';
  const BUILD = window.__APP_BUILD__ || 0;

  // DOM helpers
  const $ = (s, el=document) => el.querySelector(s);
  const $$ = (s, el=document) => [...el.querySelectorAll(s)];

  // Badge
  (function setBadge(){
    const b = $('#verBadge');
    if (b) b.textContent = `${VERSION} · ${BUILD}`;
  })();

  // Theme
  const themeKey = 'xfww.theme';
  const setTheme = t => { document.documentElement.classList.toggle('dark', t==='dark'); localStorage.setItem(themeKey,t); };
  $('#themeLight').onclick=()=>setTheme('light');
  $('#themeDark').onclick=()=>setTheme('dark');
  setTheme(localStorage.getItem(themeKey)||'light');

  // Params
  const BOARDS=8, TRIES=15, WORDLEN=5;

  // Day key (8 AM ET)
  function etKey(){
    const now = new Date();
    const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    if (et.getHours() < 8) et.setDate(et.getDate()-1);
    return et.toISOString().slice(0,10);
  }

  // Persistence keys
  const NS='xfww.v2.1.9';
  const DAY = etKey();

  // State
  let answers = Array(BOARDS).fill('APPLE');
  const state = {
    day: DAY,
    active: 0,
    guesses: Array.from({length:BOARDS}, ()=>[]), // per-board arrays of words
    solved: Array(BOARDS).fill(false),
    keyboard: {}
  };

  // Save/Load
  function save(){
    const root = JSON.parse(localStorage.getItem(NS)||'{}');
    root[DAY] = { active: state.active, guesses: state.guesses, solved: state.solved, keyboard: state.keyboard };
    localStorage.setItem(NS, JSON.stringify(root));
  }
  function load(){
    const root = JSON.parse(localStorage.getItem(NS)||'{}');
    const d = root[DAY];
    if (d){
      state.active = d.active||0;
      state.guesses = d.guesses||state.guesses;
      state.solved  = d.solved||state.solved;
      state.keyboard= d.keyboard||state.keyboard;
    }
  }

  // Build UI
  function build(){
    const boards = $('#boards'); boards.innerHTML='';
    for(let b=0;b<BOARDS;b++){
      const sec = document.createElement('section'); sec.className='board'; sec.dataset.idx=b;
      sec.innerHTML = `<h3>Board ${b+1}</h3>`;
      const grid = document.createElement('div'); grid.className='grid';
      for(let r=0;r<TRIES;r++){
        for(let c=0;c<WORDLEN;c++){
          const t = document.createElement('div'); t.className='tile'; grid.appendChild(t);
        }
      }
      sec.appendChild(grid); boards.appendChild(sec);
    }
    // nav
    const nav = $('#navRow'); nav.innerHTML='';
    for(let i=0;i<BOARDS;i++){
      const btn = document.createElement('button'); btn.className='navBtn'; btn.textContent=String(i+1); btn.dataset.idx=i;
      btn.onclick = ()=>{ view=i; paint(); };
      nav.appendChild(btn);
    }
    // keyboard
    const k = $('#keyboard'); k.innerHTML='';
    const add = (arr)=>arr.forEach(l=>{
      const b=document.createElement('button'); b.className='key'; b.textContent=l; b.dataset.key=l;
      if(l==='ENTER'||l==='⌫') b.classList.add('wide'); if(l==='⌫') b.dataset.key='BACK';
      b.onclick=()=>press(l);
      k.appendChild(b);
    });
    add(['Q','W','E','R','T','Y','U','I','O','P']);
    add(['A','S','D','F','G','H','J','K','L']);
    add(['ENTER','Z','X','C','V','B','N','M','⌫']);
  }

  // Word list -> answers
  async function loadAnswers(){
    const res = await fetch(`assets/valid_words.txt?v=${BUILD}`);
    const txt = await res.text();
    const list = txt.split(/\r?\n/).map(s=>s.trim()).filter(Boolean).map(s=>s.toUpperCase());
    const dayIndex = Math.floor(new Date(DAY).getTime()/86400000);
    const start = (dayIndex * 8) % Math.max(1, list.length-8);
    answers = list.slice(start, start+8).map(w=>w.toUpperCase());
  }

  // Input buffer spans across all boards (visual)
  let buffer = '';
  function press(k){
    if(k==='ENTER'){ submit(); return; }
    if(k==='⌫' || k==='BACK'){ buffer = buffer.slice(0,-1); paint(); return; }
    if(k.length===1 && /^[A-Z]$/.test(k)){ buffer = (buffer + k).slice(0,WORDLEN); paint(); }
  }
  window.addEventListener('keydown',e=>{
    if(e.key==='Enter') return press('ENTER');
    if(e.key==='Backspace') return press('⌫');
    if(/^[a-z]$/i.test(e.key)) return press(e.key.toUpperCase());
  });

  function colorFor(answer, word, i){
    const ch = word[i];
    if(answer[i]===ch) return 'G';
    if(answer.includes(ch)) return 'Y';
    return 'B';
  }

  // Paint everything
  let view = 0;
  function paint(){
    // nav
    $$('.navBtn').forEach((b,i)=>{
      b.classList.toggle('active', i===view);
      b.classList.toggle('solved', state.solved[i]);
    });

    // tiles
    for(let b=0;b<BOARDS;b++){
      const grid = $(`.board[data-idx="${b}"] .grid`);
      [...grid.children].forEach(t=>{ t.className='tile'; t.textContent=''; });
      // fill rows with existing guesses across this board's grid
      const rows = state.guesses[b].length;
      for(let r=0;r<rows;r++){
        const w = state.guesses[b][r];
        for(let i=0;i<WORDLEN;i++){
          const t = grid.children[r*WORDLEN+i];
          t.textContent = w[i]||'';
          if(b===state.active || state.solved[b]){
            t.classList.add(colorFor(answers[b], w, i));
          }else{
            t.classList.add('faded');
          }
        }
      }
      // typing buffer appears on the next row for *all* boards as faded
      const row = rows;
      if(row<15){
        for(let i=0;i<WORDLEN;i++){
          const t = grid.children[row*WORDLEN+i];
          t.textContent = buffer[i]||'';
          if(!(b===state.active || state.solved[b])) t.classList.add('faded');
        }
      }
    }
  }

  function submit(){
    if(buffer.length!==WORDLEN) return;
    const w = buffer; buffer='';
    const b = state.active;
    if(state.solved[b]) return;
    // Accept only 5-letter (we're using the big list as answers; you can add rejection UI later)
    state.guesses[b].push(w);
    // check
    if(w===answers[b]){
      state.solved[b]=true;
      const btn = $(`.navBtn[data-idx="${b}"]`); if(btn) btn.classList.add('solved');
      window.fwwConfetti();
      if(b<BOARDS-1) state.active=b+1, view=b+1;
    }else{
      // ensure we don't exceed TRIES (implicitly handled by render buffer)
    }
    save(); paint();
  }

  // Stats toast
  function showStats(){
    const solved = state.solved.filter(Boolean).length;
    const body = $('#toastBody');
    body.innerHTML = `<div class="stats">
      <div class="row"><span>Date (ET)</span><b>${DAY}</b></div>
      <div class="row"><span>Solved</span><b>${solved}/8</b></div>
      <div class="row"><span>Version</span><b>${VERSION} · ${BUILD}</b></div>
    </div>`;
    $('#toast').classList.remove('hidden');
  }
  $('#statsLink').addEventListener('click', (e)=>{ e.preventDefault(); showStats(); });
  $('#toastClose').addEventListener('click', ()=>$('#toast').classList.add('hidden'));

  // Init
  (async function(){
    build();
    load();
    await loadAnswers();
    // If first board has no guesses yet, prep for typing UX
    if((state.guesses[state.active]||[]).length===0) {}
    paint();
  })();
})();
