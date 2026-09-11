// playwright-cli run-code --filename edge-coloring/tests/animation-check.js
async (page) => {
    const key = 'edge-coloring:current:v1';
    const checks = [], errors = [];
    const check = (ok, message) => { if (!ok) throw new Error(message); checks.push(message); };
    page.on('pageerror', error => errors.push(error.message));
    page.setDefaultTimeout(5000);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('http://127.0.0.1:4173/edge-coloring/');
    await page.clock.install();
    await page.clock.pauseAt(new Date());
    try {
        const saved = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
        let ids;
        const fixture = async index => {
            ids = await page.evaluate(async ({ key, index }) => {
                const { generatePuzzle } = await import('/edge-coloring/generator.js');
                const puzzle = generatePuzzle({ difficulty: 'expert', seed: 'animation-' + index });
                const editable = puzzle.edges.filter(edge => !edge.locked);
                const pair = puzzle.vertices.map(vertex => editable.filter(edge => edge.a === vertex.id || edge.b === vertex.id)).find(edges => edges.length >= 2).slice(0, 2);
                const ids = [...pair, editable.find(edge => !pair.includes(edge))].map(edge => edge.id);
                localStorage.setItem(key, JSON.stringify({ version: 6, puzzle, selectedColor: 0 }));
                return ids;
            }, { key, index });
            await page.reload();
        };
        const edge = id => page.locator(`.edge[data-edge-id="${id}"]`);
        const fills = id => page.locator(`[data-sector-edge="${id}"]`).evaluateAll(elements => elements.map(element => getComputedStyle(element).fill));
        const stroke = id => edge(id).locator('.edge-line').evaluate(line => getComputedStyle(line).stroke);
        const gray = 'rgb(184, 188, 199)';
        const click = async (id, fraction = 0.3) => {
            const point = await edge(id).locator('.edge-hit').evaluate((line, fraction) => {
                const a = { x: +line.getAttribute('x1'), y: +line.getAttribute('y1') };
                const b = { x: +line.getAttribute('x2'), y: +line.getAttribute('y2') };
                const x = a.x + (b.x - a.x) * fraction, y = a.y + (b.y - a.y) * fraction;
                const screen = new DOMPoint(x, y).matrixTransform(line.getScreenCTM());
                return { x, y, a, b, screenX: screen.x, screenY: screen.y };
            }, fraction);
            await page.mouse.click(point.screenX, point.screenY);
            return point;
        };
        const keyboardPaint = async (id, color) => {
            await page.keyboard.press(String(color + 1));
            await edge(id).focus();
            await page.keyboard.press('Enter');
        };
        await fixture(1);
        check(await page.locator('.vertex-sector').count() === 288 && (await fills(ids[0])).every(fill => fill === gray), 'Each incident edge owns one initially gray sector at both endpoints');
        const origin = await click(ids[0]);
        const circle = page.locator('clipPath circle');
        check(Math.abs(+await circle.getAttribute('cx') - origin.x) < 1 && Math.abs(+await circle.getAttribute('cy') - origin.y) < 1, `The wave starts at the actual off-center pointer position in SVG coordinates: ${JSON.stringify({ expected: origin, x: await circle.getAttribute('cx'), y: await circle.getAttribute('cy') })}`);
        check(await stroke(ids[0]) === gray && await page.locator('.edge-wave').count() === 1 && await page.locator('.vertex-sector-wave').count() === 2, 'The new color overlays the old edge and its two sectors through one shared wave');
        check((await saved()).puzzle.edges.find(edge => edge.id === ids[0]).paintedColor === 0, 'Game state is saved immediately while its painting animation runs');
        await page.clock.runFor(150);
        const radius = +await circle.getAttribute('r');
        check(radius > Math.hypot(origin.x - origin.a.x, origin.y - origin.a.y) && radius < Math.hypot(origin.x - origin.b.x, origin.y - origin.b.y) - 16, 'The color reaches the nearer vertex before the farther vertex');
        await page.screenshot({ path: 'output/playwright/edge-coloring-wave.png' });
        await page.clock.runFor(200);
        const firstColor = await stroke(ids[0]);
        check(await page.locator('clipPath, .edge-wave, .vertex-sector-wave').count() === 0 && firstColor !== gray && (await fills(ids[0])).every(fill => fill === firstColor), 'After 300 ms, the edge and both endpoint sectors share their final color and overlays are removed');
        check((await fills(ids[1])).every(fill => fill === gray) && (await fills(ids[2])).every(fill => fill === gray), 'Other sectors at the same vertex stay gray');
        await page.keyboard.press('2');
        await click(ids[0]);
        await page.clock.runFor(80);
        await page.keyboard.press('4');
        await click(ids[0], 0.65);
        check(await page.locator('clipPath').count() === 1, 'A rapid repaint replaces the previous wave instead of leaving overlapping stale animations');
        await page.clock.runFor(350);
        const fourthColor = await stroke(ids[0]);
        check(fourthColor !== gray && fourthColor !== firstColor && (await fills(ids[0])).every(fill => fill === fourthColor) && (await saved()).puzzle.edges.find(edge => edge.id === ids[0]).paintedColor === 3, 'Rapid repainting in the fourth color wins on the edge, both sectors and saved state');
        await click(ids[0]);
        await page.clock.runFor(350);
        check(await stroke(ids[0]) === gray && (await fills(ids[0])).every(fill => fill === gray), 'Erasing restores gray on both sectors as well as the edge');

        await keyboardPaint(ids[0], 0);
        const line = edge(ids[0]).locator('.edge-line');
        check(Math.abs(+await page.locator('clipPath circle').getAttribute('cx') - (+await line.getAttribute('x1') + +await line.getAttribute('x2')) / 2) < 0.01, 'Keyboard painting starts the wave in the middle of the edge');
        await keyboardPaint(ids[1], 1);
        check(await page.locator('clipPath').count() === 2, 'Adjacent edges can animate independently at the same shared vertex');
        await page.clock.runFor(350);
        for (const id of [ids[0], ids[1]]) {
            const color = await stroke(id);
            check((await fills(id)).every(fill => fill === color), `Both sectors remain synchronized with ${id} after concurrent waves`);
        }
        await keyboardPaint(ids[0], 2);
        await page.clock.runFor(80);
        const partial = await saved();
        await page.reload();
        const reloadedColor = await stroke(ids[0]);
        check(JSON.stringify(await saved()) === JSON.stringify(partial) && await page.locator('clipPath').count() === 0 && (await fills(ids[0])).every(fill => fill === reloadedColor), 'Reload during a wave restores the final saved color with no unfinished effects');

        check(await page.locator('[data-vertex-id="v0"] .vertex-sector').count() === 2, 'A corner vertex is rendered as two semicircles');
        check(await page.locator('[data-vertex-id="v1"] .vertex-sector').count() === 3, 'A boundary vertex is rendered as three equal sectors');
        await fixture(1);
        check(await page.locator('.vertex-sector').count() === 288 && await page.locator('[data-vertex-id="v40"] .vertex-sector').count() === 4, 'Every edge has two sectors and an interior junction has four quarter-circle sectors');
        await page.evaluate(({ key, ids }) => {
            const state = JSON.parse(localStorage.getItem(key));
            state.puzzle.edges.forEach((edge, i) => { if (!ids.slice(0, 2).includes(edge.id)) edge.paintedColor = edge.solutionColor; });
            state.puzzle.startedAt = Date.now() - 18000;
            localStorage.setItem(key, JSON.stringify(state));
        }, { key, ids });
        await page.reload();
        const grid = await saved();
        for (const item of grid.puzzle.edges.filter(edge => edge.paintedColor === null)) await keyboardPaint(item.id, item.solutionColor);
        check(!await page.locator('#completion').isVisible() && (await saved()).puzzle.finishedAt !== null, 'Solving freezes the result immediately, while the last painting wave remains visible');
        await page.clock.runFor(150);
        check(!await page.locator('#completion').isVisible(), 'The result dialog waits for the 300 ms painting animation');
        await page.clock.runFor(200);
        check(await page.locator('#completion').isVisible() && await page.locator('clipPath').count() === 0, 'The result dialog opens after all color waves finish');
        check(await page.locator('.vertex').evaluateAll(vertices => vertices.every(vertex => {
            const sectors = [...vertex.querySelectorAll('.vertex-sector')];
            return new Set(sectors.map(sector => getComputedStyle(sector).fill)).size === sectors.length;
        })), 'Every solved grid vertex has a distinct color in each sector');
        await page.clock.resume();
        await page.getByRole('button', { name: 'Новый граф' }).click();
        await page.waitForFunction(() => document.querySelector('#loader').hidden);
        check(await page.locator('clipPath, .edge-wave, .vertex-sector-wave').count() === 0 && await page.locator('.edge.is-locked').count() === 40 && await page.locator('.edge:not(.is-locked)[aria-pressed="true"]').count() === 0, 'Advancing restores clue colors and gray editable sectors without stale waves');

        await page.emulateMedia({ reducedMotion: 'reduce' });
        const editable = (await saved()).puzzle.edges.find(edge => !edge.locked).id;
        await keyboardPaint(editable, 1);
        const reducedColor = await stroke(editable);
        check(await page.locator('clipPath').count() === 0 && reducedColor !== gray && (await fills(editable)).every(fill => fill === reducedColor), 'Reduced motion applies edge and sector colors immediately');
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await fixture(1);
        const junction = (await saved()).puzzle.edges.filter(edge => edge.a === 'v40' || edge.b === 'v40');
        for (const item of junction.filter(edge => !edge.locked)) await keyboardPaint(item.id, item.solutionColor);
        await page.clock.runFor(350);
        await page.screenshot({ path: 'output/playwright/edge-coloring-sectors-desktop.png' });
        await page.setViewportSize({ width: 390, height: 844 });
        await page.screenshot({ path: 'output/playwright/edge-coloring-sectors-mobile.png' });
        check(errors.length === 0, `No browser exceptions: ${errors.join('; ')}`);
        return { checks, errors };
    } finally { await page.clock.resume(); }
}
