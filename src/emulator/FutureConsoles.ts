import { ConsoleDefinition } from "./types";

// Consoles matching existing subdirectories in /emulators/
export const futureConsoles: ConsoleDefinition[] = [
  {
    id: "snes",
    name: "Super Nintendo",
    manufacturer: "Nintendo",
    releaseYear: 1990,
    description: "Console 16-bit légendaire avec processeur sonore SPC700 et Mode 7.",
    isAvailable: false,
    maxPlayers: 4,
    supportedRomExtensions: [".sfc", ".smc"],
    supportedRegions: ["NTSC-U", "PAL", "SUPER FAMICOM", "WORLD"],
    controls: { name: "SNES Controller", bindings: [] },
    createEmulator: () => { throw new Error("SNES emulator not implemented yet."); }
  },
  {
    id: "gb",
    name: "Game Boy",
    manufacturer: "Nintendo",
    releaseYear: 1989,
    description: "La célèbre console portable 8-bit avec écran monochrome.",
    isAvailable: false,
    maxPlayers: 1,
    supportedRomExtensions: [".gb"],
    supportedRegions: ["NTSC-U", "PAL", "NTSC-J", "WORLD"],
    controls: { name: "Game Boy", bindings: [] },
    createEmulator: () => { throw new Error("Game Boy emulator not implemented yet."); }
  },
  {
    id: "md",
    name: "Sega Genesis / Mega Drive",
    manufacturer: "Sega",
    releaseYear: 1988,
    description: "Console 16-bit ultra-rapide équipée du processeur Motorola 68000.",
    isAvailable: false,
    maxPlayers: 4,
    supportedRomExtensions: [".md", ".gen"],
    supportedRegions: ["GENESIS", "MEGA DRIVE (PAL)", "MEGA DRIVE (JPN)", "WORLD"],
    controls: { name: "Mega Drive Controller", bindings: [] },
    createEmulator: () => { throw new Error("Mega Drive emulator not implemented yet."); }
  }
];
