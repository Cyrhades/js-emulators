/**
 * StoragePathService — persists configurable file/folder paths in localStorage.
 * 
 * Keys stored:
 *  - "config_path"       → folder/file where controllers.json lives (default: /config/controllers.json)
 *  - "roms_{consoleId}"  → ROM folder path per console (default: /emulators/{consoleId}/roms)
 */

const STORAGE_KEY = "retro_hub_storage_paths";

export interface StoragePaths {
  config_path: string;
  [key: string]: string; // roms_atari2600, roms_nes, ...
}

export const DEFAULT_CONFIG_PATH = "/config/controllers.json";

export function getRomKey(consoleId: string): string {
  return `roms_${consoleId}`;
}

export function getDefaultPath(key: string): string {
  if (key === "config_path") return DEFAULT_CONFIG_PATH;
  const consoleId = key.replace("roms_", "");
  return `/emulators/${consoleId}/roms`;
}

export class StoragePathService {
  private paths: StoragePaths;

  constructor() {
    this.paths = this.load();
  }

  private load(): StoragePaths {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore
    }
    return { config_path: DEFAULT_CONFIG_PATH };
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.paths));
    } catch {
      // ignore
    }
  }

  public getAll(): StoragePaths {
    return { ...this.paths };
  }

  public get(key: string): string {
    return this.paths[key] ?? getDefaultPath(key);
  }

  public set(key: string, value: string): void {
    this.paths[key] = value;
    this.save();
  }

  public reset(key: string): string {
    const defaultVal = getDefaultPath(key);
    this.paths[key] = defaultVal;
    this.save();
    return defaultVal;
  }
}

export const storagePathService = new StoragePathService();
