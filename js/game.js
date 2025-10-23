
document.addEventListener("DOMContentLoaded", () => {
  try {
    (function () {
      const VERSION = "1745";
      const ANSWERS = (window.WORDS || []).slice(0, 8);
      const MAX_ROWS = 15;
      const WORD_LEN = 5;
      let activeBoard = 0;
      const submittedGuesses = [];
      const state = ANSWERS.map(() => ({ rows: Array(MAX_ROWS).fill(""), attempt: 0, solved: false, invalidRow: -1 }));
      const boardsEl = document.getElementById("boards");
      const keyboardEl = document.getElementById("keyboard");
      const boardNumEl = document.getElementById("boardNum");
      const resetBtn = document.getElementById("resetBtn");

      // Build validation set (answers + external list)
      let validSet = new Set(ANSWERS.map((w) => w.toUpperCase()));
      if (location.protocol.startsWith("http")) {
        fetch("assets/valid_words.txt?v=" + VERSION)
          .then((r) => (r.ok ? r.text() : ""))
          .then((t) => { if (t) t.split(/\s+/).forEach((w) => w && validSet.add(w.toUpperCase())); })
          .catch(() => {});
      }

      buildBoards();
      buildKeyboard();
      updateLockUI();
      updateStatus();

      window.addEventListener("keydown", (e) => {
        const k = e.key;
        if (/^[a-z]$/i.test(k)) onLetter(k.toUpperCase());
        else if (k === "Backspace") onBackspace();
        else if (k === "Enter") onEnter();
      });

      resetBtn?.addEventListener("click", resetGame);

      function buildBoards() {
        boardsEl.innerHTML = "";
        for (let i = 0; i < 8; i++) {
          const b = document.createElement("section");
          b.className = "board" + (i === 0 ? "" : " locked");
          b.dataset.index = i;

          const title = document.createElement("div");
          title.className = "board-title";
          title.textContent = "Board " + (i + 1);
          b.appendChild(title);

          const grid = document.createElement("div");
          grid.className = "grid";
          for (let r = 0; r < MAX_ROWS; r++) {
            for (let c = 0; c < WORD_LEN; c++) {
              const tile = document.createElement("div");
              tile.className = "tile";
              grid.appendChild(tile);
            }
          }
          b.appendChild(grid);
          boardsEl.appendChild(b);
        }
      }

      function buildKeyboard() {
        keyboardEl.innerHTML = "";
        const rows = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
        const r1 = document.createElement("div"); r1.className = "krow";
        const r2 = document.createElement("div"); r2.className = "krow";
        const r3 = document.createElement("div"); r3.className = "krow";
        for (const ch of rows[0]) r1.appendChild(mkKey(ch));
        for (const ch of rows[1]) r2.appendChild(mkKey(ch));
        r3.appendChild(mkKey("ENTER","wide"));
        for (const ch of rows[2]) r3.appendChild(mkKey(ch));
        r3.appendChild(mkKey("⌫","wide"));
        keyboardEl.append(r1,r2,r3);
      }
      function mkKey(label, extra) {
        const key = mk("div", "key" + (extra ? " " + extra : ""), label);
        key.addEventListener("click", () => {
          if (label === "ENTER") onEnter();
          else if (label === "⌫") onBackspace();
          else onLetter(label);
        });
        return key;
      }
      function mk(tag, cls, txt) { const el = document.createElement(tag); el.className = cls; el.textContent = txt; return el; }
      function cur() { return state[activeBoard]; }
      function boardEl(idx) { return boardsEl.children[idx]; }

      function onLetter(ch) {
        const s = cur();
        if (s.solved) return;
        if (s.invalidRow === s.attempt) return;
        const row = s.rows[s.attempt] || "";
        if (row.length >= WORD_LEN) return;
        s.rows[s.attempt] = row + ch;
        renderRow(activeBoard, s.attempt);
      }
      function onBackspace() {
        const s = cur();
        if (s.solved) return;
        let row = s.rows[s.attempt] || "";
        if (!row.length) {
          if (s.invalidRow === s.attempt) { clearInvalidRow(activeBoard, s.attempt); s.invalidRow = -1; }
          return;
        }
        s.rows[s.attempt] = row.slice(0, -1);
        renderRow(activeBoard, s.attempt);
        if (s.invalidRow === s.attempt) { clearInvalidRow(activeBoard, s.attempt); s.invalidRow = -1; }
      }
      function onEnter() {
        const s = cur();
        if (s.solved) return;
        if (s.invalidRow === s.attempt) return;
        const guess = s.rows[s.attempt] || "";
        if (guess.length !== WORD_LEN) return;

        if (!validSet.has(guess.toUpperCase())) {
          markInvalidRow(activeBoard, s.attempt);
          s.invalidRow = s.attempt;
          return;
        }

        const answer = ANSWERS[activeBoard];
        const res = evalGuess(guess, answer);
        paintRow(activeBoard, s.attempt, res);
        updateKeyboard(guess, res);

        submittedGuesses.push(guess);

        if (guess === answer) {
          s.solved = true;
          if (activeBoard === 7) { if (window.launchConfetti) window.launchConfetti(); }
          else { unlockNext(); }
        } else {
          s.attempt++;
          if (s.attempt >= MAX_ROWS) { unlockNext(); }
        }
      }

      function markInvalidRow(bi, ri) {
        const b = boardEl(bi);
        const tiles = b.querySelectorAll(".tile");
        const start = ri * WORD_LEN;
        for (let i = 0; i < WORD_LEN; i++) tiles[start+i].classList.add("invalid");
      }
      function clearInvalidRow(bi, ri) {
        const b = boardEl(bi);
        const tiles = b.querySelectorAll(".tile");
        const start = ri * WORD_LEN;
        for (let i = 0; i < WORD_LEN; i++) tiles[start+i].classList.remove("invalid");
      }

      function evalGuess(guess, answer) {
        const res = Array(WORD_LEN).fill("absent");
        const counts = {};
        for (const ch of answer) counts[ch] = (counts[ch]||0)+1;
        for (let i=0;i<WORD_LEN;i++){ if (guess[i]===answer[i]) { res[i]="correct"; counts[guess[i]]--; } }
        for (let i=0;i<WORD_LEN;i++){
          if (res[i]==="correct") continue;
          const ch = guess[i];
          if ((counts[ch]||0)>0) { res[i]="present"; counts[ch]--; }
        }
        return res;
      }

      function paintRow(bi, ri, res) {
        const b = boardEl(bi);
        const tiles = b.querySelectorAll(".tile");
        const start = ri * WORD_LEN;
        const word = state[bi].rows[ri];
        for (let i=0;i<WORD_LEN;i++){
          const t = tiles[start+i];
          t.textContent = word[i];
          t.classList.add("flip");
          setTimeout(() => { t.classList.remove("flip"); t.classList.add(res[i]); }, 80 + i*30);
        }
      }
      function renderRow(bi, ri) {
        const b = boardEl(bi);
        const tiles = b.querySelectorAll(".tile");
        const start = ri * WORD_LEN;
        const word = state[bi].rows[ri] || "";
        for (let i=0;i<WORD_LEN;i++){
          const t = tiles[start+i];
          t.textContent = word[i] || "";
        }
      }

      function updateKeyboard(guess, res) {
        for (let i=0;i<WORD_LEN;i++){
          const ch = guess[i];
          const k = findKey(ch);
          if (!k) continue;
          if (res[i]==="correct") { k.classList.remove("present","absent"); k.classList.add("correct"); }
          else if (res[i]==="present" && !k.classList.contains("correct")) { k.classList.remove("absent"); k.classList.add("present"); }
          else if (!k.classList.contains("correct") && !k.classList.contains("present")) { k.classList.add("absent"); }
        }
      }
      function findKey(ch) { return Array.from(keyboardEl.querySelectorAll(".key")).find(k => k.textContent===ch) || null; }

      function unlockNext() {
        if (activeBoard < 7) {
          activeBoard++;
          const sNext = state[activeBoard];
          for (let g=0; g<Math.min(submittedGuesses.length, MAX_ROWS); g++){
            const guess = submittedGuesses[g];
            sNext.rows[g] = guess;
            const res = evalGuess(guess, ANSWERS[activeBoard]);
            paintRow(activeBoard, g, res);
            sNext.attempt = g+1;
          }
          updateLockUI();
          updateStatus();
          boardEl(activeBoard).scrollIntoView({ behavior:"smooth", block:"nearest" });
        }
      }
      function updateLockUI() {
        for (let i=0;i<8;i++){
          const b = boardEl(i);
          if (i <= activeBoard) b.classList.remove("locked"); else b.classList.add("locked");
        }
      }
      function updateStatus(){ boardNumEl.textContent = (activeBoard+1); }

      function resetGame() {
        submittedGuesses.length = 0;
        for (let i=0;i<state.length;i++) state[i] = { rows:Array(MAX_ROWS).fill(""), attempt:0, solved:false, invalidRow:-1 };
        activeBoard = 0;
        for (let i=0;i<8;i++){
          const b = boardEl(i);
          b.querySelectorAll(".tile").forEach(t => { t.className = "tile"; t.textContent = ""; });
        }
        buildKeyboard();
        updateLockUI();
        updateStatus();
      }
    })();
  } catch (err) {
    const status = document.getElementById("status");
    if (status) status.textContent = "Error loading game: " + err;
    console.error(err);
  }
});
