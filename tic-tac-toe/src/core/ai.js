import {
    checkWinFrom,
    evalSwapOutcome,
    idx,
    inBounds,
    isBlockedSwapCell,
    isBoardFull,
    listEmptyCells,
    listLegalSwaps,
    other,
    remainingSwapsAfterFull
} from './board.js';

const AI_TIME_MS = 320;
const AI_MAX_DEPTH_SMALL = 7;
const AI_MAX_DEPTH_BIG = 4;
const AI_MAX_PLACE_MOVES = 28;
const AI_MAX_SWAP_MOVES = 22;
const TT = new Map();
const TT_MAX = 200000;

let ZB = null;
let ZB_TURN = [0n, 0n];
let ZB_BLOCK = null;
let ZB_SWAPX = null;
let ZB_SWPO = null;
let lastDimensionSignature = '';

function rand64() {
    const hi = (Math.random() * 0xFFFFFFFF) >>> 0;
    const lo = (Math.random() * 0xFFFFFFFF) >>> 0;
    return (BigInt(hi) << 32n) ^ BigInt(lo);
}

function ensureZobrist(state) {
    const dimensionSignature = `${state.R}x${state.C}`;
    if (ZB && lastDimensionSignature === dimensionSignature) {
        return;
    }

    lastDimensionSignature = dimensionSignature;
    TT.clear();

    const maxCells = 64 * 64;
    ZB = Array.from({ length: maxCells }, () => [rand64(), rand64()]);
    ZB_TURN = [rand64(), rand64()];
    ZB_BLOCK = Array.from({ length: maxCells }, () => rand64());
    ZB_SWAPX = Array.from({ length: 11 }, () => rand64());
    ZB_SWPO = Array.from({ length: 11 }, () => rand64());
}

function computeHash(state, turnSymbol) {
    let hash = 0n;

    for (let row = 0; row < state.R; row += 1) {
        for (let col = 0; col < state.C; col += 1) {
            const value = state.board[row][col];
            if (!value) {
                continue;
            }
            const cellIndex = idx(state, row, col);
            hash ^= ZB[cellIndex][value === 'X' ? 0 : 1];
        }
    }

    hash ^= turnSymbol === 'X' ? ZB_TURN[0] : ZB_TURN[1];

    if (
        state.blockedSwapCells &&
        state.blockedSwapCells.length === 2 &&
        state.blockedMoveNumber === state.moves + 1
    ) {
        hash ^= ZB_BLOCK[state.blockedSwapCells[0]];
        hash ^= ZB_BLOCK[state.blockedSwapCells[1]];
    }

    hash ^= ZB_SWAPX[Math.min(10, Math.max(0, state.swapsAfterFullX | 0))];
    hash ^= ZB_SWPO[Math.min(10, Math.max(0, state.swapsAfterFullO | 0))];
    return hash;
}

function countOccupied(state) {
    let count = 0;
    for (let row = 0; row < state.R; row += 1) {
        for (let col = 0; col < state.C; col += 1) {
            if (state.board[row][col]) {
                count += 1;
            }
        }
    }
    return count;
}

function wouldWinFor(state, symbol, affectedPositions) {
    return affectedPositions.some((cell) => checkWinFrom(state, cell.r, cell.c, symbol));
}

