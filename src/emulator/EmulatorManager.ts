import {
  ConsoleDefinition,
  Emulator,
  EmulatorSession,
  EmulatorStatus,
  GameDefinition,
  EmulatorInput,
} from "./types";
import { audioManager } from "./AudioManager";

export type SessionListener = (session: EmulatorSession) => void;

export class EmulatorManager {
  private currentSession: EmulatorSession = {
    emulator: null,
    consoleDef: null,
    game: null,
    status: EmulatorStatus.Idle,
  };

  private listeners: Set<SessionListener> = new Set();

  public subscribe(listener: SessionListener): () => void {
    this.listeners.add(listener);
    listener(this.getSession());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const session = this.getSession();
    this.listeners.forEach((listener) => listener(session));
  }

  public getSession(): EmulatorSession {
    return { ...this.currentSession };
  }

  private activeEmulator: Emulator | null = null;

  public async loadGame(consoleDef: ConsoleDefinition, game: GameDefinition): Promise<void> {
    let emulator: Emulator | null = null;
    try {
      if (
        this.currentSession.game?.id === game.id &&
        this.currentSession.consoleDef?.id === consoleDef.id &&
        (this.currentSession.status === EmulatorStatus.Loading || this.currentSession.status === EmulatorStatus.Running)
      ) {
        return;
      }

      this.stop(); // stop any active session first

      emulator = consoleDef.createEmulator();
      this.activeEmulator = emulator;

      this.currentSession = {
        emulator: null,
        consoleDef,
        game,
        status: EmulatorStatus.Loading,
      };
      this.notify();

      if (!game.romData) {
        throw new Error("No ROM data provided for this game.");
      }

      if (emulator.gameGenie?.setGameId) {
        emulator.gameGenie.setGameId(game.id);
      }

      await emulator.loadRom(game.romData);

      // Check if session was stopped or superseded while awaiting loadRom!
      if (this.activeEmulator !== emulator) {
        emulator.stop();
        return;
      }

      this.currentSession = {
        emulator,
        consoleDef,
        game,
        status: EmulatorStatus.Running,
      };
      this.notify();

      emulator.start();
    } catch (err: any) {
      if (emulator && this.activeEmulator === emulator) {
        this.currentSession = {
          emulator: null,
          consoleDef,
          game,
          status: EmulatorStatus.Error,
          error: err?.message || "Failed to load game ROM.",
        };
        this.notify();
      }
    }
  }

  public start(): void {
    if (this.currentSession.emulator && this.currentSession.status !== EmulatorStatus.Running) {
      this.currentSession.emulator.start();
      this.currentSession.status = EmulatorStatus.Running;
      this.notify();
    }
  }

  public pause(): void {
    if (this.currentSession.emulator && this.currentSession.status === EmulatorStatus.Running) {
      this.currentSession.emulator.pause();
      this.currentSession.status = EmulatorStatus.Paused;
      this.notify();
    }
  }

  public resume(): void {
    if (this.currentSession.emulator && this.currentSession.status === EmulatorStatus.Paused) {
      this.currentSession.emulator.resume();
      this.currentSession.status = EmulatorStatus.Running;
      this.notify();
    }
  }

  public reset(): void {
    if (this.currentSession.emulator) {
      this.currentSession.emulator.reset();
      this.currentSession.status = EmulatorStatus.Running;
      this.notify();
    }
  }

  public stop(): void {
    if (this.activeEmulator) {
      this.activeEmulator.stop();
      this.activeEmulator = null;
    }
    if (this.currentSession.emulator) {
      this.currentSession.emulator.stop();
    }
    audioManager.clear();
    this.currentSession = {
      emulator: null,
      consoleDef: null,
      game: null,
      status: EmulatorStatus.Stopped,
    };
    this.notify();
  }

  public handleInput(input: EmulatorInput): void {
    if (this.currentSession.emulator && this.currentSession.status === EmulatorStatus.Running) {
      this.currentSession.emulator.handleInput(input);
    }
  }
}

export const emulatorManager = new EmulatorManager();
