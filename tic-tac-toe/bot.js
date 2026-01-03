// ---------- Computer AI (time-bounded search) ----------
// This game allows both "place" and "swap" moves; after the board is full, only swaps remain (with per-player limit).
// We use a time-bounded negamax + alpha-beta with a heuristic evaluation that scales to 15x15.
//
// UPDATED:
// - Added Transposition Table (Zobrist hashing) to avoid recalculating repeated states (critical with swaps).
// - Stronger evaluation: open ends, fork pressure, and swap-tactical threats.
// - Better move generation: place radius 2 + tactical ordering; swap ordering improved via eval.
// - Iterative deepening uses TT best move first for stronger alpha-beta pruning.

const AI_TIME_MS = 320;       // hard budget per CPU turn (was 120)
const AI_MAX_DEPTH_SMALL = 7; // for small boards (3x3 / 5x5) (was 5)
const AI_MAX_DEPTH_BIG = 4;   // for 10x10 / 15x15 (was 3) (branching is huge because swaps exist)
const AI_MAX_PLACE_MOVES = 28; // was 18
const AI_MAX_SWAP_MOVES = 22;  // was 14

// ---------- Transposition Table (Zobrist) ----------
const TT = new Map(); // BigInt hash -> { depth, score, flag, best }
const TT_MAX = 200000;

// Zobrist tables (initialized lazily)
let ZB = null;           // per-cell randoms for X/O
let ZB_TURN = [0n, 0n];  // X/O to move
let ZB_BLOCK = null;     // per-cell randoms for cooldown marker
let ZB_SWAPX = null;     // swap count after full (0..10)
let ZB_SWPO = null;

let _AI_LAST_DIM = 0;    // to reset TT on size changes safely

function _rand64() {
  // 64-bit BigInt via two 32-bit randoms
  const hi = (Math.random() * 0xFFFFFFFF) >>> 0;
  const lo = (Math.random() * 0xFFFFFFFF) >>> 0;
  return (BigInt(hi) << 32n) ^ BigInt(lo);
}

function _aiInitZobristIfNeeded() {
  const dim = (R << 16) ^ C; // cheap signature
  if (ZB && ZB_BLOCK && ZB_SWAPX && ZB_SWPO && _AI_LAST_DIM === dim) return;

  // Reset on dimension change
  _AI_LAST_DIM = dim;
  TT.clear();

  const maxCells = 64 * 64;
  ZB = Array.from({ length: maxCells }, () => [_rand64(), _rand64()]); // [X,O]
  ZB_TURN = [_rand64(), _rand64()];
  ZB_BLOCK = Array.from({ length: maxCells }, () => _rand64());
  ZB_SWAPX = Array.from({ length: 11 }, () => _rand64());
  ZB_SWPO  = Array.from({ length: 11 }, () => _rand64());
}

function _ttGet(h) {
  return TT.get(h);
}

function _ttPut(h, entry) {
  if (TT.size > TT_MAX) TT.clear();
  TT.set(h, entry);
}

function _computeHash(turnSym) {
  // turnSym: "X" | "O"
  let h = 0n;

  for (let r = 0; r < R; r++) {
    for (let c = 0; c < C; c++) {
      const v = board[r][c];
      if (!v) continue;
      const id = idx(r, c);
      h ^= ZB[id][v === "X" ? 0 : 1];
    }
  }

  h ^= (turnSym === "X" ? ZB_TURN[0] : ZB_TURN[1]);

  // cooldown marker: cells that were swapped in the previous move cannot be swapped now.
  // We assume your engine uses:
  // - blockedSwapCells: [cellIdxA, cellIdxB]
  // - blockedMoveNumber: move number on which the block is active
  // - moves: current move count
  //
  // If your implementation differs, keep your existing cooldown logic in listLegalSwaps()
  // and this hash will still be "good enough" (worst case: fewer TT hits).
  if (blockedSwapCells && blockedSwapCells.length === 2 && moves === blockedMoveNumber) {
    h ^= ZB_BLOCK[blockedSwapCells[0]];
    h ^= ZB_BLOCK[blockedSwapCells[1]];
  }

  // swap counters (0..10) after the board is full; include always for correctness.
  h ^= ZB_SWAPX[Math.min(10, Math.max(0, swapsAfterFullX | 0))];
  h ^= ZB_SWPO[Math.min(10, Math.max(0, swapsAfterFullO | 0))];

  return h;
}

function countOccupied() {
  let n = 0;
  for (let r=0; r<R; r++) for (let c=0; c<C; c++) if (board[r][c]) n++;
  return n;
}

