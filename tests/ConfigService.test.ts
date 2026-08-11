import { describe, it, expect, beforeEach } from "vitest";
import { ConfigService } from "../src/services/ConfigService";

describe("ConfigService", () => {
  let service: ConfigService;

  beforeEach(() => {
    if (typeof localStorage !== "undefined") {
      localStorage.clear();
    }
    service = new ConfigService();
  });

  it("should return default console configuration", () => {
    const config = service.getConsoleConfig("atari2600");
    expect(config).toBeDefined();
    expect(config.playerCount).toBeGreaterThanOrEqual(1);
  });

  it("should update player count for a console", () => {
    service.updateConsolePlayerCount("nes", 4);
    const config = service.getConsoleConfig("nes");
    expect(config.playerCount).toBe(4);
  });

  it("should update key binding for a player and console", () => {
    service.updateBinding("nes", 1, "a", "KeyK");
    const config = service.getConsoleConfig("nes");
    expect(config.players["1"]["a"]).toBe("KeyK");
  });

  it("should export valid JSON configuration", () => {
    const jsonString = service.exportJson();
    expect(jsonString).toContain("version");
    expect(jsonString).toContain("consoles");
  });
});
