import Mapper0 from "./mapper0.js";

// Mapper 24: Konami VRC6a
// Used by games such as Akumajou Densetsu (Castlevania III Famicom).
//
// Features:
// - 16KB PRG ROM bank at $8000-$BFFF
// - 8KB PRG ROM bank at $C000-$DFFF
// - 8KB fixed PRG ROM bank at $E000-$FFFF (last 8KB bank of ROM)
// - Configurable CHR ROM banking modes (1KB / 2KB modes via $B003)
// - Programmable mirroring (Vertical, Horizontal, Single Screen 0/1)
// - Scanline / CPU cycle IRQ counter
class Mapper24 extends Mapper0 {
  static mapperName = "VRC6a";

  constructor(nes) {
    super(nes);
    this.a0a1Swapped = false;
    this.chrRegs = [0, 0, 0, 0, 0, 0, 0, 0];
    this.chrMode = 0;
    this.irqLatch = 0;
    this.irqCounter = 0;
    this.irqEnabled = false;
    this.irqEnableOnAck = false;
    this.irqMode = false;
  }

  updateChrBanks() {
    const mode = this.chrMode & 0x03;
    if (mode === 0) {
      // Mode 0: 8 x 1KB CHR banks
      for (let i = 0; i < 8; i++) {
        this.load1kVromBank(this.chrRegs[i], i * 0x0400);
      }
    } else if (mode === 1) {
      // Mode 1: 4 x 2KB CHR banks (Regs 0-3)
      for (let i = 0; i < 4; i++) {
        const bank2k = this.chrRegs[i];
        this.load1kVromBank(bank2k * 2, i * 0x0800);
        this.load1kVromBank(bank2k * 2 + 1, i * 0x0800 + 0x0400);
      }
    } else {
      // Mode 2 & 3: 4 x 1KB CHR banks ($0000-$0FFF) + 2 x 2KB CHR banks ($1000-$1FFF)
      for (let i = 0; i < 4; i++) {
        this.load1kVromBank(this.chrRegs[i], i * 0x0400);
      }
      const bank2k_0 = this.chrRegs[4];
      this.load1kVromBank(bank2k_0 * 2, 0x1000);
      this.load1kVromBank(bank2k_0 * 2 + 1, 0x1400);

      const bank2k_1 = this.chrRegs[5];
      this.load1kVromBank(bank2k_1 * 2, 0x1800);
      this.load1kVromBank(bank2k_1 * 2 + 1, 0x1c00);
    }
  }

  write(address, value) {
    if (address < 0x8000) {
      super.write(address, value);
      return;
    }

    const base = address & 0xf000;
    const reg = this.a0a1Swapped
      ? ((address & 0x01) << 1) | ((address & 0x02) >> 1)
      : address & 0x03;

    switch (base) {
      case 0x8000: {
        // 16KB PRG bank at $8000-$BFFF
        const bank = value & 0x0f;
        this.load8kRomBank(bank * 2, 0x8000);
        this.load8kRomBank(bank * 2 + 1, 0xa000);
        break;
      }

      case 0x9000:
      case 0xa000:
        // Konami VRC6 Expansion Audio registers
        break;

      case 0xb000:
        if (reg === 3) {
          // PPU Banking Style & Mirroring control
          this.chrMode = value & 0x03;

          const mirrorMode = (value >> 2) & 0x03;
          if (mirrorMode === 0) {
            this.nes.ppu.setMirroring(this.nes.rom.VERTICAL_MIRRORING);
          } else if (mirrorMode === 1) {
            this.nes.ppu.setMirroring(this.nes.rom.HORIZONTAL_MIRRORING);
          } else if (mirrorMode === 2) {
            this.nes.ppu.setMirroring(this.nes.rom.SINGLESCREEN_MIRRORING);
          } else if (mirrorMode === 3) {
            this.nes.ppu.setMirroring(this.nes.rom.SINGLESCREEN_MIRRORING2);
          }

          this.updateChrBanks();
        }
        break;

      case 0xc000: {
        // 8KB PRG bank at $C000-$DFFF
        const bank = value & 0x1f;
        this.load8kRomBank(bank, 0xc000);
        break;
      }

      case 0xd000:
        // CHR regs 0-3
        this.chrRegs[reg] = value;
        this.updateChrBanks();
        break;

      case 0xe000:
        // CHR regs 4-7
        this.chrRegs[4 + reg] = value;
        this.updateChrBanks();
        break;

      case 0xf000:
        if (reg === 0) {
          // IRQ Latch
          this.irqLatch = value;
        } else if (reg === 1) {
          // IRQ Control
          this.irqMode = (value & 0x01) !== 0;
          this.irqEnabled = (value & 0x02) !== 0;
          this.irqEnableOnAck = (value & 0x04) !== 0;
          if (this.irqEnabled) {
            this.irqCounter = this.irqLatch;
          }
        } else if (reg === 2) {
          // IRQ Acknowledge
          this.irqEnabled = this.irqEnableOnAck;
        }
        break;
    }
  }

  clockIrqCounter() {
    if (!this.irqEnabled) {
      return;
    }

    if (this.irqMode) {
      // CPU Cycle mode: increment counter by approx CPU cycles per scanline (~114)
      this.irqCounter += 114;
      if (this.irqCounter >= 0xff) {
        this.irqCounter = this.irqLatch;
        this.nes.cpu.requestIrq(this.nes.cpu.IRQ_NORMAL);
      }
    } else {
      // Scanline mode: increment on each scanline
      if (this.irqCounter === 0xff) {
        this.irqCounter = this.irqLatch;
        this.nes.cpu.requestIrq(this.nes.cpu.IRQ_NORMAL);
      } else {
        this.irqCounter++;
      }
    }
  }

  loadROM() {
    if (!this.nes.rom.valid) {
      throw new Error("VRC6: Invalid ROM! Unable to load.");
    }

    // Reset CHR registers
    this.chrRegs = [0, 1, 2, 3, 4, 5, 6, 7];
    this.chrMode = 0;

    // Load initial 16KB PRG bank at $8000-$BFFF (bank 0)
    this.load8kRomBank(0, 0x8000);
    this.load8kRomBank(1, 0xa000);

    // Load initial 8KB PRG bank at $C000-$DFFF (bank 0)
    this.load8kRomBank(0, 0xc000);

    // Fixed 8KB PRG bank at $E000-$FFFF (last 8KB bank of ROM)
    const last8k = this.nes.rom.romCount * 2 - 1;
    this.load8kRomBank(last8k, 0xe000);

    // Load initial CHR ROM
    this.updateChrBanks();

    // Reset CPU
    this.nes.cpu.requestIrq(this.nes.cpu.IRQ_RESET);
  }
}

export default Mapper24;
