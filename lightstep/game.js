// Coordinates use x / z on the board and h for height above its surface.
export const RULES = Object.freeze({ speed: 3.4, gravity: 18, jumpSpeed: 7.2, radius: 0.23, patternSpeedPerLevel: 0.08, fragileRatio: 0.14 });
export const keyOf = (x, z) => `${x},${z}`;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const mod = (value, period) => ((value % period) + period) % period;
export const patternSpeedForLevel = level => 1 + Math.max(0, level - 1) * RULES.patternSpeedPerLevel;

export function randomFromSeed(seed) {
    let value = seed >>> 0;
    return () => {
        value += 0x6D2B79F5;
        let n = value;
        n = Math.imul(n ^ n >>> 15, n | 1);
        n ^= n + Math.imul(n ^ n >>> 7, n | 61);
        return ((n ^ n >>> 14) >>> 0) / 4294967296;
    };
}

// Masks operate in normalized coordinates; size, reflection and rotation vary at runtime.
export const SHAPES = [
    { name: 'Поворот', contains: (u, v) => u < 0.38 || v > 0.63 },
    { name: 'Бухта', contains: (u, v) => u < 0.29 || u > 0.71 || v > 0.65 },
    { name: 'Ступени', contains: (u, v) => Math.abs(v - (0.2 + Math.floor(u * 3) * 0.28)) < 0.24 },
    { name: 'Перекрёсток', contains: (u, v) => Math.abs(u - 0.5) < 0.19 || Math.abs(v - 0.5) < 0.19 },
    { name: 'Остров', contains: (u, v) => ((u - 0.48) / 0.53) ** 2 + ((v - 0.5) / 0.52) ** 2 < 1 },
    { name: 'Атриум', contains: (u, v) => Math.max(Math.abs(u - 0.5), Math.abs(v - 0.5)) > 0.23 },
    { name: 'Мост', contains: (u, v) => u < 0.3 || u > 0.7 || Math.abs(v - 0.5) < 0.13 },
    { name: 'Меандр', contains: (u, v) => (v < 0.3 && u < 0.78) || (v > 0.7 && u > 0.22) || Math.abs(u - 0.5) < 0.18 },
    { name: 'Террасы', contains: (u, v) => v > 0.14 + Math.floor(u * 4) * 0.16 },
    { name: 'Три рукава', contains: (u, v) => v > 0.7 || u < 0.22 || Math.abs(u - 0.5) < 0.12 || u > 0.78 },
    { name: 'Полуостров', contains: (u, v) => ((u - 0.35) ** 2 + (v - 0.38) ** 2 < 0.16) || (u > 0.28 && u < 0.57 && v > 0.4) || (u > 0.4 && v > 0.73) },
    { name: 'Разлом', contains: (u, v) => !(u > 0.34 && u < 0.62 && v < 0.65) && !(u > 0.76 && v > 0.68) },
];

export function distancesFrom(map, start) {
    const distances = new Map([[keyOf(start.x, start.z), 0]]);
    const queue = [start];
    for (let i = 0; i < queue.length; i++) {
        const cell = queue[i];
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const next = { x: cell.x + dx, z: cell.z + dz };
            const key = keyOf(next.x, next.z);
            if (map.cellSet.has(key) && !distances.has(key)) {
                distances.set(key, distances.get(keyOf(cell.x, cell.z)) + 1);
                queue.push(next);
            }
        }
    }
    return distances;
}

