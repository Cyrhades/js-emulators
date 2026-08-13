import { ConsoleDefinition } from "../../../src/emulator/types";
import { SmsEmulatorAdapter } from "./SmsEmulatorAdapter";

export const smsDefinition: ConsoleDefinition = {
  id: "sms",
  name: "Sega Master System",
  manufacturer: "Sega",
  releaseYear: 1985,
  description: "Console 8-bit de Sega avec processeur Z80 et processeur graphique VDP VRAM 16 Ko.",
  isAvailable: true,
  maxPlayers: 2,
  supportedRomExtensions: [".sms"],
  supportedRegions: ["NTSC", "PAL", "NTSC-J", "WORLD"],
  controls: {
    name: "Master System Pad",
    bindings: [
      { id: "up", name: "Haut", defaultKey: "ArrowUp", gamepadButton: 12 },
      { id: "down", name: "Bas", defaultKey: "ArrowDown", gamepadButton: 13 },
      { id: "left", name: "Gauche", defaultKey: "ArrowLeft", gamepadButton: 14 },
      { id: "right", name: "Droite", defaultKey: "ArrowRight", gamepadButton: 15 },
      { id: "button1", name: "Bouton 1 / Tir 1", defaultKey: "KeyX", gamepadButton: 0 },
      { id: "button2", name: "Bouton 2 / Tir 2", defaultKey: "KeyZ", gamepadButton: 1 },
      { id: "pause", name: "Pause (Console)", defaultKey: "Enter", gamepadButton: 9 },
    ],
  },
  createEmulator: () => new SmsEmulatorAdapter(),
};
