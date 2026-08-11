export interface GameGeniePatch {
  addr: number;
  value: number;
  wantskey?: boolean;
  key?: number;
  isRam?: boolean;
  fullAddr?: number;
}

export class GameGenie {
  patches: GameGeniePatch[];
  ramPatches: GameGeniePatch[];
  enabled: boolean;
  onChange: (() => void) | null;

  setEnabled: (enabled: boolean) => void;
  addCode: (code: string) => void;
  addPatch: (addr: number, value: number, key?: number) => void;
  removeAllCodes: () => void;
  applyCodes: (addr: number, value: number) => number;
  applyRamPatches: (cpu: any) => void;
  decode: (code: string) => GameGeniePatch | null;
  encodeHex: (
    addr: number,
    value: number,
    key?: number,
    wantskey?: boolean,
  ) => string;
  decodeHex: (s: string) => GameGeniePatch | null;
  encode: (addr: number, value: number, key?: number, wantskey?: boolean) => string;
}
