import {
  CPUAddressingMode,
  CPUOperation,
  CPUOperationWithAddressingModes,
  ProcessorStatus,
} from "./types";
import { convertToSignedValue } from "./util";

export const cpuOperations: { [key: number]: CPUOperation } = {
  0x00: {
    name: "BRK",
    dataBytes: 1, // one ghost operand, doesn't do anything but the processor treats is as if it does
    func: (cpu) => {
      cpu.triggerIRQB(true); // a brk is a software irqb with the brk processor status set
    },
  },
  0x08: {
    name: "PHP",
    dataBytes: 0,
    func: (cpu) => {
      cpu._push8BitValueToStack(cpu.processorStatus);
    },
  },
  0x28: {
    name: "PLP",
    dataBytes: 0,
    func: (cpu) => {
      cpu.processorStatus = cpu._pull8BitValueFromStack();
    },
  },
  0x18: {
    name: "CLC", // clear carry
    dataBytes: 0,
    func: (cpu) => {
      cpu.processorStatus = cpu.processorStatus & ~ProcessorStatus.carry;
    },
  },
  0x20: {
    name: "JSR abs",
    dataBytes: 2,
    func: (cpu, address) => {
      // before we jump, push the return address (current program counter) onto the stack
      cpu._push16BitValueToStack(cpu.programCounter);
      cpu.programCounter = address;
    },
  },
  0x24: {
    name: "BIT zp",
    dataBytes: 1,
    func: (cpu, zpAddress) => {
      // honestly, I have no idea what this instruction is meant to be used for.
      // interpreted what it does from these two websites:
      // https://www.masswerk.at/6502/6502_instruction_set.html#BIT
      // https://retrocomputing.stackexchange.com/questions/11108/why-does-the-6502-have-the-bit-instruction

      const memValue = cpu._read8BitValue(zpAddress);
      const zero = (cpu.reg_a & memValue) === 0;

      cpu.processorStatus =
        (cpu.processorStatus & 0b00111101) |
        (memValue & 0b11000000) |
        (zero ? 0b00000010 : 0);
    },
  },
  0x2c: {
    name: "BIT abs",
    dataBytes: 2,
    func: (cpu, address) => {
      // honestly, I have no idea what this instruction is meant to be used for.
      // interpreted what it does from these two websites:
      // https://www.masswerk.at/6502/6502_instruction_set.html#BIT
      // https://retrocomputing.stackexchange.com/questions/11108/why-does-the-6502-have-the-bit-instruction

      const memValue = cpu._read8BitValue(address);
      const zero = (cpu.reg_a & memValue) === 0;

      cpu.processorStatus =
        (cpu.processorStatus & 0b00111101) |
        (memValue & 0b11000000) |
        (zero ? 0b00000010 : 0);
    },
  },
  0x60: {
    name: "RTS",
    dataBytes: 0,
    func: (cpu) => {
      cpu.programCounter = cpu._pull16BitValueFromStack();
    },
  },
  0xba: {
    name: "TSX",
    dataBytes: 0,
    func: (cpu) => {
      cpu.reg_x = cpu._convertValueTo8BitAndSetStatusFlags(cpu.stackPointer);
    },
  },
  0x9a: {
    name: "TXS",
    dataBytes: 0,
    func: (cpu) => {
      cpu.stackPointer = cpu.reg_x;
    },
  },
  0x8a: {
    name: "TXA",
    dataBytes: 0,
    func: (cpu) => {
      cpu.reg_a = cpu._convertValueTo8BitAndSetStatusFlags(cpu.reg_x);
    },
  },
  0x98: {
    name: "TYA",
    dataBytes: 0,
    func: (cpu) => {
      cpu.reg_a = cpu._convertValueTo8BitAndSetStatusFlags(cpu.reg_y);
    },
  },
  0xa8: {
    name: "TAY",
    dataBytes: 0,
    func: (cpu) => {
      cpu.reg_y = cpu._convertValueTo8BitAndSetStatusFlags(cpu.reg_a);
    },
  },
  0xaa: {
    name: "TAX",
    dataBytes: 0,
    func: (cpu) => {
      cpu.reg_x = cpu._convertValueTo8BitAndSetStatusFlags(cpu.reg_a);
    },
  },
  0xd8: {
    name: "CLD",
    dataBytes: 0,
    func: () => {
      // noop, decimal mode not supported
    },
  },
  0x48: {
    name: "PHA",
    dataBytes: 0,
    func: (cpu) => {
      cpu._push8BitValueToStack(cpu.reg_a);
    },
  },
  0x68: {
    name: "PLA",
    dataBytes: 0,
    func: (cpu) => {
      cpu.reg_a = cpu._convertValueTo8BitAndSetStatusFlags(
        cpu._pull8BitValueFromStack()
      );
    },
  },
  0x38: {
    name: "SEC",
    dataBytes: 0,
    func: (cpu) => {
      cpu.processorStatus |= ProcessorStatus.carry;
    },
  },
  // branch
  0x10: {
    name: "BPL rel", // branch if plus (negative is not set)
    dataBytes: 1,
    func: (cpu, relativeAddress) => {
      if ((cpu.processorStatus & ProcessorStatus.negative) !== 0) {
        return;
      }
      cpu.programCounter =
        (cpu.programCounter + convertToSignedValue(relativeAddress)) & 0xffff;
    },
  },
  0x90: {
    name: "BCC rel", // branch if carry clear
    dataBytes: 1,
    func: (cpu, relativeAddress) => {
      if ((cpu.processorStatus & ProcessorStatus.carry) !== 0) {
        return;
      }
      cpu.programCounter =
        (cpu.programCounter + convertToSignedValue(relativeAddress)) & 0xffff;
    },
  },
  0xb0: {
    name: "BCS rel", // branch if carry set
    dataBytes: 1,
    func: (cpu, relativeAddress) => {
      if ((cpu.processorStatus & ProcessorStatus.carry) === 0) {
        return;
      }
      cpu.programCounter =
        (cpu.programCounter + convertToSignedValue(relativeAddress)) & 0xffff;
    },
  },
  0xf0: {
    name: "BEQ rel", // branch if equal (branch if result zero)
    dataBytes: 1,
    func: (cpu, relativeAddress) => {
      if ((cpu.processorStatus & ProcessorStatus.zero) === 0) {
        return;
      }
      cpu.programCounter =
        (cpu.programCounter + convertToSignedValue(relativeAddress)) & 0xffff;
    },
  },
  0x30: {
    name: "BMI rel", // branch if minus (branch if negative bit is set)
    dataBytes: 1,
    func: (cpu, relativeAddress) => {
      if ((cpu.processorStatus & ProcessorStatus.negative) === 0) {
        return;
      }
      cpu.programCounter =
        (cpu.programCounter + convertToSignedValue(relativeAddress)) & 0xffff;
    },
  },
  0xd0: {
    name: "BNE rel", // branch if not zero
    dataBytes: 1,
    func: (cpu, relativeAddress) => {
      if ((cpu.processorStatus & ProcessorStatus.zero) !== 0) {
        return;
      }
      cpu.programCounter =
        (cpu.programCounter + convertToSignedValue(relativeAddress)) & 0xffff;
    },
  },
  0x50: {
    name: "BVC rel", // branch if overflow clear
    dataBytes: 1,
    func: (cpu, relativeAddress) => {
      if ((cpu.processorStatus & ProcessorStatus.overflow) !== 0) {
        return;
      }
      cpu.programCounter =
        (cpu.programCounter + convertToSignedValue(relativeAddress)) & 0xffff;
    },
  },
  0x70: {
    name: "BVS rel", // branch if overflow set
    dataBytes: 1,
    func: (cpu, relativeAddress) => {
      if ((cpu.processorStatus & ProcessorStatus.overflow) === 0) {
        return;
      }
      cpu.programCounter =
        (cpu.programCounter + convertToSignedValue(relativeAddress)) & 0xffff;
    },
  },
  // toggle system register bits

  // inc/dec xy
  0xe8: {
    name: "INX",
    dataBytes: 0,
    func: (cpu) => {
      cpu.reg_x = (cpu.reg_x + 1) % 256;
      cpu._convertValueTo8BitAndSetStatusFlags(cpu.reg_x);
    },
  },
  0xc8: {
    name: "INY",
    dataBytes: 0,
    func: (cpu) => {
      cpu.reg_y = (cpu.reg_y + 1) % 256;
      cpu._convertValueTo8BitAndSetStatusFlags(cpu.reg_y);
    },
  },
  0xca: {
    name: "DEX",
    dataBytes: 0,
    func: (cpu) => {
      cpu.reg_x--;
      // wrap around
      if (cpu.reg_x === -1) {
        cpu.reg_x = 255;
      }
      cpu._convertValueTo8BitAndSetStatusFlags(cpu.reg_x);
    },
  },
  0x88: {
    name: "DEY",
    dataBytes: 0,
    func: (cpu) => {
      cpu.reg_y--;
      // wrap around
      if (cpu.reg_y === -1) {
        cpu.reg_y = 255;
      }
      cpu._convertValueTo8BitAndSetStatusFlags(cpu.reg_y);
    },
  },

  0x4c: {
    name: "JMP abs",
    dataBytes: 2,
    func: (cpu, absAddress) => {
      cpu.programCounter = absAddress;
    },
  },
  0x6c: {
    name: "JMP ind",
    dataBytes: 2,
    func: (cpu, address) => {
      cpu.programCounter = cpu._read16BitValue(address);
    },
  },
  0x78: {
    name: "SEI",
    dataBytes: 0,
    func: (cpu) => {
      cpu.processorStatus |= ProcessorStatus.disableIrqb;
    },
  },
  0x58: {
    name: "CLI",
    dataBytes: 0,
    func: (cpu) => {
      cpu.processorStatus &= ~ProcessorStatus.disableIrqb;
    },
  },
  0xf8: {
    name: "SED",
    dataBytes: 0,
    func: (cpu) => {
      cpu.processorStatus |= ProcessorStatus.decimalMode;
    },
  },
  0xb8: {
    name: "CLV",
    dataBytes: 0,
    func: (cpu) => {
      cpu.processorStatus &= ~ProcessorStatus.overflow;
    },
  },
  0x40: {
    name: "RTI",
    dataBytes: 0,
    func: (cpu) => {
      cpu.processorStatus = cpu._pull8BitValueFromStack();
      cpu.programCounter = cpu._pull16BitValueFromStack();
    },
  },
  0xeb: {
    name: "SBC # (unofficial)",
    dataBytes: 1,
    func: (cpu, value) => {
      const carry = (cpu.processorStatus & ProcessorStatus.carry) ? 1 : 0;
      const result = cpu.reg_a - value - (1 - carry);
      if (result >= 0) cpu.processorStatus |= ProcessorStatus.carry;
      else cpu.processorStatus &= ~ProcessorStatus.carry;
      const overflow = (cpu.reg_a & 0x80) !== (result & 0x80);
      if (overflow) cpu.processorStatus |= ProcessorStatus.overflow;
      else cpu.processorStatus &= ~ProcessorStatus.overflow;
      cpu.reg_a = cpu._convertValueTo8BitAndSetStatusFlags(result);
    },
  },
  0xea: {
    name: "NOP",
    dataBytes: 0,
    func: () => {},
  },
  // Unofficial NOPs (1-byte)
  0x1a: { name: "NOP", dataBytes: 0, func: () => {} },
  0x3a: { name: "NOP", dataBytes: 0, func: () => {} },
  0x5a: { name: "NOP", dataBytes: 0, func: () => {} },
  0x7a: { name: "NOP", dataBytes: 0, func: () => {} },
  0xda: { name: "NOP", dataBytes: 0, func: () => {} },
  0xfa: { name: "NOP", dataBytes: 0, func: () => {} },
  // Unofficial NOPs (2-byte)
  0x04: { name: "NOP zp", dataBytes: 1, func: () => {} },
  0x14: { name: "NOP zp,x", dataBytes: 1, func: () => {} },
  0x34: { name: "NOP zp,x", dataBytes: 1, func: () => {} },
  0x44: { name: "NOP zp", dataBytes: 1, func: () => {} },
  0x54: { name: "NOP zp,x", dataBytes: 1, func: () => {} },
  0x64: { name: "NOP zp", dataBytes: 1, func: () => {} },
  0x74: { name: "NOP zp,x", dataBytes: 1, func: () => {} },
  0x80: { name: "NOP #", dataBytes: 1, func: () => {} },
  0x82: { name: "NOP #", dataBytes: 1, func: () => {} },
  0x89: { name: "NOP #", dataBytes: 1, func: () => {} },
  0xc2: { name: "NOP #", dataBytes: 1, func: () => {} },
  0xe2: { name: "NOP #", dataBytes: 1, func: () => {} },
  // Unofficial NOPs (3-byte)
  0x0c: { name: "NOP abs", dataBytes: 2, func: () => {} },
  0x1c: { name: "NOP abs,x", dataBytes: 2, func: () => {} },
  0x3c: { name: "NOP abs,x", dataBytes: 2, func: () => {} },
  0x5c: { name: "NOP abs,x", dataBytes: 2, func: () => {} },
  0x7c: { name: "NOP abs,x", dataBytes: 2, func: () => {} },
  0xdc: { name: "NOP abs,x", dataBytes: 2, func: () => {} },
  0xfc: { name: "NOP abs,x", dataBytes: 2, func: () => {} },
};

