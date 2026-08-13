import { ConsoleDefinition } from "../../../src/emulator/types";
import { GgEmulatorAdapter } from "./GgEmulatorAdapter";

export const ggDefinition: ConsoleDefinition = {
  id: "gg",
  name: "Sega Game Gear",
  manufacturer: "Sega",
  releaseYear: 1990,
  description: "Console portable 8-bit couleur avec processeur Z80 et écran 160x144 rétroéclairé.",
  isAvailable: true,
  maxPlayers: 1,
  supportedRomExtensions: [".gg"],
  supportedRegions: ["NTSC", "PAL", "NTSC-J", "WORLD"],
  controls: {
    name: "Game Gear",
    bindings: [
      { id: "up", name: "Haut", defaultKey: "ArrowUp", gamepadButton: 12 },
      { id: "down", name: "Bas", defaultKey: "ArrowDown", gamepadButton: 13 },
      { id: "left", name: "Gauche", defaultKey: "ArrowLeft", gamepadButton: 14 },
      { id: "right", name: "Droite", defaultKey: "ArrowRight", gamepadButton: 15 },
      { id: "button1", name: "Bouton 1", defaultKey: "KeyX", gamepadButton: 0 },
      { id: "button2", name: "Bouton 2", defaultKey: "KeyZ", gamepadButton: 1 },
      { id: "start", name: "Start", defaultKey: "Enter", gamepadButton: 9 },
    ],
  },
  createEmulator: () => new GgEmulatorAdapter(),
};
