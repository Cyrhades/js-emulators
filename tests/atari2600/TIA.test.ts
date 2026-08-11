import { describe, it, expect, beforeEach } from "vitest";
import { TIA } from "../../emulators/atari2600/src/TIA";

describe("TIA (Television Interface Adaptor)", () => {
  let tia: TIA;

  beforeEach(() => {
    tia = new TIA();
  });

  it("should write and read TIA registers", () => {
    tia.write(0x09, 0x84); // COLUBK
    expect(tia.registers.COLUBK).toBe(0x84);
  });

  it("should generate 160x192 video frame buffer", () => {
    expect(tia.video.width).toBe(160);
    expect(tia.video.height).toBe(192);
    expect(tia.video.buffer.length).toBe(160 * 192 * 4);
  });
});
