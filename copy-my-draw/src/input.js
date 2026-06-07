export class DrawingInput {
  constructor(canvas, options) {
    this.canvas = canvas;
    this.minPointDistance = options.minPointDistance;
    this.onStart = options.onStart;
    this.onChange = options.onChange;
    this.onComplete = options.onComplete;
    this.enabled = false;
    this.activePointerId = null;
    this.points = [];
    this.completed = false;

    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);

    canvas.addEventListener("pointerdown", this.handlePointerDown);
    canvas.addEventListener("pointermove", this.handlePointerMove);
    canvas.addEventListener("pointerup", this.handlePointerUp);
    canvas.addEventListener("pointercancel", this.handlePointerUp);
  }

  reset() {
    this.activePointerId = null;
    this.points = [];
    this.completed = false;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
  }

  getPoints() {
    return this.points.map((point) => ({ ...point }));
  }

  finishStroke() {
    if (!this.completed && this.points.length > 0) {
      this.completed = true;
      this.activePointerId = null;
      this.onComplete?.(this.getPoints());
    }
  }

  handlePointerDown(event) {
    if (!this.enabled || this.completed || this.points.length > 0) {
      return;
    }

    event.preventDefault();
    this.activePointerId = event.pointerId;
    this.canvas.setPointerCapture?.(event.pointerId);
    this.points.push(this.eventToPoint(event));
    this.onStart?.(this.getPoints());
    this.onChange?.(this.getPoints());
  }

  handlePointerMove(event) {
    if (!this.enabled || this.activePointerId !== event.pointerId || this.completed) {
      return;
    }

    event.preventDefault();
    const nextPoint = this.eventToPoint(event);
    const previous = this.points[this.points.length - 1];
    if (!previous || distance(previous, nextPoint) >= this.minPointDistance) {
      this.points.push(nextPoint);
      this.onChange?.(this.getPoints());
    }
  }

  handlePointerUp(event) {
    if (!this.enabled || this.activePointerId !== event.pointerId || this.completed) {
      return;
    }

    event.preventDefault();
    this.finishStroke();
    this.canvas.releasePointerCapture?.(event.pointerId);
  }

  eventToPoint(event) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: clamp01((event.clientX - rect.left) / rect.width),
      y: clamp01((event.clientY - rect.top) / rect.height)
    };
  }
}

function distance(first, second) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}
