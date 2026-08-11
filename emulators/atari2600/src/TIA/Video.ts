import { TIARegisters } from "./Registers";

// Official Stella Atari 2600 NTSC Palette (128 RGBA colors)
const NTSC_PALETTE: number[] = [
  // 0x0x Grey
  0x00,0x00,0x00, 0x24,0x24,0x24, 0x4c,0x4c,0x4c, 0x68,0x68,0x68,
  0x8c,0x8c,0x8c, 0xa4,0xa4,0xa4, 0xc8,0xc8,0xc8, 0xdc,0xdc,0xdc,
  // 0x1x Gold / Bright Yellow
  0x40,0x30,0x00, 0x64,0x4c,0x00, 0x88,0x68,0x00, 0xa4,0x7c,0x00,
  0xc8,0x98,0x00, 0xe0,0xb0,0x00, 0xf0,0xd0,0x00, 0xff,0xe0,0x00,
  // 0x2x Orange
  0x54,0x1c,0x00, 0x7c,0x2c,0x00, 0xa0,0x3c,0x00, 0xbc,0x4c,0x00,
  0xdc,0x68,0x00, 0xf4,0x84,0x00, 0xff,0xa0,0x00, 0xff,0xb4,0x3c,
  // 0x3x Red-Orange
  0x68,0x0c,0x00, 0x90,0x18,0x00, 0xb4,0x24,0x00, 0xd0,0x30,0x00,
  0xec,0x4c,0x00, 0xff,0x68,0x1c, 0xff,0x84,0x38, 0xff,0x9c,0x58,
  // 0x4x Red
  0x6c,0x00,0x10, 0x94,0x00,0x24, 0xb8,0x00,0x34, 0xd4,0x10,0x48,
  0xf0,0x28,0x60, 0xff,0x48,0x7c, 0xff,0x64,0x98, 0xff,0x80,0xb0,
  // 0x5x Purple
  0x5c,0x00,0x54, 0x84,0x00,0x7c, 0xa4,0x00,0xa0, 0xc0,0x14,0xbc,
  0xdc,0x2c,0xd8, 0xf4,0x48,0xf0, 0xff,0x64,0xff, 0xff,0x80,0xff,
  // 0x6x Blue-Purple
  0x3c,0x00,0x88, 0x5c,0x00,0xb4, 0x7c,0x00,0xd8, 0x98,0x14,0xf4,
  0xb4,0x2c,0xff, 0xcc,0x48,0xff, 0xe0,0x64,0xff, 0xec,0x80,0xff,
  // 0x7x Blue
  0x14,0x00,0x98, 0x28,0x00,0xc4, 0x3c,0x00,0xec, 0x54,0x1c,0xff,
  0x6c,0x38,0xff, 0x84,0x54,0xff, 0x9c,0x70,0xff, 0xb0,0x8c,0xff,
  // 0x8x Light-Blue
  0x00,0x18,0x8c, 0x00,0x2c,0xb4, 0x00,0x40,0xd8, 0x14,0x5c,0xf8,
  0x30,0x78,0xff, 0x4c,0x94,0xff, 0x68,0xac,0xff, 0x84,0xc4,0xff,
  // 0x9x Cyan
  0x00,0x2c,0x5c, 0x00,0x44,0x80, 0x00,0x5c,0xa4, 0x00,0x78,0xc4,
  0x14,0x94,0xe4, 0x30,0xb0,0xff, 0x4c,0xc8,0xff, 0x68,0xdc,0xff,
  // 0xAx Teal
  0x00,0x38,0x20, 0x00,0x54,0x38, 0x00,0x70,0x50, 0x00,0x8c,0x68,
  0x00,0xa8,0x84, 0x1c,0xc4,0xa0, 0x38,0xdc,0xbc, 0x54,0xf0,0xd4,
  // 0xBx Green
  0x00,0x3c,0x00, 0x00,0x5c,0x00, 0x00,0x7c,0x00, 0x00,0x98,0x00,
  0x00,0xb8,0x00, 0x18,0xd4,0x18, 0x38,0xec,0x38, 0x54,0xff,0x54,
  // 0xCx Yellow-Green
  0x14,0x38,0x00, 0x28,0x58,0x00, 0x3c,0x78,0x00, 0x50,0x94,0x00,
  0x68,0xb4,0x00, 0x84,0xd0,0x00, 0x9c,0xe8,0x00, 0xb0,0xff,0x18,
  // 0xDx Olive / Gold-Green
  0x2c,0x34,0x00, 0x44,0x50,0x00, 0x5c,0x6c,0x00, 0x74,0x88,0x00,
  0x90,0xa4,0x00, 0xac,0xc0,0x00, 0xc4,0xd8,0x00, 0xdc,0xf0,0x14
];

