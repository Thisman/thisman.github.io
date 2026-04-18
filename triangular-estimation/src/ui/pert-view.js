import { getElement, getElements } from '../../../shared/browser/dom.js';

export function createPertView(root = document) {
    const buttonEl = getElement('#calc', 'Calculate button not found', root);
    const resultEl = getElement('#result', 'Result element not found', root);
    const errorEl = getElement('#error-message', 'Error element not found', root);

    function readValues() {
        return {
            optimistic: getElement('#optimistic', null, root)?.value,
            realistic: getElement('#realistic', null, root)?.value,
            pessimistic: getElement('#pessimistic', null, root)?.value,
            unit: root.querySelector('[name=unit]:checked')?.value || 'days'
        };
    }

    function render(result) {
        if (resultEl && result.valid) {
            resultEl.textContent = `${result.estimate} ${result.unitText}`;
        }

        if (errorEl) {
            errorEl.textContent = result.error;
            errorEl.style.display = result.error ? 'block' : 'none';
        }
    }

    function bind(handler) {
        buttonEl?.addEventListener('click', () => handler(readValues()));
        getElements('[name=unit]', root).forEach((radio) => {
            radio.addEventListener('change', () => handler(readValues()));
        });
    }

    return {
        readValues,
        render,
        bind
    };
}
