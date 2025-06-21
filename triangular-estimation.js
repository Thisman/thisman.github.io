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

function drawGraph(o, r, p, estimate) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const margin = 40;
    const maxX = Math.max(o, r, p, estimate) + 2;
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

    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const xTicks = Math.min(10, Math.ceil(maxX));
    for (let i = 0; i <= xTicks; i++) {
        const value = (maxX / xTicks) * i;
        const x = margin + value * scaleX;
        ctx.beginPath();
        ctx.moveTo(x, canvas.height - margin);
        ctx.lineTo(x, canvas.height - margin + 5);
        ctx.stroke();
        ctx.fillText(value.toFixed(1).replace(/\.0$/, ''), x, canvas.height - margin + 7);
    }

    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const yTicks = 10;
    for (let i = 0; i <= yTicks; i++) {
        const value = (maxY / yTicks) * i;
        const y = canvas.height - margin - value * scaleY;
        ctx.beginPath();
        ctx.moveTo(margin - 5, y);
        ctx.lineTo(margin, y);
        ctx.stroke();
        ctx.fillText(value.toFixed(2).replace(/\.0+$/, ''), margin - 7, y);
    }

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('Оценка', canvas.width - margin, canvas.height - margin + 20);
    ctx.restore();

    ctx.save();
    ctx.translate(margin - 25, margin);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('Вероятность', 0, 0);
    ctx.restore();

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    const xO = margin + o * scaleX;
    const yO = canvas.height - margin;
    const xR = margin + r * scaleX;
    const yR = canvas.height - margin - triangularPdf(r, o, r, p) * scaleY;
    const xP = margin + p * scaleX;
    const yP = canvas.height - margin;
    ctx.moveTo(xO, yO);
    ctx.quadraticCurveTo((xO + xR) / 2, yO, xR, yR);
    ctx.quadraticCurveTo((xR + xP) / 2, yP, xP, yP);
    ctx.stroke();

    const colors = ['#009688', '#ff8f00', '#b71c1c'];
    [o, r, p].forEach((val, i) => {
        const yVal = triangularPdf(val, o, r, p);
        const x = margin + val * scaleX;
        const y = canvas.height - margin - yVal * scaleY;
        ctx.fillStyle = colors[i];
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
    });

    const yVal = triangularPdf(estimate, o, r, p);
    const x = margin + estimate * scaleX;
    const y = canvas.height - margin - yVal * scaleY;
    ctx.fillStyle = '#000';
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
}

button.addEventListener('click', () => {
    const o = parseFloat(document.getElementById('optimistic').value);
    const r = parseFloat(document.getElementById('realistic').value);
    const p = parseFloat(document.getElementById('pessimistic').value);
    if (isNaN(o) || isNaN(r) || isNaN(p)) {
        resultEl.textContent = 'Введите все оценки';
        return;
    }
    const estimate = Math.ceil((o + 4 * r + p) / 6);
    drawGraph(o, r, p, estimate);
    resultEl.textContent = 'Итоговая оценка: ' + estimate;
});
