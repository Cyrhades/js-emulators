import { RIOTRAM } from "./RAM";
import { RIOTTimer } from "./Timer";
import { RIOTPortA } from "./PortA";
import { RIOTPortB } from "./PortB";

export class RIOT6532 {
  public ram: RIOTRAM = new RIOTRAM();
  public timer: RIOTTimer = new RIOTTimer();
  public portA: RIOTPortA = new RIOTPortA();
  public portB: RIOTPortB = new RIOTPortB();

  public read(address: number): number {
    const offset = address & 0x02ff;

    // RAM read: 0x0080 - 0x00FF (mirrored 0x0180-0x01FF)
    if ((offset & 0x0280) === 0x0080) {
      return this.ram.read(offset);
    }

    // RIOT I/O and Timer registers: 0x0280 - 0x029F
    if ((offset & 0x0280) === 0x0280) {
      const reg = offset & 0x07;
      switch (reg) {
        case 0: // SWCHA
          return this.portA.read();
        case 1: // SWACNT (DDRA)
          return 0;
        case 2: // SWCHB
          return this.portB.read();
        case 3: // SWBCNT (DDRB)
          return 0;
        case 4: // INTIM
          return this.timer.readTimer();
        case 5: // INSTAT
          return this.timer.readStatus();
        default:
          return 0;
      }
    }

    return 0;
  }

  public write(address: number, value: number): void {
    const offset = address & 0x02ff;

    // RAM write
    if ((offset & 0x0280) === 0x0080) {
      this.ram.write(offset, value);
      return;
    }

    // RIOT I/O and Timer registers
    if ((offset & 0x0280) === 0x0280) {
      const reg = offset & 0x1f;
      switch (reg) {
        case 0: // SWCHA
          this.portA.writeData(value);
          break;
        case 1: // SWACNT
          this.portA.writeDDR(value);
          break;
        case 2: // SWCHB
          this.portB.writeData(value);
          break;
        case 3: // SWBCNT
          this.portB.writeDDR(value);
          break;
        case 0x14: // TIM1T (0x294)
          this.timer.setTimer(value, 1);
          break;
        case 0x15: // TIM8T (0x295)
          this.timer.setTimer(value, 8);
          break;
        case 0x16: // TIM64T (0x296)
          this.timer.setTimer(value, 64);
          break;
        case 0x17: // T1024T (0x297)
          this.timer.setTimer(value, 1024);
          break;
      }
    }
  }

  public tick(cycles: number): void {
    this.timer.tick(cycles);
  }

  public reset(): void {
    this.ram.reset();
    this.timer.reset();
    this.portA.reset();
    this.portB.reset();
  }
}
