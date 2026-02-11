const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const messageEl = document.getElementById("valentineMessage");
const winImageEl = document.getElementById("winImage");
const livesEl = document.getElementById("livesCount");
const restartBtn = document.getElementById("restartBtn");

const GAME_WIDTH = canvas.width;
const GAME_HEIGHT = canvas.height;

const CONFIG = {
  paddleWidth: 150,
  paddleHeight: 16,
  paddleSpeed: 620,
  ballRadius: 10,
  ballSpeed: 420,
  lives: 3,
  brickSize: 44,
  brickGap: 8,
  brickTopOffset: 36,
  maxBounceAngle: Math.PI / 3,
};

const HEART_PATTERN = [
  [0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0],
  [1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 0],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
  [0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0],
  [0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0],
  [0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
];

const BRICK_COLOR = "#fb7185";

const keys = {
  left: false,
  right: false,
};

let paddle = null;
let ball = null;
let bricks = [];
let remainingBricks = 0;
let totalBricks = 0;
let lives = CONFIG.lives;
let gameState = "playing";
let lastTime = 0;
let ballLaunched = false;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const updateLives = () => {
  livesEl.textContent = lives.toString();
};

const updateMessageOpacity = () => {
  if (totalBricks === 0) {
    messageEl.style.opacity = "1";
    messageEl.classList.add("is-winning");
    return;
  }
  const progress = 1 - remainingBricks / totalBricks;
  const opacity = clamp(progress, 0, 1);
  messageEl.style.opacity = opacity.toFixed(2);
  if (remainingBricks === 0) {
    messageEl.classList.add("is-winning");
  } else {
    messageEl.classList.remove("is-winning");
  }
};

const initPaddle = () => {
  paddle = {
    width: CONFIG.paddleWidth,
    height: CONFIG.paddleHeight,
    x: (GAME_WIDTH - CONFIG.paddleWidth) / 2,
    y: GAME_HEIGHT - 28,
    speed: CONFIG.paddleSpeed,
  };
};

const initBall = () => {
  ball = {
    x: GAME_WIDTH / 2,
    y: GAME_HEIGHT - 60,
    radius: CONFIG.ballRadius,
    vx: 0,
    vy: 0,
  };
  ballLaunched = false;
};

const initBricks = () => {
  bricks = [];
  const rows = HEART_PATTERN.length;
  const cols = HEART_PATTERN[0].length;
  const totalWidth = cols * CONFIG.brickSize + (cols - 1) * CONFIG.brickGap;
  const startX = (GAME_WIDTH - totalWidth) / 2;
  const startY = CONFIG.brickTopOffset;

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (!HEART_PATTERN[row][col]) continue;
      const x = startX + col * (CONFIG.brickSize + CONFIG.brickGap);
      const y = startY + row * (CONFIG.brickSize + CONFIG.brickGap);
      bricks.push({
        x,
        y,
        width: CONFIG.brickSize,
        height: CONFIG.brickSize,
        color: BRICK_COLOR,
        alive: true,
      });
    }
  }
  totalBricks = bricks.length;
  remainingBricks = totalBricks;
  updateMessageOpacity();
};

const resetGame = () => {
  initPaddle();
  initBall();
  initBricks();
  lives = CONFIG.lives;
  updateLives();
  gameState = "playing";
  winImageEl.classList.remove("is-active");
};

const launchBall = () => {
  if (ballLaunched) return;
  const angle = (Math.random() * 0.6 + 0.2) * Math.PI;
  ball.vx = CONFIG.ballSpeed * Math.cos(angle);
  ball.vy = -CONFIG.ballSpeed * Math.sin(angle);
  ballLaunched = true;
};

const circleRectCollision = (circle, rect) => {
  const closestX = clamp(circle.x, rect.x, rect.x + rect.width);
  const closestY = clamp(circle.y, rect.y, rect.y + rect.height);
  const dx = circle.x - closestX;
  const dy = circle.y - closestY;
  return dx * dx + dy * dy <= circle.radius * circle.radius;
};

const bounceFromBrick = (brick) => {
  const centerX = brick.x + brick.width / 2;
  const centerY = brick.y + brick.height / 2;
  const diffX = ball.x - centerX;
  const diffY = ball.y - centerY;
  const overlapX = brick.width / 2 + ball.radius - Math.abs(diffX);
  const overlapY = brick.height / 2 + ball.radius - Math.abs(diffY);
  if (overlapX < overlapY) {
    ball.vx *= -1;
  } else {
    ball.vy *= -1;
  }
};