export class TIAVideo {
  public width: number = 160;
  public height: number = 192;
  public buffer: Uint8ClampedArray = new Uint8ClampedArray(160 * 192 * 4);
  public colorMode: boolean = true;
  private currentScanline: number = 0;

  constructor() {
    // Fill alpha channel with 255
    for (let i = 3; i < this.buffer.length; i += 4) {
      this.buffer[i] = 255;
    }
  }

  private isPlayerPixel(
    x: number,
    pos: number,
    grp: number,
    refp: boolean,
    nusiz: number
  ): boolean {
    if (grp === 0) return false;

    const nusizVal = nusiz & 0x07;
    const scale = nusizVal === 5 ? 2 : nusizVal === 7 ? 4 : 1;
    let offsets: number[] = [0];

    switch (nusizVal) {
      case 1: offsets = [0, 16]; break;
      case 2: offsets = [0, 32]; break;
      case 3: offsets = [0, 16, 32]; break;
      case 4: offsets = [0, 64]; break;
      case 6: offsets = [0, 32, 64]; break;
    }

    const width = 8 * scale;
    for (let i = 0; i < offsets.length; i++) {
      const start = pos + 4 + offsets[i];
      const dx = x - start;
      if (dx >= 0 && dx < width) {
        const relX = Math.floor(dx / scale);
        const bitIndex = refp ? relX : (7 - relX);
        if (((grp >> bitIndex) & 1) === 1) {
          return true;
        }
      }
    }
    return false;
  }

  private isMissilePixel(
    x: number,
    enabled: boolean,
    pos: number,
    nusiz: number
  ): boolean {
    if (!enabled) return false;

    const nusizVal = nusiz & 0x07;
    const mSize = (nusiz >> 4) & 0x03;
    const width = 1 << mSize;
    let offsets: number[] = [0];

    switch (nusizVal) {
      case 1: offsets = [0, 16]; break;
      case 2: offsets = [0, 32]; break;
      case 3: offsets = [0, 16, 32]; break;
      case 4: offsets = [0, 64]; break;
      case 6: offsets = [0, 32, 64]; break;
    }

    for (let i = 0; i < offsets.length; i++) {
      const start = pos + 4 + offsets[i];
      const dx = x - start;
      if (dx >= 0 && dx < width) return true;
    }
    return false;
  }

  private isBallPixel(
    x: number,
    enabled: boolean,
    pos: number,
    ctrlpf: number
  ): boolean {
    if (!enabled) return false;

    const bSize = (ctrlpf >> 4) & 0x03;
    const width = 1 << bSize;
    const dx = x - (pos + 4);
    return dx >= 0 && dx < width;
  }

