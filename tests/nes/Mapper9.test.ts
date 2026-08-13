import { describe, it, expect, beforeEach } from "vitest";
// @ts-ignore
import Mapper9 from "../../emulators/nes/src/mappers/mapper9.js";
// @ts-ignore
import ROM from "../../emulators/nes/src/rom.js";

// Helper to construct a minimal NES ROM header & buffer configured for Mapper 9 (MMC2)
// 128KB PRG ROM (8 x 16KB banks = 16 x 8KB banks)
// 128KB CHR ROM (32 x 4KB banks)
function createMapper9NesRom(): Uint8Array {
  const header = new Uint8Array(16);
  header[0] = 0x4e; // 'N'
  header[1] = 0x45; // 'E'
  header[2] = 0x53; // 'S'
  header[3] = 0x1a; // MS-DOS EOF
  header[4] = 8;    // 8 x 16KB PRG ROM = 128KB
  header[5] = 16;   // 16 x 8KB CHR ROM = 32 x 4KB CHR banks = 128KB
  header[6] = 0x90; // Mapper 9 (low nibble 9), horizontal mirroring
  header[7] = 0x00; // Mapper 9 (high nibble 0)

  const prgSize = 8 * 16384;
  const chrSize = 16 * 8192;
  const prgRom = new Uint8Array(prgSize);
  const chrRom = new Uint8Array(chrSize);

  // Mark each 8KB PRG bank with a unique byte pattern
  // 16 banks total (index 0..15)
  for (let b = 0; b < 16; b++) {
    const bankOffset = b * 8192;
    for (let i = 0; i < 8192; i++) {
      prgRom[bankOffset + i] = 0xa0 + b;
    }
  }

  // Mark each 4KB CHR bank with a unique byte pattern
  // 32 banks total (index 0..31)
  for (let b = 0; b < 32; b++) {
    const bankOffset = b * 4096;
    for (let i = 0; i < 4096; i++) {
      chrRom[bankOffset + i] = 0x10 + b;
    }
  }

  const fullRom = new Uint8Array(16 + prgSize + chrSize);
  fullRom.set(header, 0);
  fullRom.set(prgRom, 16);
  fullRom.set(chrRom, 16 + prgSize);

  return fullRom;
}

// Minimal NES mock object for mapper testing
function createMockNes() {
  const mem = new Uint8Array(0x10000);
  const vramMem = new Uint8Array(0x8000);
  const ptTile = new Array(512);

  return {
    cpu: {
      mem,
      requestIrq: () => {},
      IRQ_RESET: 0,
    },
    ppu: {
      vramMem,
      ptTile,
      setMirroring: () => {},
      triggerRendering: () => {},
    },
    rom: null as unknown as ROM,
  };
}

