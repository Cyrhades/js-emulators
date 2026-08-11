/**
 * GameDatabaseService — SQLite / IndexedDB local database service for caching IGDB game metadata
 */

export interface IgdbGameMetadata {
  id?: number;
  romFilename: string;
  consoleId: string;
  title: string;
  coverUrl: string;
  screenshots: string[];
  genres: string[];
  rating: number; // e.g. 85 / 100
  summary: string;
  developer: string;
  releaseDate: string;
  updatedAt: string;
}

const DB_NAME = "RetroHub_SQLite_GameMetadata";
const STORE_NAME = "game_metadata";
const DB_VERSION = 1;

export class GameDatabaseService {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === "undefined") {
        reject(new Error("IndexedDB non supporté par l'environnement."));
        return;
      }

      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (e) => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, {
            keyPath: ["consoleId", "romFilename"],
          });
          store.createIndex("consoleId", "consoleId", { unique: false });
          store.createIndex("title", "title", { unique: false });
        }
      };

      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    return this.dbPromise;
  }

  public async saveGame(metadata: IgdbGameMetadata): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const record = {
          ...metadata,
          updatedAt: new Date().toISOString(),
        };
        const req = store.put(record);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      // LocalStorage fallback if IndexedDB fails
      this.saveToLocalStorageFallback(metadata);
    }
  }

  public async getGame(romFilename: string, consoleId: string): Promise<IgdbGameMetadata | null> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.get([consoleId, romFilename]);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return this.getFromLocalStorageFallback(romFilename, consoleId);
    }
  }

  public async getGamesForConsole(consoleId: string): Promise<IgdbGameMetadata[]> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const index = store.index("consoleId");
        const req = index.getAll(consoleId);
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return [];
    }
  }

  public async getAllGames(): Promise<IgdbGameMetadata[]> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return [];
    }
  }

  public async countGames(): Promise<number> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.count();
        req.onsuccess = () => resolve(req.result || 0);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return 0;
    }
  }

  public async clearDatabase(): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      localStorage.removeItem("retro_hub_sqlite_fallback");
    }
  }

  // --- LocalStorage Fallback Methods ---
  private saveToLocalStorageFallback(metadata: IgdbGameMetadata): void {
    try {
      const key = `sqlite_fallback_${metadata.consoleId}_${metadata.romFilename}`;
      localStorage.setItem(key, JSON.stringify(metadata));
    } catch {
      // ignore
    }
  }

  private getFromLocalStorageFallback(romFilename: string, consoleId: string): IgdbGameMetadata | null {
    try {
      const key = `sqlite_fallback_${consoleId}_${romFilename}`;
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch {
      return null;
    }
  }
}

export const gameDatabaseService = new GameDatabaseService();
