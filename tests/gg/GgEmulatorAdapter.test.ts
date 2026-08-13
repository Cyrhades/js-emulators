import { describe, it, expect, beforeEach } from "vitest";
import { GgEmulatorAdapter } from "../../emulators/gg/src/GgEmulatorAdapter";
import { ggDefinition } from "../../emulators/gg/src/GgDefinition";
import { consoleRegistry } from "../../src/emulator/ConsoleRegistry";
import { initConsoleRegistry } from "../../src/emulator/initRegistry";

function createDummyGgRom(size: number = 32768): Uint8Array {
  const rom = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    rom[i] = 0x00;
  }
  return rom;
}

describe("GgEmulatorAdapter", () => {
  let adapter: GgEmulatorAdapter;

  beforeEach(() => {
    adapter = new GgEmulatorAdapter();
  });

  it("should have correct id and name", () => {
    expect(adapter.id).toBe("gg");
    expect(adapter.name).toBe("Sega Game Gear");
  });

  it("should export a valid ConsoleDefinition", () => {
    expect(ggDefinition.id).toBe("gg");
    expect(ggDefinition.isAvailable).toBe(true);
    expect(ggDefinition.supportedRomExtensions).toContain(".gg");
  });

  it("should register Game Gear in ConsoleRegistry via initConsoleRegistry", () => {
    initConsoleRegistry();
    const gg = consoleRegistry.getConsole("gg");
    expect(gg).toBeDefined();
    expect(gg?.isAvailable).toBe(true);
  });

  it("should load a valid Game Gear ROM", async () => {
    const rom = createDummyGgRom();
    await expect(adapter.loadRom(rom)).resolves.not.toThrow();
  });

  it("should return valid 160x144 viewport video output specification", () => {
    const video = adapter.getVideoOutput();
    expect(video.width).toBe(160);
    expect(video.height).toBe(144);
    expect(video.buffer.length).toBe(160 * 144 * 4);
  });

  it("should handle start, pause, resume, and stop loop states", async () => {
    const rom = createDummyGgRom();
    await adapter.loadRom(rom);

    adapter.start();
    adapter.pause();
    adapter.resume();
    adapter.stop();
  });

  it("should handle Game Gear inputs without errors", () => {
    adapter.handleInput({
      buttons: {
        up: true,
        button1: true,
        start: true,
      },
    });
  });

  it("should support Game Genie code management", () => {
    expect(adapter.gameGenie).toBeDefined();
    expect(adapter.gameGenie?.isGameGenieEnabled()).toBe(true);

    const added = adapter.gameGenie?.addGameGenieCode("00C0-8805", "Infinite Energy");
    expect(added).toBe(true);
    expect(adapter.gameGenie?.getGameGenieCodes().length).toBe(1);

    adapter.gameGenie?.setGameGenieEnabled(false);
    expect(adapter.gameGenie?.isGameGenieEnabled()).toBe(false);

    adapter.gameGenie?.clearGameGenieCodes();
    expect(adapter.gameGenie?.getGameGenieCodes().length).toBe(0);
  });
});
