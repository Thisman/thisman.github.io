import { getElement } from '../../../shared/browser/dom.js';

export function createStoryPointsView(root = document) {
    const resultEl = getElement('#sp-count', 'Result container not found', root);
    const descriptionEl = getElement('#sp-description', 'Description container not found', root);
    const controlsEl = getElement('#task-properties', 'Task properties container not found', root);

    function readProperties() {
        return {
            complexity: root.querySelector('[name=complexity]:checked')?.value || 'low',
            effort: root.querySelector('[name=effort]:checked')?.value || 'low',
            uncertainty: root.querySelector('[name=uncertainty]:checked')?.value || 'low'
        };
    }

    function render({ storyPoints, description, color }) {
        if (!resultEl) {
            return;
        }

        resultEl.innerText = storyPoints < 0 ? 'Не удалось посчитать sp' : `${storyPoints} sp`;
        resultEl.style.color = color;

        if (descriptionEl) {
            descriptionEl.innerText = description;
        }
    }

    function onChange(handler) {
        controlsEl?.addEventListener('click', ({ target }) => {
            if (target instanceof HTMLInputElement && target.type === 'radio') {
                handler(readProperties());
            }
        });
    }

    return {
        readProperties,
        render,
        onChange
    };
}
