export class TIARegisters {
  // Video registers
  public VSYNC: number = 0;
  public VBLANK: number = 0;
  public WSYNC: boolean = false;
  public RSYNC: number = 0;
  public NUSIZ0: number = 0;
  public NUSIZ1: number = 0;
  public COLUP0: number = 0;
  public COLUP1: number = 0;
  public COLUPF: number = 0;
  public COLUBK: number = 0;
  public CTRLPF: number = 0;
  public REFP0: boolean = false;
  public REFP1: boolean = false;

  public PF0: number = 0;
  public PF1: number = 0;
  public PF2: number = 0;

  public GRP0: number = 0;
  public GRP1: number = 0;

  public ENAM0: boolean = false;
  public ENAM1: boolean = false;
  public ENABL: boolean = false;

  public HMP0: number = 0;
  public HMP1: number = 0;
  public HMM0: number = 0;
  public HMM1: number = 0;
  public HMBL: number = 0;

  public POSP0: number = 0;
  public POSP1: number = 0;
  public POSM0: number = 0;
  public POSM1: number = 0;
  public POSBL: number = 0;

  // Collision registers (15 collision latches)
  public CXM0P: number = 0; // M0-P1, M0-P0
  public CXM1P: number = 0; // M1-P0, M1-P1
  public CXP0FB: number = 0; // P0-PF, P0-BL
  public CXP1FB: number = 0; // P1-PF, P1-BL
  public CXM0FB: number = 0; // M0-PF, M0-BL
  public CXM1FB: number = 0; // M1-PF, M1-BL
  public CXBLPF: number = 0; // BL-PF
  public CXPPMM: number = 0; // P0-P1, M0-M1

  // Input latches (P0/P1 fire buttons)
  public INPT4: number = 0x80; // P0 Fire (bit 7: 0 = pressed)
  public INPT5: number = 0x80; // P1 Fire (bit 7: 0 = pressed)

  public VDELP0: boolean = false;
  public VDELP1: boolean = false;
  public VDELBL: boolean = false;
  public GRP0_OLD: number = 0;
  public GRP1_OLD: number = 0;
  public ENABL_OLD: boolean = false;
  public GRP0_NEW_LATCH: number = 0;
  public GRP1_NEW_LATCH: number = 0;
  public RESMP0: boolean = false;
  public RESMP1: boolean = false;

