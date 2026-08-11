export class RIOTTimer {
  private timerValue: number = 0;
  private prescaler: number = 1;
  private subCycleCount: number = 0;
  private expired: boolean = false;

  public setTimer(value: number, prescaler: number): void {
    this.timerValue = value;
    this.prescaler = prescaler;
    this.subCycleCount = 0;
    this.expired = false;
  }

  public tick(cycles: number = 1): void {
    if (!this.expired) {
      this.subCycleCount += cycles;
      while (this.subCycleCount >= this.prescaler) {
        this.subCycleCount -= this.prescaler;
        this.timerValue--;
        if (this.timerValue < 0) {
          this.timerValue = 0xff; // Wrap around to 255 and count down every single cycle when expired
          this.expired = true;
          this.prescaler = 1;
          break;
        }
      }
    } else {
      // Once expired, decrements every cycle
      this.timerValue = (this.timerValue - cycles) & 0xff;
    }
  }

  public readTimer(): number {
    return this.timerValue;
  }

  public readStatus(): number {
    const status = this.expired ? 0x80 : 0x00;
    this.expired = false; // Reading status clears interrupt flag
    return status;
  }

  public reset(): void {
    this.timerValue = 0;
    this.prescaler = 1;
    this.subCycleCount = 0;
    this.expired = false;
  }
}
