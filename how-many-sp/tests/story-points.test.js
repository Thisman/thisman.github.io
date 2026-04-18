import test from 'node:test';
import assert from 'node:assert/strict';

import {
    calculateStoryPoints,
    describeStoryPoints,
    getStoryPointsColor,
    normalizeTaskProperties
} from '../src/core/story-points.js';

test('normalizeTaskProperties fills defaults', () => {
    assert.deepEqual(normalizeTaskProperties({ effort: 'high' }), {
        complexity: 'low',
        effort: 'high',
        uncertainty: 'low'
    });
});

test('calculateStoryPoints reads matrix values', () => {
    assert.equal(calculateStoryPoints({
        uncertainty: 'high',
        complexity: 'high',
        effort: 'high'
    }), 21);
});

test('story point helpers describe complex tasks', () => {
    assert.match(describeStoryPoints(13), /эпик/i);
    assert.equal(getStoryPointsColor(8), '#d71921');
});
