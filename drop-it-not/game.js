import { createBall } from "./ball.js";
import { createBlocks } from "./blocks.js";
import { GAME_COLORS, GAME_CONFIG } from "./config.js";

function formatSeconds(value) {
  return `${value.toFixed(GAME_CONFIG.scorePrecision)}с`;
}

function safeReadBestTime() {
  try {
    const raw = window.localStorage.getItem(GAME_CONFIG.storageKeyBestTime);
    const parsed = Number.parseFloat(raw ?? "");
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}

function safeWriteBestTime(value) {
  try {
    window.localStorage.setItem(GAME_CONFIG.storageKeyBestTime, String(value));
  } catch {
    return;
  }
}

function createEmptyBounds(width = 0, height = 0) {
  return {
    width,
    height,
    leftLaneCenterX: GAME_CONFIG.wallWidth + GAME_CONFIG.ballRadius + GAME_CONFIG.laneInset,
    rightLaneCenterX: Math.max(
      width - GAME_CONFIG.wallWidth - GAME_CONFIG.ballRadius - GAME_CONFIG.laneInset,
      GAME_CONFIG.wallWidth + GAME_CONFIG.ballRadius + GAME_CONFIG.laneInset,
    ),
  };
}

export function createGame({ canvas, scoreEl, comboEl, bestEl, comboBestEl }) {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D context is not available.");
  }

  const state = {
    running: false,
    rafId: 0,
    lastFrameTime: 0,
    elapsed: 0,
    bestTime: safeReadBestTime(),
    savedBestRounded: 0,
    bounds: createEmptyBounds(),
    flowSpeed: GAME_CONFIG.initialSpeed,
  };

  const ball = createBall(state.bounds, GAME_CONFIG);
  const blocks = createBlocks(state.bounds, GAME_CONFIG.ballRadius);

  state.savedBestRounded = Number(state.bestTime.toFixed(GAME_CONFIG.scorePrecision));

  function syncBestTime() {
    if (state.elapsed > state.bestTime) {
      state.bestTime = state.elapsed;
    }

    const roundedBest = Number(state.bestTime.toFixed(GAME_CONFIG.scorePrecision));
    if (roundedBest !== state.savedBestRounded) {
      state.savedBestRounded = roundedBest;
      safeWriteBestTime(state.bestTime);
    }

    bestEl.textContent = formatSeconds(state.bestTime);
  }

  function updateHud() {
    scoreEl.textContent = `Время ${formatSeconds(state.elapsed)}`;
    comboEl.textContent = "Комбо —";
    comboBestEl.textContent = "—";
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width || canvas.clientWidth || window.innerWidth);
    const height = Math.max(1, rect.height || canvas.clientHeight || window.innerHeight);
    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    state.bounds = {
      width,
      height,
      leftLaneCenterX: GAME_CONFIG.wallWidth + GAME_CONFIG.ballRadius + GAME_CONFIG.laneInset,
      rightLaneCenterX: Math.max(
        width - GAME_CONFIG.wallWidth - GAME_CONFIG.ballRadius - GAME_CONFIG.laneInset,
        GAME_CONFIG.wallWidth + GAME_CONFIG.ballRadius + GAME_CONFIG.laneInset,
      ),
    };

    ball.resize(state.bounds);
    blocks.resize(state.bounds);
  }

  function reset() {
    state.running = false;
    state.elapsed = 0;
    state.flowSpeed = GAME_CONFIG.initialSpeed;
    ball.reset();
    blocks.reset(state.bounds.height - GAME_CONFIG.ballBottomOffset);
    updateHud();
  }

  function drawBackground() {
    const gradient = ctx.createLinearGradient(0, 0, 0, state.bounds.height);
    gradient.addColorStop(0, GAME_COLORS.paper);
    gradient.addColorStop(0.55, "#fff8dd");
    gradient.addColorStop(1, GAME_COLORS.mist);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, state.bounds.width, state.bounds.height);

    const glow = ctx.createRadialGradient(
      state.bounds.width / 2,
      state.bounds.height * 0.2,
      20,
      state.bounds.width / 2,
      state.bounds.height * 0.2,
      state.bounds.width * 0.7,
    );
    glow.addColorStop(0, "rgba(255, 255, 255, 0.92)");
    glow.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, state.bounds.width, state.bounds.height);
  }

  function drawWalls() {
    ctx.fillStyle = GAME_COLORS.wallFill;
    ctx.fillRect(0, 0, GAME_CONFIG.wallWidth, state.bounds.height);
    ctx.fillRect(
      state.bounds.width - GAME_CONFIG.wallWidth,
      0,
      GAME_CONFIG.wallWidth,
      state.bounds.height,
    );

    ctx.fillStyle = GAME_COLORS.wallEdge;
    ctx.fillRect(GAME_CONFIG.wallWidth - 2, 0, 2, state.bounds.height);
    ctx.fillRect(state.bounds.width - GAME_CONFIG.wallWidth, 0, 2, state.bounds.height);
  }

  function drawBlocks() {
    blocks.draw(ctx);
  }

  function drawPrompt() {
    if (state.running) {
      return;
    }

    ctx.save();
    ctx.fillStyle = "rgba(80, 81, 79, 0.88)";
    ctx.font = '800 22px "Manrope", sans-serif';
    ctx.textAlign = "center";
    ctx.fillText("Тапни, чтобы начать", state.bounds.width / 2, state.bounds.height * 0.24);
    ctx.font = '700 14px "Manrope", sans-serif';
    ctx.fillStyle = "rgba(80, 81, 79, 0.68)";
    ctx.fillText("Красный блок сбрасывает раунд", state.bounds.width / 2, state.bounds.height * 0.24 + 24);
    ctx.restore();
  }

  function render() {
    ctx.clearRect(0, 0, state.bounds.width, state.bounds.height);
    drawBackground();
    drawWalls();
    drawBlocks();
    ball.draw(ctx);
    drawPrompt();
  }

  function frame(timestamp) {
    if (!state.running) {
      return;
    }

    if (!state.lastFrameTime) {
      state.lastFrameTime = timestamp;
    }

    const dt = Math.min((timestamp - state.lastFrameTime) / 1000, GAME_CONFIG.maxDeltaTime);
    state.lastFrameTime = timestamp;

    state.elapsed += dt;
    state.flowSpeed = Math.min(
      GAME_CONFIG.maxSpeed,
      GAME_CONFIG.initialSpeed + GAME_CONFIG.acceleration * state.elapsed,
    );

    ball.update(dt);
    blocks.update(dt, state.flowSpeed);

    if (blocks.collides(ball.getCollisionCircle())) {
      syncBestTime();
      state.running = false;
      state.rafId = 0;
      reset();
      render();
      return;
    }

    syncBestTime();
    updateHud();
    render();

    state.rafId = window.requestAnimationFrame(frame);
  }

  bestEl.textContent = formatSeconds(state.bestTime);
  updateHud();
  resize();
  render();

  return {
    start() {
      this.stop();
      resize();
      reset();
      render();
    },
    stop() {
      state.running = false;
      if (state.rafId) {
        window.cancelAnimationFrame(state.rafId);
        state.rafId = 0;
      }
      safeWriteBestTime(state.bestTime);
      bestEl.textContent = formatSeconds(state.bestTime);
    },
    reset,
    resize() {
      resize();
      render();
    },
    handleTap() {
      if (!state.running) {
        state.running = true;
        state.lastFrameTime = 0;
        ball.switchSide();
        render();
        state.rafId = window.requestAnimationFrame(frame);
        return;
      }

      ball.switchSide();
    },
  };
}