export function generateMap(seed, shapeIndex = seed % SHAPES.length) {
    const random = randomFromSeed(seed);
    const width = 10 + Math.floor(random() * 6);
    const depth = 9 + Math.floor(random() * 5);
    const shape = SHAPES[mod(shapeIndex, SHAPES.length)];
    const rotation = Math.floor(random() * 4);
    const mirror = random() < 0.5;
    let cells = [];
    for (let z = 0; z < depth; z++) {
        for (let x = 0; x < width; x++) {
            let u = x / (width - 1), v = z / (depth - 1);
            if (mirror) u = 1 - u;
            for (let r = 0; r < rotation; r++) [u, v] = [v, 1 - u];
            if (shape.contains(u, v)) cells.push({ x, z });
        }
    }
    // Keep the largest connected component, then trim to the actual bounding rectangle.
    const remaining = new Set(cells.map(c => keyOf(c.x, c.z)));
    let largest = new Set();
    for (const cell of cells) {
        if (!remaining.has(keyOf(cell.x, cell.z))) continue;
        const component = distancesFrom({ cellSet: remaining }, cell);
        if (component.size > largest.size) largest = new Set(component.keys());
        for (const key of component.keys()) remaining.delete(key);
    }
    cells = cells.filter(c => largest.has(keyOf(c.x, c.z)));
    const minX = Math.min(...cells.map(c => c.x)), minZ = Math.min(...cells.map(c => c.z));
    cells = cells.map(c => ({ x: c.x - minX, z: c.z - minZ }));
    const map = {
        seed, name: shape.name, shapeIndex: mod(shapeIndex, SHAPES.length), cells,
        width: Math.max(...cells.map(c => c.x)) + 1,
        depth: Math.max(...cells.map(c => c.z)) + 1,
        cellSet: new Set(cells.map(c => keyOf(c.x, c.z))),
    };
    // Opposite ends of a long traversable route, even on a U or an asymmetric island.
    const farthest = from => {
        const distances = distancesFrom(map, from);
        return cells.reduce((best, c) => distances.get(keyOf(c.x, c.z)) > distances.get(keyOf(best.x, best.z)) ? c : best);
    };
    map.start = farthest(cells[0]);
    map.exit = farthest(map.start);
    // Start on the near side of the fixed camera where possible.
    if (map.start.z < map.exit.z) [map.start, map.exit] = [map.exit, map.start];
    const candidates = cells.filter(c => c !== map.start && c !== map.exit);
    for (let i = candidates.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    const fragile = new Set(candidates.slice(0, Math.max(1, Math.floor(cells.length * RULES.fragileRatio))));
    map.cells = cells.map(c => ({ ...c, type: fragile.has(c) ? 'fragile' : 'normal' }));
    return map;
}

const sweep = (coordinate, span, phase, thickness = 0.58) => Math.abs(coordinate - (-2 + phase * (span + 3))) < thickness;
const lineTrain = (coordinate, span, phase, count, spacing = 3.4) => {
    const front = -2 + phase * (span + 3 + (count - 1) * spacing);
    for (let i = 0; i < count; i++) {
        if (Math.abs(coordinate - (front - i * spacing)) < 0.55) return true;
    }
    return false;
};
export const PATTERNS = [
    { name: 'Бегущая линия', hint: 'Вертикальная волна слева направо', duration: 7.6,
        hit: (x, z, w, d, p) => sweep(x, w, p) },
    { name: 'Прилив', hint: 'Горизонтальная волна от дальнего края', duration: 7.6,
        hit: (x, z, w, d, p) => sweep(z, d, p) },
    { name: 'Круги на воде', hint: 'Кольцо расходится из центра', duration: 7.4,
        hit: (x, z, w, d, p) => Math.abs(Math.hypot(x - (w - 1) / 2, z - (d - 1) / 2) - (p * (Math.hypot(w, d) / 2 + 2) - 1)) < 0.58 },
    { name: 'Эхо', hint: 'Кольцо сжимается к центру', duration: 7.4,
        hit: (x, z, w, d, p) => Math.abs(Math.hypot(x - (w - 1) / 2, z - (d - 1) / 2) - ((1 - p) * (Math.hypot(w, d) / 2 + 2) - 1)) < 0.58 },
    { name: 'Диагональ', hint: 'Косая волна пересекает поле', duration: 8,
        hit: (x, z, w, d, p) => sweep((x + z) / Math.SQRT2, (w + d - 2) / Math.SQRT2, p, 0.62) },
    { name: 'Ножницы', hint: 'Две линии сходятся и расходятся', duration: 8.6,
        hit: (x, z, w, d, p) => sweep(x, w, p) || sweep(w - 1 - x, w, p) },
    { name: 'Орбита', hint: 'Луч вращается вокруг центра', duration: 10,
        hit: (x, z, w, d, p) => {
            if (p < 0.1 || p > 0.92) return false;
            const angle = (p - 0.1) / 0.82 * Math.PI * 2;
            const dx = x - (w - 1) / 2, dz = z - (d - 1) / 2;
            return Math.abs(dx * Math.sin(angle) - dz * Math.cos(angle)) < 0.52 && dx * Math.cos(angle) + dz * Math.sin(angle) >= 0;
        } },
    { name: 'Квадратная волна', hint: 'Квадратные кольца от центра к краям', duration: 7.6,
        hit: (x, z, w, d, p) => Math.abs(Math.max(Math.abs(x - (w - 1) / 2), Math.abs(z - (d - 1) / 2)) - (p * (Math.max(w, d) / 2 + 2) - 1)) < 0.52 },
    { name: 'Гребёнка', hint: 'Чередующиеся полосы короткими импульсами', duration: 6.4, warningLead: 0.48,
        hit: (x, z, w, d, p) => (p > 0.24 && p < 0.31 && x % 3 === 0) || (p > 0.61 && p < 0.68 && x % 3 === 2) },
    { name: 'Шахматный пульс', hint: 'Две половины клеток загораются по очереди', duration: 6.4, warningLead: 0.48,
        hit: (x, z, w, d, p) => (p > 0.24 && p < 0.31 && (x + z) % 2 === 0) || (p > 0.61 && p < 0.68 && (x + z) % 2 === 1) },
    { name: 'Змейка', hint: 'Изогнутая волна движется поперёк поля', duration: 8.2,
        hit: (x, z, w, d, p) => Math.abs(x - (-3 + p * (w + 5) + Math.sin(z * 0.72 + p * Math.PI * 2) * 1.5)) < 0.56 },
    { name: 'Дождь', hint: 'Короткие импульсы рассыпаны по прямоугольнику', duration: 7.2, warningLead: 0.48,
        hit: (x, z, w, d, p) => {
            if (p < 0.12 || p > 0.9) return false;
            const beat = p * 8, group = (x * 7 + z * 11 + x * z) % 8;
            return group === Math.floor(beat) && beat % 1 > 0.3 && beat % 1 < 0.84;
        } },
    { name: 'Двойной фронт', hint: 'Две параллельные линии идут слева направо', duration: 9.2,
        hit: (x, z, w, d, p) => lineTrain(x, w, p, 2) },
    { name: 'Тройной прилив', hint: 'Три горизонтальные линии проходят друг за другом', duration: 11,
        hit: (x, z, w, d, p) => lineTrain(z, d, p, 3) },
    { name: 'Косой строй', hint: 'Три параллельные диагонали пересекают поле', duration: 12,
        hit: (x, z, w, d, p) => lineTrain((x + z) / Math.SQRT2, (w + d - 2) / Math.SQRT2, p, 3) },
    { name: 'Сетка', hint: 'Две вертикальные и две горизонтальные линии пересекаются', duration: 11.2,
        hit: (x, z, w, d, p) => lineTrain(x, w, p, 2) || lineTrain(z, d, p, 2) },
];

export function patternAt(patternIndex, x, z, map, time, speed = 1) {
    if (time < 0) return false;
    const pattern = PATTERNS[mod(patternIndex, PATTERNS.length)];
    return pattern.hit(x, z, map.width, map.depth, mod(time * speed, pattern.duration) / pattern.duration);
}

export function cellAt(map, x, z) {
    const cell = { x: Math.floor(x + 0.5), z: Math.floor(z + 0.5) };
    return map.cellSet.has(keyOf(cell.x, cell.z)) ? cell : null;
}

export function occupiedCells(map, player) {
    const cells = [];
    const radius = RULES.radius;
    for (let z = Math.floor(player.z - radius + 0.5); z <= Math.floor(player.z + radius + 0.5); z++) {
        for (let x = Math.floor(player.x - radius + 0.5); x <= Math.floor(player.x + radius + 0.5); x++) {
            if (!map.cellSet.has(keyOf(x, z))) continue;
            const dx = player.x - clamp(player.x, x - 0.5, x + 0.5);
            const dz = player.z - clamp(player.z, z - 0.5, z + 0.5);
            if (dx * dx + dz * dz < radius * radius) cells.push({ x, z });
        }
    }
    return cells;
}

export function createGame(map, patternIndex = 0, level = 1) {
    return {
        // The cell list is the original layout; each attempt gets its own remaining surface.
        map: { ...map, cellSet: new Set(map.cells.map(c => keyOf(c.x, c.z))) },
        patternIndex, level, patternSpeed: patternSpeedForLevel(level), elapsed: 0, status: 'playing', reason: '',
        fragileCells: new Set(map.cells.filter(c => c.type === 'fragile').map(c => keyOf(c.x, c.z))),
        armedCells: new Set(),
        player: { ...map.start, h: 0, velocity: 0, falling: false },
    };
}

function updateFragileCells(game) {
    const p = game.player;
    const occupied = new Set((p.falling ? [] : occupiedCells(game.map, p)).map(c => keyOf(c.x, c.z)));
    // Flying over a tile does not arm it. A vertical jump retains the same footprint.
    if (p.h === 0 && !p.falling) {
        for (const key of occupied) {
            if (game.fragileCells.has(key)) game.armedCells.add(key);
        }
    }
    for (const key of game.armedCells) {
        if (!occupied.has(key)) {
            game.map.cellSet.delete(key);
            game.armedCells.delete(key);
        }
    }
}

// Fixed small physics steps keep movement and landing collisions independent of frame rate.
export function stepGame(game, input, delta) {
    if (game.status !== 'playing') return;
    const steps = Math.ceil(clamp(delta, 0, 0.1) / (1 / 120));
    if (steps === 0) return;
    const dt = clamp(delta, 0, 0.1) / steps;
    const p = game.player;
    const length = Math.hypot(input.x || 0, input.z || 0);
    updateFragileCells(game);
    if (input.jump && p.h === 0 && !p.falling) p.velocity = RULES.jumpSpeed;
    for (let i = 0; i < steps && game.status === 'playing'; i++) {
        game.elapsed += dt;
        if (!p.falling) {
            p.x += (input.x || 0) / Math.max(1, length) * RULES.speed * dt;
            p.z += (input.z || 0) / Math.max(1, length) * RULES.speed * dt;
        }
        if (p.velocity !== 0 || p.h > 0 || p.falling) {
            p.h += p.velocity * dt - RULES.gravity * dt * dt / 2;
            p.velocity -= RULES.gravity * dt;
        }
        const support = cellAt(game.map, p.x, p.z);
        if (p.h <= 0) {
            if (support && !p.falling) {
                p.h = 0;
                p.velocity = 0;
            } else p.falling = true;
        }
        updateFragileCells(game);
        if (p.falling && p.h < -3) {
            game.status = 'dead';
            game.reason = 'fall';
        } else if (p.h === 0 && !p.falling) {
            const hit = occupiedCells(game.map, p).some(c => patternAt(game.patternIndex, c.x, c.z, game.map, game.elapsed, game.patternSpeed));
            if (hit) {
                game.status = 'dead';
                game.reason = 'light';
            } else if (Math.hypot(p.x - game.map.exit.x, p.z - game.map.exit.z) < 0.36) {
                game.status = 'won';
            }
        }
    }
}
