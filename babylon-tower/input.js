/**
 * Pentagonal Prism Slider - Input & Controls Module
 * 
 * Main entry point that:
 * - Initializes the game
 * - Sets up OrbitControls (rotation only, no pan)
 * - Handles raycasting for chip clicks (two-step selection)
 * - Handles 3D rotation button clicks
 * - Coordinates state updates with rendering
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import {
    createSolvedState,
    cloneState,
    isSolved,
    applyRotate,
    applySlide,
    canSlide,
    scramble,
    EMPTY
} from './logic.js';

import {
    initScene,
    createSlots,
    createChips,
    rebuildChips,
    animateSlide,
    animateRotate,
    getIsAnimating,
    render,
    getChipMeshes,
    getHighlightMeshes,
    getSlotMeshes,
    getSceneObjects,
    selectChip,
    highlightValidTargets,
    clearSelection,
    getSelectedChip,
    getValidTargets,
    createRotationControls,
    updateRotationControls,
    getRotationButtons,
    shouldFlipRotationDirection,
    markDirty,
    consumeRenderFlag
} from './render.js';

// Game state
let gameState = null;
let moveCount = 0;
let undoStack = [];
let wasSolvedBeforeMove = false;  // Track if puzzle was solved before current move
let solvedByUser = false;         // Track if user actually solved the puzzle

// Three.js objects
let controls = null;
let raycaster = null;
let mouse = new THREE.Vector2();

// DOM elements
let infoEl, lastMoveEl;

/**
 * Initialize the game
 */
function init() {
    const canvas = document.getElementById('game-canvas');
    
    const { scene, camera, renderer } = initScene(canvas);
    
    // Setup OrbitControls - rotation only, no panning
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enablePan = false;  // Disable panning
    controls.minDistance = 6;
    controls.maxDistance = 15;
    // Allow full rotation
    controls.minPolarAngle = 0.1;
    controls.maxPolarAngle = Math.PI - 0.1;
    
    raycaster = new THREE.Raycaster();
    
    gameState = createSolvedState();
    
    createSlots();
    createChips(gameState);
    createRotationControls();
    
    infoEl = document.getElementById('info');
    lastMoveEl = document.getElementById('last-move');
    
    setupEventListeners(canvas);
    
    animate();
    
    updateHUD();
    
    console.log('Pentagonal Prism Slider initialized');
}

/**
 * Animation loop - optimized to only render when needed
 * Uses dirty flag pattern to prevent unnecessary renders
 */
function animate() {
    requestAnimationFrame(animate);
    
    // Check if OrbitControls changed the camera
    // OrbitControls with damping sets this flag when there's movement
    const controlsChanged = controls.update();
    
    // Only render if something changed
    if (controlsChanged || consumeRenderFlag()) {
        updateRotationControls();  // Keep buttons facing camera
        render();
    }
}

/**
 * Setup all event listeners
 */
function setupEventListeners(canvas) {
    canvas.addEventListener('click', onCanvasClick);
    
    document.getElementById('reset-btn').addEventListener('click', handleReset);
    document.getElementById('scramble-btn').addEventListener('click', handleScramble);
    document.getElementById('undo-btn').addEventListener('click', handleUndo);
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            clearSelection();
        }
    });
}

/**
 * Handle canvas click
 */
function onCanvasClick(event) {
    if (getIsAnimating()) return;
    
    const { camera } = getSceneObjects();
    
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    
    // Check for rotation button clicks first
    const rotationButtons = getRotationButtons();
    const buttonIntersects = raycaster.intersectObjects(rotationButtons);
    
    if (buttonIntersects.length > 0) {
        const button = buttonIntersects[0].object;
        const { layer, direction } = button.userData;
        
        // Flip direction if viewing from the back side
        const actualDirection = shouldFlipRotationDirection() ? -direction : direction;
        handleRotate(layer, actualDirection);
        return;
    }
    
    const selectedChip = getSelectedChip();
    
    // If we have a selected chip, check if clicking on a valid target
    if (selectedChip) {
        const highlights = getHighlightMeshes();
        const highlightIntersects = raycaster.intersectObjects(highlights);
        
        if (highlightIntersects.length > 0) {
            const target = highlightIntersects[0].object;
            handleSlideToTarget(selectedChip, target.userData);
            return;
        }
        
        const validTargetsList = getValidTargets();
        const slots = getSlotMeshes();
        const slotIntersects = raycaster.intersectObjects(slots);
        
        if (slotIntersects.length > 0) {
            const slot = slotIntersects[0].object;
            const matchingTarget = validTargetsList.find(t => 
                t.layer === slot.userData.layer && t.face === slot.userData.face
            );
            
            if (matchingTarget) {
                handleSlideToTarget(selectedChip, matchingTarget);
                return;
            }
        }
    }
    
    // Check if clicking on a chip
    const chips = getChipMeshes();
    const chipIntersects = raycaster.intersectObjects(chips);
    
    if (chipIntersects.length > 0) {
        const chip = chipIntersects[0].object;
        handleChipClick(chip);
        return;
    }
    
    // Clicked on nothing - clear selection
    clearSelection();
}

