import { ConsoleDefinition } from "../../../src/emulator/types";
import { NesEmulatorAdapter } from "./NesEmulatorAdapter";

export const nesDefinition: ConsoleDefinition = {
  id: "nes",
  name: "Nintendo (NES)",
  manufacturer: "Nintendo",
  releaseYear: 1983,
  description: "Console 8-bit emblématique avec manette D-Pad à 2 boutons principal (A/B) et fonction Turbo.",
  isAvailable: true,
  maxPlayers: 2,
  supportedRomExtensions: [".nes"],
  supportedRegions: ["NTSC-U", "PAL", "FAMICOM", "WORLD", "DEMO", "PROTO"],
  controls: {
    name: "NES Controller",
    bindings: [
      { id: "up", name: "Haut", defaultKey: "ArrowUp", gamepadButton: 12 },
      { id: "down", name: "Bas", defaultKey: "ArrowDown", gamepadButton: 13 },
      { id: "left", name: "Gauche", defaultKey: "ArrowLeft", gamepadButton: 14 },
      { id: "right", name: "Droite", defaultKey: "ArrowRight", gamepadButton: 15 },
      { id: "a", name: "Bouton A", defaultKey: "KeyX", gamepadButton: 0 },
      { id: "b", name: "Bouton B", defaultKey: "KeyZ", gamepadButton: 1 },
      { id: "select", name: "Select", defaultKey: "ShiftRight", gamepadButton: 8 },
      { id: "start", name: "Start", defaultKey: "Enter", gamepadButton: 9 },
      { id: "turboA", name: "Turbo A (optionnel)", defaultKey: "" },
      { id: "turboB", name: "Turbo B (optionnel)", defaultKey: "" },
    ],
  },
  createEmulator: () => new NesEmulatorAdapter(),
};
