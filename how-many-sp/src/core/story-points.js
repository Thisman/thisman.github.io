import { COLORS } from '../../../shared/core/colors.js';

export const SP_MATRIX = {
    low: {
        low: { low: 1, medium: 2, high: 5 },
        medium: { low: 2, medium: 3, high: 5 },
        high: { low: 3, medium: 5, high: 8 }
    },
    medium: {
        low: { low: 3, medium: 5, high: 8 },
        medium: { low: 5, medium: 5, high: 8 },
        high: { low: 5, medium: 8, high: 13 }
    },
    high: {
        low: { low: 8, medium: 8, high: 13 },
        medium: { low: 8, medium: 8, high: 13 },
        high: { low: 13, medium: 13, high: 21 }
    }
};

export function normalizeTaskProperties(properties = {}) {
    return {
        complexity: properties.complexity || 'low',
        effort: properties.effort || 'low',
        uncertainty: properties.uncertainty || 'low'
    };
}

export function calculateStoryPoints(properties) {
    const { complexity, effort, uncertainty } = normalizeTaskProperties(properties);
    return SP_MATRIX[uncertainty]?.[complexity]?.[effort] ?? -1;
}

export function describeStoryPoints(storyPoints) {
    if (storyPoints >= 13) {
        return 'Это точно задача, а не эпик?';
    }

    if (storyPoints >= 8) {
        return 'Сложная задача! Нужна декомпозиция!';
    }

    if (storyPoints >= 5) {
        return 'Сложная задача! Попробуй декомпозировать ее!';
    }

    return '';
}

export function getStoryPointsColor(storyPoints) {
    if (storyPoints >= 8) {
        return COLORS.DANGER;
    }

    if (storyPoints >= 5) {
        return COLORS.WARNING;
    }

    return COLORS.SUCCESS;
}
