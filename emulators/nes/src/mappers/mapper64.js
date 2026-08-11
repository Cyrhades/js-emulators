import Mapper4 from "./mapper4.js";

// iNES Mapper 64: RAMBO-1 (Tengen)
// Used by games like Klax, Skull & Crossbones, Shinobi, Indiana Jones and the Temple of Doom, Rolling Thunder.
// Extension of MMC3 with 1KB CHR mode (K bit), PRG mode (P bit), CHR mode (C bit),
// extra registers R8, R9, R15, and CPU cycle/scanline IRQ modes.
// See https://www.nesdev.org/wiki/RAMBO-1
class Mapper64 extends Mapper4 {
  static mapperName = "RAMBO-1";

  constructor(nes) {
    super(nes);
    this.kBit = 0; // Bit 5 of $8000 (1KB CHR mode)
    this.r0 = 0;
    this.r1 = 0;
    this.r6 = 0;
    this.r7 = 1;
    this.r8 = 0;
    this.r9 = 0;
    this.r15 = 0;
    this.irqMode = 0; // Bit 0 of $C001 (0 = scanline, 1 = CPU cycle)
  }

  write(address, value) {
    if (address < 0x8000) {
      super.write(address, value);
      return;
    }

    switch (address & 0xe001) {
      case 0x8000:
        this.command = value & 0x0f;
        this.kBit = (value >> 5) & 1;
        this.prgAddressSelect = (value >> 6) & 1;
        this.chrAddressSelect = (value >> 7) & 1;
        this.updateBanks();
        break;

      case 0x8001:
        this.executeCommand(this.command, value);
        break;

      case 0xa000:
        if ((value & 1) !== 0) {
          this.nes.ppu.setMirroring(this.nes.rom.HORIZONTAL_MIRRORING);
        } else {
          this.nes.ppu.setMirroring(this.nes.rom.VERTICAL_MIRRORING);
        }
        break;

      case 0xa001:
        // SaveRAM protect / enable toggle
        break;

      case 0xc000:
        this.irqLatchValue = value;
        break;

      case 0xc001:
        this.irqCounter = this.irqLatchValue;
        this.irqMode = value & 1;
        break;

      case 0xe000:
        this.irqEnable = 0;
        break;

      case 0xe001:
        this.irqEnable = 1;
        break;
    }
  }

  executeCommand(cmd, arg) {
    switch (cmd) {
      case 0: // CHR $0000 or $1000
        this.r0 = arg;
        if (this.kBit === 0) {
          // 2KB mode
          this.load1kVromBank(
            arg & ~1,
            this.chrAddressSelect ? 0x1000 : 0x0000,
          );
          this.load1kVromBank(
            (arg & ~1) + 1,
            this.chrAddressSelect ? 0x1400 : 0x0400,
          );
        } else {
          // 1KB mode
          this.load1kVromBank(arg, this.chrAddressSelect ? 0x1000 : 0x0000);
        }
        break;

      case 1: // CHR $0800 or $1800
        this.r1 = arg;
        if (this.kBit === 0) {
          // 2KB mode
          this.load1kVromBank(
            arg & ~1,
            this.chrAddressSelect ? 0x1800 : 0x0800,
          );
          this.load1kVromBank(
            (arg & ~1) + 1,
            this.chrAddressSelect ? 0x1c00 : 0x0c00,
          );
        } else {
          // 1KB mode
          this.load1kVromBank(arg, this.chrAddressSelect ? 0x1800 : 0x0800);
        }
        break;

      case 2: // CHR $1000 or $0000
        this.load1kVromBank(arg, this.chrAddressSelect ? 0x0000 : 0x1000);
        break;

      case 3: // CHR $1400 or $0400
        this.load1kVromBank(arg, this.chrAddressSelect ? 0x0400 : 0x1400);
        break;

      case 4: // CHR $1800 or $0800
        this.load1kVromBank(arg, this.chrAddressSelect ? 0x0800 : 0x1800);
        break;

      case 5: // CHR $1C00 or $0C00
        this.load1kVromBank(arg, this.chrAddressSelect ? 0x0c00 : 0x1c00);
        break;

      case 6: // PRG $8000 or $C000
        this.r6 = arg;
        this.updatePrgBanks();
        break;

      case 7: // PRG $A000
        this.r7 = arg;
        this.load8kRomBank(arg, 0xa000);
        break;

      case 8: // CHR $0400 or $1400 (RAMBO-1 extra)
        this.r8 = arg;
        if (this.kBit === 1) {
          this.load1kVromBank(arg, this.chrAddressSelect ? 0x1400 : 0x0400);
        }
        break;

      case 9: // CHR $0C00 or $1C00 (RAMBO-1 extra)
        this.r9 = arg;
        if (this.kBit === 1) {
          this.load1kVromBank(arg, this.chrAddressSelect ? 0x1c00 : 0x0c00);
        }
        break;

      case 15: // PRG $C000 or $8000 (RAMBO-1 extra)
        this.r15 = arg;
        this.updatePrgBanks();
        break;
    }
  }

  updatePrgBanks() {
    const lastBank = (this.nes.rom.romCount - 1) * 2;
    if (this.prgAddressSelect === 0) {
      this.load8kRomBank(this.r6, 0x8000);
      this.load8kRomBank(this.r7, 0xa000);
      this.load8kRomBank(this.r15, 0xc000);
      this.load8kRomBank(lastBank + 1, 0xe000);
    } else {
      this.load8kRomBank(this.r15, 0x8000);
      this.load8kRomBank(this.r7, 0xa000);
      this.load8kRomBank(this.r6, 0xc000);
      this.load8kRomBank(lastBank + 1, 0xe000);
    }
  }

  updateBanks() {
    this.updatePrgBanks();
  }

  loadROM() {
    if (!this.nes.rom.valid) {
      throw new Error("RAMBO-1: Invalid ROM! Unable to load.");
    }
    this.r6 = 0;
    this.r7 = 1;
    this.r15 = Math.max(0, (this.nes.rom.romCount - 1) * 2 - 1);
    super.loadROM();
  }

  clockIrqCounter() {
    if (this.irqEnable === 1 && this.irqMode === 0) {
      this.irqCounter--;
      if (this.irqCounter < 0) {
        this.nes.cpu.requestIrq(this.nes.cpu.IRQ_NORMAL);
        this.irqCounter = this.irqLatchValue;
      }
    }
  }

  toJSON() {
    const s = super.toJSON();
    s.kBit = this.kBit;
    s.r0 = this.r0;
    s.r1 = this.r1;
    s.r6 = this.r6;
    s.r7 = this.r7;
    s.r8 = this.r8;
    s.r9 = this.r9;
    s.r15 = this.r15;
    s.irqMode = this.irqMode;
    return s;
  }

  fromJSON(s) {
    super.fromJSON(s);
    this.kBit = s.kBit;
    this.r0 = s.r0;
    this.r1 = s.r1;
    this.r6 = s.r6;
    this.r7 = s.r7;
    this.r8 = s.r8;
    this.r9 = s.r9;
    this.r15 = s.r15;
    this.irqMode = s.irqMode;
  }
}

export default Mapper64;
