/**
 * Pentagonal Prism Slider - Rendering Module
 * 
 * Handles Three.js scene, camera, lights, and mesh creation/updates
 * 
 * Geometry: A pentagonal prism with 5 vertical faces arranged in a regular pentagon.
 * Each face has 5 cell slots stacked vertically.
 */

import * as THREE from 'three';
import { EMPTY, C1, C2, C3, C4, LAYERS, FACES } from './logic.js';

// Scene configuration
const CELL_SIZE = 0.9;      // Size of each cell (square)
const CELL_GAP = 0.08;      // Gap between cells
const CELL_STEP = CELL_SIZE + CELL_GAP;  // Total step between cell centers
const CHIP_OFFSET = 0.02;   // Offset from slot surface to avoid z-fighting

// Face width is just slightly larger than cell
const FACE_WIDTH = CELL_SIZE + 0.15;

// Calculate apothem from face width for proper pentagon
// For regular pentagon: apothem = side / (2 * tan(π/5))
const APOTHEM = FACE_WIDTH / (2 * Math.tan(Math.PI / FACES));

const PRISM_HEIGHT = CELL_STEP * LAYERS;

// Color palette
const COLORS = {
    [C1]: 0xe74c3c,  // Red
    [C2]: 0x3498db,  // Blue
    [C3]: 0x2ecc71,  // Green
    [C4]: 0xf39c12,  // Orange
    slot: 0x34495e,  // Dark slot background
    slotBorder: 0x2c3e50,
    facePanel: 0x1e2a36,  // Face background
    cap: 0x151c24,  // Top/bottom cap color
    background: 0x1a1a2e,
    highlight: 0xffffff   // White highlight for valid moves
};

// Module state
let scene, camera, renderer;
let slotMeshes = [];    // Static slot backgrounds  
let chipMeshes = {};    // Chip meshes indexed by chip value
let chipGroup;          // Group containing all chips
let facePanels = [];    // Background panels for each face
let highlightMeshes = []; // Meshes for highlighting valid moves
let prismGroup;         // Main group for the entire prism (for horizontal orientation)
let controlButtons = []; // 3D control buttons

// Selection state
let selectedChip = null;
let validTargets = [];
let selectedChipBasePos = null;  // Original position of selected chip

// Animation state
let isAnimating = false;
let selectionAnimationId = null;  // For selection hover animation

// Dirty flag for optimized rendering - prevents unnecessary renders
let needsRender = true;

/**
 * Mark scene as needing a render
 */
export function markDirty() {
    needsRender = true;
}

/**
 * Check if render is needed and reset flag
 */
export function consumeRenderFlag() {
    const wasNeeded = needsRender;
    needsRender = false;
    return wasNeeded;
}

/**
 * Initialize the Three.js scene
 */
export function initScene(canvas) {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(COLORS.background);
    
    // Camera
    camera = new THREE.PerspectiveCamera(
        50,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.set(0, 5, 8);
    camera.lookAt(0, 0, 0);
    
    // Renderer
    renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: true
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    
    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight.position.set(5, 10, 7);
    scene.add(directionalLight);
    
    const backLight = new THREE.DirectionalLight(0xffffff, 0.3);
    backLight.position.set(-5, 5, -5);
    scene.add(backLight);
    
    // Handle resize
    window.addEventListener('resize', onWindowResize);
    
    // Create main prism group (will be rotated to horizontal)
    prismGroup = new THREE.Group();
    prismGroup.rotation.z = Math.PI / 2;  // Rotate to horizontal
    scene.add(prismGroup);
    
    // Create chip group inside prism group
    chipGroup = new THREE.Group();
    prismGroup.add(chipGroup);
    
    return { scene, camera, renderer };
}

/**
 * Handle window resize
 */
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    markDirty(); // Trigger render after resize
}

/**
 * Get the angle for a face (pointing outward from center)
 */
function getFaceAngle(face) {
    return face * (2 * Math.PI / FACES);
}

/**
 * Calculate 3D position for a cell (layer, face)
 */
