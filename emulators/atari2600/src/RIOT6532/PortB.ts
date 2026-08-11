export interface ConsoleSwitches {
  reset: boolean;
  select: boolean;
  color: boolean;
  p0DifficultyPro: boolean;
  p1DifficultyPro: boolean;
}

export class RIOTPortB {
  private ddr: number = 0x00;
  private outData: number = 0xff;
  private switches: ConsoleSwitches = {
    reset: false,
    select: false,
    color: true,
    p0DifficultyPro: false,
    p1DifficultyPro: false,
  };

  public setSwitches(switches: Partial<ConsoleSwitches>): void {
    this.switches = { ...this.switches, ...switches };
  }

  public read(): number {
    let bits = 0x0b; // bits 2, 4, 5 default active/unused
    if (!this.switches.reset) bits |= 0x01; // bit 0: Reset (0 = pressed)
    if (!this.switches.select) bits |= 0x02; // bit 1: Select (0 = pressed)
    if (this.switches.color) bits |= 0x08; // bit 3: Color (1 = Color, 0 = B&W)
    if (this.switches.p0DifficultyPro) bits |= 0x40; // bit 6: P0 difficulty
    if (this.switches.p1DifficultyPro) bits |= 0x80; // bit 7: P1 difficulty

    return (this.outData & this.ddr) | (bits & ~this.ddr);
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
