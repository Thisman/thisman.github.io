import { DOMUtils, ValidationUtils, PluralizationUtils, ErrorUtils, COLORS } from '../js/utils.js';

/**
 * PERT Estimation Calculator
 */
class PERTCalculator {
    constructor() {
        this.initializeElements();
        this.initializeEventListeners();
        this.chart = null;
        this.updateResult();
    }

    /**
     * Initialize DOM elements
     */
    initializeElements() {
        this.button = DOMUtils.getElement('#calc', 'Calculate button not found');
        this.resultEl = DOMUtils.getElement('#result', 'Result element not found');
        this.errorEl = DOMUtils.getElement('#error-message', 'Error element not found');
        this.canvas = DOMUtils.getElement('#chart', 'Chart canvas not found');
        
        if (this.canvas) {
            this.ctx = this.canvas.getContext('2d');
        }

        if (!this.button || !this.resultEl || !this.errorEl || !this.canvas) {
            ErrorUtils.handleError(new Error('Required DOM elements not found'), 'PERTCalculator.initializeElements');
        }
    }

    /**
     * Initialize event listeners
     */
    initializeEventListeners() {
        if (this.button) {
            this.button.addEventListener('click', () => this.updateResult());
        }

        // Update result when unit changes
        DOMUtils.getElements('[name=unit]').forEach(radio => {
            radio.addEventListener('change', () => this.updateResult());
        });
    }

    /**
     * Clear graph with error styling
     */
    clearGraphWithError() {
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
        if (this.canvas) {
            this.canvas.style.backgroundColor = COLORS.BACKGROUND_LIGHT;
        }
    }

    /**
     * Reset graph background
     */
    resetGraphBackground() {
        if (this.canvas) {
            this.canvas.style.backgroundColor = '';
        }
    }

    /**
     * Clear error message
     */
    clearError() {
        ErrorUtils.clearError(this.errorEl);
    }

    /**
     * Show error message
     * @param {string} message - Error message
     */
    showError(message) {
        ErrorUtils.showError(this.errorEl, message);
        this.clearGraphWithError();
    }

    /**
     * Calculate triangular PDF
     * @param {number} x - Point
     * @param {number} a - Minimum value
     * @param {number} c - Mode value
     * @param {number} b - Maximum value
     * @returns {number} PDF value
     */
    triangularPdf(x, a, c, b) {
        if (x < a || x > b) return 0;
        if (x === c) return 2 / (b - a);
        if (x < c) return (2 * (x - a)) / ((b - a) * (c - a));
        return (2 * (b - x)) / ((b - a) * (b - c));
    }

    /**
     * Draw graph with Chart.js
     * @param {number} o - Optimistic estimate
     * @param {number} r - Realistic estimate
     * @param {number} p - Pessimistic estimate
     * @param {number} estimate - Calculated estimate
     */
    drawGraph(o, r, p, estimate) {
        if (!this.ctx || typeof Chart === 'undefined') {
            ErrorUtils.handleError(new Error('Chart.js not available'), 'PERTCalculator.drawGraph');
            return;
        }

        const step = (p - o) / 100;
        const distribution = [];
        for (let x = o; x <= p; x += step) {
            distribution.push({ x, y: this.triangularPdf(x, o, r, p) });
        }

        const points = [
            { x: o, y: 0 },
            { x: r, y: this.triangularPdf(r, o, r, p) },
            { x: p, y: 0 },
            { x: estimate, y: this.triangularPdf(estimate, o, r, p) },
        ];

        this.resetGraphBackground();

        if (this.chart) {
            this.chart.destroy();
        }

        this.chart = new Chart(this.ctx, {
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
                        backgroundColor: ['#000', '#000', '#000', COLORS.SUCCESS],
                        borderColor: ['#000', '#000', '#000', COLORS.SUCCESS],
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

    /**
     * Get form values
     * @returns {Object} Form values
     */
    getFormValues() {
        const o = parseFloat(DOMUtils.getElement('#optimistic')?.value);
        const r = parseFloat(DOMUtils.getElement('#realistic')?.value);
        const p = parseFloat(DOMUtils.getElement('#pessimistic')?.value);
        const unitInput = document.querySelector('[name=unit]:checked');
        const unit = unitInput ? unitInput.value : 'days';

        return { o, r, p, unit };
    }

    /**
     * Update result and UI
     */
    updateResult() {
        const { o, r, p, unit } = this.getFormValues();
        
        // If not all fields are filled, show 0
        if (!ValidationUtils.isValidNumber(o) || !ValidationUtils.isValidNumber(r) || !ValidationUtils.isValidNumber(p)) {
            const unitText = PluralizationUtils.getUnitText(0, unit);
            if (this.resultEl) {
                this.resultEl.textContent = '0 ' + unitText;
            }
            this.clearError();
            return;
        }
        
        // Validate PERT estimates
        const validation = ValidationUtils.validatePERTEstimates(o, r, p);
        if (!validation.valid) {
            this.showError(validation.error);
            return;
        }
        
        const estimate = Math.ceil((o + 4 * r + p) / 6);
        const unitText = PluralizationUtils.getUnitText(estimate, unit);
        
        this.clearError();
        this.drawGraph(o, r, p, estimate);
        if (this.resultEl) {
            this.resultEl.textContent = estimate + ' ' + unitText;
        }
    }
}

// Initialize calculator when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    try {
        new PERTCalculator();
    } catch (error) {
        ErrorUtils.handleError(error, 'PERTCalculator initialization');
    }
});
