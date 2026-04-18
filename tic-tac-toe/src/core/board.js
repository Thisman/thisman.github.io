export function clampInt(value, min, max) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
        return min;
    }
    return Math.max(min, Math.min(max, Math.trunc(number)));
}

export function createBoardState({
    rows = 10,
    cols = 10,
    winLength = 5,
    swapLimit = 6,
    gameMode = 'pvp'
} = {}) {
    return {
        R: rows,
        C: cols,
        K: winLength,
        board: Array.from({ length: rows }, () => Array.from({ length: cols }, () => '')),
        current: 'X',
        moves: 0,
        swapsTotal: 0,
        blockedMoveNumber: 0,
        blockedSwapCells: null,
        gameMode,
        HUMAN: 'X',
        CPU: 'O',
        computerBusy: false,
        swapLimitAfterFull: swapLimit,
        swapsAfterFullX: 0,
        swapsAfterFullO: 0,
        gameOver: false
    };
}

export function idx(state, row, col) {
    return row * state.C + col;
}

export function inBounds(state, row, col) {
    return row >= 0 && row < state.R && col >= 0 && col < state.C;
}

export function other(symbol) {
    return symbol === 'X' ? 'O' : 'X';
}

export function isBoardFull(state) {
    for (let row = 0; row < state.R; row += 1) {
        for (let col = 0; col < state.C; col += 1) {
            if (!state.board[row][col]) {
                return false;
            }
        }
    }
    return true;
}

export function remainingSwapsAfterFull(state, symbol) {
    if (!isBoardFull(state)) {
        return Number.POSITIVE_INFINITY;
    }
    const used = symbol === 'X' ? state.swapsAfterFullX : state.swapsAfterFullO;
    return Math.max(0, state.swapLimitAfterFull - used);
}

export function isBlockedSwapCell(state, row, col) {
    if (!state.blockedSwapCells) {
        return false;
    }

    const nextMoveNumber = state.moves + 1;
    if (state.blockedMoveNumber !== nextMoveNumber) {
        return false;
    }

    const cellIndex = idx(state, row, col);
    return state.blockedSwapCells[0] === cellIndex || state.blockedSwapCells[1] === cellIndex;
}

export function isAdjacent(left, right) {
    const dr = Math.abs(left.r - right.r);
    const dc = Math.abs(left.c - right.c);
    return (dr <= 1 && dc <= 1) && !(dr === 0 && dc === 0);
}

export function checkWinFrom(state, row, col, symbol) {
    if (!inBounds(state, row, col)) {
        return false;
    }
    if (state.board[row][col] !== symbol) {
        return false;
    }

    const directions = [
        { dr: 1, dc: 0 },
        { dr: 0, dc: 1 },
        { dr: 1, dc: 1 },
        { dr: 1, dc: -1 }
    ];

    for (const direction of directions) {
        let count = 1;

        let nextRow = row + direction.dr;
        let nextCol = col + direction.dc;
        while (inBounds(state, nextRow, nextCol) && state.board[nextRow][nextCol] === symbol) {
            count += 1;
            nextRow += direction.dr;
            nextCol += direction.dc;
        }

        nextRow = row - direction.dr;
        nextCol = col - direction.dc;
        while (inBounds(state, nextRow, nextCol) && state.board[nextRow][nextCol] === symbol) {
            count += 1;
            nextRow -= direction.dr;
            nextCol -= direction.dc;
        }

        if (count >= state.K) {
            return true;
        }
    }

    return false;
}

