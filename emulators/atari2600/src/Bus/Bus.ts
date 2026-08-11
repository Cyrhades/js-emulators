import { TIA } from "../TIA";
import { RIOT6532 } from "../RIOT6532";
import { Cartridge } from "../Cartridge";
import { ReadWrite } from "../CPU/types";

export class Bus {
  public tia: TIA;
  public riot: RIOT6532;
  public cartridge: Cartridge | null = null;

  constructor(tia: TIA, riot: RIOT6532, cartridge?: Cartridge) {
    this.tia = tia;
    this.riot = riot;
    if (cartridge) this.cartridge = cartridge;
  }

  public setCartridge(cartridge: Cartridge): void {
    this.cartridge = cartridge;
  }

  public accessMemory(readWrite: ReadWrite, address: number, value?: number): number {
    const normAddr = address & 0x1fff; // 13-bit address decoding for 6507

    if (readWrite === ReadWrite.read) {
      return this.read(normAddr);
    } else {
      this.write(normAddr, value ?? 0);
      return 0;
    }
  }

  public read(address: number): number {
    const normAddr = address & 0x1fff;

    // Cartridge ROM space: bit 12 set (0x1000 - 0x1FFF)
    if ((normAddr & 0x1000) !== 0) {
      if (this.cartridge) {
        return this.cartridge.read(normAddr);
      }
      return 0;
    }

    // RIOT I/O and Timer: bit 9 set (0x0280 - 0x029F)
    if ((normAddr & 0x0280) === 0x0280) {
      return this.riot.read(normAddr);
    }

    // RIOT RAM: bit 7 set, bit 9 clear (0x0080 - 0x00FF, mirrored at 0x0180 - 0x01FF)
    if ((normAddr & 0x0080) !== 0) {
      return this.riot.read(normAddr);
    }

    // TIA read: 0x0000 - 0x007F (bit 7 and bit 12 clear)
    return this.tia.read(normAddr);
  }

  public write(address: number, value: number): void {
    const normAddr = address & 0x1fff;

    // Cartridge ROM space
    if ((normAddr & 0x1000) !== 0) {
      if (this.cartridge) {
        this.cartridge.write(normAddr, value);
      }
      return;
    }

    // RIOT I/O and Timer
    if ((normAddr & 0x0280) === 0x0280) {
      this.riot.write(normAddr, value);
      return;
    }

    // RIOT RAM
    if ((normAddr & 0x0080) !== 0) {
      this.riot.write(normAddr, value);
      return;
    }

    // TIA write
    this.tia.write(normAddr, value);
  }
}
