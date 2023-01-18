const spCountContainer = document.getElementById('sp-count');
const spCountDescription = document.getElementById('sp-description');
const taskPropertiesContainer = document.getElementById('task-properties');

let taskProperties = null;

const spMatrix = {
    'low': {
        'low': {
            'low': 1,
            'medium': 2,
            'high': 5,
        },
        'medium': {
            'low': 2,
            'medium': 3,
            'high': 5,
        },
        'high': {
            'low': 3,
            'medium': 5,
            'high': 8,
        },
    },
    'medium': {
        'low': {
            'low': 3,
            'medium': 5,
            'high': 8,
        },
        'medium': {
            'low': 5,
            'medium': 5,
            'high': 8,
        },
        'high': {
            'low': 5,
            'medium': 8,
            'high': 13,
        },
    },
    'high': {
        'low': {
            'low': 8,
            'medium': 8,
            'high': 13,
        },
        'medium': {
            'low': 8,
            'medium': 8,
            'high': 13,
        },
        'high': {
            'low': 13,
            'medium': 13,
            'high': 20,
        },
    },
}

const getActualTaskPropertes = () => {
    const complexityInput = document.querySelector('[name=complexity]:checked');
    const effortInput = document.querySelector('[name=effort]:checked');
    const uncertaintyInput = document.querySelector('[name=uncertainty]:checked');

    return {
        complexity: complexityInput.value,
        effort: effortInput.value,
        uncertainty: uncertaintyInput.value,
    }
}

const calculateSp = (properties) => {
    const { effort, complexity, uncertainty } = properties;
    try {
        return spMatrix[uncertainty][complexity][effort];
    } catch {
        return -1
    }
}

const updateSpDescription = (sp) => {
    if (sp < 5) {
        spCountDescription.innerText = ''
    }

    if (sp >= 5 && sp < 8) {
        spCountDescription.innerText = 'Сложная задача! Попробуй декомпозировать ее!'
    }
    
    if (sp >= 8 && sp < 13) {
        spCountDescription.innerText = 'Сложная задача! Нужна декомпозиция!'
    }

    if (sp >= 13) {
        spCountDescription.innerText = 'Это точно задача, а не эпик? ©'
    }
}

const updateSpColor = (sp) => {
    if (sp < 5) {
        spCountContainer.style.color = '#009688';
    }

    if (sp >= 5 && sp < 8) {
        spCountContainer.style.color = '#ff8f00';
    }

    if (sp >= 8) {
        spCountContainer.style.color = '#b71c1c';
    }
}

const updateSpValue = () => {
    const taskProperties = getActualTaskPropertes();
    const sp = calculateSp(taskProperties);
    if (sp < 0) {
        spCountContainer.innerText = 'Не удалось посчитать sp';
    } else {
        spCountContainer.innerText = `${calculateSp(taskProperties)} sp`;
    }

    updateSpDescription(sp);
    updateSpColor(sp);
}

taskPropertiesContainer.addEventListener('click', ({ target }) => {
    if (target.type === 'radio') {
        updateSpValue();
    }
});

updateSpValue();