export function findWinLineFrom(state, row, col, symbol) {
    if (!inBounds(state, row, col) || state.board[row][col] !== symbol) {
        return null;
    }

    const directions = [
        { dr: 1, dc: 0 },
        { dr: 0, dc: 1 },
        { dr: 1, dc: 1 },
        { dr: 1, dc: -1 }
    ];

    for (const direction of directions) {
        let startRow = row;
        let startCol = col;
        while (
            inBounds(state, startRow - direction.dr, startCol - direction.dc) &&
            state.board[startRow - direction.dr][startCol - direction.dc] === symbol
        ) {
            startRow -= direction.dr;
            startCol -= direction.dc;
        }

        const run = [];
        let nextRow = startRow;
        let nextCol = startCol;
        while (inBounds(state, nextRow, nextCol) && state.board[nextRow][nextCol] === symbol) {
            run.push({ r: nextRow, c: nextCol });
            nextRow += direction.dr;
            nextCol += direction.dc;
        }

        if (run.length >= state.K) {
            const originalIndex = run.findIndex((cell) => cell.r === row && cell.c === col);
            let start = originalIndex - (state.K - 1);
            if (start < 0) {
                start = 0;
            }
            const maxStart = run.length - state.K;
            if (start > maxStart) {
                start = maxStart;
            }
            return run.slice(start, start + state.K);
        }
    }

    return null;
}

export function listEmptyCells(state) {
    const result = [];
    for (let row = 0; row < state.R; row += 1) {
        for (let col = 0; col < state.C; col += 1) {
            if (!state.board[row][col]) {
                result.push({ r: row, c: col });
            }
        }
    }
    return result;
}

export function listLegalSwaps(state) {
    const result = [];
    const seen = new Set();
    const deltas = [
        { dr: 1, dc: 0 },
        { dr: 0, dc: 1 },
        { dr: 1, dc: 1 },
        { dr: 1, dc: -1 },
        { dr: -1, dc: 0 },
        { dr: 0, dc: -1 },
        { dr: -1, dc: -1 },
        { dr: -1, dc: 1 }
    ];

    for (let row = 0; row < state.R; row += 1) {
        for (let col = 0; col < state.C; col += 1) {
            const leftValue = state.board[row][col];
            if (!leftValue) {
                continue;
            }

            for (const delta of deltas) {
                const nextRow = row + delta.dr;
                const nextCol = col + delta.dc;
                if (!inBounds(state, nextRow, nextCol)) {
                    continue;
                }

                const rightValue = state.board[nextRow][nextCol];
                if (!rightValue || leftValue === rightValue) {
                    continue;
                }
                if (isBlockedSwapCell(state, row, col) || isBlockedSwapCell(state, nextRow, nextCol)) {
                    continue;
                }

                const firstIndex = idx(state, row, col);
                const secondIndex = idx(state, nextRow, nextCol);
                const key = firstIndex < secondIndex
                    ? `${firstIndex}-${secondIndex}`
                    : `${secondIndex}-${firstIndex}`;
                if (seen.has(key)) {
                    continue;
                }
                seen.add(key);
                result.push({
                    a: { r: row, c: col },
                    b: { r: nextRow, c: nextCol }
                });
            }
        }
    }

    return result;
}

export function evalSwapOutcome(state, left, right, mover) {
    const firstValue = state.board[left.r][left.c];
    const secondValue = state.board[right.r][right.c];

    state.board[left.r][left.c] = secondValue;
    state.board[right.r][right.c] = firstValue;

    const opponent = other(mover);
    const affected = [left, right];
    const moverCells = [];
    const opponentCells = [];

    for (const cell of affected) {
        const value = state.board[cell.r][cell.c];
        if (value === mover) {
            moverCells.push(cell);
        } else if (value === opponent) {
            opponentCells.push(cell);
        }
    }

    let moverWins = false;
    for (const cell of moverCells) {
        if (checkWinFrom(state, cell.r, cell.c, mover)) {
            moverWins = true;
            break;
        }
    }

    let opponentWins = false;
    if (!moverWins) {
        for (const cell of opponentCells) {
            if (checkWinFrom(state, cell.r, cell.c, opponent)) {
                opponentWins = true;
                break;
            }
        }
    }

    state.board[left.r][left.c] = firstValue;
    state.board[right.r][right.c] = secondValue;

    return {
        moverWins,
        oppWins: opponentWins
    };
}
