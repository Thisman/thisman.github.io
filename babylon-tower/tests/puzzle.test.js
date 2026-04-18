import test from 'node:test';
import assert from 'node:assert/strict';

import {
    applyRotate,
    applySlide,
    canSlide,
    createSolvedState,
    getAllValidMoves,
    isSolved
} from '../src/core/puzzle.js';

test('createSolvedState builds solved board', () => {
    const state = createSolvedState();
    assert.equal(isSolved(state), true);
});

test('applyRotate keeps layer size and mutates order', () => {
    const state = createSolvedState();
    const original = [...state[0]];
    applyRotate(state, 0, 1);
    assert.notDeepEqual(state[0], original);
    assert.equal(state[0].length, original.length);
});

test('canSlide and applySlide move chip into empty slot', () => {
    const state = createSolvedState();
    state[1][0] = 1;
    state[0][0] = 0;
    assert.equal(canSlide(state, 0, 1, -1), true);
    applySlide(state, 0, 1, -1);
    assert.equal(state[0][0], 1);
});

test('getAllValidMoves returns rotates and slides', () => {
    const moves = getAllValidMoves(createSolvedState());
    assert.equal(moves.some((move) => move.type === 'rotate'), true);
});