export function getCellPosition(layer, face) {
    const angle = getFaceAngle(face);
    
    const x = APOTHEM * Math.sin(angle);
    const z = APOTHEM * Math.cos(angle);
    const y = (layer - (LAYERS - 1) / 2) * CELL_STEP;
    
    return new THREE.Vector3(x, y, z);
}

/**
 * Calculate rotation for a cell/chip to face outward
 */
function getCellRotation(face) {
    const angle = getFaceAngle(face);
    return new THREE.Euler(0, angle, 0);
}

/**
 * Create pentagon shape for caps
 */
function createPentagonShape() {
    const shape = new THREE.Shape();
    const circumradius = APOTHEM / Math.cos(Math.PI / FACES);
    
    for (let i = 0; i < FACES; i++) {
        const angle = (i * 2 * Math.PI / FACES) - Math.PI / 2;
        const x = circumradius * Math.cos(angle);
        const y = circumradius * Math.sin(angle);
        
        if (i === 0) {
            shape.moveTo(x, y);
        } else {
            shape.lineTo(x, y);
        }
    }
    shape.closePath();
    
    return shape;
}

/**
 * Create the top and bottom caps of the prism
 */
function createCaps() {
    const shape = createPentagonShape();
    const geometry = new THREE.ShapeGeometry(shape);
    const material = new THREE.MeshBasicMaterial({
        color: COLORS.cap,
        side: THREE.DoubleSide
    });
    
    // Bottom cap (left side when horizontal)
    const bottomCap = new THREE.Mesh(geometry, material);
    bottomCap.rotation.x = Math.PI / 2;
    bottomCap.position.y = -PRISM_HEIGHT / 2 - CELL_GAP / 2;
    prismGroup.add(bottomCap);
    
    // Top cap (right side when horizontal)
    const topCap = new THREE.Mesh(geometry.clone(), material);
    topCap.rotation.x = -Math.PI / 2;
    topCap.rotation.z = Math.PI;
    topCap.position.y = PRISM_HEIGHT / 2 + CELL_GAP / 2;
    prismGroup.add(topCap);
}

/**
 * Create the face panels (background for each prism face)
 */
function createFacePanels() {
    const panelHeight = PRISM_HEIGHT + CELL_GAP;
    const panelWidth = FACE_WIDTH;
    
    const panelGeometry = new THREE.PlaneGeometry(panelWidth, panelHeight);
    const panelMaterial = new THREE.MeshBasicMaterial({
        color: COLORS.facePanel,
        side: THREE.FrontSide
    });
    
    for (let face = 0; face < FACES; face++) {
        const angle = getFaceAngle(face);
        
        const panel = new THREE.Mesh(panelGeometry, panelMaterial);
        
        const x = (APOTHEM - 0.01) * Math.sin(angle);
        const z = (APOTHEM - 0.01) * Math.cos(angle);
        
        panel.position.set(x, 0, z);
        panel.rotation.y = angle;
        
        facePanels.push(panel);
        prismGroup.add(panel);
    }
}

/**
 * Create static slot meshes (background panels for each cell)
 */
export function createSlots() {
    // Create caps first
    createCaps();
    
    // Create face panels
    createFacePanels();
    
    const slotGeometry = new THREE.BoxGeometry(CELL_SIZE, CELL_SIZE, 0.02);
    const slotMaterial = new THREE.MeshBasicMaterial({
        color: COLORS.slot
    });
    
    const borderGeometry = new THREE.BoxGeometry(CELL_SIZE + 0.04, CELL_SIZE + 0.04, 0.01);
    const borderMaterial = new THREE.MeshBasicMaterial({
        color: COLORS.slotBorder
    });
    
    for (let layer = 0; layer < LAYERS; layer++) {
        for (let face = 0; face < FACES; face++) {
            const position = getCellPosition(layer, face);
            const rotation = getCellRotation(face);
            const angle = getFaceAngle(face);
            
            const normal = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
            
            // Border
            const border = new THREE.Mesh(borderGeometry, borderMaterial);
            border.position.copy(position);
            border.rotation.copy(rotation);
            prismGroup.add(border);
            
            // Slot
            const slot = new THREE.Mesh(slotGeometry, slotMaterial);
            slot.position.copy(position).add(normal.clone().multiplyScalar(0.005));
            slot.rotation.copy(rotation);
            
            slot.userData = { layer, face, type: 'slot' };
            slotMeshes.push(slot);
            prismGroup.add(slot);
        }
    }
}

