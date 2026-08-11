export interface Cartridge {
  read(address: number): number;
  write(address: number, value: number): void;
  reset(): void;
}

/**
  * Cartouche simple 2 Ko / 4 Ko sans bankswitching.
  */
export class FlatCartridge implements Cartridge {
  private rom: Uint8Array;
  private size: number;
  private ram: Uint8Array = new Uint8Array(128);
  private hasRamWrite: boolean = false;

  constructor(romData: Uint8Array) {
    this.size = romData.length;
    this.rom = new Uint8Array(4096);

    if (this.size === 2048) {
      this.rom.set(romData, 0);
      this.rom.set(romData, 2048);
    } else if (this.size >= 4096) {
      this.rom.set(romData.subarray(romData.length - 4096), 0);
    } else {
      this.rom.set(romData, 0);
    }
  }

  public read(address: number): number {
    const offset = address & 0x0fff;
    if (this.hasRamWrite && offset >= 0x0080 && offset <= 0x00ff) {
      return this.ram[offset - 0x0080];
    }
    return this.rom[offset] ?? 0;
  }

  public write(address: number, value: number): void {
    const offset = address & 0x0fff;
    if (offset >= 0x0000 && offset <= 0x007f) {
      this.hasRamWrite = true;
      this.ram[offset] = value;
    }
  }

  public reset(): void {
    this.ram.fill(0);
    this.hasRamWrite = false;
  }
}

/**
  * Cartouche 8 Ko F8 Bankswitching (2 banques de 4 Ko) + Superchip RAM.
  */
export class F8BankswitchingCartridge implements Cartridge {
  private rom: Uint8Array;
  private currentBank: number = 1;
  private ram: Uint8Array = new Uint8Array(128);
  private hasRamWrite: boolean = false;

  constructor(romData: Uint8Array) {
    this.rom = romData;
    this.reset();
  }

  public read(address: number): number {
    const offset = address & 0x0fff;

    if (this.hasRamWrite && offset >= 0x0080 && offset <= 0x00ff) {
      return this.ram[offset - 0x0080];
    }

    // Check bankswitch hotspot triggers
    if (offset === 0x0ff8) {
      this.currentBank = 0;
    } else if (offset === 0x0ff9) {
      this.currentBank = 1;
    }

    const bankOffset = this.currentBank * 4096 + offset;
    return this.rom[bankOffset] ?? 0;
  }

  public write(address: number, value: number): void {
    const offset = address & 0x0fff;

    if (offset >= 0x0000 && offset <= 0x007f) {
      this.hasRamWrite = true;
      this.ram[offset] = value;
      return;
    }

    if (offset === 0x0ff8) {
      this.currentBank = 0;
    } else if (offset === 0x0ff9) {
      this.currentBank = 1;
    }
  }

  public reset(): void {
    this.ram.fill(0);
    this.hasRamWrite = false;
    this.currentBank = 1;
  }
}

/**
 * Cartouche 16 Ko F6 Bankswitching (4 banques de 4 Ko) + Superchip RAM.
 */
export class F6BankswitchingCartridge implements Cartridge {
  private rom: Uint8Array;
  private currentBank: number = 3;
  private ram: Uint8Array = new Uint8Array(128);
  private hasRamWrite: boolean = false;

  constructor(romData: Uint8Array) {
    this.rom = romData;
    this.reset();
  }

  public read(address: number): number {
    const offset = address & 0x0fff;

    if (this.hasRamWrite && offset >= 0x0080 && offset <= 0x00ff) {
      return this.ram[offset - 0x0080];
    }

    if (offset >= 0x0ff6 && offset <= 0x0ff9) {
      this.currentBank = offset - 0x0ff6;
    }
    const bankOffset = this.currentBank * 4096 + offset;
    return this.rom[bankOffset] ?? 0;
  }

  public write(address: number, value: number): void {
    const offset = address & 0x0fff;

    if (offset >= 0x0000 && offset <= 0x007f) {
      this.hasRamWrite = true;
      this.ram[offset] = value;
      return;
    }

    if (offset >= 0x0ff6 && offset <= 0x0ff9) {
      this.currentBank = offset - 0x0ff6;
    }
  }

  public reset(): void {
    this.ram.fill(0);
    this.hasRamWrite = false;
    this.currentBank = 3;
  }
}

/**
 * Cartouche 32 Ko F4 Bankswitching (8 banques de 4 Ko) + Superchip RAM.
 */
export class F4BankswitchingCartridge implements Cartridge {
  private rom: Uint8Array;
  private currentBank: number = 7;
  private ram: Uint8Array = new Uint8Array(128);
  private hasRamWrite: boolean = false;

  constructor(romData: Uint8Array) {
    this.rom = romData;
    this.reset();
  }

  public read(address: number): number {
    const offset = address & 0x0fff;

    if (this.hasRamWrite && offset >= 0x0080 && offset <= 0x00ff) {
      return this.ram[offset - 0x0080];
    }

    if (offset >= 0x0ff4 && offset <= 0x0ffb) {
      this.currentBank = offset - 0x0ff4;
    }
    const bankOffset = this.currentBank * 4096 + offset;
    return this.rom[bankOffset] ?? 0;
  }

  public write(address: number, value: number): void {
    const offset = address & 0x0fff;

    if (offset >= 0x0000 && offset <= 0x007f) {
      this.hasRamWrite = true;
      this.ram[offset] = value;
      return;
    }

    if (offset >= 0x0ff4 && offset <= 0x0ffb) {
      this.currentBank = offset - 0x0ff4;
    }
  }

  public reset(): void {
    this.ram.fill(0);
    this.hasRamWrite = false;
    this.currentBank = 7;
  }
}

export function createCartridge(romData: Uint8Array): Cartridge {
  let cleanRom = romData;
  if (cleanRom.length % 1024 !== 0) {
    if ((cleanRom.length - 64) % 1024 === 0) {
      cleanRom = cleanRom.subarray(64);
    } else if ((cleanRom.length - 128) % 1024 === 0) {
      cleanRom = cleanRom.subarray(128);
    }
  }

  if (cleanRom.length >= 32768) {
    return new F4BankswitchingCartridge(cleanRom.subarray(cleanRom.length - 32768));
  }
  if (cleanRom.length >= 16384) {
    return new F6BankswitchingCartridge(cleanRom.subarray(cleanRom.length - 16384));
  }
  if (cleanRom.length >= 8192) {
    return new F8BankswitchingCartridge(cleanRom.subarray(cleanRom.length - 8192));
  }
  return new FlatCartridge(cleanRom);
}

/**
 * Extracts and cleans game title for Atari 2600 ROMs/Cartridges
 */
export function getCartridgeRomTitle(filename: string, _romData?: Uint8Array): string {
  let title = filename.split("/").pop()?.split("\\").pop() ?? filename;
  title = title.replace(/\.(zip|bin|a26)$/gi, "");
  title = title.replace(/\.(bin|a26)$/gi, "");
  title = title.replace(/_/g, " ");
  title = title.replace(/\([^)]*\)/g, "");
  title = title.replace(/\[[^\]]*\]/g, "");
  return title.replace(/\s+/g, " ").trim();
}