const updatePaddle = (dt) => {
  let direction = 0;
  if (keys.left) direction -= 1;
  if (keys.right) direction += 1;
  if (direction !== 0) {
    paddle.x += direction * paddle.speed * dt;
    paddle.x = clamp(paddle.x, 0, GAME_WIDTH - paddle.width);
  }
};

const updateBall = (dt) => {
  if (!ballLaunched) {
    ball.x = paddle.x + paddle.width / 2;
    ball.y = paddle.y - ball.radius - 2;
    return;
  }
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  if (ball.x - ball.radius <= 0) {
    ball.x = ball.radius;
    ball.vx = Math.abs(ball.vx);
  }
  if (ball.x + ball.radius >= GAME_WIDTH) {
    ball.x = GAME_WIDTH - ball.radius;
    ball.vx = -Math.abs(ball.vx);
  }
  if (ball.y - ball.radius <= 0) {
    ball.y = ball.radius;
    ball.vy = Math.abs(ball.vy);
  }

  for (const brick of bricks) {
    if (!brick.alive) continue;
    if (circleRectCollision(ball, brick)) {
      brick.alive = false;
      remainingBricks -= 1;
      bounceFromBrick(brick);
      updateMessageOpacity();
      if (remainingBricks === 0) {
        gameState = "won";
        winImageEl.classList.add("is-active");
      }
      break;
    }
  }

  if (
    ball.vy > 0 &&
    ball.y + ball.radius >= paddle.y &&
    ball.y + ball.radius <= paddle.y + paddle.height &&
    ball.x >= paddle.x &&
    ball.x <= paddle.x + paddle.width
  ) {
    const hitPoint = (ball.x - (paddle.x + paddle.width / 2)) / (paddle.width / 2);
    const bounceAngle = hitPoint * CONFIG.maxBounceAngle;
    ball.vx = CONFIG.ballSpeed * Math.sin(bounceAngle);
    ball.vy = -CONFIG.ballSpeed * Math.cos(bounceAngle);
    ball.y = paddle.y - ball.radius - 1;
  }

  if (ball.y - ball.radius > GAME_HEIGHT) {
    lives -= 1;
    updateLives();
    if (lives > 0) {
      initPaddle();
      initBall();
    } else {
      gameState = "lost";
    }
  }
};

const update = (dt) => {
  if (gameState !== "playing") return;
  updatePaddle(dt);
  updateBall(dt);
};

const drawBricks = () => {
  for (const brick of bricks) {
    if (!brick.alive) continue;
    ctx.fillStyle = brick.color;
    ctx.fillRect(brick.x, brick.y, brick.width, brick.height);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.strokeRect(brick.x, brick.y, brick.width, brick.height);
  }
};

const drawPaddle = () => {
  ctx.fillStyle = "#e2e8f0";
  ctx.fillRect(paddle.x, paddle.y, paddle.width, paddle.height);
};

const drawBall = () => {
  ctx.beginPath();
  ctx.fillStyle = "#f8fafc";
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.closePath();
};

const draw = () => {
  ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  drawBricks();
  drawPaddle();
  drawBall();
};

const loop = (timestamp) => {
  const delta = Math.min((timestamp - lastTime) / 1000, 0.032);
  lastTime = timestamp;
  update(delta);
  draw();
  window.requestAnimationFrame(loop);
};

const handleKeyDown = (event) => {
  const key = event.key.toLowerCase();
  const isLeft =
    event.code === "ArrowLeft" ||
    event.code === "KeyA" ||
    key === "a" ||
    key === "ф";
  const isRight =
    event.code === "ArrowRight" ||
    event.code === "KeyD" ||
    key === "d" ||
    key === "в";

  if (isLeft) {
    keys.left = true;
    event.preventDefault();
  }
  if (isRight) {
    keys.right = true;
    event.preventDefault();
  }
  if (event.code === "Space") {
    if (gameState !== "playing") {
      resetGame();
    } else {
      launchBall();
    }
    event.preventDefault();
  }
};

const handleKeyUp = (event) => {
  const key = event.key.toLowerCase();
  const isLeft =
    event.code === "ArrowLeft" ||
    event.code === "KeyA" ||
    key === "a" ||
    key === "ф";
  const isRight =
    event.code === "ArrowRight" ||
    event.code === "KeyD" ||
    key === "d" ||
    key === "в";

  if (isLeft) {
    keys.left = false;
  }
  if (isRight) {
    keys.right = false;
  }
};

window.addEventListener("keydown", handleKeyDown);
window.addEventListener("keyup", handleKeyUp);
window.addEventListener("blur", () => {
  keys.left = false;
  keys.right = false;
});
restartBtn.addEventListener("click", resetGame);

resetGame();
lastTime = performance.now();
window.requestAnimationFrame(loop);