/**
 * Handle click on a chip - select it and show valid targets
 */
function handleChipClick(chip) {
    if (getIsAnimating()) return;
    
    const { layer, face } = chip.userData;
    
    const validTargets = [];
    
    if (canSlide(gameState, face, layer, -1)) {
        validTargets.push({ layer: layer - 1, face, dir: -1 });
    }
    
    if (canSlide(gameState, face, layer, 1)) {
        validTargets.push({ layer: layer + 1, face, dir: 1 });
    }
    
    if (validTargets.length === 0) {
        console.log(`No valid slide targets for chip at layer=${layer}, face=${face}`);
        clearSelection();
        return;
    }
    
    selectChip(chip);
    highlightValidTargets(validTargets);
}

/**
 * Handle slide to a specific target
 */
async function handleSlideToTarget(chip, targetData) {
    if (getIsAnimating()) return;
    
    const { layer: fromLayer, face } = chip.userData;
    const { layer: toLayer, dir } = targetData;
    
    if (!canSlide(gameState, face, fromLayer, dir)) {
        clearSelection();
        return;
    }
    
    // Check if puzzle was solved before this move
    wasSolvedBeforeMove = isSolved(gameState);
    
    undoStack.push({
        state: cloneState(gameState),
        moveCount: moveCount,
        solvedByUser: solvedByUser
    });
    
    clearSelection();
    
    await animateSlide(gameState, face, fromLayer, toLayer);
    
    applySlide(gameState, face, fromLayer, dir);
    
    // If puzzle was solved before move, reset counter to 1
    if (wasSolvedBeforeMove) {
        moveCount = 1;
        solvedByUser = false;
    } else {
        moveCount++;
    }
    
    // Check if user just solved the puzzle
    if (isSolved(gameState) && !wasSolvedBeforeMove) {
        solvedByUser = true;
    }
    
    updateHUD();
    updateLastMove(`S ${face} ${fromLayer} ${dir}`);
}

/**
 * Handle rotate move
 */
async function handleRotate(layer, direction = 1) {
    if (getIsAnimating()) return;
    
    clearSelection();
    
    // Check if puzzle was solved before this move
    wasSolvedBeforeMove = isSolved(gameState);
    
    undoStack.push({
        state: cloneState(gameState),
        moveCount: moveCount,
        solvedByUser: solvedByUser
    });
    
    await animateRotate(gameState, layer, direction);
    
    applyRotate(gameState, layer, direction);
    
    // If puzzle was solved before move, reset counter to 1
    if (wasSolvedBeforeMove) {
        moveCount = 1;
        solvedByUser = false;
    } else {
        moveCount++;
    }
    
    // Check if user just solved the puzzle
    if (isSolved(gameState) && !wasSolvedBeforeMove) {
        solvedByUser = true;
    }
    
    updateHUD();
    updateLastMove(`R ${layer} ${direction > 0 ? 'CW' : 'CCW'}`);
}

/**
 * Handle reset
 */
function handleReset() {
    if (getIsAnimating()) return;
    
    clearSelection();
    gameState = createSolvedState();
    moveCount = 0;
    undoStack = [];
    solvedByUser = false;  // Reset doesn't count as user solving
    
    rebuildChips(gameState);
    markDirty(); // Trigger render after chip rebuild
    updateHUD();
    updateLastMove('RESET');
    
    console.log('Game reset to solved state');
}

/**
 * Handle scramble
 */
function handleScramble() {
    if (getIsAnimating()) return;
    
    clearSelection();
    gameState = createSolvedState();
    scramble(gameState, 30);
    
    moveCount = 0;
    undoStack = [];
    solvedByUser = false;
    
    rebuildChips(gameState);
    markDirty(); // Trigger render after chip rebuild
    updateHUD();
    updateLastMove('SCRAMBLE');
}

/**
 * Handle undo
 */
function handleUndo() {
    if (getIsAnimating()) return;
    if (undoStack.length === 0) return;
    
    clearSelection();
    const previous = undoStack.pop();
    gameState = previous.state;
    moveCount = previous.moveCount;
    solvedByUser = previous.solvedByUser || false;
    
    rebuildChips(gameState);
    markDirty(); // Trigger render after chip rebuild
    updateHUD();
    updateLastMove('UNDO');
    
    console.log('Undo performed');
}

/**
 * Update HUD display
 */
function updateHUD() {
    const solved = isSolved(gameState);
    // Only show "SOLVED!" if user actually solved it through gameplay
    const showSolved = solved && solvedByUser;
    const statusText = showSolved ? 'SOLVED!' : (solved ? 'Ready' : 'Not Solved');
    
    infoEl.textContent = `Moves: ${moveCount} | ${statusText}`;
    
    if (showSolved) {
        infoEl.classList.add('solved');
    } else {
        infoEl.classList.remove('solved');
    }
}

/**
 * Update last move display
 */
function updateLastMove(moveStr) {
    lastMoveEl.textContent = `Last: ${moveStr}`;
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
