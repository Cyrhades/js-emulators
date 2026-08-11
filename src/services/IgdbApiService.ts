import { igdbConfigService } from "./IgdbConfigService";
import { gameDatabaseService, IgdbGameMetadata } from "./GameDatabaseService";
import { extractCleanRomTitle } from "../emulator/RomTitleExtractor";

// Platform IDs for IGDB filtering (including regional variants like NES + Famicom)
const IGDB_PLATFORM_IDS: Record<string, string> = {
  nes: "18, 51, 63",       // NES, Famicom, Family Computer Disk System
  snes: "19, 58",          // SNES, Super Famicom
  gb: "33, 22",            // Game Boy, Game Boy Color
  md: "29",                // Sega Genesis / Mega Drive
  sms: "64",               // Sega Master System
  gg: "35",                // Sega Game Gear
  atari2600: "59",         // Atari 2600
};

export class IgdbApiService {
  private baseUrl = "/igdb-proxy/v4";
  private pendingSearches = new Map<string, Promise<IgdbGameMetadata | null>>();

  /**
   * Helper to perform IGDB API POST request via local Vite server proxy
   */
  private async postIgdb(endpoint: string, headers: Record<string, string>, body: string): Promise<any> {
    const targetUrl = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(targetUrl, {
        method: "POST",
        headers,
        body,
      });

      if (response.ok) {
        return await response.json();
      }
      console.warn(`[IGDB Proxy Status ${response.status}] Request returned non-200 status.`);
    } catch (err) {
      console.warn("[IGDB Proxy Fetch Error]", err);
    }

