import { ConsoleDefinition } from "./types";

export class ConsoleRegistry {
  private consoles: Map<string, ConsoleDefinition> = new Map();

  public register(consoleDef: ConsoleDefinition): void {
    if (this.consoles.has(consoleDef.id)) {
      console.warn(`Console with id "${consoleDef.id}" is already registered. Overwriting.`);
    }
    this.consoles.set(consoleDef.id, consoleDef);
  }

  public unregister(consoleId: string): boolean {
    return this.consoles.delete(consoleId);
  }

  public getConsole(consoleId: string): ConsoleDefinition | undefined {
    return this.consoles.get(consoleId);
  }

  public getAllConsoles(): ConsoleDefinition[] {
    return Array.from(this.consoles.values());
  }

  public getAvailableConsoles(): ConsoleDefinition[] {
    return this.getAllConsoles().filter((c) => c.isAvailable);
  }
}

export const consoleRegistry = new ConsoleRegistry();
