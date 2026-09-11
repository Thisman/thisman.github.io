// playwright-cli run-code --filename edge-coloring/tests/dialogs-check.js
async (currentPage) => {
    const context = await currentPage.context().browser().newContext({ viewport: { width: 1440, height: 1000 } });
    const checks = [], errors = [];
    const check = (value, message) => { if (!value) throw new Error(message); checks.push(message); };
    try {
        const page = await context.newPage();
        page.on('pageerror', error => errors.push(error.message));
        let workers = 0;
        page.on('worker', () => workers++);
        await page.goto('http://127.0.0.1:4173/edge-coloring/');
        const ready = () => page.waitForFunction(() => document.querySelector('#loader').hidden);
        const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('edge-coloring:current:v1')));
        await ready();
        const initial = await saved();
        const help = page.locator('#help-dialog'), reset = page.locator('#reset-dialog');
        const clickEdge = async (id, button = 'left') => {
            const point = await page.locator('[data-edge-id="' + id + '"] .edge-hit').evaluate(line => {
                const point = new DOMPoint((+line.getAttribute('x1') + +line.getAttribute('x2')) / 2, (+line.getAttribute('y1') + +line.getAttribute('y2')) / 2).matrixTransform(line.getScreenCTM());
                return { x: point.x, y: point.y };
            });
            await page.mouse.click(point.x, point.y, { button });
        };
        const editable = initial.puzzle.edges.filter(edge => !edge.locked);
        const pair = initial.puzzle.vertices.map(vertex => editable.filter(edge => edge.a === vertex.id || edge.b === vertex.id)).find(group => group.length >= 2).slice(0, 2);
        check(await page.locator('.utility-button img').evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0 && image.src.includes('/icons/font-awesome/'))), 'Both local Font Awesome icons load');
        check(await page.locator('.swatch').count() === 4, 'Only four buttons belong to the color palette');
        await page.getByRole('button', { name: 'Правила игры', exact: true }).click();
        check(await help.isVisible(), 'Help opens a modal');
        const rules = await help.innerText();
        check(rules.includes('Левая кнопка') && rules.includes('Правая кнопка') && rules.includes('разных цветов') && rules.includes('Замок') && !/Intro|Easy|Normal|Hard|Expert|Extreme/.test(rules), 'Rules explain the objective, clues and mouse controls without difficulty descriptions');
        await page.keyboard.press('4');
        await help.locator('h2').click({ button: 'right' });
        await clickEdge(pair[0].id);
        check(JSON.stringify(await saved()) === JSON.stringify(initial), 'Mouse and hotkeys cannot alter the game behind help');
        await help.getByRole('button', { name: 'Закрыть', exact: true }).click();
        check(!await help.isVisible() && JSON.stringify(await saved()) === JSON.stringify(initial), 'Close dismisses help without changes');
        await page.locator('#show-help').click(); await page.keyboard.press('Escape');
        check(!await help.isVisible() && JSON.stringify(await saved()) === JSON.stringify(initial) && await page.locator('#show-help').evaluate(button => button === document.activeElement), 'Escape closes help without changes and restores focus');

        await page.keyboard.press('3');
        for (const edge of pair) await clickEdge(edge.id);
        check(await page.locator('.edge.is-conflict').count() >= 2, 'The reset fixture includes player colors and conflicts');
        const partial = await saved();
        await page.locator('#show-reset').click();
        check(await reset.isVisible() && await reset.getByRole('button', { name: 'Отмена', exact: true }).evaluate(button => button === document.activeElement), 'Reset opens confirmation with Cancel focused');
        await page.keyboard.press('1');
        await reset.locator('h2').click({ button: 'right' });
        await clickEdge(pair[0].id);
        check(JSON.stringify(await saved()) === JSON.stringify(partial), 'Confirmation blocks painting and color changes');
        await reset.getByRole('button', { name: 'Отмена', exact: true }).click();
        check(!await reset.isVisible() && JSON.stringify(await saved()) === JSON.stringify(partial), 'Cancel retains colors, selected color, seed and timer');
        await page.locator('#show-reset').click(); await page.keyboard.press('Escape');
        check(!await reset.isVisible() && JSON.stringify(await saved()) === JSON.stringify(partial) && await page.locator('#show-reset').evaluate(button => button === document.activeElement), 'Escape cancels reset and restores focus');

        await page.locator('#show-reset').click();
        const workerCount = workers;
        await page.locator('#confirm-reset').click();
        const cleared = await saved();
        check(!await reset.isVisible() && !await page.locator('#loader').isVisible() && workers === workerCount, 'Confirm closes immediately and never starts generation');
        check(JSON.stringify(cleared.puzzle) === JSON.stringify(initial.puzzle) && cleared.selectedColor === partial.selectedColor, 'Reset restores the exact starting puzzle and keeps the selected palette color');
        check(await page.locator('.edge:not(.is-locked)[aria-pressed="true"]').count() === 0 && await page.locator('.edge.is-locked[aria-pressed="true"]').count() === initial.puzzle.clueCount, 'Player edges are gray and protected clues stay colored');
        check(await page.locator('.is-conflict, .is-new-conflict, clipPath, .edge-wave, .vertex-sector-wave').count() === 0 && await page.locator('#timer').innerText() === '00:00', 'Reset clears conflicts, animation overlays and elapsed time');
        await page.reload(); await ready();
        check(JSON.stringify(await saved()) === JSON.stringify(cleared), 'Reload preserves the cleared puzzle without generating');
        await clickEdge(pair[0].id, 'right');
        const next = await saved();
        check(next.selectedColor === (cleared.selectedColor + 1) % 4 && next.puzzle.startedAt !== null, 'Right-click and the timer work after reset');

        for (const [width, height] of [[1440,1000], [900,700], [1280,720], [390,844], [320,568], [844,390]]) {
            await page.setViewportSize({ width, height });
            check(await page.evaluate(() => {
                const buttons = [...document.querySelectorAll('.swatch, .utility-button')];
                const size = parseFloat(getComputedStyle(buttons[0]).width);
                const allFit = buttons.every(button => {
                    const rect = button.getBoundingClientRect(), css = getComputedStyle(button);
                    return Math.abs(parseFloat(css.width) - size) < 0.1 && Math.abs(parseFloat(css.height) - size) < 0.1 && css.borderRadius === '50%' && rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight;
                });
                const help = document.querySelector('#show-help').getBoundingClientRect(), reset = document.querySelector('#show-reset').getBoundingClientRect(), palette = document.querySelector('#palette').getBoundingClientRect();
                return allFit && (innerWidth > 620 ? help.bottom < palette.top && reset.top > palette.bottom : help.right < palette.left && reset.left > palette.right);
            }), 'Utility buttons match palette circle size and fit around it at ' + width + 'x' + height);
            const before = await page.locator('#game').boundingBox();
            await page.locator('#show-help').click();
            check(JSON.stringify(await page.locator('#game').boundingBox()) === JSON.stringify(before), 'Opening help leaves the game layout in place');
            const box = await help.boundingBox();
            check(box.x >= 0 && box.y >= 0 && box.x + box.width <= width && box.y + box.height <= height, 'Help popup fits the viewport');
            if (width === 390) await page.screenshot({ path: 'output/playwright/edgoku-help-mobile.png' });
            await page.keyboard.press('Escape');
        }
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.screenshot({ path: 'output/playwright/edgoku-controls-desktop.png' });
        await page.locator('#show-reset').click();
        await page.screenshot({ path: 'output/playwright/edgoku-reset-desktop.png' });
        await page.keyboard.press('Escape');
        await page.getByRole('tab', { name: 'Easy', exact: true }).click();
        check(await page.locator('#show-reset').isDisabled() && await page.locator('#show-help').isEnabled(), 'Reset is disabled during generation while help remains available');
        await page.locator('#show-help').click(); await ready();
        check(await help.isVisible() && await page.locator('#show-reset').isEnabled(), 'Generation can finish while help stays open');
        await page.keyboard.press('Escape');
        check(errors.length === 0, 'No browser errors');
        return { checks: checks.length, details: checks, errors };
    } finally { await context.close(); }
}