/**
 * Create chip meshes based on initial state
 */
export function createChips(state) {
    const chipGeometry = new THREE.BoxGeometry(CELL_SIZE * 0.8, CELL_SIZE * 0.8, 0.04);
    
    // Clear existing chips
    while (chipGroup.children.length > 0) {
        const child = chipGroup.children[0];
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
        chipGroup.remove(child);
    }
    chipMeshes = {};
    
    let chipIndex = 0;
    
    for (let layer = 0; layer < LAYERS; layer++) {
        for (let face = 0; face < FACES; face++) {
            const chipValue = state[layer][face];
            
            if (chipValue === EMPTY) continue;
            
            const chipMaterial = new THREE.MeshBasicMaterial({
                color: COLORS[chipValue]
            });
            
            const chip = new THREE.Mesh(chipGeometry, chipMaterial);
            
            const position = getCellPosition(layer, face);
            const rotation = getCellRotation(face);
            const angle = getFaceAngle(face);
            
            const normal = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
            
            chip.position.copy(position).add(normal.multiplyScalar(CHIP_OFFSET + 0.015));
            chip.rotation.copy(rotation);
            
            chip.userData = {
                type: 'chip',
                chipValue,
                layer,
                face,
                chipId: `chip_${chipIndex}`
            };
            
            chipMeshes[`chip_${chipIndex}`] = chip;
            chipGroup.add(chip);
            chipIndex++;
        }
    }
    
    markDirty(); // Trigger render after chip creation
}

/**
 * Highlight a chip as selected with lift animation
 * Optimized: pre-calculate values, minimal object creation
 * Uses unified render loop via markDirty()
 */
export function selectChip(chip) {
    // Clear previous selection
    clearSelection();
    
    if (!chip) return;
    
    selectedChip = chip;
    
    // Store base position for the lift effect
    const { face } = chip.userData;
    const angle = getFaceAngle(face);
    const nx = Math.sin(angle);
    const nz = Math.cos(angle);
    
    // Store original position
    const startX = chip.position.x;
    const startY = chip.position.y;
    const startZ = chip.position.z;
    selectedChipBasePos = new THREE.Vector3(startX, startY, startZ);
    
    // Calculate end position
    const liftAmount = 0.15;
    const endX = startX + nx * liftAmount;
    const endY = startY;
    const endZ = startZ + nz * liftAmount;
    
    const liftDuration = 150;
    const startTime = performance.now();
    
    // Cancel any existing selection animation
    if (selectionAnimationId) {
        cancelAnimationFrame(selectionAnimationId);
    }
    
    function animateLift() {
        if (selectedChip !== chip) return; // Chip was deselected
        
        const elapsed = performance.now() - startTime;
        const t = Math.min(elapsed / liftDuration, 1);
        
        // Ease out quad
        const eased = 1 - (1 - t) * (1 - t);
        
        // Direct position interpolation
        chip.position.x = startX + (endX - startX) * eased;
        chip.position.y = startY + (endY - startY) * eased;
        chip.position.z = startZ + (endZ - startZ) * eased;
        
        const scale = 1 + 0.1 * eased;
        chip.scale.x = scale;
        chip.scale.y = scale;
        chip.scale.z = scale;
        
        markDirty(); // Signal that scene changed
        
        if (t < 1) {
            selectionAnimationId = requestAnimationFrame(animateLift);
        } else {
            // Start subtle floating animation - pass pre-calculated values
            startFloatAnimation(chip, { x: endX, y: endY, z: endZ }, { x: nx, y: 0, z: nz });
        }
    }
    
    selectionAnimationId = requestAnimationFrame(animateLift);
}

/**
 * Subtle floating animation for selected chip
 * Optimized: accepts plain objects, no object creation per frame
 * Uses unified render loop via markDirty()
 */