  public write(address: number, value: number, cyclesThisScanline: number = 0): void {
    const reg = address & 0x3f;
    const clk = cyclesThisScanline * 3;

    switch (reg) {
      case 0x00: // VSYNC
        this.VSYNC = value & 0x02;
        break;
      case 0x01: // VBLANK
        this.VBLANK = value;
        break;
      case 0x02: // WSYNC
        this.WSYNC = true;
        break;
      case 0x04: // NUSIZ0
        this.NUSIZ0 = value & 0x37;
        break;
      case 0x05: // NUSIZ1
        this.NUSIZ1 = value & 0x37;
        break;
      case 0x06: // COLUP0
        this.COLUP0 = value & 0xfe;
        break;
      case 0x07: // COLUP1
        this.COLUP1 = value & 0xfe;
        break;
      case 0x08: // COLUPF
        this.COLUPF = value & 0xfe;
        break;
      case 0x09: // COLUBK
        this.COLUBK = value & 0xfe;
        break;
      case 0x0a: // CTRLPF
        this.CTRLPF = value;
        break;
      case 0x0b: // REFP0
        this.REFP0 = (value & 0x08) !== 0;
        break;
      case 0x0c: // REFP1
        this.REFP1 = (value & 0x08) !== 0;
        break;
      case 0x0d: // PF0
        this.PF0 = value & 0xf0;
        break;
      case 0x0e: // PF1
        this.PF1 = value & 0xff;
        break;
      case 0x0f: // PF2
        this.PF2 = value & 0xff;
        break;
      case 0x10: { // RESP0
        let p = clk < 68 ? 157 : (clk - 68);
        this.POSP0 = p;
        if (this.RESMP0) this.POSM0 = this.POSP0;
        break;
      }
      case 0x11: { // RESP1
        let p = clk < 68 ? 157 : (clk - 68);
        this.POSP1 = p;
        if (this.RESMP1) this.POSM1 = this.POSP1;
        break;
      }
      case 0x12: { // RESM0
        let p = clk < 68 ? 157 : (clk - 68);
        this.POSM0 = p;
        break;
      }
      case 0x13: { // RESM1
        let p = clk < 68 ? 157 : (clk - 68);
        this.POSM1 = p;
        break;
      }
      case 0x14: { // RESBL
        let p = clk < 68 ? 157 : (clk - 68);
        this.POSBL = p;
        break;
      }
      case 0x1b: // GRP0
        this.GRP0_OLD = value;
        this.GRP1 = this.GRP1_OLD;
        break;
      case 0x1c: // GRP1
        this.GRP1_OLD = value;
        this.GRP0 = this.GRP0_OLD;
        this.ENABL = this.ENABL_OLD;
        break;
      case 0x1d: // ENAM0
        this.ENAM0 = (value & 0x02) !== 0;
        break;
      case 0x1e: // ENAM1
        this.ENAM1 = (value & 0x02) !== 0;
        break;
      case 0x1f: // ENABL
        this.ENABL_OLD = (value & 0x02) !== 0;
        break;
      case 0x20: // HMP0
        this.HMP0 = (value >> 4) & 0x0f;
        break;
      case 0x21: // HMP1
        this.HMP1 = (value >> 4) & 0x0f;
        break;
      case 0x22: // HMM0
        this.HMM0 = (value >> 4) & 0x0f;
        break;
      case 0x23: // HMM1
        this.HMM1 = (value >> 4) & 0x0f;
        break;
      case 0x24: // HMBL
        this.HMBL = (value >> 4) & 0x0f;
        break;
      case 0x25: // VDELP0
        this.VDELP0 = (value & 0x01) !== 0;
        break;
      case 0x26: // VDELP1
        this.VDELP1 = (value & 0x01) !== 0;
        break;
      case 0x27: // VDELBL
        this.VDELBL = (value & 0x01) !== 0;
        break;
      case 0x28: // RESMP0
        this.RESMP0 = (value & 0x02) !== 0;
        if (this.RESMP0) this.POSM0 = this.POSP0;
        break;
      case 0x29: // RESMP1
        this.RESMP1 = (value & 0x02) !== 0;
        if (this.RESMP1) this.POSM1 = this.POSP1;
        break;
      case 0x2a: // HMOVE
        this.applyHMove();
        break;
      case 0x2b: // HMCLR
        this.HMP0 = 0;
        this.HMP1 = 0;
        this.HMM0 = 0;
        this.HMM1 = 0;
        this.HMBL = 0;
        break;
      case 0x2c: // CXCLR
        this.CXM0P = 0;
        this.CXM1P = 0;
        this.CXP0FB = 0;
        this.CXP1FB = 0;
        this.CXM0FB = 0;
        this.CXM1FB = 0;
        this.CXBLPF = 0;
        this.CXPPMM = 0;
        break;
    }
  }

  private getSignedShift(val: number): number {
    let s = val & 0x0f;
    if (s >= 8) s -= 16;
    return s;
  }

  private applyHMove(): void {
    const p0 = this.getSignedShift(this.HMP0);
    const p1 = this.getSignedShift(this.HMP1);
    const m0 = this.getSignedShift(this.HMM0);
    const m1 = this.getSignedShift(this.HMM1);
    const bl = this.getSignedShift(this.HMBL);

    this.POSP0 = (this.POSP0 - p0 + 160) % 160;
    this.POSP1 = (this.POSP1 - p1 + 160) % 160;
    this.POSM0 = (this.POSM0 - m0 + 160) % 160;
    this.POSM1 = (this.POSM1 - m1 + 160) % 160;
    this.POSBL = (this.POSBL - bl + 160) % 160;
  }

  public read(address: number): number {
    const reg = address & 0x0f;
    switch (reg) {
      case 0x00:
        return this.CXM0P;
      case 0x01:
        return this.CXM1P;
      case 0x02:
        return this.CXP0FB;
      case 0x03:
        return this.CXP1FB;
      case 0x04:
        return this.CXM0FB;
      case 0x05:
        return this.CXM1FB;
      case 0x06:
        return this.CXBLPF;
      case 0x07:
        return this.CXPPMM;
      case 0x0c:
        return this.INPT4;
      case 0x0d:
        return this.INPT5;
      default:
        return 0;
    }
  }

  public reset(): void {
    this.VSYNC = 0;
    this.VBLANK = 0;
    this.WSYNC = false;
    this.COLUBK = 0;
    this.COLUPF = 0;
    this.COLUP0 = 0;
    this.COLUP1 = 0;
    this.GRP0 = 0;
    this.GRP1 = 0;
    this.PF0 = 0;
    this.PF1 = 0;
    this.PF2 = 0;
    this.CXM0P = 0;
    this.CXM1P = 0;
    this.CXP0FB = 0;
    this.CXP1FB = 0;
    this.CXM0FB = 0;
    this.CXM1FB = 0;
    this.CXBLPF = 0;
    this.CXPPMM = 0;
  }
}
