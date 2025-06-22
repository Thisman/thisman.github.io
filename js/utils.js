/**
 * Common utilities and constants for the project
 */

// Color constants
export const COLORS = {
    PRIMARY: '#2196F3',
    PRIMARY_DARK: '#1976D2',
    PRIMARY_DARKER: '#0D47A1',
    SUCCESS: '#009688',
    WARNING: '#ff8f00',
    ERROR: '#f44336',
    DANGER: '#b71c1c',
    TEXT_PRIMARY: '#333',
    TEXT_SECONDARY: '#666',
    TEXT_MUTED: '#ddd',
    BORDER: '#ddd',
    BACKGROUND_LIGHT: '#ffdddd'
};

// DOM utilities
export class DOMUtils {
    /**
     * Safely get DOM element with error handling
     * @param {string} selector - CSS selector
     * @param {string} fallback - Fallback text if element not found
     * @returns {HTMLElement|null}
     */
    static getElement(selector, fallback = null) {
        const element = document.querySelector(selector);
        if (!element && fallback) {
            console.warn(`Element not found: ${selector}. ${fallback}`);
        }
        return element;
    }

    /**
     * Safely get multiple DOM elements
     * @param {string} selector - CSS selector
     * @returns {NodeList}
     */
    static getElements(selector) {
        return document.querySelectorAll(selector);
    }

    /**
     * Add event listener with error handling
     * @param {string} selector - CSS selector
     * @param {string} event - Event type
     * @param {Function} handler - Event handler
     */
    static addEventListener(selector, event, handler) {
        const element = this.getElement(selector);
        if (element) {
            element.addEventListener(event, handler);
        }
    }
}

// Validation utilities
export class ValidationUtils {
    /**
     * Check if value is a valid number
     * @param {*} value - Value to check
     * @returns {boolean}
     */
    static isValidNumber(value) {
        return !isNaN(value) && isFinite(value);
    }

    /**
     * Check if value is in range
     * @param {number} value - Value to check
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @returns {boolean}
     */
    static isInRange(value, min, max) {
        return value >= min && value <= max;
    }

    /**
     * Validate PERT estimates
     * @param {number} optimistic - Optimistic estimate
     * @param {number} realistic - Realistic estimate
     * @param {number} pessimistic - Pessimistic estimate
     * @returns {Object} Validation result
     */
    static validatePERTEstimates(optimistic, realistic, pessimistic) {
        if (!this.isValidNumber(optimistic) || !this.isValidNumber(realistic) || !this.isValidNumber(pessimistic)) {
            return { valid: false, error: 'Все поля должны быть заполнены числами' };
        }

        if (optimistic > realistic || optimistic > pessimistic) {
            return { valid: false, error: 'Оптимистичная оценка не должна быть больше других оценок' };
        }

        if (realistic < optimistic || realistic > pessimistic) {
            return { valid: false, error: 'Реалистичная оценка должна быть не меньше оптимистичной и не больше пессимистичной' };
        }

        if (pessimistic < realistic || pessimistic < optimistic) {
            return { valid: false, error: 'Пессимистичная оценка должна быть не меньше остальных оценок' };
        }

        return { valid: true };
    }
}

// Russian pluralization utility
export class PluralizationUtils {
    /**
     * Get correct Russian plural form
     * @param {number} number - Number to pluralize
     * @param {string} unit - Unit type (hours, days, weeks)
     * @returns {string} Pluralized unit
     */
    static getUnitText(number, unit) {
        const lastDigit = number % 10;
        const lastTwoDigits = number % 100;
        
        const units = {
            hours: {
                one: 'час',
                few: 'часа',
                many: 'часов'
            },
            days: {
                one: 'день',
                few: 'дня',
                many: 'дней'
            },
            weeks: {
                one: 'неделя',
                few: 'недели',
                many: 'недель'
            }
        };

        const unitForms = units[unit];
        if (!unitForms) return '';

        if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
            return unitForms.many;
        }

        if (lastDigit === 1) {
            return unitForms.one;
        }

        if (lastDigit >= 2 && lastDigit <= 4) {
            return unitForms.few;
        }

        return unitForms.many;
    }
}

// Performance utilities
export class PerformanceUtils {
    /**
     * Debounce function calls
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in milliseconds
     * @returns {Function} Debounced function
     */
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Throttle function calls
     * @param {Function} func - Function to throttle
     * @param {number} limit - Time limit in milliseconds
     * @returns {Function} Throttled function
     */
    static throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
}

// Error handling utilities
export class ErrorUtils {
    /**
     * Show error message
     * @param {HTMLElement} element - Error container element
     * @param {string} message - Error message
     */
    static showError(element, message) {
        if (element) {
            element.textContent = message;
            element.style.display = 'block';
        }
    }

    /**
     * Clear error message
     * @param {HTMLElement} element - Error container element
     */
    static clearError(element) {
        if (element) {
            element.textContent = '';
            element.style.display = 'none';
        }
    }

    /**
     * Handle and log errors
     * @param {Error} error - Error object
     * @param {string} context - Error context
     */
    static handleError(error, context = '') {
        console.error(`Error in ${context}:`, error);
        // Could add error reporting service here
    }
} 