function evaluatePosition(state, perspective) {
    const opponent = other(perspective);
    const weights = new Array(state.K + 1).fill(0);
    if (state.K >= 1) weights[1] = 2;
    if (state.K >= 2) weights[2] = 10;
    if (state.K >= 3) weights[3] = 60;
    if (state.K >= 4) weights[4] = 350;
    if (state.K >= 5) weights[5] = 2200;
    for (let index = 6; index <= state.K; index += 1) {
        weights[index] = weights[index - 1] * 4;
    }
    weights[state.K] = 200000;

    const directions = [
        { dr: 1, dc: 0 },
        { dr: 0, dc: 1 },
        { dr: 1, dc: 1 },
        { dr: 1, dc: -1 }
    ];

    const isEmptyCell = (row, col) => inBounds(state, row, col) && state.board[row][col] === '';
    let score = 0;
    let myThreats = 0;
    let opponentThreats = 0;

    for (let row = 0; row < state.R; row += 1) {
        for (let col = 0; col < state.C; col += 1) {
            for (const direction of directions) {
                const endRow = row + (state.K - 1) * direction.dr;
                const endCol = col + (state.K - 1) * direction.dc;
                if (!inBounds(state, endRow, endCol)) {
                    continue;
                }

                let perspectiveCount = 0;
                let opponentCount = 0;
                let emptyCount = 0;
                for (let step = 0; step < state.K; step += 1) {
                    const value = state.board[row + step * direction.dr][col + step * direction.dc];
                    if (value === perspective) perspectiveCount += 1;
                    else if (value === opponent) opponentCount += 1;
                    else emptyCount += 1;
                }

                if (perspectiveCount && opponentCount) {
                    continue;
                }

                let openEnds = 0;
                if (isEmptyCell(row - direction.dr, col - direction.dc)) {
                    openEnds += 1;
                }
                if (isEmptyCell(endRow + direction.dr, endCol + direction.dc)) {
                    openEnds += 1;
                }

                const multiplier = openEnds === 2 ? 1.9 : openEnds === 1 ? 1.25 : 0.75;
                if (perspectiveCount) {
                    score += weights[perspectiveCount] * multiplier;
                    if (perspectiveCount === state.K - 1 && emptyCount === 1) {
                        myThreats += openEnds === 2 ? 2 : 1;
                    }
                } else if (opponentCount) {
                    score -= weights[opponentCount] * multiplier;
                    if (opponentCount === state.K - 1 && emptyCount === 1) {
                        opponentThreats += openEnds === 2 ? 2 : 1;
                    }
                }
            }
        }
    }

    if (myThreats >= 2) {
        score += 15000;
    }
    if (opponentThreats >= 2) {
        score -= 16000;
    }

    let myWinSwaps = 0;
    let opponentWinSwaps = 0;
    for (const swap of listLegalSwaps(state)) {
        const myOutcome = evalSwapOutcome(state, swap.a, swap.b, perspective);
        if (myOutcome.moverWins) {
            myWinSwaps += 1;
        }
        if (myOutcome.oppWins) {
            opponentWinSwaps += 1;
        }

        const opponentOutcome = evalSwapOutcome(state, swap.a, swap.b, opponent);
        if (opponentOutcome.moverWins) {
            opponentWinSwaps += 1;
        }
    }

    score += myWinSwaps * 5000;
    score -= opponentWinSwaps * 5500;
    return score;
}

function genCandidatePlaceMovesFor(state, mover) {
    const empties = listEmptyCells(state);
    if (!empties.length) {
        return [];
    }

    const occupied = countOccupied(state);
    const centerRow = (state.R - 1) / 2;
    const centerCol = (state.C - 1) / 2;

    if (occupied === 0) {
        empties.sort((left, right) => (
            (left.r - centerRow) ** 2 + (left.c - centerCol) ** 2 -
            ((right.r - centerRow) ** 2 + (right.c - centerCol) ** 2)
        ));
        return empties.slice(0, Math.min(AI_MAX_PLACE_MOVES, empties.length))
            .map((cell) => ({ type: 'place', r: cell.r, c: cell.c }));
    }

    const nearby = empties.filter((cell) => {
        for (let dr = -2; dr <= 2; dr += 1) {
            for (let dc = -2; dc <= 2; dc += 1) {
                if (dr === 0 && dc === 0) {
                    continue;
                }
                const nextRow = cell.r + dr;
                const nextCol = cell.c + dc;
                if (inBounds(state, nextRow, nextCol) && state.board[nextRow][nextCol]) {
                    return true;
                }
            }
        }
        return false;
    });

    const pool = nearby.length ? nearby : empties;
    const opponent = other(mover);
    const wins = [];
    const blocks = [];
    const rest = [];

    for (const cell of pool) {
        state.board[cell.r][cell.c] = mover;
        const moverWins = checkWinFrom(state, cell.r, cell.c, mover);
        state.board[cell.r][cell.c] = '';
        if (moverWins) {
            wins.push(cell);
            continue;
        }

        state.board[cell.r][cell.c] = opponent;
        const blocksOpponent = checkWinFrom(state, cell.r, cell.c, opponent);
        state.board[cell.r][cell.c] = '';
        if (blocksOpponent) {
            blocks.push(cell);
            continue;
        }

        rest.push(cell);
    }

    rest.sort((left, right) => (
        (left.r - centerRow) ** 2 + (left.c - centerCol) ** 2 -
        ((right.r - centerRow) ** 2 + (right.c - centerCol) ** 2)
    ));

    return wins.concat(blocks, rest)
        .slice(0, Math.min(AI_MAX_PLACE_MOVES, pool.length))
        .map((cell) => ({ type: 'place', r: cell.r, c: cell.c }));
}