function startFloatAnimation(chip, basePos, normal) {
    const floatAmount = 0.03;
    const floatSpeed = 0.003;
    let floatTime = 0;
    
    // Use provided values directly
    const nx = normal.x;
    const nz = normal.z;
    const bx = basePos.x;
    const by = basePos.y;
    const bz = basePos.z;
    
    function animateFloat() {
        if (selectedChip !== chip) return; // Chip was deselected
        
        floatTime += floatSpeed;
        const offset = Math.sin(floatTime * Math.PI * 2) * floatAmount;
        
        // Direct position update without object creation
        chip.position.x = bx + nx * offset;
        chip.position.y = by;
        chip.position.z = bz + nz * offset;
        
        markDirty(); // Signal that scene changed
        
        selectionAnimationId = requestAnimationFrame(animateFloat);
    }
    
    selectionAnimationId = requestAnimationFrame(animateFloat);
}

/**
 * Highlight valid target slots
 */
export function highlightValidTargets(targets) {
    validTargets = targets;
    
    // Clear existing highlights
    clearHighlights();
    
    const highlightGeometry = new THREE.BoxGeometry(CELL_SIZE * 0.85, CELL_SIZE * 0.85, 0.05);
    const highlightMaterial = new THREE.MeshBasicMaterial({
        color: COLORS.highlight,
        transparent: true,
        opacity: 0.6
    });
    
    for (const target of targets) {
        const { layer, face, dir } = target;
        const position = getCellPosition(layer, face);
        const rotation = getCellRotation(face);
        const angle = getFaceAngle(face);
        const normal = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
        
        const highlight = new THREE.Mesh(highlightGeometry, highlightMaterial.clone());
        highlight.position.copy(position).add(normal.multiplyScalar(CHIP_OFFSET + 0.02));
        highlight.rotation.copy(rotation);
        // Include dir in userData for slide functionality
        highlight.userData = { type: 'highlight', layer, face, dir };
        
        highlightMeshes.push(highlight);
        prismGroup.add(highlight);
    }
    
    markDirty(); // Trigger render for new highlights
}

/**
 * Clear highlight meshes
 */
export function clearHighlights() {
    if (highlightMeshes.length === 0) return;
    
    for (const mesh of highlightMeshes) {
        prismGroup.remove(mesh);
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) mesh.material.dispose();
    }
    highlightMeshes = [];
    validTargets = [];
    
    markDirty(); // Trigger render after clearing
}

/**
 * Clear selection state
 */
export function clearSelection() {
    // Cancel floating animation
    if (selectionAnimationId) {
        cancelAnimationFrame(selectionAnimationId);
        selectionAnimationId = null;
    }
    
    if (selectedChip) {
        // Reset to original position
        if (selectedChipBasePos) {
            selectedChip.position.copy(selectedChipBasePos);
        }
        selectedChip.scale.set(1, 1, 1);
        selectedChip = null;
        selectedChipBasePos = null;
        markDirty(); // Trigger render after chip reset
    }
    clearHighlights();
}

/**
 * Get selected chip
 */
export function getSelectedChip() {
    return selectedChip;
}

/**
 * Get valid targets
 */
export function getValidTargets() {
    return validTargets;
}

/**
 * Full rebuild of chips from state
 */
export function rebuildChips(state) {
    clearSelection();
    createChips(state);
}

/**
 * Animate a slide move with lift effect
 * Optimized: pre-calculate all values, no object creation during animation
 * Uses unified render loop via markDirty()
 */
