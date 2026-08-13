/**
 * Crc32Service — IEEE 802.3 CRC-32 checksum calculator for Uint8Array ROM buffers.
 * Used for identifying ROM files against ScreenScraper database.
 */
export class Crc32Service {
  private static table: Uint32Array | null = null;

  private static makeTable(): Uint32Array {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      table[n] = c;
    }
    return table;
  }

  /**
   * Calculates CRC-32 checksum of a Uint8Array.
   * Returns an 8-character uppercase hex string (e.g., "A1B2C3D4").
   */
  public static calculate(data: Uint8Array): string {
    if (!data || data.length === 0) return "";
    if (!this.table) {
      this.table = this.makeTable();
    }
    let crc = 0xffffffff;
    for (let i = 0; i < data.length; i++) {
      crc = (crc >>> 8) ^ this.table[(crc ^ data[i]) & 0xff];
    }
    const finalCrc = (crc ^ 0xffffffff) >>> 0;
    return finalCrc.toString(16).padStart(8, "0").toUpperCase();
  }
}
