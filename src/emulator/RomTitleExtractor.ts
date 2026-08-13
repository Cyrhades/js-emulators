/**
 * RomTitleExtractor — Utility for cleaning and extracting official game titles
 * from raw ROM filenames, ZIP archive names, or cartridge headers.
 */

export function extractCleanRomTitle(rawName: string): string {
  if (!rawName) return "";

  // 1. Remove path if present
  let title = rawName.split("/").pop()?.split("\\").pop() ?? rawName;

  // 2. Remove common ROM & archive extensions (.zip, .nes, .sfc, .smc, .gb, .md, .gen, .sms, .gg, .bin, .a26)
  title = title.replace(/\.(zip|nes|sfc|smc|gb|md|gen|sms|gg|bin|a26)$/gi, "");

  // If filename had nested extension (e.g. game.nes.zip), strip second extension
  title = title.replace(/\.(nes|sfc|smc|gb|md|gen|sms|gg|bin|a26)$/gi, "");

  // 3. Remove parenthetical tags e.g. (USA, Europe, Brazil), (En), (Rev 1), (PAL), (NTSC), (Japan), (FR)
  title = title.replace(/\([^)]*\)/g, "");

  // 4. Remove bracket tags e.g. [!], [b1], [h1], [t1], [a1]
  title = title.replace(/\[[^\]]*\]/g, "");

  // 5. Replace dots, underscores, and asterisks with spaces
  title = title.replace(/[._*]/g, " ");

  // 6. Clean up multiple spaces and trim
  title = title.replace(/\s+/g, " ").trim();

  return title;
}
