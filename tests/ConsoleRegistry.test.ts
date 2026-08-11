import { describe, it, expect, beforeEach } from "vitest";
import { ConsoleRegistry } from "../src/emulator/ConsoleRegistry";
import { ConsoleDefinition } from "../src/emulator/types";

describe("ConsoleRegistry", () => {
  let registry: ConsoleRegistry;

  const mockConsole: ConsoleDefinition = {
    id: "test-console",
    name: "Test Console",
    manufacturer: "TestCorp",
    isAvailable: true,
    supportedRomExtensions: [".bin"],
    controls: { name: "Test Controller", bindings: [] },
    createEmulator: () => ({} as any),
  };

  beforeEach(() => {
    registry = new ConsoleRegistry();
  });

  it("should register and retrieve a console", () => {
    registry.register(mockConsole);
    expect(registry.getConsole("test-console")).toEqual(mockConsole);
  });

  it("should list registered consoles", () => {
    registry.register(mockConsole);
    expect(registry.getAllConsoles()).toHaveLength(1);
    expect(registry.getAvailableConsoles()).toHaveLength(1);
  });

  it("should unregister a console", () => {
    registry.register(mockConsole);
    expect(registry.unregister("test-console")).toBe(true);
    expect(registry.getConsole("test-console")).toBeUndefined();
  });
});
