import { describe, it, expect, beforeEach, vi } from "vitest";
import { EmulatorManager } from "../src/emulator/EmulatorManager";
import { ConsoleDefinition, Emulator, EmulatorStatus, GameDefinition } from "../src/emulator/types";

describe("EmulatorManager", () => {
  let manager: EmulatorManager;
  let mockEmulator: Emulator;
  let mockConsoleDef: ConsoleDefinition;
  let mockGame: GameDefinition;

  beforeEach(() => {
    manager = new EmulatorManager();
    mockEmulator = {
      id: "mock",
      name: "Mock Emulator",
      start: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      reset: vi.fn(),
      stop: vi.fn(),
      loadRom: vi.fn().mockResolvedValue(undefined),
      getVideoOutput: vi.fn(),
      getAudioOutput: vi.fn(),
      handleInput: vi.fn(),
    };

    mockConsoleDef = {
      id: "mock-console",
      name: "Mock Console",
      manufacturer: "Mock",
      isAvailable: true,
      supportedRomExtensions: [".bin"],
      controls: { name: "Mock", bindings: [] },
      createEmulator: () => mockEmulator,
    };

    mockGame = {
      id: "mock-game",
      name: "Mock Game",
      consoleId: "mock-console",
      romData: new Uint8Array([0x00, 0x01]),
    };
  });

  it("should initialize in Idle state", () => {
    expect(manager.getSession().status).toBe(EmulatorStatus.Idle);
  });

  it("should load game and start emulation", async () => {
    await manager.loadGame(mockConsoleDef, mockGame);
    const session = manager.getSession();

    expect(session.status).toBe(EmulatorStatus.Running);
    expect(mockEmulator.loadRom).toHaveBeenCalledWith(mockGame.romData);
    expect(mockEmulator.start).toHaveBeenCalled();
  });

  it("should pause and resume emulation", async () => {
    await manager.loadGame(mockConsoleDef, mockGame);

    manager.pause();
    expect(manager.getSession().status).toBe(EmulatorStatus.Paused);
    expect(mockEmulator.pause).toHaveBeenCalled();

    manager.resume();
    expect(manager.getSession().status).toBe(EmulatorStatus.Running);
    expect(mockEmulator.resume).toHaveBeenCalled();
  });

  it("should stop emulation session", async () => {
    await manager.loadGame(mockConsoleDef, mockGame);
    manager.stop();

    expect(manager.getSession().status).toBe(EmulatorStatus.Stopped);
    expect(mockEmulator.stop).toHaveBeenCalled();
  });
});
