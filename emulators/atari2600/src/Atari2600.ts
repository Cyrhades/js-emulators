import { CPU6507 } from "./CPU/CPU6507";
import { Bus } from "./Bus/Bus";
import { TIA } from "./TIA";
import { RIOT6532 } from "./RIOT6532";
import { Cartridge, createCartridge } from "./Cartridge";
import { ReadWrite } from "./CPU/types";

export class Atari2600 {
  public cpu: CPU6507;
  public bus: Bus;
  public tia: TIA;
  public riot: RIOT6532;
  public cartridge: Cartridge | null = null;
  public running: boolean = false;

  constructor() {
    this.tia = new TIA();
    this.riot = new RIOT6532();
    this.bus = new Bus(this.tia, this.riot);

    this.cpu = new CPU6507({
      accessMemory: (readWrite: ReadWrite, address: number, value?: number) => {
        return this.bus.accessMemory(readWrite, address, value);
      },
    });
  }

  public insertCartridge(romData: Uint8Array): void {
    this.cartridge = createCartridge(romData);
    this.bus.setCartridge(this.cartridge);
  }

  public reset(): void {
    if (this.cartridge) {
      this.cartridge.reset();
    }
    this.tia.reset();
    this.riot.reset();
    this.cpu.reset();
    this.running = true;
  }

  public step(): number {
    if (!this.running) return 0;

    // If TIA WSYNC is active, CPU is halted until TIA clears WSYNC at scanline end
    if (this.tia.registers.WSYNC) {
      this.tia.tick(1);
      this.riot.tick(1);
      return 1;
    }

    const cycles = this.cpu.step((tickCycles) => {
      this.tia.tick(tickCycles);
      this.riot.tick(tickCycles);
    });

    return cycles > 0 ? cycles : 2;
  }

  public runFrame(): void {
    if (!this.running) return;
    // Standard Atari 2600 frame: 262 scanlines * 76 CPU cycles = 19,912 cycles
    let cyclesRemaining = 19912;
    while (cyclesRemaining > 0 && this.running) {
      const cycles = this.step();
      cyclesRemaining -= cycles;
    }
  }

  public setJoystickP0(input: { up?: boolean; down?: boolean; left?: boolean; right?: boolean; fire?: boolean }): void {
    this.riot.portA.setJoystickP0({
      up: !!input.up,
      down: !!input.down,
      left: !!input.left,
      right: !!input.right,
    });
    if (input.fire !== undefined) {
      this.tia.registers.INPT4 = input.fire ? 0x00 : 0x80;
    }
  }

  public setConsoleSwitches(switches: { reset?: boolean; select?: boolean; color?: boolean }): void {
    this.riot.portB.setSwitches(switches);
  }
}
