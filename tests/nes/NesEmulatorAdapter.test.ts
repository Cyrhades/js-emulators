import { describe, it, expect, beforeEach } from "vitest";
import { NesEmulatorAdapter } from "../../emulators/nes/src/NesEmulatorAdapter";
import { nesDefinition } from "../../emulators/nes/src/NesDefinition";
import { consoleRegistry } from "../../src/emulator/ConsoleRegistry";
import { initConsoleRegistry } from "../../src/emulator/initRegistry";

// Helper to construct a minimal valid iNES format ROM
function createMinimalNesRom(): Uint8Array {
  // iNES Header (16 bytes)
  const header = new Uint8Array(16);
  header[0] = 0x4e; // 'N'
  header[1] = 0x45; // 'E'
  header[2] = 0x53; // 'S'
  header[3] = 0x1a; // MS-DOS EOF
  header[4] = 1;    // 1 x 16KB PRG ROM
  header[5] = 1;    // 1 x 8KB CHR ROM
  header[6] = 0;    // Mapper 0 (NROM), horizontal mirroring
  header[7] = 0;

  const prgRom = new Uint8Array(16384);
  // Simple NOP loop with RTS
  prgRom[0] = 0xea; // NOP
  prgRom[1] = 0x60; // RTS
  // Reset vector pointing to 0xC000
  prgRom[16380] = 0x00; // Reset LSB
  prgRom[16381] = 0xc0; // Reset MSB

  const chrRom = new Uint8Array(8192);

  const fullRom = new Uint8Array(16 + 16384 + 8192);
  fullRom.set(header, 0);
  fullRom.set(prgRom, 16);
  fullRom.set(chrRom, 16 + 16384);

  return fullRom;
}

