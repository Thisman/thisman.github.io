import { getGrid, gridForEdgeCount } from './grid.js';

export const ALL_COLORS = 15;
export const { edges: GRID_EDGES, incident: INCIDENT, peers: PEERS } = getGrid(9);
export const BIT_COUNT = Array.from({ length: 16 }, (_, mask) => mask.toString(2).replaceAll('0', '').length);
const COLOR_OF = { 1: 0, 2: 1, 4: 2, 8: 3 };

export function seededRandom(seed) {
    let state = 2166136261;
    for (const character of String(seed)) state = Math.imul(state ^ character.charCodeAt(0), 16777619) >>> 0;
    return () => {
        state += 0x6D2B79F5;
        let value = Math.imul(state ^ state >>> 15, 1 | state);
        value ^= value + Math.imul(value ^ value >>> 7, 61 | value);
        return ((value ^ value >>> 14) >>> 0) / 4294967296;
    };
}

export function shuffle(items, random) {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

export function clueDomains(colors) {
    return Uint8Array.from(colors, color => color === null ? ALL_COLORS : 1 << color);
}

// Shared constraint primitive; the complete search and human strategy driver
// are separate components. Domains are four-bit masks, never JS Sets.
export function propagate(domains, { subsets = true, metrics = null, depths = null, grid = gridForEdgeCount(domains.length) } = {}) {
    const queued = new Uint8Array(domains.length), queue = [];
    for (let i = 0; i < domains.length; i++) {
        if (!domains[i]) return false;
        if (BIT_COUNT[domains[i]] === 1) { queue.push(i); queued[i] = 1; }
    }
    const reduce = (edge, mask, depth = 0) => {
        if (mask === domains[edge]) return true;
        if (!mask) return false;
        const previous = domains[edge];
        domains[edge] = mask;
        if (depths) depths[edge] = Math.max(depths[edge], depth);
        if (BIT_COUNT[mask] === 1 && BIT_COUNT[previous] > 1) {
            if (metrics) {
                metrics.forcedMoves++;
                metrics.longestDependencyChain = Math.max(metrics.longestDependencyChain, depths?.[edge] ?? 0);
            }
            if (!queued[edge]) { queued[edge] = 1; queue.push(edge); }
        }
        return true;
    };
    let changed = true, head = 0;
    while (changed) {
        while (head < queue.length) {
            const edge = queue[head++], bit = domains[edge];
            for (const peer of grid.peers[edge]) {
                if (!reduce(peer, domains[peer] & ~bit, (depths?.[edge] ?? 0) + 1)) return false;
            }
        }
        changed = false;
        if (!subsets) continue;
        for (const group of grid.incident) {
            const full = (1 << group.length) - 1;
            for (let subset = 1; subset <= full; subset++) {
                const size = BIT_COUNT[subset];
                if (size < 2) continue;
                let union = 0, depth = 0;
                for (let i = 0; i < group.length; i++) if (subset & 1 << i) { union |= domains[group[i]]; depth = Math.max(depth, depths?.[group[i]] ?? 0); }
                if (BIT_COUNT[union] < size) return false;
                if (BIT_COUNT[union] !== size || subset === full) continue;
                let deduction = false;
                for (let i = 0; i < group.length; i++) if (!(subset & 1 << i)) {
                    const edge = group[i], mask = domains[edge] & ~union;
                    if (mask !== domains[edge]) {
                        if (!reduce(edge, mask, depth + 1)) return false;
                        changed = true; deduction = true;
                    }
                }
                if (deduction && metrics) metrics.pairOrTripleDeductions++;
            }
        }
        if (head < queue.length) changed = true;
    }
    return true;
}

export function selectMRV(domains, random = null) {
    let selected = -1, minimum = 5, ties = 0;
    for (let i = 0; i < domains.length; i++) {
        const count = BIT_COUNT[domains[i]];
        if (count <= 1 || count > minimum) continue;
        if (count < minimum) { selected = i; minimum = count; ties = 1; }
        else if (random && random() < 1 / ++ties) selected = i;
    }
    return selected;
}

export function searchDomains(initial, { limit = 2, random = null, nodeLimit = 1000000 } = {}) {
    const grid = gridForEdgeCount(initial.length);
    let solutions = 0, solution = null, nodes = 0, branchCount = 0, maxBranchDepth = 0, exhausted = false;
    const visit = (domains, depth) => {
        if (solutions >= limit || exhausted) return;
        if (++nodes > nodeLimit) { exhausted = true; return; }
        if (!propagate(domains, { grid })) return;
        const edge = selectMRV(domains, random);
        if (edge < 0) { solutions++; solution ??= Array.from(domains, mask => COLOR_OF[mask]); return; }
        branchCount++;
        maxBranchDepth = Math.max(maxBranchDepth, depth + 1);
        let options = [1, 2, 4, 8].filter(bit => domains[edge] & bit);
        if (random) options = shuffle(options, random);
        for (const bit of options) {
            const next = domains.slice(); next[edge] = bit;
            visit(next, depth + 1);
            if (solutions >= limit || exhausted) break;
        }
    };
    visit(initial.slice(), 0);
    return { solutions, solution, complete: !exhausted, nodes, branchCount, maxBranchDepth };
}

export function countSolutions(colors, limit = 2, nodeLimit = 1000000) {
    return searchDomains(clueDomains(colors), { limit, nodeLimit });
}
