import { describe, it, expect } from "vitest";
import { extractCleanRomTitle } from "../src/emulator/RomTitleExtractor";
import { getCartridgeRomTitle } from "../emulators/atari2600/src/Cartridge";

describe("RomTitleExtractor", () => {
  it("should extract clean game titles from complex ROM and ZIP filenames", () => {
    expect(extractCleanRomTitle("3-D_Genesis_(USA).zip")).toBe("3-D Genesis");
    expect(extractCleanRomTitle("Super_Mario_Bros._(JU)_[!].nes")).toBe("Super Mario Bros");
    expect(extractCleanRomTitle("Pac-Man (1982) (Atari) (PAL).bin")).toBe("Pac-Man");
    expect(extractCleanRomTitle("Pitfall! (USA).a26")).toBe("Pitfall!");
    expect(extractCleanRomTitle("River_Raid.zip")).toBe("River Raid");
    expect(
      extractCleanRomTitle(
        "Alex Kidd in Miracle World (USA, Europe, Brazil) (En) (Rev 1).sms"
      )
    ).toBe("Alex Kidd in Miracle World");
    expect(
      extractCleanRomTitle(
        "Alex.Kidd.in.Miracle.World.(USA,.Europe,.Brazil).(En).(Rev.1).sms"
      )
    ).toBe("Alex Kidd in Miracle World");
  });

  it("should support Atari 2600 Cartridge getCartridgeRomTitle helper", () => {
    expect(getCartridgeRomTitle("3-D Genesis (USA).bin")).toBe("3-D Genesis");
  });
});
