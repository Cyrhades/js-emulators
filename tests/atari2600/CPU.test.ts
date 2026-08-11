import { describe, it, expect, beforeEach } from "vitest";
import { CPU6507 } from "../../emulators/atari2600/src/CPU/CPU6507";
import { ReadWrite } from "../../emulators/atari2600/src/CPU/types";

describe("Atari 2600 CPU (MOS 6507)", () => {
  let cpu: CPU6507;
  let memory: Uint8Array;

  beforeEach(() => {
    memory = new Uint8Array(8192); // 8KB address space for 6507
    cpu = new CPU6507({
      accessMemory: (rw: ReadWrite, addr: number, val?: number) => {
        const masked = addr & 0x1fff;
        if (rw === ReadWrite.read) {
          return memory[masked];
        } else {
          memory[masked] = (val ?? 0) & 0xff;
        }
      },
    });
  });

  it("should mask addresses to 13 bits (8KB)", () => {
    cpu._write8BitValue(0x3000, 0x42); // 0x3000 & 0x1FFF = 0x1000
    expect(memory[0x1000]).toBe(0x42);
    expect(cpu._read8BitValue(0x3000)).toBe(0x42);
  });

  it("should handle stack push and pull", () => {
    cpu.stackPointer = 0xff;
    cpu._push8BitValueToStack(0xa5);
    expect(cpu.stackPointer).toBe(0xfe);
    expect(cpu._pull8BitValueFromStack()).toBe(0xa5);
    expect(cpu.stackPointer).toBe(0xff);
  });

  it("should reset program counter to reset vector (0xFFFC/D)", () => {
    memory[0x1ffc] = 0x00;
    memory[0x1ffd] = 0x10; // Reset vector = 0x1000
    cpu.reset();
    expect(cpu.programCounter).toBe(0x1000);
  });
});
