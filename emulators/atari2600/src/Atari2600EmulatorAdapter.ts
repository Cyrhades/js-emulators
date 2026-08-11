import { Emulator, VideoOutput, AudioOutput, EmulatorInput } from "../../../src/emulator/types";
import { audioManager } from "../../../src/emulator/AudioManager";
import { Atari2600 } from "./Atari2600";

export class Atari2600EmulatorAdapter implements Emulator {
  public readonly id = "atari2600";
  public readonly name = "Atari 2600";

  private atari: Atari2600;
  private animFrameId: number | null = null;
  private isRunning: boolean = false;
  private isPaused: boolean = false;

  constructor() {
    this.atari = new Atari2600();
    this.loop = this.loop.bind(this);
  }

  public async loadRom(data: Uint8Array): Promise<void> {
    this.stop();
    this.atari.insertCartridge(data);
    this.atari.reset();
  }

  public start(): void {
    if (this.isRunning && !this.isPaused) return;
    this.isRunning = true;
    this.isPaused = false;
    this.loop();
  }

  public pause(): void {
    this.isPaused = true;
  }

  public resume(): void {
    if (this.isRunning && !this.isPaused) return;
    if (this.isRunning) {
      this.isPaused = false;
      this.loop();
    }
  }

  public reset(): void {
    this.atari.reset();
  }

  public stop(): void {
    this.isRunning = false;
    this.isPaused = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  public getVideoOutput(): VideoOutput {
    return {
      width: this.atari.tia.video.width,
      height: this.atari.tia.video.height,
      buffer: this.atari.tia.video.buffer,
    };
  }

  public getAudioOutput(): AudioOutput | null {
    return {
      sampleRate: 44100,
      getSamples: () => this.atari.tia.audio.getSamples(),
    };
  }

  public handleInput(input: EmulatorInput): void {
    const b = input.buttons;
    this.atari.setJoystickP0({
      up: !!b["up"],
      down: !!b["down"],
      left: !!b["left"],
      right: !!b["right"],
      fire: !!b["fire"],
    });

    const isColor = b["tvType"] !== undefined ? !b["tvType"] : true;

    this.atari.setConsoleSwitches({
      reset: !!b["reset"],
      select: !!b["select"],
      color: isColor,
    });

    this.atari.tia.video.colorMode = isColor;
  }

  private loop(): void {
    if (!this.isRunning || this.isPaused) return;
    this.atari.runFrame();

    const samples = this.atari.tia.audio.getSamples();
    if (samples && samples.length > 0) {
      audioManager.playBuffer(samples);
    }

    this.animFrameId = requestAnimationFrame(this.loop);
  }
}
