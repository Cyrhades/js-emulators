const JSSMS = (function() {
'use strict';

// Constants
/**
 * Whether to enable debug code globally. Set to false at build time.
 */
var DEBUG = false;

/**
 * Whether to activate debugger.
 * @define {boolean}
 */
var ENABLE_DEBUGGER = false;

/**
 * Whether to enable compiler.
 */
var ENABLE_COMPILER = false;

/** @const */ var WRITE_MODE = 0;
/** @const */ var READ_MODE = 1;

/**
 * Whether to enable server logging of various data used for debugging purposes.
 * This setting requires the server to be launched doing:
 * `node bin/sync-server.js`
 * Then, because of same domain policy, the emulator should be accessed from:
 * `http://127.0.0.1:8124/`
 * @define {boolean}
 */
var ENABLE_SERVER_LOGGER = false;

/**
 * @const
 */
var SYNC_MODE = READ_MODE;

/**
 * @type {boolean}
 */
var ACCURATE = false;

/**
 * Whether the system uses little endian or big endian.
 * @const
 */
var LITTLE_ENDIAN = true;

/**
 * Force the use of typed arrays.
 * @define {boolean}
 */
var FORCE_TYPED_ARRAYS = false;

/**
 * Does browser support typed arrays?
 * @const
 */
var SUPPORT_TYPED_ARRAYS = FORCE_TYPED_ARRAYS || 'Uint8Array' in window;

/**
 * Force ArrayBuffer and DataView use.
 * @define {boolean}
 */
var FORCE_DATAVIEW = false;

/**
 * Does browser support ArrayBuffer and DataView?
 * @const
 */
var SUPPORT_DATAVIEW =
  FORCE_DATAVIEW || ('ArrayBuffer' in window && 'DataView' in window);

/**
 * Force use of destructuring assignments.
 * @define {boolean}
 */
var FORCE_DESTRUCTURING = false;

/**
 * Does browser support destructuring assignments? Used in `EX ...` opcodes.
 * @const
 */
var SUPPORT_DESTRUCTURING = false; /*FORCE_DESTRUCTURING || function() {
  try {
    eval('var [a]=[1]');
    return true;
  } catch (e) {
    return false;
  }
}()*/

// Sound Output
/**
 * Sample Rate
 * @const
 */
var SAMPLE_RATE = 44100; //8000

/**
 * Print timing information on screen.
 * @type {boolean}
 */
var DEBUG_TIMING = DEBUG;

// CPU Settings
/**
 * Refresh register emulation (not required by any games?).
 * @type {boolean}
 */
var REFRESH_EMULATION = false;

/*
 * Games requiring accurate interrupt emulation:
 *  - Earthworm Jim (GG)
 */
/**
 * Do accurate interrupt emulation? (slower!).
 * Must be set to true when building jssms.node.min.js.
 * @define {boolean}
 */
var ACCURATE_INTERRUPT_EMULATION = false;

/*
 * Lightgun Mode (For the following titles):
 *  - Assault City
 *  - Gangster Town
 *  - Laser Ghost
 *  - Marksman Shooting / Trap Shooting / Safari Hunt
 *  - Missile Defense 3D
 *  - Operation Wolf
 *  - Rambo III
 *  - Rescue Mission
 *  - Shooting Gallery
 *  - Space Gun
 *  - Wanted
 */
/**
 * @type {boolean}
 */
var LIGHTGUN = /*ACCURATE*/ false;

// VDP Settings
/*
 * Games requiring sprite collision:
 *  - Cheese Cat'astrophe (SMS)
 *  - Ecco the Dolphin (SMS, GG)
 *  - Fantastic Dizzy (SMS, GG)
 *  - Fantazy Zone Gear (GG)
 *  - Impossible Mission (SMS)
 *  - Taz-Mania (SMS, GG)
 */
/**
 * Emulate hardware sprite collisions (not used by many games, and slower).
 * @type {boolean}
 */
var VDP_SPRITE_COLLISIONS = ACCURATE;

// Memory Settings
/**
 * Size of each memory page.
 * @const
 */
var PAGE_SIZE = 0x4000;

'use strict';

/**
 * The frequency in ms at which the fps rate is displayed.
 * @const
 */
var fpsInterval = 500;

/**
 * NTSC Clock Speed (3579545Hz for NTSC systems).
 * @const
 */
var CLOCK_NTSC = 3579545;

/**
 * PAL Clock Speed (3546893Hz for PAL/SECAM systems).
 * @const
 */
var CLOCK_PAL = 3546893;

/**
 * @constructor
 * @param {Object.<string, *>=} opts
 */
function JSSMS(opts) {
  /**
   * The list of options that can be overridden at instantiation.
   * @dict
   */
  this.opts = {
    ui: JSSMS.DummyUI,
  };
  if (opts !== undefined) {
    var key;
    for (key in this.opts) {
      if (opts[key] !== undefined) {
        this.opts[key] = opts[key];
      }
    }
  }

  // Modify global flags set in setup.js on a per instance basis.
  if (opts['DEBUG'] !== undefined) {
    DEBUG = opts['DEBUG'];
  }
  if (opts['ENABLE_COMPILER'] !== undefined) {
    ENABLE_COMPILER = opts['ENABLE_COMPILER'];
  }

  this.keyboard = new JSSMS.Keyboard(this);
  this.ui = new this.opts['ui'](this);
  this.vdp = new JSSMS.Vdp(this);
  this.psg = new JSSMS.SN76489(this);
  this.ports = new JSSMS.Ports(this);
  this.cpu = new JSSMS.Z80(this);

  this.ui.updateStatus('Ready to load a ROM.');

  if (this.soundEnabled) {
    var AudioCtx = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
    if (typeof AudioCtx === 'function') {
      try {
        this.audioContext = new AudioCtx();
        this.audioBuffer = this.audioContext.createBuffer(1, 1, SAMPLE_RATE);
      } catch (e) {
        this.audioBuffer = { getChannelData: function() { return new Float32Array(SAMPLE_RATE); } };
      }
    } else {
      this.audioBuffer = { getChannelData: function() { return new Float32Array(SAMPLE_RATE); } };
    }
  }

  // Exposing ui publicly after minification.
  this['ui'] = this.ui;
}

JSSMS.prototype = {
  /**
   * Is thread running?
   * @type {boolean}
   */
  isRunning: false,

  /**
   * CPU cycles per scanline.
   * @type {number}
   */
  cyclesPerLine: 0,

  /**
   * No of scanlines to render (including blanking).
   * @type {number}
   */
  no_of_scanlines: 0,

  /**
   * Render every FRAMESKIP frames.
   * @type {number}
   */
  frameSkip: 0,

  /**
   * Throttle mode.
   * @type {boolean}
   */
  throttle: true,

  /**
   * Target FPS (NTSC / PAL).
   * @type {number}
   */
  fps: 0,

  /**
   * Counter for frameskip.
   * @type {number}
   */
  frameskip_counter: 0,

  /**
   * SMS Pause button pressed?
   * @type {boolean}
   */
  pause_button: false,

  /**
   * SMS mode.
   * @type {boolean}
   */
  is_sms: true,

  /**
   * GG mode.
   * @type {boolean}
   */
  is_gg: false,

  // Audio Related
  /**
   * Sound enabled.
   * @type {boolean}
   */
  soundEnabled: true,

  /**
   * Audio context.
   * @type {AudioContext}
   */
  audioContext: null,

  /**
   * Audio buffer.
   * @type {AudioBuffer}
   */
  audioBuffer: null,

  /**
   * Offset into audio buffer.
   * @type {number}
   */
  audioBufferOffset: 0,

  /**
   * Number of samples to generate per frame.
   * @type {number}
   */
  samplesPerFrame: 0,

  /** How many samples to generate per line.
   * @type {Array.<number>}
   */
  samplesPerLine: [],

  // Emulation Related
  /**
   * Emulated screen width.
   * @type {number}
   */
  emuWidth: 0,

  /**
   * Emulated screen height.
   * @type {number}
   */
  emuHeight: 0,

  /**
   * @type {number}
   */
  fpsFrameCount: 0,

  /**
   * @type {number}
   * @private
   */
  z80Time: 0,

  /**
   * @type {number}
   * @private
   */
  drawTime: 0,

  /**
   * @type {number}
   * @private
   */
  z80TimeCounter: 0,

  /**
   * @type {number}
   * @private
   */
  drawTimeCounter: 0,

  /**
   * @type {number}
   * @private
   */
  frameCount: 0,

  /**
   * The data of the rom currently loaded.
   * @type {string}
   */
  romData: '',

  /**
   * The file name of the current loaded rom.
   * @type {string}
   */
  romFileName: '',

  // Debugger
  lineno: 0,

  /**
   * Reset all emulation.
   */
  reset: function() {
    // Setup Default Timing
    this.setVideoTiming(this.vdp.videoMode);

    this.frameCount = 0;
    this.frameskip_counter = this.frameSkip;

    this.keyboard.reset();
    this.ui.reset();
    this.vdp.reset();
    this.ports.reset();
    this.cpu.reset();
    if (ENABLE_DEBUGGER) {
      this.cpu.resetDebug();
    }

    if (DEBUG) {
      clearInterval(this.fpsInterval);
    }
  },

  start: function() {
    var self = this;

    if (!this.isRunning) {
      this.isRunning = true;

      this.ui.requestAnimationFrame(this.frame.bind(this), this.ui.screen);

      if (DEBUG) {
        this.resetFps();
        this.fpsInterval = setInterval(function() {
          self.printFps();
        }, fpsInterval);
      }
    }

    this.ui.updateStatus('Running');
  },

  stop: function() {
    if (DEBUG) {
      clearInterval(this.fpsInterval);
    }
    this.isRunning = false;
  },

  /**
   * Draw one frame on the screen.
   */
  frame: function() {
    if (this.isRunning) {
      this.cpu.frame();

      this.fpsFrameCount++;
      this.ui.requestAnimationFrame(this.frame.bind(this), this.ui.screen);
    }
  },

  /**
   * At the moment, execute one frame, but should be changed to be executed at each instruction.
   */
  nextStep: function() {
    this.cpu.frame();
  },

  /**
   * Set SMS Mode.
   */
  setSMS: function() {
    this.is_sms = true;
    this.is_gg = false;

    this.vdp.h_start = 0;
    this.vdp.h_end = 32;

    this.emuWidth = SMS_WIDTH;
    this.emuHeight = SMS_HEIGHT;
  },

  /**
   * Set GG Mode.
   */
  setGG: function() {
    this.is_gg = true;
    this.is_sms = false;

    this.vdp.h_start = 6;
    this.vdp.h_end = 26;

    this.emuWidth = GG_WIDTH;
    this.emuHeight = GG_HEIGHT;
  },

  /**
   * Set NTSC/PAL Timing.
   *
   * Exact timings from:
   * http://www.smspower.org/dev/docs/wiki/Systems/MasterSystem
   */
  setVideoTiming: function(mode) {
    var clockSpeedHz = 0,
      i,
      v;

    // Game Gear should only work in NTSC
    if (mode === NTSC || this.is_gg) {
      this.fps = 60;
      this.no_of_scanlines = SMS_Y_PIXELS_NTSC;
      clockSpeedHz = CLOCK_NTSC;
    } else {
      // PAL
      this.fps = 50;
      this.no_of_scanlines = SMS_Y_PIXELS_PAL;
      clockSpeedHz = CLOCK_PAL;
    }

    // Add one manually here for rounding accuracy
    this.cyclesPerLine = Math.round(
      clockSpeedHz / this.fps / this.no_of_scanlines + 1
    );
    this.vdp.videoMode = mode;

    // Setup appropriate sound buffer
    if (this.soundEnabled) {
      this.psg.init(clockSpeedHz);

      this.samplesPerFrame = Math.round(SAMPLE_RATE / this.fps);

      if (!this.audioBuffer || this.audioBuffer.length !== this.samplesPerFrame) {
        if (this.audioContext && typeof this.audioContext.createBuffer === 'function') {
          this.audioBuffer = this.audioContext.createBuffer(1, this.samplesPerFrame, SAMPLE_RATE);
        } else {
          this.audioBuffer = { length: this.samplesPerFrame, getChannelData: function() { return new Float32Array(this.samplesPerFrame); } };
        }
      }

      if (
        this.samplesPerLine.length === 0 ||
        this.samplesPerLine.length !== this.no_of_scanlines
      ) {
        this.samplesPerLine = new Array(this.no_of_scanlines);

        var fractional = 0;

        // Calculate number of sound samples to generate per scanline
        for (i = 0; i < this.no_of_scanlines; i++) {
          v = (this.samplesPerFrame << 16) / this.no_of_scanlines + fractional;
          fractional = v - ((v >> 16) << 16);
          this.samplesPerLine[i] = v >> 16;
        }
      }
    }

    //setFrameSkip(frameSkip);
  },

  // Sound Output
  /**
   * @param {Array.<number>} buffer
   */
  audioOutput: function(buffer) {
    this.ui.writeAudio(buffer);
  },

  // Screen Rendering
  doRepaint: function() {
    this.ui.writeFrame();
  },

  printFps: function() {
    var now = JSSMS.Utils.getTimestamp();
    var s =
      'Running: ' +
      (this.fpsFrameCount / ((now - this.lastFpsTime) / 1000)).toFixed(2) +
      ' FPS';
    this.ui.updateStatus(s);
    this.fpsFrameCount = 0;
    this.lastFpsTime = now;
  },

  resetFps: function() {
    this.lastFpsTime = JSSMS.Utils.getTimestamp();
    this.fpsFrameCount = 0;
  },

  /**
   * @param {number} line
   */
  updateSound: function(line) {
    if (line === 0) {
      this.audioBufferOffset = 0;
    }

    var samplesToGenerate = this.samplesPerLine[line];
    this.psg.update(
      this.audioBuffer,
      this.audioBufferOffset,
      samplesToGenerate
    );
    this.audioBufferOffset += samplesToGenerate;
  },

  // File Loading Routines
  /**
   * Bypass config file and directly load rom.
   *
   * \@todo readRomDirectly() and loadROM() can be confusing. Renaming needed.
   *
   * @param {string} data Rom binary data.
   * @param {string} fileName Filename to load.
   * @return {boolean}
   */
  readRomDirectly: function(data, fileName) {
    var pages;
    var extension = JSSMS.Utils.getFileExtension(fileName);
    var size = data.length;

    // Toggle SMS / GG emulation.
    if (extension === 'gg') {
      this.setGG();
    } else {
      this.setSMS();
    }

    pages = this.loadROM(data, size);

    if (pages === null) {
      return false;
    }

    // Default Mapping (Needed or Shinobi doesn't work)
    this.cpu.resetMemory(pages);

    // Store these info locally to enable rom reloading
    this.romData = data;
    this.romFileName = fileName;

    return true;
  },

  /**
   * \@todo readRomDirectly() and loadROM() can be confusing. Renaming needed.
   *
   * @param {string} data Rom binary data.
   * @param {number} size
   * @return {Array.<Array.<number>>}
   */
  loadROM: function(data, size) {
    var i, j;
    var number_of_pages = Math.ceil(size / PAGE_SIZE);
    var pages = new Array(number_of_pages);

    for (i = 0; i < number_of_pages; i++) {
      pages[i] = JSSMS.Utils.Array(PAGE_SIZE);
      if (SUPPORT_DATAVIEW) {
        for (j = 0; j < PAGE_SIZE; j++) {
          var itemIdx = i * PAGE_SIZE + j;
          var val = itemIdx < size ? (typeof data === 'string' ? data.charCodeAt(itemIdx) : data[itemIdx]) : 0;
          pages[i].setUint8(j, val & 0xff);
        }
      } else {
        for (j = 0; j < PAGE_SIZE; j++) {
          var itemIdx = i * PAGE_SIZE + j;
          var val = itemIdx < size ? (typeof data === 'string' ? data.charCodeAt(itemIdx) : data[itemIdx]) : 0;
          pages[i][j] = val & 0xff;
        }
      }
    }

    return pages;
  },

  /**
   * Reload a rom previously set in memory. Returns true if a rom was
   * successfully reloaded.
   *
   * @return {boolean}
   */
  reloadRom: function() {
    if (this.romData !== '' && this.romFileName !== '') {
      return this.readRomDirectly(this.romData, this.romFileName);
    } else {
      return false;
    }
  },
};

'use strict';

// Fix console inconsistencies on browsers.
(function() {
  if (!('console' in window)) {
    window.console = {
      log: function() {},
      error: function() {},
    };
  } else if (!('bind' in window.console.log)) {
    // native functions in IE9 might not have bind.
    window.console.log = (function(fn) {
      return function(msg) {
        return fn(msg);
      };
    })(window.console.log);
    window.console.error = (function(fn) {
      return function(msg) {
        return fn(msg);
      };
    })(window.console.error);
  }
})();

JSSMS.Utils = {
  /**
   * Generate a random integer.
   *
   * @param {number} range Generate random numbers from 0 to range.
   *              A range of 4 would generate numbers between 0 and 3.
   * @return {number} A random integer.
   */
  rndInt: function(range) {
    return Math.round(Math.random() * range);
  },

  Uint8Array: (function() {
    /**
     * @param {number|ArrayBufferView|Array.<number>|ArrayBuffer} length or array or buffer.
     * @return {Uint8Array}
     */
    if (SUPPORT_TYPED_ARRAYS) {
      return Uint8Array;
    } else {
      /**
       * @param {number} length
       * @return {Array}
       */
      return Array;
    }
  })(),

  Uint16Array: (function() {
    /**
     * @param {number|ArrayBufferView|Array.<number>|ArrayBuffer} length or array or buffer.
     * @return {Uint16Array}
     */
    if (SUPPORT_TYPED_ARRAYS) {
      return Uint16Array;
    } else {
      /**
       * @param {number} length
       * @return {Array}
       */
      return Array;
    }
  })(),

  /**
   * Simple polyfill for DataView and ArrayBuffer.
   * \@todo We must use Uint8Array for browsers supporting them but not DataView.
   */
  Array: (function() {
    if (SUPPORT_DATAVIEW) {
      /**
       * @param {number} length
       * @return {DataView}
       */
      return function(length) {
        return new DataView(new ArrayBuffer(length));
      };
    } else {
      /**
       * @param {number} length
       * @return {Array}
       */
      return Array;
    }
  })(),

  /**
   * Copies an array from the specified source array, beginning at the
   * specified position, to the specified position of the destination array.
   */
  copyArrayElements: (function() {
    if (SUPPORT_DATAVIEW) {
      /**
       * @param {DataView} src The source DataView.
       * @param {number} srcPos The specified position of the source array.
       * @param {DataView} dest The destination DataView.
       * @param {number} destPos The specified position of the destination array.
       * @param {number} length The length of the source array portion to copy.
       */
      return function(src, srcPos, dest, destPos, length) {
        while (length--) {
          dest.setInt8(destPos + length, src.getInt8(srcPos + length));
        }
      };
    } else {
      /**
       * @param {Array.<number>} src The source array.
       * @param {number} srcPos The specified position of the source array.
       * @param {Array.<number>} dest The destination array.
       * @param {number} destPos The specified position of the destination array.
       * @param {number} length The length of the source array portion to copy.
       */
      return function(src, srcPos, dest, destPos, length) {
        while (length--) {
          dest[destPos + length] = src[srcPos + length];
        }
      };
    }
  })(),

  /**
   * A proxy for console that is activated in DEBUG mode only.
   */
  console: {
    log: (function() {
      if (DEBUG) {
        return window.console.log.bind(window.console);
      }
      return function(var_args) {};
    })(),
    error: (function() {
      if (DEBUG) {
        return window.console.error.bind(window.console);
      }
      return function(var_args) {};
    })(),
    /**
     * @todo Develop a polyfill for non supporting browsers like IE.
     */
    time: (function() {
      if (DEBUG && window.console.time) {
        return window.console.time.bind(window.console);
      }
      return function(label) {};
    })(),
    /**
     * @todo Develop a polyfill for non supporting browsers like IE.
     */
    timeEnd: (function() {
      if (DEBUG && window.console.timeEnd) {
        return window.console.timeEnd.bind(window.console);
      }
      return function(label) {};
    })(),
  },

  /**
   * Apply a function recursively on an object and its children.
   *
   * @param {Object} object
   * @param {Function} fn
   * @return {Object} object.
   */
  traverse: function(object, fn) {
    var key, child;

    /*// Return false to stop the recursive process.
     if ( === false) {
     return;
     }*/
    fn.call(null, object);

    for (key in object) {
      if (object.hasOwnProperty(key)) {
        child = object[key];
        if (Object(child) === child) {
          object[key] = JSSMS.Utils.traverse(child, fn);
        }
      }
    }

    return object;
  },

  /**
   * Return the current timestamp in a fast way.
   *
   * @return {number} The current timestamp.
   */
  getTimestamp: (function() {
    if (window.performance && window.performance.now) {
      return window.performance.now.bind(window.performance);
    } else {
      return function() {
        return new Date().getTime();
      };
    }
  })(),

  /**
   * Get a hex from a decimal. Pad with 0 if necessary.
   *
   * @param {number} dec A decimal integer.
   * @return {string} A hex representation of the input.
   */
  toHex: function(dec) {
    var minus = dec < 0;
    var hex = Math.abs(dec)
      .toString(16)
      .toUpperCase();
    if (hex.length % 2) {
      hex = '0' + hex;
    }

    if (minus) {
      return '-0x' + hex;
    }

    return '0x' + hex;
  },

  /**
   * Determine support and prefix of HTML5 features. Returns the prefix of the
   * implementation, or false otherwise.
   *
   * @param {Array.<string>} arr An array of prefixes.
   * @param {Object=} obj An object to check the prefix against, default to `window.document`.
   * @return {string|boolean} The implementation prefix or false.
   */
  getPrefix: function(arr, obj) {
    var prefix = false;

    if (obj === undefined) {
      obj = document;
    }

    arr.some(function(prop) {
      if (prop in obj) {
        prefix = prop;
        return true;
      }
      return false;
    });

    return prefix;
  },

  /**
   * Given a file name, returns the extension.
   *
   * @param {string} fileName The filename, possibly including a path.
   * @return {string} The extension of the file without the leading dot.
   */
  getFileExtension: function(fileName) {
    if (typeof fileName !== 'string') {
      return '';
    }

    return fileName
      .split('.')
      .pop()
      .toLowerCase();
  },

  /**
   * Given a file name, returns the filename, without path or extension.
   *
   * @param {string} fileName The filename, possibly including a path.
   * @return {string} The filename of the file.
   */
  getFileName: function(fileName) {
    if (typeof fileName !== 'string') {
      return '';
    }

    var parts = fileName.split('.');
    parts.pop();
    return parts
      .join('.')
      .split('/')
      .pop();
  },

  /**
   * CRC32 algorithm.
   * @see http://stackoverflow.com/questions/18638900/javascript-crc32
   * @see http://jsperf.com/js-crc32
   *
   * @param {string} str
   * @returns {number}
   */
  crc32: function(str) {
    // Lazy initialisation pattern by David Bruant (@DavidBruant).
    var crcTable = (function makeCRCTable() {
      var c = 0;
      var crcTable = new Uint32Array(256);
      for (var n = 0; n < 256; n++) {
        c = n;
        for (var k = 0; k < 8; k++) {
          c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        }
        crcTable[n] = c;
      }

      return crcTable;
    })();

    this.crc32 = function(str) {
      var crc = 0 ^ -1;

      for (var i = 0; i < str.length; i++) {
        crc = (crc >>> 8) ^ crcTable[(crc ^ str.charCodeAt(i)) & 0xff];
      }

      return (crc ^ -1) >>> 0;
    };

    return this.crc32(str);
  },

  /**
   * Return true if current browser is IE. Not used at the moment.
   *
   * @return {boolean}
   */
  isIE: function() {
    return (
      /msie/i.test(navigator.userAgent) && !/opera/i.test(navigator.userAgent)
    );
  },
};

'use strict';

/** Speedup hack to set tstates to '0' on halt instruction. */
/** @const */ var HALT_SPEEDUP = true;

/** carry (set when a standard carry occurred). */
/** @const */ var F_CARRY = 0x01;

/** negative (set when instruction is subtraction, clear when addition). */
/** @const */ var F_NEGATIVE = 0x02;

/** true indicates even parity in the result, false for 2s complement sign overflow. */
/** @const */ var F_PARITY = 0x04;

/** true indicates even parity in the result, false for 2s complement sign overflow. */
/** @const */ var F_OVERFLOW = 0x04;

/** bit3 (usually a copy of bit 3 of the result). */
/** @const */ var F_BIT3 = 0x08;

/** half carry (set when a carry occurred between bit 3 / 4 of result - used for BCD. */
/** @const */ var F_HALFCARRY = 0x10;

/** bit5 (usually a copy of bit 5 of the result). */
/** @const */ var F_BIT5 = 0x20;

/** zero (set when a result is zero). */
/** @const */ var F_ZERO = 0x40;

/** sign (set when a result is negative). */
/** @const */ var F_SIGN = 0x80;

// Misc Helper Stuff
/** Easy bit reference for CB operations. */
/** @const */ var BIT_0 = 0x01;
/** @const */ var BIT_1 = 0x02;
/** @const */ var BIT_2 = 0x04;
/** @const */ var BIT_3 = 0x08;
/** @const */ var BIT_4 = 0x10;
/** @const */ var BIT_5 = 0x20;
/** @const */ var BIT_6 = 0x40;
/** @const */ var BIT_7 = 0x80;

/**
 * @const
 */
var OP_STATES = new JSSMS.Utils.Uint8Array([
  /*         0  1  2  3  4  5  6  7  8  9  A  B  C  D  E  F */
  /* 0x00 */ 4,
  10,
  7,
  6,
  4,
  4,
  7,
  4,
  4,
  11,
  7,
  6,
  4,
  4,
  7,
  4,
  /* 0x10 */ 8,
  10,
  7,
  6,
  4,
  4,
  7,
  4,
  12,
  11,
  7,
  6,
  4,
  4,
  7,
  4,
  /* 0x20 */ 7,
  10,
  16,
  6,
  4,
  4,
  7,
  4,
  7,
  11,
  16,
  6,
  4,
  4,
  7,
  4,
  /* 0x30 */ 7,
  10,
  13,
  6,
  11,
  11,
  10,
  4,
  7,
  11,
  13,
  6,
  4,
  4,
  7,
  4,
  /* 0x40 */ 4,
  4,
  4,
  4,
  4,
  4,
  7,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  7,
  4,
  /* 0x50 */ 4,
  4,
  4,
  4,
  4,
  4,
  7,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  7,
  4,
  /* 0x60 */ 4,
  4,
  4,
  4,
  4,
  4,
  7,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  7,
  4,
  /* 0x70 */ 7,
  7,
  7,
  7,
  7,
  7,
  4,
  7,
  4,
  4,
  4,
  4,
  4,
  4,
  7,
  4,
  /* 0x80 */ 4,
  4,
  4,
  4,
  4,
  4,
  7,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  7,
  4,
  /* 0x90 */ 4,
  4,
  4,
  4,
  4,
  4,
  7,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  7,
  4,
  /* 0xA0 */ 4,
  4,
  4,
  4,
  4,
  4,
  7,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  7,
  4,
  /* 0xB0 */ 4,
  4,
  4,
  4,
  4,
  4,
  7,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  7,
  4,
  /* 0xC0 */ 5,
  10,
  10,
  10,
  10,
  11,
  7,
  11,
  5,
  10,
  10,
  0,
  10,
  17,
  7,
  11,
  /* 0xD0 */ 5,
  10,
  10,
  11,
  10,
  11,
  7,
  11,
  5,
  4,
  10,
  11,
  10,
  0,
  7,
  11,
  /* 0xE0 */ 5,
  10,
  10,
  19,
  10,
  11,
  7,
  11,
  5,
  4,
  10,
  4,
  10,
  0,
  7,
  11,
  /* 0xF0 */ 5,
  10,
  10,
  4,
  10,
  11,
  7,
  11,
  5,
  6,
  10,
  4,
  10,
  0,
  7,
  11,
]);

/**
 * @const
 */
var OP_CB_STATES = new JSSMS.Utils.Uint8Array([
  /*         0  1  2  3  4  5  6  7  8  9  A  B  C  D  E  F */
  /* 0x00 */ 8,
  8,
  8,
  8,
  8,
  8,
  15,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  15,
  8,
  /* 0x10 */ 8,
  8,
  8,
  8,
  8,
  8,
  15,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  15,
  8,
  /* 0x20 */ 8,
  8,
  8,
  8,
  8,
  8,
  15,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  15,
  8,
  /* 0x30 */ 8,
  8,
  8,
  8,
  8,
  8,
  15,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  15,
  8,
  /* 0x40 */ 8,
  8,
  8,
  8,
  8,
  8,
  12,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  12,
  8,
  /* 0x50 */ 8,
  8,
  8,
  8,
  8,
  8,
  12,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  12,
  8,
  /* 0x60 */ 8,
  8,
  8,
  8,
  8,
  8,
  12,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  12,
  8,
  /* 0x70 */ 8,
  8,
  8,
  8,
  8,
  8,
  12,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  12,
  8,
  /* 0x80 */ 8,
  8,
  8,
  8,
  8,
  8,
  15,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  15,
  8,
  /* 0x90 */ 8,
  8,
  8,
  8,
  8,
  8,
  15,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  15,
  8,
  /* 0xA0 */ 8,
  8,
  8,
  8,
  8,
  8,
  15,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  15,
  8,
  /* 0xB0 */ 8,
  8,
  8,
  8,
  8,
  8,
  15,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  15,
  8,
  /* 0xC0 */ 8,
  8,
  8,
  8,
  8,
  8,
  15,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  15,
  8,
  /* 0xD0 */ 8,
  8,
  8,
  8,
  8,
  8,
  15,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  15,
  8,
  /* 0xE0 */ 8,
  8,
  8,
  8,
  8,
  8,
  15,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  15,
  8,
  /* 0xF0 */ 8,
  8,
  8,
  8,
  8,
  8,
  15,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  15,
  8,
]);

/**
 * @const
 */
var OP_DD_STATES = new JSSMS.Utils.Uint8Array([
  /*         0  1  2  3  4  5  6  7  8  9  A  B  C  D  E  F */
  /* 0x00 */ 4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  15,
  4,
  4,
  4,
  4,
  4,
  4,
  /* 0x10 */ 4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  15,
  4,
  4,
  4,
  4,
  4,
  4,
  /* 0x20 */ 4,
  14,
  20,
  10,
  8,
  8,
  11,
  4,
  4,
  15,
  20,
  10,
  8,
  8,
  11,
  4,
  /* 0x30 */ 4,
  4,
  4,
  4,
  23,
  23,
  19,
  4,
  4,
  15,
  4,
  4,
  4,
  4,
  4,
  4,
  /* 0x40 */ 4,
  4,
  4,
  4,
  8,
  8,
  19,
  4,
  4,
  4,
  4,
  4,
  8,
  8,
  19,
  4,
  /* 0x50 */ 4,
  4,
  4,
  4,
  8,
  8,
  19,
  4,
  4,
  4,
  4,
  4,
  8,
  8,
  19,
  4,
  /* 0x60 */ 8,
  8,
  8,
  8,
  8,
  8,
  19,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  19,
  8,
  /* 0x70 */ 19,
  19,
  19,
  19,
  19,
  19,
  4,
  19,
  4,
  4,
  4,
  4,
  8,
  8,
  19,
  4,
  /* 0x80 */ 4,
  4,
  4,
  4,
  8,
  8,
  19,
  4,
  4,
  4,
  4,
  4,
  8,
  8,
  19,
  4,
  /* 0x90 */ 4,
  4,
  4,
  4,
  8,
  8,
  19,
  4,
  4,
  4,
  4,
  4,
  8,
  8,
  19,
  4,
  /* 0xA0 */ 4,
  4,
  4,
  4,
  8,
  8,
  19,
  4,
  4,
  4,
  4,
  4,
  8,
  8,
  19,
  4,
  /* 0xB0 */ 4,
  4,
  4,
  4,
  8,
  8,
  19,
  4,
  4,
  4,
  4,
  4,
  8,
  8,
  19,
  4,
  /* 0xC0 */ 4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  0,
  4,
  4,
  4,
  4,
  /* 0xD0 */ 4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  /* 0xE0 */ 4,
  14,
  4,
  23,
  4,
  15,
  4,
  4,
  4,
  8,
  4,
  4,
  4,
  4,
  4,
  4,
  /* 0xF0 */ 4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  10,
  4,
  4,
  4,
  4,
  4,
  4,
]);

/**
 * @const
 */
var OP_INDEX_CB_STATES = new JSSMS.Utils.Uint8Array([
  /*         0   1   2   3   4   5   6   7   8   9   A   B   C   D   E   F */
  /* 0x00 */ 23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  /* 0x10 */ 23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  /* 0x20 */ 23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  /* 0x30 */ 23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  /* 0x40 */ 20,
  20,
  20,
  20,
  20,
  20,
  20,
  20,
  20,
  20,
  20,
  20,
  20,
  20,
  20,
  20,
  /* 0x50 */ 20,
  20,
  20,
  20,
  20,
  20,
  20,
  20,
  20,
  20,
  20,
  20,
  20,
  20,
  20,
  20,
  /* 0x60 */ 20,
  20,
  20,
  20,
  20,
  20,
  20,
  20,
  20,
  20,
  20,
  20,
  20,
  20,
  20,
  20,
  /* 0x70 */ 20,
  20,
  20,
  20,
  20,
  20,
  20,
  20,
  20,
  20,
  20,
  20,
  20,
  20,
  20,
  20,
  /* 0x80 */ 23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  /* 0x90 */ 23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  /* 0xA0 */ 23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  /* 0xB0 */ 23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  /* 0xC0 */ 23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  /* 0xD0 */ 23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  /* 0xE0 */ 23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  /* 0xF0 */ 23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
  23,
]);

/**
 * @const
 */
var OP_ED_STATES = new JSSMS.Utils.Uint8Array([
  /*         0  1  2  3  4  5  6  7  8  9  A  B  C  D  E  F */
  /* 0x00 */ 8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  /* 0x10 */ 8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  /* 0x20 */ 8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  /* 0x30 */ 8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  /* 0x40 */ 12,
  12,
  15,
  20,
  8,
  14,
  8,
  9,
  12,
  12,
  15,
  20,
  8,
  14,
  8,
  9,
  /* 0x50 */ 12,
  12,
  15,
  20,
  8,
  14,
  8,
  9,
  12,
  12,
  15,
  20,
  8,
  14,
  8,
  9,
  /* 0x60 */ 12,
  12,
  15,
  20,
  8,
  14,
  8,
  18,
  12,
  12,
  15,
  20,
  8,
  14,
  8,
  18,
  /* 0x70 */ 8,
  12,
  15,
  20,
  8,
  14,
  8,
  8,
  12,
  12,
  15,
  20,
  8,
  14,
  8,
  8,
  /* 0x80 */ 8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  /* 0x90 */ 8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  /* 0xA0 */ 16,
  16,
  16,
  16,
  8,
  8,
  8,
  8,
  16,
  16,
  16,
  16,
  8,
  8,
  8,
  8,
  /* 0xB0 */ 16,
  16,
  16,
  16,
  8,
  8,
  8,
  8,
  16,
  16,
  16,
  16,
  8,
  8,
  8,
  8,
  /* 0xC0 */ 8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  /* 0xD0 */ 8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  /* 0xE0 */ 8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  /* 0xF0 */ 8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
  8,
]);

/**
 * @constructor
 * @param {JSSMS} sms
 */
JSSMS.Z80 = function(sms) {
  this.main = sms;
  this.vdp = sms.vdp;
  this.psg = sms.psg;
  this.port = sms.ports;

  // Z80 Internal Stuff
  /**
   * Program counter.
   * @type {number}
   */
  this.pc = 0;

  /**
   * Stack pointer.
   * @type {number}
   */
  this.sp = 0;

  /**
   * Interrupt mode (0,1,2).
   * \@todo Use {enum} here instead?
   * @type {number}
   */
  this.im = 0;

  /**
   * Interrupt Flip Flop 1.
   * @type {boolean}
   */
  this.iff1 = false;

  /**
   * Interrupt Flip Flop 2.
   * @type {boolean}
   */
  this.iff2 = false;

  /**
   * Halt instruction called.
   * @type {boolean}
   */
  this.halt = false;

  /**
   * EI instruction called.
   * @type {boolean}
   */
  this.EI_inst = false;

  /**
   * Interrupt line status.
   * @type {boolean}
   */
  this.interruptLine = false;

  /**
   * Interrupt vector.
   * @type {number}
   */
  this.interruptVector = 0;

  // Registers
  /** Accumulator register. */
  /** @type {number} */ this.a = 0;
  /** @type {number} */ this.a2 = 0;

  /** BC register. */
  /** @type {number} */ this.b = 0;
  /** @type {number} */ this.c = 0;
  /** @type {number} */ this.b2 = 0;
  /** @type {number} */ this.c2 = 0;

  /** DE register. */
  /** @type {number} */ this.d = 0;
  /** @type {number} */ this.e = 0;
  /** @type {number} */ this.d2 = 0;
  /** @type {number} */ this.e2 = 0;

  /** HL register. */
  /** @type {number} */ this.h = 0;
  /** @type {number} */ this.l = 0;
  /** @type {number} */ this.h2 = 0;
  /** @type {number} */ this.l2 = 0;

  /** IX register. */
  /** @type {number} */ this.ixL = 0;
  /** @type {number} */ this.ixH = 0;

  /** IY register. */
  /** @type {number} */ this.iyL = 0;
  /** @type {number} */ this.iyH = 0;

  /** Memory refresh register. */
  /** @type {number} */ this.r = 0;

  /** Interrupt page address register. */
  /** @type {number} */ this.i = 0;

  // Flag Register
  /** @type {number} */ this.f = 0;
  /** @type {number} */ this.f2 = 0;

  // Opcode timings
  /** Total number of cycles we're executing for. */
  /** @type {number} */ this.totalCycles = 0;

  /** TStates remaining. */
  /** @type {number} */ this.tstates = 0;

  // MEMORY ACCESS
  /**
   * Cartridge ROM pages.
   * @type {Array.<DataView|Array.<number>>}
   */
  this.rom = [];

  /**
   * SRAM.
   * @type {DataView|Array.<number>}
   */
  this.sram = JSSMS.Utils.Array(0x8000);

  /**
   * Cartridge uses SRAM.
   * @type {boolean}
   */
  this.useSRAM = false;

  /**
   * Memory frame registers.
   * @type {Array.<number>}
   */
  this.frameReg = new Array(4);

  /**
   * @type {number}
   */
  this.romPageMask = 0;

  /**
   * Total number of 16K cartridge pages.
   * @type {number}
   */
  this.number_of_pages = 0;

  /**
   * Memory map.
   * @type {DataView|Array.<number>}
   */
  this.memWriteMap = JSSMS.Utils.Array(0x2000);

  // Precalculated tables for speed purposes
  /** Pre-calculated result for DAA instruction. */
  this.DAA_TABLE = new JSSMS.Utils.Uint16Array(0x800);

  /** Sign, Zero table. */
  this.SZ_TABLE = new JSSMS.Utils.Uint8Array(0x100);

  /** Sign, Zero, Parity table. */
  this.SZP_TABLE = new JSSMS.Utils.Uint8Array(0x100);

  /** Flag lookup table for inc8 instruction. */
  this.SZHV_INC_TABLE = new JSSMS.Utils.Uint8Array(0x100);

  /** Flag lookup table for dec8 instruction. */
  this.SZHV_DEC_TABLE = new JSSMS.Utils.Uint8Array(0x100);

  /** Flag lookup table for add/adc instruction. */
  this.SZHVC_ADD_TABLE = new JSSMS.Utils.Uint8Array(2 * 0x100 * 0x100);

  /** Flag lookup table for dec/sbc instruction. */
  this.SZHVC_SUB_TABLE = new JSSMS.Utils.Uint8Array(2 * 0x100 * 0x100);

  /** Flag lookup table for bit instruction. */
  this.SZ_BIT_TABLE = new JSSMS.Utils.Uint8Array(0x100);

  // Generate flag lookups
  this.generateFlagTables();

  // Pre-calculate results for DAA instruction
  this.generateDAATable();

  // Generate memory arrays
  this.generateMemory();

  if (ENABLE_DEBUGGER) {
    // Augment JSSMS.Z80 with methods from JSSMS.Disassembler.
    for (var method in JSSMS.Debugger.prototype) {
      this[method] = JSSMS.Debugger.prototype[method];
    }
  }

  if (ENABLE_COMPILER) {
    this.recompiler = new Recompiler(this);
  }

  if (ENABLE_SERVER_LOGGER) {
    if (SYNC_MODE === WRITE_MODE) {
      this.syncServer = new SyncWriter();
    } else {
      this.syncServer = new SyncReader();
    }

    this.syncServer.tick();

    this.sync = function() {
      this.syncServer.sync16(this.pc, 'pc');
      //this.syncServer.sync16(this.tstates, 'tstates');
      //this.syncServer.sync16(Number(this.interruptLine), 'interruptLine');
      //this.syncServer.sync16(this.sp, 'sp');
      //this.syncServer.sync16(this.getUint16(this.sp), 'getUint16(sp)');
    };
  }
};

JSSMS.Z80.prototype = {
  /**
   * Reset CPU.
   *
   * Note that some of these values aren't what a real Z80 would reset to.
   * They are the values that the SMS BIOS (to the best of my knowledge)
   * sets the registers to.
   *
   * For example, the Index Registers should reset to 0xFFFF
   * but doing so breaks 'Prince of Persia', so they are set to 0x0000.
   *
   * The stack pointer is also reset to 0xDFF0 as opposed to 0x0000.
   */
  reset: function() {
    this.a = this.a2 = 0;

    this.b = this.c = this.b2 = this.c2 = 0;
    this.d = this.e = this.d2 = this.e2 = 0;
    this.h = this.l = this.h2 = this.l2 = 0;
    this.ixL = this.ixH = 0;
    this.iyL = this.iyH = 0;

    this.r = 0;
    this.i = 0;
    this.f = 0;
    this.f2 = 0;

    this.pc = 0x0000;
    this.sp = 0xdff0;

    this.totalCycles = 0;
    this.tstates = 0;

    this.im = 0;
    this.iff1 = false;
    this.iff2 = false;
    this.EI_inst = false;
    this.interruptVector = 0;
    this.halt = false;

    if (ENABLE_COMPILER) {
      this.recompiler.reset();
    }
  },

  /**
   * Emulate one frame.
   */
  frame: function() {
    this.lineno = 0;

    this.tstates += this.main.cyclesPerLine;
    this.totalCycles = this.main.cyclesPerLine;

    if (ACCURATE_INTERRUPT_EMULATION) {
      if (this.interruptLine) {
        this.interrupt(); // Check for interrupt
      }
    }

    while (true) {
      if (ENABLE_DEBUGGER) {
        this.main.ui.updateDisassembly(this.pc);
      }

      if (ENABLE_COMPILER) {
        this.recompile();
      } else {
        if (ENABLE_SERVER_LOGGER) {
          this.sync();
        }

        this.interpret();
      }

      // Execute eol() at end of scanlines and exit at end of frame.
      if (this.tstates <= 0) {
        if (this.eol()) {
          break;
        }
      }
    }

    if (ENABLE_SERVER_LOGGER) {
      // After each frame, we send logs to the server.
      this.syncServer.tick();
    }
  },

  recompile: function() {
    if (this.pc < 0x0400) {
      if (!this.branches[0]['_' + this.pc]) {
        this.recompiler.recompileFromAddress(this.pc, 0, 0);
      }
      this.branches[0]['_' + this.pc].call(this, 0);

      return;
    } else if (this.pc < 0xc000) {
      var frameId = this.pc % 0x4000;
      var frameReg = Math.floor(this.pc / 0x4000);

      if (!this.branches[this.frameReg[frameReg]]['_' + frameId]) {
        this.recompiler.recompileFromAddress(
          this.pc,
          this.frameReg[frameReg],
          frameReg
        );
      }
      this.branches[this.frameReg[frameReg]]['_' + frameId].call(
        this,
        frameReg
      );

      return;
    }

    //throw 'PC: ' + JSSMS.Utils.toHex(this.pc);
    this.interpret();
  },

  /**
   * End of scanline.
   * @return {boolean} Whether the end of the current frame or an interrupt was reached or not.
   */
  eol: function() {
    // PSG
    if (this.main.soundEnabled) {
      this.main.updateSound(this.lineno);
    }

    // VDP
    this.vdp.line = this.lineno;

    // Draw next line.
    if (this.lineno < 192) {
      this.vdp.drawLine(this.lineno);
    }

    // Assert interrupt line if necessary.
    this.vdp.interrupts(this.lineno);

    if (this.interruptLine) {
      this.interrupt(); // Check for interrupt
    }

    this.lineno++;

    // Check for end of frame.
    if (this.lineno >= this.main.no_of_scanlines) {
      this.eof();

      return true;
    }

    // If no, let's continue to next scanline.
    this.tstates += this.main.cyclesPerLine;
    this.totalCycles = this.main.cyclesPerLine;

    return false;
  },

  /**
   * End of frame.
   */
  eof: function() {
    if (this.main.soundEnabled) {
      this.main.audioOutput(this.main.audioBuffer);
    }

    // Only check for pause button once per frame to increase emulation speed.
    if (this.main.pause_button) {
      this.nmi();
      this.main.pause_button = false;
    }

    this.main.doRepaint();
  },

  branches: [Object.create(null), Object.create(null), Object.create(null)],

  /**
   * Run the Z80 interpreter.
   */
  interpret: function() {
    var temp = 0;

    // Main Opcode Switch Rolled In For Speed
    var opcode = this.getUint8(this.pc++); // Fetch & Interpret Opcode

    if (ACCURATE_INTERRUPT_EMULATION) {
      this.EI_inst = false;
    }

    this.tstates -= OP_STATES[opcode]; // Decrement TStates

    if (REFRESH_EMULATION) {
      this.incR();
    }

    switch (opcode) {
      case 0x00:
        break; // NOP
      case 0x01:
        this.setBC(this.getUint16(this.pc++));
        this.pc++;
        break; // LD BC,nn
      case 0x02:
        this.setUint8(this.getBC(), this.a);
        break; // LD (BC),A
      case 0x03:
        this.incBC();
        break; // INC BC
      case 0x04:
        this.b = this.inc8(this.b);
        break; // INC B
      case 0x05:
        this.b = this.dec8(this.b);
        break; // DEC B
      case 0x06:
        this.b = this.getUint8(this.pc++);
        break; // LD B,n
      case 0x07:
        this.rlca_a();
        break; // RLCA
      case 0x08:
        this.exAF();
        break; // EX AF AF'
      case 0x09:
        this.setHL(this.add16(this.getHL(), this.getBC()));
        break; // ADD HL,BC
      case 0x0a:
        this.a = this.getUint8(this.getBC());
        break; // LD A,(BC)
      case 0x0b:
        this.decBC();
        break; // DEC BC
      case 0x0c:
        this.c = this.inc8(this.c);
        break; // INC C
      case 0x0d:
        this.c = this.dec8(this.c);
        break; // DEC C
      case 0x0e:
        this.c = this.getUint8(this.pc++);
        break; // LD C,n
      case 0x0f:
        this.rrca_a();
        break; // RRCA
      case 0x10:
        this.b = (this.b - 1) & 0xff;
        this.jr(this.b !== 0);
        break; // DJNZ (PC+e)
      case 0x11:
        this.setDE(this.getUint16(this.pc++));
        this.pc++;
        break; // LD DE,nn
      case 0x12:
        this.setUint8(this.getDE(), this.a);
        break; // LD (DE),A
      case 0x13:
        this.incDE();
        break; // INC DE
      case 0x14:
        this.d = this.inc8(this.d);
        break; // INC D
      case 0x15:
        this.d = this.dec8(this.d);
        break; // DEC D
      case 0x16:
        this.d = this.getUint8(this.pc++);
        break; // LD D,n
      case 0x17:
        this.rla_a();
        break; // RLA
      case 0x18:
        this.pc += this.getInt8(this.pc);
        break; // JR (PC+e)
      case 0x19:
        this.setHL(this.add16(this.getHL(), this.getDE()));
        break; // ADD HL,DE
      case 0x1a:
        this.a = this.getUint8(this.getDE());
        break; // LD A,(DE)
      case 0x1b:
        this.decDE();
        break; // DEC DE
      case 0x1c:
        this.e = this.inc8(this.e);
        break; // INC E
      case 0x1d:
        this.e = this.dec8(this.e);
        break; // DEC E
      case 0x1e:
        this.e = this.getUint8(this.pc++);
        break; // LD E,n
      case 0x1f:
        this.rra_a();
        break; // RRA
      case 0x20:
        this.jr(!((this.f & F_ZERO) !== 0));
        break; // JR NZ,(PC+e)
      case 0x21:
        this.setHL(this.getUint16(this.pc++));
        this.pc++;
        break; // LD HL,nn
      case 0x22:
        this.setUint16(this.getUint16(this.pc++), this.getHL());
        this.pc++;
        break; // LD (nn),HL
      case 0x23:
        this.incHL();
        break; // INC HL
      case 0x24:
        this.h = this.inc8(this.h);
        break; // INC H
      case 0x25:
        this.h = this.dec8(this.h);
        break; // DEC H
      case 0x26:
        this.h = this.getUint8(this.pc++);
        break; // LD H,n
      case 0x27:
        this.daa();
        break; // DAA
      case 0x28:
        this.jr((this.f & F_ZERO) !== 0);
        break; // JR Z,(PC+e)
      case 0x29:
        this.setHL(this.add16(this.getHL(), this.getHL()));
        break; // ADD HL,HL
      case 0x2a:
        this.setHL(this.getUint16(this.getUint16(this.pc++)));
        this.pc++;
        break; // LD HL,(nn)
      case 0x2b:
        this.decHL();
        break; // DEC HL
      case 0x2c:
        this.l = this.inc8(this.l);
        break; // INC L
      case 0x2d:
        this.l = this.dec8(this.l);
        break; // DEC L
      case 0x2e:
        this.l = this.getUint8(this.pc++);
        break; // LD L,n
      case 0x2f:
        this.cpl_a();
        break; // CPL
      case 0x30:
        this.jr(!((this.f & F_CARRY) !== 0));
        break; // JR NC,(PC+e)
      case 0x31:
        this.sp = this.getUint16(this.pc++);
        this.pc++;
        break; // LD SP,nn
      case 0x32:
        this.setUint8(this.getUint16(this.pc++), this.a);
        this.pc++;
        break; // LD (nn),A
      case 0x33:
        this.sp++;
        break; // INC SP
      case 0x34:
        this.incMem(this.getHL());
        break; // INC (HL)
      case 0x35:
        this.decMem(this.getHL());
        break; // DEC (HL)
      case 0x36:
        this.setUint8(this.getHL(), this.getUint8(this.pc++));
        break; // LD (HL),n
      case 0x37:
        this.f |= F_CARRY;
        this.f &= ~F_NEGATIVE;
        this.f &= ~F_HALFCARRY;
        break; // SCF
      case 0x38:
        this.jr((this.f & F_CARRY) !== 0);
        break; // JR C,(PC+e)
      case 0x39:
        this.setHL(this.add16(this.getHL(), this.sp));
        break; // ADD HL,SP
      case 0x3a:
        this.a = this.getUint8(this.getUint16(this.pc++));
        this.pc++;
        break; // LD A,(nn)
      case 0x3b:
        this.sp--;
        break; // DEC SP
      case 0x3c:
        this.a = this.inc8(this.a);
        break; // INC A
      case 0x3d:
        this.a = this.dec8(this.a);
        break; // DEC A
      case 0x3e:
        this.a = this.getUint8(this.pc++);
        break; // LD A,n
      case 0x3f:
        this.ccf();
        break; // CCF
      case 0x40:
        break; // LD B,B
      case 0x41:
        this.b = this.c;
        break; // LD B,C
      case 0x42:
        this.b = this.d;
        break; // LD B,D
      case 0x43:
        this.b = this.e;
        break; // LD B,E
      case 0x44:
        this.b = this.h;
        break; // LD B,H
      case 0x45:
        this.b = this.l;
        break; // LD B,L
      case 0x46:
        this.b = this.getUint8(this.getHL());
        break; // LD B,(HL)
      case 0x47:
        this.b = this.a;
        break; // LD B,A
      case 0x48:
        this.c = this.b;
        break; // LD C,B
      case 0x49:
        break; // LD C,C
      case 0x4a:
        this.c = this.d;
        break; // LD C,D
      case 0x4b:
        this.c = this.e;
        break; // LD C,E
      case 0x4c:
        this.c = this.h;
        break; // LD C,H
      case 0x4d:
        this.c = this.l;
        break; // LD C,L
      case 0x4e:
        this.c = this.getUint8(this.getHL());
        break; // LD C,(HL)
      case 0x4f:
        this.c = this.a;
        break; // LD C,A
      case 0x50:
        this.d = this.b;
        break; // LD D,B
      case 0x51:
        this.d = this.c;
        break; // LD D,C
      case 0x52:
        break; // LD D,D
      case 0x53:
        this.d = this.e;
        break; // LD D,E
      case 0x54:
        this.d = this.h;
        break; // LD D,H
      case 0x55:
        this.d = this.l;
        break; // LD D,L
      case 0x56:
        this.d = this.getUint8(this.getHL());
        break; // LD D,(HL)
      case 0x57:
        this.d = this.a;
        break; // LD D,A
      case 0x58:
        this.e = this.b;
        break; // LD E,B
      case 0x59:
        this.e = this.c;
        break; // LD E,C
      case 0x5a:
        this.e = this.d;
        break; // LD E,D
      case 0x5b:
        break; // LD E,E
      case 0x5c:
        this.e = this.h;
        break; // LD E,H
      case 0x5d:
        this.e = this.l;
        break; // LD E,L
      case 0x5e:
        this.e = this.getUint8(this.getHL());
        break; // LD E,(HL)
      case 0x5f:
        this.e = this.a;
        break; // LD E,A
      case 0x60:
        this.h = this.b;
        break; // LD H,B
      case 0x61:
        this.h = this.c;
        break; // LD H,C
      case 0x62:
        this.h = this.d;
        break; // LD H,D
      case 0x63:
        this.h = this.e;
        break; // LD H,E
      case 0x64:
        break; // LD H,H
      case 0x65:
        this.h = this.l;
        break; // LD H,L
      case 0x66:
        this.h = this.getUint8(this.getHL());
        break; // LD H,(HL)
      case 0x67:
        this.h = this.a;
        break; // LD H,A
      case 0x68:
        this.l = this.b;
        break; // LD L,B
      case 0x69:
        this.l = this.c;
        break; // LD L,C
      case 0x6a:
        this.l = this.d;
        break; // LD L,D
      case 0x6b:
        this.l = this.e;
        break; // LD L,E
      case 0x6c:
        this.l = this.h;
        break; // LD L,H
      case 0x6d:
        break; // LD L,L
      case 0x6e:
        this.l = this.getUint8(this.getHL());
        break; // LD L,(HL)
      case 0x6f:
        this.l = this.a;
        break; // LD L,A
      case 0x70:
        this.setUint8(this.getHL(), this.b);
        break; // LD (HL),B
      case 0x71:
        this.setUint8(this.getHL(), this.c);
        break; // LD (HL),C
      case 0x72:
        this.setUint8(this.getHL(), this.d);
        break; // LD (HL),D
      case 0x73:
        this.setUint8(this.getHL(), this.e);
        break; // LD (HL),E
      case 0x74:
        this.setUint8(this.getHL(), this.h);
        break; // LD (HL),H
      case 0x75:
        this.setUint8(this.getHL(), this.l);
        break; // LD (HL),L
      case 0x76:
        if (HALT_SPEEDUP) {
          this.tstates = 0;
        }
        this.halt = true;
        this.pc--;
        break; // HALT
      case 0x77:
        this.setUint8(this.getHL(), this.a);
        break; // LD (HL),A
      case 0x78:
        this.a = this.b;
        break; // LD A,B
      case 0x79:
        this.a = this.c;
        break; // LD A,C
      case 0x7a:
        this.a = this.d;
        break; // LD A,D
      case 0x7b:
        this.a = this.e;
        break; // LD A,E
      case 0x7c:
        this.a = this.h;
        break; // LD A,H
      case 0x7d:
        this.a = this.l;
        break; // LD A,L
      case 0x7e:
        this.a = this.getUint8(this.getHL());
        break; // LD A,(HL)
      case 0x7f:
        break; // LD A,A
      case 0x80:
        this.add_a(this.b);
        break; // ADD A,B
      case 0x81:
        this.add_a(this.c);
        break; // ADD A,C
      case 0x82:
        this.add_a(this.d);
        break; // ADD A,D
      case 0x83:
        this.add_a(this.e);
        break; // ADD A,E
      case 0x84:
        this.add_a(this.h);
        break; // ADD A,H
      case 0x85:
        this.add_a(this.l);
        break; // ADD A,L
      case 0x86:
        this.add_a(this.getUint8(this.getHL()));
        break; // ADD A,(HL)
      case 0x87:
        this.add_a(this.a);
        break; // ADD A,A
      case 0x88:
        this.adc_a(this.b);
        break; // ADC A,B
      case 0x89:
        this.adc_a(this.c);
        break; // ADC A,C
      case 0x8a:
        this.adc_a(this.d);
        break; // ADC A,D
      case 0x8b:
        this.adc_a(this.e);
        break; // ADC A,E
      case 0x8c:
        this.adc_a(this.h);
        break; // ADC A,H
      case 0x8d:
        this.adc_a(this.l);
        break; // ADC A,L
      case 0x8e:
        this.adc_a(this.getUint8(this.getHL()));
        break; // ADC A,(HL)
      case 0x8f:
        this.adc_a(this.a);
        break; // ADC A,A
      case 0x90:
        this.sub_a(this.b);
        break; // SUB A,B
      case 0x91:
        this.sub_a(this.c);
        break; // SUB A,C
      case 0x92:
        this.sub_a(this.d);
        break; // SUB A,D
      case 0x93:
        this.sub_a(this.e);
        break; // SUB A,E
      case 0x94:
        this.sub_a(this.h);
        break; // SUB A,H
      case 0x95:
        this.sub_a(this.l);
        break; // SUB A,L
      case 0x96:
        this.sub_a(this.getUint8(this.getHL()));
        break; // SUB A,(HL)
      case 0x97:
        this.sub_a(this.a);
        break; // SUB A,A
      case 0x98:
        this.sbc_a(this.b);
        break; // SBC A,B
      case 0x99:
        this.sbc_a(this.c);
        break; // SBC A,C
      case 0x9a:
        this.sbc_a(this.d);
        break; // SBC A,D
      case 0x9b:
        this.sbc_a(this.e);
        break; // SBC A,E
      case 0x9c:
        this.sbc_a(this.h);
        break; // SBC A,H
      case 0x9d:
        this.sbc_a(this.l);
        break; // SBC A,L
      case 0x9e:
        this.sbc_a(this.getUint8(this.getHL()));
        break; // SBC A,(HL)
      case 0x9f:
        this.sbc_a(this.a);
        break; // SBC A,A
      case 0xa0:
        this.f = this.SZP_TABLE[(this.a &= this.b)] | F_HALFCARRY;
        break; // AND A,B
      case 0xa1:
        this.f = this.SZP_TABLE[(this.a &= this.c)] | F_HALFCARRY;
        break; // AND A,C
      case 0xa2:
        this.f = this.SZP_TABLE[(this.a &= this.d)] | F_HALFCARRY;
        break; // AND A,D
      case 0xa3:
        this.f = this.SZP_TABLE[(this.a &= this.e)] | F_HALFCARRY;
        break; // AND A,E
      case 0xa4:
        this.f = this.SZP_TABLE[(this.a &= this.h)] | F_HALFCARRY;
        break; // AND A,H
      case 0xa5:
        this.f = this.SZP_TABLE[(this.a &= this.l)] | F_HALFCARRY;
        break; // AND A,L
      case 0xa6:
        this.f =
          this.SZP_TABLE[(this.a &= this.getUint8(this.getHL()))] | F_HALFCARRY;
        break; // AND A,(HL)
      case 0xa7:
        this.f = this.SZP_TABLE[this.a] | F_HALFCARRY;
        break; // AND A,A
      case 0xa8:
        this.f = this.SZP_TABLE[(this.a ^= this.b)];
        break; // XOR A,B
      case 0xa9:
        this.f = this.SZP_TABLE[(this.a ^= this.c)];
        break; // XOR A,C
      case 0xaa:
        this.f = this.SZP_TABLE[(this.a ^= this.d)];
        break; // XOR A,D
      case 0xab:
        this.f = this.SZP_TABLE[(this.a ^= this.e)];
        break; // XOR A,E
      case 0xac:
        this.f = this.SZP_TABLE[(this.a ^= this.h)];
        break; // XOR A,H
      case 0xad:
        this.f = this.SZP_TABLE[(this.a ^= this.l)];
        break; // XOR A,L
      case 0xae:
        this.f = this.SZP_TABLE[(this.a ^= this.getUint8(this.getHL()))];
        break; // XOR A,(HL)
      case 0xaf:
        this.f = this.SZP_TABLE[(this.a = 0)];
        break; // XOR A,A
      case 0xb0:
        this.f = this.SZP_TABLE[(this.a |= this.b)];
        break; // OR A,B
      case 0xb1:
        this.f = this.SZP_TABLE[(this.a |= this.c)];
        break; // OR A,C
      case 0xb2:
        this.f = this.SZP_TABLE[(this.a |= this.d)];
        break; // OR A,D
      case 0xb3:
        this.f = this.SZP_TABLE[(this.a |= this.e)];
        break; // OR A,E
      case 0xb4:
        this.f = this.SZP_TABLE[(this.a |= this.h)];
        break; // OR A,H
      case 0xb5:
        this.f = this.SZP_TABLE[(this.a |= this.l)];
        break; // OR A,L
      case 0xb6:
        this.f = this.SZP_TABLE[(this.a |= this.getUint8(this.getHL()))];
        break; // OR A,(HL)
      case 0xb7:
        this.f = this.SZP_TABLE[this.a];
        break; // OR A,A
      case 0xb8:
        this.cp_a(this.b);
        break; // CP A,B
      case 0xb9:
        this.cp_a(this.c);
        break; // CP A,C
      case 0xba:
        this.cp_a(this.d);
        break; // CP A,D
      case 0xbb:
        this.cp_a(this.e);
        break; // CP A,E
      case 0xbc:
        this.cp_a(this.h);
        break; // CP A,H
      case 0xbd:
        this.cp_a(this.l);
        break; // CP A,L
      case 0xbe:
        this.cp_a(this.getUint8(this.getHL()));
        break; // CP A,(HL)
      case 0xbf:
        this.cp_a(this.a);
        break; // CP A,A
      case 0xc0:
        this.ret((this.f & F_ZERO) === 0);
        break; // RET NZ
      case 0xc1:
        this.setBC(this.getUint16(this.sp));
        this.sp += 2;
        break; // POP BC
      case 0xc2:
        this.jp((this.f & F_ZERO) === 0);
        break; // JP NZ,(nn)
      case 0xc3:
        this.pc = this.getUint16(this.pc);
        break; // JP (nn)
      case 0xc4:
        this.call((this.f & F_ZERO) === 0);
        break; // CALL NZ (nn)
      case 0xc5:
        this.push(this.getBC());
        break; // PUSH BC
      case 0xc6:
        this.add_a(this.getUint8(this.pc++));
        break; // ADD A,n
      case 0xc7:
        this.push(this.pc);
        this.pc = 0x00;
        break; // RST 00H
      case 0xc8:
        this.ret((this.f & F_ZERO) !== 0);
        break; // RET Z
      case 0xc9:
        this.pc = this.getUint16(this.sp);
        this.sp += 2;
        break; // RET
      case 0xca:
        this.jp((this.f & F_ZERO) !== 0);
        break; // JP Z,(nn)
      case 0xcb:
        this.doCB(this.getUint8(this.pc++));
        break; // CB Opcode
      case 0xcc:
        this.call((this.f & F_ZERO) !== 0);
        break; // CALL Z (nn)
      case 0xcd:
        this.push(this.pc + 2);
        this.pc = this.getUint16(this.pc);
        break; // CALL (nn)
      case 0xce:
        this.adc_a(this.getUint8(this.pc++));
        break; // ADC A,n
      case 0xcf:
        this.push(this.pc);
        this.pc = 0x08;
        break; // RST 08H
      case 0xd0:
        this.ret((this.f & F_CARRY) === 0);
        break; // RET NC
      case 0xd1:
        this.setDE(this.getUint16(this.sp));
        this.sp += 2;
        break; // POP DE
      case 0xd2:
        this.jp((this.f & F_CARRY) === 0);
        break; // JP NC,(nn)
      case 0xd3:
        this.port.out(this.getUint8(this.pc++), this.a);
        break; // OUT (n),A
      case 0xd4:
        this.call((this.f & F_CARRY) === 0);
        break; // CALL NC (nn)
      case 0xd5:
        this.push(this.getDE());
        break; // PUSH DE
      case 0xd6:
        this.sub_a(this.getUint8(this.pc++));
        break; // SUB n
      case 0xd7:
        this.push(this.pc);
        this.pc = 0x10;
        break; // RST 10H
      case 0xd8:
        this.ret((this.f & F_CARRY) !== 0);
        break; // RET C
      case 0xd9:
        this.exBC();
        this.exDE();
        this.exHL();
        break; // EXX
      case 0xda:
        this.jp((this.f & F_CARRY) !== 0);
        break; // JP C,(nn)
      case 0xdb:
        this.a = this.port.in_(this.getUint8(this.pc++));
        break; // IN A,(n)
      case 0xdc:
        this.call((this.f & F_CARRY) !== 0);
        break; // CALL C (nn)
      case 0xdd:
        this.doIndexOpIX(this.getUint8(this.pc++));
        break; // DD Opcode
      case 0xde:
        this.sbc_a(this.getUint8(this.pc++));
        break; // SBC A,n
      case 0xdf:
        this.push(this.pc);
        this.pc = 0x18;
        break; // RST 18H
      case 0xe0:
        this.ret((this.f & F_PARITY) === 0);
        break; // RET PO
      case 0xe1:
        this.setHL(this.getUint16(this.sp));
        this.sp += 2;
        break; // POP HL
      case 0xe2:
        this.jp((this.f & F_PARITY) === 0);
        break; // JP PO,(nn)
      case 0xe3: // EX (SP),HL
        temp = this.getHL();
        this.setHL(this.getUint16(this.sp));
        this.setUint16(this.sp, temp);
        break;
      case 0xe4:
        this.call((this.f & F_PARITY) === 0);
        break; // CALL PO (nn)
      case 0xe5:
        this.push(this.getHL());
        break; // PUSH HL
      case 0xe6:
        this.f =
          this.SZP_TABLE[(this.a &= this.getUint8(this.pc++))] | F_HALFCARRY;
        break; // AND (n)
      case 0xe7:
        this.push(this.pc);
        this.pc = 0x20;
        break; // RST 20H
      case 0xe8:
        this.ret((this.f & F_PARITY) !== 0);
        break; // RET PE
      case 0xe9:
        this.pc = this.getHL();
        break; // JP (HL)
      case 0xea:
        this.jp((this.f & F_PARITY) !== 0);
        break; // JP PE,(nn)
      case 0xeb: // EX DE,HL
        /*if (SUPPORT_DESTRUCTURING) {
          [this.d, this.e, this.h, this.l] = [this.h, this.l, this.d, this.e];
        } else {*/
        temp = this.d;
        this.d = this.h;
        this.h = temp;
        temp = this.e;
        this.e = this.l;
        this.l = temp;
        //}
        break;
      case 0xec:
        this.call((this.f & F_PARITY) !== 0);
        break; // CALL PE (nn)
      case 0xed:
        this.doED(this.getUint8(this.pc));
        break; // ED Opcode
      case 0xee:
        this.f = this.SZP_TABLE[(this.a ^= this.getUint8(this.pc++))];
        break; // XOR n
      case 0xef:
        this.push(this.pc);
        this.pc = 0x28;
        break; // RST 28H
      case 0xf0:
        this.ret((this.f & F_SIGN) === 0);
        break; // RET P
      case 0xf1:
        this.setAF(this.getUint16(this.sp));
        this.sp += 2;
        break; // POP AF
      case 0xf2:
        this.jp((this.f & F_SIGN) === 0);
        break; // JP P,(nn)
      case 0xf3:
        this.iff1 = this.iff2 = false;
        this.EI_inst = true;
        break; // DI
      case 0xf4:
        this.call((this.f & F_SIGN) === 0);
        break; // CALL P (nn)
      case 0xf5:
        this.push(this.getAF());
        break; // PUSH AF
      case 0xf6:
        this.f = this.SZP_TABLE[(this.a |= this.getUint8(this.pc++))];
        break; // OR n
      case 0xf7:
        this.push(this.pc);
        this.pc = 0x30;
        break; // RST 30H
      case 0xf8:
        this.ret((this.f & F_SIGN) !== 0);
        break; // RET M
      case 0xf9:
        this.sp = this.getHL();
        break; // LD SP,HL
      case 0xfa:
        this.jp((this.f & F_SIGN) !== 0);
        break; // JP M,(nn)
      case 0xfb:
        this.iff1 = this.iff2 = this.EI_inst = true;
        break; // EI
      case 0xfc:
        this.call((this.f & F_SIGN) !== 0);
        break; // CALL M (nn)
      case 0xfd:
        this.doIndexOpIY(this.getUint8(this.pc++));
        break; // FD Opcode
      case 0xfe:
        this.cp_a(this.getUint8(this.pc++));
        break; // CP n
      case 0xff:
        this.push(this.pc);
        this.pc = 0x38;
        break; // RST 38H
    } // end switch
  },

  /**
   * Get current cycle number.
   *
   * @return {number} Cycle number.
   */
  getCycle: function() {
    return this.totalCycles - this.tstates;
  },

  /**
   * Generate non maskable interrupt (NMI).
   */
  nmi: function() {
    this.iff2 = this.iff1;
    this.iff1 = false;

    if (REFRESH_EMULATION) {
      this.incR();
    }

    // If we're in a halt instruction, increment the PC and get out of it
    if (this.halt) {
      this.pc++;
      this.halt = false;
    }

    this.push(this.pc); // Preserve PC on stack
    this.pc = 0x66;
    this.tstates -= 11;
  },

  /**
   * Normal interrupt routine.
   */
  interrupt: function() {
    // Interrupts not allowed OR
    // Interrupts not allowed after EI instruction
    if (!this.iff1 || (ACCURATE_INTERRUPT_EMULATION && this.EI_inst)) {
      return;
    }

    // If we're in a halt instruction, increment the PC and get out of it
    if (this.halt) {
      this.pc++;
      this.halt = false;
    }

    if (REFRESH_EMULATION) {
      this.incR();
    }

    this.iff1 = this.iff2 = false;
    this.interruptLine = false;

    this.push(this.pc); // Preserve PC on stack

    if (this.im === 0) {
      // IM 0: Execute Instruction on Bus
      this.pc =
        this.interruptVector === 0 || this.interruptVector === 0xff
          ? 0x38
          : this.interruptVector;
      this.tstates -= 13;
    } else if (this.im === 1) {
      // IM 1: Do RST 38h. Ignore Value on Bus.
      this.pc = 0x38;
      this.tstates -= 13;
    } else {
      // IM 2
      this.pc = this.getUint16((this.i << 8) + this.interruptVector);
      this.tstates -= 19;
    }
  },

  /**
   * Jump.
   *
   * @param {boolean} condition If true jump will be taken.
   */
  jp: function(condition) {
    if (condition) {
      this.pc = this.getUint16(this.pc);
    } else {
      this.pc += 2;
    }
  },

  /**
   * Jump relative.
   *
   * @param {boolean} condition If true jump will be taken.
   */
  jr: function(condition) {
    if (condition) {
      this.pc += this.getInt8(this.pc);
      this.tstates -= 5;
    } else {
      this.pc++;
    }
  },

  /**
   * Call.
   *
   * @param {boolean} condition If true call will be taken.
   */
  call: function(condition) {
    if (condition) {
      this.push(this.pc + 2); // write value of PC to stack
      this.pc = this.getUint16(this.pc);
      this.tstates -= 7;
    } else {
      this.pc += 2;
    }
  },

  /**
   * Return.
   *
   * @param {boolean} condition If true return will be taken.
   */
  ret: function(condition) {
    if (condition) {
      this.pc = this.getUint16(this.sp);
      this.sp += 2;
      this.tstates -= 6;
    }
  },

  /**
   * Push value onto stack.
   *
   * @param {number} value Value to push.
   */
  push: function(value) {
    this.sp -= 2;
    this.setUint16(this.sp, value);
  },

  /**
   * Push value onto stack.
   * Used only in recompiling mode.
   *
   * @param {number} hi Value to push.
   * @param {number} lo Value to push.
   */
  pushUint8: function(hi, lo) {
    this.sp -= 2;
    this.setUint16(this.sp, (hi << 8) | lo);
  },

  /**
   * INC - Increment memory location.
   *
   * @param {number} offset Memory offset to increment.
   */
  incMem: function(offset) {
    this.setUint8(offset, this.inc8(this.getUint8(offset)));
  },

  /**
   * DEC - Decrement memory location.
   *
   * @param {number} offset Memory offset to decrement.
   */
  decMem: function(offset) {
    this.setUint8(offset, this.dec8(this.getUint8(offset)));
  },

  /**
   * CCF - Complement carry flag.
   */
  ccf: function() {
    if ((this.f & F_CARRY) !== 0) {
      this.f &= ~F_CARRY;
      this.f |= F_HALFCARRY;
    } else {
      this.f |= F_CARRY;
      this.f &= ~F_HALFCARRY;
    }
    this.f &= ~F_NEGATIVE;
  },

  /**
   * DAA - Decimal adjust accumulator.
   * Adds 6 to left and/or right nibble.
   *
   * Pre-calculated result for speed.
   *
   * Checked with ZEXALL.
   */
  daa: function() {
    // Get result for calculated table (carry flag = bit 8, negative = bit 9, halfcarry = bit 10)
    var temp = this.DAA_TABLE[
      this.a |
        ((this.f & F_CARRY) << 8) |
        ((this.f & F_NEGATIVE) << 8) |
        ((this.f & F_HALFCARRY) << 6)
    ];
    this.a = temp & 0xff;
    this.f = (this.f & F_NEGATIVE) | (temp >> 8);
  },

  /**
   * Execute CB prefixed opcode.
   *
   * @param {number} opcode Opcode hex value.
   */
  doCB: function(opcode) {
    this.tstates -= OP_CB_STATES[opcode];

    if (REFRESH_EMULATION) {
      this.incR();
    }

    switch (opcode) {
      case 0x00:
        this.b = this.rlc(this.b);
        break; // RLC B
      case 0x01:
        this.c = this.rlc(this.c);
        break; // RLC C
      case 0x02:
        this.d = this.rlc(this.d);
        break; // RLC D
      case 0x03:
        this.e = this.rlc(this.e);
        break; // RLC E
      case 0x04:
        this.h = this.rlc(this.h);
        break; // RLC H
      case 0x05:
        this.l = this.rlc(this.l);
        break; // RLC L
      case 0x06:
        this.setUint8(this.getHL(), this.rlc(this.getUint8(this.getHL())));
        break; // RLC (HL)
      case 0x07:
        this.a = this.rlc(this.a);
        break; // RLC A
      case 0x08:
        this.b = this.rrc(this.b);
        break; // RRC B
      case 0x09:
        this.c = this.rrc(this.c);
        break; // RRC C
      case 0x0a:
        this.d = this.rrc(this.d);
        break; // RRC D
      case 0x0b:
        this.e = this.rrc(this.e);
        break; // RRC E
      case 0x0c:
        this.h = this.rrc(this.h);
        break; // RRC H
      case 0x0d:
        this.l = this.rrc(this.l);
        break; // RRC L
      case 0x0e:
        this.setUint8(this.getHL(), this.rrc(this.getUint8(this.getHL())));
        break; // RRC (HL)
      case 0x0f:
        this.a = this.rrc(this.a);
        break; // RRC A
      case 0x10:
        this.b = this.rl(this.b);
        break; // RL B
      case 0x11:
        this.c = this.rl(this.c);
        break; // RL C
      case 0x12:
        this.d = this.rl(this.d);
        break; // RL D
      case 0x13:
        this.e = this.rl(this.e);
        break; // RL E
      case 0x14:
        this.h = this.rl(this.h);
        break; // RL H
      case 0x15:
        this.l = this.rl(this.l);
        break; // RL L
      case 0x16:
        this.setUint8(this.getHL(), this.rl(this.getUint8(this.getHL())));
        break; // RL (HL)
      case 0x17:
        this.a = this.rl(this.a);
        break; // RL A
      case 0x18:
        this.b = this.rr(this.b);
        break; // RR B
      case 0x19:
        this.c = this.rr(this.c);
        break; // RR C
      case 0x1a:
        this.d = this.rr(this.d);
        break; // RR D
      case 0x1b:
        this.e = this.rr(this.e);
        break; // RR E
      case 0x1c:
        this.h = this.rr(this.h);
        break; // RR H
      case 0x1d:
        this.l = this.rr(this.l);
        break; // RR L
      case 0x1e:
        this.setUint8(this.getHL(), this.rr(this.getUint8(this.getHL())));
        break; // RR (HL)
      case 0x1f:
        this.a = this.rr(this.a);
        break; // RR A
      case 0x20:
        this.b = this.sla(this.b);
        break; // SLA B
      case 0x21:
        this.c = this.sla(this.c);
        break; // SLA C
      case 0x22:
        this.d = this.sla(this.d);
        break; // SLA D
      case 0x23:
        this.e = this.sla(this.e);
        break; // SLA E
      case 0x24:
        this.h = this.sla(this.h);
        break; // SLA H
      case 0x25:
        this.l = this.sla(this.l);
        break; // SLA L
      case 0x26:
        this.setUint8(this.getHL(), this.sla(this.getUint8(this.getHL())));
        break; // SLA (HL)
      case 0x27:
        this.a = this.sla(this.a);
        break; // SLA A
      case 0x28:
        this.b = this.sra(this.b);
        break; // SRA B
      case 0x29:
        this.c = this.sra(this.c);
        break; // SRA C
      case 0x2a:
        this.d = this.sra(this.d);
        break; // SRA D
      case 0x2b:
        this.e = this.sra(this.e);
        break; // SRA E
      case 0x2c:
        this.h = this.sra(this.h);
        break; // SRA H
      case 0x2d:
        this.l = this.sra(this.l);
        break; // SRA L
      case 0x2e:
        this.setUint8(this.getHL(), this.sra(this.getUint8(this.getHL())));
        break; // SRA (HL)
      case 0x2f:
        this.a = this.sra(this.a);
        break; // SRA A
      case 0x30:
        this.b = this.sll(this.b);
        break; // SLL B
      case 0x31:
        this.c = this.sll(this.c);
        break; // SLL C
      case 0x32:
        this.d = this.sll(this.d);
        break; // SLL D
      case 0x33:
        this.e = this.sll(this.e);
        break; // SLL E
      case 0x34:
        this.h = this.sll(this.h);
        break; // SLL H
      case 0x35:
        this.l = this.sll(this.l);
        break; // SLL L
      case 0x36:
        this.setUint8(this.getHL(), this.sll(this.getUint8(this.getHL())));
        break; // SLL (HL)
      case 0x37:
        this.a = this.sll(this.a);
        break; // SLL A
      case 0x38:
        this.b = this.srl(this.b);
        break; // SRL B
      case 0x39:
        this.c = this.srl(this.c);
        break; // SRL C
      case 0x3a:
        this.d = this.srl(this.d);
        break; // SRL D
      case 0x3b:
        this.e = this.srl(this.e);
        break; // SRL E
      case 0x3c:
        this.h = this.srl(this.h);
        break; // SRL H
      case 0x3d:
        this.l = this.srl(this.l);
        break; // SRL L
      case 0x3e:
        this.setUint8(this.getHL(), this.srl(this.getUint8(this.getHL())));
        break; // SRL (HL)
      case 0x3f:
        this.a = this.srl(this.a);
        break; // SRL A
      case 0x40:
        this.bit(this.b & BIT_0);
        break; // BIT 0,B
      case 0x41:
        this.bit(this.c & BIT_0);
        break; // BIT 0,C
      case 0x42:
        this.bit(this.d & BIT_0);
        break; // BIT 0,D
      case 0x43:
        this.bit(this.e & BIT_0);
        break; // BIT 0,E
      case 0x44:
        this.bit(this.h & BIT_0);
        break; // BIT 0,H
      case 0x45:
        this.bit(this.l & BIT_0);
        break; // BIT 0,L
      case 0x46:
        this.bit(this.getUint8(this.getHL()) & BIT_0);
        break; // BIT 0,(HL)
      case 0x47:
        this.bit(this.a & BIT_0);
        break; // BIT 0,A
      case 0x48:
        this.bit(this.b & BIT_1);
        break; // BIT 1,B
      case 0x49:
        this.bit(this.c & BIT_1);
        break; // BIT 1,C
      case 0x4a:
        this.bit(this.d & BIT_1);
        break; // BIT 1,D
      case 0x4b:
        this.bit(this.e & BIT_1);
        break; // BIT 1,E
      case 0x4c:
        this.bit(this.h & BIT_1);
        break; // BIT 1,H
      case 0x4d:
        this.bit(this.l & BIT_1);
        break; // BIT 1,L
      case 0x4e:
        this.bit(this.getUint8(this.getHL()) & BIT_1);
        break; // BIT 1,(HL)
      case 0x4f:
        this.bit(this.a & BIT_1);
        break; // BIT 1,A
      case 0x50:
        this.bit(this.b & BIT_2);
        break; // BIT 2,B
      case 0x51:
        this.bit(this.c & BIT_2);
        break; // BIT 2,C
      case 0x52:
        this.bit(this.d & BIT_2);
        break; // BIT 2,D
      case 0x53:
        this.bit(this.e & BIT_2);
        break; // BIT 2,E
      case 0x54:
        this.bit(this.h & BIT_2);
        break; // BIT 2,H
      case 0x55:
        this.bit(this.l & BIT_2);
        break; // BIT 2,L
      case 0x56:
        this.bit(this.getUint8(this.getHL()) & BIT_2);
        break; // BIT 2,(HL)
      case 0x57:
        this.bit(this.a & BIT_2);
        break; // BIT 2,A
      case 0x58:
        this.bit(this.b & BIT_3);
        break; // BIT 3,B
      case 0x59:
        this.bit(this.c & BIT_3);
        break; // BIT 3,C
      case 0x5a:
        this.bit(this.d & BIT_3);
        break; // BIT 3,D
      case 0x5b:
        this.bit(this.e & BIT_3);
        break; // BIT 3,E
      case 0x5c:
        this.bit(this.h & BIT_3);
        break; // BIT 3,H
      case 0x5d:
        this.bit(this.l & BIT_3);
        break; // BIT 3,L
      case 0x5e:
        this.bit(this.getUint8(this.getHL()) & BIT_3);
        break; // BIT 3,(HL)
      case 0x5f:
        this.bit(this.a & BIT_3);
        break; // BIT 3,A
      case 0x60:
        this.bit(this.b & BIT_4);
        break; // BIT 4,B
      case 0x61:
        this.bit(this.c & BIT_4);
        break; // BIT 4,C
      case 0x62:
        this.bit(this.d & BIT_4);
        break; // BIT 4,D
      case 0x63:
        this.bit(this.e & BIT_4);
        break; // BIT 4,E
      case 0x64:
        this.bit(this.h & BIT_4);
        break; // BIT 4,H
      case 0x65:
        this.bit(this.l & BIT_4);
        break; // BIT 4,L
      case 0x66:
        this.bit(this.getUint8(this.getHL()) & BIT_4);
        break; // BIT 4,(HL)
      case 0x67:
        this.bit(this.a & BIT_4);
        break; // BIT 4,A
      case 0x68:
        this.bit(this.b & BIT_5);
        break; // BIT 5,B
      case 0x69:
        this.bit(this.c & BIT_5);
        break; // BIT 5,C
      case 0x6a:
        this.bit(this.d & BIT_5);
        break; // BIT 5,D
      case 0x6b:
        this.bit(this.e & BIT_5);
        break; // BIT 5,E
      case 0x6c:
        this.bit(this.h & BIT_5);
        break; // BIT 5,H
      case 0x6d:
        this.bit(this.l & BIT_5);
        break; // BIT 5,L
      case 0x6e:
        this.bit(this.getUint8(this.getHL()) & BIT_5);
        break; // BIT 5,(HL)
      case 0x6f:
        this.bit(this.a & BIT_5);
        break; // BIT 5,A
      case 0x70:
        this.bit(this.b & BIT_6);
        break; // BIT 6,B
      case 0x71:
        this.bit(this.c & BIT_6);
        break; // BIT 6,C
      case 0x72:
        this.bit(this.d & BIT_6);
        break; // BIT 6,D
      case 0x73:
        this.bit(this.e & BIT_6);
        break; // BIT 6,E
      case 0x74:
        this.bit(this.h & BIT_6);
        break; // BIT 6,H
      case 0x75:
        this.bit(this.l & BIT_6);
        break; // BIT 6,L
      case 0x76:
        this.bit(this.getUint8(this.getHL()) & BIT_6);
        break; // BIT 6,(HL)
      case 0x77:
        this.bit(this.a & BIT_6);
        break; // BIT 6,A
      case 0x78:
        this.bit(this.b & BIT_7);
        break; // BIT 7,B
      case 0x79:
        this.bit(this.c & BIT_7);
        break; // BIT 7,C
      case 0x7a:
        this.bit(this.d & BIT_7);
        break; // BIT 7,D
      case 0x7b:
        this.bit(this.e & BIT_7);
        break; // BIT 7,E
      case 0x7c:
        this.bit(this.h & BIT_7);
        break; // BIT 7,H
      case 0x7d:
        this.bit(this.l & BIT_7);
        break; // BIT 7,L
      case 0x7e:
        this.bit(this.getUint8(this.getHL()) & BIT_7);
        break; // BIT 7,(HL)
      case 0x7f:
        this.bit(this.a & BIT_7);
        break; // BIT 7,A
      case 0x80:
        this.b &= ~BIT_0;
        break; // RES 0,B
      case 0x81:
        this.c &= ~BIT_0;
        break; // RES 0,C
      case 0x82:
        this.d &= ~BIT_0;
        break; // RES 0,D
      case 0x83:
        this.e &= ~BIT_0;
        break; // RES 0,E
      case 0x84:
        this.h &= ~BIT_0;
        break; // RES 0,H
      case 0x85:
        this.l &= ~BIT_0;
        break; // RES 0,L
      case 0x86:
        this.setUint8(this.getHL(), this.getUint8(this.getHL()) & ~BIT_0);
        break; // RES 0,(HL)
      case 0x87:
        this.a &= ~BIT_0;
        break; // RES 0,A
      case 0x88:
        this.b &= ~BIT_1;
        break; // RES 1,B
      case 0x89:
        this.c &= ~BIT_1;
        break; // RES 1,C
      case 0x8a:
        this.d &= ~BIT_1;
        break; // RES 1,D
      case 0x8b:
        this.e &= ~BIT_1;
        break; // RES 1,E
      case 0x8c:
        this.h &= ~BIT_1;
        break; // RES 1,H
      case 0x8d:
        this.l &= ~BIT_1;
        break; // RES 1,L
      case 0x8e:
        this.setUint8(this.getHL(), this.getUint8(this.getHL()) & ~BIT_1);
        break; // RES 1,(HL)
      case 0x8f:
        this.a &= ~BIT_1;
        break; // RES 1,A
      case 0x90:
        this.b &= ~BIT_2;
        break; // RES 2,B
      case 0x91:
        this.c &= ~BIT_2;
        break; // RES 2,C
      case 0x92:
        this.d &= ~BIT_2;
        break; // RES 2,D
      case 0x93:
        this.e &= ~BIT_2;
        break; // RES 2,E
      case 0x94:
        this.h &= ~BIT_2;
        break; // RES 2,H
      case 0x95:
        this.l &= ~BIT_2;
        break; // RES 2,L
      case 0x96:
        this.setUint8(this.getHL(), this.getUint8(this.getHL()) & ~BIT_2);
        break; // RES 2,(HL)
      case 0x97:
        this.a &= ~BIT_2;
        break; // RES 2,A
      case 0x98:
        this.b &= ~BIT_3;
        break; // RES 3,B
      case 0x99:
        this.c &= ~BIT_3;
        break; // RES 3,C
      case 0x9a:
        this.d &= ~BIT_3;
        break; // RES 3,D
      case 0x9b:
        this.e &= ~BIT_3;
        break; // RES 3,E
      case 0x9c:
        this.h &= ~BIT_3;
        break; // RES 3,H
      case 0x9d:
        this.l &= ~BIT_3;
        break; // RES 3,L
      case 0x9e:
        this.setUint8(this.getHL(), this.getUint8(this.getHL()) & ~BIT_3);
        break; // RES 3,(HL)
      case 0x9f:
        this.a &= ~BIT_3;
        break; // RES 3,A
      case 0xa0:
        this.b &= ~BIT_4;
        break; // RES 4,B
      case 0xa1:
        this.c &= ~BIT_4;
        break; // RES 4,C
      case 0xa2:
        this.d &= ~BIT_4;
        break; // RES 4,D
      case 0xa3:
        this.e &= ~BIT_4;
        break; // RES 4,E
      case 0xa4:
        this.h &= ~BIT_4;
        break; // RES 4,H
      case 0xa5:
        this.l &= ~BIT_4;
        break; // RES 4,L
      case 0xa6:
        this.setUint8(this.getHL(), this.getUint8(this.getHL()) & ~BIT_4);
        break; // RES 4,(HL)
      case 0xa7:
        this.a &= ~BIT_4;
        break; // RES 4,A
      case 0xa8:
        this.b &= ~BIT_5;
        break; // RES 5,B
      case 0xa9:
        this.c &= ~BIT_5;
        break; // RES 5,C
      case 0xaa:
        this.d &= ~BIT_5;
        break; // RES 5,D
      case 0xab:
        this.e &= ~BIT_5;
        break; // RES 5,E
      case 0xac:
        this.h &= ~BIT_5;
        break; // RES 5,H
      case 0xad:
        this.l &= ~BIT_5;
        break; // RES 5,L
      case 0xae:
        this.setUint8(this.getHL(), this.getUint8(this.getHL()) & ~BIT_5);
        break; // RES 5,(HL)
      case 0xaf:
        this.a &= ~BIT_5;
        break; // RES 5,A
      case 0xb0:
        this.b &= ~BIT_6;
        break; // RES 6,B
      case 0xb1:
        this.c &= ~BIT_6;
        break; // RES 6,C
      case 0xb2:
        this.d &= ~BIT_6;
        break; // RES 6,D
      case 0xb3:
        this.e &= ~BIT_6;
        break; // RES 6,E
      case 0xb4:
        this.h &= ~BIT_6;
        break; // RES 6,H
      case 0xb5:
        this.l &= ~BIT_6;
        break; // RES 6,L
      case 0xb6:
        this.setUint8(this.getHL(), this.getUint8(this.getHL()) & ~BIT_6);
        break; // RES 6,(HL)
      case 0xb7:
        this.a &= ~BIT_6;
        break; // RES 6,A
      case 0xb8:
        this.b &= ~BIT_7;
        break; // RES 7,B
      case 0xb9:
        this.c &= ~BIT_7;
        break; // RES 7,C
      case 0xba:
        this.d &= ~BIT_7;
        break; // RES 7,D
      case 0xbb:
        this.e &= ~BIT_7;
        break; // RES 7,E
      case 0xbc:
        this.h &= ~BIT_7;
        break; // RES 7,H
      case 0xbd:
        this.l &= ~BIT_7;
        break; // RES 7,L
      case 0xbe:
        this.setUint8(this.getHL(), this.getUint8(this.getHL()) & ~BIT_7);
        break; // RES 7,(HL)
      case 0xbf:
        this.a &= ~BIT_7;
        break; // RES 7,A
      case 0xc0:
        this.b |= BIT_0;
        break; // SET 0,B
      case 0xc1:
        this.c |= BIT_0;
        break; // SET 0,C
      case 0xc2:
        this.d |= BIT_0;
        break; // SET 0,D
      case 0xc3:
        this.e |= BIT_0;
        break; // SET 0,E
      case 0xc4:
        this.h |= BIT_0;
        break; // SET 0,H
      case 0xc5:
        this.l |= BIT_0;
        break; // SET 0,L
      case 0xc6:
        this.setUint8(this.getHL(), this.getUint8(this.getHL()) | BIT_0);
        break; // SET 0,(HL)
      case 0xc7:
        this.a |= BIT_0;
        break; // SET 0,A
      case 0xc8:
        this.b |= BIT_1;
        break; // SET 1,B
      case 0xc9:
        this.c |= BIT_1;
        break; // SET 1,C
      case 0xca:
        this.d |= BIT_1;
        break; // SET 1,D
      case 0xcb:
        this.e |= BIT_1;
        break; // SET 1,E
      case 0xcc:
        this.h |= BIT_1;
        break; // SET 1,H
      case 0xcd:
        this.l |= BIT_1;
        break; // SET 1,L
      case 0xce:
        this.setUint8(this.getHL(), this.getUint8(this.getHL()) | BIT_1);
        break; // SET 1,(HL)
      case 0xcf:
        this.a |= BIT_1;
        break; // SET 1,A
      case 0xd0:
        this.b |= BIT_2;
        break; // SET 2,B
      case 0xd1:
        this.c |= BIT_2;
        break; // SET 2,C
      case 0xd2:
        this.d |= BIT_2;
        break; // SET 2,D
      case 0xd3:
        this.e |= BIT_2;
        break; // SET 2,E
      case 0xd4:
        this.h |= BIT_2;
        break; // SET 2,H
      case 0xd5:
        this.l |= BIT_2;
        break; // SET 2,L
      case 0xd6:
        this.setUint8(this.getHL(), this.getUint8(this.getHL()) | BIT_2);
        break; // SET 2,(HL)
      case 0xd7:
        this.a |= BIT_2;
        break; // SET 2,A
      case 0xd8:
        this.b |= BIT_3;
        break; // SET 3,B
      case 0xd9:
        this.c |= BIT_3;
        break; // SET 3,C
      case 0xda:
        this.d |= BIT_3;
        break; // SET 3,D
      case 0xdb:
        this.e |= BIT_3;
        break; // SET 3,E
      case 0xdc:
        this.h |= BIT_3;
        break; // SET 3,H
      case 0xdd:
        this.l |= BIT_3;
        break; // SET 3,L
      case 0xde:
        this.setUint8(this.getHL(), this.getUint8(this.getHL()) | BIT_3);
        break; // SET 3,(HL)
      case 0xdf:
        this.a |= BIT_3;
        break; // SET 3,A
      case 0xe0:
        this.b |= BIT_4;
        break; // SET 4,B
      case 0xe1:
        this.c |= BIT_4;
        break; // SET 4,C
      case 0xe2:
        this.d |= BIT_4;
        break; // SET 4,D
      case 0xe3:
        this.e |= BIT_4;
        break; // SET 4,E
      case 0xe4:
        this.h |= BIT_4;
        break; // SET 4,H
      case 0xe5:
        this.l |= BIT_4;
        break; // SET 4,L
      case 0xe6:
        this.setUint8(this.getHL(), this.getUint8(this.getHL()) | BIT_4);
        break; // SET 4,(HL)
      case 0xe7:
        this.a |= BIT_4;
        break; // SET 4,A
      case 0xe8:
        this.b |= BIT_5;
        break; // SET 5,B
      case 0xe9:
        this.c |= BIT_5;
        break; // SET 5,C
      case 0xea:
        this.d |= BIT_5;
        break; // SET 5,D
      case 0xeb:
        this.e |= BIT_5;
        break; // SET 5,E
      case 0xec:
        this.h |= BIT_5;
        break; // SET 5,H
      case 0xed:
        this.l |= BIT_5;
        break; // SET 5,L
      case 0xee:
        this.setUint8(this.getHL(), this.getUint8(this.getHL()) | BIT_5);
        break; // SET 5,(HL)
      case 0xef:
        this.a |= BIT_5;
        break; // SET 5,A
      case 0xf0:
        this.b |= BIT_6;
        break; // SET 6,B
      case 0xf1:
        this.c |= BIT_6;
        break; // SET 6,C
      case 0xf2:
        this.d |= BIT_6;
        break; // SET 6,D
      case 0xf3:
        this.e |= BIT_6;
        break; // SET 6,E
      case 0xf4:
        this.h |= BIT_6;
        break; // SET 6,H
      case 0xf5:
        this.l |= BIT_6;
        break; // SET 6,L
      case 0xf6:
        this.setUint8(this.getHL(), this.getUint8(this.getHL()) | BIT_6);
        break; // SET 6,(HL)
      case 0xf7:
        this.a |= BIT_6;
        break; // SET 6,A
      case 0xf8:
        this.b |= BIT_7;
        break; // SET 7,B
      case 0xf9:
        this.c |= BIT_7;
        break; // SET 7,C
      case 0xfa:
        this.d |= BIT_7;
        break; // SET 7,D
      case 0xfb:
        this.e |= BIT_7;
        break; // SET 7,E
      case 0xfc:
        this.h |= BIT_7;
        break; // SET 7,H
      case 0xfd:
        this.l |= BIT_7;
        break; // SET 7,L
      case 0xfe:
        this.setUint8(this.getHL(), this.getUint8(this.getHL()) | BIT_7);
        break; // SET 7,(HL)
      case 0xff:
        this.a |= BIT_7;
        break; // SET 7,A

      // Unimplemented CB Opcode
      default:
        JSSMS.Utils.console.log(
          'Unimplemented CB Opcode: ' + JSSMS.Utils.toHex(opcode)
        );
        break;
    }
  },

  /**
   * CB RLC - Rotate left carry.
   *
   * @param {number} value Value to adjust.
   * @return {number} Adjusted value.
   */
  rlc: function(value) {
    var carry = (value & 0x80) >> 7;
    value = ((value << 1) | (value >> 7)) & 0xff;
    this.f = carry | this.SZP_TABLE[value];
    return value;
  },

  /**
   * CB RRC - Rotate right carry.
   *
   * @param {number} value Value to adjust.
   * @return {number} Adjusted value.
   */
  rrc: function(value) {
    var carry = value & 0x01;
    value = ((value >> 1) | (value << 7)) & 0xff;
    this.f = carry | this.SZP_TABLE[value];
    return value;
  },

  /**
   * CB RL - Rotate left.
   *
   * @param {number} value Value to adjust.
   * @return {number} Adjusted value.
   */
  rl: function(value) {
    var carry = (value & 0x80) >> 7;
    value = ((value << 1) | (this.f & F_CARRY)) & 0xff;
    this.f = carry | this.SZP_TABLE[value];
    return value;
  },

  /**
   * CB RR - Rotate right.
   *
   * @param {number} value Value to adjust.
   * @return {number} Adjusted value.
   */
  rr: function(value) {
    var carry = value & 0x01;
    value = ((value >> 1) | (this.f << 7)) & 0xff;
    this.f = carry | this.SZP_TABLE[value];
    return value;
  },

  /**
   * CB SLA - Shift left arithmetic.
   *
   * @param {number} value Value to adjust.
   * @return {number} Adjusted value.
   */
  sla: function(value) {
    var carry = (value & 0x80) >> 7;
    value = (value << 1) & 0xff;
    this.f = carry | this.SZP_TABLE[value];
    return value;
  },

  /**
   * CB SLL - Logical left shift.
   *
   * @param {number} value Value to adjust.
   * @return {number} Adjusted value.
   */
  sll: function(value) {
    var carry = (value & 0x80) >> 7;
    value = ((value << 1) | 1) & 0xff;
    this.f = carry | this.SZP_TABLE[value];
    return value;
  },

  /**
   * CB SRA - Shift right arithmetic.
   *
   * @param {number} value Value to adjust.
   * @return {number} Adjusted value.
   */
  sra: function(value) {
    var carry = value & 0x01;
    value = (value >> 1) | (value & 0x80);
    this.f = carry | this.SZP_TABLE[value];
    return value;
  },

  /**
   * CB SRL - Logical shift right.
   *
   * @param {number} value Value to adjust.
   * @return {number} Adjusted value.
   */
  srl: function(value) {
    var carry = value & 0x01;
    value = (value >> 1) & 0xff;
    this.f = carry | this.SZP_TABLE[value];
    return value;
  },

  /**
   * CB BIT - Test bit.
   *
   * @param {number} mask Masked value.
   */
  bit: function(mask) {
    this.f = (this.f & F_CARRY) | this.SZ_BIT_TABLE[mask];
  },

  /**
   * Execute DD/FD prefixed index opcode.
   *
   * @param {number} opcode Opcode hex value.
   */
  doIndexOpIX: function(opcode) {
    var temp = 0;

    this.tstates -= OP_DD_STATES[opcode];

    if (REFRESH_EMULATION) {
      this.incR();
    }

    switch (opcode) {
      case 0x09:
        this.setIXHIXL(this.add16(this.getIXHIXL(), this.getBC()));
        break; // ADD IX,BC
      case 0x19:
        this.setIXHIXL(this.add16(this.getIXHIXL(), this.getDE()));
        break; // ADD IX,DE
      case 0x21:
        this.setIXHIXL(this.getUint16(this.pc++));
        this.pc++;
        break; // LD IX,nn
      case 0x22:
        this.setUint16(this.getUint16(this.pc++), this.getIXHIXL());
        this.pc++;
        break; // LD (nn),IX
      case 0x23:
        this.incIXHIXL();
        break; // INC IX
      case 0x24:
        this.ixH = this.inc8(this.ixH);
        break; // INC IXH *
      case 0x25:
        this.ixH = this.dec8(this.ixH);
        break; // DEC IXH *
      case 0x26:
        this.ixH = this.getUint8(this.pc++);
        break; // LD IXH,n *
      case 0x29:
        this.setIXHIXL(this.add16(this.getIXHIXL(), this.getIXHIXL()));
        break; // ADD IX,IX
      case 0x2a:
        this.setIXHIXL(this.getUint16(this.getUint16(this.pc++)));
        this.pc++;
        break; // LD IX,(nn)
      case 0x2b:
        this.decIXHIXL();
        break; // DEC IX
      case 0x2c:
        this.ixL = this.inc8(this.ixL);
        break; // INC IXL *
      case 0x2d:
        this.ixL = this.dec8(this.ixL);
        break; // DEC IXL *
      case 0x2e:
        this.ixL = this.getUint8(this.pc++);
        break; // LD IXL,n
      case 0x34:
        this.incMem(this.getIXHIXL() + this.d_());
        this.pc++;
        break; // INC (IX+d)
      case 0x35:
        this.decMem(this.getIXHIXL() + this.d_());
        this.pc++;
        break; // DEC (IX+d)
      case 0x36:
        this.setUint8(this.getIXHIXL() + this.d_(), this.getUint8(++this.pc));
        this.pc++;
        break; // LD (IX+d),n
      case 0x39:
        this.setIXHIXL(this.add16(this.getIXHIXL(), this.sp));
        break; // ADD IX,SP
      case 0x44:
        this.b = this.ixH;
        break; // LD B,IXH *
      case 0x45:
        this.b = this.ixL;
        break; // LD B,IXL *
      case 0x46:
        this.b = this.getUint8(this.getIXHIXL() + this.d_());
        this.pc++;
        break; // LD B,(IX+d)
      case 0x4c:
        this.c = this.ixH;
        break; // LD C,IXH *
      case 0x4d:
        this.c = this.ixL;
        break; // LD C,IXL *
      case 0x4e:
        this.c = this.getUint8(this.getIXHIXL() + this.d_());
        this.pc++;
        break; // LD C,(IX+d)
      case 0x54:
        this.d = this.ixH;
        break; // LD D,IXH *
      case 0x55:
        this.d = this.ixL;
        break; // LD D,IXL *
      case 0x56:
        this.d = this.getUint8(this.getIXHIXL() + this.d_());
        this.pc++;
        break; // LD D,(IX+d)
      case 0x5c:
        this.e = this.ixH;
        break; // LD E,IXH *
      case 0x5d:
        this.e = this.ixL;
        break; // LD E,IXL *
      case 0x5e:
        this.e = this.getUint8(this.getIXHIXL() + this.d_());
        this.pc++;
        break; // LD E,(IX+d)
      case 0x60:
        this.ixH = this.b;
        break; // LD IXH,B *
      case 0x61:
        this.ixH = this.c;
        break; // LD IXH,C *
      case 0x62:
        this.ixH = this.d;
        break; // LD IXH,D *
      case 0x63:
        this.ixH = this.e;
        break; // LD IXH,E *
      case 0x64:
        break; // LD IXH,IXH*
      case 0x65:
        this.ixH = this.ixL;
        break; // LD IXH,IXL *
      case 0x66:
        this.h = this.getUint8(this.getIXHIXL() + this.d_());
        this.pc++;
        break; // LD H,(IX+d)
      case 0x67:
        this.ixH = this.a;
        break; // LD IXH,A *
      case 0x68:
        this.ixL = this.b;
        break; // LD IXL,B *
      case 0x69:
        this.ixL = this.c;
        break; // LD IXL,C *
      case 0x6a:
        this.ixL = this.d;
        break; // LD IXL,D *
      case 0x6b:
        this.ixL = this.e;
        break; // LD IXL,E *
      case 0x6c:
        this.ixL = this.ixH;
        break; // LD IXL,IXH *
      case 0x6d:
        break; // LD IXL,IXL *
      case 0x6e:
        this.l = this.getUint8(this.getIXHIXL() + this.d_());
        this.pc++;
        break; // LD L,(IX+d)
      case 0x6f:
        this.ixL = this.a;
        break; // LD IXL,A *
      case 0x70:
        this.setUint8(this.getIXHIXL() + this.d_(), this.b);
        this.pc++;
        break; // LD (IX+d),B
      case 0x71:
        this.setUint8(this.getIXHIXL() + this.d_(), this.c);
        this.pc++;
        break; // LD (IX+d),C
      case 0x72:
        this.setUint8(this.getIXHIXL() + this.d_(), this.d);
        this.pc++;
        break; // LD (IX+d),D
      case 0x73:
        this.setUint8(this.getIXHIXL() + this.d_(), this.e);
        this.pc++;
        break; // LD (IX+d),E
      case 0x74:
        this.setUint8(this.getIXHIXL() + this.d_(), this.h);
        this.pc++;
        break; // LD (IX+d),H
      case 0x75:
        this.setUint8(this.getIXHIXL() + this.d_(), this.l);
        this.pc++;
        break; // LD (IX+d),L
      case 0x77:
        this.setUint8(this.getIXHIXL() + this.d_(), this.a);
        this.pc++;
        break; // LD (IX+d),A
      case 0x7c:
        this.a = this.ixH;
        break; // LD A,IXH *
      case 0x7d:
        this.a = this.ixL;
        break; // LD A,IXL *
      case 0x7e:
        this.a = this.getUint8(this.getIXHIXL() + this.d_());
        this.pc++;
        break; // LD A,(IX+d)
      case 0x84:
        this.add_a(this.ixH);
        break; // ADD A,IXH *
      case 0x85:
        this.add_a(this.ixL);
        break; // ADD A,IXL *
      case 0x86:
        this.add_a(this.getUint8(this.getIXHIXL() + this.d_()));
        this.pc++;
        break; // ADD A,(IX+d)
      case 0x8c:
        this.adc_a(this.ixH);
        break; // ADC A,IXH *
      case 0x8d:
        this.adc_a(this.ixL);
        break; // ADC A,IXL *
      case 0x8e:
        this.adc_a(this.getUint8(this.getIXHIXL() + this.d_()));
        this.pc++;
        break; // ADC A,(IX+d)
      case 0x94:
        this.sub_a(this.ixH);
        break; // SUB IXH *
      case 0x95:
        this.sub_a(this.ixL);
        break; // SUB IXL *
      case 0x96:
        this.sub_a(this.getUint8(this.getIXHIXL() + this.d_()));
        this.pc++;
        break; // SUB A,(IX+d)
      case 0x9c:
        this.sbc_a(this.ixH);
        break; // SBC A,IXH *
      case 0x9d:
        this.sbc_a(this.ixL);
        break; // SBC A,IXL *
      case 0x9e:
        this.sbc_a(this.getUint8(this.getIXHIXL() + this.d_()));
        this.pc++;
        break; // SBC A,(IX+d)
      case 0xa4:
        this.f = this.SZP_TABLE[(this.a &= this.ixH)] | F_HALFCARRY;
        break; // AND IXH *
      case 0xa5:
        this.f = this.SZP_TABLE[(this.a &= this.ixL)] | F_HALFCARRY;
        break; // AND IXL *
      case 0xa6:
        this.f =
          this.SZP_TABLE[
            (this.a &= this.getUint8(this.getIXHIXL() + this.d_()))
          ] | F_HALFCARRY;
        this.pc++;
        break; // AND A,(IX+d)
      case 0xac:
        this.f = this.SZP_TABLE[(this.a ^= this.ixH)];
        break; // XOR A IXH*
      case 0xad:
        this.f = this.SZP_TABLE[(this.a ^= this.ixL)];
        break; // XOR A IXL*
      case 0xae:
        this.f = this.SZP_TABLE[
          (this.a ^= this.getUint8(this.getIXHIXL() + this.d_()))
        ];
        this.pc++;
        break; // XOR A,(IX+d)
      case 0xb4:
        this.f = this.SZP_TABLE[(this.a |= this.ixH)];
        break; // OR A IXH*
      case 0xb5:
        this.f = this.SZP_TABLE[(this.a |= this.ixL)];
        break; // OR A IXL*
      case 0xb6:
        this.f = this.SZP_TABLE[
          (this.a |= this.getUint8(this.getIXHIXL() + this.d_()))
        ];
        this.pc++;
        break; // OR A,(IX+d)
      case 0xbc:
        this.cp_a(this.ixH);
        break; // CP IXH *
      case 0xbd:
        this.cp_a(this.ixL);
        break; // CP IXL *
      case 0xbe:
        this.cp_a(this.getUint8(this.getIXHIXL() + this.d_()));
        this.pc++;
        break; // CP (IX+d)
      case 0xcb:
        this.doIndexCB(this.getIXHIXL());
        break; // CB Opcode
      case 0xe1:
        this.setIXHIXL(this.getUint16(this.sp));
        this.sp += 2;
        break; // POP IX
      case 0xe3: // EX SP,(IX)
        temp = this.getIXHIXL();
        this.setIXHIXL(this.getUint16(this.sp));
        this.setUint16(this.sp, temp);
        break;
      case 0xe5:
        this.push(this.getIXHIXL());
        break; // PUSH IX
      case 0xe9:
        this.pc = this.getIXHIXL();
        break; // JP (IX)
      case 0xf9:
        this.sp = this.getIXHIXL();
        break; // LD SP,IX

      // Unimplemented DD/FD Opcode
      default:
        JSSMS.Utils.console.log(
          'Unimplemented DD/FD Opcode: ' + JSSMS.Utils.toHex(opcode)
        );
        this.pc--;
        break;
    } // end of switch
  },

  /**
   * @param {number} opcode Opcode hex value.
   */
  doIndexOpIY: function(opcode) {
    var temp;

    this.tstates -= OP_DD_STATES[opcode];

    if (REFRESH_EMULATION) {
      this.incR();
    }

    switch (opcode) {
      case 0x09:
        this.setIYHIYL(this.add16(this.getIYHIYL(), this.getBC()));
        break; // ADD IY,BC
      case 0x19:
        this.setIYHIYL(this.add16(this.getIYHIYL(), this.getDE()));
        break; // ADD IY,DE
      case 0x21:
        this.setIYHIYL(this.getUint16(this.pc++));
        this.pc++;
        break; // LD IY,nn
      case 0x22:
        this.setUint16(this.getUint16(this.pc++), this.getIYHIYL());
        this.pc++;
        break; // LD (nn),IY
      case 0x23:
        this.incIYHIYL();
        break; // INC IY
      case 0x24:
        this.iyH = this.inc8(this.iyH);
        break; // INC IYH *
      case 0x25:
        this.iyH = this.dec8(this.iyH);
        break; // DEC IYH *
      case 0x26:
        this.iyH = this.getUint8(this.pc++);
        break; // LD IYH,n *
      case 0x29:
        this.setIYHIYL(this.add16(this.getIYHIYL(), this.getIYHIYL()));
        break; // ADD IY,IY
      case 0x2a:
        this.setIYHIYL(this.getUint16(this.getUint16(this.pc++)));
        this.pc++;
        break; // LD IY,(nn)
      case 0x2b:
        this.decIYHIYL();
        break; // DEC IY
      case 0x2c:
        this.iyL = this.inc8(this.iyL);
        break; // INC IYL *
      case 0x2d:
        this.iyL = this.dec8(this.iyL);
        break; // DEC IYL *
      case 0x2e:
        this.iyL = this.getUint8(this.pc++);
        break; // LD IYL,n
      case 0x34:
        this.incMem(this.getIYHIYL() + this.d_());
        this.pc++;
        break; // INC (IY+d)
      case 0x35:
        this.decMem(this.getIYHIYL() + this.d_());
        this.pc++;
        break; // DEC (IY+d)
      case 0x36:
        this.setUint8(this.getIYHIYL() + this.d_(), this.getUint8(++this.pc));
        this.pc++;
        break; // LD (IY+d),n
      case 0x39:
        this.setIYHIYL(this.add16(this.getIYHIYL(), this.sp));
        break; // ADD IY,SP
      case 0x44:
        this.b = this.iyH;
        break; // LD B,IYH *
      case 0x45:
        this.b = this.iyL;
        break; // LD B,IYL *
      case 0x46:
        this.b = this.getUint8(this.getIYHIYL() + this.d_());
        this.pc++;
        break; // LD B,(IY+d)
      case 0x4c:
        this.c = this.iyH;
        break; // LD C,IYH *
      case 0x4d:
        this.c = this.iyL;
        break; // LD C,IYL *
      case 0x4e:
        this.c = this.getUint8(this.getIYHIYL() + this.d_());
        this.pc++;
        break; // LD C,(IY+d)
      case 0x54:
        this.d = this.iyH;
        break; // LD D,IYH *
      case 0x55:
        this.d = this.iyL;
        break; // LD D,IYL *
      case 0x56:
        this.d = this.getUint8(this.getIYHIYL() + this.d_());
        this.pc++;
        break; // LD D,(IY+d)
      case 0x5c:
        this.e = this.iyH;
        break; // LD E,IYH *
      case 0x5d:
        this.e = this.iyL;
        break; // LD E,IYL *
      case 0x5e:
        this.e = this.getUint8(this.getIYHIYL() + this.d_());
        this.pc++;
        break; // LD E,(IY+d)
      case 0x60:
        this.iyH = this.b;
        break; // LD IYH,B *
      case 0x61:
        this.iyH = this.c;
        break; // LD IYH,C *
      case 0x62:
        this.iyH = this.d;
        break; // LD IYH,D *
      case 0x63:
        this.iyH = this.e;
        break; // LD IYH,E *
      case 0x64:
        break; // LD IYH,IYH*
      case 0x65:
        this.iyH = this.iyL;
        break; // LD IYH,IYL *
      case 0x66:
        this.h = this.getUint8(this.getIYHIYL() + this.d_());
        this.pc++;
        break; // LD H,(IY+d)
      case 0x67:
        this.iyH = this.a;
        break; // LD IYH,A *
      case 0x68:
        this.iyL = this.b;
        break; // LD IYL,B *
      case 0x69:
        this.iyL = this.c;
        break; // LD IYL,C *
      case 0x6a:
        this.iyL = this.d;
        break; // LD IYL,D *
      case 0x6b:
        this.iyL = this.e;
        break; // LD IYL,E *
      case 0x6c:
        this.iyL = this.iyH;
        break; // LD IYL,IYH *
      case 0x6d:
        break; // LD IYL,IYL *
      case 0x6e:
        this.l = this.getUint8(this.getIYHIYL() + this.d_());
        this.pc++;
        break; // LD L,(IY+d)
      case 0x6f:
        this.iyL = this.a;
        break; // LD IYL,A *
      case 0x70:
        this.setUint8(this.getIYHIYL() + this.d_(), this.b);
        this.pc++;
        break; // LD (IY+d),B
      case 0x71:
        this.setUint8(this.getIYHIYL() + this.d_(), this.c);
        this.pc++;
        break; // LD (IY+d),C
      case 0x72:
        this.setUint8(this.getIYHIYL() + this.d_(), this.d);
        this.pc++;
        break; // LD (IY+d),D
      case 0x73:
        this.setUint8(this.getIYHIYL() + this.d_(), this.e);
        this.pc++;
        break; // LD (IY+d),E
      case 0x74:
        this.setUint8(this.getIYHIYL() + this.d_(), this.h);
        this.pc++;
        break; // LD (IY+d),H
      case 0x75:
        this.setUint8(this.getIYHIYL() + this.d_(), this.l);
        this.pc++;
        break; // LD (IY+d),L
      case 0x77:
        this.setUint8(this.getIYHIYL() + this.d_(), this.a);
        this.pc++;
        break; // LD (IY+d),A
      case 0x7c:
        this.a = this.iyH;
        break; // LD A,IYH *
      case 0x7d:
        this.a = this.iyL;
        break; // LD A,IYL *
      case 0x7e:
        this.a = this.getUint8(this.getIYHIYL() + this.d_());
        this.pc++;
        break; // LD A,(IY+d)
      case 0x84:
        this.add_a(this.iyH);
        break; // ADD A,IYH *
      case 0x85:
        this.add_a(this.iyL);
        break; // ADD A,IYL *
      case 0x86:
        this.add_a(this.getUint8(this.getIYHIYL() + this.d_()));
        this.pc++;
        break; // ADD A,(IY+d)
      case 0x8c:
        this.adc_a(this.iyH);
        break; // ADC A,IYH *
      case 0x8d:
        this.adc_a(this.iyL);
        break; // ADC A,IYL *
      case 0x8e:
        this.adc_a(this.getUint8(this.getIYHIYL() + this.d_()));
        this.pc++;
        break; // ADC A,(IY+d)
      case 0x94:
        this.sub_a(this.iyH);
        break; // SUB IYH *
      case 0x95:
        this.sub_a(this.iyL);
        break; // SUB IYL *
      case 0x96:
        this.sub_a(this.getUint8(this.getIYHIYL() + this.d_()));
        this.pc++;
        break; // SUB A,(IY+d)
      case 0x9c:
        this.sbc_a(this.iyH);
        break; // SBC A,IYH *
      case 0x9d:
        this.sbc_a(this.iyL);
        break; // SBC A,IYL *
      case 0x9e:
        this.sbc_a(this.getUint8(this.getIYHIYL() + this.d_()));
        this.pc++;
        break; // SBC A,(IY+d)
      case 0xa4:
        this.f = this.SZP_TABLE[(this.a &= this.iyH)] | F_HALFCARRY;
        break; // AND IYH *
      case 0xa5:
        this.f = this.SZP_TABLE[(this.a &= this.iyL)] | F_HALFCARRY;
        break; // AND IYL *
      case 0xa6:
        this.f =
          this.SZP_TABLE[
            (this.a &= this.getUint8(this.getIYHIYL() + this.d_()))
          ] | F_HALFCARRY;
        this.pc++;
        break; // AND A,(IY+d)
      case 0xac:
        this.f = this.SZP_TABLE[(this.a ^= this.iyH)];
        break; // XOR A IYH*
      case 0xad:
        this.f = this.SZP_TABLE[(this.a ^= this.iyL)];
        break; // XOR A IYL*
      case 0xae:
        this.f = this.SZP_TABLE[
          (this.a ^= this.getUint8(this.getIYHIYL() + this.d_()))
        ];
        this.pc++;
        break; // XOR A,(IY+d)
      case 0xb4:
        this.f = this.SZP_TABLE[(this.a |= this.iyH)];
        break; // OR A IYH*
      case 0xb5:
        this.f = this.SZP_TABLE[(this.a |= this.iyL)];
        break; // OR A IYL*
      case 0xb6:
        this.f = this.SZP_TABLE[
          (this.a |= this.getUint8(this.getIYHIYL() + this.d_()))
        ];
        this.pc++;
        break; // OR A,(IY+d)
      case 0xbc:
        this.cp_a(this.iyH);
        break; // CP IYH *
      case 0xbd:
        this.cp_a(this.iyL);
        break; // CP IYL *
      case 0xbe:
        this.cp_a(this.getUint8(this.getIYHIYL() + this.d_()));
        this.pc++;
        break; // CP (IY+d)
      case 0xcb:
        this.doIndexCB(this.getIYHIYL());
        break; // CB Opcode
      case 0xe1:
        this.setIYHIYL(this.getUint16(this.sp));
        this.sp += 2;
        break; // POP IY
      case 0xe3: // EX SP,(IY)
        temp = this.getIYHIYL();
        this.setIYHIYL(this.getUint16(this.sp));
        this.setUint16(this.sp, temp);
        break;
      case 0xe5:
        this.push(this.getIYHIYL());
        break; // PUSH IY
      case 0xe9:
        this.pc = this.getIYHIYL();
        break; // JP (IY)
      case 0xf9:
        this.sp = this.getIYHIYL();
        break; // LD SP,IY

      // Unimplemented DD/FD Opcode
      default:
        JSSMS.Utils.console.log(
          'Unimplemented DD/FD Opcode: ' + JSSMS.Utils.toHex(opcode)
        );
        this.pc--;
        break;
    } // end of switch
  },

  /**
   * Execute DDCB/FDCB prefixed opcode.
   *
   * @todo Implement missing opcodes.
   * @param {number} index Index register to use.
   */
  doIndexCB: function(index) {
    var location = (index + this.getUint8(this.pc)) & 0xffff;
    var opcode = this.getUint8(++this.pc);

    this.tstates -= OP_INDEX_CB_STATES[opcode];

    switch (opcode) {
      case 0x00:
        this.b = this.rlc(this.getUint8(location));
        this.setUint8(location, this.b);
        break; // LD B,RLC (IX)
      case 0x01:
        this.c = this.rlc(this.getUint8(location));
        this.setUint8(location, this.c);
        break; // LD C,RLC (IX)
      case 0x02:
        this.d = this.rlc(this.getUint8(location));
        this.setUint8(location, this.d);
        break; // LD D,RLC (IX)
      case 0x03:
        this.e = this.rlc(this.getUint8(location));
        this.setUint8(location, this.e);
        break; // LD E,RLC (IX)
      case 0x04:
        this.h = this.rlc(this.getUint8(location));
        this.setUint8(location, this.h);
        break; // LD H,RLC (IX)
      case 0x05:
        this.l = this.rlc(this.getUint8(location));
        this.setUint8(location, this.l);
        break; // LD L,RLC (IX)
      case 0x06:
        this.setUint8(location, this.rlc(this.getUint8(location)));
        break; // RLC (IX)
      case 0x07:
        this.a = this.rlc(this.getUint8(location));
        this.setUint8(location, this.a);
        break; // LD A,RLC (IX)
      case 0x08:
        this.b = this.rrc(this.getUint8(location));
        this.setUint8(location, this.b);
        break; // LD B,RRC (IX)
      case 0x09:
        this.c = this.rrc(this.getUint8(location));
        this.setUint8(location, this.c);
        break; // LD C,RRC (IX)
      case 0x0a:
        this.d = this.rrc(this.getUint8(location));
        this.setUint8(location, this.d);
        break; // LD D,RRC (IX)
      case 0x0b:
        this.e = this.rrc(this.getUint8(location));
        this.setUint8(location, this.e);
        break; // LD E,RRC (IX)
      case 0x0c:
        this.h = this.rrc(this.getUint8(location));
        this.setUint8(location, this.h);
        break; // LD H,RRC (IX)
      case 0x0d:
        this.l = this.rrc(this.getUint8(location));
        this.setUint8(location, this.l);
        break; // LD L,RRC (IX)
      case 0x0e:
        this.setUint8(location, this.rrc(this.getUint8(location)));
        break; // RRC (IX)
      case 0x0f:
        this.a = this.rrc(this.getUint8(location));
        this.setUint8(location, this.a);
        break; // LD A,RRC (IX)
      case 0x10:
        this.b = this.rl(this.getUint8(location));
        this.setUint8(location, this.b);
        break; // LD B,RL (IX)
      case 0x11:
        this.c = this.rl(this.getUint8(location));
        this.setUint8(location, this.c);
        break; // LD C,RL (IX)
      case 0x12:
        this.d = this.rl(this.getUint8(location));
        this.setUint8(location, this.d);
        break; // LD D,RL (IX)
      case 0x13:
        this.e = this.rl(this.getUint8(location));
        this.setUint8(location, this.e);
        break; // LD E,RL (IX)
      case 0x14:
        this.h = this.rl(this.getUint8(location));
        this.setUint8(location, this.h);
        break; // LD H,RL (IX)
      case 0x15:
        this.l = this.rl(this.getUint8(location));
        this.setUint8(location, this.l);
        break; // LD L,RL (IX)
      case 0x16:
        this.setUint8(location, this.rl(this.getUint8(location)));
        break; // RL (IX)
      case 0x17:
        this.a = this.rl(this.getUint8(location));
        this.setUint8(location, this.a);
        break; // LD A,RL (IX)
      case 0x18:
        this.b = this.rr(this.getUint8(location));
        this.setUint8(location, this.b);
        break; // LD B,RR (IX)
      case 0x19:
        this.c = this.rr(this.getUint8(location));
        this.setUint8(location, this.c);
        break; // LD C,RR (IX)
      case 0x1a:
        this.d = this.rr(this.getUint8(location));
        this.setUint8(location, this.d);
        break; // LD D,RR (IX)
      case 0x1b:
        this.e = this.rr(this.getUint8(location));
        this.setUint8(location, this.e);
        break; // LD E,RR (IX)
      case 0x1c:
        this.h = this.rr(this.getUint8(location));
        this.setUint8(location, this.h);
        break; // LD H,RR (IX)
      case 0x1d:
        this.l = this.rr(this.getUint8(location));
        this.setUint8(location, this.l);
        break; // LD L,RR (IX)
      case 0x1e:
        this.setUint8(location, this.rr(this.getUint8(location)));
        break; // RR (IX)
      case 0x1f:
        this.a = this.rr(this.getUint8(location));
        this.setUint8(location, this.a);
        break; // LD A,RR (IX)
      case 0x20:
        this.b = this.sla(this.getUint8(location));
        this.setUint8(location, this.b);
        break; // LD B,SLA (IX)
      case 0x21:
        this.c = this.sla(this.getUint8(location));
        this.setUint8(location, this.c);
        break; // LD C,SLA (IX)
      case 0x22:
        this.d = this.sla(this.getUint8(location));
        this.setUint8(location, this.d);
        break; // LD D,SLA (IX)
      case 0x23:
        this.e = this.sla(this.getUint8(location));
        this.setUint8(location, this.e);
        break; // LD E,SLA (IX)
      case 0x24:
        this.h = this.sla(this.getUint8(location));
        this.setUint8(location, this.h);
        break; // LD H,SLA (IX)
      case 0x25:
        this.l = this.sla(this.getUint8(location));
        this.setUint8(location, this.l);
        break; // LD L,SLA (IX)
      case 0x26:
        this.setUint8(location, this.sla(this.getUint8(location)));
        break; // SLA (IX)
      case 0x27:
        this.a = this.sla(this.getUint8(location));
        this.setUint8(location, this.a);
        break; // LD A,SLA (IX)
      case 0x28:
        this.b = this.sra(this.getUint8(location));
        this.setUint8(location, this.b);
        break; // LD B,SRA (IX)
      case 0x29:
        this.c = this.sra(this.getUint8(location));
        this.setUint8(location, this.c);
        break; // LD C,SRA (IX)
      case 0x2a:
        this.d = this.sra(this.getUint8(location));
        this.setUint8(location, this.d);
        break; // LD D,SRA (IX)
      case 0x2b:
        this.e = this.sra(this.getUint8(location));
        this.setUint8(location, this.e);
        break; // LD E,SRA (IX)
      case 0x2c:
        this.h = this.sra(this.getUint8(location));
        this.setUint8(location, this.h);
        break; // LD H,SRA (IX)
      case 0x2d:
        this.l = this.sra(this.getUint8(location));
        this.setUint8(location, this.l);
        break; // LD L,SRA (IX)
      case 0x2e:
        this.setUint8(location, this.sra(this.getUint8(location)));
        break; // SRA (IX)
      case 0x2f:
        this.a = this.sra(this.getUint8(location));
        this.setUint8(location, this.a);
        break; // LD A,SRA (IX)
      case 0x30:
        this.b = this.sll(this.getUint8(location));
        this.setUint8(location, this.b);
        break; // LD B,SLL (IX)
      case 0x31:
        this.c = this.sll(this.getUint8(location));
        this.setUint8(location, this.c);
        break; // LD C,SLL (IX)
      case 0x32:
        this.d = this.sll(this.getUint8(location));
        this.setUint8(location, this.d);
        break; // LD D,SLL (IX)
      case 0x33:
        this.e = this.sll(this.getUint8(location));
        this.setUint8(location, this.e);
        break; // LD E,SLL (IX)
      case 0x34:
        this.h = this.sll(this.getUint8(location));
        this.setUint8(location, this.h);
        break; // LD H,SLL (IX)
      case 0x35:
        this.l = this.sll(this.getUint8(location));
        this.setUint8(location, this.l);
        break; // LD L,SLL (IX)
      case 0x36:
        this.setUint8(location, this.sll(this.getUint8(location)));
        break; // SLL (IX) *
      case 0x37:
        this.a = this.sll(this.getUint8(location));
        this.setUint8(location, this.a);
        break; // LD A,SLL (IX)
      case 0x38:
        this.b = this.srl(this.getUint8(location));
        this.setUint8(location, this.b);
        break; // LD B,SRL (IX)
      case 0x39:
        this.c = this.srl(this.getUint8(location));
        this.setUint8(location, this.c);
        break; // LD C,SRL (IX)
      case 0x3a:
        this.d = this.srl(this.getUint8(location));
        this.setUint8(location, this.d);
        break; // LD D,SRL (IX)
      case 0x3b:
        this.e = this.srl(this.getUint8(location));
        this.setUint8(location, this.e);
        break; // LD E,SRL (IX)
      case 0x3c:
        this.h = this.srl(this.getUint8(location));
        this.setUint8(location, this.h);
        break; // LD H,SRL (IX)
      case 0x3d:
        this.l = this.srl(this.getUint8(location));
        this.setUint8(location, this.l);
        break; // LD L,SRL (IX)
      case 0x3e:
        this.setUint8(location, this.srl(this.getUint8(location)));
        break; // SRL (IX)
      case 0x3f:
        this.a = this.srl(this.getUint8(location));
        this.setUint8(location, this.a);
        break; // LD A,SRL (IX)
      case 0x40:
      case 0x41:
      case 0x42:
      case 0x43:
      case 0x44:
      case 0x45:
      case 0x46:
      case 0x47:
        this.bit(this.getUint8(location) & BIT_0);
        break; // BIT 0,(IX)
      case 0x48:
      case 0x49:
      case 0x4a:
      case 0x4b:
      case 0x4c:
      case 0x4d:
      case 0x4e:
      case 0x4f:
        this.bit(this.getUint8(location) & BIT_1);
        break; // BIT 1,(IX)
      case 0x50:
      case 0x51:
      case 0x52:
      case 0x53:
      case 0x54:
      case 0x55:
      case 0x56:
      case 0x57:
        this.bit(this.getUint8(location) & BIT_2);
        break; // BIT 2,(IX)
      case 0x58:
      case 0x59:
      case 0x5a:
      case 0x5b:
      case 0x5c:
      case 0x5d:
      case 0x5e:
      case 0x5f:
        this.bit(this.getUint8(location) & BIT_3);
        break; // BIT 3,(IX)
      case 0x60:
      case 0x61:
      case 0x62:
      case 0x63:
      case 0x64:
      case 0x65:
      case 0x66:
      case 0x67:
        this.bit(this.getUint8(location) & BIT_4);
        break; // BIT 4,(IX)
      case 0x68:
      case 0x69:
      case 0x6a:
      case 0x6b:
      case 0x6c:
      case 0x6d:
      case 0x6e:
      case 0x6f:
        this.bit(this.getUint8(location) & BIT_5);
        break; // BIT 5,(IX)
      case 0x70:
      case 0x71:
      case 0x72:
      case 0x73:
      case 0x74:
      case 0x75:
      case 0x76:
      case 0x77:
        this.bit(this.getUint8(location) & BIT_6);
        break; // BIT 6,(IX)
      case 0x78:
      case 0x79:
      case 0x7a:
      case 0x7b:
      case 0x7c:
      case 0x7d:
      case 0x7e:
      case 0x7f:
        this.bit(this.getUint8(location) & BIT_7);
        break; // BIT 7,(IX)
      case 0x80:
      case 0x81:
      case 0x82:
      case 0x83:
      case 0x84:
      case 0x85:
      case 0x86:
      case 0x87:
        this.setUint8(location, this.getUint8(location) & ~BIT_0);
        break; // RES 0,(IX)
      case 0x88:
      case 0x89:
      case 0x8a:
      case 0x8b:
      case 0x8c:
      case 0x8d:
      case 0x8e:
      case 0x8f:
        this.setUint8(location, this.getUint8(location) & ~BIT_1);
        break; // RES 1,(IX)
      case 0x90:
      case 0x91:
      case 0x92:
      case 0x93:
      case 0x94:
      case 0x95:
      case 0x96:
      case 0x97:
        this.setUint8(location, this.getUint8(location) & ~BIT_2);
        break; // RES 2,(IX)
      case 0x98:
      case 0x99:
      case 0x9a:
      case 0x9b:
      case 0x9c:
      case 0x9d:
      case 0x9e:
      case 0x9f:
        this.setUint8(location, this.getUint8(location) & ~BIT_3);
        break; // RES 3,(IX)
      case 0xa0:
      case 0xa1:
      case 0xa2:
      case 0xa3:
      case 0xa4:
      case 0xa5:
      case 0xa6:
      case 0xa7:
        this.setUint8(location, this.getUint8(location) & ~BIT_4);
        break; // RES 4,(IX)
      case 0xa8:
      case 0xa9:
      case 0xaa:
      case 0xab:
      case 0xac:
      case 0xad:
      case 0xae:
      case 0xaf:
        this.setUint8(location, this.getUint8(location) & ~BIT_5);
        break; // RES 5,(IX)
      case 0xb0:
      case 0xb1:
      case 0xb2:
      case 0xb3:
      case 0xb4:
      case 0xb5:
      case 0xb6:
      case 0xb7:
        this.setUint8(location, this.getUint8(location) & ~BIT_6);
        break; // RES 6,(IX)
      case 0xb8:
      case 0xb9:
      case 0xba:
      case 0xbb:
      case 0xbc:
      case 0xbd:
      case 0xbe:
      case 0xbf:
        this.setUint8(location, this.getUint8(location) & ~BIT_7);
        break; // RES 7,(IX)
      case 0xc0:
      case 0xc1:
      case 0xc2:
      case 0xc3:
      case 0xc4:
      case 0xc5:
      case 0xc6:
      case 0xc7:
        this.setUint8(location, this.getUint8(location) | BIT_0);
        break; // SET 0,(IX)
      case 0xc8:
      case 0xc9:
      case 0xca:
      case 0xcb:
      case 0xcc:
      case 0xcd:
      case 0xce:
      case 0xcf:
        this.setUint8(location, this.getUint8(location) | BIT_1);
        break; // SET 1,(IX)
      case 0xd0:
      case 0xd1:
      case 0xd2:
      case 0xd3:
      case 0xd4:
      case 0xd5:
      case 0xd6:
      case 0xd7:
        this.setUint8(location, this.getUint8(location) | BIT_2);
        break; // SET 2,(IX)
      case 0xd8:
      case 0xd9:
      case 0xda:
      case 0xdb:
      case 0xdc:
      case 0xdd:
      case 0xde:
      case 0xdf:
        this.setUint8(location, this.getUint8(location) | BIT_3);
        break; // SET 3,(IX)
      case 0xe0:
      case 0xe1:
      case 0xe2:
      case 0xe3:
      case 0xe4:
      case 0xe5:
      case 0xe6:
      case 0xe7:
        this.setUint8(location, this.getUint8(location) | BIT_4);
        break; // SET 4,(IX)
      case 0xe8:
      case 0xe9:
      case 0xea:
      case 0xeb:
      case 0xec:
      case 0xed:
      case 0xee:
      case 0xef:
        this.setUint8(location, this.getUint8(location) | BIT_5);
        break; // SET 5,(IX)
      case 0xf0:
      case 0xf1:
      case 0xf2:
      case 0xf3:
      case 0xf4:
      case 0xf5:
      case 0xf6:
      case 0xf7:
        this.setUint8(location, this.getUint8(location) | BIT_6);
        break; // SET 6,(IX)
      case 0xf8:
      case 0xf9:
      case 0xfa:
      case 0xfb:
      case 0xfc:
      case 0xfd:
      case 0xfe:
      case 0xff:
        this.setUint8(location, this.getUint8(location) | BIT_7);
        break; // SET 7,(IX)

      // Unimplemented DDCB/FDCB Opcode
      default:
        JSSMS.Utils.console.log(
          'Unimplemented DDCB/FDCB Opcode: ' + JSSMS.Utils.toHex(opcode)
        );
        break;
    } // end of switch
    this.pc++;
  },

  /**
   * Execute ED prefixed opcode.
   *
   * @param {number} opcode Opcode hex value.
   */
  doED: function(opcode) {
    var temp = 0;
    var location = 0;

    this.tstates -= OP_ED_STATES[opcode];

    if (REFRESH_EMULATION) {
      this.incR();
    }

    switch (opcode) {
      // -- ED40 IN B,(C) -------------------------
      case 0x40:
        this.b = this.port.in_(this.c);
        this.f = (this.f & F_CARRY) | this.SZP_TABLE[this.b];
        this.pc++;
        break;

      // -- ED41 OUT (C),B -------------------------
      case 0x41:
        this.port.out(this.c, this.b);
        this.pc++;
        break;

      // -- ED42 SBC HL,BC ------------------------
      case 0x42:
        this.sbc16(this.getBC());
        this.pc++;
        break;

      // -- ED43 LD (nn),BC ------------------------
      case 0x43:
        this.setUint16(this.getUint16(++this.pc), this.getBC());
        this.pc += 2;
        break;

      // -- ED44 NEG -------------------------------
      case 0x44:
      case 0x4c:
      case 0x54:
      case 0x5c:
      case 0x64:
      case 0x6c:
      case 0x74:
      case 0x7c:
        // A <- 0-A
        temp = this.a;
        this.a = 0;
        this.sub_a(temp);
        this.pc++;
        break;

      // -- ED45 RETN / RETI ------------------------------
      case 0x45:
      case 0x4d:
      case 0x55:
      case 0x5d:
      case 0x65:
      case 0x6d:
      case 0x75:
      case 0x7d:
        this.pc = this.getUint16(this.sp);
        this.sp += 2;
        this.iff1 = this.iff2;
        break;

      // -- ED46 IM 0-------------------------------
      case 0x46:
      case 0x4e:
      case 0x66:
      case 0x6e:
        this.im = 0;
        this.pc++;
        break;

      // -- ED47 LD I,A ---------------------------
      case 0x47:
        this.i = this.a;
        this.pc++;
        break;

      // -- ED48 IN C,(C) -------------------------
      case 0x48:
        this.c = this.port.in_(this.c);
        this.f = (this.f & F_CARRY) | this.SZP_TABLE[this.c];
        this.pc++;
        break;

      // -- ED49 OUT (C),C -------------------------
      case 0x49:
        this.port.out(this.c, this.c);
        this.pc++;
        break;

      // -- ED4A ADC HL,BC ------------------------
      case 0x4a:
        this.adc16(this.getBC());
        this.pc++;
        break;

      // -- ED4B LD BC,(nn) -----------------------
      case 0x4b:
        this.setBC(this.getUint16(this.getUint16(++this.pc)));
        this.pc += 2;
        break;

      // -- ED4F LD R,A ---------------------------
      case 0x4f:
        this.r = this.a;
        this.pc++;
        break;

      // -- ED50 IN D,(C) -------------------------
      case 0x50:
        this.d = this.port.in_(this.c);
        this.f = (this.f & F_CARRY) | this.SZP_TABLE[this.d];
        this.pc++;
        break;

      // -- ED51 OUT (C),D -------------------------
      case 0x51:
        this.port.out(this.c, this.d);
        this.pc++;
        break;

      // -- ED52 SBC HL,DE ------------------------
      case 0x52:
        this.sbc16(this.getDE());
        this.pc++;
        break;

      // -- ED53 LD (nn),DE ------------------------
      case 0x53:
        this.setUint16(this.getUint16(++this.pc), this.getDE());
        this.pc += 2;
        break;

      // -- ED56 IM 1-------------------------------
      case 0x56:
      case 0x76:
        this.im = 1;
        this.pc++;
        break;

      // -- ED57 LD A,I ---------------------------
      case 0x57:
        this.a = this.i;
        this.f =
          (this.f & F_CARRY) |
          this.SZ_TABLE[this.a] |
          (this.iff2 ? F_PARITY : 0);
        this.pc++;
        break;

      // -- ED58 IN E,(C) -------------------------
      case 0x58:
        this.e = this.port.in_(this.c);
        this.f = (this.f & F_CARRY) | this.SZP_TABLE[this.e];
        this.pc++;
        break;

      // -- ED59 OUT (C),E -------------------------
      case 0x59:
        this.port.out(this.c, this.e);
        this.pc++;
        break;

      // -- ED5A ADC HL,DE ------------------------
      case 0x5a:
        this.adc16(this.getDE());
        this.pc++;
        break;

      // -- ED5B LD DE,(nn) -----------------------
      case 0x5b:
        this.setDE(this.getUint16(this.getUint16(++this.pc)));
        this.pc += 2;
        break;

      // -- ED5F LD A,R -----------------------------
      case 0x5f:
        // Note, to fake refresh emulation we use the random number generator
        this.a = REFRESH_EMULATION ? this.r : JSSMS.Utils.rndInt(255);
        this.f =
          (this.f & F_CARRY) |
          this.SZ_TABLE[this.a] |
          (this.iff2 ? F_PARITY : 0);
        this.pc++;
        break;

      // -- ED60 IN H,(C) -------------------------
      case 0x60:
        this.h = this.port.in_(this.c);
        this.f = (this.f & F_CARRY) | this.SZP_TABLE[this.h];
        this.pc++;
        break;

      // -- ED61 OUT (C),H -------------------------
      case 0x61:
        this.port.out(this.c, this.h);
        this.pc++;
        break;

      // -- ED62 SBC HL,HL ------------------------
      case 0x62:
        this.sbc16(this.getHL());
        this.pc++;
        break;

      // -- ED63 LD (nn),HL ------------------------
      case 0x63:
        this.setUint16(this.getUint16(++this.pc), this.getHL());
        this.pc += 2;
        break;

      // -- ED67 RRD -------------------------------
      case 0x67:
        location = this.getHL();
        temp = this.getUint8(location);

        // move high 4 of hl to low 4 of hl
        // move low 4 of a to high 4 of hl
        this.setUint8(location, (temp >> 4) | ((this.a & 0x0f) << 4));
        // move 4 lowest bits of hl to low 4 of a
        this.a = (this.a & 0xf0) | (temp & 0x0f);

        this.f = (this.f & F_CARRY) | this.SZP_TABLE[this.a];
        this.pc++;
        break;

      // -- ED68 IN L,(C) --------------------------
      case 0x68:
        this.l = this.port.in_(this.c);
        this.f = (this.f & F_CARRY) | this.SZP_TABLE[this.l];
        this.pc++;
        break;

      // -- ED69 OUT (C),L -------------------------
      case 0x69:
        this.port.out(this.c, this.l);
        this.pc++;
        break;

      // -- ED6A ADC HL,HL ------------------------
      case 0x6a:
        this.adc16(this.getHL());
        this.pc++;
        break;

      // -- ED6B LD HL,(nn) -----------------------
      case 0x6b:
        this.setHL(this.getUint16(this.getUint16(++this.pc)));
        this.pc += 2;
        break;

      // -- ED6F RLD -------------------------------
      case 0x6f:
        location = this.getHL();
        temp = this.getUint8(location);

        // move low 4 of hl to high 4 of hl
        // move low 4 of a to low 4 of hl
        this.setUint8(location, ((temp & 0x0f) << 4) | (this.a & 0x0f));

        // move high 4 of hl to low 4 of a
        this.a = (this.a & 0xf0) | (temp >> 4);

        this.f = (this.f & F_CARRY) | this.SZP_TABLE[this.a];
        this.pc++;
        break;

      //  *- ED71 OUT (C),0 -------------------------
      case 0x71:
        this.port.out(this.c, 0);
        this.pc++;
        break;

      // -- ED72 SBC HL,SP ------------------------
      case 0x72:
        this.sbc16(this.sp);
        this.pc++;
        break;

      // -- ED73 LD (nn),SP ------------------------
      case 0x73:
        this.setUint16(this.getUint16(++this.pc), this.sp);
        this.pc += 2;
        break;

      // -- ED78 IN A,(C) -------------------------
      case 0x78:
        this.a = this.port.in_(this.c);
        this.f = (this.f & F_CARRY) | this.SZP_TABLE[this.a];
        this.pc++;
        break;

      // -- ED79 OUT (C),A -------------------------
      case 0x79:
        this.port.out(this.c, this.a);
        this.pc++;
        break;

      // -- ED7A ADC HL,SP ------------------------
      case 0x7a:
        this.adc16(this.sp);
        this.pc++;
        break;

      // -- ED7B LD SP,(nn) -----------------------
      case 0x7b:
        this.sp = this.getUint16(this.getUint16(++this.pc));
        this.pc += 2;
        break;

      // -- EDA0 LDI ----------------------------------
      case 0xa0:
        temp = this.getUint8(this.getHL());
        this.setUint8(this.getDE(), temp);
        this.decBC();
        this.incDE();
        this.incHL();

        temp = (temp + this.a) & 0xff;
        this.f =
          (this.f & 0xc1) |
          (this.getBC() ? F_PARITY : 0) |
          (temp & 0x08) |
          (temp & 0x02 ? 0x20 : 0);
        this.pc++;
        break;

      // -- EDA1 CPI ------------------------------
      case 0xa1:
        temp = (this.f & F_CARRY) | F_NEGATIVE;
        this.cp_a(this.getUint8(this.getHL())); // sets some flags
        this.decBC();
        this.incHL();

        temp |= this.getBC() === 0 ? 0 : F_PARITY;

        this.f = (this.f & 0xf8) | temp;
        this.pc++;
        break;

      // -- EDA2 INI -------------------------------
      case 0xa2:
        temp = this.port.in_(this.c);
        this.setUint8(this.getHL(), temp);
        this.b = this.dec8(this.b);
        this.incHL();

        if ((temp & 0x80) === 0x80) {
          this.f |= F_NEGATIVE;
        } else {
          this.f &= ~F_NEGATIVE;
        }
        this.pc++;
        // undocumented flags not finished.
        break;

      // -- EDA3 OUTI ------------------------------
      // see p14 of undocumented z80 for additional flag info
      case 0xa3:
        temp = this.getUint8(this.getHL());
        // (C) <- (HL)
        this.port.out(this.c, temp);
        // B <- B -1
        this.b = this.dec8(this.b); // Flags in OUTI adjusted in same way as dec b anyway.
        // HL <- HL + 1
        this.incHL();

        if (this.l + temp > 255) {
          this.f |= F_CARRY;
          this.f |= F_HALFCARRY;
        } else {
          this.f &= ~F_CARRY;
          this.f &= ~F_HALFCARRY;
        }
        if ((temp & 0x80) === 0x80) {
          this.f |= F_NEGATIVE;
        } else {
          this.f &= ~F_NEGATIVE;
        }
        this.pc++;
        break;

      // -- EDA8 LDD ----------------------------------
      case 0xa8:
        temp = this.getUint8(this.getHL());
        this.setUint8(this.getDE(), temp);
        this.decBC();
        this.decDE();
        this.decHL();

        temp = (temp + this.a) & 0xff;
        this.f =
          (this.f & 0xc1) |
          (this.getBC() ? F_PARITY : 0) |
          (temp & F_BIT3) |
          (temp & F_NEGATIVE ? 0x20 : 0);
        this.pc++;
        break;

      // -- EDA9 CPD ------------------------------
      case 0xa9:
        temp = (this.f & F_CARRY) | F_NEGATIVE;
        this.cp_a(this.getUint8(this.getHL())); // sets some flags
        this.decBC();
        this.decHL();

        temp |= this.getBC() === 0 ? 0 : F_PARITY;

        this.f = (this.f & 0xf8) | temp;
        this.pc++;
        break;

      // -- EDAA IND -------------------------------
      case 0xaa:
        temp = this.port.in_(this.c);
        this.setUint8(this.getHL(), temp);
        this.b = this.dec8(this.b);
        this.decHL();

        if ((temp & 0x80) !== 0) {
          this.f |= F_NEGATIVE;
        } else {
          this.f &= ~F_NEGATIVE;
        }
        this.pc++;
        // undocumented flags not finished.
        break;

      // -- EDAB OUTD ------------------------------
      // see p14 of undocumented z80 for additional flag info
      case 0xab:
        temp = this.getUint8(this.getHL());
        // (C) <- (HL)
        this.port.out(this.c, temp);
        // B <- B -1
        this.b = this.dec8(this.b); // Flags in OUTI adjusted in same way as dec b anyway.
        // HL <- HL - 1
        this.decHL();

        if (this.l + temp > 255) {
          this.f |= F_CARRY;
          this.f |= F_HALFCARRY;
        } else {
          this.f &= ~F_CARRY;
          this.f &= ~F_HALFCARRY;
        }
        if ((temp & 0x80) === 0x80) {
          this.f |= F_NEGATIVE;
        } else {
          this.f &= ~F_NEGATIVE;
        }
        this.pc++;
        break;

      // -- EDB0 LDIR ------------------------------
      case 0xb0:
        temp = this.getUint8(this.getHL());
        this.setUint8(this.getDE(), temp);
        this.decBC();
        this.incDE();
        this.incHL();

        temp = (temp + this.a) & 0xff;
        this.f =
          (this.f & 0xc1) |
          (this.getBC() ? F_PARITY : 0) |
          (temp & 0x08) |
          (temp & 0x02 ? 0x20 : 0);
        if (this.getBC() !== 0) {
          this.tstates -= 5;
          this.pc--;
        } else {
          this.pc++;
        }
        break;

      // -- EDB1 CPIR ------------------------------
      case 0xb1:
        temp = (this.f & F_CARRY) | F_NEGATIVE;
        this.cp_a(this.getUint8(this.getHL())); // sets zero flag
        this.decBC();
        this.incHL();

        temp |= this.getBC() === 0 ? 0 : F_PARITY;

        // Repeat instruction until a = (hl) or bc === 0
        if ((temp & F_PARITY) !== 0 && (this.f & F_ZERO) === 0) {
          this.tstates -= 5;
          this.pc--;
        } else {
          this.pc++;
        }

        this.f = (this.f & 0xf8) | temp; // Sign set by the cp instruction
        break;

      // -- EDB2 INIR ------------------------------
      case 0xb2:
        temp = this.port.in_(this.c);
        this.setUint8(this.getHL(), temp);
        this.b = this.dec8(this.b);
        this.incHL();

        if (this.b !== 0) {
          this.tstates -= 5;
          this.pc--;
        } else {
          this.pc++;
        }

        if ((temp & 0x80) === 0x80) {
          this.f |= F_NEGATIVE;
        } else {
          this.f &= ~F_NEGATIVE;
        }
        // undocumented flags not finished.
        break;

      // -- EDB3 OTIR ------------------------------
      case 0xb3:
        temp = this.getUint8(this.getHL());
        // (C) <- (HL)
        this.port.out(this.c, temp);
        // B <- B -1
        this.b = this.dec8(this.b);
        // HL <- HL + 1
        this.incHL();

        if (this.b !== 0) {
          this.tstates -= 5;
          this.pc--;
        } else {
          this.pc++;
        }
        if (this.l + temp > 255) {
          this.f |= F_CARRY;
          this.f |= F_HALFCARRY;
        } else {
          this.f &= ~F_CARRY;
          this.f &= ~F_HALFCARRY;
        }

        if ((temp & 0x80) !== 0) {
          this.f |= F_NEGATIVE;
        } else {
          this.f &= ~F_NEGATIVE;
        }
        break;

      // -- EDB8 LDDR ---------------------------------
      case 0xb8:
        temp = this.getUint8(this.getHL());
        this.setUint8(this.getDE(), temp);
        this.decBC();
        this.decDE();
        this.decHL();

        temp = (temp + this.a) & 0xff;
        this.f =
          (this.f & 0xc1) |
          (this.getBC() ? F_PARITY : 0) |
          (temp & F_BIT3) |
          (temp & F_NEGATIVE ? 0x20 : 0);
        if (this.getBC() !== 0) {
          this.tstates -= 5;
          this.pc--;
        } else {
          this.pc++;
        }
        break;

      // -- EDB9 CPDR ------------------------------------
      case 0xb9:
        temp = (this.f & F_CARRY) | F_NEGATIVE;
        this.cp_a(this.getUint8(this.getHL())); // sets zero flag
        this.decBC();
        this.decHL();

        temp |= this.getBC() === 0 ? 0 : F_PARITY;

        // Repeat instruction until a = (hl) or bc === 0
        if ((temp & F_PARITY) !== 0 && (this.f & F_ZERO) === 0) {
          this.tstates -= 5;
          this.pc--;
        } else {
          this.pc++;
        }

        this.f = (this.f & 0xf8) | temp;
        break;

      // -- EDBA INDR ------------------------------
      case 0xba:
        temp = this.port.in_(this.c);
        this.setUint8(this.getHL(), temp);
        this.b = this.dec8(this.b);
        this.decHL();

        if (this.b !== 0) {
          this.tstates -= 5;
          this.pc--;
        } else {
          this.pc++;
        }

        if ((temp & 0x80) !== 0) {
          this.f |= F_NEGATIVE;
        } else {
          this.f &= ~F_NEGATIVE;
        }
        // undocumented flags not finished.
        break;

      // -- EDBB OTDR ------------------------------
      case 0xbb:
        temp = this.getUint8(this.getHL());
        // (C) <- (HL)
        this.port.out(this.c, temp);
        // B <- B -1
        this.b = this.dec8(this.b);
        // HL <- HL + 1
        this.decHL();

        if (this.b !== 0) {
          this.tstates -= 5;
          this.pc--;
        } else {
          this.pc++;
        }
        if (this.l + temp > 255) {
          this.f |= F_CARRY;
          this.f |= F_HALFCARRY;
        } else {
          this.f &= ~F_CARRY;
          this.f &= ~F_HALFCARRY;
        }

        if ((temp & 0x80) !== 0) {
          this.f |= F_NEGATIVE;
        } else {
          this.f &= ~F_NEGATIVE;
        }
        break;

      // Unimplemented ED Opcode
      default:
        JSSMS.Utils.console.log(
          'Unimplemented ED Opcode: ' + JSSMS.Utils.toHex(opcode)
        );
        this.pc++;
        break;
    } // end of switch
  },

  /**
   * Pre-calculate DAA table.
   *
   * Address:
   *
   * Bottom 8 bytes = a value
   * Byte 9  = carry flag
   * Byte 10 = negative flag
   * Byte 11 = halfcarry flag
   *
   * Returned value:
   *
   * a register stored in lower 8 bits
   * f register stored in higher 8 bits
   */
  generateDAATable: function() {
    var i, c, h, n;

    // Iterate all possible values of a register (0 to 0xFF)
    i = 256;
    while (i--) {
      // Iterate carry / not-carry set
      for (c = 0; c <= 1; c++) {
        // Iterate halfcarry / not-halfcarry set
        for (h = 0; h <= 1; h++) {
          // Iterate negative / not-negative set
          for (n = 0; n <= 1; n++) {
            this.DAA_TABLE[
              (c << 8) | (n << 9) | (h << 10) | i
            ] = this.getDAAResult(i, c | (n << 1) | (h << 4));
          }
        }
      }
    }

    // Reset these to be sure
    this.a = this.f = 0;
  },

  /**
   * @param {number} value
   * @param {number} flags
   * @return {number}
   */
  getDAAResult: function(value, flags) {
    this.a = value;
    this.f = flags;

    var a_copy = this.a;
    var correction = 0;
    var carry = flags & F_CARRY;
    var carry_copy = carry;
    if ((flags & F_HALFCARRY) !== 0 || (a_copy & 0x0f) > 0x09) {
      correction |= 0x06;
    }
    if (
      carry === 1 ||
      a_copy > 0x9f ||
      (a_copy > 0x8f && (a_copy & 0x0f) > 0x09)
    ) {
      correction |= 0x60;
      carry_copy = 1;
    }
    if (a_copy > 0x99) {
      carry_copy = 1;
    }
    if ((flags & F_NEGATIVE) !== 0) {
      // cycle -= 4;
      this.sub_a(correction);
    } else {
      // cycle -= 4;
      this.add_a(correction);
    }

    flags = (this.f & 0xfe) | carry_copy;

    if (this.getParity(this.a)) {
      flags = (flags & 0xfb) | F_PARITY;
    } else {
      flags = flags & 0xfb;
    }

    return this.a | (flags << 8);
  },

  // ACCUMULATOR REGISTER
  /**
   * ADD 8 BIT.
   *
   * @param {number} value Value to add.
   */
  add_a: function(value) {
    var temp = (this.a + value) & 0xff;
    this.f = this.SZHVC_ADD_TABLE[(this.a << 8) | temp];
    this.a = temp;
  },

  /**
   * ADC 8 BIT - Add with carry.
   *
   * @param {number} value Value to add.
   */
  adc_a: function(value) {
    var carry = this.f & F_CARRY;
    var temp = (this.a + value + carry) & 0xff;
    this.f = this.SZHVC_ADD_TABLE[(carry << 16) | (this.a << 8) | temp];
    this.a = temp;
  },

  /**
   * SUB 8 BIT.
   *
   * @param {number} value Value to subtract.
   */
  sub_a: function(value) {
    var temp = (this.a - value) & 0xff;
    this.f = this.SZHVC_SUB_TABLE[(this.a << 8) | temp];
    this.a = temp;
  },

  /**
   * SBC 8 BIT.
   *
   * @param {number} value Subtract with carry.
   */
  sbc_a: function(value) {
    var carry = this.f & F_CARRY;
    var temp = (this.a - value - carry) & 0xff;
    this.f = this.SZHVC_SUB_TABLE[(carry << 16) | (this.a << 8) | temp];
    this.a = temp;
  },

  /**
   * CP Operation - Compare with accumulator.
   *
   * @param {number} value Value to compare.
   */
  cp_a: function(value) {
    // Subtract value from accumulator but discard result
    this.f = this.SZHVC_SUB_TABLE[(this.a << 8) | ((this.a - value) & 0xff)];
  },

  /**
   * CPL Operation - Complement accumulator.
   *
   * Bit 3 and Bit incomplete
   */
  cpl_a: function() {
    this.a ^= 0xff;
    this.f |= F_NEGATIVE | F_HALFCARRY;
  },

  /**
   * RRA Operation - Rotate right accumulator.
   */
  rra_a: function() {
    var carry = this.a & 1; // bit 1 rotates to carry flag
    this.a = ((this.a >> 1) | ((this.f & F_CARRY) << 7)) & 0xff; // Shift Right One Bit Position
    this.f = (this.f & 0xec) | carry;
  },

  /**
   * RLA Operation - Rotate left accumulator.
   */
  rla_a: function() {
    var carry = this.a >> 7; // bit 7 rotates to carry flag
    this.a = ((this.a << 1) | (this.f & F_CARRY)) & 0xff;
    this.f = (this.f & 0xec) | carry;
  },

  /**
   * RLCA Operation - Rotate left with carry accumulator.
   */
  rlca_a: function() {
    // Transfer Original Bit 7 to Bit 0 and Carry Flag
    var carry = this.a >> 7;

    // Shift register left
    this.a = ((this.a << 1) & 0xff) | carry;

    // Retain Sign, Zero, Bit 5, Bit 3 and Parity
    this.f = (this.f & 0xec) | carry;
  },

  /**
   * RRCA Operation - Rotate right with carry accumulator.
   */
  rrca_a: function() {
    var carry = this.a & 1;

    this.a = (this.a >> 1) | (carry << 7);

    // Retain Sign, Zero, Bit 5, Bit 3 and Parity
    this.f = (this.f & 0xec) | carry;
  },

  // NORMAL REGISTER ACCESS
  /**
   * @return {number}
   */
  getBC: function() {
    return (this.b << 8) | this.c;
  },

  /**
   * @return {number}
   */
  getDE: function() {
    return (this.d << 8) | this.e;
  },

  /**
   * @return {number}
   */
  getHL: function() {
    return (this.h << 8) | this.l;
  },

  /**
   * @return {number}
   */
  getAF: function() {
    return (this.a << 8) | this.f;
  },

  /**
   * @return {number}
   */
  getIXHIXL: function() {
    return (this.ixH << 8) | this.ixL;
  },

  /**
   * @return {number}
   */
  getIYHIYL: function() {
    return (this.iyH << 8) | this.iyL;
  },

  /**
   * @param {number} value
   */
  setBC: function(value) {
    this.b = value >> 8;
    this.c = value & 0xff;
  },

  /**
   * @param {number} value
   */
  setDE: function(value) {
    this.d = value >> 8;
    this.e = value & 0xff;
  },

  /**
   * @param {number} value
   */
  setHL: function(value) {
    this.h = value >> 8;
    this.l = value & 0xff;
  },

  /**
   * @param {number} value
   */
  setAF: function(value) {
    this.a = value >> 8;
    this.f = value & 0xff;
  },

  /**
   * @param {number} value
   */
  setIXHIXL: function(value) {
    this.ixH = value >> 8;
    this.ixL = value & 0xff;
  },

  /**
   * @param {number} value
   */
  setIYHIYL: function(value) {
    this.iyH = value >> 8;
    this.iyL = value & 0xff;
  },

  incBC: function() {
    this.c = (this.c + 1) & 0xff;
    if (this.c === 0) {
      this.b = (this.b + 1) & 0xff;
    }
  },

  incDE: function() {
    this.e = (this.e + 1) & 0xff;
    if (this.e === 0) {
      this.d = (this.d + 1) & 0xff;
    }
  },

  incHL: function() {
    this.l = (this.l + 1) & 0xff;
    if (this.l === 0) {
      this.h = (this.h + 1) & 0xff;
    }
  },

  incIXHIXL: function() {
    this.ixL = (this.ixL + 1) & 0xff;
    if (this.ixL === 0) {
      this.ixH = (this.ixH + 1) & 0xff;
    }
  },

  incIYHIYL: function() {
    this.iyL = (this.iyL + 1) & 0xff;
    if (this.iyL === 0) {
      this.iyH = (this.iyH + 1) & 0xff;
    }
  },

  decBC: function() {
    this.c = (this.c - 1) & 0xff;
    if (this.c === 255) {
      this.b = (this.b - 1) & 0xff;
    }
  },

  decDE: function() {
    this.e = (this.e - 1) & 0xff;
    if (this.e === 255) {
      this.d = (this.d - 1) & 0xff;
    }
  },

  decHL: function() {
    this.l = (this.l - 1) & 0xff;
    if (this.l === 255) {
      this.h = (this.h - 1) & 0xff;
    }
  },

  decIXHIXL: function() {
    this.ixL = (this.ixL - 1) & 0xff;
    if (this.ixL === 255) {
      this.ixH = (this.ixH - 1) & 0xff;
    }
  },

  decIYHIYL: function() {
    this.iyL = (this.iyL - 1) & 0xff;
    if (this.iyL === 255) {
      this.iyH = (this.iyH - 1) & 0xff;
    }
  },

  /**
   * @param {number} value
   * @return {number}
   */
  inc8: function(value) {
    value = (value + 1) & 0xff;
    this.f = (this.f & F_CARRY) | this.SZHV_INC_TABLE[value];
    return value;
  },

  /**
   * @param {number} value
   * @return {number}
   */
  dec8: function(value) {
    value = (value - 1) & 0xff;
    this.f = (this.f & F_CARRY) | this.SZHV_DEC_TABLE[value];
    return value;
  },

  // EXCHANGE REGISTER BANKS
  exAF: function() {
    /*if (SUPPORT_DESTRUCTURING) {
      [this.a, this.a2, this.f, this.f2] = [this.a2, this.a, this.f2, this.f];
    } else {*/
    var temp = this.a;
    this.a = this.a2;
    this.a2 = temp;
    temp = this.f;
    this.f = this.f2;
    this.f2 = temp;
    //}
  },

  exBC: function() {
    /*if (SUPPORT_DESTRUCTURING) {
      [this.b, this.b2, this.c, this.c2] = [this.b2, this.b, this.c2, this.c];
    } else {*/
    var temp = this.b;
    this.b = this.b2;
    this.b2 = temp;
    temp = this.c;
    this.c = this.c2;
    this.c2 = temp;
    //}
  },

  exDE: function() {
    /*if (SUPPORT_DESTRUCTURING) {
      [this.d, this.d2, this.e, this.e2] = [this.d2, this.d, this.e2, this.e];
    } else {*/
    var temp = this.d;
    this.d = this.d2;
    this.d2 = temp;
    temp = this.e;
    this.e = this.e2;
    this.e2 = temp;
    //}
  },

  exHL: function() {
    /*if (SUPPORT_DESTRUCTURING) {
      [this.h, this.h2, this.l, this.l2] = [this.h2, this.h, this.l2, this.l];
    } else {*/
    var temp = this.h;
    this.h = this.h2;
    this.h2 = temp;
    temp = this.l;
    this.l = this.l2;
    this.l2 = temp;
    //}
  },

  /**
   * @param {number} reg
   * @param {number} value
   * @return {number}
   */
  add16: function(reg, value) {
    var result = reg + value;
    this.f =
      (this.f & 0xc4) |
      (((reg ^ result ^ value) >> 8) & 0x10) |
      ((result >> 16) & 1);
    return result & 0xffff;
  },

  /**
   * Add with carry (16-bit).
   * Only ever affects HL register.
   *
   * @param {number} value
   */
  adc16: function(value) {
    var hl = this.getHL();

    var result = hl + value + (this.f & F_CARRY);
    this.f =
      (((hl ^ result ^ value) >> 8) & 0x10) |
      ((result >> 16) & 1) |
      ((result >> 8) & 0x80) |
      ((result & 0xffff) !== 0 ? 0 : 0x40) |
      (((value ^ hl ^ 0x8000) & (value ^ result) & 0x8000) >> 13);
    this.h = (result >> 8) & 0xff;
    this.l = result & 0xff;
  },

  /**
   * Subtract with carry (16-bit).
   * Only ever affects HL register.
   *
   * @param {number} value
   */
  sbc16: function(value) {
    var hl = this.getHL();

    var result = hl - value - (this.f & F_CARRY);
    this.f =
      (((hl ^ result ^ value) >> 8) & 0x10) |
      0x02 |
      ((result >> 16) & 1) |
      ((result >> 8) & 0x80) |
      ((result & 0xffff) !== 0 ? 0 : 0x40) |
      (((value ^ hl) & (hl ^ result) & 0x8000) >> 13);
    this.h = (result >> 8) & 0xff;
    this.l = result & 0xff;
  },

  /**
   * Increment refresh register.
   */
  incR: function() {
    this.r = (this.r & 0x80) | ((this.r + 1) & 0x7f);
  },

  /**
   * Do noting.
   */
  nop: function() {},

  // FLAG REGISTER
  /**
   * Generate flag tables.
   *
   * Based on code from the Java Emulation Framework
   * Copyright (C) 2002 Erik Duijs (erikduijs@yahoo.com)
   */
  generateFlagTables: function() {
    var i, sf, zf, yf, xf, pf;
    var padd, padc, psub, psbc;
    var val, oldval, newval;

    // Generate tables
    for (i = 0; i < 256; i++) {
      // Sign bits (0x80)
      sf = (i & 0x80) !== 0 ? F_SIGN : 0;

      // Zero bits (0x40)
      zf = i === 0 ? F_ZERO : 0;

      // Bit 5 (0x20)
      yf = i & 0x20;

      // Halfcarry (0x10)
      //hf = 0;

      // Bit 3 (0x08)
      xf = i & 0x08;

      // Overflow (0x04)
      //vf = 0;

      // Parity bits (0x04)
      pf = this.getParity(i) ? F_PARITY : 0;

      // Generate Sign/Zero Table
      this.SZ_TABLE[i] = sf | zf | yf | xf;

      // Generate Sign/Zero/Parity Table
      this.SZP_TABLE[i] = sf | zf | yf | xf | pf;

      // Generate table for inc8 instruction
      this.SZHV_INC_TABLE[i] = sf | zf | yf | xf;
      this.SZHV_INC_TABLE[i] |= i === 0x80 ? F_OVERFLOW : 0;
      this.SZHV_INC_TABLE[i] |= (i & 0x0f) === 0x00 ? F_HALFCARRY : 0;

      // Generate table for dec8 instruction
      this.SZHV_DEC_TABLE[i] = sf | zf | yf | xf | F_NEGATIVE;
      this.SZHV_DEC_TABLE[i] |= i === 0x7f ? F_OVERFLOW : 0;
      this.SZHV_DEC_TABLE[i] |= (i & 0x0f) === 0x0f ? F_HALFCARRY : 0;

      // Generate table for bit instruction (set sign flag on here)
      this.SZ_BIT_TABLE[i] = i !== 0 ? i & 0x80 : F_ZERO | F_PARITY;
      this.SZ_BIT_TABLE[i] |= yf | xf | F_HALFCARRY; // halfcarry is always on with bit instruction :)
    }

    // Generate fast lookups for ADD/SUB/ADC/SBC instructions
    padd = 0 * 256;
    padc = 256 * 256;
    psub = 0 * 256;
    psbc = 256 * 256;

    for (oldval = 0; oldval < 256; oldval++) {
      for (newval = 0; newval < 256; newval++) {
        /* add or adc w/o carry set */
        val = newval - oldval;

        if (newval !== 0) {
          if ((newval & 0x80) !== 0) {
            this.SZHVC_ADD_TABLE[padd] = F_SIGN;
          } else {
            this.SZHVC_ADD_TABLE[padd] = 0;
          }
        } else {
          this.SZHVC_ADD_TABLE[padd] = F_ZERO;
        }

        this.SZHVC_ADD_TABLE[padd] |= newval & (F_BIT5 | F_BIT3); // undocumented flag bits 5+3

        if ((newval & 0x0f) < (oldval & 0x0f)) {
          this.SZHVC_ADD_TABLE[padd] |= F_HALFCARRY;
        }
        if (newval < oldval) {
          this.SZHVC_ADD_TABLE[padd] |= F_CARRY;
        }
        if (((val ^ oldval ^ 0x80) & (val ^ newval) & 0x80) !== 0) {
          this.SZHVC_ADD_TABLE[padd] |= F_OVERFLOW;
        }
        padd++;

        /* adc with carry set */
        val = newval - oldval - 1;
        if (newval !== 0) {
          if ((newval & 0x80) !== 0) {
            this.SZHVC_ADD_TABLE[padc] = F_SIGN;
          } else {
            this.SZHVC_ADD_TABLE[padc] = 0;
          }
        } else {
          this.SZHVC_ADD_TABLE[padc] = F_ZERO;
        }

        this.SZHVC_ADD_TABLE[padc] |= newval & (F_BIT5 | F_BIT3); // undocumented flag bits 5+3

        if ((newval & 0x0f) <= (oldval & 0x0f)) {
          this.SZHVC_ADD_TABLE[padc] |= F_HALFCARRY;
        }
        if (newval <= oldval) {
          this.SZHVC_ADD_TABLE[padc] |= F_CARRY;
        }
        if (((val ^ oldval ^ 0x80) & (val ^ newval) & 0x80) !== 0) {
          this.SZHVC_ADD_TABLE[padc] |= F_OVERFLOW;
        }
        padc++;

        /* cp, sub or sbc w/o carry set */
        val = oldval - newval;
        if (newval !== 0) {
          if ((newval & 0x80) !== 0) {
            this.SZHVC_SUB_TABLE[psub] = F_NEGATIVE | F_SIGN;
          } else {
            this.SZHVC_SUB_TABLE[psub] = F_NEGATIVE;
          }
        } else {
          this.SZHVC_SUB_TABLE[psub] = F_NEGATIVE | F_ZERO;
        }

        this.SZHVC_SUB_TABLE[psub] |= newval & (F_BIT5 | F_BIT3); // undocumented flag bits 5+3

        if ((newval & 0x0f) > (oldval & 0x0f)) {
          this.SZHVC_SUB_TABLE[psub] |= F_HALFCARRY;
        }
        if (newval > oldval) {
          this.SZHVC_SUB_TABLE[psub] |= F_CARRY;
        }
        if (((val ^ oldval) & (oldval ^ newval) & 0x80) !== 0) {
          this.SZHVC_SUB_TABLE[psub] |= F_OVERFLOW;
        }
        psub++;

        /* sbc with carry set */
        val = oldval - newval - 1;
        if (newval !== 0) {
          if ((newval & 0x80) !== 0) {
            this.SZHVC_SUB_TABLE[psbc] = F_NEGATIVE | F_SIGN;
          } else {
            this.SZHVC_SUB_TABLE[psbc] = F_NEGATIVE;
          }
        } else {
          this.SZHVC_SUB_TABLE[psbc] = F_NEGATIVE | F_ZERO;
        }

        this.SZHVC_SUB_TABLE[psbc] |= newval & (F_BIT5 | F_BIT3); // undocumented flag bits 5+3

        if ((newval & 0x0f) >= (oldval & 0x0f)) {
          this.SZHVC_SUB_TABLE[psbc] |= F_HALFCARRY;
        }
        if (newval >= oldval) {
          this.SZHVC_SUB_TABLE[psbc] |= F_CARRY;
        }
        if (((val ^ oldval) & (oldval ^ newval) & 0x80) !== 0) {
          this.SZHVC_SUB_TABLE[psbc] |= F_OVERFLOW;
        }
        psbc++;
      }
    }
  },

  /**
   * Return the parity of a number.
   * Only used for pre-calculations.
   *
   * @param {number} value
   * @return {boolean} true if parity.
   */
  getParity: function(value) {
    var parity = true;
    var j;
    for (j = 0; j < 8; j++) {
      if ((value & (1 << j)) !== 0) {
        parity = !parity;
      }
    }
    return parity;
  },

  // MEMORY ACCESS
  /**
   * Memory constructor.
   */
  generateMemory: function() {
    if (SUPPORT_DATAVIEW) {
      for (var i = 0; i < 0x2000; i++) {
        this.memWriteMap.setUint8(i, 0);
      }
    } else {
      for (i = 0; i < 0x2000; i++) {
        this.memWriteMap[i] = 0;
      }
    }

    // Create 2 x 16K RAM Cartridge Pages
    if (SUPPORT_DATAVIEW) {
      for (i = 0; i < 0x8000; i++) {
        this.sram.setUint8(i, 0);
      }
    } else {
      for (i = 0; i < 0x8000; i++) {
        this.sram[i] = 0;
      }
    }
    this.useSRAM = false;

    this.number_of_pages = 2;

    for (i = 0; i < 4; i++) {
      this.frameReg[i] = i % 3;
    }
  },

  /**
   * Reset memory to default values.
   *
   * @param {Array.<Array.<number>>=} pages
   */
  resetMemory: function(pages) {
    var i = 0;

    if (pages) {
      this.rom = pages;
    }

    // Default Mapping
    if (this.rom.length) {
      this.number_of_pages = this.rom.length;
      this.romPageMask = this.number_of_pages - 1;

      // Paginated memory registers
      for (i = 0; i < 3; i++) {
        this.frameReg[i] = i % this.number_of_pages;
      }
      this.frameReg[3] = 0;

      if (ENABLE_COMPILER) {
        // Reset container for branches.
        this.branches = Array(this.number_of_pages);
        for (i = 0; i < this.number_of_pages; i++) {
          this.branches[i] = Object.create(null);
        }

        this.recompiler.setRom(this.rom);
      }
    } else {
      this.number_of_pages = 0;
      this.romPageMask = 0;
    }
  },

  /**
   * Read a signed value from next memory location.
   *
   * @return {number} Value from memory location.
   */
  d_: function() {
    return this.getUint8(this.pc);
  },

  /**
   * Write an unsigned 8-bit integer to the specified address.
   */
  setUint8: (function() {
    if (SUPPORT_DATAVIEW) {
      /**
       * @param {number} address Memory address.
       * @param {number} value Value to write.
       */
      return function setUint8(address, value) {
        if (address <= 0xffff) {
          this.memWriteMap.setUint8(address & 0x1fff, value);
          if (address === 0xfffc) {
            this.frameReg[3] = value;
          } else if (address === 0xfffd) {
            this.frameReg[0] = value & this.romPageMask;
          } else if (address === 0xfffe) {
            this.frameReg[1] = value & this.romPageMask;
          } else if (address === 0xffff) {
            this.frameReg[2] = value & this.romPageMask;
          }
        } else {
          JSSMS.Utils.console.error(JSSMS.Utils.toHex(address));
        }
      };
    } else {
      /**
       * @param {number} address Memory address.
       * @param {number} value Value to write.
       */
      return function setUint8(address, value) {
        if (address <= 0xffff) {
          this.memWriteMap[address & 0x1fff] = value;
          if (address === 0xfffc) {
            this.frameReg[3] = value;
          } else if (address === 0xfffd) {
            this.frameReg[0] = value & this.romPageMask;
          } else if (address === 0xfffe) {
            this.frameReg[1] = value & this.romPageMask;
          } else if (address === 0xffff) {
            this.frameReg[2] = value & this.romPageMask;
          }
        } else {
          JSSMS.Utils.console.error(JSSMS.Utils.toHex(address));
        }
      };
    }
  })(),

  /**
   * Write an unsigned 16-bit integer to the specified address.
   */
  setUint16: (function() {
    if (SUPPORT_DATAVIEW) {
      /**
       * @param {number} address Memory address.
       * @param {number} value Value to write.
       */
      return function setUint16(address, value) {
        if (address < 0xfffc) {
          this.memWriteMap.setUint16(address & 0x1fff, value, LITTLE_ENDIAN);
        } else if (address === 0xfffc) {
          this.frameReg[3] = value & 0xff;
          this.frameReg[0] = (value >> 8) & this.romPageMask;
        } else if (address === 0xfffd) {
          this.frameReg[0] = value & 0xff & this.romPageMask;
          this.frameReg[1] = (value >> 8) & this.romPageMask;
        } else if (address === 0xfffe) {
          this.frameReg[1] = value & 0xff & this.romPageMask;
          this.frameReg[2] = (value >> 8) & this.romPageMask;
        } else {
          JSSMS.Utils.console.error(JSSMS.Utils.toHex(address));
        }
      };
    } else {
      /**
       * @param {number} address Memory address.
       * @param {number} value Value to write.
       */
      return function setUint16(address, value) {
        if (address < 0xfffc) {
          address &= 0x1fff;
          this.memWriteMap[address++] = value & 0xff;
          this.memWriteMap[address] = value >> 8;
        } else if (address === 0xfffc) {
          this.frameReg[3] = value & 0xff;
          this.frameReg[0] = (value >> 8) & this.romPageMask;
        } else if (address === 0xfffd) {
          this.frameReg[0] = value & 0xff & this.romPageMask;
          this.frameReg[1] = (value >> 8) & this.romPageMask;
        } else if (address === 0xfffe) {
          this.frameReg[1] = value & 0xff & this.romPageMask;
          this.frameReg[2] = (value >> 8) & this.romPageMask;
        } else {
          JSSMS.Utils.console.error(JSSMS.Utils.toHex(address));
        }
      };
    }
  })(),

  /**
   * Read an unsigned 8-bit integer from the specified address.
   */
  getUint8: (function() {
    if (SUPPORT_DATAVIEW) {
      /**
       * @param {number} address
       * @return {number} Value from memory location.
       */
      return function getUint8(address) {
        if (address < 0x0400) {
          return this.rom[0].getUint8(address);
        } else if (address < 0x4000) {
          return this.rom[this.frameReg[0]].getUint8(address);
        } else if (address < 0x8000) {
          return this.rom[this.frameReg[1]].getUint8(address - 0x4000);
        } else if (address < 0xc000) {
          if ((this.frameReg[3] & 12) === 8) {
            this.useSRAM = true;
            return this.sram.getUint8(address - 0x8000);
          } else if ((this.frameReg[3] & 12) === 12) {
            this.useSRAM = true;
            return this.sram.getUint8(address - 0x4000);
          } else {
            return this.rom[this.frameReg[2]].getUint8(address - 0x8000);
          }
        } else if (address < 0xe000) {
          return this.memWriteMap.getUint8(address - 0xc000);
        } else if (address < 0xfffc) {
          return this.memWriteMap.getUint8(address - 0xe000);
        } else if (address === 0xfffc) {
          // 0xFFFC: RAM/ROM select register
          return this.frameReg[3];
        } else if (address === 0xfffd) {
          // 0xFFFD: Page 0 ROM Bank
          return this.frameReg[0];
        } else if (address === 0xfffe) {
          // 0xFFFE: Page 1 ROM Bank
          return this.frameReg[1];
        } else if (address === 0xffff) {
          // 0xFFFF: Page 2 ROM Bank
          return this.frameReg[2];
        } else {
          JSSMS.Utils.console.error(JSSMS.Utils.toHex(address));
        }
        return 0x00;
      };
    } else {
      /**
       * @param {number} address
       * @return {number} Value from memory location.
       */
      return function getUint8(address) {
        if (address < 0x0400) {
          return this.rom[0][address];
        } else if (address < 0x4000) {
          return this.rom[this.frameReg[0]][address];
        } else if (address < 0x8000) {
          return this.rom[this.frameReg[1]][address - 0x4000];
        } else if (address < 0xc000) {
          if ((this.frameReg[3] & 12) === 8) {
            this.useSRAM = true;
            return this.sram[address - 0x8000];
          } else if ((this.frameReg[3] & 12) === 12) {
            this.useSRAM = true;
            return this.sram[address - 0x4000];
          } else {
            return this.rom[this.frameReg[2]][address - 0x8000];
          }
        } else if (address < 0xe000) {
          return this.memWriteMap[address - 0xc000];
        } else if (address < 0xfffc) {
          return this.memWriteMap[address - 0xe000];
        } else if (address === 0xfffc) {
          // 0xFFFC: RAM/ROM select register
          return this.frameReg[3];
        } else if (address === 0xfffd) {
          // 0xFFFD: Page 0 ROM Bank
          return this.frameReg[0];
        } else if (address === 0xfffe) {
          // 0xFFFE: Page 1 ROM Bank
          return this.frameReg[1];
        } else if (address === 0xffff) {
          // 0xFFFF: Page 2 ROM Bank
          return this.frameReg[2];
        } else {
          JSSMS.Utils.console.error(JSSMS.Utils.toHex(address));
        }
        return 0x00;
      };
    }
  })(),

  /**
   * Read an unsigned 16-bit integer from the specified address.
   */
  getUint16: (function() {
    if (SUPPORT_DATAVIEW) {
      /**
       * @param {number} address
       * @return {number} Value from memory location.
       */
      return function getUint16(address) {
        if (address < 0x0400) {
          return this.rom[0].getUint16(address, LITTLE_ENDIAN);
        } else if (address < 0x4000) {
          return this.rom[this.frameReg[0]].getUint16(address, LITTLE_ENDIAN);
        } else if (address < 0x8000) {
          return this.rom[this.frameReg[1]].getUint16(
            address - 0x4000,
            LITTLE_ENDIAN
          );
        } else if (address < 0xc000) {
          if ((this.frameReg[3] & 12) === 8) {
            this.useSRAM = true;
            return this.sram[address - 0x8000];
          } else if ((this.frameReg[3] & 12) === 12) {
            this.useSRAM = true;
            return this.sram[address - 0x4000];
          } else {
            return this.rom[this.frameReg[2]].getUint16(
              address - 0x8000,
              LITTLE_ENDIAN
            );
          }
        } else if (address < 0xe000) {
          return this.memWriteMap.getUint16(address - 0xc000, LITTLE_ENDIAN);
        } else if (address < 0xfffc) {
          return this.memWriteMap.getUint16(address - 0xe000, LITTLE_ENDIAN);
        } else if (address === 0xfffc) {
          // 0xFFFC: RAM/ROM select register
          return this.frameReg[3];
        } else if (address === 0xfffd) {
          // 0xFFFD: Page 0 ROM Bank
          return this.frameReg[0];
        } else if (address === 0xfffe) {
          // 0xFFFE: Page 1 ROM Bank
          return this.frameReg[1];
        } else if (address === 0xffff) {
          // 0xFFFF: Page 2 ROM Bank
          return this.frameReg[2];
        } else {
          JSSMS.Utils.console.error(JSSMS.Utils.toHex(address));
        }
        return 0x00;
      };
    } else {
      /**
       * @param {number} address
       * @return {number} Value from memory location.
       */
      return function getUint16(address) {
        if (address < 0x0400) {
          return this.rom[0][address++] | (this.rom[0][address] << 8);
        } else if (address < 0x4000) {
          return (
            this.rom[this.frameReg[0]][address++] |
            (this.rom[this.frameReg[0]][address] << 8)
          );
        } else if (address < 0x8000) {
          return (
            this.rom[this.frameReg[1]][address++ - 0x4000] |
            (this.rom[this.frameReg[1]][address - 0x4000] << 8)
          );
        } else if (address < 0xc000) {
          if ((this.frameReg[3] & 12) === 8) {
            this.useSRAM = true;
            return (
              this.sram[address++ - 0x8000] | (this.sram[address - 0x8000] << 8)
            );
          } else if ((this.frameReg[3] & 12) === 12) {
            this.useSRAM = true;
            return (
              this.sram[address++ - 0x4000] | (this.sram[address - 0x4000] << 8)
            );
          } else {
            return (
              this.rom[this.frameReg[2]][address++ - 0x8000] |
              (this.rom[this.frameReg[2]][address - 0x8000] << 8)
            );
          }
        } else if (address < 0xe000) {
          return (
            this.memWriteMap[address++ - 0xc000] |
            (this.memWriteMap[address - 0xc000] << 8)
          );
        } else if (address < 0xfffc) {
          return (
            this.memWriteMap[address++ - 0xe000] |
            (this.memWriteMap[address - 0xe000] << 8)
          );
        } else if (address === 0xfffc) {
          // 0xFFFC: RAM/ROM select register
          return this.frameReg[3];
        } else if (address === 0xfffd) {
          // 0xFFFD: Page 0 ROM Bank
          return this.frameReg[0];
        } else if (address === 0xfffe) {
          // 0xFFFE: Page 1 ROM Bank
          return this.frameReg[1];
        } else if (address === 0xffff) {
          // 0xFFFF: Page 2 ROM Bank
          return this.frameReg[2];
        } else {
          JSSMS.Utils.console.error(JSSMS.Utils.toHex(address));
        }
        return 0x00;
      };
    }
  })(),

  /**
   * Read a signed 8-bit integer from the specified address.
   */
  getInt8: (function() {
    if (SUPPORT_DATAVIEW) {
      /**
       * @param {number} address
       * @return {number} Value from memory location.
       */
      return function getInt8(address) {
        var value = 0x00;
        if (address < 0x0400) {
          value = this.rom[0].getInt8(address);
        } else if (address < 0x4000) {
          value = this.rom[this.frameReg[0]].getInt8(address);
        } else if (address < 0x8000) {
          value = this.rom[this.frameReg[1]].getInt8(address - 0x4000);
        } else if (address < 0xc000) {
          if ((this.frameReg[3] & 12) === 8) {
            this.useSRAM = true;
            value = this.sram.getInt8(address - 0x8000);
          } else if ((this.frameReg[3] & 12) === 12) {
            this.useSRAM = true;
            value = this.sram.getInt8(address - 0x4000);
          } else {
            value = this.rom[this.frameReg[2]].getInt8(address - 0x8000);
          }
        } else if (address < 0xe000) {
          value = this.memWriteMap.getInt8(address - 0xc000);
        } else if (address < 0xfffc) {
          value = this.memWriteMap.getInt8(address - 0xe000);
        } else if (address === 0xfffc) {
          // 0xFFFC: RAM/ROM select register
          return this.frameReg[3];
        } else if (address === 0xfffd) {
          // 0xFFFD: Page 0 ROM Bank
          return this.frameReg[0];
        } else if (address === 0xfffe) {
          // 0xFFFE: Page 1 ROM Bank
          return this.frameReg[1];
        } else if (address === 0xffff) {
          // 0xFFFF: Page 2 ROM Bank
          return this.frameReg[2];
        } else {
          JSSMS.Utils.console.error(JSSMS.Utils.toHex(address));
        }
        return value + 1;
      };
    } else {
      /**
       * @param {number} address
       * @return {number} Value from memory location.
       */
      return function getInt8(address) {
        var value = 0x00;
        if (address < 0x0400) {
          value = this.rom[0][address];
        } else if (address < 0x4000) {
          value = this.rom[this.frameReg[0]][address];
        } else if (address < 0x8000) {
          value = this.rom[this.frameReg[1]][address - 0x4000];
        } else if (address < 0xc000) {
          if ((this.frameReg[3] & 12) === 8) {
            this.useSRAM = true;
            value = this.sram[address - 0x8000];
          } else if ((this.frameReg[3] & 12) === 12) {
            this.useSRAM = true;
            value = this.sram[address - 0x4000];
          } else {
            value = this.rom[this.frameReg[2]][address - 0x8000];
          }
        } else if (address < 0xe000) {
          value = this.memWriteMap[address - 0xc000];
        } else if (address < 0xfffc) {
          value = this.memWriteMap[address - 0xe000];
        } else if (address === 0xfffc) {
          // 0xFFFC: RAM/ROM select register
          return this.frameReg[3];
        } else if (address === 0xfffd) {
          // 0xFFFD: Page 0 ROM Bank
          return this.frameReg[0];
        } else if (address === 0xfffe) {
          // 0xFFFE: Page 1 ROM Bank
          return this.frameReg[1];
        } else if (address === 0xffff) {
          // 0xFFFF: Page 2 ROM Bank
          return this.frameReg[2];
        } else {
          JSSMS.Utils.console.error(JSSMS.Utils.toHex(address));
        }
        value += 1;
        if (value >= 128) {
          value = value - 256;
        }
        return value;
      };
    }
  })(),

  /**
   * @return {boolean}
   */
  hasUsedSRAM: function() {
    return this.useSRAM;
  },

  setSRAM: function(bytes) {
    var length = bytes.length / PAGE_SIZE;
    var i;

    for (i = 0; i < length; i++) {
      JSSMS.Utils.copyArrayElements(
        bytes,
        i * PAGE_SIZE,
        this.sram[i],
        0,
        PAGE_SIZE
      );
    }
  },

  /**
   * Called when restoring from a saved state.
   *
   * @param {Array.<number>} state Contents of frame register.
   */
  setStateMem: function(state) {
    this.frameReg = state;
  },

  // Z80 State Saving
  /**
   * @return {Array.<number>}
   */
  getState: function() {
    /**
     * Length of state array.
     * @type {number}
     */
    var STATE_LENGTH = 8;
    var state = new Array(STATE_LENGTH);

    state[0] = this.pc | (this.sp << 16);
    state[1] =
      (this.iff1 ? 0x01 : 0) |
      (this.iff2 ? 0x02 : 0) |
      (this.halt ? 0x04 : 0) |
      (this.EI_inst ? 0x08 : 0) |
      (this.interruptLine ? 0x10 : 0);
    state[2] = this.a | (this.a2 << 8) | (this.f << 16) | (this.f2 << 24); // AF AF'
    state[3] = this.getBC() | (this.getDE() << 16); // BC DE
    state[4] = this.getHL() | (this.r << 16) | (this.i << 24); // HL, r, i
    state[5] = this.getIXHIXL() | (this.getIYHIYL() << 16); // IX, IY

    this.exBC();
    this.exDE();
    this.exHL(); // swap registers

    state[6] = this.getBC() | (this.getDE() << 16); // BC' DE'
    state[7] = this.getHL() | (this.im << 16) | (this.interruptVector << 24); // HL' and interrupt mode

    this.exBC();
    this.exDE();
    this.exHL(); // restore registers

    return state;
  },

  /**
   * @param {Array.<number>} state
   */
  setState: function(state) {
    var temp = state[0];
    this.pc = temp & 0xffff;
    this.sp = (temp >> 16) & 0xffff;

    temp = state[1];
    this.iff1 = (temp & 0x01) !== 0;
    this.iff2 = (temp & 0x02) !== 0;
    this.halt = (temp & 0x04) !== 0;
    this.EI_inst = (temp & 0x08) !== 0;
    this.interruptLine = (temp & 0x10) !== 0;

    temp = state[2];
    this.a = temp & 0xff;
    this.a2 = (temp >> 8) & 0xff;
    this.f = (temp >> 16) & 0xff;
    this.f2 = (temp >> 24) & 0xff;

    temp = state[3];
    this.setBC(temp & 0xffff);
    this.setDE((temp >> 16) & 0xffff);

    temp = state[4];
    this.setHL(temp & 0xffff);
    this.r = (temp >> 16) & 0xff;
    this.i = (temp >> 24) & 0xff;

    temp = state[5];
    this.setIXHIXL(temp & 0xffff);
    this.setIYHIYL((temp >> 16) & 0xffff);

    this.exBC();
    this.exDE();
    this.exHL(); // swap registers

    temp = state[6];
    this.setBC(temp & 0xffff);
    this.setDE((temp >> 16) & 0xffff);

    temp = state[7];
    this.setHL(temp & 0xffff);
    this.im = (temp >> 16) & 0xff;
    this.interruptVector = (temp >> 24) & 0xff;

    this.exBC();
    this.exDE();
    this.exHL(); // restore registers
  },
};

'use strict';

/** @const */ var NTSC = 0;
/** @const */ var PAL = 1;

/**
 * X Pixels, including blanking.
 * @const
 */
var SMS_X_PIXELS = 342;

/**
 * Y Pixels (NTSC), including blanking.
 * @const
 */
var SMS_Y_PIXELS_NTSC = 262;

/**
 * Y Pixels (PAL), including blanking.
 * @const
 */
var SMS_Y_PIXELS_PAL = 313;

/**
 * SMS visible screen width.
 * @const
 */
var SMS_WIDTH = 256;

/**
 * SMS visible screen height.
 * @const
 */
var SMS_HEIGHT = 192;

/**
 * GG visible screen width.
 * @const
 */
var GG_WIDTH = 160;

/**
 * GG visible screen height.
 * @const
 */
var GG_HEIGHT = 144;

/**
 * GG visible window starts here (x).
 * @const
 */
var GG_X_OFFSET = 48;

/**
 * GG window starts here (y).
 * @const
 */
var GG_Y_OFFSET = 24;

/** @const */ var STATUS_VINT = 0x80; // Frame Interrupt Pending
/** @const */ var STATUS_OVERFLOW = 0x40; // Sprite Overflow
/** @const */ var STATUS_COLLISION = 0x20; // Sprite Collision
/** @const */ var STATUS_HINT = 0x04; // Line interrupt Pending

/** This would be different in 224 line mode. */
/** @const */ var BGT_LENGTH = 32 * 28 * 2;

/** Max number of sprites hardware can handle per scanline. */
/** @const */ var SPRITES_PER_LINE = 8;

/** References into lineSprites table. */
/** @const */ var SPRITE_COUNT = 0; // Number of sprites on line

/** @const */ var SPRITE_X = 1; // Sprite X Position
/** @const */ var SPRITE_Y = 2; // Sprite Y Position
/** @const */ var SPRITE_N = 3; // Sprite Pattern

// Total number of tiles in VRAM
/** @const */ var TOTAL_TILES = 512;

// Tile size
/** @const */ var TILE_SIZE = 8;

/**
 * @constructor
 * @param {JSSMS} sms
 */
JSSMS.Vdp = function(sms) {
  this.main = sms;

  var i = 0;

  /**
   * NTSC / PAL emulation.
   * @type {number}
   */
  this.videoMode = NTSC;

  // VDP Emulation
  /**
   * Video RAM.
   * 16K of Video RAM.
   * @type {Uint8Array}
   */
  this.VRAM = new JSSMS.Utils.Uint8Array(0x4000);

  /**
   * Colour RAM.
   * Note, we don't directly emulate CRAM but actually store the converted Java palette
   * in it. Therefore the length is different to on the real Game Gear where it's actually
   * 64 bytes.
   * @type {Uint8Array}
   */
  this.CRAM = new JSSMS.Utils.Uint8Array(0x20 * 3);
  for (i = 0; i < 0x20 * 3; i++) {
    this.CRAM[i] = 0xff;
  }

  /**
   * VDP registers.
   * 15 Registers, (0-10) used by SMS, but some programs write > 10.
   * @type {Uint8Array}
   */
  this.vdpreg = new JSSMS.Utils.Uint8Array(16);

  /**
   * Status register.
   * @type {number}
   */
  this.status = 0;

  /**
   * First or second byte of command word.
   * @type {boolean}
   */
  this.firstByte = false;

  /**
   * Command word first byte latch.
   * @type {number}
   */
  this.commandByte = 0;

  /**
   * Location in VRAM.
   * @type {number}
   */
  this.location = 0;

  /**
   * Store type of operation taking place.
   * @type {number}
   */
  this.operation = 0;

  /**
   * Buffer VRAM reads.
   * @type {number}
   */
  this.readBuffer = 0;

  /**
   * Current line number to render.
   * @type {number}
   */
  this.line = 0;

  /**
   * Vertical line interrupt counter.
   * @type {number}
   */
  this.counter = 0;

  /**
   * Background priorities.
   * @type {Uint8Array}
   */
  this.bgPriority = new JSSMS.Utils.Uint8Array(SMS_WIDTH);

  /** Sprite collisions. */
  if (VDP_SPRITE_COLLISIONS) {
    /**
     * @type {Uint8Array}
     */
    this.spriteCol = new JSSMS.Utils.Uint8Array(SMS_WIDTH);
  }

  /**
   * Address of background table (32x28x2 = 0x700 bytes).
   * @type {number}
   */
  this.bgt = 0;

  /**
   * As vscroll cannot be changed during the active display period.
   * @type {number}
   */
  this.vScrollLatch = 0;

  // Emulation Related
  /**
   * Emulated display.
   * @type {Uint8ClampedArray}
   */
  this.display = /** @type {Uint8ClampedArray} */ (sms.ui.canvasImageData.data);

  /** SMS colours converted to RGB hex. */
  /** @type {Uint8Array} */ this.main_JAVA_R = new JSSMS.Utils.Uint8Array(0x40);
  /** @type {Uint8Array} */ this.main_JAVA_G = new JSSMS.Utils.Uint8Array(0x40);
  /** @type {Uint8Array} */ this.main_JAVA_B = new JSSMS.Utils.Uint8Array(0x40);

  /** GG colours converted to RGB hex. */
  /** @type {Uint8Array} */ this.GG_JAVA_R = new JSSMS.Utils.Uint8Array(0x100);
  /** @type {Uint8Array} */ this.GG_JAVA_G = new JSSMS.Utils.Uint8Array(0x100);
  /** @type {Uint8Array} */ this.GG_JAVA_B = new JSSMS.Utils.Uint8Array(0x10);

  /**
   * Horizontal viewport start.
   * @type {number}
   */
  this.h_start = 0;

  /**
   * Horizontal viewport end.
   * @type {number}
   */
  this.h_end = 0;

  // Decoded SAT Table
  /**
   * Address of sprite attribute table (256 bytes).
   * @type {number}
   */
  this.sat = 0;

  /**
   * Determine whether SAT has been written to.
   * @type {boolean}
   */
  this.isSatDirty = false;

  /**
   * Decoded SAT by each scanline.
   * @type {Array.<Uint8Array>}
   */
  this.lineSprites = new Array(SMS_HEIGHT);
  for (i = 0; i < SMS_HEIGHT; i++) {
    this.removeSpriteLimit = true;
    this.lineSprites[i] = new JSSMS.Utils.Uint8Array(1 + 3 * 64);
  }

  // Decoded Tiles
  /**
   * Decoded tile data.
   * @type {Array.<Uint8Array>}
   */
  this.tiles = new Array(TOTAL_TILES);

  /**
   * Store whether tile has been written to.
   * @type {Uint8Array}
   */
  this.isTileDirty = new JSSMS.Utils.Uint8Array(TOTAL_TILES);

  /** Min / Max of dirty tile index. */
  /** @type {number} */ this.minDirty = 0;
  /** @type {number} */ this.maxDirty = 0;

  this.createCachedImages();
  this.generateConvertedPals();
};

JSSMS.Vdp.prototype = {
  /**
   * Reset VDP.
   */
  reset: function() {
    var i;

    this.firstByte = true;

    this.location = 0;
    this.counter = 0;
    this.status = 0;
    this.operation = 0;
    for (i = 0; i < 16; i++) {
      this.vdpreg[i] = 0;
    }
    this.vdpreg[2] = 0x0e; // B1-B3 high on startup
    this.vdpreg[5] = 0x7e; // B1-B6 high on startup

    this.vScrollLatch = 0;

    this.main.cpu.interruptLine = false;

    this.isSatDirty = true;

    this.minDirty = TOTAL_TILES;
    this.maxDirty = -1;

    for (i = 0x0000; i < 0x4000; i++) {
      this.VRAM[i] = 0;
    }

    for (i = 0; i < SMS_WIDTH * SMS_HEIGHT * 4; i = i + 4) {
      this.display[i] = 0x00;
      this.display[i + 1] = 0x00;
      this.display[i + 2] = 0x00;
      this.display[i + 3] = 0xff; // Alpha channel
    }
  },

  /**
   * Force full redraw of entire cache.
   */
  forceFullRedraw: function() {
    this.bgt = (this.vdpreg[2] & 0x0f & ~0x01) << 10;
    this.minDirty = 0;
    this.maxDirty = TOTAL_TILES - 1;
    for (var i = 0; i < TOTAL_TILES; i++) {
      this.isTileDirty[i] = 1;
    }

    this.sat = (this.vdpreg[5] & ~0x01 & ~0x80) << 7;
    this.isSatDirty = true;
  },

  /**
   * Read Vertical Port
   *
   * @return {number} VCounter Value.
   */
  getVCount: function() {
    if (this.videoMode === NTSC) {
      if (this.line > 0xda) {
        return this.line - 0x06; // Values from 00 to DA, then jump to D5-FF
      }
    } else {
      // PAL
      if (this.line > 0xf2) {
        return this.line - 0x39;
      }
    }

    return this.line;
  },

  /**
   * Read VDP control port (0xBF).
   *
   * @return {number} Copy of status register.
   */
  controlRead: function() {
    // Reset flag
    this.firstByte = true;

    // Create copy, as we'll need to clear bits of status reg
    var statuscopy = this.status;

    // Clear b7, b6, b5 when status register read
    this.status = 0; // other bits never used anyway

    // Clear IRQ Line
    this.main.cpu.interruptLine = false;

    return statuscopy;
  },

  /**
   * Write to VDP control port (0xBF).
   *
   * @param {number} value Value to write.
   */
  controlWrite: function(value) {
    // Store First Byte of Command Word
    if (this.firstByte) {
      this.firstByte = false;
      this.commandByte = value;
      this.location = (this.location & 0x3f00) | value;
    } else {
      this.firstByte = true;
      this.operation = (value >> 6) & 3;
      this.location = this.commandByte | (value << 8);

      // Read value from VRAM
      if (this.operation === 0) {
        this.readBuffer = this.VRAM[this.location++ & 0x3fff] & 0xff;
      } else if (this.operation === 2) {
        // Set VDP Register
        var reg = value & 0x0f;

        switch (reg) {
          // Interrupt Control 0 (Verified using Charles MacDonald test program)
          // Bit 4 of register $00 acts like a on/off switch for the VDP's IRQ line.

          // As long as the line interrupt pending flag is set, the VDP will assert the
          // IRQ line if bit 4 of register $00 is set, and it will de-assert the IRQ line
          // if the same bit is cleared.
          case 0:
            if (
              ACCURATE_INTERRUPT_EMULATION &&
              (this.status & STATUS_HINT) !== 0
            ) {
              this.main.cpu.interruptLine = (this.commandByte & 0x10) !== 0;
            }
            break;

          // Interrupt Control 1
          case 1:
            if (
              (this.status & STATUS_VINT) !== 0 &&
              (this.commandByte & 0x20) !== 0
            ) {
              this.main.cpu.interruptLine = true;
            }

            // By writing here we've updated the height of the sprites and need to update
            // the sprites on each line
            if ((this.commandByte & 3) !== (this.vdpreg[reg] & 3)) {
              this.isSatDirty = true;
            }
            break;

          // BGT Written
          case 2:
            // Address of Background Table in VRAM
            this.bgt = (this.commandByte & 0x0f & ~0x01) << 10;
            break;

          // SAT Written
          case 5:
            var old = this.sat;
            // Address of Sprite Attribute Table in RAM
            this.sat = (this.commandByte & ~0x01 & ~0x80) << 7;

            if (old !== this.sat) {
              // Should also probably update tiles here?
              this.isSatDirty = true;
              //JSSMS.Utils.console.log('New address written to SAT: ' + old + ' -> ' + this.sat);
            }
            break;
        }
        this.vdpreg[reg] = this.commandByte; // Set reg to previous byte
      }
    }
  },

  /**
   * Read VDP data port (0xBE).
   *
   * @return {number} Buffered read from VRAM.
   */
  dataRead: function() {
    // 0xBE
    this.firstByte = true; // Reset flag

    var value = this.readBuffer; // Stores value to be returned
    this.readBuffer = this.VRAM[this.location++ & 0x3fff] & 0xff;

    return value;
  },

  /**
   * Write to VDP data port (0xBE).
   *
   * @param {number} value Value to Write.
   */
  dataWrite: function(value) {
    var temp = 0;

    // Reset flag
    this.firstByte = true;

    switch (this.operation) {
      // VRAM Write
      case 0x00:
      case 0x01:
      case 0x02:
        var address = this.location & 0x3fff;
        // Check VRAM value has actually changed
        if (value !== (this.VRAM[address] & 0xff)) {
          //if (address >= bgt && address < bgt + BGT_LENGTH); // Don't write dirty to BGT
          if (
            (address >= this.sat && address < this.sat + 64) ||
            (address >= this.sat + 128 && address < this.sat + 256)
          ) {
            // Don't write dirty to SAT
            this.isSatDirty = true;
          } else {
            var tileIndex = address >> 5;

            // Get tile number that's being written to (divide VRAM location by 32).
            this.isTileDirty[tileIndex] = 1;
            if (tileIndex < this.minDirty) {
              this.minDirty = tileIndex;
            }
            if (tileIndex > this.maxDirty) {
              this.maxDirty = tileIndex;
            }
          }

          this.VRAM[address] = value;
        }
        break;
      // CRAM Write
      // Instead of writing real colour to CRAM, write converted Java palette colours for speed.
      // Slightly inaccurate, as CRAM doesn't contain real values, but it is never read by software.
      case 0x03:
        if (this.main.is_sms) {
          temp = (this.location & 0x1f) * 3;
          this.CRAM[temp] = this.main_JAVA_R[value];
          this.CRAM[temp + 1] = this.main_JAVA_G[value];
          this.CRAM[temp + 2] = this.main_JAVA_B[value];
        } else {
          temp = ((this.location & 0x3f) >> 1) * 3;
          if (!(this.location & 0x01)) {
            // first byte
            this.CRAM[temp] = this.GG_JAVA_R[value];
            this.CRAM[temp + 1] = this.GG_JAVA_G[value];
          } else {
            this.CRAM[temp + 2] = this.GG_JAVA_B[value];
          }
        }
        break;
    }

    if (ACCURATE) {
      this.readBuffer = value;
    }

    this.location++;
  },

  /**
   * Generate VDP Interrupts.
   * Assert the IRQ line as necessary for a particular scanline.
   *
   * @param {number} lineno  Line to check for interrupts.
   *
   * @see http://www.smspower.org/forums/viewtopic.php?t=9366&highlight=chicago
   */
  interrupts: function(lineno) {
    if (lineno <= 192) {
      // This can cause hangs as interrupts are only taken between instructions,
      // if the IRQ status flag is set *during* the execution of an instruction the
      // CPU will be able to read it without the interrupt occurring.
      //
      // e.g. Chicago Syndicate on GG

      if (!ACCURATE_INTERRUPT_EMULATION && lineno === 192) {
        this.status |= STATUS_VINT;
      }

      // Counter Expired = Line Interrupt Pending
      if (this.counter === 0) {
        // Reload Counter
        this.counter = this.vdpreg[10];
        this.status |= STATUS_HINT;
      } else {
        // Otherwise Decrement Counter
        this.counter--;
      }

      // Line Interrupts Enabled and Pending. Assert IRQ Line.
      if ((this.status & STATUS_HINT) !== 0 && (this.vdpreg[0] & 0x10) !== 0) {
        this.main.cpu.interruptLine = true;
      }
    } else {
      // lineno >= 193
      // Reload counter on every line outside active display + 1
      this.counter = this.vdpreg[10];

      // Frame Interrupts Enabled and Pending. Assert IRQ Line.
      if (
        (this.status & STATUS_VINT) !== 0 &&
        (this.vdpreg[1] & 0x20) !== 0 &&
        lineno < 224
      ) {
        this.main.cpu.interruptLine = true;
      }

      // Update the VSCROLL latch for the next active display period
      if (ACCURATE && lineno === this.main.no_of_scanlines - 1) {
        this.vScrollLatch = this.vdpreg[9];
      }
    }
  },

  setVBlankFlag: function() {
    this.status |= STATUS_VINT;
  },

  /**
   * Render Line of SMS/GG Display.
   *
   * @param {number} lineno Line Number to Render.
   */
  drawLine: function(lineno) {
    var x = 0;
    var location = 0;
    var colour = 0;

    // Check we are in the visible drawing region
    if (
      this.main.is_gg &&
      (lineno < GG_Y_OFFSET || lineno >= GG_Y_OFFSET + GG_HEIGHT)
    ) {
      return;
    }

    // Clear sprite collision array if enabled
    if (VDP_SPRITE_COLLISIONS) {
      for (x = 0; x < SMS_WIDTH /* this.spriteCol.length */; x++) {
        this.spriteCol[x] = false;
      }
    }

    // Check Screen is switched on
    if ((this.vdpreg[1] & 0x40) !== 0) {
      // Draw Background Layer
      if (this.maxDirty !== -1) {
        this.decodeTiles();
      }

      this.drawBg(lineno);

      // Draw Sprite Layer
      if (this.isSatDirty) {
        this.decodeSat();
      }

      if (this.lineSprites[lineno][SPRITE_COUNT] !== 0) {
        this.drawSprite(lineno);
      }

      // Blank Leftmost Column (SMS Only)
      if (this.main.is_sms && this.vdpreg[0] & 0x20) {
        location = (lineno << 8) * 4;
        colour = ((this.vdpreg[7] & 0x0f) + 16) * 3;

        for (x = location; x < location + 8 * 4; x = x + 4) {
          this.display[x] = this.CRAM[colour];
          this.display[x + 1] = this.CRAM[colour + 1];
          this.display[x + 2] = this.CRAM[colour + 2];
        }
      }
    } else {
      // Blank Display
      this.drawBGColour(lineno);
    }
  },

  /**
   * @param {number} lineno
   */
  drawBg: function(lineno) {
    var pixX = 0;
    var colour = 0;
    var temp = 0;
    var temp2 = 0;

    // Horizontal Scroll
    var hscroll = this.vdpreg[8];

    // Vertical Scroll
    var vscroll = ACCURATE ? this.vScrollLatch : this.vdpreg[9];

    // Top Two Rows Not Affected by Horizontal Scrolling (SMS Only)
    // We don't actually need the SMS check here as we don't draw this line for GG now
    if (lineno < 16 && (this.vdpreg[0] & 0x40) !== 0 /*&& this.main.is_sms*/) {
      hscroll = 0;
    }

    // Lock Right eight columns
    var lock = this.vdpreg[0] & 0x80;

    // Column to start drawing at (0 - 31) [Add extra columns for GG]
    var tile_column = 32 - (hscroll >> 3) + this.h_start;

    // Row to start drawing at (0 - 27)
    var tile_row = (lineno + vscroll) >> 3;

    if (tile_row > 27) {
      tile_row -= 28;
    }

    // Actual y position in tile (0 - 7) (Also times by 8 here for quick access to pixel)
    var tile_y = ((lineno + (vscroll & 7)) & 7) << 3;

    // Array Position
    var row_precal = lineno << 8;

    // Cycle through background table
    for (var tx = this.h_start; tx < this.h_end; tx++) {
      var tile_props = this.bgt + ((tile_column & 0x1f) << 1) + (tile_row << 6);
      var secondbyte = this.VRAM[tile_props + 1];

      // Select Palette (Either 0 or 16)
      var pal = (secondbyte & 0x08) << 1;

      // Screen X Position
      var sx = (tx << 3) + (hscroll & 7);

      // Do V-Flip (take into account the fact that everything is times 8)
      var pixY = (secondbyte & 0x04) === 0 ? tile_y : (7 << 3) - tile_y;

      // Pattern Number (0 - 512)
      var tile = this.tiles[
        (this.VRAM[tile_props] & 0xff) + ((secondbyte & 0x01) << 8)
      ];

      // Plot 8 Pixel Row (No H-Flip)
      if (!(secondbyte & 0x02)) {
        for (pixX = 0; pixX < 8 && sx < SMS_WIDTH; pixX++, sx++) {
          colour = tile[pixX + pixY];
          temp = (sx + row_precal) * 4;
          temp2 = (colour + pal) * 3;

          // Set Priority Array (Sprites over/under background tile)
          this.bgPriority[sx] = (secondbyte & 0x10) !== 0 && colour !== 0;
          if (sx >= this.h_start * 8 && sx < this.h_end * 8) {
            this.display[temp] = this.CRAM[temp2];
            this.display[temp + 1] = this.CRAM[temp2 + 1];
            this.display[temp + 2] = this.CRAM[temp2 + 2];
          }
        }
      } else {
        // Plot 8 Pixel Row (H-Flip)
        for (pixX = 7; pixX >= 0 && sx < SMS_WIDTH; pixX--, sx++) {
          colour = tile[pixX + pixY];
          temp = (sx + row_precal) * 4;
          temp2 = (colour + pal) * 3;

          // Set Priority Array (Sprites over/under background tile)
          this.bgPriority[sx] = (secondbyte & 0x10) !== 0 && colour !== 0;
          if (sx >= this.h_start * 8 && sx < this.h_end * 8) {
            this.display[temp] = this.CRAM[temp2];
            this.display[temp + 1] = this.CRAM[temp2 + 1];
            this.display[temp + 2] = this.CRAM[temp2 + 2];
          }
        }
      }
      tile_column++;

      // Rightmost 8 columns Not Affected by Vertical Scrolling
      if (lock !== 0 && tx === 23) {
        tile_row = lineno >> 3;
        tile_y = (lineno & 7) << 3;
      }
    }
  },

  /**
   * Render Line of Sprite Layer.
   * - Notes: Sprites do not wrap on the x-axis.
   *
   * @param {number} lineno Line Number to Render.
   */
  drawSprite: function(lineno) {
    var colour = 0;
    var temp = 0;
    var temp2 = 0;
    var i = 0;

    // Reference to the sprites that should appear on this line
    var sprites = this.lineSprites[lineno];

    // Number of sprites to draw on this scanline
    var count = Math.min(this.removeSpriteLimit ? 64 : SPRITES_PER_LINE, sprites[SPRITE_COUNT]);

    // Zoom Sprites (0 = off, 1 = on)
    var zoomed = this.vdpreg[1] & 0x01;

    var row_precal = lineno << 8;

    // Get offset into array
    var off = count * 3;

    // Have to iterate backwards here as we've already cached tiles
    for (; i < count; i++) {
      // Sprite Pattern Index
      // Also mask on Pattern Index from 100 - 1FFh (if reg 6 bit 3 set)
      var n = sprites[off--] | ((this.vdpreg[6] & 0x04) << 6);

      // Sprite Y Position
      var y = sprites[off--];

      // Sprite X Position
      // Shift pixels left by 8 if necessary
      var x = sprites[off--] - (this.vdpreg[0] & 0x08);

      // Row of tile data to render (0-7)
      var tileRow = (lineno - y) >> zoomed;

      // When using 8x16 sprites LSB has no effect
      if ((this.vdpreg[1] & 0x02) !== 0) {
        n &= ~0x01;
      }

      // Pattern Number (0 - 512)
      var tile = this.tiles[n + ((tileRow & 0x08) >> 3)];

      // If X Co-ordinate is negative, do a fix to draw from position 0
      var pix = 0;

      if (x < 0) {
        pix = -x;
        x = 0;
      }

      // Offset into decoded tile data
      var offset = pix + ((tileRow & 7) << 3);

      // Plot Normal Sprites (Width = 8)
      if (!zoomed) {
        for (; pix < 8 && x < this.h_end * 8; pix++, x++) {
          colour = tile[offset++];

          if (x >= this.h_start * 8 && colour !== 0 && !this.bgPriority[x]) {
            temp = (x + row_precal) * 4;
            temp2 = (colour + 16) * 3;

            this.display[temp] = this.CRAM[temp2];
            this.display[temp + 1] = this.CRAM[temp2 + 1];
            this.display[temp + 2] = this.CRAM[temp2 + 2];

            // Emulate sprite collision (when two opaque pixels overlap)
            if (VDP_SPRITE_COLLISIONS) {
              if (!this.spriteCol[x]) {
                this.spriteCol[x] = true;
              } else {
                this.status |= STATUS_COLLISION; // Bit 5 of status flag indicates collision
              }
            }
          }
        }
      } else {
        // Plot Zoomed Sprites (Width = 16)
        for (; pix < 8 && x < this.h_end * 8; pix++, x += 2) {
          colour = tile[offset++];

          // Plot first pixel
          if (x >= this.h_start * 8 && colour !== 0 && !this.bgPriority[x]) {
            temp = (x + row_precal) * 4;
            temp2 = (colour + 16) * 3;

            this.display[temp] = this.CRAM[temp2];
            this.display[temp + 1] = this.CRAM[temp2 + 1];
            this.display[temp + 2] = this.CRAM[temp2 + 2];

            if (VDP_SPRITE_COLLISIONS) {
              if (!this.spriteCol[x]) {
                this.spriteCol[x] = true;
              } else {
                this.status |= STATUS_COLLISION; // Bit 5 of status flag indicates collision
              }
            }
          }

          // Plot second pixel
          if (
            x + 1 >= this.h_start * 8 &&
            colour !== 0 &&
            !this.bgPriority[x + 1]
          ) {
            temp = (x + row_precal + 1) * 4;
            temp2 = (colour + 16) * 3;

            this.display[temp] = this.CRAM[temp2];
            this.display[temp + 1] = this.CRAM[temp2 + 1];
            this.display[temp + 2] = this.CRAM[temp2 + 2];

            if (VDP_SPRITE_COLLISIONS) {
              if (!this.spriteCol[x + 1]) {
                this.spriteCol[x + 1] = true;
              } else {
                this.status |= STATUS_COLLISION; // Bit 5 of status flag indicates collision
              }
            }
          }
        }
      }
    }

    // Sprite Overflow (more than 8 sprites on line)
    if (sprites[SPRITE_COUNT] >= SPRITES_PER_LINE) {
      this.status |= STATUS_OVERFLOW;
    }
  },

  /**
   * Draw a line of the current background colour.
   *
   * @param {number} lineno Line number to render.
   */
  drawBGColour: function(lineno) {
    var x = 0;
    var location = (lineno << 8) * 4;
    var colour = ((this.vdpreg[7] & 0x0f) + 16) * 3;

    for (
      x = location + this.h_start * 8 * 4;
      x < location + this.h_end * 8 * 4;
      x = x + 4
    ) {
      this.display[x] = this.CRAM[colour];
      this.display[x + 1] = this.CRAM[colour + 1];
      this.display[x + 2] = this.CRAM[colour + 2];
    }
  },

  // Note we should try not to update the bgt/sat locations?
  decodeTiles: function() {
    //JSSMS.Utils.console.log('[' + this.line + ']' + ' min dirty:' + this.minDirty + ' max: ' + this.maxDirty);

    for (var i = this.minDirty; i <= this.maxDirty; i++) {
      // Only decode tiles that have changed since the last iteration
      if (!this.isTileDirty[i]) {
        continue;
      }

      // Note that we've updated the tile
      this.isTileDirty[i] = 0;

      //JSSMS.Utils.console.log('tile ' + i + ' is dirty');
      var tile = this.tiles[i];

      var pixel_index = 0;

      // 4 bytes per row, total of 32 bytes per tile
      var address = i << 5;

      // Plot column of 8 pixels
      for (var y = 0; y < TILE_SIZE; y++) {
        var address0 = this.VRAM[address++];
        var address1 = this.VRAM[address++];
        var address2 = this.VRAM[address++];
        var address3 = this.VRAM[address++];

        // Plot row of 8 pixels
        for (var bit = 0x80; bit !== 0; bit >>= 1) {
          var colour = 0;

          // Set Colour of Pixel (0-15)
          if ((address0 & bit) !== 0) {
            colour |= 0x01;
          }
          if ((address1 & bit) !== 0) {
            colour |= 0x02;
          }
          if ((address2 & bit) !== 0) {
            colour |= 0x04;
          }
          if ((address3 & bit) !== 0) {
            colour |= 0x08;
          }

          tile[pixel_index++] = colour;
        }
      }
    }

    // Reset min/max dirty counters
    this.minDirty = TOTAL_TILES;
    this.maxDirty = -1;
  },

  //  DECODE SAT TABLE
  //
  //   Each sprite is defined in the sprite attribute table (SAT), a 256-byte
  //   table located in VRAM. The SAT has the following layout:
  //
  //      00: yyyyyyyyyyyyyyyy
  //      10: yyyyyyyyyyyyyyyy
  //      20: yyyyyyyyyyyyyyyy
  //      30: yyyyyyyyyyyyyyyy
  //      40: ????????????????
  //      50: ????????????????
  //      60: ????????????????
  //      70: ????????????????
  //      80: xnxnxnxnxnxnxnxn
  //      90: xnxnxnxnxnxnxnxn
  //      A0: xnxnxnxnxnxnxnxn
  //      B0: xnxnxnxnxnxnxnxn
  //      C0: xnxnxnxnxnxnxnxn
  //      D0: xnxnxnxnxnxnxnxn
  //      E0: xnxnxnxnxnxnxnxn
  //      F0: xnxnxnxnxnxnxnxn
  //
  //   y = Y coordinate + 1
  //   x = X coordinate
  //   n = Pattern index
  //   ? = Unused
  /**
   * Creates a list of sprites per scanline.
   */
  decodeSat: function() {
    this.isSatDirty = false;

    // Clear Existing Table
    for (var i = 0; i < this.lineSprites.length; i++) {
      this.lineSprites[i][SPRITE_COUNT] = 0;
    }

    // Height of Sprites (8x8 or 8x16)
    var height = (this.vdpreg[1] & 0x02) === 0 ? 8 : 16;

    // Enable Zoomed Sprites
    if ((this.vdpreg[1] & 0x01) === 0x01) {
      height <<= 1;
    }

    // Search Sprite Attribute Table (64 Bytes)
    for (var spriteno = 0; spriteno < 0x40; spriteno++) {
      // Sprite Y Position
      var y = this.VRAM[this.sat + spriteno] & 0xff;

      // VDP stops drawing if y === 208
      if (y === 208) {
        return;
      }

      // y is actually at +1 of value
      y++;

      // If off screen, draw from negative 16 onwards
      if (y > 240) {
        y -= 256;
      }

      for (var lineno = y; lineno < SMS_HEIGHT; lineno++) {
        // Does Sprite fall on this line?
        if (lineno - y < height) {
          var sprites = this.lineSprites[lineno];

          if (!sprites || sprites[SPRITE_COUNT] >= (this.removeSpriteLimit ? 64 : SPRITES_PER_LINE)) {
            break;
          }

          // Get offset into array
          var off = sprites[SPRITE_COUNT] * 3 + SPRITE_X;

          // Address of Sprite in Sprite Attribute Table
          var address = this.sat + (spriteno << 1) + 0x80;

          // Sprite X Position
          sprites[off++] = this.VRAM[address++] & 0xff;

          // Sprite Y Position
          sprites[off++] = y;

          // Sprite Pattern Index
          sprites[off++] = this.VRAM[address] & 0xff;

          // Increment number of sprites on this scanline
          sprites[SPRITE_COUNT]++;
        }
      }
    }
  },

  // Decode all background tiles
  //
  // Tiles are 8x8
  //
  // Background table is a 32x28 matrix of words stored in VRAM
  //
  //  MSB          LSB
  //  ---pcvhnnnnnnnnn
  //
  // p = priority
  // c = palette
  // v = vertical flip
  // h = horizontal flip
  // n = pattern index (0 - 512)
  createCachedImages: function() {
    //this.tiles = new JSSMS.Utils.Uint8Array(TOTAL_TILES);
    for (var i = 0; i < TOTAL_TILES; i++) {
      this.tiles[i] = new JSSMS.Utils.Uint8Array(TILE_SIZE * TILE_SIZE);
    }
    //this.isTileDirty = new JSSMS.Utils.Uint8Array(TOTAL_TILES);
  },

  // Generated pre-converted palettes.
  //
  // SMS and GG colours are converted to Java RGB for speed purposes.
  //
  // Java: 0xAARRGGBB (4 bytes) Java colour
  //
  // SMS : 00BBGGRR   (1 byte)
  // GG  : GGGGRRRR   (1st byte)
  //       0000BBBB   (2nd byte)
  generateConvertedPals: function() {
    var i;
    var r, g, b;

    // Convert SMS palette.
    for (i = 0; i < 0x40; i++) {
      r = i & 0x03;
      g = (i >> 2) & 0x03;
      b = (i >> 4) & 0x03;

      this.main_JAVA_R[i] = (r * 85) & 0xff;
      this.main_JAVA_G[i] = (g * 85) & 0xff;
      this.main_JAVA_B[i] = (b * 85) & 0xff;
    }

    // Convert GG palette.
    // Red & Green
    for (i = 0; i < 0x100; i++) {
      g = i & 0x0f;
      b = (i >> 4) & 0x0f;

      // Shift and fill with the original bitpattern
      // so %1111 becomes %11111111, %1010 becomes %10101010
      this.GG_JAVA_R[i] = ((g << 4) | g) & 0xff;
      this.GG_JAVA_G[i] = ((b << 4) | b) & 0xff;
    }
    // Blue
    for (i = 0; i < 0x10; i++) {
      this.GG_JAVA_B[i] = ((i << 4) | i) & 0xff;
    }
  },

  // VDP State Saving
  /**
   * @return {Array.<number>}
   */
  getState: function() {
    var state = new Array(
      3 + 16 /*this.vdpreg.length*/ + 0x20 /*this.CRAM.length*/
    );

    state[0] =
      this.videoMode |
      (this.status << 8) |
      (this.firstByte ? 1 << 16 : 0) |
      (this.commandByte << 24);
    state[1] = this.location | (this.operation << 16) | (this.readBuffer << 24);
    state[2] = this.counter | (this.vScrollLatch << 8) | (this.line << 16);

    JSSMS.Utils.copyArrayElements(
      this.vdpreg,
      0,
      state,
      3,
      16 /*this.vdpreg.length*/
    );
    JSSMS.Utils.copyArrayElements(
      this.CRAM,
      0,
      state,
      3 + 16 /*this.vdpreg.length*/,
      0x20 * 3 /*this.CRAM.length*/
    );

    return state;
  },

  /**
   * @param {Array.<number>} state
   */
  setState: function(state) {
    var temp = state[0];
    this.videoMode = temp & 0xff;
    this.status = (temp >> 8) & 0xff;
    this.firstByte = ((temp >> 16) & 0xff) !== 0;
    this.commandByte = (temp >> 24) & 0xff;

    temp = state[1];
    this.location = temp & 0xffff;
    this.operation = (temp >> 16) & 0xff;
    this.readBuffer = (temp >> 24) & 0xff;

    temp = state[2];
    this.counter = temp & 0xff;
    this.vScrollLatch = (temp >> 8) & 0xff;
    this.line = (temp >> 16) & 0xffff;

    JSSMS.Utils.copyArrayElements(
      state,
      3,
      this.vdpreg,
      0,
      16 /*this.vdpreg.length*/
    );
    JSSMS.Utils.copyArrayElements(
      state,
      3 + 16 /*this.vdpreg.length*/,
      this.CRAM,
      0,
      0x20 * 3 /*this.CRAM.length*/
    );

    // Force redraw of all cached tile data
    this.forceFullRedraw();
  },
};

'use strict';

/**
 * Fixed point scaling.
 * @const
 */
var SCALE = 8;

/**
 * Value to denote that antialiasing should not be used on sample.
 * @const
 */
var NO_ANTIALIAS = Number.MIN_VALUE;

/**
 * Shift register reset value. Only the highest bit is set.
 * @const
 */
var SHIFT_RESET = 0x8000;

/**
 * SMS Only: Tapped bits are bits 0 and 3 (0x0009), fed back into bit 15.
 * @const
 */
var FEEDBACK_PATTERN = 0x09;

// Amplification
/**
 * Tests with an SMS and a TV card found the highest three volume levels to be clipped.
 * @const
 */
var PSG_VOLUME = [
  //1516, 1205, 957, 760, 603, 479, 381, 303, 240, 191, 152, 120, 96, 76, 60, 0
  25,
  20,
  16,
  13,
  10,
  8,
  6,
  5,
  4,
  3,
  3,
  2,
  2,
  1,
  1,
  0,
];

/**
 * @constructor
 * @param {JSSMS} sms
 */
JSSMS.SN76489 = function(sms) {
  this.main = sms;

  /**
   * SN76489 Internal Clock Speed (Hz) [SCALED].
   * @type {number}
   */
  this.clock = 0;

  /**
   * Stores fractional part of clock for various precise updates [SCALED].
   * @type {number}
   */
  this.clockFrac = 0;

  // The SN76489 has 8 "registers":
  // 4 x 4 bit volume registers,
  // 3 x 10 bit tone registers and
  // 1 x 3 bit noise register.
  /**
   * SN76489 Registers.
   * @type {Array.<number>}
   */
  this.reg = new Array(8);

  /**
   * Register Latch.
   * @type {number}
   */
  this.regLatch = 0;

  /**
   * Channel Counters (10-bits on original hardware).
   * @type {Array.<number>}
   */
  this.freqCounter = new Array(4);

  /**
   * Polarity of Tone Channel Counters.
   * @type {Array.<number>}
   */
  this.freqPolarity = new Array(4);

  /**
   * Position of Tone Amplitude Changes.
   * @type {Array.<number>}
   */
  this.freqPos = new Array(3);

  /**
   * Noise Generator Frequency.
   * @type {number}
   */
  this.noiseFreq = 0x10;

  /**
   * The Linear Feedback Shift Register (16-bits on original hardware).
   * @type {number}
   */
  this.noiseShiftReg = SHIFT_RESET;

  /**
   * Output channels.
   * @type {Array.<number>}
   */
  this.outputChannel = new Array(4);
};

JSSMS.SN76489.prototype = {
  /**
   * Init SN76496 to Default Values.
   *
   * @param {number} clockSpeed Clock Speed (Hz).
   */
  init: function(clockSpeed) {
    // Master clock divided by 16 to get internal clock
    // e.g. 3579545 / 16 / 44100 = 5
    this.clock = (clockSpeed << SCALE) / 16 / SAMPLE_RATE;

    this.clockFrac = 0;
    this.regLatch = 0;
    this.noiseFreq = 0x10;
    this.noiseShiftReg = SHIFT_RESET;

    for (var i = 0; i < 4; i++) {
      // Set Tone Frequency (Don't want this to be zero)
      this.reg[i << 1] = 1;

      // Set Volume Off
      this.reg[(i << 1) + 1] = 0x0f;

      // Set Frequency Counters
      this.freqCounter[i] = 0;

      // Set Amplitudes Positive
      this.freqPolarity[i] = 1;
    }

    // Do not use intermediate positions
    for (i = 0; i < 3; i++) {
      this.freqPos[i] = NO_ANTIALIAS;
    }
  },

  /**
   * Program the SN76489.
   *
   * @param {number} value Value to write (0-0xFF).
   */
  write: function(value) {
    // If bit 7 is 1 then the byte is a LATCH/DATA byte.
    //  %1cctdddd
    //    |||````-- Data
    //    ||`------ Type
    //    ``------- Channel

    if ((value & 0x80) !== 0) {
      // Bits 6 and 5 ("cc") give the channel to be latched, ALWAYS.
      // Bit 4 ("t") determines whether to latch volume (1) or tone/noise (0) data -
      // this gives the column.

      this.regLatch = (value >> 4) & 7;

      // Zero lower 4 bits of register and mask new value
      this.reg[this.regLatch] =
        (this.reg[this.regLatch] & 0x3f0) | (value & 0x0f);
    } else {
      // If bit 7 is 0 then the byte is a DATA byte.
      //  %0-DDDDDD
      //    |``````-- Data
      //    `-------- Unused

      // TONE REGISTERS
      // If the currently latched register is a tone register then the low 6
      // bits of the byte are placed into the high 6 bits of the latched register.
      if (this.regLatch === 0 || this.regLatch === 2 || this.regLatch === 4) {
        // ddddDDDDDD (10 bits total) - keep lower 4 bits and replace upper 6 bits.
        // ddddDDDDDD gives the 10-bit half-wave counter reset value.
        this.reg[this.regLatch] =
          (this.reg[this.regLatch] & 0x0f) | ((value & 0x3f) << 4);
      } else {
        // VOLUME & NOISE REGISTERS
        this.reg[this.regLatch] = value & 0x0f;
      }
    }

    switch (this.regLatch) {
      // Tone register updated
      // If the register value is zero then the output is a constant value of +1.
      // This is often used for sample playback on the SN76489.
      case 0:
      case 2:
      case 4:
        if (this.reg[this.regLatch] === 0) {
          this.reg[this.regLatch] = 1;
        }
        break;

      // Noise generator updated
      //
      // Noise register:      dddd(DDDDDD) = -trr(---trr)
      //
      // The low 2 bits of dddd select the shift rate and the next highest bit (bit 2)
      // selects  the mode (white (1) or "periodic" (0)).
      // If a data byte is written, its low 3 bits update the shift rate and mode in the
      // same way.
      case 6:
        this.noiseFreq = 0x10 << (this.reg[6] & 3);
        this.noiseShiftReg = SHIFT_RESET;
        break;
    }
  },

  /**
   * @param {AudioBuffer} audioBuffer
   * @param {number} offset
   * @param {number} samplesToGenerate
   * @return {Array}
   */
  update: function(audioBuffer, offset, samplesToGenerate) {
    var buffer = audioBuffer.getChannelData(0);
    var sample = 0;
    var i = 0;

    for (; sample < samplesToGenerate; sample++) {
      // Generate Sound from Tone Channels
      for (i = 0; i < 3; i++) {
        if (this.freqPos[i] !== NO_ANTIALIAS) {
          this.outputChannel[i] =
            (PSG_VOLUME[this.reg[(i << 1) + 1]] * this.freqPos[i]) >> SCALE;
        } else {
          this.outputChannel[i] =
            PSG_VOLUME[this.reg[(i << 1) + 1]] * this.freqPolarity[i];
        }
      }

      // Generate Sound from Noise Channel
      this.outputChannel[3] =
        (PSG_VOLUME[this.reg[7]] * (this.noiseShiftReg & 1)) << 1; // Double output

      // Output sound to buffer
      var output =
        this.outputChannel[0] +
        this.outputChannel[1] +
        this.outputChannel[2] +
        this.outputChannel[3];

      output /= 0x80;

      // Check boundaries
      if (output > 1) {
        output = 1;
      } else if (output < -1) {
        output = -1;
      }

      buffer[offset + sample] = output;

      // Update Clock
      this.clockFrac += this.clock;

      // Contains Main Integer Part (For General Counter Decrements)
      //int clockCyclesPerUpdate = clockFrac &~ ((1 << SCALE) - 1);
      var clockCycles = this.clockFrac >> SCALE;
      var clockCyclesScaled = clockCycles << SCALE;

      // Clock Counter Updated with Fractional Part Only (For Accurate Stuff Later)
      this.clockFrac -= clockCyclesScaled;

      // Decrement Counters

      // Decrement Tone Counters
      this.freqCounter[0] -= clockCycles;
      this.freqCounter[1] -= clockCycles;
      this.freqCounter[2] -= clockCycles;

      // Decrement Noise Counter OR Match to Tone 2
      if (this.noiseFreq === 0x80) {
        this.freqCounter[3] = this.freqCounter[2];
      } else {
        this.freqCounter[3] -= clockCycles;
      }

      // Update 3 x Tone Generators
      for (i = 0; i < 3; i++) {
        var counter = this.freqCounter[i];

        // The counter is reset to the value currently in the corresponding register
        // (eg. Tone0 for channel 0).
        // The polarity of the output is changed,
        // ie. if it is currently outputting -1 then it outputs +1, and vice versa.
        if (counter <= 0) {
          var tone = this.reg[i << 1];

          // In tests on an SMS2, the highest note that gave any audible output was
          // register value $006, giving frequency 18643Hz (MIDI note A12 -12 cents).
          if (tone > 6) {
            // Calculate what fraction of the way through the sample the flip-flop
            // changes state and render it as that fraction of the way through the transition.

            // Note we divide a scaled number by a scaled number here
            // So to maintain accuracy we shift the top part of the fraction again
            this.freqPos[i] =
              ((clockCyclesScaled - this.clockFrac + (2 << SCALE) * counter) <<
                SCALE) *
              this.freqPolarity[i] /
              (clockCyclesScaled + this.clockFrac);

            // Flip Polarity
            this.freqPolarity[i] = -this.freqPolarity[i];
          } else {
            this.freqPolarity[i] = 1;
            this.freqPos[i] = NO_ANTIALIAS;
          }

          // Reset to 10-bit value in corresponding tone register
          this.freqCounter[i] += tone * (clockCycles / tone + 1);
        } else {
          this.freqPos[i] = NO_ANTIALIAS;
        }
      }

      // Update Noise Generators
      if (this.freqCounter[3] <= 0) {
        // Flip Polarity
        this.freqPolarity[3] = -this.freqPolarity[3];

        // Not matching Tone 2 Value, so reload counter
        if (this.noiseFreq !== 0x80) {
          this.freqCounter[3] +=
            this.noiseFreq * (clockCycles / this.noiseFreq + 1);
        }

        // Positive Amplitude i.e. We only want to do this once per cycle
        if (this.freqPolarity[3] === 1) {
          var feedback = 0;

          // White Noise Selected
          if ((this.reg[6] & 0x04) !== 0) {
            // If two bits fed back, I can do Feedback=(nsr & fb) && (nsr & fb ^ fb)
            // since that's (one or more bits set) && (not all bits set)
            feedback =
              (this.noiseShiftReg & FEEDBACK_PATTERN) !== 0 &&
              ((this.noiseShiftReg & FEEDBACK_PATTERN) ^ FEEDBACK_PATTERN) !== 0
                ? 1
                : 0;
          } else {
            // Periodic Noise Selected
            feedback = this.noiseShiftReg & 1;
          }

          this.noiseShiftReg = (this.noiseShiftReg >> 1) | (feedback << 15);
        }
      }
    } // end for loop
  },
};

'use strict';

/** @const */ var IO_TR_DIRECTION = 0;
/** @const */ var IO_TH_DIRECTION = 1;
/** @const */ var IO_TR_OUTPUT = 2;
/** @const */ var IO_TH_OUTPUT = 3;
/** @const */ var IO_TH_INPUT = 4;

/** @const */ var PORT_A = 0;
/** @const */ var PORT_B = 5;

/**
 * @constructor
 * @param {JSSMS} sms
 */
JSSMS.Ports = function(sms) {
  this.main = sms;
  this.vdp = sms.vdp;
  this.psg = sms.psg;
  this.keyboard = sms.keyboard;

  /**
   * European / Domestic system.
   * @type {number}
   */
  this.europe = 0x40;

  /**
   * Horizontal counter latch.
   * @type {number}
   */
  this.hCounter = 0;

  /**
   * I/O Ports A and B * (5 ints each).
   * @type {Array.<number>}
   */
  this.ioPorts = [];
};

JSSMS.Ports.prototype = {
  reset: function() {
    if (LIGHTGUN) {
      this.ioPorts = new Array(10);
      this.ioPorts[PORT_A + IO_TH_INPUT] = 1;
      this.ioPorts[PORT_B + IO_TH_INPUT] = 1;
    } else {
      this.ioPorts = new Array(2);
    }
  },

  /**
   * Output to a Z80 port.
   *
   * @param {number} port Port number.
   * @param {number} value Value to output.
   */
  out: function(port, value) {
    // Game Gear Serial Ports (do nothing for now)
    if (this.main.is_gg && port < 0x07) {
      return;
    }

    switch (port & 0xc1) {
      // 0x3F IO Port
      // 0xD7 : Port B TH pin output level (1=high, 0=low)
      // 0xD6 : Port B TR pin output level (1=high, 0=low)
      // 0xD5 : Port A TH pin output level (1=high, 0=low)
      // 0xD4 : Port A TR pin output level (1=high, 0=low)
      // 0xD3 : Port B TH pin direction (1=input, 0=output)
      // 0xD2 : Port B TR pin direction (1=input, 0=output)
      // 0xD1 : Port A TH pin direction (1=input, 0=output)
      // 0xD0 : Port A TR pin direction (1=input, 0=output)
      case 0x01:
        // Accurate emulation with HCounter
        if (LIGHTGUN) {
          this.oldTH = this.getTH(PORT_A) !== 0 || this.getTH(PORT_B) !== 0;

          this.writePort(PORT_A, value);
          this.writePort(PORT_B, value >> 2);

          // Toggling TH latches H Counter
          if (
            !this.oldTH &&
            (this.getTH(PORT_A) !== 0 || this.getTH(PORT_B) !== 0)
          ) {
            this.hCounter = this.getHCount();
          }
        } else {
          // Rough emulation of Nationalisation bits
          this.ioPorts[0] = (value & 0x20) << 1;
          this.ioPorts[1] = value & 0x80;

          if (this.europe === 0) {
            // Not European system
            this.ioPorts[0] = ~this.ioPorts[0];
            this.ioPorts[1] = ~this.ioPorts[1];
          }
        }
        break;

      // 0xBE VDP Data port
      case 0x80:
        this.vdp.dataWrite(value);
        break;

      // 0xBD / 0xBF VDP Control port (Mirrored at two locations)
      case 0x81:
        this.vdp.controlWrite(value);
        break;

      // 0x7F: PSG
      case 0x40:
      case 0x41:
        if (this.main.soundEnabled) {
          this.psg.write(value);
        }
        break;
    }
  },

  /**
   * Read from a Z80 port.
   *
   * @param {number} port Port number.
   * @return {number} Value from port number.
   */
  in_: function(port) {
    // Game Gear Serial Ports (not fully emulated)
    if (this.main.is_gg && port < 0x07) {
      switch (port) {
        // Game Gear (Start Button and Nationalisation)
        case 0x00:
          return (this.keyboard.ggstart & 0xbf) | this.europe;

        // GG Serial Communication Ports -
        // Return 0 for now as "OutRun" gets stuck in a loop by returning 0xFF
        case 0x01:
        case 0x02:
        case 0x03:
        case 0x04:
        case 0x05:
          return 0x00;
        case 0x06:
          return 0xff;
      }
    }

    switch (port & 0xc1) {
      // 0x7E - Vertical Port
      case 0x40:
        return this.vdp.getVCount();

      // 0x7F - Horizontal Port
      case 0x41:
        return this.hCounter;

      // VDP Data port
      case 0x80:
        return this.vdp.dataRead();

      // VDP Control port
      case 0x81:
        return this.vdp.controlRead();

      // 0xC0 / 0xDC - I/O Port A
      // 0xD7 : Port B DOWN pin input
      // 0xD6 : Port B UP pin input
      // 0xD5 : Port A TR pin input
      // 0xD4 : Port A TL pin input
      // 0xD3 : Port A RIGHT pin input
      // 0xD2 : Port A LEFT pin input
      // 0xD1 : Port A DOWN pin input
      // 0xD0 : Port A UP pin input
      case 0xc0:
        return this.keyboard.controller1;

      // 0xC1 / 0xDD - I/O Port B and Misc
      // 0xD7 : Port B TH pin input
      // 0xD6 : Port A TH pin input
      // 0xD5 : Unused
      // 0xD4 : RESET button (1= not pressed, 0= pressed)
      // 0xD3 : Port B TR pin input
      // 0xD2 : Port B TL pin input
      // 0xD1 : Port B RIGHT pin input
      // 0xD0 : Port B LEFT pin input
      case 0xc1:
        if (LIGHTGUN) {
          if (this.keyboard.lightgunClick) {
            this.lightPhaserSync();
          }

          return (
            (this.keyboard.controller2 & 0x3f) |
            (this.getTH(PORT_A) !== 0 ? 0x40 : 0) |
            (this.getTH(PORT_B) !== 0 ? 0x80 : 0)
          );
        } else {
          return (
            (this.keyboard.controller2 & 0x3f) |
            this.ioPorts[0] |
            this.ioPorts[1]
          );
        }
    }

    // Default Value is 0xFF
    return 0xff;
  },

  // Port A/B Emulation
  /**
   * @param {number} index
   * @param {number} value
   */
  writePort: function(index, value) {
    this.ioPorts[index + IO_TR_DIRECTION] = value & 0x01;
    this.ioPorts[index + IO_TH_DIRECTION] = value & 0x02;
    this.ioPorts[index + IO_TR_OUTPUT] = value & 0x10;
    this.ioPorts[index + IO_TH_OUTPUT] =
      this.europe === 0 ? ~value & 0x20 : value & 0x20;
  },

  /**
   * @param {number} index
   * @return {number}
   */
  getTH: function(index) {
    return this.ioPorts[index + IO_TH_DIRECTION] === 0
      ? this.ioPorts[index + IO_TH_OUTPUT]
      : this.ioPorts[index + IO_TH_INPUT];
  },

  /**
   * @param {number} index
   * @param {boolean} on
   */
  setTH: function(index, on) {
    this.ioPorts[index + IO_TH_DIRECTION] = 1;
    this.ioPorts[index + IO_TH_INPUT] = on ? 1 : 0;
  },

  // H Counter Emulation
  //
  //  The H counter is 9 bits, and reading it returns the upper 8 bits. This is
  //  because a scanline consists of 342 pixels, which couldn't be represented
  //  with an 8-bit counter. Each scanline is divided up as follows:
  //
  //    Pixels H.Cnt   Description
  //    256 : 0x00-0x7F : Active display
  //     15 : 0x80-0x87 : Right border
  //      8 : 0x87-0x8B : Right blanking
  //     26 : 0x8B-0xED : Horizontal sync
  //      2 : 0xED-0xEE : Left blanking
  //     14 : 0xEE-0xF5 : Color burst
  //      8 : 0xF5-0xF9 : Left blanking
  //     13 : 0xF9-0xFF : Left border
  /**
   * @return {number}
   */
  getHCount: function() {
    var pixels = Math.round(
      this.main.cpu.getCycle() * SMS_X_PIXELS / this.main.cyclesPerLine
    );
    var v = (pixels - 8) >> 1;
    if (v > 0x93) {
      v += 0xe9 - 0x94;
    }

    return v & 0xff;
  },

  // Lightgun <-> Port Synchronisation
  // This is a hacky way to do things, but works reasonably well.
  /**
   * X range of Lightgun.
   * @type {number}
   */
  X_RANGE: 48,

  /**
   * Y range of Lightgun.
   * @type {number}
   */
  Y_RANGE: 4,

  lightPhaserSync: function() {
    var oldTH = this.getTH(PORT_A);
    var hc = this.getHCount();

    var dx = this.keyboard.lightgunX - (hc << 1);
    var dy = this.keyboard.lightgunY - this.vdp.line;

    // Within 8 pixels of click on Y value
    // Within 96 pixels of click on X value
    if (
      dy > -this.Y_RANGE &&
      dy < this.Y_RANGE &&
      (dx > -this.X_RANGE && dx < this.X_RANGE)
    ) {
      this.setTH(PORT_A, false);

      // TH has been toggled, update with lightgun position
      if (oldTH !== this.getTH(PORT_A)) {
        this.hCounter = 20 + (this.keyboard.lightgunX >> 1);
      }
    } else {
      this.setTH(PORT_A, true);

      // TH has been toggled, update with usual HCounter value
      if (oldTH !== this.getTH(PORT_A)) {
        this.hCounter = hc;
      }
    }
  },

  /**
   * Set console to European / Japanese model.
   *
   * @param {boolean} value True is European, false is Japanese.
   */
  setDomestic: function(value) {
    this.europe = value ? 0x40 : 0;
  },

  /**
   * @return {boolean}
   */
  isDomestic: function() {
    return this.europe !== 0;
  },
};

'use strict';

/** @const */ var P1_KEY_UP = 0x01;
/** @const */ var P1_KEY_DOWN = 0x02;
/** @const */ var P1_KEY_LEFT = 0x04;
/** @const */ var P1_KEY_RIGHT = 0x08;
/** @const */ var P1_KEY_FIRE1 = 0x10;
/** @const */ var P1_KEY_FIRE2 = 0x20;

/** @const */ var P2_KEY_UP = 0x40;
/** @const */ var P2_KEY_DOWN = 0x80;
/** @const */ var P2_KEY_LEFT = 0x01;
/** @const */ var P2_KEY_RIGHT = 0x02;
/** @const */ var P2_KEY_FIRE1 = 0x04;
/** @const */ var P2_KEY_FIRE2 = 0x08;

/** @const */ var KEY_START = 0x40;
/** @const */ var GG_KEY_START = 0x80;

/**
 * @constructor
 * @param {JSSMS} sms
 */
JSSMS.Keyboard = function(sms) {
  this.main = sms;

  /**
   * Controller 1.
   * @type {number}
   */
  this.controller1 = 0;

  /**
   * Controller 2.
   * @type {number}
   */
  this.controller2 = 0;

  /**
   * Game Gear start button.
   * @type {number}
   */
  this.ggstart = 0;

  /** Lightgun position. */
  /** @type {number} */ this.lightgunX = 0;
  /** @type {number} */ this.lightgunY = 0;

  /**
   * Lightgun button pressed.
   * @type {boolean}
   */
  this.lightgunClick = false;

  /**
   * Lightgun is enabled.
   * @type {boolean}
   */
  this.lightgunEnabled = false;
};

JSSMS.Keyboard.prototype = {
  /**
   * Reset controllers to default state.
   */
  reset: function() {
    // Default 0xFF = No Keys Pressed
    this.controller1 = 0xff;
    this.controller2 = 0xff;
    this.ggstart = 0xff;

    // Turn lightgun off
    if (LIGHTGUN) {
      this.lightgunClick = false;
    }

    this.pause_button = false;
  },

  /**
   * @param {Event} evt A keydown event.
   */
  keydown: function(evt) {
    switch (evt.keyCode) {
      case 38:
        this.controller1 &= ~P1_KEY_UP;
        break; // Up
      case 40:
        this.controller1 &= ~P1_KEY_DOWN;
        break; // Down
      case 37:
        this.controller1 &= ~P1_KEY_LEFT;
        break; // Left
      case 39:
        this.controller1 &= ~P1_KEY_RIGHT;
        break; // Right
      case 88:
        this.controller1 &= ~P1_KEY_FIRE1;
        break; // X
      case 90:
        this.controller1 &= ~P1_KEY_FIRE2;
        break; // Z
      case 13:
        //this.controller1 &= ~P1_KEY_START;
        if (this.main.is_sms) {
          //this.controller2 &= ~0x10; // Reset
          this.main.pause_button = true; // Pause
        } else {
          this.ggstart &= ~GG_KEY_START; // Start
        }
        break; // Enter

      case 104:
        this.controller2 &= ~P2_KEY_UP;
        break; // Num-8
      case 98:
        this.controller2 &= ~P2_KEY_DOWN;
        break; // Num-2
      case 100:
        this.controller2 &= ~P2_KEY_LEFT;
        break; // Num-4
      case 102:
        this.controller2 &= ~P2_KEY_RIGHT;
        break; // Num-6
      case 103:
        this.controller2 &= ~P2_KEY_FIRE1;
        break; // Num-7
      case 105:
        this.controller2 &= ~P2_KEY_FIRE2;
        break; // Num-9
      default:
        return; //browser should handle key event
    }

    evt.preventDefault();
  },

  /**
   * @param {Event} evt A keyup event.
   */
  keyup: function(evt) {
    switch (evt.keyCode) {
      case 38:
        this.controller1 |= P1_KEY_UP;
        break; // Up
      case 40:
        this.controller1 |= P1_KEY_DOWN;
        break; // Down
      case 37:
        this.controller1 |= P1_KEY_LEFT;
        break; // Left
      case 39:
        this.controller1 |= P1_KEY_RIGHT;
        break; // Right
      case 88:
        this.controller1 |= P1_KEY_FIRE1;
        break; // X
      case 90:
        this.controller1 |= P1_KEY_FIRE2;
        break; // Z
      case 13:
        //this.controller1 |= P1_KEY_START;
        if (!this.main.is_sms) {
          //  controller2 |= 0x10;    // Reset/Start
          //else
          this.ggstart |= GG_KEY_START; // Start
        }
        break; // Enter

      case 104:
        this.controller2 |= P2_KEY_UP;
        break; // Num-8
      case 98:
        this.controller2 |= P2_KEY_DOWN;
        break; // Num-2
      case 100:
        this.controller2 |= P2_KEY_LEFT;
        break; // Num-4
      case 102:
        this.controller2 |= P2_KEY_RIGHT;
        break; // Num-6
      case 103:
        this.controller2 |= P2_KEY_FIRE1;
        break; // Num-7
      case 105:
        this.controller2 |= P2_KEY_FIRE2;
        break; // Num-9
      default:
        return; //browser should handle key event
    }

    evt.preventDefault();
  },

  // @todo Add setLightGunPos().
};

return JSSMS;
})();

export default JSSMS;
