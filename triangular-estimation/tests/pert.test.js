import test from 'node:test';
import assert from 'node:assert/strict';

import { calculatePertEstimate, createPertResult } from '../src/core/pert.js';

test('calculatePertEstimate uses weighted formula', () => {
    assert.equal(calculatePertEstimate({
        optimistic: 1,
        realistic: 4,
        pessimistic: 7
    }), 4);
});

test('createPertResult returns validation error for inconsistent inputs', () => {
    const result = createPertResult({
        optimistic: '1',
        realistic: '3',
        pessimistic: '2',
        unit: 'days'
    });

    assert.equal(result.valid, false);
    assert.match(result.error, /реалистич/i);
});

test('createPertResult formats valid estimate', () => {
    const result = createPertResult({
        optimistic: '1',
        realistic: '2',
        pessimistic: '3',
        unit: 'days'
    });

    assert.equal(result.valid, true);
    assert.equal(result.estimate, 2);
    assert.equal(result.unitText, 'дня');
});
