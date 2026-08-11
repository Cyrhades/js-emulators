import { describe, it, expect, beforeEach } from "vitest";
import { RIOT6532 } from "../../emulators/atari2600/src/RIOT6532";

describe("RIOT 6532 (RAM, I/O, Timer)", () => {
  let riot: RIOT6532;

  beforeEach(() => {
    riot = new RIOT6532();
  });

  it("should write and read 128 bytes of RAM", () => {
    riot.write(0x80, 0x42);
    expect(riot.read(0x80)).toBe(0x42);
  });

  it("should handle programmable timer countdown", () => {
    riot.write(0x295, 10); // TIM8T: load 10, prescaler = 8
    expect(riot.timer.readTimer()).toBe(10);

    riot.tick(8); // 8 CPU cycles
    expect(riot.timer.readTimer()).toBe(9);
  });

  it("should read Port A joystick state", () => {
    riot.portA.setJoystickP0({ right: true });
    const swcha = riot.read(0x280);
    // Bit 7 is P0 right (0 = pressed)
    expect(swcha & 0x80).toBe(0);
  });
});