  public renderPixel(x: number, scanlineIndex: number, regs: TIARegisters): void {
    if (x < 0 || x >= 160 || scanlineIndex < 0 || scanlineIndex >= 192) return;

    const lineOffset = scanlineIndex * 160 * 4;

    // If VBLANK bit 1 is set, screen is blanked (black)
    if ((regs.VBLANK & 0x02) !== 0) {
      const px = lineOffset + x * 4;
      this.buffer[px] = 0;
      this.buffer[px + 1] = 0;
      this.buffer[px + 2] = 0;
      this.buffer[px + 3] = 255;
      return;
    }

    // Colors
    const bgIdx = (regs.COLUBK >> 1) & 0x7f;
    const bgR = NTSC_PALETTE[bgIdx * 3] ?? 0;
    const bgG = NTSC_PALETTE[bgIdx * 3 + 1] ?? 0;
    const bgB = NTSC_PALETTE[bgIdx * 3 + 2] ?? 0;

    const pfIdx = (regs.COLUPF >> 1) & 0x7f;
    const pfR = NTSC_PALETTE[pfIdx * 3] ?? 255;
    const pfG = NTSC_PALETTE[pfIdx * 3 + 1] ?? 255;
    const pfB = NTSC_PALETTE[pfIdx * 3 + 2] ?? 255;

    const p0Idx = (regs.COLUP0 >> 1) & 0x7f;
    const p0R = NTSC_PALETTE[p0Idx * 3] ?? 255;
    const p0G = NTSC_PALETTE[p0Idx * 3 + 1] ?? 0;
    const p0B = NTSC_PALETTE[p0Idx * 3 + 2] ?? 0;

    const p1Idx = (regs.COLUP1 >> 1) & 0x7f;
    const p1R = NTSC_PALETTE[p1Idx * 3] ?? 0;
    const p1G = NTSC_PALETTE[p1Idx * 3 + 1] ?? 255;
    const p1B = NTSC_PALETTE[p1Idx * 3 + 2] ?? 0;

    const scoreMode = (regs.CTRLPF & 0x02) !== 0;
    const priorityPF = (regs.CTRLPF & 0x04) !== 0;
    const reflectPF = (regs.CTRLPF & 0x01) !== 0;

    // Playfield bit mapping
    let pfBit = 0;
    let halfX = x < 80 ? x : x - 80;
    if (x >= 80 && reflectPF) {
      halfX = 79 - halfX;
    }

    if (halfX < 16) {
      const bit = 4 + Math.floor(halfX / 4);
      pfBit = (regs.PF0 >> bit) & 1;
    } else if (halfX < 48) {
      const bit = 7 - Math.floor((halfX - 16) / 4);
      pfBit = (regs.PF1 >> bit) & 1;
    } else {
      const bit = Math.floor((halfX - 48) / 4);
      pfBit = (regs.PF2 >> bit) & 1;
    }

    const grp0 = regs.VDELP0 ? regs.GRP0 : regs.GRP0_OLD;
    const grp1 = regs.VDELP1 ? regs.GRP1 : regs.GRP1_OLD;
    const enabl = regs.VDELBL ? regs.ENABL : regs.ENABL_OLD;

    const isPF = pfBit === 1;
    const isP0 = this.isPlayerPixel(x, regs.POSP0, grp0, regs.REFP0, regs.NUSIZ0);
    const isP1 = this.isPlayerPixel(x, regs.POSP1, grp1, regs.REFP1, regs.NUSIZ1);
    const isM0 = this.isMissilePixel(x, regs.ENAM0, regs.POSM0, regs.NUSIZ0);
    const isM1 = this.isMissilePixel(x, regs.ENAM1, regs.POSM1, regs.NUSIZ1);
    const isBall = this.isBallPixel(x, enabl, regs.POSBL, regs.CTRLPF);

    // Collision Latch Updates
    if (isP0 && isPF) regs.CXP0FB |= 0x80;
    if (isP1 && isPF) regs.CXP1FB |= 0x80;
    if (isM0 && isPF) regs.CXM0FB |= 0x80;
    if (isM1 && isPF) regs.CXM1FB |= 0x80;
    if (isP0 && isP1) regs.CXPPMM |= 0x80;
    if (isM0 && isM1) regs.CXPPMM |= 0x40;
    if (isM0 && isP1) regs.CXM0P |= 0x80;
    if (isM0 && isP0) regs.CXM0P |= 0x40;
    if (isM1 && isP0) regs.CXM1P |= 0x80;
    if (isM1 && isP1) regs.CXM1P |= 0x40;

    // Color Selection
    let r = bgR, g = bgG, b = bgB;

    // Determine Playfield Color (Score Mode vs Normal)
    let currentPFR = pfR, currentPFG = pfG, currentPFB = pfB;
    if (scoreMode) {
      if (x < 80) {
        currentPFR = p0R; currentPFG = p0G; currentPFB = p0B;
      } else {
        currentPFR = p1R; currentPFG = p1G; currentPFB = p1B;
      }
    }

    if (priorityPF) {
      // Playfield/Ball has priority over Players/Missiles
      if (isPF) {
        r = currentPFR; g = currentPFG; b = currentPFB;
      } else if (isBall) {
        r = pfR; g = pfG; b = pfB;
      } else if (isP0 || isM0) {
        r = p0R; g = p0G; b = p0B;
      } else if (isP1 || isM1) {
        r = p1R; g = p1G; b = p1B;
      }
    } else {
      // Normal priority: Players/Missiles > Playfield/Ball > Background
      if (isP0 || isM0) {
        r = p0R; g = p0G; b = p0B;
      } else if (isP1 || isM1) {
        r = p1R; g = p1G; b = p1B;
      } else if (isPF) {
        r = currentPFR; g = currentPFG; b = currentPFB;
      } else if (isBall) {
        r = pfR; g = pfG; b = pfB;
      }
    }

    if (!this.colorMode) {
      const luma = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      r = luma;
      g = luma;
      b = luma;
    }

    const pixelOffset = lineOffset + x * 4;
    this.buffer[pixelOffset] = r;
    this.buffer[pixelOffset + 1] = g;
    this.buffer[pixelOffset + 2] = b;
    this.buffer[pixelOffset + 3] = 255;
  }

  public reset(): void {
    this.buffer.fill(0);
    for (let i = 3; i < this.buffer.length; i += 4) {
      this.buffer[i] = 255;
    }
  }
}
