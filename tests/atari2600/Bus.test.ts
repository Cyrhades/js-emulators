import { describe, it, expect, beforeEach } from "vitest";
import { Bus } from "../../emulators/atari2600/src/Bus/Bus";
import { TIA } from "../../emulators/atari2600/src/TIA";
import { RIOT6532 } from "../../emulators/atari2600/src/RIOT6532";
import { FlatCartridge } from "../../emulators/atari2600/src/Cartridge";

describe("Atari 2600 Bus Memory Mapping", () => {
  let bus: Bus;
  let tia: TIA;
  let riot: RIOT6532;
  let cartridge: FlatCartridge;

  beforeEach(() => {
    tia = new TIA();
    riot = new RIOT6532();
    const romData = new Uint8Array(4096);
    romData[0x0ffc] = 0x00;
    romData[0x0ffd] = 0x10;
    cartridge = new FlatCartridge(romData);
    bus = new Bus(tia, riot, cartridge);
  });

  it("should route RIOT RAM accesses (0x0080 - 0x00FF)", () => {
    bus.write(0x0080, 0xef);
    expect(bus.read(0x0080)).toBe(0xef);
    // Test RAM mirroring at 0x0180
    expect(bus.read(0x0180)).toBe(0xef);
  });

  it("should route Cartridge accesses (0x1000 - 0x1FFF)", () => {
    expect(bus.read(0x1ffc)).toBe(0x00);
    expect(bus.read(0x1ffd)).toBe(0x10);
  });
});
