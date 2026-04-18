/**
 * Pentagonal Prism Slider - Game Logic Module
 * 
 * Data Model:
 * - state[layer][face] where layer ∈ {0..4}, face ∈ {0..4}
 * - Values: 0 = EMPTY, 1 = C1, 2 = C2, 3 = C3, 4 = C4
 * - Invariant: exactly 5 EMPTY cells at all times
 */

// Constants
export const EMPTY = 0;
export const C1 = 1;
export const C2 = 2;
export const C3 = 3;
export const C4 = 4;

export const LAYERS = 5;
export const FACES = 5;

/**
 * Creates the solved state:
 * - Face 0: all EMPTY
 * - Face 1: all C1, Face 2: all C2, Face 3: all C3, Face 4: all C4
 */
export function createSolvedState() {
    const state = [];
    for (let layer = 0; layer < LAYERS; layer++) {
        state[layer] = [];
        for (let face = 0; face < FACES; face++) {
            if (face === 0) {
                state[layer][face] = EMPTY;
            } else {
                state[layer][face] = face; // C1, C2, C3, C4
            }
        }
    }
    return state;
}

/**
 * Deep clone state array
 */
export function cloneState(state) {
    return state.map(layer => [...layer]);
}

/**
 * Check if current state matches solved configuration
 */
export function isSolved(state) {
    for (let layer = 0; layer < LAYERS; layer++) {
        for (let face = 0; face < FACES; face++) {
            if (face === 0) {
                if (state[layer][face] !== EMPTY) return false;
            } else {
                if (state[layer][face] !== face) return false;
            }
        }
    }
    return true;
}

/**
 * Apply ROTATE to a layer
 * direction: 1 = clockwise (+72°), -1 = counter-clockwise (-72°)
 * 
 * Modifies state in place and returns it
 */
export function applyRotate(state, layer, direction = 1) {
    if (layer < 0 || layer >= LAYERS) {
        console.error(`Invalid layer: ${layer}`);
        return state;
    }
    
    const oldRow = [...state[layer]];
    for (let face = 0; face < FACES; face++) {
        const newFace = (face + direction + FACES) % FACES;
        state[layer][newFace] = oldRow[face];
    }
    
    console.log(`R ${layer} ${direction > 0 ? 'CW' : 'CCW'}`);
    return state;
}

/**
 * Check if a SLIDE move is valid
 * @param state - current game state
 * @param face - the face (column) to slide within
 * @param layer - the source layer
 * @param dir - direction: -1 (up) or +1 (down)
 */
export function canSlide(state, face, layer, dir) {
    if (face < 0 || face >= FACES) return false;
    if (layer < 0 || layer >= LAYERS) return false;
    if (dir !== -1 && dir !== 1) return false;
    
    const targetLayer = layer + dir;
    if (targetLayer < 0 || targetLayer >= LAYERS) return false;
    
    // Source must not be empty
    if (state[layer][face] === EMPTY) return false;
    
    // Target must be empty
    if (state[targetLayer][face] !== EMPTY) return false;
    
    return true;
}

/**
 * Apply SLIDE move: swap chip with adjacent empty slot
 * @param state - current game state (modified in place)
 * @param face - the face to slide within
 * @param layer - the source layer
 * @param dir - direction: -1 (up) or +1 (down)
 */
export function applySlide(state, face, layer, dir) {
    if (!canSlide(state, face, layer, dir)) {
        console.error(`Invalid slide: face=${face}, layer=${layer}, dir=${dir}`);
        return state;
    }
    
    const targetLayer = layer + dir;
    
    // Swap
    const temp = state[layer][face];
    state[layer][face] = state[targetLayer][face];
    state[targetLayer][face] = temp;
    
    console.log(`S ${face} ${layer} ${dir}`);
    return state;
}

/**
 * Find valid slide directions for a chip at (layer, face)
 * Returns array of valid directions: [-1], [1], [-1, 1], or []
 */
export function getValidSlideDirections(state, face, layer) {
    const directions = [];
    if (canSlide(state, face, layer, -1)) directions.push(-1);
    if (canSlide(state, face, layer, 1)) directions.push(1);
    return directions;
}

/**
 * Get all valid moves from current state
 * Returns array of move objects: { type: 'rotate'|'slide', ... }
 */
export function getAllValidMoves(state) {
    const moves = [];
    
    // All rotate moves are always valid
    for (let layer = 0; layer < LAYERS; layer++) {
        moves.push({ type: 'rotate', layer });
    }
    
    // Find all valid slide moves
    for (let layer = 0; layer < LAYERS; layer++) {
        for (let face = 0; face < FACES; face++) {
            if (canSlide(state, face, layer, -1)) {
                moves.push({ type: 'slide', face, layer, dir: -1 });
            }
            if (canSlide(state, face, layer, 1)) {
                moves.push({ type: 'slide', face, layer, dir: 1 });
            }
        }
    }
    
    return moves;
}

/**
 * Check if two moves are inverses (would cancel each other)
 */
function areInverseMoves(move1, move2) {
    if (!move1 || !move2) return false;
    
    // Rotate inverse: same layer, 4 rotates = back to original
    // But since we only rotate in one direction, consecutive same-layer rotates aren't inverses
    // However, we want to avoid immediate same action for variety
    if (move1.type === 'rotate' && move2.type === 'rotate') {
        return move1.layer === move2.layer;
    }
    
    // Slide inverse: same face and layer, opposite direction
    if (move1.type === 'slide' && move2.type === 'slide') {
        return move1.face === move2.face && 
               move1.layer === move2.layer + move2.dir &&
               move1.dir === -move2.dir;
    }
    
    return false;
}

/**
 * Scramble the puzzle by applying random valid moves
 * @param state - starting state (modified in place)
 * @param steps - number of random moves to apply
 */
export function scramble(state, steps = 30) {
    let lastMove = null;
    
    for (let i = 0; i < steps; i++) {
        const moves = getAllValidMoves(state);
        
        // Filter out inverse of last move to prevent back-and-forth
        const filteredMoves = moves.filter(m => !areInverseMoves(m, lastMove));
        
        if (filteredMoves.length === 0) continue;
        
        // Pick random move
        const move = filteredMoves[Math.floor(Math.random() * filteredMoves.length)];
        
        if (move.type === 'rotate') {
            applyRotate(state, move.layer);
        } else {
            applySlide(state, move.face, move.layer, move.dir);
        }
        
        lastMove = move;
    }
    
    console.log(`Scrambled with ${steps} moves`);
    return state;
}

/**
 * Get position info for a chip value in the current state
 * Returns { layer, face } or null if not found (shouldn't happen for non-empty)
 */
export function findChip(state, chipValue) {
    for (let layer = 0; layer < LAYERS; layer++) {
        for (let face = 0; face < FACES; face++) {
            if (state[layer][face] === chipValue) {
                return { layer, face };
            }
        }
    }
    return null;
}

/**
 * Get chip value at position
 */
export function getChipAt(state, layer, face) {
    if (layer < 0 || layer >= LAYERS) return null;
    if (face < 0 || face >= FACES) return null;
    return state[layer][face];
}

