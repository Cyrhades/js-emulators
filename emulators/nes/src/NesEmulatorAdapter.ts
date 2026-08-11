import {
  Emulator,
  VideoOutput,
  AudioOutput,
  EmulatorInput,
  GameGenieSupport,
  CheatCode,
  GameGeniePatch,
} from "../../../src/emulator/types";
import { audioManager } from "../../../src/emulator/AudioManager";
import NES from "./nes.js";
import Controller from "./controller.js";

const SCREEN_WIDTH = 256;
const SCREEN_HEIGHT = 240;

const BUTTON_MAP: Record<string, number> = {
  a: Controller.BUTTON_A,
  b: Controller.BUTTON_B,
  select: Controller.BUTTON_SELECT,
  start: Controller.BUTTON_START,
  up: Controller.BUTTON_UP,
  down: Controller.BUTTON_DOWN,
  left: Controller.BUTTON_LEFT,
  right: Controller.BUTTON_RIGHT,
  turboA: Controller.BUTTON_TURBO_A,
  turboB: Controller.BUTTON_TURBO_B,
};

export class NesEmulatorAdapter implements Emulator {
  public readonly id = "nes";
  public readonly name = "Nintendo (NES)";

  private nes: NES;
  private animFrameId: number | null = null;
  private isRunning: boolean = false;
  private isPaused: boolean = false;

  private videoBuffer: Uint8ClampedArray;
  private rgba32View: Uint32Array;
  private audioSamples: number[] = [];
  private prevButtons: Record<string, boolean> = {};

  public gameGenie: GameGenieSupport;
  private cheatCodes: CheatCode[] = [];
  private gameGenieEnabledState: boolean = true;
  private currentGameId: string | null = null;

  constructor() {
    this.videoBuffer = new Uint8ClampedArray(SCREEN_WIDTH * SCREEN_HEIGHT * 4);
    this.rgba32View = new Uint32Array(this.videoBuffer.buffer);

    this.nes = new NES({
      onFrame: (buffer: Uint32Array) => {
        for (let i = 0; i < buffer.length; i++) {
          this.rgba32View[i] = 0xff000000 | buffer[i];
        }
      },
      onAudioSample: (left: number, right: number) => {
        this.audioSamples.push((left + right) / 2);
      },
      removeSpriteLimit: true,
      sampleRate: 44100,
    });

    this.gameGenie = {
      isGameGenieEnabled: () => this.isGameGenieEnabled(),
      setGameGenieEnabled: (enabled: boolean) => this.setGameGenieEnabled(enabled),
      getGameGenieCodes: () => this.getGameGenieCodes(),
      addGameGenieCode: (code: string, description: string) => this.addGameGenieCode(code, description),
      toggleGameGenieCode: (id: string, active: boolean) => this.toggleGameGenieCode(id, active),
      deleteGameGenieCode: (id: string) => this.deleteGameGenieCode(id),
      clearGameGenieCodes: () => this.clearGameGenieCodes(),
      setGameId: (gameId: string) => this.setGameId(gameId),
    };

    this.loop = this.loop.bind(this);
  }

  private lastFrameTime: number = 0;
  private readonly frameInterval: number = 1000 / 60.0;

  public async loadRom(data: Uint8Array): Promise<void> {
    this.stop();
    await audioManager.resume();
    const sr = audioManager.getSampleRate();
    this.nes.setSampleRate(sr);
    this.nes.loadROM(data);
    this.prevButtons = {};
    this.audioSamples = [];
    this.lastFrameTime = 0;
    this.loadCodesFromStorage();
    this.reapplyPatches();
    audioManager.clear();
  }

  public setGameId(gameId: string): void {
    this.currentGameId = gameId;
    this.loadCodesFromStorage();
    this.reapplyPatches();
  }

  public isGameGenieEnabled(): boolean {
    return this.gameGenieEnabledState;
  }

  public setGameGenieEnabled(enabled: boolean): void {
    this.gameGenieEnabledState = enabled;
    this.nes.gameGenie.setEnabled(enabled);
    this.reapplyPatches();
    this.saveCodesToStorage();
  }

  public getGameGenieCodes(): CheatCode[] {
    return this.cheatCodes;
  }

  public addGameGenieCode(codeStr: string, description: string): boolean {
    const trimmed = codeStr.trim().toUpperCase();
    if (!trimmed) return false;

    const rawCodes = trimmed.split(/[\s+]+/).filter(Boolean);
    if (rawCodes.length === 0) return false;

    const decodedList: GameGeniePatch[] = [];
    for (const c of rawCodes) {
      const patch = this.nes.gameGenie.decode(c);
      if (!patch) return false;
      decodedList.push(patch);
    }

    const newCodeItem: CheatCode = {
      id: Date.now().toString() + "_" + Math.random().toString(36).substring(2, 7),
      code: trimmed,
      description: description.trim() || `Code ${trimmed}`,
      active: true,
      decoded: decodedList[0],
      decodedList: decodedList,
    };

    this.cheatCodes.push(newCodeItem);
    this.reapplyPatches();
    this.saveCodesToStorage();
    return true;
  }

  public toggleGameGenieCode(id: string, active: boolean): void {
    const item = this.cheatCodes.find((c) => c.id === id);
    if (item) {
      item.active = active;
      this.reapplyPatches();
      this.saveCodesToStorage();
    }
  }

  public deleteGameGenieCode(id: string): void {
    this.cheatCodes = this.cheatCodes.filter((c) => c.id !== id);
    this.reapplyPatches();
    this.saveCodesToStorage();
  }