function genCandidateSwapMoves(state, mover) {
    if (isBoardFull(state) && remainingSwapsAfterFull(state, mover) === 0) {
        return [];
    }

    const scored = listLegalSwaps(state).map((swap) => {
        const outcome = evalSwapOutcome(state, swap.a, swap.b, mover);
        let priority = 0;
        if (outcome.moverWins) {
            priority = 1000000;
        } else if (outcome.oppWins) {
            priority = -1000000;
        }

        const firstValue = state.board[swap.a.r][swap.a.c];
        const secondValue = state.board[swap.b.r][swap.b.c];
        state.board[swap.a.r][swap.a.c] = secondValue;
        state.board[swap.b.r][swap.b.c] = firstValue;
        const heuristic = evaluatePosition(state, mover);
        state.board[swap.a.r][swap.a.c] = firstValue;
        state.board[swap.b.r][swap.b.c] = secondValue;

        return {
            swap,
            score: priority + heuristic
        };
    });

    scored.sort((left, right) => right.score - left.score);
    return scored.slice(0, Math.min(AI_MAX_SWAP_MOVES, scored.length))
        .map((entry) => ({ type: 'swap', a: entry.swap.a, b: entry.swap.b }));
}

function applySimMove(state, move, mover) {
    const saved = {
        moves: state.moves,
        swapsAfterFullX: state.swapsAfterFullX,
        swapsAfterFullO: state.swapsAfterFullO,
        blockedMoveNumber: state.blockedMoveNumber,
        blockedSwapCells: state.blockedSwapCells ? [...state.blockedSwapCells] : null,
        move,
        placedPrev: null,
        swapPrev: null
    };

    if (move.type === 'place') {
        saved.placedPrev = state.board[move.r][move.c];
        state.board[move.r][move.c] = mover;
        state.moves += 1;
        return { saved, affected: [{ r: move.r, c: move.c }] };
    }

    const firstValue = state.board[move.a.r][move.a.c];
    const secondValue = state.board[move.b.r][move.b.c];
    saved.swapPrev = { firstValue, secondValue };

    state.board[move.a.r][move.a.c] = secondValue;
    state.board[move.b.r][move.b.c] = firstValue;
    state.moves += 1;

    if (isBoardFull(state)) {
        if (mover === 'X') state.swapsAfterFullX += 1;
        else state.swapsAfterFullO += 1;
    }

    state.blockedSwapCells = [idx(state, move.a.r, move.a.c), idx(state, move.b.r, move.b.c)];
    state.blockedMoveNumber = state.moves + 1;
    return { saved, affected: [move.a, move.b] };
}

function undoSimMove(state, saved) {
    const { move } = saved;
    if (move.type === 'place') {
        state.board[move.r][move.c] = saved.placedPrev;
    } else {
        state.board[move.a.r][move.a.c] = saved.swapPrev.firstValue;
        state.board[move.b.r][move.b.c] = saved.swapPrev.secondValue;
    }

    state.moves = saved.moves;
    state.swapsAfterFullX = saved.swapsAfterFullX;
    state.swapsAfterFullO = saved.swapsAfterFullO;
    state.blockedMoveNumber = saved.blockedMoveNumber;
    state.blockedSwapCells = saved.blockedSwapCells;
}

function terminalScoreAfterMove(state, affected, mover, depthRemaining) {
    const opponent = other(mover);
    if (wouldWinFor(state, mover, affected)) {
        return 10000000 + depthRemaining;
    }
    if (wouldWinFor(state, opponent, affected)) {
        return -10000000 - depthRemaining;
    }
    if (isBoardFull(state) && remainingSwapsAfterFull(state, 'X') === 0 && remainingSwapsAfterFull(state, 'O') === 0) {
        return 0;
    }
    return null;
}

function genMovesFor(state, mover) {
    const result = [];
    if (!isBoardFull(state)) {
        result.push(...genCandidatePlaceMovesFor(state, mover));
    }
    result.push(...genCandidateSwapMoves(state, mover));
    return result;
}

