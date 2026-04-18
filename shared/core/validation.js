export function isValidNumber(value) {
    return !Number.isNaN(value) && Number.isFinite(value);
}

export function isInRange(value, min, max) {
    return value >= min && value <= max;
}

export function validatePertEstimates(optimistic, realistic, pessimistic) {
    if (!isValidNumber(optimistic) || !isValidNumber(realistic) || !isValidNumber(pessimistic)) {
        return { valid: false, error: 'Все поля должны быть заполнены числами' };
    }

    if (optimistic > realistic || optimistic > pessimistic) {
        return { valid: false, error: 'Оптимистичная оценка не должна быть больше других оценок' };
    }

    if (realistic < optimistic || realistic > pessimistic) {
        return {
            valid: false,
            error: 'Реалистичная оценка должна быть не меньше оптимистичной и не больше пессимистичной'
        };
    }

    if (pessimistic < realistic || pessimistic < optimistic) {
        return { valid: false, error: 'Пессимистичная оценка не должна быть меньше остальных оценок' };
    }

    return { valid: true };
}
