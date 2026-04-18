import { handleError } from '../../shared/browser/errors.js';
import { createStoryPointsApp } from './app/story-points-app.js';
import { createStoryPointsView } from './ui/story-points-view.js';

function init() {
    const view = createStoryPointsView(document);
    const app = createStoryPointsApp(view);
    app.init();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        try {
            init();
        } catch (error) {
            handleError(error, 'how-many-sp');
        }
    }, { once: true });
} else {
    try {
        init();
    } catch (error) {
        handleError(error, 'how-many-sp');
    }
}
