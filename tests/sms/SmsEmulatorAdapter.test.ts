import { describe, it, expect, beforeEach } from "vitest";
import { SmsEmulatorAdapter } from "../../emulators/sms/src/SmsEmulatorAdapter";
import { smsDefinition } from "../../emulators/sms/src/SmsDefinition";
import { consoleRegistry } from "../../src/emulator/ConsoleRegistry";
import { initConsoleRegistry } from "../../src/emulator/initRegistry";

function createDummySmsRom(size: number = 32768): Uint8Array {
  const rom = new Uint8Array(size);
  // Z80 DI (0xF3) / NOP (0x00)
  for (let i = 0; i < size; i++) {
    rom[i] = 0x00;
  }
  return rom;
}

describe("SmsEmulatorAdapter", () => {
  let adapter: SmsEmulatorAdapter;

  beforeEach(() => {
    adapter = new SmsEmulatorAdapter();
  });

  it("should have correct id and name", () => {
    expect(adapter.id).toBe("sms");
    expect(adapter.name).toBe("Sega Master System");
  });

  it("should export a valid ConsoleDefinition", () => {
    expect(smsDefinition.id).toBe("sms");
    expect(smsDefinition.isAvailable).toBe(true);
    expect(smsDefinition.supportedRomExtensions).toContain(".sms");
  });

  it("should register Master System in ConsoleRegistry via initConsoleRegistry", () => {
    initConsoleRegistry();
    const sms = consoleRegistry.getConsole("sms");
    expect(sms).toBeDefined();
    expect(sms?.isAvailable).toBe(true);
  });

  it("should load a valid SMS ROM", async () => {
    const rom = createDummySmsRom();
    await expect(adapter.loadRom(rom)).resolves.not.toThrow();
  });

  it("should return valid 256x192 video output specification", () => {
    const video = adapter.getVideoOutput();
    expect(video.width).toBe(256);
    expect(video.height).toBe(192);
    expect(video.buffer.length).toBe(256 * 192 * 4);
  });

  it("should handle start, pause, resume, and stop loop states", async () => {
    const rom = createDummySmsRom();
    await adapter.loadRom(rom);

    adapter.start();
    adapter.pause();
    adapter.resume();
    adapter.stop();
  });

  it("should handle controller inputs without errors", () => {
    adapter.handleInput({
      buttons: {
        up: true,
        button1: true,
        pause: true,
      },
    });
  });

  it("should support Game Genie code management", () => {
    expect(adapter.gameGenie).toBeDefined();
    expect(adapter.gameGenie?.isGameGenieEnabled()).toBe(true);

    const added = adapter.gameGenie?.addGameGenieCode("00C0-8805", "Infinite Lives");
    expect(added).toBe(true);
    expect(adapter.gameGenie?.getGameGenieCodes().length).toBe(1);

    adapter.gameGenie?.setGameGenieEnabled(false);
    expect(adapter.gameGenie?.isGameGenieEnabled()).toBe(false);

    adapter.gameGenie?.clearGameGenieCodes();
    expect(adapter.gameGenie?.getGameGenieCodes().length).toBe(0);
  });

  it("should configure audio enhancement and match sample rate", async () => {
    const rom = createDummySmsRom();
    await adapter.loadRom(rom);
    const audio = adapter.getAudioOutput();
    if (audio) {
      expect(typeof audio.sampleRate).toBe("number");
      expect(audio.sampleRate).toBeGreaterThan(0);
    }
  });
});
