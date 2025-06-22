import { DOMUtils, ErrorUtils, COLORS } from '../js/utils.js';

/**
 * Story Points Calculator
 */
class StoryPointsCalculator {
    constructor() {
        this.initializeElements();
        this.initializeEventListeners();
        this.updateSpValue();
    }

    /**
     * Initialize DOM elements
     */
    initializeElements() {
        this.spCountContainer = DOMUtils.getElement('#sp-count', 'Result container not found');
        this.spCountDescription = DOMUtils.getElement('#sp-description', 'Description container not found');
        this.taskPropertiesContainer = DOMUtils.getElement('#task-properties', 'Task properties container not found');
        
        if (!this.spCountContainer || !this.spCountDescription || !this.taskPropertiesContainer) {
            ErrorUtils.handleError(new Error('Required DOM elements not found'), 'StoryPointsCalculator.initializeElements');
        }
    }

    /**
     * Initialize event listeners
     */
    initializeEventListeners() {
        if (this.taskPropertiesContainer) {
            this.taskPropertiesContainer.addEventListener('click', ({ target }) => {
                if (target.type === 'radio') {
                    this.updateSpValue();
                }
            });
        }
    }

    /**
     * Story points matrix
     */
    static get SP_MATRIX() {
        return {
            'low': {
                'low': { 'low': 1, 'medium': 2, 'high': 5 },
                'medium': { 'low': 2, 'medium': 3, 'high': 5 },
                'high': { 'low': 3, 'medium': 5, 'high': 8 }
            },
            'medium': {
                'low': { 'low': 3, 'medium': 5, 'high': 8 },
                'medium': { 'low': 5, 'medium': 5, 'high': 8 },
                'high': { 'low': 5, 'medium': 8, 'high': 13 }
            },
            'high': {
                'low': { 'low': 8, 'medium': 8, 'high': 13 },
                'medium': { 'low': 8, 'medium': 8, 'high': 13 },
                'high': { 'low': 13, 'medium': 13, 'high': 21 }
            }
        };
    }

    /**
     * Get current task properties from form
     * @returns {Object} Task properties
     */
    getActualTaskProperties() {
        const complexityInput = document.querySelector('[name=complexity]:checked');
        const effortInput = document.querySelector('[name=effort]:checked');
        const uncertaintyInput = document.querySelector('[name=uncertainty]:checked');

        return {
            complexity: complexityInput?.value || 'low',
            effort: effortInput?.value || 'low',
            uncertainty: uncertaintyInput?.value || 'low'
        };
    }

    /**
     * Calculate story points based on properties
     * @param {Object} properties - Task properties
     * @returns {number} Story points
     */
    calculateSp(properties) {
        const { effort, complexity, uncertainty } = properties;
        try {
            return StoryPointsCalculator.SP_MATRIX[uncertainty][complexity][effort];
        } catch (error) {
            ErrorUtils.handleError(error, 'StoryPointsCalculator.calculateSp');
            return -1;
        }
    }

    /**
     * Update story points description
     * @param {number} sp - Story points value
     */
    updateSpDescription(sp) {
        if (!this.spCountDescription) return;

        let description = '';
        if (sp >= 5 && sp < 8) {
            description = 'Сложная задача! Попробуй декомпозировать ее!';
        } else if (sp >= 8 && sp < 13) {
            description = 'Сложная задача! Нужна декомпозиция!';
        } else if (sp >= 13) {
            description = 'Это точно задача, а не эпик? ©';
        }

        this.spCountDescription.innerText = description;
    }

    /**
     * Update story points color
     * @param {number} sp - Story points value
     */
    updateSpColor(sp) {
        if (!this.spCountContainer) return;

        let color = COLORS.SUCCESS;
        if (sp >= 5 && sp < 8) {
            color = COLORS.WARNING;
        } else if (sp >= 8) {
            color = COLORS.DANGER;
        }

        this.spCountContainer.style.color = color;
    }

    /**
     * Update story points value and UI
     */
    updateSpValue() {
        const taskProperties = this.getActualTaskProperties();
        const sp = this.calculateSp(taskProperties);
        
        if (!this.spCountContainer) return;

        if (sp < 0) {
            this.spCountContainer.innerText = 'Не удалось посчитать sp';
        } else {
            this.spCountContainer.innerText = `${sp} sp`;
        }

        this.updateSpDescription(sp);
        this.updateSpColor(sp);
    }
}

// Initialize calculator when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    try {
        new StoryPointsCalculator();
    } catch (error) {
        ErrorUtils.handleError(error, 'StoryPointsCalculator initialization');
    }
});
