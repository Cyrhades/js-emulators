export interface JoystickState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

export class RIOTPortA {
  private ddr: number = 0x00; // 0 = Input, 1 = Output
  private outData: number = 0xff;
  private joystickP0: JoystickState = { up: false, down: false, left: false, right: false };
  private joystickP1: JoystickState = { up: false, down: false, left: false, right: false };

  public setJoystickP0(state: Partial<JoystickState>): void {
    this.joystickP0 = { ...this.joystickP0, ...state };
  }

  public setJoystickP1(state: Partial<JoystickState>): void {
    this.joystickP1 = { ...this.joystickP1, ...state };
  }

  public read(): number {
    let p0Bits = 0x0f;
    if (this.joystickP0.right) p0Bits &= ~0x08;
    if (this.joystickP0.left) p0Bits &= ~0x04;
    if (this.joystickP0.down) p0Bits &= ~0x02;
    if (this.joystickP0.up) p0Bits &= ~0x01;

    let p1Bits = 0x0f;
    if (this.joystickP1.right) p1Bits &= ~0x08;
    if (this.joystickP1.left) p1Bits &= ~0x04;
    if (this.joystickP1.down) p1Bits &= ~0x02;
    if (this.joystickP1.up) p1Bits &= ~0x01;

    const inData = (p0Bits << 4) | p1Bits;
    return (this.outData & this.ddr) | (inData & ~this.ddr);
  }

  public writeData(value: number): void {
    this.outData = value & 0xff;
  }

  public writeDDR(value: number): void {
    this.ddr = value & 0xff;
  }

  public reset(): void {
    this.ddr = 0x00;
    this.outData = 0xff;
  }
}