function hasAnyMoves(sym) {
  if (isBoardFull()) return remainingSwapsAfterFull(sym) > 0 && listLegalSwaps().length > 0;
  // before full: place is always possible if there is at least one empty
  return listEmptyCells().length > 0 || listLegalSwaps().length > 0;
}

function wouldWinFor(sym, affectedPositions) {
  for (const p of affectedPositions) {
    if (checkWinFrom(p.r, p.c, sym)) return true;
  }
  return false;
}

// ---------- Better heuristic evaluation ----------
function evaluatePosition(perspective) {
  // Upgraded heuristic:
  // - Sum over all length-K segments in 4 directions.
  // - Segment contributes only if it is "pure" (one side + empties).
  // - Weight scales steeply with count, multiplied by "openness" (open ends).
  // - Fork pressure: two or more near-complete threats is highly valuable.
  // - Swap tactical potential: immediate win swaps, and avoid swaps that gift opponent wins.
  const opp = other(perspective);

  // weights[i] contribution for i marks in a pure segment
  const weights = new Array(K + 1).fill(0);
  if (K >= 1) weights[1] = 2;
  if (K >= 2) weights[2] = 10;
  if (K >= 3) weights[3] = 60;
  if (K >= 4) weights[4] = 350;
  if (K >= 5) weights[5] = 2200;
  for (let i = 6; i <= K; i++) weights[i] = weights[i - 1] * 4;
  weights[K] = 200000;

  const dirs = [
    {dr:1, dc:0},
    {dr:0, dc:1},
    {dr:1, dc:1},
    {dr:1, dc:-1},
  ];

  const isEmptyCell = (r,c) => inBounds(r,c) && board[r][c] === "";

  let score = 0;
  let myThreats = 0;
  let oppThreats = 0;

  for (let r=0; r<R; r++) {
    for (let c=0; c<C; c++) {
      for (const d of dirs) {
        const endR = r + (K-1)*d.dr;
        const endC = c + (K-1)*d.dc;
        if (!inBounds(endR, endC)) continue;

        let pCount = 0, oCount = 0, eCount = 0;
        for (let t=0; t<K; t++) {
          const v = board[r + t*d.dr][c + t*d.dc];
          if (v === perspective) pCount++;
          else if (v === opp) oCount++;
          else eCount++;
        }

        if (pCount && oCount) continue;

        const preR = r - d.dr, preC = c - d.dc;
        const postR = endR + d.dr, postC = endC + d.dc;

        let openEnds = 0;
        if (isEmptyCell(preR, preC)) openEnds++;
        if (isEmptyCell(postR, postC)) openEnds++;

        const mul = openEnds === 2 ? 1.9 : openEnds === 1 ? 1.25 : 0.75;

        if (pCount) {
          score += weights[pCount] * mul;
          if (pCount === K-1 && eCount === 1) myThreats += (openEnds === 2 ? 2 : 1);
        } else if (oCount) {
          score -= weights[oCount] * mul;
          if (oCount === K-1 && eCount === 1) oppThreats += (openEnds === 2 ? 2 : 1);
        }
      }
    }
  }

  // Fork pressure
  if (myThreats >= 2) score += 15000;
  if (oppThreats >= 2) score -= 16000;

  // Swap tactical potential (cheap, but impactful)
  const swaps = listLegalSwaps();
  let myWinSwaps = 0;
  let oppWinSwaps = 0;

  for (const s of swaps) {
    // If current perspective makes this swap now, does it win / gift?
    const outP = evalSwapOutcome(s.a, s.b, perspective);
    if (outP.moverWins) myWinSwaps++;
    if (outP.oppWins) oppWinSwaps++;

    // If opponent could win with a swap on their turn, also dangerous.
    const outO = evalSwapOutcome(s.a, s.b, opp);
    if (outO.moverWins) oppWinSwaps++;
  }

  score += myWinSwaps * 5000;
  score -= oppWinSwaps * 5500;

  return score;
}

