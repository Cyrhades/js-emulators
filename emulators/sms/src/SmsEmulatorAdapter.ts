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
import JSSMS from "./jssms/jssms-core.js";
import { decodeSmsCheatCode } from "./smsCheatDecoder";

const SCREEN_WIDTH = 256;
const SCREEN_HEIGHT = 192;
const sharedMemoryStorage = new Map<string, string>();

export class SmsEmulatorAdapter implements Emulator {
  public readonly id = "sms";
  public readonly name = "Sega Master System";

  private sms: any;
  private animFrameId: number | null = null;
  private isRunning: boolean = false;
  private isPaused: boolean = false;

  private videoBuffer: Uint8ClampedArray;
  private audioSamples: number[] = [];
  private lastFrameTime: number = 0;
  private readonly frameInterval: number = 1000 / 60;

  public gameGenie: GameGenieSupport;
  private cheatCodes: CheatCode[] = [];
  private gameGenieEnabledState: boolean = true;
  private currentGameId: string | null = null;
  private activePatches: GameGeniePatch[] = [];

  constructor() {
    this.videoBuffer = new Uint8ClampedArray(SCREEN_WIDTH * SCREEN_HEIGHT * 4);

    const adapter = this;
    const customUi = function (this: any, sms: any) {
      this.main = sms;
      this.reset = () => {};
      this.updateStatus = () => {};
      this.writeAudio = (buffer: any) => {
        if (buffer && typeof buffer.getChannelData === "function") {
          const channelData = buffer.getChannelData(0);
          const count = sms.audioBufferOffset || channelData.length;
          for (let i = 0; i < count; i++) {
            adapter.audioSamples.push(channelData[i]);
          }
        }
      };
      this.writeFrame = () => {};
      this.updateDisassembly = () => {};
      this.canvasImageData = {
        data: new Uint8ClampedArray(SCREEN_WIDTH * SCREEN_HEIGHT * 4),
      };
    };

    this.sms = new JSSMS({
      ui: customUi,
    });
    this.sms.setSMS();
    if (this.sms.vdp) {
      this.sms.vdp.removeSpriteLimit = true;
    }

    this.gameGenie = {
      isGameGenieEnabled: () => this.gameGenieEnabledState,
      setGameGenieEnabled: (enabled: boolean) => {
        this.gameGenieEnabledState = enabled;
        this.reapplyPatches();
        this.saveCodesToStorage();
      },
      getGameGenieCodes: () => this.cheatCodes,
      addGameGenieCode: (code: string, description: string) => {
        const decoded = decodeSmsCheatCode(code);
        if (!decoded) return false;
        const newCode: CheatCode = {
          id: `sms_gg_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          code,
          description,
          active: true,
          decoded,
        };
        this.cheatCodes.push(newCode);
        this.reapplyPatches();
        this.saveCodesToStorage();
        return true;
      },
      toggleGameGenieCode: (id: string, active: boolean) => {
        const item = this.cheatCodes.find((c) => c.id === id);
        if (item) {
          item.active = active;
          this.reapplyPatches();
          this.saveCodesToStorage();
        }
      },
      deleteGameGenieCode: (id: string) => {
        this.cheatCodes = this.cheatCodes.filter((c) => c.id !== id);
        this.reapplyPatches();
        this.saveCodesToStorage();
      },
      clearGameGenieCodes: () => {
        this.cheatCodes = [];
        this.reapplyPatches();
        this.saveCodesToStorage();
      },
      setGameId: (gameId: string) => {
        this.currentGameId = gameId;
        this.loadCodesFromStorage();
      },
    };
  }

  private reapplyPatches(): void {
    this.activePatches = [];
    if (!this.gameGenieEnabledState) return;

    for (const item of this.cheatCodes) {
      if (item.active) {
        const decoded = item.decoded || decodeSmsCheatCode(item.code);
        if (decoded) {
          this.activePatches.push(decoded);
        }
      }
    }
  }

  private getStorage(): { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void } {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem("__test__", "1");
        window.localStorage.removeItem("__test__");
        return window.localStorage;
      }
    } catch {}
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("__test__", "1");
        localStorage.removeItem("__test__");
        return localStorage;
      }
    } catch {}
    return {
      getItem: (k: string) => sharedMemoryStorage.get(k) ?? null,
      setItem: (k: string, v: string) => sharedMemoryStorage.set(k, v),
    };
  }

  private loadCodesFromStorage(): void {
    if (!this.currentGameId) return;
    try {
      const storage = this.getStorage();
      const key = `gamegenie_codes_${this.id}_${this.currentGameId}`;
      const stored = storage ? storage.getItem(key) : null;
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
      console.warn("Could not load SMS Game Genie codes from storage", e);
    }
  }

  private saveCodesToStorage(): void {
    if (!this.currentGameId) return;
    try {
      const storage = this.getStorage();
      const key = `gamegenie_codes_${this.id}_${this.currentGameId}`;
      if (storage) {
        storage.setItem(
          key,
          JSON.stringify({
            codes: this.cheatCodes,
            enabled: this.gameGenieEnabledState,
          })
        );
      }
    } catch (e) {
      console.warn("Could not save SMS Game Genie codes to storage", e);
    }
  }

  public async loadRom(data: Uint8Array): Promise<void> {
    this.stop();

    const success = this.sms.readRomDirectly(data, "game.sms");
    if (!success) {
      throw new Error("Unable to load Master System ROM.");
    }

    this.sms.reset();
    if (this.sms.vdp) {
      this.sms.vdp.removeSpriteLimit = true;
    }
    this.reapplyPatches();
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isPaused = false;
    this.lastFrameTime = 0;
    audioManager.resume().catch(() => {});
    this.loop();
  }

  public pause(): void {
    this.isPaused = true;
  }

  public resume(): void {
    if (!this.isRunning) {
      this.start();
      return;
    }
    this.isPaused = false;
    this.lastFrameTime = 0;
    audioManager.resume().catch(() => {});
  }

  public reset(): void {
    if (this.sms) {
      this.sms.reset();
      if (this.sms.vdp) {
        this.sms.vdp.removeSpriteLimit = true;
      }
    }
  }

  public stop(): void {
    this.isRunning = false;
    this.isPaused = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.lastFrameTime = 0;
  }

  private runSingleFrame(): void {
    if (!this.sms) return;

    // Apply active Game Genie / RAM cheat patches
    if (this.gameGenieEnabledState && this.activePatches.length > 0 && this.sms.cpu) {
      for (const patch of this.activePatches) {
        if (typeof this.sms.cpu.setUint8 === "function") {
          this.sms.cpu.setUint8(patch.addr, patch.value);
        }
      }
    }

    this.sms.cpu.frame();

    // Stream generated audio samples to Web Audio API
    if (this.audioSamples.length > 0) {
      const samples = new Float32Array(this.audioSamples);
      audioManager.playBuffer(samples, 44100);
      this.audioSamples = [];
    }

    // Copy VDP display buffer to videoBuffer
    const display = this.sms.vdp.display;
    if (display && display.length >= this.videoBuffer.length) {
      this.videoBuffer.set(display.subarray(0, this.videoBuffer.length));
    }
  }

  private loop = (timestamp?: number): void => {
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
  };

  public getVideoOutput(): VideoOutput {
    return {
      width: SCREEN_WIDTH,
      height: SCREEN_HEIGHT,
      buffer: this.videoBuffer,
    };
  }

  public getAudioOutput(): AudioOutput | null {
    if (this.audioSamples.length === 0) return null;
    const samples = new Float32Array(this.audioSamples);
    this.audioSamples = [];
    return {
      getSamples: () => samples,
      sampleRate: 44100,
    };
  }

  public handleInput(input: EmulatorInput): void {
    if (!this.sms || !this.sms.keyboard) return;

    const b = input.buttons || {};
    let p1 = 0xff;

    if (b.up) p1 &= ~0x01;
    if (b.down) p1 &= ~0x02;
    if (b.left) p1 &= ~0x04;
    if (b.right) p1 &= ~0x08;
    if (b.button1 || b.a) p1 &= ~0x10;
    if (b.button2 || b.b) p1 &= ~0x20;

    this.sms.keyboard.controller1 = p1;

    // SMS Console Pause button
    if (b.pause || b.start) {
      this.sms.pause_button = true;
    } else {
      this.sms.pause_button = false;
    }
  }
}
