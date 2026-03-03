import { DOMUtils, ValidationUtils, PluralizationUtils, ErrorUtils } from '../shared/utils.js';

/**
 * PERT Estimation Calculator
 */
class PERTCalculator {
    constructor() {
        this.initializeElements();
        this.initializeEventListeners();
        this.updateResult();
    }

    initializeElements() {
        this.button = DOMUtils.getElement('#calc', 'Calculate button not found');
        this.resultEl = DOMUtils.getElement('#result', 'Result element not found');
        this.errorEl = DOMUtils.getElement('#error-message', 'Error element not found');
    }

    initializeEventListeners() {
        if (this.button) {
            this.button.addEventListener('click', () => this.updateResult());
        }

        DOMUtils.getElements('[name=unit]').forEach(radio => {
            radio.addEventListener('change', () => this.updateResult());
        });
    }

    clearError() {
        ErrorUtils.clearError(this.errorEl);
    }

    showError(message) {
        ErrorUtils.showError(this.errorEl, message);
    }

    getFormValues() {
        const o = parseFloat(DOMUtils.getElement('#optimistic')?.value);
        const r = parseFloat(DOMUtils.getElement('#realistic')?.value);
        const p = parseFloat(DOMUtils.getElement('#pessimistic')?.value);
        const unitInput = document.querySelector('[name=unit]:checked');
        const unit = unitInput ? unitInput.value : 'days';

        return { o, r, p, unit };
    }

    updateResult() {
        const { o, r, p, unit } = this.getFormValues();

        if (!ValidationUtils.isValidNumber(o) || !ValidationUtils.isValidNumber(r) || !ValidationUtils.isValidNumber(p)) {
            const unitText = PluralizationUtils.getUnitText(0, unit);
            if (this.resultEl) {
                this.resultEl.textContent = '0 ' + unitText;
            }
            this.clearError();
            return;
        }

        const validation = ValidationUtils.validatePERTEstimates(o, r, p);
        if (!validation.valid) {
            this.showError(validation.error);
            return;
        }

        const estimate = Math.ceil((o + 4 * r + p) / 6);
        const unitText = PluralizationUtils.getUnitText(estimate, unit);

        this.clearError();
        if (this.resultEl) {
            this.resultEl.textContent = estimate + ' ' + unitText;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    try {
        new PERTCalculator();
    } catch (error) {
        ErrorUtils.handleError(error, 'PERTCalculator initialization');
    }
});