function genCandidatePlaceMoves() {
  // Improved candidate pruning:
  // - radius <= 2 around existing stones (helps on 10x10/15x15)
  // - tactical ordering: winning moves first, then blocks, then center-ish
  const empties = listEmptyCells();
  if (!empties.length) return [];

  const occ = countOccupied();
  if (occ === 0) {
    const centerR = (R - 1) / 2;
    const centerC = (C - 1) / 2;
    empties.sort((a,b) => {
      const da = (a.r-centerR)**2 + (a.c-centerC)**2;
      const db = (b.r-centerR)**2 + (b.c-centerC)**2;
      return da - db;
    });
    return empties
      .slice(0, Math.min(AI_MAX_PLACE_MOVES, empties.length))
      .map(p => ({ type:'place', r:p.r, c:p.c }));
  }

  // radius 2 near any mark
  const near = [];
  for (const p of empties) {
    let ok = false;
    for (let dr=-2; dr<=2 && !ok; dr++) {
      for (let dc=-2; dc<=2 && !ok; dc++) {
        if (dr === 0 && dc === 0) continue;
        const rr = p.r + dr, cc = p.c + dc;
        if (inBounds(rr,cc) && board[rr][cc]) ok = true;
      }
    }
    if (ok) near.push(p);
  }

  const pool = near.length ? near : empties;

  const mover = CPU;            // IMPORTANT: this generator is used inside search for both sides,
  const opp = other(CPU);       // but we keep tactical ordering relative to the actual mover passed in search
                                // by rebuilding inside genMovesFor(mover). This wrapper remains for legacy use.
  // The above CPU/opp fallback is only used if genCandidatePlaceMoves() is called directly without mover.
  // In search we use genCandidatePlaceMovesFor(mover) below.

  const centerR = (R - 1) / 2;
  const centerC = (C - 1) / 2;
  pool.sort((a,b) => {
    const da = (a.r-centerR)**2 + (a.c-centerC)**2;
    const db = (b.r-centerR)**2 + (b.c-centerC)**2;
    return da - db;
  });

  return pool
    .slice(0, Math.min(AI_MAX_PLACE_MOVES, pool.length))
    .map(p => ({ type:'place', r:p.r, c:p.c }));
}

function genCandidatePlaceMovesFor(mover) {
  const empties = listEmptyCells();
  if (!empties.length) return [];

  const occ = countOccupied();
  if (occ === 0) {
    const centerR = (R - 1) / 2;
    const centerC = (C - 1) / 2;
    empties.sort((a,b) => ((a.r-centerR)**2+(a.c-centerC)**2) - ((b.r-centerR)**2+(b.c-centerC)**2));
    return empties
      .slice(0, Math.min(AI_MAX_PLACE_MOVES, empties.length))
      .map(p => ({ type:'place', r:p.r, c:p.c }));
  }

  const near = [];
  for (const p of empties) {
    let ok = false;
    for (let dr=-2; dr<=2 && !ok; dr++) {
      for (let dc=-2; dc<=2 && !ok; dc++) {
        if (dr === 0 && dc === 0) continue;
        const rr = p.r + dr, cc = p.c + dc;
        if (inBounds(rr,cc) && board[rr][cc]) ok = true;
      }
    }
    if (ok) near.push(p);
  }

  const pool = near.length ? near : empties;

  const opp = other(mover);
  const wins = [];
  const blocks = [];
  const rest = [];

  for (const p of pool) {
    board[p.r][p.c] = mover;
    const w = checkWinFrom(p.r, p.c, mover);
    board[p.r][p.c] = "";
    if (w) { wins.push(p); continue; }

    board[p.r][p.c] = opp;
    const b = checkWinFrom(p.r, p.c, opp);
    board[p.r][p.c] = "";
    if (b) { blocks.push(p); continue; }

    rest.push(p);
  }

  const centerR = (R - 1) / 2;
  const centerC = (C - 1) / 2;
  rest.sort((a,b) => ((a.r-centerR)**2+(a.c-centerC)**2) - ((b.r-centerR)**2+(b.c-centerC)**2));

  const merged = wins.concat(blocks, rest);
  return merged
    .slice(0, Math.min(AI_MAX_PLACE_MOVES, merged.length))
    .map(p => ({ type:'place', r:p.r, c:p.c }));
}

function genCandidateSwapMoves(mover) {
  // Swap can be played even before full; after full it's the only move type.
  if (isBoardFull() && remainingSwapsAfterFull(mover) === 0) return [];

  const swaps = listLegalSwaps();
  if (!swaps.length) return [];

  // Score swaps by quick outcome + heuristic after applying swap
  const scored = [];
  for (const s of swaps) {
    const out = evalSwapOutcome(s.a, s.b, mover);
    let pri = 0;
    if (out.moverWins) pri = 1000000;
    else if (out.oppWins) pri = -1000000;

    // Apply swap
    const v1 = board[s.a.r][s.a.c];
    const v2 = board[s.b.r][s.b.c];
    board[s.a.r][s.a.c] = v2;
    board[s.b.r][s.b.c] = v1;

    // Heuristic from mover perspective
    const h = evaluatePosition(mover);

    // Undo swap
    board[s.a.r][s.a.c] = v1;
    board[s.b.r][s.b.c] = v2;

    scored.push({ s, score: pri + h });
  }

  scored.sort((x,y) => y.score - x.score);
  const top = scored.slice(0, Math.min(AI_MAX_SWAP_MOVES, scored.length));
  return top.map(x => ({ type:'swap', a:x.s.a, b:x.s.b }));
}

