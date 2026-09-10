import test from 'node:test';
import assert from 'node:assert/strict';
import { SHAPES, PATTERNS, createGame, distancesFrom, generateMap, keyOf, occupiedCells, patternAt, patternSpeedForLevel, stepGame } from '../game.js';

function rectangle(width = 12, depth = 12) {
    const cells = Array.from({ length: width * depth }, (_, i) => ({ x: i % width, z: Math.floor(i / width) }));
    return { width, depth, cells, cellSet: new Set(cells.map(c => keyOf(c.x, c.z))), start: { x: 3, z: 3 }, exit: { x: width - 1, z: depth - 1 } };
}
function advance(game, seconds, input = {}) {
    for (let i = 0; i < Math.round(seconds * 120); i++) stepGame(game, input, 1 / 120);
}
function lineTime(map, x) { return (x + 2) / (map.width + 3) * PATTERNS[0].duration; }

test('12 forms stay connected, varied, and have a distant reachable exit over 1440 generations', () => {
    assert.ok(SHAPES.length >= 10);
    const variants = new Set();
    for (let shape = 0; shape < SHAPES.length; shape++) {
        for (let seed = 1; seed <= 120; seed++) {
            const map = generateMap(seed, shape);
            const distances = distancesFrom(map, map.start);
            assert.ok(map.cells.length >= 20, `${shape}/${seed}: too small`);
            assert.equal(distances.size, map.cells.length, `${shape}/${seed}: disconnected`);
            assert.ok(distances.get(keyOf(map.exit.x, map.exit.z)) >= Math.max(map.width, map.depth) - 1);
            assert.equal(Math.min(...map.cells.map(c => c.x)), 0);
            assert.equal(Math.min(...map.cells.map(c => c.z)), 0);
            assert.ok(map.cells.length < map.width * map.depth, 'Every template has an irregular footprint');
            assert.ok(map.cells.some(c => c.type === 'fragile'));
            for (const endpoint of [map.start, map.exit]) {
                assert.equal(map.cells.find(c => c.x === endpoint.x && c.z === endpoint.z).type, 'normal');
            }
            variants.add(map.cells.map(c => keyOf(c.x, c.z)).join(';'));
        }
    }
    assert.ok(variants.size > 200);
});

test('a seed reproduces the same board and endpoints', () => {
    assert.deepEqual(generateMap(7624, 8), generateMap(7624, 8));
});

test('16 patterns have distinct time signatures, active moments and safe moments', () => {
    assert.equal(PATTERNS.length, 16);
    const map = rectangle(13, 11);
    const signatures = [];
    PATTERNS.forEach((pattern, index) => {
        let hits = 0, safeFrames = 0;
        const signature = [];
        for (let frame = 0; frame < 160; frame++) {
            const active = map.cells.map(c => patternAt(index, c.x, c.z, map, frame / 160 * pattern.duration));
            hits += active.filter(Boolean).length;
            if (active.every(v => !v)) safeFrames++;
            signature.push(active.map(v => +v).join(''));
        }
        assert.ok(hits > 0, pattern.name);
        assert.ok(safeFrames > 0, `${pattern.name}: no pauses`);
        signatures.push(signature.join(''));
    });
    assert.equal(new Set(signatures).size, PATTERNS.length);
});

test('patterns span the bounding rectangle independently of missing tiles', () => {
    const map = generateMap(345, 0);
    const full = rectangle(map.width, map.depth);
    assert.ok(full.cells.some(c => !map.cellSet.has(keyOf(c.x, c.z))));
    for (let index = 0; index < PATTERNS.length; index++) {
        for (const cell of full.cells) {
            for (const t of [0.8, 1.8, 3.2, 5.1]) {
                assert.equal(patternAt(index, cell.x, cell.z, map, t), patternAt(index, cell.x, cell.z, full, t));
            }
        }
    }
});

test('movement is available immediately', () => {
    const game = createGame(rectangle());
    advance(game, 0.5, { x: 1 });
    assert.equal(game.status, 'playing');
    assert.ok(game.player.x > 4.6);
    assert.equal(patternAt(0, 3, 3, game.map, -0.01), false);
});

test('the wave advances from the first frame, including after retry', () => {
    const map = rectangle();
    map.start = { x: 0, z: 3 };
    const first = createGame(map);
    advance(first, 1.1);
    assert.equal(first.status, 'dead');
    assert.equal(first.reason, 'light');
    assert.ok(first.elapsed < 1.1);
    const retry = createGame(first.map, first.patternIndex);
    advance(retry, 1.1);
    assert.equal(retry.status, 'dead');
    assert.equal(retry.elapsed, first.elapsed);
});

test('diagonal movement is normalized and independent of frame subdivision', () => {
    const straight = createGame(rectangle()), diagonal = createGame(rectangle()), coarse = createGame(rectangle());
    advance(straight, 0.5, { x: 1 });
    advance(diagonal, 0.5, { x: 1, z: 1 });
    for (let i = 0; i < 5; i++) stepGame(coarse, { x: 1 }, 0.1);
    assert.ok(Math.abs(straight.player.x - coarse.player.x) < 1e-8);
    assert.ok(Math.abs(Math.hypot(diagonal.player.x - 3, diagonal.player.z - 3) - (straight.player.x - 3)) < 1e-8);
});

