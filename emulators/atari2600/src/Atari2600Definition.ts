import { ConsoleDefinition } from "../../../src/emulator/types";
import { Atari2600EmulatorAdapter } from "./Atari2600EmulatorAdapter";

export const atari2600Definition: ConsoleDefinition = {
  id: "atari2600",
  name: "Atari 2600",
  manufacturer: "Atari",
  releaseYear: 1977,
  description: "La console légendaire de seconde génération avec joystick 8 directions et bouton Fire unique.",
  isAvailable: true,
  maxPlayers: 2,
  supportedRomExtensions: [".bin", ".a26"],
  supportedRegions: ["NTSC", "PAL", "DEMO", "HOMEBREW"],
  controls: {
    name: "Atari Console & Joystick",
    bindings: [
      { id: "up", name: "Haut", defaultKey: "ArrowUp", gamepadButton: 12 },
      { id: "down", name: "Bas", defaultKey: "ArrowDown", gamepadButton: 13 },
      { id: "left", name: "Gauche", defaultKey: "ArrowLeft", gamepadButton: 14 },
      { id: "right", name: "Droite", defaultKey: "ArrowRight", gamepadButton: 15 },
      { id: "fire", name: "Bouton Tir / Fire", defaultKey: "Space", gamepadButton: 0 },
      { id: "reset", name: "Game Reset / Start Game", defaultKey: "F12", gamepadButton: 9 },
      { id: "select", name: "Game Select", defaultKey: "F11", gamepadButton: 8 },
      { id: "tvType", name: "TV Type (Color / N&B)", defaultKey: "F2" },
    ],
  },
  createEmulator: () => new Atari2600EmulatorAdapter(),
};