// to avoid having to re-implement each operation for each addressing mode, provide an abstract operation generator
// dynamically create functions for each opcode at runtime
const operationsWithMultipleAddressingModes: CPUOperationWithAddressingModes[] = [
  {
    name: "LDA",
    addressingModes: {
      0xa9: "#",
      0xa5: "zp",
      0xb5: "zp,x",
      0xad: "abs",
      0xbd: "abs,x",
      0xb9: "abs,y",
      0xa1: "(ind,x)",
      0xb1: "(ind),y",
    },
    func: (cpu, value) => {
      cpu.reg_a = cpu._convertValueTo8BitAndSetStatusFlags(value);
    },
  },
  {
    name: "STA",
    addressingModes: {
      0x85: "zp",
      0x95: "zp,x",
      0x8d: "abs",
      0x9d: "abs,x",
      0x99: "abs,y",
      0x81: "(ind,x)",
      0x91: "(ind),y",
    },
    func: (cpu) => {
      return cpu.reg_a;
    },
  },
  {
    name: "LDX",
    addressingModes: {
      0xa2: "#",
      0xa6: "zp",
      0xb6: "zp,y",
      0xae: "abs",
      0xbe: "abs,y",
    },
    func: (cpu, value) => {
      cpu.reg_x = cpu._convertValueTo8BitAndSetStatusFlags(value);
    },
  },
  {
    name: "STX",
    addressingModes: {
      0x86: "zp",
      0x96: "zp,y",
      0x8e: "abs",
    },
    func: (cpu, value) => {
      return cpu.reg_x;
    },
  },
  {
    name: "LDY",
    addressingModes: {
      0xa0: "#",
      0xa4: "zp",
      0xb4: "zp,x",
      0xac: "abs",
      0xbc: "abs,x",
    },
    func: (cpu, value) => {
      cpu.reg_y = cpu._convertValueTo8BitAndSetStatusFlags(value);
    },
  },
  {
    name: "STY",
    addressingModes: {
      0x84: "zp",
      0x94: "zp,x",
      0x8c: "abs",
    },
    func: (cpu, value) => {
      return cpu.reg_y;
    },
  },
  {
    name: "ORA",
    addressingModes: {
      0x09: "#",
      0x05: "zp",
      0x15: "zp,x",
      0x0d: "abs",
      0x1d: "abs,x",
      0x19: "abs,y",
      0x01: "(ind,x)",
      0x11: "(ind),y",
    },
    func: (cpu, value) => {
      cpu.reg_a = cpu._convertValueTo8BitAndSetStatusFlags(cpu.reg_a | value);
    },
  },
  {
    name: "ASL",
    addressingModes: {
      0x0a: "a",
      0x06: "zp",
      0x16: "zp,x",
      0x0e: "abs",
      0x1e: "abs,x",
    },
    func: (cpu, value) => {
      return cpu._convertValueTo8BitAndSetStatusFlags(value << 1, true);
    },
  },
  {
    name: "ROL",
    addressingModes: {
      0x2a: "a",
      0x26: "zp",
      0x36: "zp,x",
      0x2e: "abs",
      0x3e: "abs,x",
    },
    func: (cpu, value) => {
      // basically the same as ASL but with a wrap around
      const carrySet =
        (cpu.processorStatus & ProcessorStatus.carry) === ProcessorStatus.carry;

      value = value << 1;

      // check if the carry bit was set, and wrap it to the lsb
      if (carrySet) {
        value = value | 0b00000001;
      }

      value = cpu._convertValueTo8BitAndSetStatusFlags(value, true);
      return value;
    },
  },
  {
    name: "ROR",
    addressingModes: {
      0x6a: "a",
      0x66: "zp",
      0x76: "zp,x",
      0x6e: "abs",
      0x7e: "abs,x",
    },
    func: (cpu, value) => {
      // basically the same as ASL but with a wrap around
      const carrySet =
        (cpu.processorStatus & ProcessorStatus.carry) === ProcessorStatus.carry;

      // check if the lsb was set, and wrap it to the overflow bit
      const willWrap = (value & 0b00000001) === 0b00000001;

      value = value >> 1;

      if (willWrap) {
        // set the carry bit if we lost a bit over the lsb edge
        value = value | 0b100000000;
      }

      if (carrySet) {
        // set the highest bit if the carry was set before
        value = value | 0b010000000;
      }

      value = cpu._convertValueTo8BitAndSetStatusFlags(value, true);
      return value;
    },
  },
  {
    name: "ADC",
    addressingModes: {
      0x69: "#",
      0x65: "zp",
      0x75: "zp,x",
      0x6d: "abs",
      0x7d: "abs,x",
      0x79: "abs,y",
      0x61: "(ind,x)",
      0x71: "(ind),y",
    },
    func: (cpu, value) => {
      const carry = (cpu.processorStatus & ProcessorStatus.carry) !== 0 ? 1 : 0;
      const isDecimal = (cpu.processorStatus & ProcessorStatus.decimalMode) !== 0;

      if (isDecimal) {
        let low = (cpu.reg_a & 0x0f) + (value & 0x0f) + carry;
        let high = (cpu.reg_a >> 4) + (value >> 4) + (low > 9 ? 1 : 0);

        if (low > 9) low += 6;
        const carryOut = high > 9;
        if (high > 9) high += 6;

        const result = ((high & 0x0f) << 4) | (low & 0x0f);

        if (carryOut) cpu.processorStatus |= ProcessorStatus.carry;
        else cpu.processorStatus &= ~ProcessorStatus.carry;

        cpu.reg_a = cpu._convertValueTo8BitAndSetStatusFlags(result);
      } else {
        const sum = value + cpu.reg_a + carry;
        const cappedSum = cpu._convertValueTo8BitAndSetStatusFlags(sum, true);

        const overflow = (value ^ cappedSum) & (cpu.reg_a ^ cappedSum) & 0x80;

        if (overflow) {
          cpu.processorStatus |= ProcessorStatus.overflow;
        } else {
          cpu.processorStatus &= ~ProcessorStatus.overflow;
        }

        cpu.reg_a = cappedSum;
      }
    },
  },
  {
    name: "AND",
    addressingModes: {
      0x29: "#",
      0x25: "zp",
      0x35: "zp,x",
      0x2d: "abs",
      0x3d: "abs,x",
      0x39: "abs,y",
      0x21: "(ind,x)",
      0x31: "(ind),y",
    },
    func: (cpu, value) => {
      cpu.reg_a = cpu._convertValueTo8BitAndSetStatusFlags(cpu.reg_a & value);
    },
  },
  {
    name: "INC",
    addressingModes: {
      0xe6: "zp",
      0xf6: "zp,x",
      0xee: "abs",
      0xfe: "abs,x",
    },
    func: (cpu, value) => {
      value = (value + 1) % 256;
      cpu._convertValueTo8BitAndSetStatusFlags(value);
      return value;
    },
  },
  {
    name: "DEC",
    addressingModes: {
      0xc6: "zp",
      0xd6: "zp,x",
      0xce: "abs",
      0xde: "abs,x",
    },
    func: (cpu, value) => {
      value = value - 1; // wrap around
      if (value === -1) {
        value = 255;
      }
      cpu._convertValueTo8BitAndSetStatusFlags(value);
      return value;
    },
  },
  {
    name: "CMP",
    addressingModes: {
      0xc9: "#",
      0xc5: "zp",
      0xd5: "zp,x",
      0xcd: "abs",
      0xdd: "abs,x",
      0xd9: "abs,y",
      0xc1: "(ind,x)",
      0xd1: "(ind),y",
    },
    func: (cpu, value) => {
      const result = cpu.reg_a - value;
      cpu._convertValueTo8BitAndSetStatusFlags(result);

      // manually set the carry, the logic here isn't what you would expect
      if (cpu.reg_a >= value) {
        cpu.processorStatus |= ProcessorStatus.carry;
      } else {
        cpu.processorStatus &= ~ProcessorStatus.carry;
      }
    },
  },
  {
    name: "CPX",
    addressingModes: {
      0xe0: "#",
      0xe4: "zp",
      0xec: "abs",
    },
    func: (cpu, value) => {
      const result = cpu.reg_x - value;
      cpu._convertValueTo8BitAndSetStatusFlags(result);

      // manually set the carry, the logic here isn't what you would expect
      if (cpu.reg_x >= value) {
        cpu.processorStatus |= ProcessorStatus.carry;
      } else {
        cpu.processorStatus &= ~ProcessorStatus.carry;
      }
    },
  },
  {
    name: "CPY",
    addressingModes: {
      0xc0: "#",
      0xc4: "zp",
      0xcc: "abs",
    },
    func: (cpu, value) => {
      const result = cpu.reg_y - value;
      cpu._convertValueTo8BitAndSetStatusFlags(result);

      // manually set the carry, the logic here isn't what you would expect
      if (cpu.reg_y >= value) {
        cpu.processorStatus |= ProcessorStatus.carry;
      } else {
        cpu.processorStatus &= ~ProcessorStatus.carry;
      }
    },
  },
  {
    name: "SBC",
    addressingModes: {
      0xe9: "#",
      0xe5: "zp",
      0xf5: "zp,x",
      0xed: "abs",
      0xfd: "abs,x",
      0xf9: "abs,y",
      0xe1: "(ind,x)",
      0xf1: "(ind),y",
    },
    func: (cpu, value) => {
      const carry = (cpu.processorStatus & ProcessorStatus.carry) !== 0 ? 1 : 0;
      const isDecimal = (cpu.processorStatus & ProcessorStatus.decimalMode) !== 0;

      if (isDecimal) {
        let low = (cpu.reg_a & 0x0f) - (value & 0x0f) - (1 - carry);
        let high = (cpu.reg_a >> 4) - (value >> 4) - (low < 0 ? 1 : 0);

        if (low < 0) low -= 6;
        const carryOut = high >= 0;
        if (high < 0) high -= 6;

        const result = ((high & 0x0f) << 4) | (low & 0x0f);
        if (carryOut) cpu.processorStatus |= ProcessorStatus.carry;
        else cpu.processorStatus &= ~ProcessorStatus.carry;

        cpu.reg_a = cpu._convertValueTo8BitAndSetStatusFlags(result);
      } else {
        const result = cpu.reg_a - value - (1 - carry);

        if (result >= 0) {
          cpu.processorStatus |= ProcessorStatus.carry;
        } else {
          cpu.processorStatus &= ~ProcessorStatus.carry;
        }

        const overflow = ((cpu.reg_a ^ value) & (cpu.reg_a ^ result) & 0x80) !== 0;
        if (overflow) {
          cpu.processorStatus |= ProcessorStatus.overflow;
        } else {
          cpu.processorStatus &= ~ProcessorStatus.overflow;
        }

        cpu.reg_a = cpu._convertValueTo8BitAndSetStatusFlags(result);
      }
    },
  },
  {
    name: "EOR",
    addressingModes: {
      0x49: "#",
      0x45: "zp",
      0x55: "zp,x",
      0x4d: "abs",
      0x5d: "abs,x",
      0x59: "abs,y",
      0x41: "(ind,x)",
      0x51: "(ind),y",
    },
    func: (cpu, value) => {
      const result = cpu.reg_a ^ value;
      cpu.reg_a = cpu._convertValueTo8BitAndSetStatusFlags(result);
    },
  },
  {
    name: "LSR",
    addressingModes: {
      0x4a: "a",
      0x46: "zp",
      0x56: "zp,x",
      0x4e: "abs",
      0x5e: "abs,x",
    },
    func: (cpu, value) => {
      const carry = (value & 0x01) !== 0;
      if (carry) {
        cpu.processorStatus |= ProcessorStatus.carry;
      } else {
        cpu.processorStatus &= ~ProcessorStatus.carry;
      }
      value = value >> 1;
      return cpu._convertValueTo8BitAndSetStatusFlags(value);
    },
  },
  {
    name: "LAX",
    addressingModes: {
      0xa7: "zp",
      0xb7: "zp,y",
      0xaf: "abs",
      0xbf: "abs,y",
      0xa3: "(ind,x)",
      0xb3: "(ind),y",
    },
    func: (cpu, value) => {
      const val = cpu._convertValueTo8BitAndSetStatusFlags(value);
      cpu.reg_a = val;
      cpu.reg_x = val;
    },
  },
  {
    name: "SAX",
    addressingModes: {
      0x87: "zp",
      0x97: "zp,y",
      0x8f: "abs",
      0x83: "(ind,x)",
    },
    func: (cpu) => {
      return cpu.reg_a & cpu.reg_x;
    },
  },
  {
    name: "DCP",
    addressingModes: {
      0xc7: "zp",
      0xd7: "zp,x",
      0xcf: "abs",
      0xdf: "abs,x",
      0xdb: "abs,y",
      0xc3: "(ind,x)",
      0xd3: "(ind),y",
    },
    func: (cpu, value) => {
      const decVal = (value - 1) & 0xff;
      const res = cpu.reg_a - decVal;
      cpu._convertValueTo8BitAndSetStatusFlags(res);
      if (cpu.reg_a >= decVal) cpu.processorStatus |= ProcessorStatus.carry;
      else cpu.processorStatus &= ~ProcessorStatus.carry;
      return decVal;
    },
  },
  {
    name: "ISB",
    addressingModes: {
      0xe7: "zp",
      0xf7: "zp,x",
      0xef: "abs",
      0xff: "abs,x",
      0xfb: "abs,y",
      0xe3: "(ind,x)",
      0xf3: "(ind),y",
    },
    func: (cpu, value) => {
      const incVal = (value + 1) & 0xff;
      const carry = (cpu.processorStatus & ProcessorStatus.carry) ? 1 : 0;
      const res = cpu.reg_a - incVal - (1 - carry);
      if (res >= 0) cpu.processorStatus |= ProcessorStatus.carry;
      else cpu.processorStatus &= ~ProcessorStatus.carry;
      const overflow = (cpu.reg_a & 0x80) !== (res & 0x80);
      if (overflow) cpu.processorStatus |= ProcessorStatus.overflow;
      else cpu.processorStatus &= ~ProcessorStatus.overflow;
      cpu.reg_a = cpu._convertValueTo8BitAndSetStatusFlags(res);
      return incVal;
    },
  },
  {
    name: "SLO",
    addressingModes: {
      0x07: "zp",
      0x17: "zp,x",
      0x0f: "abs",
      0x1f: "abs,x",
      0x1b: "abs,y",
      0x03: "(ind,x)",
      0x13: "(ind),y",
    },
    func: (cpu, value) => {
      const shiftVal = cpu._convertValueTo8BitAndSetStatusFlags(value << 1, true);
      cpu.reg_a = cpu._convertValueTo8BitAndSetStatusFlags(cpu.reg_a | shiftVal);
      return shiftVal;
    },
  },
  {
    name: "RLA",
    addressingModes: {
      0x27: "zp",
      0x37: "zp,x",
      0x2f: "abs",
      0x3f: "abs,x",
      0x3b: "abs,y",
      0x23: "(ind,x)",
      0x33: "(ind),y",
    },
    func: (cpu, value) => {
      const carrySet = (cpu.processorStatus & ProcessorStatus.carry) === ProcessorStatus.carry;
      let rotVal = value << 1;
      if (carrySet) rotVal |= 1;
      rotVal = cpu._convertValueTo8BitAndSetStatusFlags(rotVal, true);
      cpu.reg_a = cpu._convertValueTo8BitAndSetStatusFlags(cpu.reg_a & rotVal);
      return rotVal;
    },
  },
  {
    name: "SRE",
    addressingModes: {
      0x47: "zp",
      0x57: "zp,x",
      0x4f: "abs",
      0x5f: "abs,x",
      0x5b: "abs,y",
      0x43: "(ind,x)",
      0x53: "(ind),y",
    },
    func: (cpu, value) => {
      const carry = (value & 1) !== 0;
      if (carry) cpu.processorStatus |= ProcessorStatus.carry;
      else cpu.processorStatus &= ~ProcessorStatus.carry;
      const shiftVal = value >> 1;
      cpu.reg_a = cpu._convertValueTo8BitAndSetStatusFlags(cpu.reg_a ^ shiftVal);
      return shiftVal;
    },
  },
  {
    name: "RRA",
    addressingModes: {
      0x67: "zp",
      0x77: "zp,x",
      0x6f: "abs",
      0x7f: "abs,x",
      0x7b: "abs,y",
      0x63: "(ind,x)",
      0x73: "(ind),y",
    },
    func: (cpu, value) => {
      const carrySet = (cpu.processorStatus & ProcessorStatus.carry) === ProcessorStatus.carry;
      const willWrap = (value & 1) === 1;
      let rotVal = value >> 1;
      if (willWrap) rotVal |= 0x100;
      if (carrySet) rotVal |= 0x80;
      rotVal = cpu._convertValueTo8BitAndSetStatusFlags(rotVal, true);

      const adcCarry = (cpu.processorStatus & ProcessorStatus.carry) === 0 ? 0 : 1;
      const sum = rotVal + cpu.reg_a + adcCarry;
      const cappedSum = cpu._convertValueTo8BitAndSetStatusFlags(sum, true);
      const overflow = (rotVal ^ cappedSum) & (cpu.reg_a ^ cappedSum) & 0x80;
      if (overflow) cpu.processorStatus |= ProcessorStatus.overflow;
      else cpu.processorStatus &= ~ProcessorStatus.overflow;
      cpu.reg_a = cappedSum;

      return rotVal;
    },
  },
];

