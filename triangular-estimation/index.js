const button = document.getElementById('calc');
const resultEl = document.getElementById('result');
const errorEl = document.getElementById('error-message');
const canvas = document.getElementById('chart');
const ctx = canvas.getContext('2d');
let chart;

const ARROW_COLOR = '#009688';

function clearGraphWithError() {
    if (chart) {
        chart.destroy();
        chart = null;
    }
    canvas.style.backgroundColor = '#ffdddd';
}

function resetGraphBackground() {
    canvas.style.backgroundColor = '';
}

function clearError() {
    errorEl.textContent = '';
}

function showError(message) {
    errorEl.textContent = message;
    clearGraphWithError();
}

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

    resetGraphBackground();

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
                    borderColor: 'rgba(0, 0, 0, 0.5)',
                    pointRadius: 0,
                    fill: false,
                    tension: 0.2,
                },
                {
                    type: 'scatter',
                    label: 'Points',
                    data: points,
                    backgroundColor: ['#000', '#000', '#000', ARROW_COLOR],
                    borderColor: ['#000', '#000', '#000', ARROW_COLOR],
                    borderWidth: 1,
                    pointRadius: [5, 5, 5, 7],
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

function getUnitText(number, unit) {
    const lastDigit = number % 10;
    const lastTwoDigits = number % 100;
    
    switch(unit) {
        case 'hours':
            if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return 'часов';
            if (lastDigit === 1) return 'час';
            if (lastDigit >= 2 && lastDigit <= 4) return 'часа';
            return 'часов';
            
        case 'days':
            if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return 'дней';
            if (lastDigit === 1) return 'день';
            if (lastDigit >= 2 && lastDigit <= 4) return 'дня';
            return 'дней';
            
        case 'weeks':
            if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return 'недель';
            if (lastDigit === 1) return 'неделя';
            if (lastDigit >= 2 && lastDigit <= 4) return 'недели';
            return 'недель';
            
        default:
            return '';
    }
}

function updateResult() {
    const o = parseFloat(document.getElementById('optimistic').value);
    const r = parseFloat(document.getElementById('realistic').value);
    const p = parseFloat(document.getElementById('pessimistic').value);
    const unitInput = document.querySelector('[name=unit]:checked');
    const unit = unitInput ? unitInput.value : 'days';
    
    // Если не все поля заполнены, показываем 0
    if (isNaN(o) || isNaN(r) || isNaN(p)) {
        const unitText = getUnitText(0, unit);
        resultEl.textContent = '0 ' + unitText;
        clearError();
        return;
    }
    
    // Проверяем валидность данных
    if (o > r || o > p) {
        showError('Оптимистичная оценка не должна быть больше других оценок');
        return;
    }
    if (r < o || r > p) {
        showError('Реалистичная оценка должна быть не меньше оптимистичной и не больше пессимистичной');
        return;
    }
    if (p < r || p < o) {
        showError('Пессимистичная оценка должна быть не меньше остальных оценок');
        return;
    }
    
    const estimate = Math.ceil((o + 4 * r + p) / 6);
    const unitText = getUnitText(estimate, unit);
    
    clearError();
    drawGraph(o, r, p, estimate);
    resultEl.textContent = estimate + ' ' + unitText;
}

button.addEventListener('click', updateResult);

// Обновляем результат при изменении единицы измерения
document.querySelectorAll('[name=unit]').forEach(radio => {
    radio.addEventListener('change', updateResult);
});

// Инициализация по умолчанию
updateResult();
