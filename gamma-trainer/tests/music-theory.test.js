import test from 'node:test';
import assert from 'node:assert/strict';

import { buildScale, createScalePresentation, triadQuality } from '../src/core/music-theory.js';

test('buildScale creates ionian scale from tonic', () => {
    assert.deepEqual(buildScale(0, 'ionian'), [0, 2, 4, 5, 7, 9, 11]);
});

test('triadQuality recognizes diminished chords', () => {
    assert.equal(triadQuality(11, 2, 5), 'dim');
});

test('createScalePresentation marks characteristic degrees', () => {
    const presentation = createScalePresentation(0, 'lydian');
    assert.equal(presentation[3].isCharacteristic, true);
    assert.equal(presentation[0].note, 'До');
});
