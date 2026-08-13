import { GameDefinition } from "./types";

// Built-in sample Atari 2600 demo ROM (4096 bytes)
// A simple test ROM that sets background colors and displays a rainbow playfield/sprites
function generateAtari2600SampleRom(): Uint8Array {
  const rom = new Uint8Array(4096);
  let p = 0;
  
  // 6502 Machine code routine:
  // SEI, CLD, LDX #$FF, TXS
  // Loop:
  // INC $02 (COLUBK background color)
  // STA $02 (WSYNC wait for scanline)
  // JMP Loop
  
  // Clear interrupts & decimal mode
  rom[p++] = 0x78; // SEI
  rom[p++] = 0xd8; // CLD
  rom[p++] = 0xa2; // LDX #$FF
  rom[p++] = 0xff;
  rom[p++] = 0x9a; // TXS
  
  // Clear TIA registers (0x00 .. 0x3F)
  rom[p++] = 0xa9; // LDA #0
  rom[p++] = 0x00;
  rom[p++] = 0xa2; // LDX #$3F
  rom[p++] = 0x3f;
  // ClearLoop:
  rom[p++] = 0x95; // STA 0,X
  rom[p++] = 0x00;
  rom[p++] = 0xca; // DEX
  rom[p++] = 0x10; // BPL ClearLoop (-3)
  rom[p++] = 0xfb;
  
  // Main frame loop:
  const mainLoopAddr = 0x1000 + p;
  
  // VSYNC on (2 cycles)
  rom[p++] = 0xa9; // LDA #2
  rom[p++] = 0x02;
  rom[p++] = 0x85; // STA VSYNC ($00)
  rom[p++] = 0x00;
  rom[p++] = 0x85; // STA WSYNC ($02)
  rom[p++] = 0x02;
  rom[p++] = 0x85; // STA WSYNC ($02)
  rom[p++] = 0x02;
  rom[p++] = 0x85; // STA WSYNC ($02)
  rom[p++] = 0x02;
  
  // VSYNC off (0)
  rom[p++] = 0xa9; // LDA #0
  rom[p++] = 0x00;
  rom[p++] = 0x85; // STA VSYNC ($00)
  rom[p++] = 0x00;
  
  // 30 VBLANK scanlines
  rom[p++] = 0xa2; // LDX #30
  rom[p++] = 30;
  // VBlankLoop:
  rom[p++] = 0x85; // STA WSYNC ($02)
  rom[p++] = 0x02;
  rom[p++] = 0xca; // DEX
  rom[p++] = 0xd0; // BNE VBlankLoop
  rom[p++] = 0xfb;
  
  // VBLANK off
  rom[p++] = 0x85; // STA VBLANK ($01)
  rom[p++] = 0x01;
  
  // 192 Visible scanlines with changing colors
  rom[p++] = 0xa2; // LDX #192
  rom[p++] = 192;
  // VisibleLoop:
  rom[p++] = 0x86; // STX COLUBK ($09)
  rom[p++] = 0x09;
  rom[p++] = 0x85; // STA WSYNC ($02)
  rom[p++] = 0x02;
  rom[p++] = 0xca; // DEX
  rom[p++] = 0xd0; // BNE VisibleLoop
  rom[p++] = 0xfb;
  
  // VBLANK on
  rom[p++] = 0xa9; // LDA #2
  rom[p++] = 0x02;
  rom[p++] = 0x85; // STA VBLANK ($01)
  rom[p++] = 0x01;
  
  // 30 Overscan scanlines
  rom[p++] = 0xa2; // LDX #30
  rom[p++] = 30;
  // OverscanLoop:
  rom[p++] = 0x85; // STA WSYNC ($02)
  rom[p++] = 0x02;
  rom[p++] = 0xca; // DEX
  rom[p++] = 0xd0; // BNE OverscanLoop
  rom[p++] = 0xfb;
  
  // Jump back to main loop
  rom[p++] = 0x4c; // JMP mainLoopAddr
  const targetLow = mainLoopAddr & 0xff;
  const targetHigh = (mainLoopAddr >> 8) & 0xff;
  rom[p++] = targetLow;
  rom[p++] = targetHigh;

  // Set 6502 Interrupt/Reset Vector at 0x1FFC / 0x1FFE -> 0x1000
  rom[4092] = 0x00; // Reset vector low (0x1000)
  rom[4093] = 0x10; // Reset vector high
  rom[4094] = 0x00; // IRQ/BRK vector low
  rom[4095] = 0x10; // IRQ/BRK vector high

  return rom;
}

export class GameLibrary {
  private games: Map<string, GameDefinition> = new Map();
  private listeners: Array<() => void> = [];

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((l) => l());
  }

  public addGame(game: GameDefinition): void {
    this.games.set(game.id, game);
    this.notify();
  }

  public getGamesForConsole(consoleId: string): GameDefinition[] {
    return Array.from(this.games.values()).filter((g) => g.consoleId === consoleId);
  }

  public getAllGames(): GameDefinition[] {
    return Array.from(this.games.values());
  }

  public getGame(gameId: string): GameDefinition | undefined {
    return this.games.get(gameId);
  }

  public async loadFromFile(file: File, consoleId: string): Promise<GameDefinition> {
    const arrayBuffer = await file.arrayBuffer();
    const romData = new Uint8Array(arrayBuffer);
    const gameId = `local-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9]/g, "_")}`;

    const game: GameDefinition = {
      id: gameId,
      name: file.name.replace(/\.[^/.]+$/, ""),
      consoleId,
      description: `ROM locale chargée (${(file.size / 1024).toFixed(1)} Ko)`,
      filename: file.name,
      romData,
    };

    this.addGame(game);
    return game;
  }
}

export const gameLibrary = new GameLibrary();
