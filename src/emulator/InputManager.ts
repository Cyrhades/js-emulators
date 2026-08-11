import { EmulatorInput, ControlBinding } from "./types";

export type KeyMap = Record<string, string>; // e.g. { "ArrowUp": "up", "ArrowDown": "down", "KeyX": "fire" }

export class InputManager {
  private keyMap: KeyMap = {};
  private activeState: Record<string, boolean> = {};
  private onInputChangeCallback?: (input: EmulatorInput) => void;
  private listening: boolean = false;
  private animationFrameId?: number;

  constructor() {
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    this.pollGamepad = this.pollGamepad.bind(this);
  }

  public setBindings(bindings: ControlBinding[]): void {
    const map: KeyMap = {};
    this.activeState = {};
    bindings.forEach((b) => {
      if (b.defaultKey && b.defaultKey !== "none") {
        map[b.defaultKey] = b.id;
      }
      this.activeState[b.id] = false;
    });
    this.keyMap = map;
  }

  public setCustomMapping(customMap: KeyMap): void {
    const map: KeyMap = {};
    this.activeState = {};
    for (const [actionId, key] of Object.entries(customMap)) {
      this.activeState[actionId] = false;
      if (key && key !== "none") {
        map[key] = actionId;
      }
    }
    this.keyMap = map;
  }

  public startListening(onInputChange: (input: EmulatorInput) => void): void {
    if (this.listening) return;
    this.listening = true;
    this.onInputChangeCallback = onInputChange;

    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    this.pollGamepad();
  }

  public stopListening(): void {
    if (!this.listening) return;
    this.listening = false;
    this.onInputChangeCallback = undefined;

    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);

    if (this.animationFrameId !== undefined) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = undefined;
    }
  }

  private handleKeyDown(e: KeyboardEvent): void {
    const action = this.keyMap[e.code] || this.keyMap[e.key];
    if (action) {
      // Prevent default scrolling on arrow keys / space
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
        e.preventDefault();
      }
      if (!this.activeState[action]) {
        this.activeState[action] = true;
        this.notifyStateChange();
      }
    }
  }

  private handleKeyUp(e: KeyboardEvent): void {
    const action = this.keyMap[e.code] || this.keyMap[e.key];
    if (action) {
      if (this.activeState[action]) {
        this.activeState[action] = false;
        this.notifyStateChange();
      }
    }
  }

  private pollGamepad(): void {
    if (!this.listening) return;

    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    if (gamepads) {
      for (const gp of gamepads) {
        if (gp) {
          // Standard gamepad mapping heuristics
          let changed = false;
          const gamepadMap: Record<string, boolean> = {
            up: !!(gp.buttons[12]?.pressed || gp.axes[1] < -0.5),
            down: !!(gp.buttons[13]?.pressed || gp.axes[1] > 0.5),
            left: !!(gp.buttons[14]?.pressed || gp.axes[0] < -0.5),
            right: !!(gp.buttons[15]?.pressed || gp.axes[0] > 0.5),
            fire: !!(gp.buttons[0]?.pressed || gp.buttons[1]?.pressed || gp.buttons[7]?.pressed),
            a: !!gp.buttons[0]?.pressed,
            b: !!gp.buttons[1]?.pressed,
            select: !!gp.buttons[8]?.pressed,
            start: !!gp.buttons[9]?.pressed,
          };

          // Override / check custom Gamepad_Btn_* assignments
          for (const [key, actionId] of Object.entries(this.keyMap)) {
            if (key.startsWith("Gamepad_Btn_")) {
              const btnIdx = parseInt(key.replace("Gamepad_Btn_", ""), 10);
              if (!isNaN(btnIdx)) {
                gamepadMap[actionId] = !!gp.buttons[btnIdx]?.pressed;
              }
            }
          }

          for (const [action, pressed] of Object.entries(gamepadMap)) {
            if (this.activeState[action] !== undefined && this.activeState[action] !== pressed) {
              this.activeState[action] = pressed;
              changed = true;
            }
          }

          if (changed) {
            this.notifyStateChange();
          }
          break; // process first connected gamepad
        }
      }
    }

    this.animationFrameId = requestAnimationFrame(this.pollGamepad);
  }

  private notifyStateChange(): void {
    if (this.onInputChangeCallback) {
      this.onInputChangeCallback({
        buttons: { ...this.activeState },
      });
    }
  }

  public getActiveState(): Record<string, boolean> {
    return { ...this.activeState };
  }
}

export const inputManager = new InputManager();