test('standing on an active cell loses immediately', () => {
    const game = createGame(rectangle());
    game.elapsed = lineTime(game.map, 3);
    stepGame(game, {}, 1 / 60);
    assert.equal(game.status, 'dead');
    assert.equal(game.reason, 'light');
});

test('the sphere footprint includes adjacent touched cells', () => {
    const map = rectangle();
    assert.equal(occupiedCells(map, { x: 3, z: 3 }).length, 1);
    assert.equal(occupiedCells(map, { x: 3.4, z: 3 }).length, 2);
    const game = createGame(map);
    game.player.x = 3.4;
    game.elapsed = lineTime(map, 4);
    stepGame(game, {}, 1 / 60);
    assert.equal(game.status, 'dead');
});

test('jumping protects in the air and allows movement, with no double jump', () => {
    const game = createGame(rectangle());
    game.elapsed = lineTime(game.map, 3);
    stepGame(game, { jump: true, x: 1 }, 1 / 60);
    advance(game, 0.2, { x: 1 });
    assert.equal(game.status, 'playing');
    assert.ok(game.player.h > 0.8);
    assert.ok(game.player.x > 3.7);
    const velocity = game.player.velocity;
    stepGame(game, { jump: true }, 1 / 60);
    assert.ok(game.player.velocity < velocity);
});

test('landing on an active cell loses in the landing step', () => {
    const game = createGame(rectangle());
    game.elapsed = lineTime(game.map, 3);
    game.player.h = 0.005;
    game.player.velocity = -2;
    stepGame(game, {}, 1 / 60);
    assert.equal(game.player.h, 0);
    assert.equal(game.status, 'dead');
});

test('jumping can cross a missing tile and land on the other side', () => {
    const map = rectangle(6, 1);
    map.cells = map.cells.filter(c => c.x !== 2);
    map.cellSet.delete('2,0');
    map.start = { x: 1, z: 0 };
    const game = createGame(map);
    stepGame(game, { jump: true, x: 1 }, 1 / 120);
    advance(game, 0.85, { x: 1 });
    assert.equal(game.status, 'playing');
    assert.equal(game.player.h, 0);
    assert.ok(game.player.x > 3.8);
    assert.equal(game.player.falling, false);
});

test('walking off the map falls and loses', () => {
    const map = rectangle(6, 6);
    map.start = { x: 0, z: 2 };
    const game = createGame(map);
    advance(game, 1, { x: -1 });
    assert.equal(game.status, 'dead');
    assert.equal(game.reason, 'fall');
});

test('exit requires a safe landing, and danger takes precedence over victory', () => {
    const map = rectangle();
    map.exit = { ...map.start };
    const game = createGame(map);
    stepGame(game, { jump: true }, 1 / 60);
    assert.equal(game.status, 'playing');
    advance(game, 0.85);
    assert.equal(game.status, 'won');
    const unsafe = createGame(map);
    unsafe.elapsed = lineTime(map, map.exit.x);
    stepGame(unsafe, {}, 1 / 60);
    assert.equal(unsafe.status, 'dead');
});

test('finished games stop and retry resets player, time and result', () => {
    const game = createGame(rectangle());
    game.status = 'dead';
    const before = structuredClone(game);
    stepGame(game, { x: 1, jump: true }, 0.1);
    assert.deepEqual(game, before);
    const retry = createGame(game.map, game.patternIndex);
    assert.equal(retry.elapsed, 0);
    assert.equal(retry.status, 'playing');
    assert.deepEqual({ x: retry.player.x, z: retry.player.z }, game.map.start);
});

test('new patterns contain multiple separated complete lines at the same instant', () => {
    const map = rectangle(15, 13);
    const hits = name => {
        const index = PATTERNS.findIndex(p => p.name === name);
        return map.cells.filter(c => patternAt(index, c.x, c.z, map, PATTERNS[index].duration / 2));
    };
    const groups = values => [...new Set(values)].sort((a, b) => a - b).filter((n, i, all) => i === 0 || n > all[i - 1] + 1).length;
    const vertical = hits('Двойной фронт');
    assert.equal(groups(vertical.map(c => c.x)), 2);
    for (const x of new Set(vertical.map(c => c.x))) assert.equal(vertical.filter(c => c.x === x).length, map.depth);
    const horizontal = hits('Тройной прилив');
    assert.equal(groups(horizontal.map(c => c.z)), 3);
    for (const z of new Set(horizontal.map(c => c.z))) assert.equal(horizontal.filter(c => c.z === z).length, map.width);
    assert.equal(groups(hits('Косой строй').map(c => c.x + c.z)), 3);
    const grid = hits('Сетка');
    assert.equal(groups(grid.filter(c => c.z === 0).map(c => c.x)), 2);
    assert.equal(groups(grid.filter(c => c.x === 0).map(c => c.z)), 2);
});

