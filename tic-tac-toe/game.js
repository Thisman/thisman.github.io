// ---------- DOM ----------
      const screenSettings = document.getElementById('screenSettings');
      const screenGame = document.getElementById('screenGame');
      const screenResults = document.getElementById('screenResults');

      const rowsInput = document.getElementById('rowsInput');
      const colsInput = document.getElementById('colsInput');
      const winInput  = document.getElementById('winInput');
      const swapLimitInput = document.getElementById('swapLimitInput');

      const rowsVal = document.getElementById('rowsVal');
      const colsVal = document.getElementById('colsVal');
      const winVal  = document.getElementById('winVal');
      const swapLimitVal = document.getElementById('swapLimitVal');

      const rowsPlus = document.getElementById('rowsPlus');
      const rowsMinus = document.getElementById('rowsMinus');
      const colsPlus = document.getElementById('colsPlus');
      const colsMinus = document.getElementById('colsMinus');
      const winPlus = document.getElementById('winPlus');
      const winMinus = document.getElementById('winMinus');
      const swapLimitPlus = document.getElementById('swapLimitPlus');
      const swapLimitMinus = document.getElementById('swapLimitMinus');

      const modePvpBtn = document.getElementById('modePvp');
      const modePvcBtn = document.getElementById('modePvc');

      const startBtn = document.getElementById('startBtn');
      const preset33 = document.getElementById('preset33');
      const preset55 = document.getElementById('preset55');
      const preset1010 = document.getElementById('preset1010');
      const preset1515 = document.getElementById('preset1515');
      const settingsToast = document.getElementById('settingsToast');

      const boardEl = document.getElementById('board');
      const turnLabel = document.getElementById('turnLabel');
      const movesLabel = document.getElementById('movesLabel');
      const goalLabel = document.getElementById('goalLabel');
      const afterFullStatus = document.getElementById('afterFullStatus');
      const afterFullLabel = document.getElementById('afterFullLabel');

      const gameToast = document.getElementById('gameToast');

      const drawBtn = document.getElementById('drawBtn');
      const restartBtn = document.getElementById('restartBtn');

      const resultTitle = document.getElementById('resultTitle');
      const resultSubtitle = document.getElementById('resultSubtitle');
      const winnerKV = document.getElementById('winnerKV');
      const movesKV = document.getElementById('movesKV');
      const swapsKV = document.getElementById('swapsKV');
      const sizeKV = document.getElementById('sizeKV');
      const winKV = document.getElementById('winKV');

      const playAgainBtn = document.getElementById('playAgainBtn');
      const backToSettingsBtn = document.getElementById('backToSettingsBtn');

      // ---------- State ----------
      let R = 10, C = 10, K = 5;
      let board = [];       // board[r][c] = "", "X", "O"
      let cells = [];       // cell elements, flat
      let current = "X";
      let moves = 0;

      let swapFirst = null; // {r,c} or null

      let swapsTotal = 0;

      // Swap cooldown (blocked cells for the NEXT move only)
      // When a swap happens on move m, we set blockedMoveNumber = m+1 and remember the two cell indices.
      let blockedMoveNumber = 0;     // move number for which the block is active (1-based), 0 = none
      let blockedSwapCells = null;   // [idx1, idx2] or null

      // Game mode
      let gameMode = 'pvp'; // 'pvp' | 'pvc'
      const HUMAN = 'X';
      const CPU = 'O';
      let computerBusy = false;

      // After board is full: swap limits per player (configured in settings)
      let swapLimitAfterFull = 6; // per player
      let swapsAfterFullX = 0;
      let swapsAfterFullO = 0;

      let gameOver = false;
      const RESULT_DELAY_MS = 3000;
      let endGameTimer = null;

      function cancelPendingEndGame() {
        if (endGameTimer) {
          clearTimeout(endGameTimer);
          endGameTimer = null;
        }
      }

      // ---------- Helpers ----------
      const clampInt = (v, min, max) => {
        const n = Number(v);
        if (!Number.isFinite(n)) return min;
        return Math.max(min, Math.min(max, Math.trunc(n)));
      };

      const showScreen = (which) => {
        screenSettings.classList.toggle('active', which === 'settings');
        screenGame.classList.toggle('active', which === 'game');
        screenResults.classList.toggle('active', which === 'results');
      };

      const toast = (el, type, text) => {
        el.classList.remove('good','warn','bad');
        if (type) el.classList.add(type);
        el.textContent = text;
        el.style.display = 'block';
      };

      const hideToast = (el) => {
        el.style.display = 'none';
      };

      const idx = (r,c) => r*C + c;

      const inBounds = (r,c) => r>=0 && r<R && c>=0 && c<C;

      const other = (p) => (p === "X" ? "O" : "X");

      const isBoardFull = () => {
        for (let r=0; r<R; r++) {
          for (let c=0; c<C; c++) if (!board[r][c]) return false;
        }
        return true;
      };

      const remainingSwapsAfterFull = (sym) => {
        if (!isBoardFull()) return Infinity;
        const used = (sym === "X") ? swapsAfterFullX : swapsAfterFullO;
        return Math.max(0, swapLimitAfterFull - used);
      };

      function maybeAutoPassOrDrawAfterFull() {
        if (!isBoardFull()) return;

        const rx = remainingSwapsAfterFull("X");
        const ro = remainingSwapsAfterFull("O");
        if (rx === 0 && ro === 0) {
          endGame({ winner: null, isDraw: true, reason: 'Доска заполнена, и лимит swap после заполнения исчерпан у обоих игроков.' });
          return;
        }

        if (remainingSwapsAfterFull(current) === 0) {
          const prev = current;
          current = other(current);
          clearSwapSelection();
          updateHUD();
          toast(gameToast, 'warn', `У игрока ${prev} закончились свапы. Ход переходит игроку ${current}.`);
        }
      }

      const isBlockedSwapCell = (r,c) => {
        if (!blockedSwapCells) return false;
        const nextMoveNumber = moves + 1;
        if (blockedMoveNumber !== nextMoveNumber) return false;
        const i = idx(r,c);
        return blockedSwapCells[0] === i || blockedSwapCells[1] === i;
      };

      function updateBlockedSwapUI() {
        // Block is only relevant in the current (upcoming) move
        const active = blockedSwapCells && blockedMoveNumber === (moves + 1);
        for (let i=0; i<cells.length; i++) {
          cells[i].classList.toggle('blockedSwap', !!(active && (blockedSwapCells[0] === i || blockedSwapCells[1] === i)));
        }
      }

      function setGameMode(newMode) {
        gameMode = newMode;
        if (modePvpBtn) modePvpBtn.classList.toggle('active', gameMode === 'pvp');
        if (modePvcBtn) modePvcBtn.classList.toggle('active', gameMode === 'pvc');
      }

      const isAdjacent = (a,b) => {
        const dr = Math.abs(a.r - b.r);
        const dc = Math.abs(a.c - b.c);
        // 8-neighborhood adjacency (including diagonals)
        return (dr <= 1 && dc <= 1) && !(dr === 0 && dc === 0);
      };

      // Check win lines that MUST include (r,c). Works because place affects one cell; swap affects two.
      function checkWinFrom(r, c, sym) {
        if (!inBounds(r,c)) return false;
        if (board[r][c] !== sym) return false;

        const dirs = [
          {dr:1, dc:0},   // vertical
          {dr:0, dc:1},   // horizontal
          {dr:1, dc:1},   // diag \
          {dr:1, dc:-1},  // diag /
        ];

        for (const d of dirs) {
          let count = 1;

          // forward
          let rr = r + d.dr, cc = c + d.dc;
          while (inBounds(rr,cc) && board[rr][cc] === sym) {
            count++;
            rr += d.dr; cc += d.dc;
          }

          // backward
          rr = r - d.dr; cc = c - d.dc;
          while (inBounds(rr,cc) && board[rr][cc] === sym) {
            count++;
            rr -= d.dr; cc -= d.dc;
          }

          if (count >= K) return true;
        }
        return false;
      }

      function findWinLineFrom(r, c, sym) {
        // Returns an array of K positions that form a winning line including (r,c), or null.
        if (!inBounds(r,c)) return null;
        if (board[r][c] !== sym) return null;

        const dirs = [
          {dr:1, dc:0},   // vertical
          {dr:0, dc:1},   // horizontal
          {dr:1, dc:1},   // diag \
          {dr:1, dc:-1},  // diag /
        ];

        for (const d of dirs) {
          // move to the start of the contiguous run (backward)
          let sr = r, sc = c;
          while (inBounds(sr - d.dr, sc - d.dc) && board[sr - d.dr][sc - d.dc] === sym) {
            sr -= d.dr;
            sc -= d.dc;
          }

          // collect the whole run forward
          const run = [];
          let rr = sr, cc = sc;
          while (inBounds(rr,cc) && board[rr][cc] === sym) {
            run.push({r: rr, c: cc});
            rr += d.dr;
            cc += d.dc;
          }

          if (run.length >= K) {
            // compute index of (r,c) inside run
            let idxOrig = 0;
            rr = sr; cc = sc;
            while (!(rr === r && cc === c) && idxOrig < run.length) {
              rr += d.dr;
              cc += d.dc;
              idxOrig++;
            }
            if (idxOrig >= run.length) continue;

            // pick a window of size K that includes idxOrig
            let start = idxOrig - (K - 1);
            if (start < 0) start = 0;
            const maxStart = run.length - K;
            if (start > maxStart) start = maxStart;
            return run.slice(start, start + K);
          }
        }
        return null;
      }

      function clearSwapSelection() {
        swapFirst = null;
        for (const el of cells) {
          el.classList.remove('selected','swapCandidate');
        }
      }

      function markSwapCandidates(a) {
        // Highlight legal second cells for swap from a.
        for (const el of cells) el.classList.remove('swapCandidate');

        const deltas = [
          // orthogonal
          {dr:1,dc:0},{dr:-1,dc:0},{dr:0,dc:1},{dr:0,dc:-1},
          // diagonal
          {dr:1,dc:1},{dr:1,dc:-1},{dr:-1,dc:1},{dr:-1,dc:-1}
        ];
        for (const d of deltas) {
          const r = a.r + d.dr;
          const c = a.c + d.dc;
          if (!inBounds(r,c)) continue;
          if (isBlockedSwapCell(a.r, a.c) || isBlockedSwapCell(r, c)) continue;
          const v1 = board[a.r][a.c];
          const v2 = board[r][c];
          if (v1 && v2 && v1 !== v2) {
            cells[idx(r,c)].classList.add('swapCandidate');
          }
        }
      }

      function updateHUD() {
        turnLabel.textContent = current;
        turnLabel.style.color = (current === "X") ? 'var(--mark-x)' : 'var(--mark-o)';
        movesLabel.textContent = String(moves);
        goalLabel.textContent = `${R}×${C}, N=${K}`;
        updateBlockedSwapUI();

        if (afterFullStatus && afterFullLabel) {
          const full = isBoardFull();
          afterFullStatus.style.display = full ? 'flex' : 'none';
          if (full) {
            const rx = remainingSwapsAfterFull("X");
            const ro = remainingSwapsAfterFull("O");
            afterFullLabel.innerHTML = `<span style="color:var(--mark-x)">X</span>: ${rx} · <span style="color:var(--mark-o)">O</span>: ${ro}`;
          }
        }
      }

      function paintCell(r,c) {
        const el = cells[idx(r,c)];
        const v = board[r][c];

        el.classList.remove('empty','x','o');
        if (!v) {
          el.textContent = '·';
          el.classList.add('empty');
        } else if (v === "X") {
          el.textContent = 'X';
          el.classList.add('x');
        } else {
          el.textContent = 'O';
          el.classList.add('o');
        }
      }

      function paintAll() {
        for (let r=0; r<R; r++) {
          for (let c=0; c<C; c++) paintCell(r,c);
        }
        updateBlockedSwapUI();
      }

      function endGame({ winner, isDraw, reason, winningCells }) {
        gameOver = true;
        cancelPendingEndGame();
        clearSwapSelection();

        if (Array.isArray(winningCells) && winningCells.length) {
          for (const p of winningCells) {
            const el = cells[idx(p.r, p.c)];
            if (el) el.classList.add('win');
          }
        }

        let title = '';
        let subtitle = '';

        if (isDraw) {
          title = 'Ничья';
          subtitle = reason || 'Игра завершена без победителя.';
        } else {
          title = `Победа: ${winner}`;
          subtitle = reason || 'Собрана выигрышная линия.';
        }

        resultTitle.textContent = title;
        resultSubtitle.textContent = subtitle;

        winnerKV.textContent = isDraw ? '—' : winner;
        movesKV.textContent = String(moves);
        swapsKV.textContent = String(swapsTotal);
        sizeKV.textContent = `${R}×${C}`;
        winKV.textContent = String(K);

        endGameTimer = setTimeout(() => {
          endGameTimer = null;
          showScreen('results');
        }, RESULT_DELAY_MS);
      }

      function validateSettings() {
        const r = clampInt(rowsInput.value, 3, 15);
        const c = clampInt(colsInput.value, 3, 15);

        // Maximum feasible K:
        // Horizontal lines can be up to C, vertical up to R, diagonals up to min(R,C).
        // If diagonals are allowed (they are), the global max is still max(R,C).
        const maxK = Math.max(r, c);

        let k = clampInt(winInput.value, 3, maxK);
        let swapLimit = clampInt(swapLimitInput.value, 0, 99);

        // reflect clamped values back
        rowsInput.value = String(r);
        colsInput.value = String(c);
        winInput.value = String(k);
        swapLimitInput.value = String(swapLimit);

        // sync stepper UI
        if (rowsVal) rowsVal.textContent = String(r);
        if (colsVal) colsVal.textContent = String(c);
        if (winVal)  winVal.textContent  = String(k);
        if (swapLimitVal) swapLimitVal.textContent = String(swapLimit);

        if (rowsPlus)  rowsPlus.disabled  = r >= 15;
        if (rowsMinus) rowsMinus.disabled = r <= 3;
        if (colsPlus)  colsPlus.disabled  = c >= 15;
        if (colsMinus) colsMinus.disabled = c <= 3;

        if (winPlus)  winPlus.disabled  = k >= maxK;
        if (winMinus) winMinus.disabled = k <= 3;

        if (swapLimitPlus)  swapLimitPlus.disabled  = swapLimit >= 99;
        if (swapLimitMinus) swapLimitMinus.disabled = swapLimit <= 0;

        return { r, c, k, maxK, swapLimit };
      }

      function startGameFromSettings() {
        cancelPendingEndGame();
        hideToast(settingsToast);
        const { r, c, k, maxK, swapLimit } = validateSettings();

        if (k < 3 || k > maxK) {
          toast(settingsToast, 'bad', `Некорректное N. Для поля ${r}×${c} допустимо N от 3 до ${maxK}.`);
          return;
        }

        R = r; C = c; K = k;
        current = "X";
        moves = 0;
        swapFirst = null;
        gameOver = false;
        swapsTotal = 0;
        blockedMoveNumber = 0;
        blockedSwapCells = null;
        swapLimitAfterFull = swapLimit;
        swapsAfterFullX = 0;
        swapsAfterFullO = 0;

        // init board
        board = Array.from({length:R}, () => Array.from({length:C}, () => ""));

        // build grid
        boardEl.innerHTML = '';
        boardEl.style.gridTemplateColumns = `repeat(${C}, 42px)`;
        // Adjust cell size if very large boards to keep usability
        // (still minimalistic; we only shrink slightly as needed)
        const size = (C >= 20 || R >= 20) ? 34 : (C >= 14 || R >= 14) ? 38 : 42;
        boardEl.style.gridTemplateColumns = `repeat(${C}, ${size}px)`;
        boardEl.style.gridAutoRows = `${size}px`;

        cells = new Array(R*C);
        for (let rr=0; rr<R; rr++) {
          for (let cc=0; cc<C; cc++) {
            const el = document.createElement('div');
            el.className = 'cell empty';
            el.textContent = '·';
            el.setAttribute('role', 'button');
            el.setAttribute('tabindex', '0');
            el.dataset.r = String(rr);
            el.dataset.c = String(cc);
            el.addEventListener('click', onCellClick);
            el.addEventListener('keydown', (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                el.click();
              }
            });
            boardEl.appendChild(el);
            cells[idx(rr,cc)] = el;
          }
        }

        clearSwapSelection();
        gameToast.className = 'toast';
        gameToast.textContent = 'Клик по пустой клетке — Place. Клик по занятой — Swap (затем по соседней, включая диагональ, с другой меткой).';
        updateHUD();
        paintAll();
        showScreen('game');
      }

      function listEmptyCells() {
        const res = [];
        for (let r=0; r<R; r++) {
          for (let c=0; c<C; c++) if (!board[r][c]) res.push({r,c});
        }
        return res;
      }

      function listLegalSwaps() {
        // Return unique swap pairs {a:{r,c}, b:{r,c}}
        const res = [];
        const deltas = [
          {dr:1,dc:0},{dr:0,dc:1},{dr:1,dc:1},{dr:1,dc:-1},
          {dr:-1,dc:0},{dr:0,dc:-1},{dr:-1,dc:-1},{dr:-1,dc:1},
        ];
        const seen = new Set();
        for (let r=0; r<R; r++) {
          for (let c=0; c<C; c++) {
            const v1 = board[r][c];
            if (!v1) continue;
            for (const d of deltas) {
              const rr = r + d.dr, cc = c + d.dc;
              if (!inBounds(rr,cc)) continue;
              const v2 = board[rr][cc];
              if (!v2 || v1 === v2) continue;
              if (isBlockedSwapCell(r,c) || isBlockedSwapCell(rr,cc)) continue;
              const i1 = idx(r,c);
              const i2 = idx(rr,cc);
              const key = i1 < i2 ? `${i1}-${i2}` : `${i2}-${i1}`;
              if (seen.has(key)) continue;
              seen.add(key);
              res.push({ a:{r,c}, b:{r:rr, c:cc} });
            }
          }
        }
        return res;
      }

      function evalSwapOutcome(a, b, mover) {
        const v1 = board[a.r][a.c];
        const v2 = board[b.r][b.c];
        // apply
        board[a.r][a.c] = v2;
        board[b.r][b.c] = v1;

        const opp = other(mover);
        const affected = [a,b];
        const moverCells = [];
        const oppCells = [];
        for (const p of affected) {
          const v = board[p.r][p.c];
          if (v === mover) moverCells.push(p);
          else if (v === opp) oppCells.push(p);
        }

        let moverWins = false;
        for (const p of moverCells) {
          if (checkWinFrom(p.r, p.c, mover)) { moverWins = true; break; }
        }

        let oppWins = false;
        if (!moverWins) {
          for (const p of oppCells) {
            if (checkWinFrom(p.r, p.c, opp)) { oppWins = true; break; }
          }
        }

        // revert
        board[a.r][a.c] = v1;
        board[b.r][b.c] = v2;

        return { moverWins, oppWins };
      }

      

      function queueComputerTurn() {
        if (computerBusy) return;
        computerBusy = true;
        toast(gameToast, '', 'Ход компьютера…');
        setTimeout(() => {
          computerBusy = false;
          doComputerTurn();
        }, 220);
      }

      function doComputerTurn() {
        if (gameOver) return;
        if (gameMode !== 'pvc') return;
        if (current !== CPU) return;

        if (isBoardFull() && remainingSwapsAfterFull(CPU) === 0) {
          maybeAutoPassOrDrawAfterFull();
          if (!gameOver && gameMode === 'pvc' && current === CPU) queueComputerTurn();
          return;
        }

        clearSwapSelection();
        const move = chooseComputerMove();
        if (!move) return;

        if (move.type === 'place') doPlace(move.r, move.c);
        else doSwap(move.a, move.b);
      }

      // ---------- Move Logic ----------
      function afterMoveCheckAndAdvance(affectedPositions, mover) {
        // Winner policy:
        // 1) If mover has a line after the move -> mover wins.
        // 2) Else if opponent has a line (possible due to swap) -> opponent wins (mover blundered).
        // 3) Else continue.
        const opp = other(mover);

        const moverCells = [];
        const oppCells = [];

        for (const p of affectedPositions) {
          const v = board[p.r][p.c];
          if (v === mover) moverCells.push(p);
          else if (v === opp) oppCells.push(p);
        }

        for (const p of moverCells) {
          if (checkWinFrom(p.r, p.c, mover)) {
            const line = findWinLineFrom(p.r, p.c, mover);
            endGame({ winner: mover, isDraw: false, reason: `Игрок ${mover} собрал линию длины ${K}.`, winningCells: line || undefined });
            return;
          }
        }

        for (const p of oppCells) {
          if (checkWinFrom(p.r, p.c, opp)) {
            const line = findWinLineFrom(p.r, p.c, opp);
            endGame({ winner: opp, isDraw: false, reason: `Swap открыл победу игроку ${opp}.`, winningCells: line || undefined });
            return;
          }
        }

        // Continue
        current = opp;
        updateHUD();

        maybeAutoPassOrDrawAfterFull();

        if (!gameOver && gameMode === 'pvc' && current === CPU) {
          queueComputerTurn();
        }
      }

      function doPlace(r, c) {
        if (isBoardFull()) {
          toast(gameToast, 'warn', 'Доска заполнена: после заполнения доступен только swap (пока не исчерпан лимит).');
          return;
        }
        if (board[r][c]) {
          toast(gameToast, 'warn', 'Эта клетка уже занята. В режиме Place можно ходить только в пустую.');
          return;
        }
        board[r][c] = current;
        paintCell(r,c);
        moves++;
        updateHUD();

        afterMoveCheckAndAdvance([{r,c}], current);
      }

      function doSwap(a, b) {
        const v1 = board[a.r][a.c];
        const v2 = board[b.r][b.c];

        if (isBoardFull() && remainingSwapsAfterFull(current) === 0) {
          toast(gameToast, 'warn', `У игрока ${current} закончились свапы после заполнения доски.`);
          return;
        }
        if (isBlockedSwapCell(a.r, a.c) || isBlockedSwapCell(b.r, b.c)) {
          toast(gameToast, 'warn', 'Нельзя swapать клетки, которые участвовали в swap на прошлом ходу.');
          return;
        }
        if (!v1 || !v2) {
          toast(gameToast, 'warn', 'Swap возможен только между двумя занятыми клетками.');
          return;
        }
        if (v1 === v2) {
          toast(gameToast, 'warn', 'Swap возможен только между разными метками (X и O).');
          return;
        }
        if (!isAdjacent(a,b)) {
          toast(gameToast, 'warn', 'Swap возможен только между соседними клетками (включая диагональ).');
          return;
        }

        // Swap
        board[a.r][a.c] = v2;
        board[b.r][b.c] = v1;

        paintCell(a.r,a.c);
        paintCell(b.r,b.c);

        moves++;
        swapsTotal++;
        if (isBoardFull()) {
          if (current === "X") swapsAfterFullX++;
          else swapsAfterFullO++;
        }
        blockedSwapCells = [idx(a.r,a.c), idx(b.r,b.c)];
        blockedMoveNumber = moves + 1; // next move only
        updateHUD();

        // Only lines involving swapped cells can change
        afterMoveCheckAndAdvance([a,b], current);
      }

      function onCellClick(e) {
        if (gameOver) return;
        if (gameMode === 'pvc' && (computerBusy || current === CPU)) return;

        const el = e.currentTarget;
        const r = Number(el.dataset.r);
        const c = Number(el.dataset.c);

        if (!inBounds(r,c)) return;
        const v = board[r][c];

        // If no swap selection is active, decide by the clicked cell:
        // - empty -> Place
        // - occupied -> start Swap selection
        if (!swapFirst && !v) {
          clearSwapSelection();
          toast(gameToast, '', 'Place: клик по пустой клетке.');
          doPlace(r,c);
          return;
        }
        if (!swapFirst && v) {
          if (isBoardFull() && remainingSwapsAfterFull(current) === 0) {
            toast(gameToast, 'warn', `У игрока ${current} закончились свапы после заполнения доски.`);
            maybeAutoPassOrDrawAfterFull();
            if (!gameOver && gameMode === 'pvc' && current === CPU) queueComputerTurn();
            return;
          }
          if (isBlockedSwapCell(r,c)) {
            toast(gameToast, 'warn', 'Эта клетка заблокирована на один ход после предыдущего swap.');
            return;
          }
          swapFirst = { r, c };
          el.classList.add('selected');
          markSwapCandidates(swapFirst);
          toast(gameToast, '', 'Swap: теперь выберите соседнюю клетку с другой меткой.');
          return;
        }

        // second selection
        const second = { r, c };

        // clicking same cell cancels
        if (swapFirst.r === second.r && swapFirst.c === second.c) {
          clearSwapSelection();
          toast(gameToast, '', 'Swap: выбор сброшен. Выберите первую клетку заново.');
          return;
        }

        if (!isAdjacent(swapFirst, second)) {
          toast(gameToast, 'warn', 'Swap: вторая клетка должна быть соседней (включая диагональ).');
          return;
        }

        const v1 = board[swapFirst.r][swapFirst.c];
        const v2 = board[second.r][second.c];

        if (!v2) {
          toast(gameToast, 'warn', 'Swap: вторая клетка должна быть занята (и с другой меткой).');
          return;
        }
        if (v1 === v2) {
          toast(gameToast, 'warn', 'Swap: клетки должны содержать разные метки (X и O).');
          return;
        }

        // Perform swap
        const a = swapFirst;
        clearSwapSelection();
        toast(gameToast, '', 'Swap выполнен.');
        doSwap(a, second);
      }

      // ---------- Wire up UI ----------
      function updateSettingsHintLive() {
        const { r, c, k, maxK } = validateSettings();
        const text = `Ограничение: N должно быть от 3 до ${maxK} для поля ${r}×${c}. Диагонали учитываются.`;
        document.getElementById('settingsHint').textContent = text;
      }

      const bumpSetting = (inputEl, delta) => {
        inputEl.value = String(Number(inputEl.value || 0) + delta);
        updateSettingsHintLive();
      };

      rowsPlus.addEventListener('click', () => bumpSetting(rowsInput, +1));
      rowsMinus.addEventListener('click', () => bumpSetting(rowsInput, -1));
      colsPlus.addEventListener('click', () => bumpSetting(colsInput, +1));
      colsMinus.addEventListener('click', () => bumpSetting(colsInput, -1));
      winPlus.addEventListener('click', () => bumpSetting(winInput, +1));
      winMinus.addEventListener('click', () => bumpSetting(winInput, -1));
      swapLimitPlus.addEventListener('click', () => bumpSetting(swapLimitInput, +1));
      swapLimitMinus.addEventListener('click', () => bumpSetting(swapLimitInput, -1));

      modePvpBtn.addEventListener('click', () => setGameMode('pvp'));
      modePvcBtn.addEventListener('click', () => setGameMode('pvc'));

      startBtn.addEventListener('click', startGameFromSettings);

      preset33.addEventListener('click', () => {
        rowsInput.value = '3';
        colsInput.value = '3';
        winInput.value  = '3';
        swapLimitInput.value = '10';
        updateSettingsHintLive();
      });

      preset55.addEventListener('click', () => {
        rowsInput.value = '5';
        colsInput.value = '5';
        winInput.value  = '4';
        swapLimitInput.value = '10';
        updateSettingsHintLive();
      });

      preset1010.addEventListener('click', () => {
        rowsInput.value = '10';
        colsInput.value = '10';
        winInput.value  = '5';
        swapLimitInput.value = '10';
        updateSettingsHintLive();
      });

      preset1515.addEventListener('click', () => {
        rowsInput.value = '15';
        colsInput.value = '15';
        winInput.value  = '5';
        swapLimitInput.value = '10';
        updateSettingsHintLive();
      });

      drawBtn.addEventListener('click', () => {
        if (gameOver) return;
        endGame({ winner: null, isDraw: true, reason: 'Игроки согласились на ничью.' });
      });

      restartBtn.addEventListener('click', () => {
        // back to settings
        cancelPendingEndGame();
        gameOver = true;
        clearSwapSelection();
        hideToast(settingsToast);
        updateSettingsHintLive();
        showScreen('settings');
      });

      playAgainBtn.addEventListener('click', () => {
        // replay with same settings
        cancelPendingEndGame();
        rowsInput.value = String(R);
        colsInput.value = String(C);
        winInput.value  = String(K);
        updateSettingsHintLive();
        startGameFromSettings();
      });

      backToSettingsBtn.addEventListener('click', () => {
        cancelPendingEndGame();
        gameOver = true;
        clearSwapSelection();
        rowsInput.value = String(R);
        colsInput.value = String(C);
        winInput.value  = String(K);
        updateSettingsHintLive();
        showScreen('settings');
      });

      // init
      setGameMode('pvp');
      updateSettingsHintLive();
