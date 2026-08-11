/**
 * RomScannerService — scans ROM folders via the File System Access API
 * and registers found ROMs into the GameLibrary.
 *
 * Handles persist a FileSystemDirectoryHandle per console in IndexedDB,
 * so the user only needs to grant access once per session.
 */
import JSZip from "jszip";
import { gameLibrary } from "../emulator/GameLibrary";
import { consoleRegistry } from "../emulator/ConsoleRegistry";
import { GameDefinition } from "../emulator/types";

const IDB_NAME = "RetroHub_RomFolders";
const IDB_STORE = "dir_handles";
const IDB_VERSION = 1;

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(IDB_STORE)) {
        req.result.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveHandle(consoleId: string, handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(handle, consoleId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadHandle(consoleId: string): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get(consoleId);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function clearHandle(consoleId: string): Promise<void> {
  try {
    const db = await openIDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).delete(consoleId);
      tx.oncomplete = () => resolve();
    });
  } catch {
    // ignore
  }
}

async function verifyPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  try {
    const h = handle as any;
    const opts = { mode: "read" };
    const state = await h.queryPermission(opts);
    if (state === "granted") return true;
    const requested = await h.requestPermission(opts);
    return requested === "granted";
  } catch {
    return false;
  }
}

export interface ScanResult {
  consoleId: string;
  count: number;
  folderName: string;
  games: GameDefinition[];
  newlyDiscoveredCount: number;
}

export class RomScannerService {
  /**
   * Let user pick a ROMs directory for a given console via the File System Access API.
   * Saves the handle persistently and immediately scans ROMs.
   */
  public async pickAndScanDirectory(consoleId: string): Promise<ScanResult | null> {
    const consoleDef = consoleRegistry.getConsole(consoleId);
    if (!consoleDef) return null;

    try {
      // Prompt user to select folder
      const handle: FileSystemDirectoryHandle = await (window as any).showDirectoryPicker({
        id: `roms_${consoleId}`,
        mode: "read",
        startIn: "documents",
      });

      await saveHandle(consoleId, handle);
      const result = await this.scanDirectory(consoleId, handle);
      return { ...result, folderName: handle.name };
    } catch (err: any) {
      if (err?.name === "AbortError") {
        return null; // User cancelled
      }
      throw err;
    }
  }

  /**
   * Restore previously granted directory handles and scan ROMs for all consoles.
   * Call this on app startup.
   */
  public async restoreAndScanAll(): Promise<void> {
    const consoles = consoleRegistry.getAllConsoles();
    await Promise.all(
      consoles.map(async (c) => {
        try {
          const handle = await loadHandle(c.id);
          if (!handle) return;
          const hasPermission = await verifyPermission(handle);
          if (hasPermission) {
            await this.scanDirectory(c.id, handle);
          } else {
            console.warn(`[RomScanner] Permission revoked for ${c.id}, clearing stored handle.`);
            await clearHandle(c.id);
          }
        } catch {
          // ignore per-console errors
        }
      })
    );
  }

  /**
   * Scans a directory handle and registers found ROM files in the GameLibrary.
   * Accepts native ROM files AND .zip archives containing ROMs.
   * Recursively traverses subdirectories so organized ROM folders are fully discovered.
   */
  public async scanDirectory(consoleId: string, handle: FileSystemDirectoryHandle): Promise<ScanResult> {
    const consoleDef = consoleRegistry.getConsole(consoleId);
    const supportedExts = consoleDef?.supportedRomExtensions ?? [];
    
    const newlyDiscoveredCount = await this.processDirectoryHandle(
      consoleId,
      handle,
      supportedExts
    );

    const allConsoleGames = gameLibrary.getGamesForConsole(consoleId);

    return {
      consoleId,
      count: allConsoleGames.length,
      folderName: handle.name,
      games: allConsoleGames,
      newlyDiscoveredCount,
    };
  }

