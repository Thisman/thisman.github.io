const button = document.getElementById('calc');
const resultEl = document.getElementById('result');
const canvas = document.getElementById('chart');
const ctx = canvas.getContext('2d');

function triangularPdf(x, a, c, b) {
    if (x < a || x > b) return 0;
    if (x === c) return 2 / (b - a);
    if (x < c) return (2 * (x - a)) / ((b - a) * (c - a));
    return (2 * (b - x)) / ((b - a) * (b - c));
}

function drawGraph(o, r, p) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const margin = 30;
    const maxX = Math.max(o, r, p) + 2;
    const scaleX = (canvas.width - margin * 2) / maxX;
    const maxY = triangularPdf(r, o, r, p);
    const scaleY = (canvas.height - margin * 2) / maxY;

    ctx.strokeStyle = '#000';
    ctx.beginPath();
    ctx.moveTo(margin, canvas.height - margin);
    ctx.lineTo(canvas.width - margin, canvas.height - margin);
    ctx.moveTo(margin, canvas.height - margin);
    ctx.lineTo(margin, margin);
    ctx.stroke();

    ctx.beginPath();
    for (let i = 0; i <= 100; i++) {
        const xVal = (maxX / 100) * i;
        const yVal = triangularPdf(xVal, o, r, p);
        const x = margin + xVal * scaleX;
        const y = canvas.height - margin - yVal * scaleY;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    const colors = ['#009688', '#ff8f00', '#b71c1c'];
    [o, r, p].forEach((val, i) => {
        const yVal = triangularPdf(val, o, r, p);
        const x = margin + val * scaleX;
        const y = canvas.height - margin - yVal * scaleY;
        ctx.fillStyle = colors[i];
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
    });
}

button.addEventListener('click', () => {
    const o = parseFloat(document.getElementById('optimistic').value);
    const r = parseFloat(document.getElementById('realistic').value);
    const p = parseFloat(document.getElementById('pessimistic').value);
    if (isNaN(o) || isNaN(r) || isNaN(p)) {
        resultEl.textContent = 'Введите все оценки';
        return;
    }
    drawGraph(o, r, p);
    const estimate = (o + 4 * r + p) / 6;
    resultEl.textContent = 'Итоговая оценка: ' + estimate.toFixed(2);
});
