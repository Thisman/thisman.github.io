import { handleError } from '../../shared/browser/errors.js';
import { createTicTacToeController } from './app/controller.js';

function init() {
    createTicTacToeController(document).init();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        try {
            init();
        } catch (error) {
            handleError(error, 'tic-tac-toe');
        }
    }, { once: true });
} else {
    try {
        init();
    } catch (error) {
        handleError(error, 'tic-tac-toe');
    }
}