export function animateSlide(state, face, fromLayer, toLayer, duration = 250) {
    return new Promise((resolve) => {
        if (isAnimating) {
            resolve();
            return;
        }
        
        isAnimating = true;
        
        const movingChip = chipGroup.children.find(chip => 
            chip.userData.layer === fromLayer && 
            chip.userData.face === face
        );
        
        if (!movingChip) {
            isAnimating = false;
            resolve();
            return;
        }
        
        // Pre-calculate all constants
        const angle = getFaceAngle(face);
        const nx = Math.sin(angle);
        const nz = Math.cos(angle);
        const offset = CHIP_OFFSET + 0.015;
        
        // Calculate start position (base, not lifted)
        const fromY = (fromLayer - (LAYERS - 1) / 2) * CELL_STEP;
        const toY = (toLayer - (LAYERS - 1) / 2) * CELL_STEP;
        const baseX = APOTHEM * nx + nx * offset;
        const baseZ = APOTHEM * nz + nz * offset;
        
        // Store deltas
        const deltaY = toY - fromY;
        
        const startTime = performance.now();
        const liftAmount = 0.12;
        
        // Reset scale
        movingChip.scale.set(1, 1, 1);
        
        // Final position values
        const finalX = baseX;
        const finalY = toY;
        const finalZ = baseZ;
        
        function animate() {
            const elapsed = performance.now() - startTime;
            const t = Math.min(elapsed / duration, 1);
            
            // Ease in-out quad
            const eased = t < 0.5 
                ? 2 * t * t 
                : 1 - Math.pow(-2 * t + 2, 2) / 2;
            
            // Calculate lift - peaks in the middle
            const lift = Math.sin(t * Math.PI) * liftAmount;
            
            // Direct position update
            movingChip.position.x = baseX + nx * lift;
            movingChip.position.y = fromY + deltaY * eased;
            movingChip.position.z = baseZ + nz * lift;
            
            markDirty(); // Signal that scene changed
            
            if (t < 1) {
                requestAnimationFrame(animate);
            } else {
                // Snap to exact final position
                movingChip.position.x = finalX;
                movingChip.position.y = finalY;
                movingChip.position.z = finalZ;
                movingChip.userData.layer = toLayer;
                isAnimating = false;
                markDirty(); // Final render
                resolve();
            }
        }
        
        requestAnimationFrame(animate);
    });
}

/**
 * Animate a rotate move - chips slide along the prism surface
 * This creates a physically realistic animation where chips move
 * along the faces of the prism, lifting slightly over the edges
 * Optimized: minimal object creation during animation
 * Uses unified render loop via markDirty()
 */
export function animateRotate(state, layer, direction = 1, duration = 400) {
    return new Promise((resolve) => {
        if (isAnimating) {
            resolve();
            return;
        }
        
        isAnimating = true;
        
        // Find all chips in this layer
        const layerChips = chipGroup.children.filter(chip => 
            chip.userData.layer === layer
        );
        
        // Pre-calculate constants
        const y = (layer - (LAYERS - 1) / 2) * CELL_STEP;
        const baseRadius = APOTHEM + CHIP_OFFSET + 0.015;
        const edgeLift = 0.15;
        const angleStep = (2 * Math.PI / FACES) * direction;
        
        // Store start and end data for each chip - pre-calculate end positions
        const chipAnimData = layerChips.map(chip => {
            const startFace = chip.userData.face;
            const endFace = (startFace + direction + FACES) % FACES;
            const startAngle = getFaceAngle(startFace);
            const endAngle = getFaceAngle(endFace);
            
            // Pre-calculate final position
            const finalX = baseRadius * Math.sin(endAngle);
            const finalZ = baseRadius * Math.cos(endAngle);
            
            return {
                chip,
                endFace,
                startAngle,
                angleDelta: angleStep,
                finalX,
                finalY: y,
                finalZ,
                endAngle
            };
        });
        
        const startTime = performance.now();
        
        function animate() {
            const elapsed = performance.now() - startTime;
            const t = Math.min(elapsed / duration, 1);
            
            // Smooth easing: ease-in-out cubic
            const eased = t < 0.5 
                ? 4 * t * t * t 
                : 1 - Math.pow(-2 * t + 2, 3) / 2;
            
            // Calculate lift curve - peaks in the middle
            const liftAmount = Math.sin(t * Math.PI) * edgeLift;
            const currentRadius = baseRadius + liftAmount;
            
            // Update each chip position along the prism surface arc
            for (let i = 0; i < chipAnimData.length; i++) {
                const data = chipAnimData[i];
                const currentAngle = data.startAngle + data.angleDelta * eased;
                
                // Direct position update
                data.chip.position.x = currentRadius * Math.sin(currentAngle);
                data.chip.position.y = y;
                data.chip.position.z = currentRadius * Math.cos(currentAngle);
                data.chip.rotation.y = currentAngle;
            }
            
            markDirty(); // Signal that scene changed
            
            if (t < 1) {
                requestAnimationFrame(animate);
            } else {
                // Animation complete - snap chips to exact final positions
                for (let i = 0; i < chipAnimData.length; i++) {
                    const data = chipAnimData[i];
                    data.chip.position.x = data.finalX;
                    data.chip.position.y = data.finalY;
                    data.chip.position.z = data.finalZ;
                    data.chip.rotation.y = data.endAngle;
                    data.chip.rotation.x = 0;
                    data.chip.rotation.z = 0;
                    data.chip.userData.face = data.endFace;
                }
                
                isAnimating = false;
                markDirty(); // Final render
                resolve();
            }
        }
        
        requestAnimationFrame(animate);
    });
}

