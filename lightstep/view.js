import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { PATTERNS, RULES, keyOf, occupiedCells, patternAt } from './game.js';

const PALETTE = { tile: '#35433e', side: '#293831', fragile: '#ae625b', fragileSide: '#784740', green: '#83ac7d', white: '#f9f7ef', gold: '#c4ac78', exit: '#a4874e', exitSide: '#736347', ball: '#e6edde' };

export function createView(canvas) {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 100);
    camera.position.set(-5, 19, 16);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    scene.add(new THREE.HemisphereLight('#f7f6e9', '#64745e', 2.6));
    const sun = new THREE.DirectionalLight('#fff9e9', 3.2);
    sun.position.set(-9, 18, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 1, far: 50 });
    sun.shadow.normalBias = 0.035;
    sun.shadow.bias = -0.0001;
    sun.shadow.radius = 4;
    scene.add(sun);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.ShadowMaterial({ color: '#344637', opacity: 0.17 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.63;
    ground.receiveShadow = true;
    scene.add(ground);

    const topGeometry = new RoundedBoxGeometry(0.942, 0.15, 0.942, 2, 0.045);
    const sideGeometry = new RoundedBoxGeometry(0.943, 0.33, 0.943, 2, 0.035);
    const topMaterial = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, metalness: 0 });
    const sideMaterial = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1 });
    const ballMaterial = new THREE.MeshStandardMaterial({ color: PALETTE.ball, roughness: 0.88, metalness: 0 });
    const ball = new THREE.Mesh(new THREE.SphereGeometry(RULES.radius, 32, 24), ballMaterial);
    ball.castShadow = true;
    scene.add(ball);

    // Ground projection makes the sphere's landing position readable during a jump.
    const marker = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.32, 40), new THREE.MeshBasicMaterial({ color: '#d8ebc6', transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide }));
    marker.rotation.x = -Math.PI / 2;
    scene.add(marker);

    const arrowShape = new THREE.Shape();
    arrowShape.moveTo(-0.09, 1.4);
    arrowShape.lineTo(0.09, 1.4);
    arrowShape.lineTo(0.09, 0.92);
    arrowShape.lineTo(0.3, 0.92);
    arrowShape.lineTo(0, 0.54);
    arrowShape.lineTo(-0.3, 0.92);
    arrowShape.lineTo(-0.09, 0.92);
    arrowShape.closePath();
    const arrowGeometry = new THREE.ExtrudeGeometry(arrowShape, { depth: 0.12, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.02, bevelThickness: 0.02 });
    arrowGeometry.translate(0, 0, -0.06);
    const exit = new THREE.Mesh(arrowGeometry, new THREE.MeshStandardMaterial({ color: PALETTE.gold, roughness: 1 }));
    // The arrow stays vertical and faces the fixed camera, pointing at the tile below.
    exit.rotation.y = Math.atan2(camera.position.x, camera.position.z);
    exit.castShadow = true;
    scene.add(exit);

    let map, tops, sides;
    const hiddenCells = new Set();
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();
    const tileColors = Object.fromEntries(Object.entries(PALETTE).map(([name, value]) => [name, new THREE.Color(value)]));
    const toWorld = cell => ({ x: cell.x - (map.width - 1) / 2, z: cell.z - (map.depth - 1) / 2 });

    function resize() {
        const width = canvas.clientWidth, height = canvas.clientHeight;
        if (!width || !height) return;
        renderer.setSize(width, height, false);
        if (!map) return;
        // Fit the complete 3D board into the canvas without tracking the player.
        const projected = [];
        for (const x of [-map.width / 2 - 0.7, map.width / 2 + 0.7]) {
            for (const z of [-map.depth / 2 - 0.7, map.depth / 2 + 0.7]) {
                for (const y of [-0.8, 1.8]) projected.push(new THREE.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse));
            }
        }
        const minX = Math.min(...projected.map(p => p.x)), maxX = Math.max(...projected.map(p => p.x));
        const minY = Math.min(...projected.map(p => p.y)), maxY = Math.max(...projected.map(p => p.y));
        const usableHeight = Math.max(height * 0.45, height - 48);
        const scale = Math.max((maxX - minX) / (width * 0.9), (maxY - minY) / usableHeight);
        const halfWidth = width * scale / 2, halfHeight = height * scale / 2;
        const centerY = (minY + maxY) / 2;
        camera.left = -halfWidth;
        camera.right = halfWidth;
        camera.top = centerY + halfHeight;
        camera.bottom = centerY - halfHeight;
        camera.updateProjectionMatrix();
    }

    function build(nextMap) {
        map = nextMap;
        hiddenCells.clear();
        for (const mesh of [tops, sides]) {
            if (mesh) {
                scene.remove(mesh);
                mesh.dispose();
            }
        }
        tops = new THREE.InstancedMesh(topGeometry, topMaterial, map.cells.length);
        sides = new THREE.InstancedMesh(sideGeometry, sideMaterial, map.cells.length);
        tops.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(map.cells.length * 3), 3);
        tops.instanceColor.setUsage(THREE.DynamicDrawUsage);
        tops.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        sides.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        tops.receiveShadow = true;
        sides.castShadow = true;
        sides.receiveShadow = true;
        map.cells.forEach((cell, i) => {
            const p = toWorld(cell);
            matrix.makeTranslation(p.x, -0.075, p.z);
            tops.setMatrixAt(i, matrix);
            matrix.makeTranslation(p.x, -0.295, p.z);
            sides.setMatrixAt(i, matrix);
            const isExit = cell.x === map.exit.x && cell.z === map.exit.z;
            sides.setColorAt(i, isExit ? tileColors.exitSide : cell.type === 'fragile' ? tileColors.fragileSide : tileColors.side);
        });
        tops.instanceMatrix.needsUpdate = true;
        sides.instanceMatrix.needsUpdate = true;
        sides.instanceColor.needsUpdate = true;
        scene.add(sides, tops);
        const target = toWorld(map.exit);
        exit.position.set(target.x, 0, target.z);
        resize();
    }

    function render(game) {
        const time = game.elapsed;
        const warningLead = PATTERNS[game.patternIndex].warningLead;
        const occupied = new Set(occupiedCells(game.map, game.player).map(c => keyOf(c.x, c.z)));
        map.cells.forEach((cell, i) => {
            const key = keyOf(cell.x, cell.z);
            if (!game.map.cellSet.has(key)) {
                if (!hiddenCells.has(key)) {
                    matrix.makeScale(0, 0, 0);
                    tops.setMatrixAt(i, matrix);
                    sides.setMatrixAt(i, matrix);
                    tops.instanceMatrix.needsUpdate = true;
                    sides.instanceMatrix.needsUpdate = true;
                    hiddenCells.add(key);
                }
                return;
            }
            const active = patternAt(game.patternIndex, cell.x, cell.z, map, time, game.patternSpeed);
            const standing = occupied.has(key) && !game.player.falling;
            // White always remains readable, including under an airborne player.
            if (active) color.copy(tileColors.white);
            else if (standing) color.copy(tileColors.green);
            else {
                const isExit = cell.x === map.exit.x && cell.z === map.exit.z;
                color.copy(isExit ? tileColors.exit : cell.type === 'fragile' ? tileColors.fragile : tileColors.tile);
                if (warningLead && patternAt(game.patternIndex, cell.x, cell.z, map, time + warningLead, game.patternSpeed)) color.copy(tileColors.tile).lerp(tileColors.white, 0.25);
            }
            tops.setColorAt(i, color);
        });
        tops.instanceColor.needsUpdate = true;
        const player = toWorld(game.player);
        ball.position.set(player.x, RULES.radius + game.player.h, player.z);
        ball.visible = game.player.h > -2.5;
        ballMaterial.color.set(game.status === 'dead' ? '#b98b78' : PALETTE.ball);
        marker.position.set(player.x, 0.016, player.z);
        marker.visible = !game.player.falling;
        marker.scale.setScalar(1 + Math.max(0, game.player.h) * 0.12);
        renderer.render(scene, camera);
    }

    return { build, render, resize };
}
