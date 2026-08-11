import { describe, it, expect, beforeEach } from "vitest";
import { NesEmulatorAdapter } from "../../emulators/nes/src/NesEmulatorAdapter";
import NES from "../../emulators/nes/src/nes.js";

// Helper to construct a minimal NES ROM with battery RAM enabled (Mapper 1 / MMC1 like Zelda)
function createBatteryRamNesRom(): Uint8Array {
  const header = new Uint8Array(16);
  header[0] = 0x4e; // 'N'
  header[1] = 0x45; // 'E'
  header[2] = 0x53; // 'S'
  header[3] = 0x1a; // MS-DOS EOF
  header[4] = 8;    // 8 x 16KB PRG ROM (128KB, like Zelda)
  header[5] = 0;    // 0 CHR ROM (uses CHR RAM)
  header[6] = 0x12; // Mapper 1 (MMC1: 0x10) + Battery-backed RAM (0x02)
  header[7] = 0x00;

  const prgRom = new Uint8Array(8 * 16384);
  // Simple loop at 0xC000
  prgRom[0] = 0xea; // NOP
  prgRom[1] = 0x60; // RTS
  // Reset vector pointing to 0xC000
  prgRom[prgRom.length - 4] = 0x00;
  prgRom[prgRom.length - 3] = 0xc0;

  const fullRom = new Uint8Array(16 + prgRom.length);
  fullRom.set(header, 0);
  fullRom.set(prgRom, 16);

  return fullRom;
}

describe("NES Battery RAM (SRAM / EEPROM) Emulation", () => {
  let nes: NES;
  let adapter: NesEmulatorAdapter;

  beforeEach(() => {
    nes = new NES({});
    adapter = new NesEmulatorAdapter();
    if (typeof localStorage !== "undefined") {
      localStorage.clear();
    }
  });

  it("should detect battery RAM flag from iNES header", () => {
    const romData = createBatteryRamNesRom();
    nes.loadROM(romData);

    expect(nes.rom.batteryRam).toBe(true);
    expect(nes.rom.batteryRamData).toBeDefined();
    expect(nes.rom.batteryRamData?.length).toBe(8192);
  });

  it("should allow reading and writing to cartridge SRAM ($6000-$7FFF)", () => {
    const romData = createBatteryRamNesRom();
    nes.loadROM(romData);

    // Write magic signature to SRAM ($6000)
    nes.mmap.write(0x6000, 0x5a);
    nes.mmap.write(0x6001, 0xef);
    nes.mmap.write(0x7fff, 0x42);

    expect(nes.mmap.load(0x6000)).toBe(0x5a);
    expect(nes.mmap.load(0x6001)).toBe(0xef);
    expect(nes.mmap.load(0x7fff)).toBe(0x42);

    const saveData = nes.getSaveData();
    expect(saveData).not.toBeNull();
    expect(saveData![0]).toBe(0x5a);
    expect(saveData![1]).toBe(0xef);
    expect(saveData![8191]).toBe(0x42);
  });

  it("should restore save data when loadSaveData is called", () => {
    const romData = createBatteryRamNesRom();
    nes.loadROM(romData);

    const customSave = new Uint8Array(8192);
    customSave[0] = 0xde;
    customSave[1] = 0xad;
    customSave[2] = 0xbe;
    customSave[3] = 0xef;

    nes.loadSaveData(customSave);

    expect(nes.mmap.load(0x6000)).toBe(0xde);
    expect(nes.mmap.load(0x6001)).toBe(0xad);
    expect(nes.mmap.load(0x6002)).toBe(0xbe);
    expect(nes.mmap.load(0x6003)).toBe(0xef);
  });

  it("should automatically save and load battery RAM in NesEmulatorAdapter via localStorage", async () => {
    const romData = createBatteryRamNesRom();
    adapter.setGameId("zelda_test_game_123");
    await adapter.loadRom(romData);

    expect(adapter.saveData.hasSaveData()).toBe(true);

    // Simulate writing save data in Zelda
    const testSave = new Uint8Array(8192);
    testSave[0] = 0xaa;
    testSave[100] = 0xbb;
    testSave[8191] = 0xcc;

    adapter.saveData.loadSaveData(testSave);

    // Create a new adapter instance to simulate reloading the game session
    const newAdapter = new NesEmulatorAdapter();
    newAdapter.setGameId("zelda_test_game_123");
    await newAdapter.loadRom(romData);

    const restored = newAdapter.saveData.getSaveData();
    expect(restored).not.toBeNull();
    expect(restored![0]).toBe(0xaa);
    expect(restored![100]).toBe(0xbb);
    expect(restored![8191]).toBe(0xcc);
  });

  it("should export and import .sav file data correctly", async () => {
    const romData = createBatteryRamNesRom();
    adapter.setGameId("zelda_test_export");
    await adapter.loadRom(romData);

    const mockSave = new Uint8Array(8192);
    for (let i = 0; i < 8192; i++) {
      mockSave[i] = i & 0xff;
    }

    adapter.saveData.importSaveFile?.(mockSave);

    const exported = adapter.saveData.exportSaveFile?.();
    expect(exported).not.toBeNull();
    expect(exported?.length).toBe(8192);
    expect(exported![0]).toBe(0);
    expect(exported![255]).toBe(255);
    expect(exported![256]).toBe(0);
  });
});
