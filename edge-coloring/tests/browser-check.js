// Run with playwright-cli run-code --filename edge-coloring/tests/browser-check.js.
async (page) => {
    const key = 'edge-coloring:current:v1', checks = [], errors = [];
    const check = (value, message) => { if (!value) throw new Error(message); checks.push(message); };
    page.setDefaultTimeout(15000);
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('http://127.0.0.1:4173/edge-coloring/');
    const ready = () => page.waitForFunction(() => document.querySelector('#graph-stage').getAttribute('aria-busy') === 'false' && document.querySelector('#loader').hidden);
    const saved = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
    const edge = id => page.locator('[data-edge-id="' + id + '"]');
    const clickEdge = async (id, button = 'left', shift = false) => {
        const point = await edge(id).locator('.edge-hit').evaluate(line => {
            const p = new DOMPoint((+line.getAttribute('x1') + +line.getAttribute('x2')) / 2, (+line.getAttribute('y1') + +line.getAttribute('y2')) / 2).matrixTransform(line.getScreenCTM());
            return { x: p.x, y: p.y };
        });
        if (shift) await page.keyboard.down('Shift');
        try { await page.mouse.click(point.x, point.y, { button }); }
        finally { if (shift) await page.keyboard.up('Shift'); }
    };
    const boxes = () => page.evaluate(() => ['#difficulties', '#graph-stage', '#palette', '#timer'].map(selector => {
        const { x, y, width, height } = document.querySelector(selector).getBoundingClientRect();
        return { x, y, width, height };
    }));
    const sameBoxes = (a, b) => a.every((rect, i) => Object.keys(rect).every(key => Math.abs(rect[key] - b[i][key]) < 0.1));
    await ready();
    check(await page.getByRole('tab').allTextContents().then(names => names.join() === 'Intro,Easy,Normal,Hard,Expert,Extreme'), 'Six named difficulty tabs replace numerical levels');
    for (const [name, size, total, count] of [['Intro',5,40,20], ['Easy',6,60,29], ['Normal',7,84,40], ['Hard',8,112,52], ['Expert',9,144,65], ['Extreme',9,144,58]]) {
        const started = Date.now();
        await page.getByRole('tab', { name, exact: true }).click(); await ready();
        check(Date.now() - started >= 1950, 'Loader stays visible for at least two seconds for ' + name);
        const state = await saved();
        check(await page.locator('#graph').getAttribute('aria-label') === 'Сетка графа ' + size + ' на ' + size, 'Accessible grid description matches ' + name);
        const restored = JSON.stringify(state);
        await page.reload(); await ready();
        check(JSON.stringify(await saved()) === restored, 'Reload restores dimensions and clues for ' + name);
        check(state.version === 6 && state.puzzle.clueCount === count && state.puzzle.solverMetrics.solutions === 1 && await page.locator('.edge.is-locked').count() === count, name + ' generates the exact number of protected clues');
        check(await page.getByRole('tab', { name, exact: true }).getAttribute('aria-selected') === 'true' && state.puzzle.gridSize === size && await page.locator('.edge').count() === total && await page.locator('.vertex').count() === size ** 2 && await page.locator('.edge:not(.is-locked)').count() === total - count, name + ' matches the requested grid size, edge count and remaining edges');
        const editable = state.puzzle.edges.find(edge => !edge.locked);
        await clickEdge(editable.id, 'right');
        const nextColor = (state.selectedColor + 1) % 4, after = await saved();
        check(after.selectedColor === nextColor && after.puzzle.edges.find(edge => edge.id === editable.id).paintedColor === nextColor && await page.locator('.swatch[aria-pressed="true"]').getAttribute('data-color') === String(nextColor), 'Right-click cycles and paints correctly on ' + size + 'x' + size);
    }
    check(await page.title() === 'Edgoku', 'Browser title uses Edgoku');
    const oldSeed = (await saved()).puzzle.seed;
    await page.getByRole('tab', { name: 'Extreme', exact: true }).click(); await ready();
    check((await saved()).puzzle.seed !== oldSeed, 'Clicking the active tab creates another puzzle');

    for (const [width, height] of [[1440,1000], [900,700], [1280,720], [390,844], [320,568], [844,390]]) {
        await page.setViewportSize({ width, height });
        const before = await boxes();
        await page.locator('.game-title').evaluate(title => { title.hidden = true; });
        check(sameBoxes(before, await boxes()), 'Edgoku title does not shift the existing content at ' + width + 'x' + height);
        await page.locator('.game-title').evaluate(title => { title.hidden = false; });
        check(await page.locator('.game-title').evaluate(title => {
            const heading = title.getBoundingClientRect(), tabs = document.querySelector('#difficulties').getBoundingClientRect();
            return title.textContent === 'Edgoku' && heading.top >= 0 && heading.top <= 10 && Math.abs(heading.x + heading.width / 2 - innerWidth / 2) < 1 && heading.bottom <= tabs.top;
        }), 'Title stays centered at the top without covering the tabs at ' + width + 'x' + height);
        let release;
        const gate = new Promise(resolve => { release = resolve; });
        const route = async request => { await gate; await request.continue().catch(() => {}); };
        await page.route('**/generation-worker.js', route);
        try {
            await page.getByRole('tab', { name: 'Hard', exact: true }).click();
            check(await page.locator('#loader').isVisible() && await page.locator('#graph').isHidden(), 'Loader replaces graph during generation at ' + width + 'x' + height);
            check(sameBoxes(before, await boxes()), 'Starting generation does not move tabs, graph, timer or palette at ' + width + 'x' + height);
            check(await page.locator('#loader').evaluate(loader => {
                const a = loader.getBoundingClientRect(), b = loader.parentElement.getBoundingClientRect();
                return Math.abs(a.x + a.width / 2 - b.x - b.width / 2) < 0.1 && Math.abs(a.y + a.height / 2 - b.y - b.height / 2) < 0.1;
            }), 'Loader is centered in the reserved graph area');
            await page.getByRole('tab', { name: 'Extreme', exact: true }).click();
            await page.getByRole('tab', { name: 'Easy', exact: true }).click();
            check(await page.getByRole('tab', { name: 'Easy', exact: true }).getAttribute('aria-selected') === 'true' && await page.locator('#loader').isVisible(), 'Tabs stay responsive and select the newest request while generation is pending');
            release(); await ready();
            check((await saved()).puzzle.difficulty === 'easy' && await page.locator('.edge.is-locked').count() === 29, 'Cancelled generation cannot replace the latest Easy puzzle');
            check(sameBoxes(before, await boxes()), 'Finishing generation leaves all layout positions unchanged at ' + width + 'x' + height);
            check(await page.evaluate(() => {
                const game = document.querySelector('#game').getBoundingClientRect(), stage = document.querySelector('#graph-stage').getBoundingClientRect();
                return game.top >= 0 && game.bottom <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth && Math.abs(stage.width - stage.height) < 0.1;
            }), 'Full interface fits ' + width + 'x' + height);
            if (width === 390) await page.screenshot({ path: 'output/playwright/edgoku-difficulty-mobile.png' });
        } finally { release(); await page.unroute('**/generation-worker.js', route); }
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    let state = await saved();
    check(state.puzzle.startedAt === null && await page.locator('#timer').innerText() === '00:00', 'Generation never starts the play timer');
    const clue = state.puzzle.edges.find(edge => edge.locked);
    for (const color of [1,2,3,4]) {
        await page.keyboard.press(String(color)); await clickEdge(clue.id);
        await edge(clue.id).focus(); await page.keyboard.press('Enter'); await page.keyboard.press('Space');
    }
    check(JSON.stringify((await saved()).puzzle) === JSON.stringify(state.puzzle), 'Protected clues reject mouse and keyboard changes');
    const target = state.puzzle.edges.find(edge => !edge.locked);
    await clickEdge(clue.id, 'left', true);
    await clickEdge(target.id, 'left', true);
    check(JSON.stringify((await saved()).puzzle) === JSON.stringify(state.puzzle), 'Shift-click leaves clues and empty edges unchanged without starting time');
    await page.keyboard.press('4'); await clickEdge(target.id);
    state = await saved();
    check(state.puzzle.edges.find(edge => edge.id === target.id).paintedColor === 3 && state.puzzle.startedAt !== null, 'Editable edges paint and start the timer');
    await page.waitForFunction(() => document.querySelectorAll('clipPath').length === 0);
    check(await page.locator('[data-sector-edge="' + target.id + '"]').evaluateAll(paths => paths.length === 2 && paths.every(path => path.style.fill !== '')), 'Paint reaches both vertex sectors');
    await clickEdge(target.id);
    check((await saved()).puzzle.edges.find(edge => edge.id === target.id).paintedColor === null, 'Repeating the same color erases an editable edge');
    await clickEdge(target.id);
    await page.keyboard.press('1');
    await clickEdge(target.id, 'left', true);
    let erased = await saved();
    check(erased.puzzle.edges.find(edge => edge.id === target.id).paintedColor === null && erased.selectedColor === 0 && erased.puzzle.startedAt === state.puzzle.startedAt, 'Shift-click erases during a paint wave regardless of selected color and preserves selection and time');
    await page.waitForFunction(() => document.querySelectorAll('clipPath').length === 0);
    check(await page.locator('[data-sector-edge="' + target.id + '"]').evaluateAll(paths => paths.length === 2 && paths.every(path => path.style.fill === 'var(--edge)')), 'Erasing returns both vertex sectors to gray');
    await clickEdge(target.id, 'left', true);
    check(JSON.stringify(await saved()) === JSON.stringify(erased), 'Repeated Shift-click on an empty edge is a no-op');
    await clickEdge(target.id);
    await page.keyboard.press('2'); await clickEdge(target.id);
    check((await saved()).puzzle.edges.find(edge => edge.id === target.id).paintedColor === 1, 'Ordinary left-click still repaints with a different active color');
    await clickEdge(target.id, 'right', true);
    check((await saved()).selectedColor === 2 && (await saved()).puzzle.edges.find(edge => edge.id === target.id).paintedColor === 2, 'Shift does not change right-click cycling and painting');
    await clickEdge(target.id, 'left', true);
    const partial = await saved();
    await page.reload(); await ready();
    check(JSON.stringify(await saved()) === JSON.stringify(partial) && await page.getByRole('tab', { name: 'Easy', exact: true }).getAttribute('aria-selected') === 'true', 'Reload restores the puzzle, difficulty, colors and running timestamp');
    await page.waitForFunction(() => document.querySelector('#timer').textContent !== '00:00');
    await page.evaluate(key => {
        const saved = JSON.parse(localStorage.getItem(key));
        const last = saved.puzzle.edges.find(edge => !edge.locked);
        for (const edge of saved.puzzle.edges) if (!edge.locked) edge.paintedColor = edge.id === last.id ? null : edge.solutionColor;
        localStorage.setItem(key, JSON.stringify(saved));
    }, key);
    await page.reload(); await ready();
    const last = (await saved()).puzzle.edges.find(edge => edge.paintedColor === null);
    await page.keyboard.press(String(last.solutionColor + 1)); await edge(last.id).focus(); await page.keyboard.press('Enter');
    await page.locator('#completion').waitFor({ state: 'visible' });
    check((await saved()).puzzle.finishedAt !== null && await page.locator('clipPath').count() === 0, 'Win freezes time and waits for the paint wave');
    await page.keyboard.press('Escape');
    check(await page.locator('#completion').isVisible(), 'Completion dialog blocks Escape');
    const finished = await saved();
    await page.reload(); await ready();
    check(await page.locator('#completion').isVisible() && JSON.stringify(await saved()) === JSON.stringify(finished), 'Completed puzzle restores its frozen result');
    await page.getByRole('button', { name: 'Новый граф' }).click(); await ready();
    check((await saved()).puzzle.difficulty === 'easy' && (await saved()).puzzle.paletteIndex !== finished.puzzle.paletteIndex && (await saved()).puzzle.startedAt === null, 'New graph retains difficulty, changes palette and resets time');
    await page.getByRole('tab', { name: 'Easy', exact: true }).focus(); await page.keyboard.press('ArrowRight'); await ready();
    check((await saved()).puzzle.difficulty === 'normal', 'Arrow keys switch difficulty tabs accessibly');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const editable = (await saved()).puzzle.edges.find(edge => !edge.locked);
    await clickEdge(editable.id);
    check(await page.locator('clipPath').count() === 0 && await edge(editable.id).getAttribute('aria-pressed') === 'true', 'Reduced motion preserves painting without waves');
    await page.emulateMedia({ reducedMotion: 'no-preference' });

    const context = await page.context().browser().newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    try {
        const mobile = await context.newPage();
        await mobile.addInitScript(() => {
            Storage.prototype.getItem = () => { throw new DOMException('Blocked', 'SecurityError'); };
            Storage.prototype.setItem = () => { throw new DOMException('Blocked', 'SecurityError'); };
        });
        await mobile.goto(page.url());
        await mobile.waitForFunction(() => document.querySelector('#loader').hidden);
        await mobile.getByRole('tab', { name: 'Normal', exact: true }).tap();
        await mobile.waitForFunction(() => document.querySelector('#loader').hidden);
        const hit = mobile.locator('.edge:not(.is-locked)').first();
        const point = await hit.locator('.edge-hit').evaluate(line => {
            const point = new DOMPoint((+line.getAttribute('x1') + +line.getAttribute('x2')) / 2, (+line.getAttribute('y1') + +line.getAttribute('y2')) / 2).matrixTransform(line.getScreenCTM());
            return { x: point.x, y: point.y };
        });
        await mobile.touchscreen.tap(point.x, point.y);
        check(await hit.getAttribute('aria-pressed') === 'true', 'Touch generation and painting work with blocked storage');
    } finally { await context.close(); }

    await page.evaluate(key => localStorage.setItem(key, JSON.stringify({ version: 4, selectedColor: 0, puzzle: {} })), key);
    await page.reload(); await ready();
    check((await saved()).version === 6 && (await saved()).puzzle.difficulty === 'intro', 'Legacy saves start a unique Intro puzzle');
    const failRoute = request => request.fulfill({ status: 200, contentType: 'text/javascript', body: 'self.onmessage = () => self.postMessage({error:true});' });
    await page.route('**/generation-worker.js', failRoute);
    await page.getByRole('tab', { name: 'Hard', exact: true }).click();
    await page.locator('#retry-generation').waitFor({ state: 'visible' });
    check(await page.getByRole('tab', { name: 'Hard', exact: true }).isEnabled(), 'Generation failure leaves tabs usable and offers retry');
    await page.unroute('**/generation-worker.js', failRoute);
    await page.locator('#retry-generation').click(); await ready();
    check((await saved()).puzzle.difficulty === 'hard', 'Retry generates the selected difficulty after an error');
    await page.screenshot({ path: 'output/playwright/edgoku-difficulty-desktop.png' });
    check(errors.length === 0, 'No browser exceptions');
    return { checks: checks.length, details: checks, errors };
}
