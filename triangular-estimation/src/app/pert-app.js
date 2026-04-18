import { createPertResult } from '../core/pert.js';

export function createPertApp(view) {
    function update(values = view.readValues()) {
        view.render(createPertResult(values));
    }

    function init() {
        view.bind(update);
        update();
    }

    return {
        init,
        update
    };
}
