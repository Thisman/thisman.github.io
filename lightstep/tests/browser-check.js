// Run with playwright-cli run-code --filename lightstep/tests/browser-check.js in a fresh session.
// The state probe is injected into this browser's response only, never into the shipped app.
async (page) => {
    page.setDefaultTimeout(5000);
    const checks = [];
    const errors = [];
    const check = (condition, message) => { if (!condition) throw new Error(message); checks.push(message); };
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/lightstep/index.js', async route => {
        const response = await route.fetch();
        const body = await response.text();
        await route.fulfill({ response, body: body + '\nwindow.__lightstep = { get state() { return { game, paused, level, attempt, view }; } };' });
    });
    await page.route('**/lightstep/view.js', async route => {
        const response = await route.fetch();
        const body = (await response.text()).replace('return { build, render, resize };', 'return { build, render, resize, readTileColor(index) { const color = new THREE.Color(); tops.getColorAt(index, color); return color.getHexString(); }, isTileVisible(index) { const top = new THREE.Matrix4(), side = new THREE.Matrix4(); tops.getMatrixAt(index, top); sides.getMatrixAt(index, side); return top.elements[0] !== 0 || side.elements[0] !== 0; } };');
        await route.fulfill({ response, body });
    });
    await page.clock.install();
    await page.setViewportSize({ width: 1440, height: 1272 });
    await page.reload();
    await page.waitForFunction(() => !!window.__lightstep);
    // Isolate keyboard handling from randomly selected hazards; collisions are exercised below.
    await page.evaluate(() => { window.__lightstep.state.game.elapsed = -100; });
    await page.clock.pauseAt(new Date(Date.now() + 1000));
    const state = () => page.evaluate(() => {
        const { game, paused, level, attempt } = window.__lightstep.state;
        return { status: game.status, elapsed: game.elapsed, paused, level, attempt, patternSpeed: game.patternSpeed, player: { ...game.player }, map: { ...game.map, cellSet: [...game.map.cellSet] }, patternIndex: game.patternIndex };
    });
    check(await page.locator('#stage').getAttribute('data-state') === 'playing', 'Starts immediately in a real WebGL browser');
    check(await page.locator('#result').isHidden(), 'No start overlay');
    await page.keyboard.press('Escape');
    const pausedAt = (await state()).elapsed;
    await page.clock.runFor(1000);
    check((await state()).elapsed === pausedAt && (await state()).paused, 'Pause freezes physics and pattern time');
    await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
    check(!(await state()).paused, 'Resume button restores play');

    let initial = await state();
    const directions = [[1, 0, 'd'], [-1, 0, 'a'], [0, 1, 's'], [0, -1, 'w']];
    const direction = directions.find(([dx, dz]) => initial.map.cellSet.includes(`${initial.player.x + dx},${initial.player.z + dz}`));
    await page.keyboard.down(direction[2]);
    await page.keyboard.press('Space');
    await page.clock.runFor(200);
    let moved = await state();
    check(moved.player.h > 0.7 && Math.hypot(moved.player.x - initial.player.x, moved.player.z - initial.player.z) > 0.5, 'Real WASD and Space move the sphere while airborne');
    await page.keyboard.press('Space');
    await page.clock.runFor(32);
    check((await state()).player.velocity < moved.player.velocity, 'Space cannot double jump');
    await page.keyboard.up(direction[2]);
    await page.clock.runFor(700);
    check((await state()).player.h === 0, 'Jump lands back on the board');

    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    check((await state()).paused, 'Losing window focus pauses the game');
    await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
    const stopped = (await state()).player;
    await page.clock.runFor(100);
    check((await state()).player.x === stopped.x && (await state()).player.z === stopped.z, 'Focus loss clears held movement');

    // Select an exact collision instant; the browser still advances the actual game loop.
    await page.evaluate(() => {
        const { game } = window.__lightstep.state;
        game.patternIndex = 0;
        Object.assign(game.player, game.map.start, { h: 0, velocity: 0, falling: false });
        game.elapsed = (game.player.x + 2) / (game.map.width + 3) * 7.6 / game.patternSpeed;
    });
    await page.clock.runFor(32);
    check((await state()).status === 'dead' && await page.locator('#result').isVisible(), 'White-cell collision opens the loss UI');
    const lost = await state();
    await page.getByRole('button', { name: 'Повторить', exact: true }).click();
    const retried = await state();
    check(retried.status === 'playing' && retried.map.seed === lost.map.seed && retried.patternIndex === lost.patternIndex && retried.attempt === lost.attempt + 1, 'Retry preserves board and pattern and increments attempts');
    check(retried.patternSpeed === lost.patternSpeed, 'Retry preserves the current pattern speed');

    const redTile = await page.evaluate(() => {
        const { game, view } = window.__lightstep.state;
        game.elapsed = -100;
        const dirs = [[1,0,'d'],[-1,0,'a'],[0,1,'s'],[0,-1,'w']];
        const index = game.map.cells.findIndex(c => c.type === 'fragile' && dirs.some(([dx, dz]) => game.map.cellSet.has(`${c.x + dx},${c.z + dz}`)));
        const cell = game.map.cells[index];
        const direction = dirs.find(([dx, dz]) => game.map.cellSet.has(`${cell.x + dx},${cell.z + dz}`));
        view.render(game);
        const color = view.readTileColor(index);
        Object.assign(game.player, { x: cell.x, z: cell.z, h: 0, velocity: 0, falling: false });
        return { index, key: `${cell.x},${cell.z}`, direction: direction[2], color };
    });
    check(redTile.color === 'ae625b', 'Fragile cells have a matte red surface');
    await page.clock.runFor(32);
    await page.keyboard.press('Space');
    await page.clock.runFor(300);
    check((await state()).player.h > 0 && (await state()).map.cellSet.includes(redTile.key), 'A vertical jump preserves the red tile');
    await page.clock.runFor(600);
    await page.keyboard.down(redTile.direction);
    await page.clock.runFor(250);
    await page.keyboard.up(redTile.direction);
    check(!(await state()).map.cellSet.includes(redTile.key), 'Walking off a red tile removes its support');
    check(await page.evaluate(index => !window.__lightstep.state.view.isTileVisible(index), redTile.index), 'Both the top and side disappear in 3D');
    await page.keyboard.press('r');
    await page.clock.runFor(32);
    check((await state()).map.cellSet.includes(redTile.key) && await page.evaluate(index => window.__lightstep.state.view.isTileVisible(index), redTile.index), 'Retry restores the red tile and both meshes');

    // Follow a generated route with real keyboard input; hold hazards back for this UI transition check.
    const route = await page.evaluate(() => {
        const { game } = window.__lightstep.state;
        game.elapsed = -100;
        const map = game.map;
        const queue = [{ ...map.start, path: [] }], seen = new Set();
        for (let i = 0; i < queue.length; i++) {
            const c = queue[i];
            if (c.x === map.exit.x && c.z === map.exit.z) return c.path;
            for (const [dx, dz, key] of [[1,0,'d'],[-1,0,'a'],[0,1,'s'],[0,-1,'w']]) {
                const x = c.x + dx, z = c.z + dz, id = `${x},${z}`;
                if (map.cellSet.has(id) && !seen.has(id)) { seen.add(id); queue.push({ x, z, path: [...c.path, key] }); }
            }
        }
    });
    for (const key of route) {
        await page.keyboard.down(key);
        await page.clock.runFor(294);
        await page.keyboard.up(key);
    }
    check((await state()).status === 'won', 'Keyboard traversal reaches the exit on a generated board');
    await page.clock.runFor(1100);
    check((await state()).level === retried.level + 1 && (await state()).status === 'playing', 'Exit automatically opens a newly generated next level');
    check((await state()).patternSpeed > retried.patternSpeed, 'Winning a level speeds up the next pattern');

    await page.keyboard.press('n');
    const next = await state();
    check(next.attempt === 1 && next.level === retried.level + 1, 'New-map shortcut keeps level and resets attempts');
    const forms = new Set([next.map.shapeIndex]), patterns = new Set([next.patternIndex]);
    for (let i = 0; i < 32; i++) {
        await page.keyboard.press('n');
        const s = await state();
        forms.add(s.map.shapeIndex); patterns.add(s.patternIndex);
    }
    check(forms.size === 12 && patterns.size === 16, 'All 12 forms and 16 patterns render through real map changes');

    const warningChecks = await page.evaluate(async () => {
        const { PATTERNS, patternAt } = await import('/lightstep/game.js');
        const { game, view } = window.__lightstep.state;
        const saved = { patternIndex: game.patternIndex, elapsed: game.elapsed, player: { ...game.player } };
        const expectedWarnings = ['Гребёнка', 'Шахматный пульс', 'Дождь'];
        game.player.falling = true;
        const results = PATTERNS.map((pattern, index) => {
            game.patternIndex = index;
            for (let time = 0; time < pattern.duration; time += 0.05) {
                const tile = game.map.cells.findIndex(c => c.type !== 'fragile' && (c.x !== game.map.exit.x || c.z !== game.map.exit.z) && !patternAt(index, c.x, c.z, game.map, time, game.patternSpeed) && patternAt(index, c.x, c.z, game.map, time + 0.48, game.patternSpeed));
                if (tile < 0) continue;
                game.elapsed = time;
                view.render(game);
                const before = view.readTileColor(tile);
                game.elapsed = time + 0.48;
                view.render(game);
                const active = view.readTileColor(tile);
                return { name: pattern.name, valid: (before !== '35433e') === expectedWarnings.includes(pattern.name) && active === 'f9f7ef' };
            }
            return { name: pattern.name, valid: false };
        });
        Object.assign(game, saved);
        return results;
    });
    for (const result of warningChecks) check(result.valid, `Correct grey warning and white activation: ${result.name}`);

    await page.keyboard.press('r');
    await page.evaluate(async () => {
        const { PATTERNS } = await import('/lightstep/game.js');
        const { game, view } = window.__lightstep.state;
        game.patternIndex = PATTERNS.findIndex(p => p.name === 'Двойной фронт');
        game.elapsed = PATTERNS[game.patternIndex].duration / 2 / game.patternSpeed;
        view.render(game);
    });
    await page.screenshot({ path: 'output/playwright/lightstep-desktop-final.png' });
    for (const [width, height] of [[390,844], [640,900], [844,390], [1280,720]]) {
        await page.setViewportSize({ width, height });
        await page.clock.runFor(32);
        check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `No horizontal overflow at ${width}x${height}`);
        check(await page.evaluate(() => document.querySelector('.game-shell').getBoundingClientRect().bottom <= innerHeight + 1), `Game fits vertically at ${width}x${height}`);
        const box = await page.locator('#game-canvas').boundingBox();
        check(box.width > 200 && box.height > 150, `Visible 3D canvas at ${width}x${height}`);
        if (width === 390) {
            await page.keyboard.press('r');
            await page.clock.runFor(32);
            await page.screenshot({ path: 'output/playwright/lightstep-mobile.png' });
            check(await page.locator('#touch-jump').isVisible(), 'Touch controls are visible on narrow screens');
            const jumpBox = await page.locator('#touch-jump').boundingBox();
            await page.mouse.move(jumpBox.x + jumpBox.width / 2, jumpBox.y + jumpBox.height / 2);
            await page.mouse.down();
            await page.clock.runFor(200);
            check((await state()).player.h > 0, 'Touch jump is connected to the game loop');
            await page.locator('#touch-jump').dispatchEvent('pointercancel', { pointerId: 1, pointerType: 'mouse', bubbles: true });
            await page.mouse.up();
            check(!(await page.locator('#touch-jump').getAttribute('class') || '').includes('pressed'), 'Cancelled touch releases its button');
        }
    }
    check(errors.length === 0, `No browser exceptions: ${errors.join('; ')}`);
    await page.clock.resume();
    return { checks, errors };
}
