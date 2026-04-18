import { getElement } from '../../../shared/browser/dom.js';

export function createTicTacToeView(root = document) {
    const refs = {
        screenSettings: getElement('#screenSettings', 'screenSettings missing', root),
        screenGame: getElement('#screenGame', 'screenGame missing', root),
        screenResults: getElement('#screenResults', 'screenResults missing', root),
        rowsInput: getElement('#rowsInput', 'rowsInput missing', root),
        colsInput: getElement('#colsInput', 'colsInput missing', root),
        winInput: getElement('#winInput', 'winInput missing', root),
        swapLimitInput: getElement('#swapLimitInput', 'swapLimitInput missing', root),
        rowsVal: getElement('#rowsVal', null, root),
        colsVal: getElement('#colsVal', null, root),
        winVal: getElement('#winVal', null, root),
        swapLimitVal: getElement('#swapLimitVal', null, root),
        rowsPlus: getElement('#rowsPlus', null, root),
        rowsMinus: getElement('#rowsMinus', null, root),
        colsPlus: getElement('#colsPlus', null, root),
        colsMinus: getElement('#colsMinus', null, root),
        winPlus: getElement('#winPlus', null, root),
        winMinus: getElement('#winMinus', null, root),
        swapLimitPlus: getElement('#swapLimitPlus', null, root),
        swapLimitMinus: getElement('#swapLimitMinus', null, root),
        modePvpBtn: getElement('#modePvp', null, root),
        modePvcBtn: getElement('#modePvc', null, root),
        startBtn: getElement('#startBtn', null, root),
        preset33: getElement('#preset33', null, root),
        preset55: getElement('#preset55', null, root),
        preset1010: getElement('#preset1010', null, root),
        preset1515: getElement('#preset1515', null, root),
        settingsToast: getElement('#settingsToast', null, root),
        boardEl: getElement('#board', 'board missing', root),
        turnLabel: getElement('#turnLabel', null, root),
        movesLabel: getElement('#movesLabel', null, root),
        goalLabel: getElement('#goalLabel', null, root),
        afterFullStatus: getElement('#afterFullStatus', null, root),
        afterFullLabel: getElement('#afterFullLabel', null, root),
        gameToast: getElement('#gameToast', null, root),
        drawBtn: getElement('#drawBtn', null, root),
        restartBtn: getElement('#restartBtn', null, root),
        resultTitle: getElement('#resultTitle', null, root),
        resultSubtitle: getElement('#resultSubtitle', null, root),
        winnerKV: getElement('#winnerKV', null, root),
        movesKV: getElement('#movesKV', null, root),
        swapsKV: getElement('#swapsKV', null, root),
        sizeKV: getElement('#sizeKV', null, root),
        winKV: getElement('#winKV', null, root),
        playAgainBtn: getElement('#playAgainBtn', null, root),
        backToSettingsBtn: getElement('#backToSettingsBtn', null, root),
        settingsHint: getElement('#settingsHint', null, root)
    };

    let cells = [];

    function showScreen(which) {
        refs.screenSettings?.classList.toggle('active', which === 'settings');
        refs.screenGame?.classList.toggle('active', which === 'game');
        refs.screenResults?.classList.toggle('active', which === 'results');
    }

    function showToast(target, type, text) {
        const element = target === 'settings' ? refs.settingsToast : refs.gameToast;
        if (!element) {
            return;
        }

        element.classList.remove('good', 'warn', 'bad');
        if (type) {
            element.classList.add(type);
        }
        element.textContent = text;
        element.style.display = 'block';
    }

    function hideToast(target) {
        const element = target === 'settings' ? refs.settingsToast : refs.gameToast;
        if (element) {
            element.style.display = 'none';
        }
    }

    function setMode(mode) {
        refs.modePvpBtn?.classList.toggle('active', mode === 'pvp');
        refs.modePvcBtn?.classList.toggle('active', mode === 'pvc');
    }

    function readSettings() {
        return {
            rows: refs.rowsInput?.value,
            cols: refs.colsInput?.value,
            winLength: refs.winInput?.value,
            swapLimit: refs.swapLimitInput?.value
        };
    }

    function syncSettings(settings, maxK) {
        refs.rowsInput.value = String(settings.rows);
        refs.colsInput.value = String(settings.cols);
        refs.winInput.value = String(settings.winLength);
        refs.swapLimitInput.value = String(settings.swapLimit);
        refs.rowsVal.textContent = String(settings.rows);
        refs.colsVal.textContent = String(settings.cols);
        refs.winVal.textContent = String(settings.winLength);
        refs.swapLimitVal.textContent = String(settings.swapLimit);

        refs.rowsPlus.disabled = settings.rows >= 15;
        refs.rowsMinus.disabled = settings.rows <= 3;
        refs.colsPlus.disabled = settings.cols >= 15;
        refs.colsMinus.disabled = settings.cols <= 3;
        refs.winPlus.disabled = settings.winLength >= maxK;
        refs.winMinus.disabled = settings.winLength <= 3;
        refs.swapLimitPlus.disabled = settings.swapLimit >= 99;
        refs.swapLimitMinus.disabled = settings.swapLimit <= 0;
    }

    function updateSettingsHint(text) {
        if (refs.settingsHint) {
            refs.settingsHint.textContent = text;
        }
    }

    function buildGrid(state, onCellActivate) {
        refs.boardEl.innerHTML = '';
        const size = state.C >= 20 || state.R >= 20 ? 34 : (state.C >= 14 || state.R >= 14 ? 38 : 42);
        refs.boardEl.style.gridTemplateColumns = `repeat(${state.C}, ${size}px)`;
        refs.boardEl.style.gridAutoRows = `${size}px`;
        cells = new Array(state.R * state.C);

        for (let row = 0; row < state.R; row += 1) {
            for (let col = 0; col < state.C; col += 1) {
                const element = document.createElement('div');
                element.className = 'cell empty';
                element.textContent = '·';
                element.setAttribute('role', 'button');
                element.setAttribute('tabindex', '0');
                element.dataset.r = String(row);
                element.dataset.c = String(col);
                element.addEventListener('click', () => onCellActivate(row, col));
                element.addEventListener('keydown', (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onCellActivate(row, col);
                    }
                });
                refs.boardEl.appendChild(element);
                cells[row * state.C + col] = element;
            }
        }
    }

    function renderBoard(state, selection = {}, winningCells = []) {
        const selectedKey = selection.selected
            ? `${selection.selected.r}:${selection.selected.c}`
            : null;
        const candidateKeys = new Set((selection.candidates || []).map((cell) => `${cell.r}:${cell.c}`));
        const winningKeys = new Set(winningCells.map((cell) => `${cell.r}:${cell.c}`));

        for (let row = 0; row < state.R; row += 1) {
            for (let col = 0; col < state.C; col += 1) {
                const element = cells[row * state.C + col];
                const value = state.board[row][col];
                element.classList.remove('empty', 'x', 'o', 'blockedSwap', 'selected', 'swapCandidate', 'win');

                if (!value) {
                    element.textContent = '·';
                    element.classList.add('empty');
                } else {
                    element.textContent = value;
                    element.classList.add(value === 'X' ? 'x' : 'o');
                }

                if (selection.isBlocked?.(row, col)) {
                    element.classList.add('blockedSwap');
                }
                if (selectedKey === `${row}:${col}`) {
                    element.classList.add('selected');
                }
                if (candidateKeys.has(`${row}:${col}`)) {
                    element.classList.add('swapCandidate');
                }
                if (winningKeys.has(`${row}:${col}`)) {
                    element.classList.add('win');
                }
            }
        }
    }

    function renderHud(state, remainingSwaps) {
        refs.turnLabel.textContent = state.current;
        refs.turnLabel.style.color = state.current === 'X' ? 'var(--ttt-mark-x)' : 'var(--ttt-mark-o)';
        refs.movesLabel.textContent = String(state.moves);
        refs.goalLabel.textContent = `${state.R}×${state.C}, N=${state.K}`;

        const full = Number.isFinite(remainingSwaps.x) && Number.isFinite(remainingSwaps.o);
        refs.afterFullStatus.style.display = full ? 'flex' : 'none';
        if (full) {
            refs.afterFullLabel.innerHTML = `<span style="color:var(--ttt-mark-x)">X</span>: ${remainingSwaps.x} · <span style="color:var(--ttt-mark-o)">O</span>: ${remainingSwaps.o}`;
        }
    }

    function renderResults({ winner, isDraw, reason, state }) {
        refs.resultTitle.textContent = isDraw ? 'Ничья' : `Победа: ${winner}`;
        refs.resultSubtitle.textContent = reason;
        refs.winnerKV.textContent = isDraw ? '—' : winner;
        refs.movesKV.textContent = String(state.moves);
        refs.swapsKV.textContent = String(state.swapsTotal);
        refs.sizeKV.textContent = `${state.R}×${state.C}`;
        refs.winKV.textContent = String(state.K);
    }

    return {
        refs,
        showScreen,
        showToast,
        hideToast,
        setMode,
        readSettings,
        syncSettings,
        updateSettingsHint,
        buildGrid,
        renderBoard,
        renderHud,
        renderResults
    };
}
