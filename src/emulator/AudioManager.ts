const WORKLET_CODE = `
class RetroAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.capacity = 32768;
    this.buffer = new Float32Array(this.capacity);
    this.readPos = 0;
    this.writePos = 0;
    this.count = 0;

    this.port.onmessage = (e) => {
      if (e.data.type === "samples") {
        const samples = e.data.samples;
        const len = samples.length;
        for (let i = 0; i < len; i++) {
          if (this.count < this.capacity) {
            this.buffer[this.writePos] = samples[i];
            this.writePos = (this.writePos + 1) % this.capacity;
            this.count++;
          } else {
            this.readPos = (this.readPos + 1) % this.capacity;
            this.buffer[this.writePos] = samples[i];
            this.writePos = (this.writePos + 1) % this.capacity;
          }
        }
      } else if (e.data.type === "clear") {
        this.readPos = 0;
        this.writePos = 0;
        this.count = 0;
        this.buffer.fill(0);
      }
    };
  }

  process(inputs, outputs) {
    const output = outputs[0];
    if (!output || output.length === 0) return true;

    const len = output[0].length;
    const channelsCount = output.length;

    if (this.count < len) {
      for (let i = 0; i < this.count; i++) {
        const val = this.buffer[this.readPos];
        this.readPos = (this.readPos + 1) % this.capacity;
        for (let c = 0; c < channelsCount; c++) {
          output[c][i] = val;
        }
      }
      for (let i = this.count; i < len; i++) {
        for (let c = 0; c < channelsCount; c++) {
          output[c][i] = 0;
        }
      }
      this.count = 0;
    } else {
      for (let i = 0; i < len; i++) {
        const val = this.buffer[this.readPos];
        this.readPos = (this.readPos + 1) % this.capacity;
        for (let c = 0; c < channelsCount; c++) {
          output[c][i] = val;
        }
      }
      this.count -= len;
    }

    return true;
  }
}

registerProcessor("retro-audio-processor", RetroAudioProcessor);
`;

export class AudioManager {
  private ctx: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private scriptNode: ScriptProcessorNode | null = null;
  private initPromise: Promise<void> | null = null;
  private isMuted: boolean = false;
  private volume: number = 0.5;

  private readonly ringSize: number = 32768;
  private ringBuffer: Float32Array = new Float32Array(32768);
  private writePos: number = 0;
  private readPos: number = 0;
  private bufferedCount: number = 0;

  public async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
          this.gainNode = this.ctx.createGain();
          this.gainNode.gain.value = this.isMuted ? 0 : this.volume;

          // NES hardware audio filters:
          // 1. High-pass filter at 90Hz to remove DC offset rumble
          // 2. Low-pass filter at 14kHz to smooth out harsh 8-bit digital square wave aliasing
          const highpass = this.ctx.createBiquadFilter();
          highpass.type = "highpass";
          highpass.frequency.value = 90;

          const lowpass = this.ctx.createBiquadFilter();
          lowpass.type = "lowpass";
          lowpass.frequency.value = 14000;

          highpass.connect(lowpass);
          lowpass.connect(this.gainNode);
          this.gainNode.connect(this.ctx.destination);

          try {
            const blob = new Blob([WORKLET_CODE], { type: "application/javascript" });
            const url = URL.createObjectURL(blob);
            await this.ctx.audioWorklet.addModule(url);
            URL.revokeObjectURL(url);

            this.workletNode = new AudioWorkletNode(this.ctx, "retro-audio-processor", {
              outputChannelCount: [2],
            });
            this.workletNode.connect(highpass);
          } catch (err) {
            console.warn("[AudioManager] AudioWorklet failed, falling back to ScriptProcessor:", err);
            try {
              this.scriptNode = this.ctx.createScriptProcessor(2048, 0, 1);
              this.scriptNode.onaudioprocess = (e: AudioProcessingEvent) => {
                const output = e.outputBuffer.getChannelData(0);
                const len = output.length;

                if (this.isMuted || this.bufferedCount < len) {
                  for (let i = 0; i < Math.min(len, this.bufferedCount); i++) {
                    output[i] = this.isMuted ? 0 : this.ringBuffer[this.readPos];
                    this.readPos = (this.readPos + 1) % this.ringSize;
                  }
                  for (let i = this.bufferedCount; i < len; i++) {
                    output[i] = 0;
                  }
                  this.bufferedCount = 0;
                } else {
                  for (let i = 0; i < len; i++) {
                    output[i] = this.isMuted ? 0 : this.ringBuffer[this.readPos];
                    this.readPos = (this.readPos + 1) % this.ringSize;
                  }
                  this.bufferedCount -= len;
                }
              };
              this.scriptNode.connect(highpass);
            } catch {
              // ignore fallback error
            }
          }
        }
      }
    })();

    return this.initPromise;
  }

  public async resume(): Promise<void> {
    await this.init();
    if (this.ctx && this.ctx.state === "suspended") {
      try {
        await this.ctx.resume();
      } catch {
        // ignore gesture restriction warning
      }
    }
  }

  public setVolume(val: number): void {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.gainNode && !this.isMuted) {
      this.gainNode.gain.value = this.volume;
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (this.gainNode) {
      this.gainNode.gain.value = this.isMuted ? 0 : this.volume;
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public getSampleRate(): number {
    return this.ctx ? this.ctx.sampleRate : 44100;
  }

  public playBuffer(samples: Float32Array, _sampleRate: number = 44100): void {
    if (!this.ctx || samples.length === 0) return;

    if (this.workletNode) {
      this.workletNode.port.postMessage({ type: "samples", samples });
      return;
    }

    if (this.scriptNode) {
      for (let i = 0; i < samples.length; i++) {
        if (this.bufferedCount < this.ringSize) {
          this.ringBuffer[this.writePos] = samples[i];
          this.writePos = (this.writePos + 1) % this.ringSize;
          this.bufferedCount++;
        } else {
          this.readPos = (this.readPos + 1) % this.ringSize;
          this.ringBuffer[this.writePos] = samples[i];
          this.writePos = (this.writePos + 1) % this.ringSize;
        }
      }
    }
  }

  public clear(): void {
    if (this.workletNode) {
      this.workletNode.port.postMessage({ type: "clear" });
    }
    this.writePos = 0;
    this.readPos = 0;
    this.bufferedCount = 0;
    this.ringBuffer.fill(0);
  }

  public close(): void {
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    if (this.scriptNode) {
      this.scriptNode.disconnect();
      this.scriptNode = null;
    }
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
      this.gainNode = null;
    }
    this.initPromise = null;
    this.clear();
  }
}

export const audioManager = new AudioManager();