function negamax(state, mover, depth, alpha, beta, deadline) {
    if (performance.now() >= deadline) {
        return { timedOut: true, score: 0, best: null };
    }

    const hash = computeHash(state, mover);
    const cached = TT.get(hash);
    if (cached && cached.depth >= depth) {
        if (cached.flag === 0) return { timedOut: false, score: cached.score, best: cached.best };
        if (cached.flag === 1) alpha = Math.max(alpha, cached.score);
        else if (cached.flag === 2) beta = Math.min(beta, cached.score);
        if (alpha >= beta) {
            return { timedOut: false, score: cached.score, best: cached.best };
        }
    }

    if (isBoardFull(state) && remainingSwapsAfterFull(state, mover) === 0) {
        if (depth <= 0) {
            return { timedOut: false, score: 0, best: null };
        }
        const child = negamax(state, other(mover), depth - 1, -beta, -alpha, deadline);
        if (child.timedOut) {
            return child;
        }
        return { timedOut: false, score: -child.score, best: null };
    }

    if (depth <= 0) {
        return { timedOut: false, score: evaluatePosition(state, mover), best: null };
    }

    const moves = genMovesFor(state, mover);
    if (!moves.length) {
        return { timedOut: false, score: 0, best: null };
    }

    if (cached?.best) {
        const bestKey = JSON.stringify(cached.best);
        moves.sort((left, right) => (
            (JSON.stringify(left) === bestKey ? -1 : 0) - (JSON.stringify(right) === bestKey ? -1 : 0)
        ));
    }

    let bestMove = moves[0];
    let bestScore = -Infinity;
    const alphaOrigin = alpha;

    for (const move of moves) {
        if (performance.now() >= deadline) {
            return { timedOut: true, score: 0, best: null };
        }

        const { saved, affected } = applySimMove(state, move, mover);
        const terminal = terminalScoreAfterMove(state, affected, mover, depth);
        let score;
        if (terminal !== null) {
            score = terminal;
        } else {
            const child = negamax(state, other(mover), depth - 1, -beta, -alpha, deadline);
            if (child.timedOut) {
                undoSimMove(state, saved);
                return child;
            }
            score = -child.score;
        }
        undoSimMove(state, saved);

        if (score > bestScore) {
            bestScore = score;
            bestMove = move;
        }

        alpha = Math.max(alpha, score);
        if (alpha >= beta) {
            break;
        }
    }

    let flag = 0;
    if (bestScore <= alphaOrigin) flag = 2;
    else if (bestScore >= beta) flag = 1;

    if (TT.size > TT_MAX) {
        TT.clear();
    }
    TT.set(hash, { depth, score: bestScore, flag, best: bestMove });
    return { timedOut: false, score: bestScore, best: bestMove };
}

export function chooseComputerMove(state, { cpu = 'O', human = 'X' } = {}) {
    ensureZobrist(state);
    if (state.moves === 0 && countOccupied(state) === 0) {
        TT.clear();
    }

    const empties = listEmptyCells(state);

    for (const cell of empties) {
        state.board[cell.r][cell.c] = cpu;
        const isWin = checkWinFrom(state, cell.r, cell.c, cpu);
        state.board[cell.r][cell.c] = '';
        if (isWin) {
            return { type: 'place', r: cell.r, c: cell.c };
        }
    }

    const swaps = listLegalSwaps(state);
    for (const swap of swaps) {
        const outcome = evalSwapOutcome(state, swap.a, swap.b, cpu);
        if (outcome.moverWins) {
            return { type: 'swap', a: swap.a, b: swap.b };
        }
    }

    for (const cell of empties) {
        state.board[cell.r][cell.c] = human;
        const humanWins = checkWinFrom(state, cell.r, cell.c, human);
        state.board[cell.r][cell.c] = '';
        if (humanWins) {
            return { type: 'place', r: cell.r, c: cell.c };
        }
    }

    for (const swap of swaps) {
        const humanOutcome = evalSwapOutcome(state, swap.a, swap.b, human);
        if (humanOutcome.moverWins) {
            const cpuOutcome = evalSwapOutcome(state, swap.a, swap.b, cpu);
            if (!cpuOutcome.oppWins) {
                return { type: 'swap', a: swap.a, b: swap.b };
            }
        }
    }

    const maxDepth = state.R * state.C <= 25 ? AI_MAX_DEPTH_SMALL : AI_MAX_DEPTH_BIG;
    const deadline = performance.now() + AI_TIME_MS;
    let bestMove = null;

    for (let depth = 1; depth <= maxDepth; depth += 1) {
        const result = negamax(state, cpu, depth, -Infinity, Infinity, deadline);
        if (result.timedOut) {
            break;
        }
        if (result.best) {
            bestMove = result.best;
        }
    }

    if (bestMove) {
        return bestMove;
    }

    if (empties.length) {
        const centerRow = (state.R - 1) / 2;
        const centerCol = (state.C - 1) / 2;
        let bestCell = empties[0];
        let bestDistance = Infinity;
        for (const cell of empties) {
            const distance = (cell.r - centerRow) ** 2 + (cell.c - centerCol) ** 2;
            if (distance < bestDistance) {
                bestDistance = distance;
                bestCell = cell;
            }
        }
        return { type: 'place', r: bestCell.r, c: bestCell.c };
    }

    for (const swap of swaps) {
        const outcome = evalSwapOutcome(state, swap.a, swap.b, cpu);
        if (!outcome.oppWins) {
            return { type: 'swap', a: swap.a, b: swap.b };
        }
    }

    if (swaps.length) {
        return { type: 'swap', a: swaps[0].a, b: swaps[0].b };
    }

    return null;
}
