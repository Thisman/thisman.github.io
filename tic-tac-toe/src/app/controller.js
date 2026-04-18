import { chooseComputerMove } from '../core/ai.js';
import {
    clampInt,
    createBoardState,
    evalSwapOutcome,
    findWinLineFrom,
    inBounds,
    isAdjacent,
    isBlockedSwapCell,
    isBoardFull,
    listLegalSwaps,
    other,
    remainingSwapsAfterFull
} from '../core/board.js';
import { createTicTacToeView } from '../ui/dom-view.js';

const RESULT_DELAY_MS = 3000;

export function createTicTacToeController(root = document) {
    const view = createTicTacToeView(root);
    let state = createBoardState();
    let selectedSwapCell = null;
    let winningCells = [];
    let endGameTimer = null;

    function cancelPendingEndGame() {
        if (endGameTimer) {
            clearTimeout(endGameTimer);
            endGameTimer = null;
        }
    }

    function getSelectionCandidates() {
        if (!selectedSwapCell) {
            return [];
        }
        return listLegalSwaps(state)
            .filter((swap) => swap.a.r === selectedSwapCell.r && swap.a.c === selectedSwapCell.c)
            .map((swap) => swap.b);
    }

    function render() {
        view.renderBoard(state, {
            selected: selectedSwapCell,
            candidates: getSelectionCandidates(),
            isBlocked: (row, col) => isBlockedSwapCell(state, row, col)
        }, winningCells);
        view.renderHud(state, {
            x: remainingSwapsAfterFull(state, 'X'),
            o: remainingSwapsAfterFull(state, 'O')
        });
    }

    function setMode(mode) {
        state.gameMode = mode;
        view.setMode(mode);
    }

    function syncSettingsHint() {
        const current = view.readSettings();
        const rows = clampInt(current.rows, 3, 15);
        const cols = clampInt(current.cols, 3, 15);
        const maxK = Math.max(rows, cols);
        const winLength = clampInt(current.winLength, 3, maxK);
        const swapLimit = clampInt(current.swapLimit, 0, 99);

        view.syncSettings({ rows, cols, winLength, swapLimit }, maxK);
        view.updateSettingsHint(`Ограничение: N должно быть от 3 до ${maxK} для поля ${rows}×${cols}. Диагонали учитываются.`);
        return { rows, cols, winLength, maxK, swapLimit };
    }

    function clearSelection() {
        selectedSwapCell = null;
    }

    function endGame({ winner, isDraw, reason, line = [] }) {
        state.gameOver = true;
        clearSelection();
        winningCells = line;
        render();
        view.renderResults({ winner, isDraw, reason, state });
        endGameTimer = setTimeout(() => {
            endGameTimer = null;
            view.showScreen('results');
        }, RESULT_DELAY_MS);
    }

    function maybeAutoPassOrDrawAfterFull() {
        if (!isBoardFull(state)) {
            return false;
        }

        const xLeft = remainingSwapsAfterFull(state, 'X');
        const oLeft = remainingSwapsAfterFull(state, 'O');
        if (xLeft === 0 && oLeft === 0) {
            endGame({
                winner: null,
                isDraw: true,
                reason: 'Доска заполнена, и лимит swap после заполнения исчерпан у обоих игроков.'
            });
            return true;
        }

        if (remainingSwapsAfterFull(state, state.current) === 0) {
            const previous = state.current;
            state.current = other(state.current);
            clearSelection();
            view.showToast('game', 'warn', `У игрока ${previous} закончились свапы. Ход переходит игроку ${state.current}.`);
            render();
        }

        return false;
    }

    function afterMoveCheckAndAdvance(affectedPositions, mover) {
        const opponent = other(mover);

        for (const cell of affectedPositions) {
            if (state.board[cell.r][cell.c] === mover && findWinLineFrom(state, cell.r, cell.c, mover)) {
                endGame({
                    winner: mover,
                    isDraw: false,
                    reason: `Игрок ${mover} собрал линию длины ${state.K}.`,
                    line: findWinLineFrom(state, cell.r, cell.c, mover) || []
                });
                return;
            }
        }

        for (const cell of affectedPositions) {
            if (state.board[cell.r][cell.c] === opponent && findWinLineFrom(state, cell.r, cell.c, opponent)) {
                endGame({
                    winner: opponent,
                    isDraw: false,
                    reason: `Swap открыл победу игроку ${opponent}.`,
                    line: findWinLineFrom(state, cell.r, cell.c, opponent) || []
                });
                return;
            }
        }

        state.current = opponent;
        render();

        if (!maybeAutoPassOrDrawAfterFull() && state.gameMode === 'pvc' && state.current === state.CPU) {
            queueComputerTurn();
        }
    }

    function doPlace(row, col) {
        if (isBoardFull(state)) {
            view.showToast('game', 'warn', 'Доска заполнена: после заполнения доступен только swap.');
            return;
        }
        if (state.board[row][col]) {
            view.showToast('game', 'warn', 'Эта клетка уже занята.');
            return;
        }

        state.board[row][col] = state.current;
        state.moves += 1;
        clearSelection();
        render();
        afterMoveCheckAndAdvance([{ r: row, c: col }], state.current);
    }

    function doSwap(left, right) {
        if (isBoardFull(state) && remainingSwapsAfterFull(state, state.current) === 0) {
            view.showToast('game', 'warn', `У игрока ${state.current} закончились свапы после заполнения доски.`);
            return;
        }
        if (isBlockedSwapCell(state, left.r, left.c) || isBlockedSwapCell(state, right.r, right.c)) {
            view.showToast('game', 'warn', 'Нельзя swapать клетки, которые участвовали в swap на прошлом ходу.');
            return;
        }

        const leftValue = state.board[left.r][left.c];
        const rightValue = state.board[right.r][right.c];
        if (!leftValue || !rightValue) {
            view.showToast('game', 'warn', 'Swap возможен только между двумя занятыми клетками.');
            return;
        }
        if (leftValue === rightValue) {
            view.showToast('game', 'warn', 'Swap возможен только между разными метками.');
            return;
        }
        if (!isAdjacent(left, right)) {
            view.showToast('game', 'warn', 'Swap возможен только между соседними клетками.');
            return;
        }

        state.board[left.r][left.c] = rightValue;
        state.board[right.r][right.c] = leftValue;
        state.moves += 1;
        state.swapsTotal += 1;
        if (isBoardFull(state)) {
            if (state.current === 'X') state.swapsAfterFullX += 1;
            else state.swapsAfterFullO += 1;
        }
        state.blockedSwapCells = [
            left.r * state.C + left.c,
            right.r * state.C + right.c
        ];
        state.blockedMoveNumber = state.moves + 1;
        clearSelection();
        render();
        afterMoveCheckAndAdvance([left, right], state.current);
    }

    function queueComputerTurn() {
        if (state.computerBusy || state.gameOver) {
            return;
        }

        state.computerBusy = true;
        view.showToast('game', '', 'Ход компьютера…');
        setTimeout(() => {
            state.computerBusy = false;
            if (state.gameOver || state.gameMode !== 'pvc' || state.current !== state.CPU) {
                return;
            }

            if (isBoardFull(state) && remainingSwapsAfterFull(state, state.CPU) === 0) {
                maybeAutoPassOrDrawAfterFull();
                return;
            }

            const move = chooseComputerMove(state, { cpu: state.CPU, human: state.HUMAN });
            if (!move) {
                return;
            }

            if (move.type === 'place') {
                doPlace(move.r, move.c);
            } else {
                doSwap(move.a, move.b);
            }
        }, 220);
    }

    function onCellActivate(row, col) {
        if (state.gameOver || (state.gameMode === 'pvc' && (state.computerBusy || state.current === state.CPU))) {
            return;
        }
        if (!inBounds(state, row, col)) {
            return;
        }

        const value = state.board[row][col];
        if (!selectedSwapCell && !value) {
            doPlace(row, col);
            return;
        }

        if (!selectedSwapCell && value) {
            if (isBoardFull(state) && remainingSwapsAfterFull(state, state.current) === 0) {
                view.showToast('game', 'warn', `У игрока ${state.current} закончились свапы после заполнения доски.`);
                maybeAutoPassOrDrawAfterFull();
                return;
            }
            if (isBlockedSwapCell(state, row, col)) {
                view.showToast('game', 'warn', 'Эта клетка заблокирована на один ход после предыдущего swap.');
                return;
            }
            selectedSwapCell = { r: row, c: col };
            view.showToast('game', '', 'Swap: теперь выберите соседнюю клетку с другой меткой.');
            render();
            return;
        }

        const second = { r: row, c: col };
        if (selectedSwapCell.r === second.r && selectedSwapCell.c === second.c) {
            clearSelection();
            view.showToast('game', '', 'Swap: выбор сброшен.');
            render();
            return;
        }
        if (!isAdjacent(selectedSwapCell, second)) {
            view.showToast('game', 'warn', 'Swap: вторая клетка должна быть соседней.');
            return;
        }
        if (!state.board[second.r][second.c]) {
            view.showToast('game', 'warn', 'Swap: вторая клетка должна быть занята.');
            return;
        }
        if (state.board[selectedSwapCell.r][selectedSwapCell.c] === state.board[second.r][second.c]) {
            view.showToast('game', 'warn', 'Swap: клетки должны содержать разные метки.');
            return;
        }
        doSwap(selectedSwapCell, second);
    }

    function startGame() {
        cancelPendingEndGame();
        view.hideToast('settings');
        view.hideToast('game');
        winningCells = [];
        clearSelection();

        const { rows, cols, winLength, maxK, swapLimit } = syncSettingsHint();
        if (winLength < 3 || winLength > maxK) {
            view.showToast('settings', 'bad', `Некорректное N. Для поля ${rows}×${cols} допустимо N от 3 до ${maxK}.`);
            return;
        }

        state = createBoardState({
            rows,
            cols,
            winLength,
            swapLimit,
            gameMode: state.gameMode
        });

        view.buildGrid(state, onCellActivate);
        render();
        view.showScreen('game');
    }

    function applyPreset(rows, cols, winLength, swapLimit = 10) {
        view.syncSettings({ rows, cols, winLength, swapLimit }, Math.max(rows, cols));
        syncSettingsHint();
    }

    function bind() {
        view.setMode(state.gameMode);
        syncSettingsHint();

        const bump = (input, delta) => {
            input.value = String(Number(input.value || 0) + delta);
            syncSettingsHint();
        };

        view.refs.rowsPlus?.addEventListener('click', () => bump(view.refs.rowsInput, 1));
        view.refs.rowsMinus?.addEventListener('click', () => bump(view.refs.rowsInput, -1));
        view.refs.colsPlus?.addEventListener('click', () => bump(view.refs.colsInput, 1));
        view.refs.colsMinus?.addEventListener('click', () => bump(view.refs.colsInput, -1));
        view.refs.winPlus?.addEventListener('click', () => bump(view.refs.winInput, 1));
        view.refs.winMinus?.addEventListener('click', () => bump(view.refs.winInput, -1));
        view.refs.swapLimitPlus?.addEventListener('click', () => bump(view.refs.swapLimitInput, 1));
        view.refs.swapLimitMinus?.addEventListener('click', () => bump(view.refs.swapLimitInput, -1));

        view.refs.modePvpBtn?.addEventListener('click', () => setMode('pvp'));
        view.refs.modePvcBtn?.addEventListener('click', () => setMode('pvc'));
        view.refs.startBtn?.addEventListener('click', startGame);
        view.refs.preset33?.addEventListener('click', () => applyPreset(3, 3, 3));
        view.refs.preset55?.addEventListener('click', () => applyPreset(5, 5, 4));
        view.refs.preset1010?.addEventListener('click', () => applyPreset(10, 10, 5));
        view.refs.preset1515?.addEventListener('click', () => applyPreset(15, 15, 5));
        view.refs.drawBtn?.addEventListener('click', () => {
            if (!state.gameOver) {
                endGame({ winner: null, isDraw: true, reason: 'Игроки согласились на ничью.' });
            }
        });
        view.refs.restartBtn?.addEventListener('click', () => {
            cancelPendingEndGame();
            state.gameOver = true;
            clearSelection();
            view.showScreen('settings');
            syncSettingsHint();
        });
        view.refs.playAgainBtn?.addEventListener('click', () => {
            view.syncSettings({
                rows: state.R,
                cols: state.C,
                winLength: state.K,
                swapLimit: state.swapLimitAfterFull
            }, Math.max(state.R, state.C));
            startGame();
        });
        view.refs.backToSettingsBtn?.addEventListener('click', () => {
            cancelPendingEndGame();
            clearSelection();
            view.syncSettings({
                rows: state.R,
                cols: state.C,
                winLength: state.K,
                swapLimit: state.swapLimitAfterFull
            }, Math.max(state.R, state.C));
            view.showScreen('settings');
        });
    }

    function init() {
        bind();
    }

    return {
        init
    };
}
