// Optional diagnostic: playwright-cli run-code --filename edge-coloring/tests/performance-check.js
async (page) => {
    const context = await page.context().browser().newContext();
    try {
        const target = await context.newPage();
        await target.goto('http://127.0.0.1:4173/edge-coloring/');
        return await target.evaluate(async () => {
            const { generatePuzzle } = await import('/edge-coloring/generator.js');
            const { DIFFICULTIES } = await import('/edge-coloring/difficulty.js');
            const { isValidPuzzle } = await import('/edge-coloring/storage.js');
            const samples = [];
            for (const difficulty of DIFFICULTIES) for (let i = 0; i < 10; i++) {
                const start = performance.now();
                const puzzle = generatePuzzle({ difficulty: difficulty.id, seed: 'performance-' + i });
                const generated = performance.now();
                if (!isValidPuzzle(puzzle)) throw new Error('Invalid generated grid');
                samples.push({ difficulty: difficulty.id, generationMs: generated - start, validationMs: performance.now() - generated });
            }
            return {
                count: samples.length,
                maxGenerationMs: Math.max(...samples.map(sample => sample.generationMs)),
                maxValidationMs: Math.max(...samples.map(sample => sample.validationMs))
            };
        });
    } finally { await context.close(); }
}