test('each level accelerates pattern time and collisions consistently', () => {
    const map = rectangle();
    assert.equal(patternSpeedForLevel(1), 1);
    assert.equal(patternSpeedForLevel(2), 1.08);
    for (let level = 2; level <= 25; level++) assert.ok(patternSpeedForLevel(level) > patternSpeedForLevel(level - 1));
    for (let index = 0; index < PATTERNS.length; index++) {
        for (const time of [0.85, 1.65, 2.35, 5.45]) {
            for (const c of map.cells) {
                assert.equal(patternAt(index, c.x, c.z, map, time / 1.8, 1.8), patternAt(index, c.x, c.z, map, time));
            }
        }
    }
    map.start = { x: 0, z: 3 };
    const slow = createGame(map, 0, 1), fast = createGame(map, 0, 11);
    advance(slow, 1.1);
    advance(fast, 1.1);
    assert.equal(slow.status, 'dead');
    assert.equal(fast.status, 'dead');
    assert.ok(Math.abs(fast.elapsed * fast.patternSpeed - slow.elapsed) < 0.02);
});

function fragileGame(redCells = [[3, 3]]) {
    const map = rectangle();
    map.cells.forEach(c => { c.type = redCells.some(([x, z]) => c.x === x && c.z === z) ? 'fragile' : 'normal'; });
    const game = createGame(map, 0, 4);
    game.elapsed = -100;
    return game;
}

test('a red tile remains under the footprint and disappears after walking clear', () => {
    const game = fragileGame();
    advance(game, 0.2, { x: 1 });
    assert.ok(game.map.cellSet.has('3,3'), 'The edge of the sphere still touches the red tile');
    advance(game, 0.05, { x: 1 });
    assert.equal(game.map.cellSet.has('3,3'), false);
    assert.equal(game.status, 'playing');
    assert.equal(game.map.width, 12);
    assert.equal(game.map.depth, 12);
    assert.equal(game.map.cells.length, 144, 'The original layout remains available for retry');
});

test('standing and repeated vertical jumps preserve a red tile', () => {
    const game = fragileGame();
    advance(game, 1);
    for (let jump = 0; jump < 3; jump++) {
        stepGame(game, { jump: true }, 1 / 120);
        advance(game, 0.9);
        assert.ok(game.map.cellSet.has('3,3'));
        assert.equal(game.player.h, 0);
        assert.equal(game.status, 'playing');
    }
});

test('moving away in a jump removes a touched red tile while airborne', () => {
    const game = fragileGame();
    stepGame(game, { jump: true, x: 1 }, 1 / 120);
    advance(game, 0.3, { x: 1 });
    assert.ok(game.player.h > 0);
    assert.equal(game.map.cellSet.has('3,3'), false);
    assert.equal(game.status, 'playing');
});

test('flying over a red tile does not arm it, but landing does', () => {
    const game = fragileGame([[4, 3]]);
    stepGame(game, { jump: true, x: 1 }, 1 / 120);
    advance(game, 0.85, { x: 1 });
    assert.ok(game.map.cellSet.has('4,3'));
    assert.equal(game.armedCells.has('4,3'), false);
    Object.assign(game.player, { x: 4, z: 3, h: 0.005, velocity: -2 });
    stepGame(game, {}, 1 / 120);
    assert.ok(game.armedCells.has('4,3'));
    advance(game, 0.3, { x: 1 });
    assert.equal(game.map.cellSet.has('4,3'), false);
});

test('returning to a vanished red tile falls through the hole', () => {
    const game = fragileGame();
    advance(game, 0.4, { x: 1 });
    advance(game, 1, { x: -1 });
    assert.equal(game.status, 'dead');
    assert.equal(game.reason, 'fall');
});

test('overlapping red tiles disappear individually after the footprint leaves each', () => {
    const game = fragileGame([[3, 3], [4, 3]]);
    game.player.x = 3.5;
    advance(game, 0.1, { x: 1 });
    assert.equal(game.map.cellSet.has('3,3'), false);
    assert.ok(game.map.cellSet.has('4,3'));
    advance(game, 0.3, { x: 1 });
    assert.equal(game.map.cellSet.has('4,3'), false);
    assert.equal(game.status, 'playing');
});

test('retry restores red tiles and keeps the same level speed without mutating another attempt', () => {
    const game = fragileGame();
    const otherAttempt = createGame(game.map, game.patternIndex, game.level);
    advance(game, 0.3, { x: 1 });
    const retry = createGame(game.map, game.patternIndex, game.level);
    assert.equal(game.map.cellSet.has('3,3'), false);
    assert.ok(retry.map.cellSet.has('3,3'));
    assert.ok(otherAttempt.map.cellSet.has('3,3'));
    assert.equal(retry.patternSpeed, game.patternSpeed);
    assert.equal(retry.level, game.level);
    assert.equal(retry.elapsed, 0);
    assert.equal(retry.armedCells.size, 0);
    assert.deepEqual(retry.map.cells, game.map.cells);
});
