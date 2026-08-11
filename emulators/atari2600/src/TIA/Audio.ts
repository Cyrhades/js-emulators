export class TIAAudio {
  public AUDC0: number = 0;
  public AUDC1: number = 0;
  public AUDF0: number = 0;
  public AUDF1: number = 0;
  public AUDV0: number = 0;
  public AUDV1: number = 0;

  private p0Divider: number = 0;
  private p1Divider: number = 0;
  private p0Out: number = 0;
  private p1Out: number = 0;

  private sampleBuffer: Float32Array = new Float32Array(735); // ~1 frame at 44.1kHz (44100 / 60)
  private sampleCounter: number = 0;

  public write(address: number, value: number): void {
    const reg = address & 0x1f;
    switch (reg) {
      case 0x15: // AUDC0
        this.AUDC0 = value & 0x0f;
        break;
      case 0x16: // AUDC1
        this.AUDC1 = value & 0x0f;
        break;
      case 0x17: // AUDF0
        this.AUDF0 = value & 0x1f;
        break;
      case 0x18: // AUDF1
        this.AUDF1 = value & 0x1f;
        break;
      case 0x19: // AUDV0
        this.AUDV0 = value & 0x0f;
        break;
      case 0x1a: // AUDV1
        this.AUDV1 = value & 0x0f;
        break;
    }
  }

  public tick(cycles: number): void {
    // Channel 0
    if (this.AUDV0 > 0) {
      this.p0Divider += cycles;
      const period0 = (this.AUDF0 + 1) * 38;
      if (this.p0Divider >= period0) {
        this.p0Divider -= period0;
        this.p0Out = this.p0Out === 0 ? 1 : 0;
      }
    } else {
      this.p0Out = 0;
    }

    // Channel 1
    if (this.AUDV1 > 0) {
      this.p1Divider += cycles;
      const period1 = (this.AUDF1 + 1) * 38;
      if (this.p1Divider >= period1) {
        this.p1Divider -= period1;
        this.p1Out = this.p1Out === 0 ? 1 : 0;
      }
    } else {
      this.p1Out = 0;
    }

    if (this.sampleCounter < this.sampleBuffer.length) {
      const v0 = (this.AUDV0 / 15.0) * (this.p0Out ? 1 : -1);
      const v1 = (this.AUDV1 / 15.0) * (this.p1Out ? 1 : -1);
      const sample = (v0 + v1) * 0.15;
      this.sampleBuffer[this.sampleCounter++] = sample;
    }
  }

  public getSamples(): Float32Array {
    const output = this.sampleBuffer.slice(0, this.sampleCounter);
    this.sampleCounter = 0;
    return output;
  }

  public reset(): void {
    this.AUDC0 = 0;
    this.AUDC1 = 0;
    this.AUDF0 = 0;
    this.AUDF1 = 0;
    this.AUDV0 = 0;
    this.AUDV1 = 0;
    this.p0Divider = 0;
    this.p1Divider = 0;
    this.p0Out = 0;
    this.p1Out = 0;
    this.sampleCounter = 0;
  }
}
