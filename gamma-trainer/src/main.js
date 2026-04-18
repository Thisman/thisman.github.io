import { handleError } from '../../shared/browser/errors.js';
import { createGammaTrainerApp } from './app/gamma-trainer-app.js';
import { createGammaTrainerView } from './ui/gamma-trainer-view.js';

function init() {
    const view = createGammaTrainerView(document);
    createGammaTrainerApp(view).init();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        try {
            init();
        } catch (error) {
            handleError(error, 'gamma-trainer');
        }
    }, { once: true });
} else {
    try {
        init();
    } catch (error) {
        handleError(error, 'gamma-trainer');
    }
}
