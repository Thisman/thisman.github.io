import { createScalePresentation } from '../core/music-theory.js';

export function createGammaTrainerApp(view) {
    function update(selection = view.readSelection()) {
        view.render(createScalePresentation(selection.tonicIndex, selection.modeId));
    }

    function init() {
        view.mountChipBars();
        view.bind(update);
        update();
    }

    return {
        init,
        update
    };
}