describe("Mapper9 (MMC2)", () => {
  let mockNes: ReturnType<typeof createMockNes>;
  let mapper: Mapper9;

  beforeEach(() => {
    mockNes = createMockNes();
    const rom = new ROM(mockNes as any);
    const rawRom = createMapper9NesRom();
    rom.load(rawRom);
    mockNes.rom = rom;

    mapper = new Mapper9(mockNes as any);
    mapper.loadROM();
  });

  it("should initialize latches to 0xFE and load fixed PRG banks", () => {
    expect(mapper.latch0).toBe(0xfe);
    expect(mapper.latch1).toBe(0xfe);

    // PRG bank 0 loaded at $8000
    expect(mockNes.cpu.mem[0x8000]).toBe(0xa0);

    // Fixed last 3 8KB banks (banks 13, 14, 15) loaded at $A000, $C000, $E000
    expect(mockNes.cpu.mem[0xa000]).toBe(0xa0 + 13);
    expect(mockNes.cpu.mem[0xc000]).toBe(0xa0 + 14);
    expect(mockNes.cpu.mem[0xe000]).toBe(0xa0 + 15);
  });

  it("should switch PRG bank at $8000 on $A000 write", () => {
    mapper.write(0xa000, 0x05); // Select PRG 8k bank 5
    expect(mapper.prgBank).toBe(5);
    expect(mockNes.cpu.mem[0x8000]).toBe(0xa0 + 5);
  });

  it("should update CHR bank registers on $B000-$E000 writes", () => {
    mapper.write(0xb000, 2); // CHR bank for $0000 when latch0 = $FD
    mapper.write(0xc000, 4); // CHR bank for $0000 when latch0 = $FE
    mapper.write(0xd000, 6); // CHR bank for $1000 when latch1 = $FD
    mapper.write(0xe000, 8); // CHR bank for $1000 when latch1 = $FE

    expect(mapper.chrBankFD0).toBe(2);
    expect(mapper.chrBankFE0).toBe(4);
    expect(mapper.chrBankFD1).toBe(6);
    expect(mapper.chrBankFE1).toBe(8);

    // Since initial latches are 0xFE, CHR bank at $0000 should be bank 4, $1000 should be bank 8
    expect(mockNes.ppu.vramMem[0x0000]).toBe(0x10 + 4);
    expect(mockNes.ppu.vramMem[0x1000]).toBe(0x10 + 8);
  });

  it("should toggle Latch 0 when accessing $0FD0-$0FDF and $0FE0-$0FEF", () => {
    mapper.write(0xb000, 3); // CHR FD0 = 3
    mapper.write(0xc000, 7); // CHR FE0 = 7

    // Access $0FD8 (latch 0 -> $FD)
    mapper.latchAccess(0x0fd8);
    expect(mapper.latch0).toBe(0xfd);
    expect(mockNes.ppu.vramMem[0x0000]).toBe(0x10 + 3);

    // Access $0FD0 (latch 0 -> $FD, range start)
    mapper.latchAccess(0x0fd0);
    expect(mapper.latch0).toBe(0xfd);

    // Access $0FE8 (latch 0 -> $FE)
    mapper.latchAccess(0x0fe8);
    expect(mapper.latch0).toBe(0xfe);
    expect(mockNes.ppu.vramMem[0x0000]).toBe(0x10 + 7);

    // Access $0FEF (latch 0 -> $FE, range end)
    mapper.latchAccess(0x0fef);
    expect(mapper.latch0).toBe(0xfe);
  });

  it("should toggle Latch 1 when accessing $1FD0-$1FDF and $1FE0-$1FEF", () => {
    mapper.write(0xd000, 10); // CHR FD1 = 10
    mapper.write(0xe000, 12); // CHR FE1 = 12

    // Access $1FD4 (latch 1 -> $FD)
    mapper.latchAccess(0x1fd4);
    expect(mapper.latch1).toBe(0xfd);
    expect(mockNes.ppu.vramMem[0x1000]).toBe(0x10 + 10);

    // Access $1FEA (latch 1 -> $FE)
    mapper.latchAccess(0x1fea);
    expect(mapper.latch1).toBe(0xfe);
    expect(mockNes.ppu.vramMem[0x1000]).toBe(0x10 + 12);
  });

  it("should protect BG latch0 state from sprite rendering pass changes", () => {
    mapper.write(0xb000, 3);
    mapper.write(0xc000, 7);

    // Set latch0 = 0xFE for background
    mapper.latchAccess(0x0fe8);
    expect(mapper.latch0).toBe(0xfe);

    // Sprite render pass begins
    mapper.onSpriteRender();

    // Sprite tile access trying to trigger latch0 ($0FD8) should be ignored
    mapper.latchAccess(0x0fd8);
    expect(mapper.latch0).toBe(0xfe);

    // BG render pass resumes
    mapper.onBgRender();
    expect(mapper.latch0).toBe(0xfe);
    expect(mockNes.ppu.vramMem[0x0000]).toBe(0x10 + 7);
  });
});
