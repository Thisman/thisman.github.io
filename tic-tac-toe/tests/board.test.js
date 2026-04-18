import test from 'node:test';
import assert from 'node:assert/strict';

import {
    checkWinFrom,
    createBoardState,
    evalSwapOutcome,
    findWinLineFrom,
    isAdjacent,
    listLegalSwaps,
    remainingSwapsAfterFull
} from '../src/core/board.js';

test('isAdjacent accepts diagonals and rejects distant cells', () => {
    assert.equal(isAdjacent({ r: 0, c: 0 }, { r: 1, c: 1 }), true);
    assert.equal(isAdjacent({ r: 0, c: 0 }, { r: 2, c: 0 }), false);
});

test('checkWinFrom finds horizontal line', () => {
    const state = createBoardState({ rows: 3, cols: 3, winLength: 3 });
    state.board[0] = ['X', 'X', 'X'];
    assert.equal(checkWinFrom(state, 0, 1, 'X'), true);
    assert.deepEqual(findWinLineFrom(state, 0, 1, 'X'), [
        { r: 0, c: 0 },
        { r: 0, c: 1 },
        { r: 0, c: 2 }
    ]);
});

test('listLegalSwaps returns only mixed adjacent occupied cells', () => {
    const state = createBoardState({ rows: 2, cols: 2, winLength: 2 });
    state.board[0][0] = 'X';
    state.board[0][1] = 'O';
    state.board[1][0] = 'X';
    assert.equal(listLegalSwaps(state).length, 2);
});

test('evalSwapOutcome detects immediate mover win', () => {
    const state = createBoardState({ rows: 3, cols: 3, winLength: 3 });
    state.board[0][0] = 'X';
    state.board[0][1] = 'O';
    state.board[0][2] = 'X';
    state.board[1][1] = 'X';
    const result = evalSwapOutcome(state, { r: 0, c: 1 }, { r: 1, c: 1 }, 'X');
    assert.equal(result.moverWins, true);
});

test('remainingSwapsAfterFull only matters on full boards', () => {
    const state = createBoardState({ rows: 2, cols: 2, winLength: 2, swapLimit: 4 });
    assert.equal(remainingSwapsAfterFull(state, 'X'), Number.POSITIVE_INFINITY);
});
