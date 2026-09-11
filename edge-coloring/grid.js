const grids = new Map();

export function getGrid(size) {
    if (!Number.isInteger(size) || size < 2 || size > 9) throw new Error('Invalid grid size');
    if (grids.has(size)) return grids.get(size);
    const edges = [], incident = Array.from({ length: size ** 2 }, () => []);
    const byPair = new Map();
    for (let row = 0; row < size; row++) for (let column = 0; column < size; column++) {
        const a = row * size + column;
        for (const b of [column < size - 1 ? a + 1 : -1, row < size - 1 ? a + size : -1]) {
            if (b < 0) continue;
            const index = edges.length;
            edges.push({ id: `e${index}`, a: `v${a}`, b: `v${b}` });
            incident[a].push(index); incident[b].push(index);
            byPair.set(a + ':' + b, index);
        }
    }
    const peers = edges.map((edge, i) => [...new Set([...incident[+edge.a.slice(1)], ...incident[+edge.b.slice(1)]])].filter(other => other !== i));
    const squares = [];
    for (let side = 1; side < size; side++) for (let row = 0; row + side < size; row++) for (let column = 0; column + side < size; column++) {
        const perimeter = [];
        for (let offset = 0; offset < side; offset++) {
            const top = row * size + column + offset, bottom = (row + side) * size + column + offset;
            const left = (row + offset) * size + column, right = left + side;
            perimeter.push(byPair.get(top + ':' + (top + 1)), byPair.get(bottom + ':' + (bottom + 1)), byPair.get(left + ':' + (left + size)), byPair.get(right + ':' + (right + size)));
        }
        squares.push(perimeter);
    }
    const grid = { size, edges, incident, peers, squares };
    grids.set(size, grid);
    return grid;
}

export function gridForEdgeCount(count) {
    const size = (1 + Math.sqrt(1 + 2 * count)) / 2;
    return getGrid(size);
}
