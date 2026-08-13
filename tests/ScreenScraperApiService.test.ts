import { describe, it, expect, vi, beforeEach } from "vitest";
import { Crc32Service } from "../src/services/Crc32Service";
import { ScreenScraperApiService } from "../src/services/ScreenScraperApiService";

describe("Crc32Service", () => {
  it("should calculate correct CRC32 for empty buffer", () => {
    expect(Crc32Service.calculate(new Uint8Array([]))).toBe("");
  });

  it("should calculate correct CRC32 for known byte sequence", () => {
    // "123456789" ASCII bytes -> standard CRC32 is CBF43926
    const encoder = new TextEncoder();
    const data = encoder.encode("123456789");
    const crc = Crc32Service.calculate(data);
    expect(crc).toBe("CBF43926");
  });
});

describe("ScreenScraperApiService", () => {
  let service: ScreenScraperApiService;

  beforeEach(() => {
    service = new ScreenScraperApiService();
  });

  it("should parse ScreenScraper JSON response correctly", async () => {
    const mockJson = {
      response: {
        jeu: {
          noms: [{ region: "eu", nom: "Sonic The Hedgehog" }],
          synopsis: [{ langue: "fr", texte: "Un jeu de plateforme culte." }],
          medias: [
            { type: "box-2d", region: "eu", url: "https://screenscraper.fr/cover.png" }
          ],
          developpeur: { text: "SEGA" },
          note: { text: "18" },
          genres: [{ noms: [{ langue: "fr", texte: "Plateforme" }] }],
          dates: [{ region: "eu", date: "1991" }]
        }
      }
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(mockJson)),
    } as any);

    const result = await service.fetchFromScreenScraper("Sonic", "sms", "Sonic (EU).sms", "A1B2C3D4");

    expect(result).not.toBeNull();
    expect(result?.title).toBe("Sonic");
    expect(result?.coverUrl).toBe("https://screenscraper.fr/cover.png");
    expect(result?.summary).toBe("Un jeu de plateforme culte.");
    expect(result?.developer).toBe("SEGA");
    expect(result?.rating).toBe(90); // 18/20 = 90%
    expect(result?.genres).toContain("Plateforme");
    expect(result?.releaseDate).toBe("1991");
  });

  it("should return null gracefully if API returns invalid JSON or HTTP error", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      text: () => Promise.resolve("Internal Error"),
    } as any);

    const result = await service.fetchFromScreenScraper("Unknown Game", "sms", "unknown.sms", "00000000");
    expect(result).toBeNull();
  });
});
