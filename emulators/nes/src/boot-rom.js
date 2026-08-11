/**
 * NES BOOT ROM GENERATOR
 * =======================
 *
 * NROM / Mapper 0
 * 16 KiB PRG + 8 KiB CHR
 *
 * Display modes:
 *
 *   "TIMER"
 *      Boot screen stays visible for DISPLAY_TIME_SECONDS.
 *
 *   "BUTTON"
 *      Boot screen stays visible until CONTINUE_BUTTON is pressed.
 *
 * Audio:
 *   Uses the NES APU Pulse 1 channel.
 */

// =============================================================================
// USER CONFIGURATION
// =============================================================================

/**
 * Display mode.
 *
 * "TIMER"
 * "BUTTON"
 */
const DISPLAY_MODE = "TIMER";

/**
 * Display duration in seconds.
 *
 * Only used when DISPLAY_MODE === "TIMER".
 */
const DISPLAY_TIME_SECONDS = 50;

/**
 * Controller button used when DISPLAY_MODE === "BUTTON".
 *
 * Available:
 *
 * "A"
 * "B"
 * "SELECT"
 * "START"
 * "UP"
 * "DOWN"
 * "LEFT"
 * "RIGHT"
 */
const CONTINUE_BUTTON = "START";

/**
 * Enable / disable the boot sound.
 */
const SOUND_ENABLED = false;

// =============================================================================
// FONT
// =============================================================================

