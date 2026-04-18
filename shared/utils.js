import { COLORS } from './core/colors.js';
import { isInRange, isValidNumber, validatePertEstimates } from './core/validation.js';
import { getRussianUnitText } from './core/pluralization.js';
import { addEventListener, getElement, getElements } from './browser/dom.js';
import { clearError, handleError, showError } from './browser/errors.js';

export { COLORS };

export class DOMUtils {
    static getElement(selector, fallback = null) {
        return getElement(selector, fallback);
    }

    static getElements(selector) {
        return getElements(selector);
    }

    static addEventListener(selector, event, handler) {
        addEventListener(selector, event, handler);
    }
}

export class ValidationUtils {
    static isValidNumber(value) {
        return isValidNumber(value);
    }

    static isInRange(value, min, max) {
        return isInRange(value, min, max);
    }

    static validatePERTEstimates(optimistic, realistic, pessimistic) {
        return validatePertEstimates(optimistic, realistic, pessimistic);
    }
}

export class PluralizationUtils {
    static getUnitText(number, unit) {
        return getRussianUnitText(number, unit);
    }
}

export class ErrorUtils {
    static showError(element, message) {
        showError(element, message);
    }

    static clearError(element) {
        clearError(element);
    }

    static handleError(error, context = '') {
        handleError(error, context);
    }
}
