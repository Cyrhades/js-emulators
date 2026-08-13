// Debug logging, enabled via localStorage.jsnes_debug = 1
let debugEnabled = false;
try {
  debugEnabled = !!localStorage.getItem("jsnes_debug");
} catch {
  // localStorage not available
}

const FPS = 60.098;

export default class FrameTimer {
  constructor(props) {
    // Run at 60 FPS
    this.onGenerateFrame = props.onGenerateFrame;
    // Run on animation frame
    this.onWriteFrame = props.onWriteFrame;
    this.onAnimationFrame = this.onAnimationFrame.bind(this);
    this.running = false;
    this.interval = 1e3 / FPS;
    this.lastFrameTime = 0;
  }

  setFrameRate(fps) {
    this.interval = 1e3 / (fps || FPS);
  }

  start() {
    this.running = true;
    this.lastFrameTime = 0;
    this.requestAnimationFrame();
  }

  stop() {
    this.running = false;
    if (this._requestID) window.cancelAnimationFrame(this._requestID);
    this._requestID = null;
    this.lastFrameTime = 0;
  }

  requestAnimationFrame() {
    if (this.running) {
      this._requestID = window.requestAnimationFrame(this.onAnimationFrame);
    }
  }

  generateFrame() {
    this.onGenerateFrame();
  }

  onAnimationFrame = (time) => {
    if (!this.running) return;
    this.requestAnimationFrame();

    // First frame: initialize lastFrameTime and run initial frame
    if (!this.lastFrameTime) {
      this.lastFrameTime = time;
      this.generateFrame();
      this.onWriteFrame();
      return;
    }

    let delta = time - this.lastFrameTime;

    // Reset timing if delta is abnormally large (e.g. tab switch, pause, or system lag)
    // to prevent running too many catch-up frames at once
    if (delta > 100) {
      this.lastFrameTime = time - this.interval;
      delta = this.interval;
    }

    let framesToRun = 0;
    while (delta >= this.interval && framesToRun < 3) {
      this.generateFrame();
      this.lastFrameTime += this.interval;
      delta -= this.interval;
      framesToRun++;
    }

    if (framesToRun > 0) {
      this.onWriteFrame();
    }

    if (framesToRun > 1 && debugEnabled) {
      console.log("CATCHUP FRAMES:", framesToRun);
    }
  };
}
