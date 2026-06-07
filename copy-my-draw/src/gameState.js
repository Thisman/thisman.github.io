export const GAME_PHASES = Object.freeze({
  HOME: "home",
  READY: "ready",
  MEMORIZE: "memorize",
  DRAW: "draw",
  RESULT: "result"
});

const VALID_TRANSITIONS = Object.freeze({
  [GAME_PHASES.HOME]: new Set([GAME_PHASES.READY]),
  [GAME_PHASES.READY]: new Set([GAME_PHASES.MEMORIZE, GAME_PHASES.HOME]),
  [GAME_PHASES.MEMORIZE]: new Set([GAME_PHASES.DRAW, GAME_PHASES.READY]),
  [GAME_PHASES.DRAW]: new Set([GAME_PHASES.RESULT, GAME_PHASES.READY]),
  [GAME_PHASES.RESULT]: new Set([GAME_PHASES.READY, GAME_PHASES.HOME])
});

export class GameState {
  constructor() {
    this.phase = GAME_PHASES.HOME;
    this.round = null;
    this.stroke = [];
    this.result = null;
    this.timerSeconds = null;
    this.revealProgress = 0;
    this.scoreDisplay = 0;
  }

  transition(nextPhase) {
    const allowed = VALID_TRANSITIONS[this.phase];
    if (!allowed?.has(nextPhase)) {
      throw new Error(`Invalid transition from ${this.phase} to ${nextPhase}`);
    }

    this.phase = nextPhase;

    if (nextPhase === GAME_PHASES.READY) {
      this.stroke = [];
      this.result = null;
      this.timerSeconds = null;
      this.revealProgress = 0;
      this.scoreDisplay = 0;
    }

    if (nextPhase === GAME_PHASES.DRAW) {
      this.stroke = [];
      this.result = null;
      this.revealProgress = 0;
      this.scoreDisplay = 0;
    }

    if (nextPhase === GAME_PHASES.RESULT) {
      this.timerSeconds = null;
    }
  }

  setRound(round) {
    this.round = round;
  }

  setStroke(points) {
    this.stroke = points;
  }

  setTimer(seconds) {
    this.timerSeconds = seconds;
  }

  setRevealProgress(progress) {
    this.revealProgress = clamp01(progress);
  }

  setResult(result) {
    this.result = result;
  }

  setScoreDisplay(percent) {
    this.scoreDisplay = percent;
  }
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}
