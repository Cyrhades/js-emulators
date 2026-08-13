import { GameGeniePatch } from "../../../src/emulator/types";

/**
 * Decodes Sega Master System & Game Gear Game Genie / Pro Action Replay / RAW cheat codes.
 * Supports:
 *  - PAR (Pro Action Replay): 00C0-8805, 00C08805 -> Address 0xC088, Value 0x05
 *  - RAW: C088:05, C088=05, C088-05 -> Address 0xC088, Value 0x05
 *  - Game Genie 9-char: XXX-YYY-ZZZ
 *  - Game Genie 6-char: XXX-YYY
 */
export function decodeSmsCheatCode(codeStr: string): GameGeniePatch | null {
  if (!codeStr) return null;
  const clean = codeStr.trim().toUpperCase().replace(/[\s\-_:=]+/g, "");

  // PAR / Hex RAM 8-digit format: 00C08805 -> Addr 0xC088, Val 0x05
  if (clean.length === 8 && clean.startsWith("00")) {
    const addr = parseInt(clean.substring(2, 6), 16);
    const val = parseInt(clean.substring(6, 8), 16);
    if (!isNaN(addr) && !isNaN(val)) {
      return { addr, value: val, isRam: true };
    }
  }

  // RAW 6-digit format: C08805 -> Addr 0xC088, Val 0x05
  if (clean.length === 6) {
    const addr = parseInt(clean.substring(0, 4), 16);
    const val = parseInt(clean.substring(4, 6), 16);
    if (!isNaN(addr) && !isNaN(val)) {
      return { addr, value: val, isRam: addr >= 0xc000 };
    }
  }

  // 9-character SMS/GG Game Genie format: ABC-DEF-GHI -> 9 hex digits
  if (clean.length === 9) {
    const hex = clean.split("").map((c) => parseInt(c, 16));
    if (hex.some((n) => isNaN(n))) return null;
    const val = (hex[0] << 4) | hex[1];
    const addr = hex[2] | (hex[3] << 4) | (hex[4] << 8) | (hex[5] << 12);
    return { addr, value: val, isRam: addr >= 0xc000 };
  }

  return null;
}
