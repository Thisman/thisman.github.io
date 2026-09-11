export const COLOR_COUNT = 4;
export const PALETTES = [
    ['#FF6B6B', '#4ECDC4', '#FFE66D', '#8B6FE8'],
    ['#6C5CE7', '#00CEC9', '#FDCB6E', '#FF7675'],
    ['#E84393', '#0984E3', '#00B894', '#FDCB6E'],
    ['#F39C12', '#3F51B5', '#8BC34A', '#D05BB5'],
    ['#FF7043', '#26A69A', '#D4E157', '#9575CD'],
    ['#AB47BC', '#29B6F6', '#FFCA28', '#26A69A']
];
const pick = (items, random) => items[Math.floor(random() * items.length)];
export const isColor = color => Number.isInteger(color) && color >= 0 && color < COLOR_COUNT;

export function choosePalette(previous, random = Math.random) {
    return pick(PALETTES.map((_, index) => index).filter(index => index !== previous), random);
}

export function analyse(puzzle) {
    const incident = new Map(puzzle.vertices.map(vertex => [vertex.id, Array.from({ length: COLOR_COUNT }, () => [])]));
    for (const edge of puzzle.edges) {
        if (edge.paintedColor === null) continue;
        incident.get(edge.a)[edge.paintedColor].push(edge.id);
        incident.get(edge.b)[edge.paintedColor].push(edge.id);
    }
    const vertices = new Set();
    const edges = new Set();
    for (const [id, colors] of incident) {
        for (const group of colors) {
            if (group.length < 2) continue;
            vertices.add(id);
            for (const edge of group) edges.add(edge);
        }
    }
    return { vertices, edges, solved: puzzle.edges.length > 0 && !edges.size && puzzle.edges.every(edge => edge.paintedColor !== null) };
}

export function paintEdge(puzzle, edgeId, color, now = Date.now()) {
    if (puzzle.finishedAt !== null || !isColor(color)) return false;
    const edge = puzzle.edges.find(edge => edge.id === edgeId);
    if (!edge || edge.locked) return false;
    edge.paintedColor = edge.paintedColor === color ? null : color;
    if (puzzle.startedAt === null && edge.paintedColor !== null) puzzle.startedAt = now;
    if (analyse(puzzle).solved) puzzle.finishedAt = Math.max(puzzle.startedAt, now);
    return true;
}

export function elapsedMs(puzzle, now = Date.now()) {
    return puzzle.startedAt === null ? 0 : Math.max(0, (puzzle.finishedAt ?? now) - puzzle.startedAt);
}

export function resetPuzzle(puzzle) {
    for (const edge of puzzle.edges) if (!edge.locked) edge.paintedColor = null;
    puzzle.startedAt = null;
    puzzle.finishedAt = null;
}

export function formatTime(milliseconds) {
    const seconds = Math.floor(Math.max(0, milliseconds) / 1000);
    return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