/**
 * Check if currently animating
 */
export function getIsAnimating() {
    return isAnimating;
}

/**
 * Render the scene
 */
export function render() {
    renderer.render(scene, camera);
}

/**
 * Get all chip meshes for raycasting
 */
export function getChipMeshes() {
    return chipGroup.children;
}

/**
 * Get all highlight meshes for raycasting
 */
export function getHighlightMeshes() {
    return highlightMeshes;
}

/**
 * Get slot meshes
 */
export function getSlotMeshes() {
    return slotMeshes;
}

/**
 * Get scene objects
 */
export function getSceneObjects() {
    return { scene, camera, renderer, chipGroup, prismGroup };
}

/**
 * Create a button with arrow texture
 */
function createArrowButton(arrowDirection, color) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    
    // Draw circle background
    ctx.beginPath();
    ctx.arc(64, 64, 60, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    
    // Draw arrow
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 70px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(arrowDirection === 1 ? '↑' : '↓', 64, 64);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    
    const spriteMaterial = new THREE.SpriteMaterial({ 
        map: texture,
        transparent: true
    });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(0.8, 0.8, 1);
    
    return sprite;
}

/**
 * Create 3D rotation control buttons above and below the prism
 */
export function createRotationControls() {
    const buttonOffset = APOTHEM + 1.0;
    
    for (let layer = 0; layer < LAYERS; layer++) {
        const xPos = -((layer - (LAYERS - 1) / 2) * CELL_STEP);
        
        // Top button (clockwise = up arrow)
        const topButton = createArrowButton(1, '#4a90d9');
        topButton.position.set(xPos, buttonOffset, 0);
        topButton.userData = { type: 'rotateButton', layer, direction: 1 };
        controlButtons.push(topButton);
        scene.add(topButton);
        
        // Bottom button (counter-clockwise = down arrow)
        const bottomButton = createArrowButton(-1, '#d94a4a');
        bottomButton.position.set(xPos, -buttonOffset, 0);
        bottomButton.userData = { type: 'rotateButton', layer, direction: -1 };
        controlButtons.push(bottomButton);
        scene.add(bottomButton);
    }
}

/**
 * Check if camera is viewing from the "back" side of the prism
 * Returns true if we need to flip rotation direction
 */
export function shouldFlipRotationDirection() {
    if (!camera) return false;
    
    // The prism is horizontal along X axis
    // "Front" is positive Z, "Back" is negative Z
    // We flip when viewing from back (negative Z side)
    // Use atan2 to get the angle and check if we're in the back half
    const angle = Math.atan2(camera.position.x, camera.position.z);
    
    // If angle is between -90° and 90° (i.e., |angle| < π/2), we're viewing from front
    // Otherwise we're viewing from back and should flip
    return Math.abs(angle) > Math.PI / 2;
}

/**
 * Update rotation controls to face the camera
 */
export function updateRotationControls() {
    // Sprites auto-face camera, no update needed
}

/**
 * Get rotation control buttons for raycasting
 */
export function getRotationButtons() {
    return controlButtons.filter(b => b.userData.type === 'rotateButton');
}
