import NES from "../nes.js";
import Screen from "./screen.js";
import Speakers from "./speakers.js";
import FrameTimer from "./frame-timer.js";
import KeyboardController from "./keyboard.js";
import GamepadController from "./gamepad.js";
import { parseZip } from "../zip-loader.js";

// Debug logging, enabled via localStorage.jsnes_debug = 1
let debugEnabled = false;
try {
  debugEnabled = !!localStorage.getItem("jsnes_debug");
} catch {
  // localStorage not available
}
function debug(...args) {
  if (debugEnabled) console.log(...args);
}

/**
 * Browser-based NES emulator that handles canvas rendering, audio output,
 * keyboard/gamepad input, and frame timing.
 *
 * Usage:
 *   const browser = new jsnes.Browser({
 *     container: document.getElementById("nes"),
 *     romData: romData,
 *     onError: (e) => console.error(e),
 *   });
 *
 * If romData is omitted, call browser.loadROM(data) then browser.start().
 */
import { generateNesBootRomString } from "../boot-rom.js";

/**
 * Browser-based NES emulator that handles canvas rendering, audio output,
 * keyboard/gamepad input, and frame timing.
 */
export default class Browser {
  constructor(options = {}) {
    this._options = options;
    this._bootTimer = null;
    this._skipBootHandler = null;

    // Create screen (creates <canvas> inside container)
    this._screen = new Screen(options.container, {
      onMouseDown: (x, y) => {
        this.nes.zapperMove(x, y);
        this.nes.zapperFireDown();
      },
      onMouseUp: () => {
        this.nes.zapperFireUp();
      },
    });
    this._screen.fitInParent();

    // Create speakers
    this._speakers = new Speakers({
      onBufferUnderrun: () => {
        const isHidden = typeof document !== "undefined" && document.hidden;
        const isTimerInactive = !this._frameTimer || !this._frameTimer.running;

        if (isHidden || isTimerInactive) {
          debug(
            "Buffer underrun in background/inactive state, running extra frames",
          );
          this._frameTimer?.generateFrame();
          this._frameTimer?.generateFrame();
        }
      },
    });

    // Create NES
    this.nes = new NES({
      onFrame: this._screen.setBuffer,
      onStatusUpdate: debug,
      onAudioSample: this._speakers.writeSample,
      onBatteryRamWrite: options.onBatteryRamWrite || (() => {}),
      sampleRate: this._speakers.getSampleRate(),
    });

    // Create frame timer
    this._frameTimer = new FrameTimer({
      onGenerateFrame: () => {
        try {
          this.nes.frame();
          this._speakers.flush();
        } catch (e) {
          this.stop();
          if (this._options.onError) {
            this._options.onError(e);
          }
        }
      },
      onWriteFrame: this._screen.writeBuffer,
    });

    // Set up gamepad and keyboard
    this.gamepad = new GamepadController({
      onButtonDown: this.nes.buttonDown,
      onButtonUp: this.nes.buttonUp,
    });
    this.gamepad.loadGamepadConfig();
    this._gamepadPolling = this.gamepad.startPolling();

    this.keyboard = new KeyboardController({
      onButtonDown: this.gamepad.disableIfGamepadEnabled(this.nes.buttonDown),
      onButtonUp: this.gamepad.disableIfGamepadEnabled(this.nes.buttonUp),
    });
    this.keyboard.loadKeys();

    // Bind keyboard events
    document.addEventListener("keydown", this.keyboard.handleKeyDown);
    document.addEventListener("keyup", this.keyboard.handleKeyUp);
    document.addEventListener("keypress", this.keyboard.handleKeyPress);

    // Auto-pause when tab/window loses focus, auto-resume when focus returns
    this._pausedByBlur = false;

    this._handleBlur = () => {
      if (this._frameTimer && this._frameTimer.running) {
        this._pausedByBlur = true;
        this.stop(true);
      }
    };

    this._handleFocus = () => {
      if (
        this._pausedByBlur &&
        (typeof document === "undefined" || !document.hidden)
      ) {
        this._pausedByBlur = false;
        this.start();
      }
    };

    this._handleVisibilityChange = () => {
      if (typeof document !== "undefined" && document.hidden) {
        if (this._frameTimer && this._frameTimer.running) {
          this._pausedByBlur = true;
          this.stop(true);
        }
      } else {
        if (this._pausedByBlur) {
          this._pausedByBlur = false;
          this.start();
        }
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("blur", this._handleBlur);
      window.addEventListener("focus", this._handleFocus);
    }
    if (typeof document !== "undefined") {
      document.addEventListener(
        "visibilitychange",
        this._handleVisibilityChange,
      );
    }

    // Load ROM and start if provided
    if (options.romData) {
      this.loadROM(options.romData, options);
    }
  }

  start() {
    this._pausedByBlur = false;
    this._frameTimer.start();
    this._speakers.start().then(() => {
      if (this.nes && this._speakers) {
        this.nes.setSampleRate(this._speakers.getSampleRate());
      }
    });
    this._fpsInterval = setInterval(() => {
      debug(`FPS: ${this.nes.getFPS()}`);
    }, 1000);
  }

  stop(causedByBlur = false) {
    if (!causedByBlur) {
      this._pausedByBlur = false;
    }
    if (this._bootTimer) {
      clearTimeout(this._bootTimer);
      this._bootTimer = null;
    }
    if (this._skipBootHandler) {
      document.removeEventListener("keydown", this._skipBootHandler);
      if (this._screen && this._screen.canvas) {
        this._screen.canvas.removeEventListener("click", this._skipBootHandler);
      }
      this._skipBootHandler = null;
    }

    this._frameTimer.stop();
    this._speakers.stop();
    clearInterval(this._fpsInterval);
  }

  loadROM(data, options = {}) {
    this.stop();

    let targetRomData = null;
    const zipResult = parseZip(data);
    if (zipResult.isZip) {
      if (zipResult.type === "none") {
        throw new Error(
          zipResult.error || "No valid NES ROM file found in ZIP archive",
        );
      }
      if (zipResult.type === "single") {
        targetRomData = zipResult.romData;
      } else if (zipResult.type === "multiple") {
        let selectedIndex = 0;
        if (typeof options.zipIndex === "number" && options.zipIndex >= 0) {
          selectedIndex = options.zipIndex;
        } else if (options.zipFilename) {
          const idx = zipResult.roms.findIndex(
            (r) =>
              r.name === options.zipFilename ||
              r.fullPath === options.zipFilename,
          );
          if (idx !== -1) selectedIndex = idx;
        }
        const selected = zipResult.roms[selectedIndex];
        if (!selected) {
          throw new Error("Selected ROM index out of range in ZIP archive");
        }
        targetRomData = selected.data;
      }
    } else {
      targetRomData = data;
    }

    // Check if Boot ROM sequence is enabled (default: true)
    const skipBootScreen = options.skipBootScreen || true;

    if (skipBootScreen) {
      this.nes.loadROM(targetRomData);
      this.start();
    } else {
      // 1. First, load the executable NES Boot ROM into the emulator!
      const bootRom = generateNesBootRomString("JS-NES version By Cyrhades");
      this.nes.loadROM(bootRom);
      this.start();

      const launchTargetRom = () => {
        if (this._bootTimer) {
          clearTimeout(this._bootTimer);
          this._bootTimer = null;
        }
        if (this._skipBootHandler) {
          document.removeEventListener("keydown", this._skipBootHandler);
          if (this._screen && this._screen.canvas) {
            this._screen.canvas.removeEventListener(
              "click",
              this._skipBootHandler,
            );
          }
          this._skipBootHandler = null;
        }
        // 2. Load the actual target game ROM into the emulator
        this.nes.loadROM(targetRomData);
      };

      // Automatically launch target game ROM after 1.5 seconds (~90 frames)
      this._bootTimer = setTimeout(launchTargetRom, 1500);

      // Also allow skipping immediately via keypress or click
      this._skipBootHandler = (e) => {
        // Don't intercept function keys (e.g. F11)
        if (e && e.type === "keydown" && e.key && e.key.startsWith("F")) return;
        launchTargetRom();
      };

      document.addEventListener("keydown", this._skipBootHandler);
      if (this._screen && this._screen.canvas) {
        this._screen.canvas.addEventListener("click", this._skipBootHandler);
      }
    }
  }

  /**
   * Fill parent element with screen. Call if parent element changes size.
   */
  fitInParent() {
    this._screen.fitInParent();
  }

  screenshot() {
    return this._screen.screenshot();
  }

  /**
   * Clean up all resources: stop emulation, remove event listeners, remove canvas.
   */
  destroy() {
    this.stop();
    if (typeof window !== "undefined") {
      window.removeEventListener("blur", this._handleBlur);
      window.removeEventListener("focus", this._handleFocus);
    }
    if (typeof document !== "undefined") {
      document.removeEventListener(
        "visibilitychange",
        this._handleVisibilityChange,
      );
    }
    document.removeEventListener("keydown", this.keyboard.handleKeyDown);
    document.removeEventListener("keyup", this.keyboard.handleKeyUp);
    document.removeEventListener("keypress", this.keyboard.handleKeyPress);
    this._gamepadPolling.stop();
    this._screen.destroy();
  }

  /**
   * Load ROM data from a URL via XHR.
   */
  static loadROMFromURL(url, callback) {
    var req = new XMLHttpRequest();
    req.open("GET", url);
    req.overrideMimeType("text/plain; charset=x-user-defined");
    req.onerror = () =>
      callback(new Error(`Error loading ${url}: ${req.statusText}`));
    req.onload = function () {
      if (this.status === 200) {
        callback(null, this.responseText);
      } else if (this.status === 0) {
        // Aborted, ignore
      } else {
        req.onerror();
      }
    };
    req.send();
    return req;
  }
}
