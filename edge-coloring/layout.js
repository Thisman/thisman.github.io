export const GRID_SIZE = 9;
export const VIEW_SIZE = 720;
const MARGIN = 52;
export function gridVertex(row, column, size = GRID_SIZE) {
    const step = (VIEW_SIZE - MARGIN * 2) / (size - 1);
    return { id: `v${row * size + column}`, row, column, x: MARGIN + column * step, y: MARGIN + row * step };
}

export function gridVertices(size = GRID_SIZE) {
    return Array.from({ length: size * size }, (_, index) => gridVertex(Math.floor(index / size), index % size, size));
}
