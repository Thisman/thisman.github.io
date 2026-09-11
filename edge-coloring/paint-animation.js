import { projectOnEdge, VERTEX_RADIUS } from './geometry.js';

const DURATION_MS = 300;
const SVG_NS = 'http://www.w3.org/2000/svg';
let sequence = 0;

export function animatePaint(graph, line, sectors, event, color, onFinish) {
    const a = { x: Number(line.getAttribute('x1')), y: Number(line.getAttribute('y1')) };
    const b = { x: Number(line.getAttribute('x2')), y: Number(line.getAttribute('y2')) };
    // Keyboard/assistive activation starts in the middle. Pointer coordinates
    // are projected onto the edge, including taps inside its wider hit area.
    const pointer = event?.detail > 0 ? new DOMPoint(event.clientX, event.clientY).matrixTransform(graph.getScreenCTM().inverse()) : null;
    const origin = projectOnEdge(pointer, a, b);
    const radius = Math.max(Math.hypot(origin.x - a.x, origin.y - a.y), Math.hypot(origin.x - b.x, origin.y - b.y)) + VERTEX_RADIUS + 1;
    const clip = document.createElementNS(SVG_NS, 'clipPath');
    clip.id = `paint-wave-${++sequence}`;
    clip.setAttribute('clipPathUnits', 'userSpaceOnUse');
    const circle = document.createElementNS(SVG_NS, 'circle');
    circle.setAttribute('cx', origin.x); circle.setAttribute('cy', origin.y); circle.setAttribute('r', 0);
    clip.append(circle);
    graph.querySelector('defs').append(clip);
    const overlays = [line, ...sectors].map(source => {
        const overlay = source.cloneNode(false);
        overlay.removeAttribute('data-sector-edge');
        overlay.setAttribute('class', source === line ? 'edge-wave' : 'vertex-sector-wave');
        overlay.setAttribute('clip-path', `url(#${clip.id})`);
        overlay.style[source === line ? 'stroke' : 'fill'] = color;
        source.parentNode.append(overlay);
        return overlay;
    });
    let frame, finished = false;
    const cleanup = () => {
        cancelAnimationFrame(frame);
        overlays.forEach(overlay => overlay.remove());
        clip.remove();
    };
    const finish = () => {
        if (finished) return;
        finished = true;
        cleanup();
        onFinish();
    };
    const started = performance.now();
    const tick = now => {
        const progress = Math.min(1, (now - started) / DURATION_MS);
        circle.setAttribute('r', radius * progress);
        if (progress >= 1) finish();
        else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return { finish, cancel: () => { finished = true; cleanup(); } };
}
