import { getElement } from '../../../shared/browser/dom.js';
import { MODES, NOTE_NAMES } from '../core/music-theory.js';

function makeChip(group, id, value, label, checked = false) {
    const wrap = document.createElement('div');
    wrap.className = 'chip-radio';

    const input = document.createElement('input');
    input.type = 'radio';
    input.name = group;
    input.id = id;
    input.value = value;
    input.checked = checked;

    const labelEl = document.createElement('label');
    labelEl.className = 'chip';
    labelEl.setAttribute('for', id);
    labelEl.textContent = label;

    wrap.append(input, labelEl);
    return wrap;
}

export function createGammaTrainerView(root = document) {
    const tonicBarEl = getElement('#tonicBar', 'Tonic bar not found', root);
    const modeBarEl = getElement('#modeBar', 'Mode bar not found', root);
    const notesEl = getElement('#notes', 'Notes container not found', root);

    function mountChipBars() {
        if (tonicBarEl?.childElementCount || modeBarEl?.childElementCount) {
            return;
        }

        NOTE_NAMES.forEach((note, index) => {
            tonicBarEl?.appendChild(makeChip('tonic', `tonic-${index}`, String(index), note, index === 0));
        });

        MODES.forEach((mode, index) => {
            modeBarEl?.appendChild(makeChip('mode', `mode-${mode.id}`, mode.id, mode.name, index === 0));
        });
    }

    function readSelection() {
        return {
            tonicIndex: Number.parseInt(root.querySelector('input[name="tonic"]:checked')?.value || '0', 10),
            modeId: root.querySelector('input[name="mode"]:checked')?.value || MODES[0].id
        };
    }

    function render(cells) {
        if (!notesEl) {
            return;
        }

        notesEl.innerHTML = '';
        cells.forEach((cellModel) => {
            const cellEl = document.createElement('div');
            cellEl.className = 'cell';

            const degreeEl = document.createElement('div');
            degreeEl.className = `degree ${
                cellModel.quality === 'major'
                    ? 'deg-major'
                    : cellModel.quality === 'minor'
                        ? 'deg-minor'
                        : cellModel.quality === 'dim'
                            ? 'deg-dim'
                            : cellModel.quality === 'aug'
                                ? 'deg-aug'
                                : ''
            }`.trim();
            if (cellModel.isCharacteristic) {
                degreeEl.classList.add('char');
            }
            degreeEl.textContent = cellModel.degree;

            const noteEl = document.createElement('div');
            noteEl.className = 'note';
            if (cellModel.isParentMajor) {
                noteEl.classList.add('is-parent-major');
            }
            if (cellModel.isParentMinor) {
                noteEl.classList.add('is-parent-minor');
            }
            noteEl.textContent = cellModel.note;

            cellEl.append(degreeEl, noteEl);
            notesEl.appendChild(cellEl);
        });
    }

    function bind(handler) {
        tonicBarEl?.addEventListener('change', () => handler(readSelection()));
        modeBarEl?.addEventListener('change', () => handler(readSelection()));
    }

    return {
        mountChipBars,
        readSelection,
        render,
        bind
    };
}