  /**
   * Helper function to recursively scan a directory handle and its subdirectories.
   */
  private async processDirectoryHandle(
    consoleId: string,
    dirHandle: FileSystemDirectoryHandle,
    supportedExts: string[],
    pathPrefix: string = ""
  ): Promise<number> {
    let newlyDiscoveredCount = 0;

    for await (const [, entry] of (dirHandle as any).entries()) {
      if (entry.kind === "directory") {
        // Recursive traversal into subdirectories
        const subCount = await this.processDirectoryHandle(
          consoleId,
          entry as FileSystemDirectoryHandle,
          supportedExts,
          pathPrefix ? `${pathPrefix}/${entry.name}` : entry.name
        );
        newlyDiscoveredCount += subCount;
        continue;
      }

      if (entry.kind !== "file") continue;

      const name: string = entry.name;
      const relativePath = pathPrefix ? `${pathPrefix}/${name}` : name;
      const ext = "." + name.split(".").pop()?.toLowerCase();

      if (ext === ".zip") {
        // Extract ZIP and look for ROMs inside
        const zipGames = await this.extractRomsFromZip(name, consoleId, entry, supportedExts);
        for (const g of zipGames) {
          if (!gameLibrary.getGame(g.id)) {
            gameLibrary.addGame(g);
            newlyDiscoveredCount++;
          }
        }
        continue;
      }

      if (!supportedExts.includes(ext)) continue;

      const file: File = await entry.getFile();
      const buffer = await file.arrayBuffer();
      const gameId = `rom-${consoleId}-${relativePath.replace(/[^a-zA-Z0-9]/g, "_")}`;

      if (!gameLibrary.getGame(gameId)) {
        const game: GameDefinition = {
          id: gameId,
          name: name.replace(/\.[^/.]+$/, ""),
          consoleId,
          description: pathPrefix
            ? `Dossier: ${pathPrefix} (${(file.size / 1024).toFixed(1)} Ko)`
            : `ROM locale (${(file.size / 1024).toFixed(1)} Ko)`,
          filename: relativePath,
          romData: new Uint8Array(buffer),
        };
        gameLibrary.addGame(game);
        newlyDiscoveredCount++;
      }
    }

    return newlyDiscoveredCount;
  }

  /**
   * Extracts ROM files from a .zip archive entry.
   */
  private async extractRomsFromZip(
    zipName: string,
    consoleId: string,
    entry: any,
    supportedExts: string[]
  ): Promise<GameDefinition[]> {
    const games: GameDefinition[] = [];

    try {
      const file: File = await entry.getFile();
      const buffer = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(buffer);

      const romFiles = Object.values(zip.files).filter((f) => {
        if (f.dir) return false;
        const innerExt = "." + f.name.split(".").pop()?.toLowerCase();
        return supportedExts.includes(innerExt);
      });

      for (const romFile of romFiles) {
        const innerBuffer = await romFile.async("arraybuffer");
        const innerName = romFile.name.split("/").pop() ?? romFile.name;
        const gameId = `rom-${consoleId}-zip-${innerName.replace(/[^a-zA-Z0-9]/g, "_")}`;

        games.push({
          id: gameId,
          name: innerName.replace(/\.[^/.]+$/, ""),
          consoleId,
          description: `ROM extraite depuis ${zipName} (${(innerBuffer.byteLength / 1024).toFixed(1)} Ko)`,
          filename: innerName,
          romData: new Uint8Array(innerBuffer),
        });
      }
    } catch (err) {
      console.warn(`[RomScanner] Failed to read ZIP: ${zipName}`, err);
    }

    return games;
  }

  /**
   * Returns whether a handle is stored for the given console.
   */
  public async hasStoredHandle(consoleId: string): Promise<boolean> {
    const h = await loadHandle(consoleId);
    return h !== null;
  }

  /**
   * Clears the stored directory handle for a console.
   */
  public async clearStoredHandle(consoleId: string): Promise<void> {
    await clearHandle(consoleId);
  }
}

export const romScannerService = new RomScannerService();