const FONT_PATTERNS = {
  " ": [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
  "!": [0x18, 0x18, 0x18, 0x18, 0x18, 0x00, 0x18, 0x00],
  "-": [0x00, 0x00, 0x00, 0x7e, 0x00, 0x00, 0x00, 0x00],
  ".": [0x00, 0x00, 0x00, 0x00, 0x00, 0x18, 0x18, 0x00],
  "/": [0x00, 0x03, 0x06, 0x0c, 0x18, 0x30, 0x60, 0x00],
  ":": [0x00, 0x18, 0x18, 0x00, 0x18, 0x18, 0x00, 0x00],
  "=": [0x00, 0x7e, 0x00, 0x7e, 0x00, 0x00, 0x00, 0x00],
  ">": [0x00, 0x60, 0x30, 0x18, 0x30, 0x60, 0x00, 0x00],
  "|": [0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x00],

  0: [0x3c, 0x66, 0x6e, 0x76, 0x66, 0x66, 0x3c, 0x00],
  1: [0x18, 0x38, 0x18, 0x18, 0x18, 0x18, 0x7e, 0x00],
  2: [0x3c, 0x66, 0x0c, 0x18, 0x30, 0x60, 0x7e, 0x00],
  3: [0x3c, 0x66, 0x06, 0x1c, 0x06, 0x66, 0x3c, 0x00],
  4: [0x0c, 0x1c, 0x3c, 0x6c, 0x7e, 0x0c, 0x0c, 0x00],
  5: [0x7e, 0x60, 0x7c, 0x06, 0x06, 0x66, 0x3c, 0x00],
  6: [0x3c, 0x66, 0x60, 0x7c, 0x66, 0x66, 0x3c, 0x00],
  7: [0x7e, 0x66, 0x0c, 0x18, 0x18, 0x18, 0x18, 0x00],
  8: [0x3c, 0x66, 0x66, 0x3c, 0x66, 0x66, 0x3c, 0x00],
  9: [0x3c, 0x66, 0x66, 0x3e, 0x06, 0x66, 0x3c, 0x00],

  A: [0x3c, 0x66, 0x66, 0x7e, 0x66, 0x66, 0x66, 0x00],
  B: [0x7c, 0x66, 0x66, 0x7c, 0x66, 0x66, 0x7c, 0x00],
  C: [0x3c, 0x66, 0x60, 0x60, 0x60, 0x66, 0x3c, 0x00],
  D: [0x78, 0x6c, 0x66, 0x66, 0x66, 0x6c, 0x78, 0x00],
  E: [0x7e, 0x60, 0x60, 0x7c, 0x60, 0x60, 0x7e, 0x00],
  F: [0x7e, 0x60, 0x60, 0x7c, 0x60, 0x60, 0x60, 0x00],
  G: [0x3c, 0x66, 0x60, 0x6e, 0x66, 0x66, 0x3c, 0x00],
  H: [0x66, 0x66, 0x66, 0x7e, 0x66, 0x66, 0x66, 0x00],
  I: [0x7e, 0x18, 0x18, 0x18, 0x18, 0x18, 0x7e, 0x00],
  J: [0x1e, 0x06, 0x06, 0x06, 0x06, 0x66, 0x3c, 0x00],
  K: [0x66, 0x6c, 0x78, 0x70, 0x78, 0x6c, 0x66, 0x00],
  L: [0x60, 0x60, 0x60, 0x60, 0x60, 0x60, 0x7e, 0x00],
  M: [0x63, 0x77, 0x7f, 0x6b, 0x63, 0x63, 0x63, 0x00],
  N: [0x66, 0x76, 0x7e, 0x7e, 0x6e, 0x66, 0x66, 0x00],
  O: [0x3c, 0x66, 0x66, 0x66, 0x66, 0x66, 0x3c, 0x00],
  P: [0x7c, 0x66, 0x66, 0x7c, 0x60, 0x60, 0x60, 0x00],
  Q: [0x3c, 0x66, 0x66, 0x66, 0x6e, 0x3c, 0x0e, 0x00],
  R: [0x7c, 0x66, 0x66, 0x7c, 0x70, 0x68, 0x66, 0x00],
  S: [0x3c, 0x66, 0x60, 0x3c, 0x06, 0x66, 0x3c, 0x00],
  T: [0x7e, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x00],
  U: [0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x3c, 0x00],
  V: [0x66, 0x66, 0x66, 0x66, 0x66, 0x3c, 0x18, 0x00],
  W: [0x63, 0x63, 0x63, 0x6b, 0x7f, 0x77, 0x63, 0x00],
  X: [0x66, 0x66, 0x3c, 0x18, 0x3c, 0x66, 0x66, 0x00],
  Y: [0x66, 0x66, 0x66, 0x3c, 0x18, 0x18, 0x18, 0x00],
  Z: [0x7e, 0x06, 0x0c, 0x18, 0x30, 0x60, 0x7e, 0x00],
};

// =============================================================================
// CHARACTER -> TILE
// =============================================================================

function charToTile(ch) {
  const code = ch.charCodeAt(0);

  if (code >= 32 && code <= 126) {
    return code - 32;
  }

  return 0;
}

// =============================================================================
// CHR ROM
// =============================================================================

function buildChrRom() {
  const chr = new Uint8Array(8192);

  for (let c = 32; c <= 126; c++) {
    const char = String.fromCharCode(c).toUpperCase();

    const pattern = FONT_PATTERNS[char] || FONT_PATTERNS[" "];

    const tileOffset = (c - 32) * 16;

    for (let row = 0; row < 8; row++) {
      const value = pattern[row] || 0;

      // Plane 0
      chr[tileOffset + row] = value;

      // Plane 1
      chr[tileOffset + 8 + row] = 0;
    }
  }

  return chr;
}

// =============================================================================
// PRG ROM
// =============================================================================

function buildPrgRom(bootTitle = "JS-NES version By Cyrhades") {
  const prg = new Uint8Array(16384);

  // ---------------------------------------------------------------------------
  // SCREEN
  // ---------------------------------------------------------------------------

  const formattedTitle = bootTitle.trim().toUpperCase();
  const screenRows = [
    "================================",
    "                                ",
    ("   " + formattedTitle).padEnd(32, " ").substring(0, 32),
    "                                ",
    "================================",
  ];

  // ---------------------------------------------------------------------------
  // NAMETABLE
  // ---------------------------------------------------------------------------

  const nametable = new Uint8Array(1024);

  nametable.fill(charToTile(" "));

  let offset = 5 * 32;

  for (let r = 0; r < screenRows.length && offset < 960; r++) {
    const line = screenRows[r].padEnd(32, " ").substring(0, 32);

    for (let c = 0; c < 32; c++) {
      nametable[offset++] = charToTile(line[c]);
    }
  }

  // Attribute table.
  for (let i = 960; i < 1024; i++) {
    nametable[i] = 0;
  }

  // ---------------------------------------------------------------------------
  // STORE NAMETABLE IN PRG
  //
  // CPU $D000 = PRG offset $1000
  // ---------------------------------------------------------------------------

  prg.set(nametable, 0x1000);

  // ===========================================================================
  // 6502 CODE
  // ===========================================================================

  let codePtr = 0;

  function emit(...bytes) {
    if (codePtr + bytes.length > 0x1000) {
      throw new Error("6502 program exceeds the reserved PRG area.");
    }

    for (const byte of bytes) {
      prg[codePtr++] = byte & 0xff;
    }
  }

  // ===========================================================================
  // RESET
  // ===========================================================================

  // SEI
  emit(0x78);

  // CLD
  emit(0xd8);

  // LDX #$FF
  emit(0xa2, 0xff);

  // TXS
  emit(0x9a);

  // ===========================================================================
  // DISABLE PPU
  // ===========================================================================

  // LDA #$00
  emit(0xa9, 0x00);

  // STA PPUCTRL
  emit(0x8d, 0x00, 0x20);

  // STA PPUMASK
  emit(0x8d, 0x01, 0x20);

  // ===========================================================================
  // WAIT VBLANK
  // ===========================================================================

  emit(0x2c, 0x02, 0x20);

  emit(0x10, 0xfb);

  // ===========================================================================
  // PALETTE
  // ===========================================================================

  // PPUADDR = $3F00

  emit(0xa9, 0x3f);
  emit(0x8d, 0x06, 0x20);

  emit(0xa9, 0x00);
  emit(0x8d, 0x06, 0x20);

  const palette = [0x0f, 0x12, 0x30, 0x27];

  for (let i = 0; i < 32; i++) {
    emit(0xa9, palette[i % 4]);

    emit(0x8d, 0x07, 0x20);
  }

  // ===========================================================================
  // COPY NAMETABLE
  // ===========================================================================

  // PPUADDR = $2000

  emit(0xa9, 0x20);
  emit(0x8d, 0x06, 0x20);

  emit(0xa9, 0x00);
  emit(0x8d, 0x06, 0x20);

  // Copy $D000-$DFFF to PPU $2000-$2FFF.

  for (let page = 0; page < 4; page++) {
    // X = 0
    emit(0xa2, 0x00);

    const loopStart = codePtr;

    // LDA $D000,X / $D100,X / etc.
    emit(0xbd, 0x00, 0xd0 + page);

    // STA PPUDATA
    emit(0x8d, 0x07, 0x20);

    // INX
    emit(0xe8);

    // BNE
    const branchOffset = loopStart - (codePtr + 2);

    emit(0xd0, branchOffset & 0xff);
  }

  // ===========================================================================
  // RESET SCROLL
  // ===========================================================================

  emit(0xa9, 0x00);

  emit(0x8d, 0x05, 0x20);
  emit(0x8d, 0x05, 0x20);

  // ===========================================================================
  // SOUND
  // ===========================================================================
  //
  // Pulse 1:
  //
  // $4000 = duty / volume
  // $4001 = sweep
  // $4002 = timer low
  // $4003 = timer high / length
  //
  // $4015 bit 0 enables Pulse 1.
  //
  // This produces a simple NES square-wave boot tone.
  // ===========================================================================

  if (SOUND_ENABLED) {
    // Enable Pulse 1.
    emit(0xa9, 0x01);

    emit(0x8d, 0x15, 0x40);

    // Duty 50%, constant volume 12.
    //
    // 01xxxxxx = 50% duty
    // 00001100 = volume 12

    emit(0xa9, 0x9c);

    emit(0x8d, 0x00, 0x40);

    // Disable sweep.

    emit(0xa9, 0x08);

    emit(0x8d, 0x01, 0x40);

    // Timer low.
    //
    // Approximate pleasant tone.

    emit(0xa9, 0xf0);

    emit(0x8d, 0x02, 0x40);

    // Timer high + length counter reload.

    emit(0xa9, 0x08);

    emit(0x8d, 0x03, 0x40);
  }

  // ===========================================================================
  // ENABLE PPU
  // ===========================================================================

  // Background rendering only.
  //
  // PPUMASK:
  //
  // bit 3 = background
  // bit 4 = sprites
  //
  // 0x08 = background only.

  emit(0xa9, 0x08);

  emit(0x8d, 0x01, 0x20);

  // ===========================================================================
  // DISPLAY MODE
  // ===========================================================================

  if (DISPLAY_MODE === "TIMER") {
    // -------------------------------------------------------------------------
    // TIMER
    // -------------------------------------------------------------------------
    //
    // Use frame counting.
    //
    // NTSC NES ≈ 60 frames/sec.
    //
    // $00/$01 = 16-bit frame counter.
    // -------------------------------------------------------------------------

    let frames = Math.round(DISPLAY_TIME_SECONDS * 60);

    const targetLow = frames & 0xff;

    const targetHigh = (frames >> 8) & 0xff;

    // Counter = 0.

    emit(0xa9, 0x00);
    emit(0x85, 0x00);
    emit(0x85, 0x01);

    const timerLoop = codePtr;

    // -------------------------------------------------------------------------
    // Wait for VBlank.
    // -------------------------------------------------------------------------

    const vblankLoop = codePtr;

    emit(0x2c, 0x02, 0x20);

    emit(0x10, (vblankLoop - (codePtr + 2)) & 0xff);

    // -------------------------------------------------------------------------
    // Increment 16-bit frame counter.
    // -------------------------------------------------------------------------

    emit(0xe6, 0x00);

    emit(0xd0, 0x02);

    emit(0xe6, 0x01);

    // -------------------------------------------------------------------------
    // Compare HIGH byte.
    // -------------------------------------------------------------------------

    emit(0xa5, 0x01);

    emit(0xc9, targetHigh);

    const highDifferent = codePtr;

    emit(0xd0, 0x00);

    // -------------------------------------------------------------------------
    // Compare LOW byte.
    // -------------------------------------------------------------------------

    emit(0xa5, 0x00);

    emit(0xc9, targetLow);

    const lowDifferent = codePtr;

    emit(0xd0, 0x00);

    // -------------------------------------------------------------------------
    // Timer not finished.
    // -------------------------------------------------------------------------

    let rel = timerLoop - (highDifferent + 2);

    if (rel < -128 || rel > 127) {
      throw new Error("Timer branch out of range.");
    }

    prg[highDifferent + 1] = rel & 0xff;

    rel = timerLoop - (lowDifferent + 2);

    if (rel < -128 || rel > 127) {
      throw new Error("Timer branch out of range.");
    }

    prg[lowDifferent + 1] = rel & 0xff;
  } else if (DISPLAY_MODE === "BUTTON") {
    // -------------------------------------------------------------------------
    // BUTTON
    // -------------------------------------------------------------------------
    //
    // NES controller protocol:
    //
    // $4016 = strobe
    //
    // After writing 1 then 0, eight reads from $4016
    // return:
    //
    // A
    // B
    // SELECT
    // START
    // UP
    // DOWN
    // LEFT
    // RIGHT
    // -------------------------------------------------------------------------

    const buttonIndex = {
      A: 0,
      B: 1,
      SELECT: 2,
      START: 3,
      UP: 4,
      DOWN: 5,
      LEFT: 6,
      RIGHT: 7,
    };

    const selectedIndex = buttonIndex[String(CONTINUE_BUTTON).toUpperCase()];

    if (selectedIndex === undefined) {
      throw new Error(`Invalid CONTINUE_BUTTON "${CONTINUE_BUTTON}".`);
    }

    // -------------------------------------------------------------------------
    // Controller loop.
    // -------------------------------------------------------------------------

    const controllerLoop = codePtr;

    // Strobe controller.

    emit(0xa9, 0x01);

    emit(0x8d, 0x16, 0x40);

    emit(0xa9, 0x00);

    emit(0x8d, 0x16, 0x40);

    // X = button index.

    emit(0xa2, selectedIndex);

    const readLoop = codePtr;

    // Read controller.

    emit(0xad, 0x16, 0x40);

    // A button pressed?
    //
    // We are only interested in the requested
    // bit at this point.

    const notPressed = codePtr;

    emit(0x29, 0x01);

    // If bit = 0, continue reading.
    emit(0xf0, 0x00);

    // Requested button was pressed.
    //
    // Jump out of controller loop.

    const continueAddress = codePtr + 3;

    emit(0x4c, continueAddress & 0xff, (continueAddress >> 8) & 0xff);

    // -------------------------------------------------------------------------
    // Not the requested bit.
    // -------------------------------------------------------------------------

    const branchToRead = readLoop - (notPressed + 2);

    if (branchToRead < -128 || branchToRead > 127) {
      throw new Error("Controller branch out of range.");
    }

    // Fix branch.
    prg[notPressed + 1] = branchToRead & 0xff;

    // -------------------------------------------------------------------------
    // This code handles the case where the current
    // controller bit was not the selected button.
    //
    // X decrements toward zero.
    // -------------------------------------------------------------------------

    emit(0xca);

    const continueReading = readLoop - (codePtr + 2);

    emit(0xd0, continueReading & 0xff);

    // No button detected.
    // Restart controller polling.

    emit(0x4c, controllerLoop & 0xff, (controllerLoop >> 8) & 0xff);
  } else {
    throw new Error(
      `Invalid DISPLAY_MODE "${DISPLAY_MODE}". ` +
        `Use "FOREVER", "TIMER" or "BUTTON".`,
    );
  }

  // ===========================================================================
  // STOP SOUND
  // ===========================================================================
  //
  // Once TIMER or BUTTON completes, disable Pulse 1.
  // ===========================================================================

  if (SOUND_ENABLED) {
    emit(0xa9, 0x00);

    emit(0x8d, 0x15, 0x40);
  }

  // ===========================================================================
  // STOP PPU
  // ===========================================================================

  emit(0xa9, 0x00);

  emit(0x8d, 0x01, 0x20);

  // ===========================================================================
  // FINAL LOOP
  // ===========================================================================

  const endLoop = 0xc000 + codePtr;

  emit(0x4c, endLoop & 0xff, (endLoop >> 8) & 0xff);

  // ===========================================================================
  // INTERRUPT VECTORS
  // ===========================================================================
  //
  // NROM 16 KiB:
  //
  // CPU $C000 -> PRG offset $0000
  // CPU $FFFF -> PRG offset $3FFF
  //
  // Vectors:
  //
  // $FFFA NMI
  // $FFFC RESET
  // $FFFE IRQ/BRK
  // ===========================================================================

  // NMI -> RESET
  prg[0x3ffa] = 0x00;
  prg[0x3ffb] = 0xc0;

  // RESET -> $C000
  prg[0x3ffc] = 0x00;
  prg[0x3ffd] = 0xc0;

  // IRQ -> $C000
  prg[0x3ffe] = 0x00;
  prg[0x3fff] = 0xc0;

  return prg;
}

// =============================================================================
// NES ROM GENERATOR
// =============================================================================

export function generateNesBootRom(bootTitle = "JS-NES version By Cyrhades") {
  // ---------------------------------------------------------------------------
  // iNES HEADER
  // ---------------------------------------------------------------------------
  //
  // 1 x 16 KiB PRG
  // 1 x 8 KiB CHR
  // Mapper 0
  // Horizontal mirroring
  // ---------------------------------------------------------------------------

  const header = new Uint8Array([
    0x4e, 0x45, 0x53, 0x1a,

    0x01, 0x01,

    0x00, 0x00,

    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  ]);

  const prg = buildPrgRom(bootTitle);

  const chr = buildChrRom();

  // ---------------------------------------------------------------------------
  // FINAL ROM
  // ---------------------------------------------------------------------------

  const rom = new Uint8Array(16 + 16384 + 8192);

  rom.set(header, 0);

  rom.set(prg, 16);

  rom.set(chr, 16 + 16384);

  return rom;
}

// =============================================================================
// BINARY STRING VERSION
// =============================================================================

export function generateNesBootRomString(
  bootTitle = "JS-NES version By Cyrhades",
) {
  const bytes = generateNesBootRom(bootTitle);

  let result = "";

  for (let i = 0; i < bytes.length; i++) {
    result += String.fromCharCode(bytes[i]);
  }

  return result;
}