  public clearGameGenieCodes(): void {
    this.cheatCodes = [];
    this.reapplyPatches();
    this.saveCodesToStorage();
  }

  private reapplyPatches(): void {
    this.nes.gameGenie.removeAllCodes();
    this.nes.gameGenie.setEnabled(this.gameGenieEnabledState);

    if (!this.gameGenieEnabledState) return;

    for (const item of this.cheatCodes) {
      if (item.active) {
        // Re-decode code strings to handle any legacy stored address formats
        const rawCodes = item.code.split(/[\s+]+/).filter(Boolean);
        const patchesToApply: GameGeniePatch[] = [];

        for (const c of rawCodes) {
          const p = this.nes.gameGenie.decode(c);
          if (p) patchesToApply.push(p);
        }

        const patches = patchesToApply.length > 0 ? patchesToApply : (item.decodedList || (item.decoded ? [item.decoded] : []));
        for (const patch of patches) {
          this.nes.gameGenie.patches.push(patch);
          if (patch.isRam) {
            this.nes.gameGenie.ramPatches.push(patch);
          }
        }
      }
    }

    if (this.nes.gameGenie.onChange) {
      this.nes.gameGenie.onChange();
    }
  }

  private loadCodesFromStorage(): void {
    if (!this.currentGameId) return;
    try {
      const key = `gamegenie_codes_${this.id}_${this.currentGameId}`;
      const stored = typeof localStorage !== "undefined" ? localStorage.getItem(key) : null;
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed.codes)) {
          this.cheatCodes = parsed.codes;
        }
        if (typeof parsed.enabled === "boolean") {
          this.gameGenieEnabledState = parsed.enabled;
        }
        this.reapplyPatches();
      }
    } catch (e) {
      console.warn("Could not load Game Genie codes from storage", e);
    }
  }

  private saveCodesToStorage(): void {
    if (!this.currentGameId) return;
    try {
      const key = `gamegenie_codes_${this.id}_${this.currentGameId}`;
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(
          key,
          JSON.stringify({
            codes: this.cheatCodes,
            enabled: this.gameGenieEnabledState,
          })
        );
      }
    } catch (e) {
      console.warn("Could not save Game Genie codes to storage", e);
    }
  }

  public start(): void {
    if (this.isRunning && !this.isPaused) return;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.isRunning = true;
    this.isPaused = false;
    this.lastFrameTime = 0;
    audioManager.clear();
    this.animFrameId = requestAnimationFrame(this.loop);
  }

  public pause(): void {
    this.isPaused = true;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  public resume(): void {
    if (this.isRunning && !this.isPaused) return;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.isRunning = true;
    this.isPaused = false;
    this.lastFrameTime = 0;
    audioManager.clear();
    this.animFrameId = requestAnimationFrame(this.loop);
  }

  public reset(): void {
    this.nes.reloadROM();
    this.audioSamples = [];
    this.lastFrameTime = 0;
    this.reapplyPatches();
    audioManager.clear();
  }

  public stop(): void {
    this.isRunning = false;
    this.isPaused = false;
    this.lastFrameTime = 0;
    audioManager.clear();
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  public getVideoOutput(): VideoOutput {
    return {
      width: SCREEN_WIDTH,
      height: SCREEN_HEIGHT,
      buffer: this.videoBuffer,
    };
  }

  public getAudioOutput(): AudioOutput | null {
    return {
      sampleRate: audioManager.getSampleRate(),
      getSamples: () => {
        const samples = new Float32Array(this.audioSamples);
        this.audioSamples = [];
        return samples;
      },
    };
  }

  public handleInput(input: EmulatorInput): void {
    const buttons = input.buttons;

    for (const [action, nesKey] of Object.entries(BUTTON_MAP)) {
      const isPressed = !!buttons[action];
      const wasPressed = !!this.prevButtons[action];

      if (isPressed && !wasPressed) {
        this.nes.buttonDown(1, nesKey as any);
      } else if (!isPressed && wasPressed) {
        this.nes.buttonUp(1, nesKey as any);
      }
    }

    this.prevButtons = { ...buttons };
  }

  private runSingleFrame(): void {
    try {
      this.nes.frame();
    } catch (e) {
      console.error("NES Emulation error:", e);
    }
    if (this.audioSamples.length > 0) {
      const samples = new Float32Array(this.audioSamples);
      audioManager.playBuffer(samples, audioManager.getSampleRate());
      this.audioSamples = [];
    }
  }

  private loop(timestamp?: number): void {
    if (!this.isRunning || this.isPaused) {
      this.animFrameId = null;
      return;
    }

    const now = typeof timestamp === "number" && timestamp > 0 ? timestamp : performance.now();

    if (!this.lastFrameTime) {
      this.lastFrameTime = now;
      this.runSingleFrame();
      this.animFrameId = requestAnimationFrame(this.loop);
      return;
    }

    let delta = now - this.lastFrameTime;

    // Reset timing if tab was inactive or lag spike > 100ms
    if (delta > 100) {
      this.lastFrameTime = now - this.frameInterval;
      delta = this.frameInterval;
    }

    let framesRun = 0;
    while (delta >= this.frameInterval && framesRun < 2) {
      this.runSingleFrame();
      this.lastFrameTime += this.frameInterval;
      delta -= this.frameInterval;
      framesRun++;
    }

    this.animFrameId = requestAnimationFrame(this.loop);
  }
}