function applySimMove(move, mover) {
  const saved = {
    moves,
    swapsAfterFullX,
    swapsAfterFullO,
    blockedMoveNumber,
    blockedSwapCells: blockedSwapCells ? [...blockedSwapCells] : null,
    // for undo
    move,
    placedPrev: null,
    swapPrev: null,
  };

  if (move.type === 'place') {
    saved.placedPrev = board[move.r][move.c];
    board[move.r][move.c] = mover;
    moves++;
    return { saved, affected: [{r:move.r, c:move.c}] };
  }

  // swap
  const v1 = board[move.a.r][move.a.c];
  const v2 = board[move.b.r][move.b.c];
  saved.swapPrev = { v1, v2 };

  board[move.a.r][move.a.c] = v2;
  board[move.b.r][move.b.c] = v1;

  moves++;
  if (isBoardFull()) {
    if (mover === "X") swapsAfterFullX++;
    else swapsAfterFullO++;
  }

  // cooldown: block these two cells for the very next move
  blockedSwapCells = [idx(move.a.r,move.a.c), idx(move.b.r,move.b.c)];
  blockedMoveNumber = moves + 1;

  return { saved, affected: [move.a, move.b] };
}

function undoSimMove(saved) {
  const move = saved.move;
  if (move.type === 'place') {
    board[move.r][move.c] = saved.placedPrev;
  } else {
    board[move.a.r][move.a.c] = saved.swapPrev.v1;
    board[move.b.r][move.b.c] = saved.swapPrev.v2;
  }
  moves = saved.moves;
  swapsAfterFullX = saved.swapsAfterFullX;
  swapsAfterFullO = saved.swapsAfterFullO;
  blockedMoveNumber = saved.blockedMoveNumber;
  blockedSwapCells = saved.blockedSwapCells;
}

function terminalScoreAfterMove(affected, mover, depthRemaining) {
  // Winner policy matches afterMoveCheckAndAdvance:
  // mover wins if mover has a line; else opponent wins if opponent has a line (swap blunder).
  const opp = other(mover);
  if (wouldWinFor(mover, affected)) return 10000000 + depthRemaining;
  if (wouldWinFor(opp, affected)) return -10000000 - depthRemaining;

  // Draw: board full and no swaps remaining for both players.
  if (isBoardFull() && remainingSwapsAfterFull("X") === 0 && remainingSwapsAfterFull("O") === 0) return 0;
  return null;
}

function genMovesFor(mover) {
  const movesOut = [];
  if (!isBoardFull()) {
    movesOut.push(...genCandidatePlaceMovesFor(mover));
  }
  movesOut.push(...genCandidateSwapMoves(mover));
  return movesOut;
}

