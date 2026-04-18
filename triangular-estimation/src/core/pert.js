import { getRussianUnitText } from '../../../shared/core/pluralization.js';
import { isValidNumber, validatePertEstimates } from '../../../shared/core/validation.js';

export function normalizePertForm(values = {}) {
    return {
        optimistic: Number.parseFloat(values.optimistic),
        realistic: Number.parseFloat(values.realistic),
        pessimistic: Number.parseFloat(values.pessimistic),
        unit: values.unit || 'days'
    };
}

export function calculatePertEstimate({ optimistic, realistic, pessimistic }) {
    return Math.ceil((optimistic + 4 * realistic + pessimistic) / 6);
}

export function createPertResult(values) {
    const normalized = normalizePertForm(values);
    const { optimistic, realistic, pessimistic, unit } = normalized;

    if (!isValidNumber(optimistic) || !isValidNumber(realistic) || !isValidNumber(pessimistic)) {
        return {
            valid: true,
            estimate: 0,
            unitText: getRussianUnitText(0, unit),
            error: ''
        };
    }

    const validation = validatePertEstimates(optimistic, realistic, pessimistic);
    if (!validation.valid) {
        return {
            valid: false,
            estimate: null,
            unitText: '',
            error: validation.error
        };
    }

    const estimate = calculatePertEstimate({ optimistic, realistic, pessimistic });
    return {
        valid: true,
        estimate,
        unitText: getRussianUnitText(estimate, unit),
        error: ''
    };
}