const addressingModes: { [key: string]: CPUAddressingMode } = {
  "#": {
    dataBytes: 1,
    fetchValue: (cpu, v) => v,
    storeValue: () => {
      throw new Error("Cannot store to immediate value");
    },
  },
  a: {
    dataBytes: 0,
    fetchValue: (cpu) => cpu.reg_a,
    storeValue: (cpu, address, value) => (cpu.reg_a = value),
  },
  zp: {
    dataBytes: 1,
    fetchValue: (cpu, address) => cpu._read8BitValue(address & 0xff),
    storeValue: (cpu, address, value) => cpu._write8BitValue(address & 0xff, value),
  },
  "zp,x": {
    dataBytes: 1,
    fetchValue: (cpu, address) => cpu._read8BitValue((address + cpu.reg_x) & 0xff),
    storeValue: (cpu, address, value) =>
      cpu._write8BitValue((address + cpu.reg_x) & 0xff, value),
  },
  "zp,y": {
    dataBytes: 1,
    fetchValue: (cpu, address) => cpu._read8BitValue((address + cpu.reg_y) & 0xff),
    storeValue: (cpu, address, value) =>
      cpu._write8BitValue((address + cpu.reg_y) & 0xff, value),
  },
  abs: {
    dataBytes: 2,
    fetchValue: (cpu, address) => cpu._read8BitValue(address),
    storeValue: (cpu, address, value) => cpu._write8BitValue(address, value),
  },
  "abs,x": {
    dataBytes: 2,
    fetchValue: (cpu, address) => cpu._read8BitValue(address + cpu.reg_x),
    storeValue: (cpu, address, value) =>
      cpu._write8BitValue(address + cpu.reg_x, value),
  },
  "abs,y": {
    dataBytes: 2,
    fetchValue: (cpu, address) => cpu._read8BitValue(address + cpu.reg_y),
    storeValue: (cpu, address, value) =>
      cpu._write8BitValue(address + cpu.reg_y, value),
  },
  "(ind,x)": {
    dataBytes: 1,
    fetchValue: (cpu, indirectAddress) => {
      const ptr = (indirectAddress + cpu.reg_x) & 0xff;
      const low = cpu._read8BitValue(ptr);
      const high = cpu._read8BitValue((ptr + 1) & 0xff);
      const address = (high << 8) | low;
      return cpu._read8BitValue(address);
    },
    storeValue: (cpu, indirectAddress, value) => {
      const ptr = (indirectAddress + cpu.reg_x) & 0xff;
      const low = cpu._read8BitValue(ptr);
      const high = cpu._read8BitValue((ptr + 1) & 0xff);
      const address = (high << 8) | low;
      cpu._write8BitValue(address, value);
    },
  },
  "(ind),y": {
    dataBytes: 1,
    fetchValue: (cpu, indirectAddress) => {
      const ptr = indirectAddress & 0xff;
      const low = cpu._read8BitValue(ptr);
      const high = cpu._read8BitValue((ptr + 1) & 0xff);
      const address = ((high << 8) | low) + cpu.reg_y;
      return cpu._read8BitValue(address);
    },
    storeValue: (cpu, indirectAddress, value) => {
      const ptr = indirectAddress & 0xff;
      const low = cpu._read8BitValue(ptr);
      const high = cpu._read8BitValue((ptr + 1) & 0xff);
      const address = ((high << 8) | low) + cpu.reg_y;
      cpu._write8BitValue(address, value);
    },
  },
};

operationsWithMultipleAddressingModes.forEach((operation) => {
  Object.keys(operation.addressingModes).forEach((opcodeStr) => {
    const opcode = parseInt(opcodeStr, 10);
    const addressingModeLabel = operation.addressingModes[opcode];
    const addressingMode = addressingModes[addressingModeLabel];

    cpuOperations[opcode] = {
      name: `${operation.name} ${addressingModeLabel}`,
      dataBytes: addressingMode.dataBytes,
      func: (cpu, param) => {
        const inputValue = addressingMode.fetchValue(cpu, param);
        const outputValue = operation.func(cpu, inputValue);
        if (outputValue !== undefined) {
          addressingMode.storeValue(cpu, param, outputValue as number);
        }
      },
    };
  });
});
