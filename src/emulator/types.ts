export interface VideoOutput {
  width: number;
  height: number;
  buffer: Uint8ClampedArray; // RGBA pixel data
}

export interface AudioOutput {
  getSamples(): Float32Array;
  sampleRate: number;
}

export interface EmulatorInput {
  buttons: Record<string, boolean>;
}

export interface ControlBinding {
  id: string;
  name: string;
  defaultKey: string;
  gamepadButton?: number;
}

export interface ControllerDefinition {
  name: string;
  bindings: ControlBinding[];
}

export interface ConsoleDefinition {
  id: string;
  name: string;
  manufacturer: string;
  releaseYear?: number;
  description?: string;
  isAvailable: boolean;
  maxPlayers?: number;
  supportedRomExtensions: string[];
  supportedRegions?: string[];
  controls: ControllerDefinition;
  createEmulator(): Emulator;
}

export interface GameGeniePatch {
  addr: number;
  value: number;
  wantskey?: boolean;
  key?: number;
  isRam?: boolean;
  fullAddr?: number;
}

export interface CheatCode {
  id: string;
  code: string;
  description: string;
  active: boolean;
  decoded?: GameGeniePatch;
  decodedList?: GameGeniePatch[];
}

export interface GameGenieSupport {
  isGameGenieEnabled(): boolean;
  setGameGenieEnabled(enabled: boolean): void;
  getGameGenieCodes(): CheatCode[];
  addGameGenieCode(code: string, description: string): boolean;
  toggleGameGenieCode(id: string, active: boolean): void;
  deleteGameGenieCode(id: string): void;
  clearGameGenieCodes(): void;
  setGameId?(gameId: string): void;
}

export interface SaveDataSupport {
  hasSaveData(): boolean;
  getSaveData(): Uint8Array | null;
  loadSaveData(data: Uint8Array): void;
  exportSaveFile?(): Uint8Array | null;
  importSaveFile?(data: Uint8Array): void;
}

export interface Emulator {
  readonly id: string;
  readonly name: string;

  start(): void;
  pause(): void;
  resume(): void;
  reset(): void;
  stop(): void;

  loadRom(data: Uint8Array): Promise<void>;

  getVideoOutput(): VideoOutput;
  getAudioOutput(): AudioOutput | null;

  handleInput(input: EmulatorInput): void;

  gameGenie?: GameGenieSupport;
  saveData?: SaveDataSupport;
}

export enum EmulatorStatus {
  Idle = "Idle",
  Loading = "Loading",
  Running = "Running",
  Paused = "Paused",
  Stopped = "Stopped",
  Error = "Error"
}

export interface GameDefinition {
  id: string;
  name: string;
  consoleId: string;
  description?: string;
  filename?: string;
  romData?: Uint8Array;
  region?: string;
  tags?: string[];
}

export interface EmulatorSession {
  emulator: Emulator | null;
  consoleDef: ConsoleDefinition | null;
  game: GameDefinition | null;
  status: EmulatorStatus;
  error?: string;
}
