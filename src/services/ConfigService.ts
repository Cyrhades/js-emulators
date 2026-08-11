import { inputManager } from "../emulator/InputManager";
import { consoleRegistry } from "../emulator/ConsoleRegistry";

export interface PlayerConfig {
  [actionId: string]: string; // e.g. "up": "ArrowUp"
}

export interface ConsoleControllerConfig {
  playerCount: number;
  maxPlayers: number;
  players: Record<string, PlayerConfig>; // "1", "2", "3", "4"
}

export interface GlobalControllersConfig {
  version: string;
  updatedAt: string;
  consoles: Record<string, ConsoleControllerConfig>;
}

const STORAGE_KEY = "retro_hub_controllers_config";

export class ConfigService {
  private config: GlobalControllersConfig | null = null;

  constructor() {
    this.loadFromStorage();
  }

  public async init(): Promise<GlobalControllersConfig> {
    if (this.config) return this.config;

    // Try loading from LocalStorage first
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        this.config = JSON.parse(saved);
        return this.config!;
      } catch (e) {
        // Fallback to fetch
      }
    }

    // Fetch initial config/controllers.json
    try {
      const res = await fetch("/config/controllers.json");
      if (res.ok) {
        this.config = await res.json();
        this.saveToStorage();
        return this.config!;
      }
    } catch (e) {
      // ignore
    }

    // Default fallback config
    this.config = {
      version: "1.0",
      updatedAt: new Date().toISOString(),
      consoles: {
        atari2600: {
          playerCount: 2,
          maxPlayers: 2,
          players: {
            "1": { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight", fire: "Space", reset: "KeyR", select: "KeyS" },
            "2": { up: "KeyI", down: "KeyK", left: "KeyJ", right: "KeyL", fire: "KeyF", reset: "KeyR", select: "KeyS" }
          }
        }
      }
    };
    this.saveToStorage();
    return this.config;
  }

  public getConfig(): GlobalControllersConfig {
    if (!this.config) {
      this.loadFromStorage();
    }
    if (!this.config) {
      this.config = {
        version: "1.0",
        updatedAt: new Date().toISOString(),
        consoles: {
          atari2600: {
            playerCount: 2,
            maxPlayers: 2,
            players: {
              "1": { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight", fire: "Space", reset: "KeyR", select: "KeyS" },
              "2": { up: "KeyI", down: "KeyK", left: "KeyJ", right: "KeyL", fire: "KeyF", reset: "KeyR", select: "KeyS" }
            }
          },
          nes: {
            playerCount: 2,
            maxPlayers: 4,
            players: {
              "1": { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight", a: "KeyX", b: "KeyZ", select: "ShiftLeft", start: "Enter" },
              "2": { up: "KeyI", down: "KeyK", left: "KeyJ", right: "KeyL", a: "KeyN", b: "KeyM", select: "KeyV", start: "KeyB" }
            }
          }
        }
      };
    }
    return this.config;
  }

  public getConsoleConfig(consoleId: string): ConsoleControllerConfig {
    const cfg = this.getConfig();
    const consoleDef = consoleRegistry.getConsole(consoleId);
    const maxPlayers = consoleDef?.maxPlayers ?? 4;

    if (!cfg.consoles[consoleId]) {
      cfg.consoles[consoleId] = {
        playerCount: maxPlayers,
        maxPlayers: maxPlayers,
        players: {
          "1": { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight", fire: "Space", reset: "KeyR", select: "KeyS", a: "KeyX", b: "KeyZ" },
          "2": { up: "KeyI", down: "KeyK", left: "KeyJ", right: "KeyL", fire: "KeyF", reset: "KeyR", select: "KeyS", a: "KeyN", b: "KeyM" }
        }
      };
    }

    cfg.consoles[consoleId].maxPlayers = maxPlayers;
    if (cfg.consoles[consoleId].playerCount > maxPlayers) {
      cfg.consoles[consoleId].playerCount = maxPlayers;
    }

    return cfg.consoles[consoleId];
  }

  public updateConsolePlayerCount(consoleId: string, count: number): void {
    const cfg = this.getConfig();
    const consoleDef = consoleRegistry.getConsole(consoleId);
    const maxPlayers = consoleDef?.maxPlayers ?? 4;
    const clampedCount = Math.min(count, maxPlayers);

    if (!cfg.consoles[consoleId]) {
      cfg.consoles[consoleId] = { playerCount: clampedCount, maxPlayers, players: {} };
    }
    cfg.consoles[consoleId].playerCount = clampedCount;
    cfg.consoles[consoleId].maxPlayers = maxPlayers;
    cfg.updatedAt = new Date().toISOString();
    this.saveToStorage();
  }

  public updatePlayerGamepadIndex(consoleId: string, playerNum: number, gamepadIndex: number | null): void {
    const cfg = this.getConfig();
    if (!cfg.consoles[consoleId]) {
      cfg.consoles[consoleId] = { playerCount: 2, maxPlayers: 4, players: {} };
    }
    if (!cfg.consoles[consoleId].players[playerNum.toString()]) {
      cfg.consoles[consoleId].players[playerNum.toString()] = {};
    }
    if (gamepadIndex === null) {
      delete cfg.consoles[consoleId].players[playerNum.toString()].gamepadIndex;
    } else {
      cfg.consoles[consoleId].players[playerNum.toString()].gamepadIndex = gamepadIndex.toString();
    }
    cfg.updatedAt = new Date().toISOString();
    this.saveToStorage();
  }

  public updateBinding(consoleId: string, playerNum: number, actionId: string, key: string): void {
    const cfg = this.getConfig();
    if (!cfg.consoles[consoleId]) {
      cfg.consoles[consoleId] = { playerCount: 2, maxPlayers: 4, players: {} };
    }
    if (!cfg.consoles[consoleId].players[playerNum.toString()]) {
      cfg.consoles[consoleId].players[playerNum.toString()] = {};
    }
    cfg.consoles[consoleId].players[playerNum.toString()][actionId] = key;
    cfg.updatedAt = new Date().toISOString();
    this.saveToStorage();
  }

  public resetConsoleDefaults(consoleId: string): void {
    const consoleDef = consoleRegistry.getConsole(consoleId);
    if (!consoleDef) return;

    const cfg = this.getConfig();
    const defaults1: PlayerConfig = {};
    const defaults2: PlayerConfig = {};

    consoleDef.controls.bindings.forEach((b) => {
      defaults1[b.id] = b.defaultKey;
      defaults2[b.id] = b.defaultKey;
    });

    cfg.consoles[consoleId] = {
      playerCount: consoleDef.maxPlayers ? Math.min(2, consoleDef.maxPlayers) : 2,
      maxPlayers: consoleDef.maxPlayers ?? 4,
      players: {
        "1": defaults1,
        "2": defaults2
      }
    };

    cfg.updatedAt = new Date().toISOString();
    this.saveToStorage();
  }
  
  public applyStandardGamepadBindings(consoleId: string, playerNum: number): void {
    const cfg = this.getConfig();
    if (!cfg.consoles[consoleId]) {
      cfg.consoles[consoleId] = { playerCount: 2, maxPlayers: 4, players: {} };
    }
    const playerKey = playerNum.toString();
    const existing = cfg.consoles[consoleId].players[playerKey] || {};

    cfg.consoles[consoleId].players[playerKey] = {
      ...existing,
      up: "Gamepad_Btn_12",
      down: "Gamepad_Btn_13",
      left: "Gamepad_Btn_14",
      right: "Gamepad_Btn_15",
      fire: "Gamepad_Btn_0",
      a: "Gamepad_Btn_0",
      b: "Gamepad_Btn_1",
      x: "Gamepad_Btn_2",
      y: "Gamepad_Btn_3",
      l: "Gamepad_Btn_4",
      r: "Gamepad_Btn_5",
      select: "Gamepad_Btn_8",
      start: "Gamepad_Btn_9",
      reset: "Gamepad_Btn_8"
    };

    cfg.updatedAt = new Date().toISOString();
    this.saveToStorage();

    const player1Config = cfg.consoles[consoleId].players["1"];
    if (player1Config) {
      inputManager.setCustomMapping(player1Config);
    }
  }

  public saveConfig(): void {
    const cfg = this.getConfig();
    cfg.updatedAt = new Date().toISOString();
    this.saveToStorage();
  }

  public exportJson(): string {
    return JSON.stringify(this.getConfig(), null, 2);
  }

  public downloadJson(): void {
    const jsonStr = this.exportJson();
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "controllers.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  public importJson(jsonString: string): boolean {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed && parsed.consoles) {
        this.config = parsed;
        this.saveToStorage();
        return true;
      }
    } catch (e) {
      // invalid JSON
    }
    return false;
  }

  private saveToStorage(): void {
    if (typeof localStorage !== "undefined" && this.config) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
    }
  }

  private loadFromStorage(): void {
    if (typeof localStorage !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          this.config = JSON.parse(saved);
        } catch (e) {
          this.config = null;
        }
      }
    }
  }
}

export const configService = new ConfigService();
