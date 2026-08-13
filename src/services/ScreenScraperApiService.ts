/**
 * ScreenScraperApiService — fetches game cover art and metadata from ScreenScraper
 * (https://api.screenscraper.fr/api2/jeuInfos.php) without credentials.
 * Automatically saves results into the local SQLite/IndexedDB database.
 */
import { Crc32Service } from "./Crc32Service";
import { gameDatabaseService, IgdbGameMetadata } from "./GameDatabaseService";
import { extractCleanRomTitle } from "../emulator/RomTitleExtractor";

export class ScreenScraperApiService {
  /**
   * Returns cached metadata if present, or queries ScreenScraper API using ROM CRC32 & filename.
   */
  public async getOrFetchMetadata(
    gameName: string,
    consoleId: string,
    romFilename: string,
    romData?: Uint8Array
  ): Promise<IgdbGameMetadata | null> {
    // 1. Check local DB cache first
    const cached = await gameDatabaseService.getGame(romFilename, consoleId);
    if (cached && cached.coverUrl) {
      return cached;
    }

    // 2. Calculate CRC32 checksum if ROM data is present
    let crc = "";
    if (romData && romData.length > 0) {
      crc = Crc32Service.calculate(romData);
    }

    // 3. Query ScreenScraper API
    const fetched = await this.fetchFromScreenScraper(gameName, consoleId, romFilename, crc);
    if (fetched) {
      await gameDatabaseService.saveGame(fetched);
      return fetched;
    }

    return null;
  }

  /**
   * Direct fetch from ScreenScraper API using CRC and ROM filename.
   */
  public async fetchFromScreenScraper(
    gameName: string,
    consoleId: string,
    romFilename: string,
    crc: string
  ): Promise<IgdbGameMetadata | null> {
    try {
      const cleanRomName = romFilename.split("/").pop() ?? romFilename;
      const cleanTitle = extractCleanRomTitle(romFilename || gameName);
      const url = `https://api.screenscraper.fr/api2/jeuInfos.php?crc=${crc}&romnom=${encodeURIComponent(cleanRomName)}&output=json`;

      const response = await fetch(url);
      if (!response.ok) return null;

      const text = await response.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {
        return null;
      }

      const jeu = data?.response?.jeu;
      if (!jeu) return null;

      // Extract Cover URL (prefer box-2d, media-box-2d, box-3d, or box)
      let coverUrl = "";
      const medias = jeu.medias || [];
      if (Array.isArray(medias)) {
        const coverMedia =
          medias.find(
            (m: any) =>
              (m.type === "box-2d" || m.type === "media-box-2d") &&
              (m.region === "eu" || m.region === "us" || m.region === "wor" || m.region === "fr")
          ) ||
          medias.find((m: any) => m.type === "box-2d" || m.type === "media-box-2d") ||
          medias.find((m: any) => m.type === "box-3d") ||
          medias.find((m: any) => m.type === "box" || m.type === "cover") ||
          medias[0];
        if (coverMedia?.url) {
          coverUrl = coverMedia.url;
        }
      }

      // Extract Synopsis / Summary
      let summary = "";
      if (Array.isArray(jeu.synopsis)) {
        const synObj =
          jeu.synopsis.find((s: any) => s.langue === "fr") ||
          jeu.synopsis.find((s: any) => s.langue === "en") ||
          jeu.synopsis[0];
        if (synObj?.texte) {
          summary = synObj.texte;
        }
      }

      // Extract Developer / Publisher
      const devText = typeof jeu.developpeur === "object" ? jeu.developpeur?.text : jeu.developpeur;
      const editeurText = typeof jeu.editeur === "object" ? jeu.editeur?.text : jeu.editeur;
      const developer = devText || editeurText || "";

      // Extract Rating
      let rating = 0;
      const noteObj = jeu.note;
      if (noteObj) {
        const valStr = typeof noteObj === "object" ? noteObj.text || noteObj.note : String(noteObj);
        const parsed = parseFloat(valStr);
        if (!isNaN(parsed)) {
          rating = Math.round(parsed <= 20 ? (parsed / 20) * 100 : parsed);
        }
      }

      // Extract Genres
      const genres: string[] = [];
      if (Array.isArray(jeu.genres)) {
        for (const g of jeu.genres) {
          if (Array.isArray(g.noms)) {
            const gNom = g.noms.find((n: any) => n.langue === "fr") || g.noms[0];
            if (gNom?.texte) genres.push(gNom.texte);
          } else if (typeof g.nom === "string") {
            genres.push(g.nom);
          }
        }
      }

      // Extract Release Date
      let releaseDate = "";
      if (Array.isArray(jeu.dates)) {
        const dateObj =
          jeu.dates.find((d: any) => d.region === "eu" || d.region === "us") || jeu.dates[0];
        if (dateObj?.date) {
          releaseDate = dateObj.date;
        }
      }

      const metadata: IgdbGameMetadata = {
        romFilename,
        consoleId,
        title: cleanTitle || gameName,
        coverUrl,
        screenshots: [],
        genres,
        rating,
        summary,
        developer,
        releaseDate,
        updatedAt: new Date().toISOString(),
      };

      return metadata;
    } catch (err) {
      console.warn("[ScreenScraper] API request failed:", err);
      return null;
    }
  }
}

export const screenScraperApiService = new ScreenScraperApiService();
