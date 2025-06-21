const button = document.getElementById('calc');
const resultEl = document.getElementById('result');
const ctx = document.getElementById('chart').getContext('2d');
let chart;

function triangularPdf(x, a, c, b) {
    if (x < a || x > b) return 0;
    if (x === c) return 2 / (b - a);
    if (x < c) return (2 * (x - a)) / ((b - a) * (c - a));
    return (2 * (b - x)) / ((b - a) * (b - c));
}

function drawGraph(o, r, p, estimate) {
    const step = (p - o) / 100;
    const distribution = [];
    for (let x = o; x <= p; x += step) {
        distribution.push({ x, y: triangularPdf(x, o, r, p) });
    }

    const points = [
        { x: o, y: 0 },
        { x: r, y: triangularPdf(r, o, r, p) },
        { x: p, y: 0 },
        { x: estimate, y: triangularPdf(estimate, o, r, p) },
    ];

    if (chart) {
        chart.destroy();
    }

    chart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [
                {
                    label: 'PDF',
                    data: distribution,
                    borderColor: '#000',
                    pointRadius: 0,
                    fill: false,
                    tension: 0.2,
                },
                {
                    type: 'scatter',
                    label: 'Points',
                    data: points,
                    backgroundColor: ['#009688', '#ff8f00', '#b71c1c', '#000'],
                    borderColor: ['#009688', '#ff8f00', '#b71c1c', '#000'],
                    borderWidth: 1,
                    pointRadius: 5,
                },
            ],
        },
        options: {
            scales: {
                x: {
                    type: 'linear',
                    title: {
                        display: true,
                        text: 'Оценка',
                    },
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Вероятность',
                    },
                },
            },
            plugins: {
                legend: { display: false },
            },
        },
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
    const estimate = Math.ceil((o + 4 * r + p) / 6);
    drawGraph(o, r, p, estimate);
    resultEl.textContent = 'Итоговая оценка: ' + estimate;
});