    return null;
  }

  /**
   * Get metadata for a game ROM, first checking local SQLite DB cache.
   * If not cached, fetches from IGDB API and stores in SQLite DB.
   */
  public async getOrFetchMetadata(
    gameName: string,
    consoleId: string,
    romFilename: string
  ): Promise<IgdbGameMetadata | null> {
    const key = `${consoleId}:${romFilename || gameName}`;

    // 1. Check local SQLite DB cache
    const cached = await gameDatabaseService.getGame(romFilename || gameName, consoleId);
    if (cached) {
      return cached;
    }

    // 2. Check if IGDB API is configured
    if (!igdbConfigService.isConfigured()) {
      return null;
    }

    // 3. De-duplicate in-flight requests
    if (this.pendingSearches.has(key)) {
      return this.pendingSearches.get(key)!;
    }

    const fetchPromise = (async () => {
      try {
        const metadata = await this.searchAndFetchGame(gameName, consoleId, romFilename);
        if (metadata) {
          await gameDatabaseService.saveGame(metadata);
          return metadata;
        } else {
          // Negative cache placeholder so un-matched games are not queried repeatedly
          const placeholder: IgdbGameMetadata = {
            romFilename: romFilename || gameName,
            consoleId,
            title: extractCleanRomTitle(romFilename || gameName),
            coverUrl: "",
            screenshots: [],
            genres: [],
            rating: 0,
            summary: "",
            developer: "",
            releaseDate: "",
            updatedAt: new Date().toISOString(),
          };
          await gameDatabaseService.saveGame(placeholder);
          return placeholder;
        }
      } catch (err) {
        console.error("IGDB API fetch failed:", err);
        return null;
      } finally {
        this.pendingSearches.delete(key);
      }
    })();

    this.pendingSearches.set(key, fetchPromise);
    return fetchPromise;
  }

  /**
   * Search game by clean name and platform IDs on IGDB API v4
   */
  public async searchAndFetchGame(
    gameName: string,
    consoleId: string,
    romFilename: string
  ): Promise<IgdbGameMetadata | null> {
    const creds = igdbConfigService.getCredentials();
    const token = await igdbConfigService.getValidAccessToken();

    if (!creds.clientId || !token) {
      return null;
    }

    // Extract clean game title from ROM / ZIP filename
    const cleanTitle = extractCleanRomTitle(romFilename || gameName);
    if (!cleanTitle) return null;

    const platformIds = IGDB_PLATFORM_IDS[consoleId];
       const headers = {
      "Client-ID": creds.clientId,
      Authorization: `Bearer ${token}`,
      "Content-Type": "text/plain",
      Accept: "application/json",
    };

    let gameData: any = null;

    // Pass 1: Platform-filtered search (NES / Famicom, SNES / Super Famicom, etc.)
    if (platformIds) {
      try {
        const platformBody = `
          search "${cleanTitle}";
          fields name, summary, rating, cover.url, screenshots.url, genres.name, involved_companies.company.name, first_release_date;
          where platforms = (${platformIds});
          limit 5;
        `;

        const pass1Result = await this.postIgdb("/games", headers, platformBody);
        if (Array.isArray(pass1Result) && pass1Result.length > 0) {
          gameData = pass1Result[0];
        }
      } catch (e) {
        console.warn("[IGDB Pass 1 Platform Filter Failed]", e);
      }
    }

    // Pass 2: Fallback search without platform constraint if Pass 1 gave no result
    if (!gameData) {
      try {
        const fallbackBody = `
          search "${cleanTitle}";
          fields name, summary, rating, cover.url, screenshots.url, genres.name, involved_companies.company.name, first_release_date;
          limit 5;
        `;

        const pass2Result = await this.postIgdb("/games", headers, fallbackBody);
        if (Array.isArray(pass2Result) && pass2Result.length > 0) {
          gameData = pass2Result[0];
          console.log(`[IGDB Global Match Pass 2] Found "${gameData.name}"`);
        }
      } catch (e) {
        console.warn("[IGDB Pass 2 Global Search Failed]", e);
      }
    }

    // Pass 3: Fallback via /search endpoint if still no match
    if (!gameData) {
      try {
        const searchEndpointBody = `
          search "${cleanTitle}";
          fields game.name, game.summary, game.rating, game.cover.url, game.screenshots.url, game.genres.name, game.involved_companies.company.name, game.first_release_date;
          limit 5;
        `;

        const pass3Result = await this.postIgdb("/search", headers, searchEndpointBody);
        if (Array.isArray(pass3Result) && pass3Result.length > 0) {
          const first = pass3Result[0];
          gameData = first.game || first;
        }
      } catch (e) {
        console.warn("[IGDB Pass 3 Search Endpoint Failed]", e);
      }
    }

    if (!gameData || !gameData.name) {
      return null;
    }

    // Format cover URL to high-res (t_cover_big)
    let coverUrl = gameData.cover?.url || "";
    if (coverUrl) {
      coverUrl = "https:" + coverUrl.replace("t_thumb", "t_cover_big");
    }

    // Format screenshots URLs (t_screenshot_big)
    const screenshots: string[] = (gameData.screenshots || []).map((s: any) =>
      s.url ? "https:" + s.url.replace("t_thumb", "t_screenshot_big") : ""
    ).filter(Boolean);

    // Extract genres
    const genres: string[] = (gameData.genres || []).map((g: any) => g.name).filter(Boolean);

    // Extract developer / publisher
    const developer =
      gameData.involved_companies?.[0]?.company?.name || "Éditeur inconnu";

    // Format release date
    let releaseDate = "Date inconnue";
    if (gameData.first_release_date) {
      releaseDate = new Date(gameData.first_release_date * 1000).getFullYear().toString();
    }

    const metadata: IgdbGameMetadata = {
      romFilename,
      consoleId,
      title: gameData.name || cleanTitle,
      coverUrl,
      screenshots,
      genres,
      rating: gameData.rating ? Math.round(gameData.rating) : 0,
      summary: gameData.summary || "Aucune description disponible.",
      developer,
      releaseDate,
      updatedAt: new Date().toISOString(),
    };
    
    return metadata;
  }
}

export const igdbApiService = new IgdbApiService();