function negamax(mover, depth, alpha, beta, deadline, ply) {
  if (performance.now() >= deadline) return { timedOut: true, score: 0, best: null };

  // TT lookup
  const hash = _computeHash(mover);
  const tt = _ttGet(hash);
  if (tt && tt.depth >= depth) {
    // flag: 0 exact, 1 lower, 2 upper
    if (tt.flag === 0) return { timedOut: false, score: tt.score, best: tt.best };
    if (tt.flag === 1) alpha = Math.max(alpha, tt.score);
    else if (tt.flag === 2) beta = Math.min(beta, tt.score);
    if (alpha >= beta) return { timedOut: false, score: tt.score, best: tt.best };
  }

  // If after full the player has no swaps left, they auto-pass in the real game.
  if (isBoardFull() && remainingSwapsAfterFull(mover) === 0) {
    if (depth <= 0) return { timedOut: false, score: 0, best: null };
    const res = negamax(other(mover), depth - 1, -beta, -alpha, deadline, ply + 1);
    if (res.timedOut) return res;
    return { timedOut: false, score: -res.score, best: null };
  }

  if (depth <= 0) {
    return { timedOut: false, score: evaluatePosition(mover), best: null };
  }

  let movesList = genMovesFor(mover);
  if (!movesList.length) {
    return { timedOut: false, score: 0, best: null };
  }

  // Move ordering: TT best first (if any)
  if (tt && tt.best) {
    const key = JSON.stringify(tt.best);
    movesList.sort((a,b) => (JSON.stringify(a) === key ? -1 : 0) - (JSON.stringify(b) === key ? -1 : 0));
  }

  let bestMove = movesList[0];
  let bestScore = -Infinity;
  const alphaOrig = alpha;

  for (const mv of movesList) {
    if (performance.now() >= deadline) return { timedOut: true, score: 0, best: null };

    const { saved, affected } = applySimMove(mv, mover);

    const t = terminalScoreAfterMove(affected, mover, depth);
    let score;
    if (t !== null) {
      score = t;
    } else {
      const child = negamax(other(mover), depth - 1, -beta, -alpha, deadline, ply + 1);
      if (child.timedOut) { undoSimMove(saved); return child; }
      score = -child.score;
    }

    undoSimMove(saved);

    if (score > bestScore) {
      bestScore = score;
      bestMove = mv;
    }
    alpha = Math.max(alpha, score);
    if (alpha >= beta) break; // beta cut
  }

  // TT store
  let flag = 0; // exact
  if (bestScore <= alphaOrig) flag = 2;        // upper bound
  else if (bestScore >= beta) flag = 1;        // lower bound

  _ttPut(hash, { depth, score: bestScore, flag, best: bestMove });

  return { timedOut: false, score: bestScore, best: bestMove };
}

function chooseComputerMove() {
  _aiInitZobristIfNeeded();

  // When a new game starts, reset TT once (cheap heuristic)
  // If your engine has an explicit "start game" hook, calling TT.clear() there is better.
  if (moves === 0 && countOccupied() === 0) TT.clear();

  const mover = CPU;
  const opp = HUMAN;

  const empties = listEmptyCells();

  // 1) Winning place
  for (const p of empties) {
    board[p.r][p.c] = mover;
    const win = checkWinFrom(p.r, p.c, mover);
    board[p.r][p.c] = "";
    if (win) return { type:'place', r:p.r, c:p.c };
  }

  // 2) Winning swap
  const swapsAll = listLegalSwaps();
  for (const s of swapsAll) {
    const out = evalSwapOutcome(s.a, s.b, mover);
    if (out.moverWins) return { type:'swap', a:s.a, b:s.b };
  }

  // 3) Block opponent winning place
  for (const p of empties) {
    board[p.r][p.c] = opp;
    const win = checkWinFrom(p.r, p.c, opp);
    board[p.r][p.c] = "";
    if (win) return { type:'place', r:p.r, c:p.c };
  }

  // 3b) Block opponent winning swap (important in this ruleset)
  for (const s of swapsAll) {
    const out = evalSwapOutcome(s.a, s.b, opp);
    if (out.moverWins) {
      // try to respond by making that swap illegal via our own swap? too expensive here.
      // simplest practical defense: if we can play that swap ourselves without gifting, do it.
      const outSelf = evalSwapOutcome(s.a, s.b, mover);
      if (!outSelf.oppWins) return { type:'swap', a:s.a, b:s.b };
    }
  }

  // 4) Time-bounded lookahead (handles both place and swap, even before full)
  const maxDepth = (R*C <= 25) ? AI_MAX_DEPTH_SMALL : AI_MAX_DEPTH_BIG;
  const deadline = performance.now() + AI_TIME_MS;

  // Iterative deepening for stability: keep best from last completed depth.
  let bestMove = null;
  for (let d=1; d<=maxDepth; d++) {
    const res = negamax(mover, d, -Infinity, Infinity, deadline, 0);
    if (res.timedOut) break;
    if (res.best) bestMove = res.best;
  }
  if (bestMove) return bestMove;

  // Fallback: prefer center-ish place, otherwise any safe-ish swap
  if (empties.length) {
    const centerR = (R - 1) / 2;
    const centerC = (C - 1) / 2;
    let best = empties[0];
    let bestD = Infinity;
    for (const p of empties) {
      const d = (p.r - centerR) ** 2 + (p.c - centerC) ** 2;
      if (d < bestD) { bestD = d; best = p; }
    }
    return { type:'place', r:best.r, c:best.c };
  }

  // If board is full: do any safe swap (avoid gifting)
  for (const s of swapsAll) {
    const out = evalSwapOutcome(s.a, s.b, mover);
    if (!out.oppWins) return { type:'swap', a:s.a, b:s.b };
  }
  if (swapsAll.length) return { type:'swap', a:swapsAll[0].a, b:swapsAll[0].b };
  return null;
}
