// Optional offline maintenance: node edge-coloring/tests/prepare-puzzles.mjs
// Writes candidates for review, never changes the shipped bank automatically.
import { writeFileSync } from 'node:fs';
import { generateSolution, removeClues, clueQuality } from '../generator.js';
import { seededRandom } from '../solver.js';
import { evaluateHumanDifficulty } from '../human-solver.js';
import { matchesDifficulty } from '../difficulty.js';

const found = [];
for (let seed = 30; seed < 1000 && found.length < 5; seed++) {
    const random = seededRandom(`bank-${seed}`), solution = generateSolution(random);
    if (!solution) continue;
    for (let attempt = 0; attempt < 20; attempt++) {
        const clues = removeClues(solution, 32, random);
        if (!clues || !clueQuality(clues).valid || !matchesDifficulty('extreme', evaluateHumanDifficulty(clues))) continue;
        found.push({ source: `bank-${seed}/${attempt}`, solution: solution.join(''), clues: clues.map(color => color ?? '.').join('') });
        writeFileSync('output/edge-prepared-candidates.json', JSON.stringify(found, null, 4));
        console.log(`Verified ${found.length}: bank-${seed}/${attempt}`);
        break;
    }
}
