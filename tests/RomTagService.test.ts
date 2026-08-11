import { describe, it, expect } from "vitest";
import { romTagService } from "../src/services/RomTagService";

describe("RomTagService", () => {
  it("should detect NTSC-U region for USA games", () => {
    const tags = romTagService.detectTags("Super Mario Bros. (USA).nes", "nes");
    expect(tags.some((t) => t.label === "NTSC-U")).toBe(true);
  });

  it("should detect PAL region for European games", () => {
    const tags = romTagService.detectTags("Zelda (Europe) (En,Fr).sfc", "snes");
    expect(tags.some((t) => t.label === "PAL")).toBe(true);
  });

  it("should detect FAMICOM / NTSC-J region for Japanese NES games", () => {
    const tags = romTagService.detectTags("Rockman (Japan).nes", "nes");
    expect(tags.some((t) => t.label === "FAMICOM")).toBe(true);
  });

  it("should detect DEMO and GOOD DUMP special types", () => {
    const tags = romTagService.detectTags("Rainbow_Demo [!].bin", "atari2600");
    expect(tags.some((t) => t.label === "DEMO")).toBe(true);
    expect(tags.some((t) => t.label === "GOOD DUMP")).toBe(true);
  });
});