describe("NesEmulatorAdapter", () => {
  let adapter: NesEmulatorAdapter;

  beforeEach(() => {
    adapter = new NesEmulatorAdapter();
  });

  it("should have correct id and name", () => {
    expect(adapter.id).toBe("nes");
    expect(adapter.name).toBe("Nintendo (NES)");
  });

  it("should export a valid ConsoleDefinition", () => {
    expect(nesDefinition.id).toBe("nes");
    expect(nesDefinition.isAvailable).toBe(true);
    expect(nesDefinition.supportedRomExtensions).toContain(".nes");
    const instance = nesDefinition.createEmulator();
    expect(instance.id).toBe("nes");
  });

  it("should register NES in ConsoleRegistry via initConsoleRegistry", () => {
    initConsoleRegistry();
    const registered = consoleRegistry.getConsole("nes");
    expect(registered).toBeDefined();
    expect(registered?.isAvailable).toBe(true);
  });

  it("should load a valid iNES ROM without throwing", async () => {
    const rom = createMinimalNesRom();
    await expect(adapter.loadRom(rom)).resolves.not.toThrow();
  });

  it("should provide valid video output specifications", () => {
    const video = adapter.getVideoOutput();
    expect(video.width).toBe(256);
    expect(video.height).toBe(240);
    expect(video.buffer.length).toBe(256 * 240 * 4);
  });

  it("should handle start, pause, resume, reset, and stop state transitions", async () => {
    const rom = createMinimalNesRom();
    await adapter.loadRom(rom);

    expect(() => adapter.start()).not.toThrow();
    expect(() => adapter.pause()).not.toThrow();
    expect(() => adapter.resume()).not.toThrow();
    expect(() => adapter.reset()).not.toThrow();
    expect(() => adapter.stop()).not.toThrow();
  });

  it("should handle input changes", () => {
    expect(() => {
      adapter.handleInput({
        buttons: {
          a: true,
          b: false,
          start: true,
          select: false,
          up: true,
          down: false,
          left: false,
          right: false,
          turboA: false,
          turboB: false,
        },
      });
    }).not.toThrow();
  });

  it("should expose gameGenie interface and manage codes", () => {
    expect(adapter.gameGenie).toBeDefined();
    expect(adapter.gameGenie.isGameGenieEnabled()).toBe(true);
    expect(adapter.gameGenie.getGameGenieCodes()).toHaveLength(0);

    // Add a valid 8-letter code (e.g. AAUNYLPA)
    const success = adapter.gameGenie.addGameGenieCode("AAUNYLPA", "Freeze Timer");
    expect(success).toBe(true);

    const codes = adapter.gameGenie.getGameGenieCodes();
    expect(codes).toHaveLength(1);
    expect(codes[0].code).toBe("AAUNYLPA");
    expect(codes[0].description).toBe("Freeze Timer");
    expect(codes[0].active).toBe(true);

    // Toggle code
    adapter.gameGenie.toggleGameGenieCode(codes[0].id, false);
    expect(adapter.gameGenie.getGameGenieCodes()[0].active).toBe(false);

    // Toggle global enable
    adapter.gameGenie.setGameGenieEnabled(false);
    expect(adapter.gameGenie.isGameGenieEnabled()).toBe(false);

    // Delete code
    adapter.gameGenie.deleteGameGenieCode(codes[0].id);
    expect(adapter.gameGenie.getGameGenieCodes()).toHaveLength(0);
  });

  it("should support adding combined codes with '+' and reject invalid codes", () => {
    const success = adapter.gameGenie.addGameGenieCode(
      "LEXVGYAA + ZAVNLGAA",
      "Combined Code"
    );
    expect(success).toBe(true);

    const codes = adapter.gameGenie.getGameGenieCodes();
    expect(codes).toHaveLength(1);
    expect(codes[0].decodedList).toHaveLength(2);

    // Reject invalid code
    const invalidSuccess = adapter.gameGenie.addGameGenieCode("INVALIDCODE", "Bad Code");
    expect(invalidSuccess).toBe(false);

    // Clear all
    adapter.gameGenie.clearGameGenieCodes();
    expect(adapter.gameGenie.getGameGenieCodes()).toHaveLength(0);
  });

  it("should expose saveData interface", () => {
    expect(adapter.saveData).toBeDefined();
    expect(adapter.saveData.hasSaveData()).toBe(false);
  });

  it("should detect PAL mode correctly for iNES 1.0 and NES 2.0 headers", () => {
    const romData = createMinimalNesRom();
    // iNES 1.0 PAL flag on byte 9
    romData[9] = 1;
    (adapter as any).nes.loadROM(romData);
    expect((adapter as any).nes.rom.isPal()).toBe(true);

    // NES 2.0 header: byte 7 bit 2..3 = 2 (NES 2.0 signature)
    const nes2Rom = createMinimalNesRom();
    nes2Rom[7] = (nes2Rom[7] & 0xf3) | 0x08;
    // timing mode = 1 (PAL)
    nes2Rom[12] = 1;
    (adapter as any).nes.loadROM(nes2Rom);
    expect((adapter as any).nes.rom.isPal()).toBe(true);

    // Dendy timing mode = 3
    nes2Rom[12] = 3;
    (adapter as any).nes.loadROM(nes2Rom);
    expect((adapter as any).nes.rom.isPal()).toBe(true);
  });

  it("should handle Mapper 7 bus conflict submappers correctly", () => {
    // Create a 128KB ROM (8 x 16KB PRG banks = 4 x 32KB banks)
    const header = new Uint8Array(16);
    header[0] = 0x4e; header[1] = 0x45; header[2] = 0x53; header[3] = 0x1a;
    header[4] = 8;    // 8 x 16KB PRG ROM
    header[5] = 0;    // 0 CHR
    header[6] = 0x70; // Mapper 7 low
    header[7] = 0x08; // NES 2.0 signature
    header[8] = 0x10; // Submapper 1

    const prgRom = new Uint8Array(128 * 1024);
    // Fill bank 0 with 0x00
    prgRom.fill(0x00, 0, 32768);
    // Fill 32KB bank 2 (16KB banks 4+5) at offset 64KB with 0x55
    prgRom.fill(0x55, 64 * 1024, 96 * 1024);

    const fullRom = new Uint8Array(16 + 128 * 1024);
    fullRom.set(header, 0);
    fullRom.set(prgRom, 16);

    // Submapper 1 (ANROM): NO bus conflicts (subMapper === 1)
    (adapter as any).nes.loadROM(fullRom);
    expect((adapter as any).nes.rom.subMapper).toBe(1);
    // Write 0x02 to select 32KB bank 2 when memory currently holds 0x00
    (adapter as any).nes.mmap.write(0x8000, 0x02);
    // Bus conflict disabled -> bank 2 selected, cpu.mem[0x8000] becomes 0x55
    expect((adapter as any).nes.cpu.mem[0x8000]).toBe(0x55);

    // Submapper 0 (default): WITH bus conflicts
    fullRom[8] = 0x00;
    (adapter as any).nes.loadROM(fullRom);
    expect((adapter as any).nes.rom.subMapper).toBe(0);
    // Write 0x02 when memory holds 0x00 -> 0x02 & 0x00 = 0x00 -> bank 0 selected
    (adapter as any).nes.mmap.write(0x8000, 0x02);
    expect((adapter as any).nes.cpu.mem[0x8000]).toBe(0x00);

    // Submapper 2 (AMROM/AOROM): WITH bus conflicts
    fullRom[8] = 0x20;
    (adapter as any).nes.loadROM(fullRom);
    expect((adapter as any).nes.rom.subMapper).toBe(2);
    (adapter as any).nes.mmap.write(0x8000, 0x02);
    expect((adapter as any).nes.cpu.mem[0x8000]).toBe(0x00);
  });
});
