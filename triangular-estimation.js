const button = document.getElementById('calc');
const resultEl = document.getElementById('result');
const canvas = document.getElementById('chart');
const ctx = canvas.getContext('2d');

function drawGraph(values) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const max = Math.max(...values, 1);
    const gap = 20;
    const barWidth = (canvas.width - gap * (values.length + 1)) / values.length;
    values.forEach((v, i) => {
        const barHeight = (v / max) * (canvas.height - 40);
        const x = gap + i * (barWidth + gap);
        const y = canvas.height - barHeight - 20;
        ctx.fillStyle = ['#4caf50', '#2196f3', '#f44336'][i];
        ctx.fillRect(x, y, barWidth, barHeight);
        ctx.fillStyle = '#000';
        ctx.fillText(v, x + barWidth / 2 - 10, y - 5);
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
    drawGraph([o, r, p]);
    const estimate = (o + 4 * r + p) / 6;
    resultEl.textContent = 'Итоговая оценка: ' + estimate.toFixed(2);
});
