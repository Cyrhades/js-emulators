import { ButtonKey } from "./controller";
import { GameGenie } from "./gamegenie";

export type ControllerId = 1 | 2;

export interface EmulatorData {
  cpu: object;
  mmap: object;
  ppu: object;
  papu: object;
}

export interface NESOptions {
  onFrame?: (buffer: Uint32Array) => void;
  onAudioSample?: (left: number, right: number) => void;
  onStatusUpdate?: (status: string) => void;
  onBatteryRamWrite?: (address: number, value: number) => void;
  emulateSound?: boolean;
  removeSpriteLimit?: boolean;
  sampleRate?: number;
}

export interface ROMInfo {
  batteryRam: boolean;
  batteryRamData: Uint8Array | null;
  getSaveData: () => Uint8Array | null;
  setSaveData: (data: Uint8Array | ArrayBuffer | number[]) => void;
}

export interface MapperInfo {
  write: (address: number, value: number) => void;
  load: (address: number) => number;
  loadBatteryRam: () => void;
}

export class NES {
  constructor(opts: NESOptions);
  gameGenie: GameGenie;
  rom: ROMInfo;
  mmap: MapperInfo;
  reset: () => void;
  frame: () => void;
  buttonDown: (controller: ControllerId, button: ButtonKey) => void;
  buttonUp: (controller: ControllerId, button: ButtonKey) => void;
  zapperMove: (x: number, y: number) => void;
  zapperFireDown: () => void;
  zapperFireUp: () => void;
  getFPS: () => number;
  reloadROM: () => void;
  loadROM: (data: string | Buffer | Uint8Array | ArrayBuffer) => void;
  getSaveData: () => Uint8Array | null;
  loadSaveData: (data: Uint8Array) => void;
  setFramerate: (rate: number) => void;
  setSampleRate: (rate: number) => void;
  toJSON: () => EmulatorData;
  fromJSON: (data: EmulatorData) => void;
}

export default NES;
