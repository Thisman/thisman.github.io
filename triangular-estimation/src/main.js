import { handleError } from '../../shared/browser/errors.js';
import { createPertApp } from './app/pert-app.js';
import { createPertView } from './ui/pert-view.js';

function init() {
    const view = createPertView(document);
    createPertApp(view).init();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        try {
            init();
        } catch (error) {
            handleError(error, 'triangular-estimation');
        }
    }, { once: true });
} else {
    try {
        init();
    } catch (error) {
        handleError(error, 'triangular-estimation');
    }
}
