import { ALL_COLORS, BIT_COUNT, clueDomains, propagate, searchDomains } from './solver.js';

const isSolved = domains => domains.every(mask => BIT_COUNT[mask] === 1);

export function evaluateHumanDifficulty(colors) {
    const domains = clueDomains(colors), depths = new Uint16Array(colors.length);
    const metrics = { unknownEdges: colors.filter(color => color === null).length, forcedMoves: 0, pairOrTripleDeductions: 0, contradictionChecks: 0, contradictionEliminations: 0, branchCount: 0, maxBranchDepth: 0, longestDependencyChain: 0 };
    if (!propagate(domains, { subsets: false, metrics, depths })) return { ...metrics, solved: false };
    const singlesSolved = isSolved(domains);
    if (!singlesSolved && !propagate(domains, { metrics, depths })) return { ...metrics, solved: false };
    const pairsSolved = isSolved(domains);
    let changed = true;
    while (!isSolved(domains) && changed) {
        changed = false;
        const candidates = Array.from(domains, (mask, edge) => ({ mask, edge })).filter(item => BIT_COUNT[item.mask] > 1).sort((a, b) => BIT_COUNT[a.mask] - BIT_COUNT[b.mask] || a.edge - b.edge);
        for (const { edge } of candidates) {
            if (BIT_COUNT[domains[edge]] <= 1) continue;
            for (const bit of [1, 2, 4, 8]) {
                if (!(domains[edge] & bit)) continue;
                const probe = domains.slice(); probe[edge] = bit;
                metrics.contradictionChecks++;
                if (propagate(probe)) continue;
                domains[edge] &= ALL_COLORS ^ bit;
                metrics.contradictionEliminations++;
                if (BIT_COUNT[domains[edge]] === 1) metrics.forcedMoves++;
                if (!propagate(domains, { metrics, depths })) return { ...metrics, solved: false };
                changed = true;
                break;
            }
            if (changed) break; // Restart with the new, smaller domains.
        }
    }
    const logicSolved = isSolved(domains);
    let solved = logicSolved;
    if (!logicSolved) {
        const search = searchDomains(domains, { limit: 1 });
        metrics.branchCount = search.branchCount;
        metrics.maxBranchDepth = search.maxBranchDepth;
        solved = search.solutions === 1 && search.complete;
    }
    return { ...metrics, singlesSolved, pairsSolved, logicSolved, solved };
}
