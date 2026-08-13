import Mapper0 from "./mapper0.js";

// AxROM (NES-AMROM, NES-ANROM, NES-AOROM)
// Used by games like Battletoads, Marble Madness, Wizards & Warriors, Digger T. Rock.
// 32 KB switchable PRG-ROM bank (bits 0-2) with single-screen nametable mirroring
// select (bit 4). Uses CHR-RAM, no CHR bank switching.
//
// On power-on/reset, the mapper latch is undefined but the PRG bank register
// and mirroring bit default to 0, so the first 32KB bank is active and nametable
// mirroring is Single Screen Page 0 ($2000). The ROM header mirroring bit is
// ignored because AxROM always uses mapper-controlled single-screen mirroring.
//
// Bus conflicts: AMROM/AOROM boards (HVC-AMROM, NES-AMROM, NES-AOROM) have bus conflicts.
// The CPU and PRG-ROM drive the data bus simultaneously on writes to $8000-$FFFF, so the
// latch receives (value & ROM[address]). Games like Digger T. Rock (EUR), Battletoads, etc.
// rely on bus conflicts for correct bank and nametable mirroring selection.
// ANROM boards (NES 2.0 submapper 2) do not have bus conflicts.
//
// See https://www.nesdev.org/wiki/AxROM
class Mapper7 extends Mapper0 {
  static mapperName = "AxROM";

  constructor(nes) {
    super(nes);
  }

  write(address, value) {
    // Writes to addresses other than MMC registers are handled by NoMapper.
    if (address < 0x8000) {
      super.write(address, value);
    } else {
      // AxROM register ($8000-$FFFF):
      //   bits 2-0: PRG-ROM bank select (32KB)
      //   bit 4:    nametable page select (0 = page 0/$2000, 1 = page 1/$2400)

      // Emulate bus conflicts for AMROM/AOROM boards (unless submapper 1 / ANROM).
      // NES 2.0 Mapper 7 submappers: 0 = default (with bus conflicts),
      // 1 = ANROM (no bus conflicts), 2 = AMROM/AOROM (with bus conflicts).
      if (this.nes.rom.subMapper !== 1) {
        value &= this.nes.cpu.mem[address];
      }

      this.load32kRomBank(value & 0x7, 0x8000);
      if (value & 0x10) {
        this.nes.ppu.setMirroring(this.nes.rom.SINGLESCREEN_MIRRORING2);
      } else {
        this.nes.ppu.setMirroring(this.nes.rom.SINGLESCREEN_MIRRORING);
      }
    }
  }

  loadROM() {
    if (!this.nes.rom.valid) {
      throw new Error("AxROM: Invalid ROM! Unable to load.");
    }

    // Load first 32KB PRG-ROM bank (banks 0+1) into $8000-$FFFF.
    this.load32kRomBank(0, 0x8000);

    // Load CHR-ROM (AxROM uses CHR-RAM, so this is usually a no-op).
    this.loadCHRROM();

    // AxROM always starts with Single Screen mirroring on page 0 ($2000).
    // The ROM header mirroring field is irrelevant — the mapper controls it.
    // This must be set AFTER loadROM so the PPU mirror table is correct before
    // the game writes to nametable RAM during the first frame.
    this.nes.ppu.setMirroring(this.nes.rom.SINGLESCREEN_MIRRORING);

    // Do Reset-Interrupt:
    this.nes.cpu.requestIrq(this.nes.cpu.IRQ_RESET);
  }
}

export default Mapper7;
