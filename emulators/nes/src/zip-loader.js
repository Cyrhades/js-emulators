import { unzipSync } from "fflate";

const SUPPORTED_EXTENSIONS = /\.(nes|fds|unf|unif)$/i;

/**
 * Convert arbitrary binary input (Uint8Array, ArrayBuffer, Buffer, or binary string)
 * into a Uint8Array.
 */
export function toUint8Array(input) {
  if (!input) return new Uint8Array(0);
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (typeof input === "string") {
    const uint8 = new Uint8Array(input.length);
    for (let i = 0; i < input.length; i++) {
      uint8[i] = input.charCodeAt(i) & 0xff;
    }
    return uint8;
  }
  if (ArrayBuffer.isView(input)) {
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  }
  return new Uint8Array(0);
}

/**
 * Check if binary data begins with ZIP file header signature (PK\x03\x04 or PK).
 */
export function isZipData(data) {
  const bytes = toUint8Array(data);
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

/**
 * Check if filename matches a supported NES ROM extension.
 */
export function isSupportedRomFile(filename) {
  if (!filename || filename.includes("__MACOSX/")) return false;
  const basename = filename.split("/").pop().split("\\").pop();
  if (basename.startsWith(".")) return false;
  return SUPPORTED_EXTENSIONS.test(filename);
}

/**
 * Parse input binary data.
 * If data is a ZIP archive, inspect its contents and extract ROM entries.
 *
 * Returns:
 * {
 *   isZip: boolean,
 *   type: "single" | "multiple" | "none" | "not_zip",
 *   roms: Array<{ name: string, data: Uint8Array }>,
 *   romData?: Uint8Array,
 *   name?: string,
 *   error?: string
 * }
 */
export function parseZip(input) {
  const bytes = toUint8Array(input);

  if (!isZipData(bytes)) {
    return {
      isZip: false,
      type: "not_zip",
      roms: [],
      romData: bytes,
    };
  }

  try {
    const unzipped = unzipSync(bytes);
    const roms = [];

    for (const [filename, fileData] of Object.entries(unzipped)) {
      if (isSupportedRomFile(filename) && fileData && fileData.length > 0) {
        const cleanName = filename.split("/").pop().split("\\").pop();
        roms.push({
          name: cleanName,
          fullPath: filename,
          data: fileData,
        });
      }
    }

    if (roms.length === 0) {
      return {
        isZip: true,
        type: "none",
        roms: [],
        error: "No valid NES ROM files (.nes) found inside ZIP archive",
      };
    }

    if (roms.length === 1) {
      return {
        isZip: true,
        type: "single",
        roms: roms,
        name: roms[0].name,
        romData: roms[0].data,
      };
    }

    return {
      isZip: true,
      type: "multiple",
      roms: roms,
    };
  } catch (err) {
    return {
      isZip: true,
      type: "none",
      roms: [],
      error: `Failed to decompress ZIP archive: ${err.message}`,
    };
  }
}

export default {
  toUint8Array,
  isZipData,
  isSupportedRomFile,
  parseZip,
};
