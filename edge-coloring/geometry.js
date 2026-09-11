export const VERTEX_RADIUS = 16;
const TURN = Math.PI * 2;

export function vertexSectors(vertex, vertices, edges) {
    const incident = edges.filter(edge => edge.a === vertex.id || edge.b === vertex.id).map(edge => {
        const other = vertices.get(edge.a === vertex.id ? edge.b : edge.a);
        return { edgeId: edge.id, angle: Math.atan2(other.y - vertex.y, other.x - vertex.x) };
    }).sort((a, b) => a.angle - b.angle);
    const span = TURN / incident.length;
    // Keep equal areas and cyclic edge order. This common rotation minimizes
    // the sum of squared distances between edge and sector unit directions.
    let x = 0, y = 0;
    incident.forEach((edge, i) => {
        x += Math.cos(edge.angle - i * span);
        y += Math.sin(edge.angle - i * span);
    });
    const rotation = Math.hypot(x, y) < 1e-9 ? incident[0].angle : Math.atan2(y, x);
    return incident.map((edge, i) => ({ edgeId: edge.edgeId, start: rotation + i * span - span / 2, span }));
}

export function sectorPath(vertex, start, span) {
    const point = angle => `${vertex.x + Math.cos(angle) * VERTEX_RADIUS} ${vertex.y + Math.sin(angle) * VERTEX_RADIUS}`;
    if (span >= TURN - 1e-9) {
        return `M ${point(start)} A ${VERTEX_RADIUS} ${VERTEX_RADIUS} 0 1 1 ${point(start + Math.PI)} A ${VERTEX_RADIUS} ${VERTEX_RADIUS} 0 1 1 ${point(start)} Z`;
    }
    return `M ${vertex.x} ${vertex.y} L ${point(start)} A ${VERTEX_RADIUS} ${VERTEX_RADIUS} 0 ${span > Math.PI ? 1 : 0} 1 ${point(start + span)} Z`;
}

export function projectOnEdge(point, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const fraction = point ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy || 1))) : 0.5;
    return { x: a.x + fraction * dx, y: a.y + fraction * dy };
}
