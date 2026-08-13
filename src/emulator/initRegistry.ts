import { consoleRegistry } from "./ConsoleRegistry";
import { atari2600Definition } from "../../emulators/atari2600/src/Atari2600Definition";
import { nesDefinition } from "../../emulators/nes/src/NesDefinition";
import { smsDefinition } from "../../emulators/sms/src/SmsDefinition";
import { ggDefinition } from "../../emulators/gg/src/GgDefinition";
import { futureConsoles } from "./FutureConsoles";

export function initConsoleRegistry(): void {
  // Register active Atari 2600 console
  consoleRegistry.register(atari2600Definition);
  // Register NES console
  consoleRegistry.register(nesDefinition);
  // Register Sega Master System console
  consoleRegistry.register(smsDefinition);
  // Register Sega Game Gear console
  consoleRegistry.register(ggDefinition);

  // Register future placeholders
  futureConsoles.forEach((c) => consoleRegistry.register(c));
}
