import { TIARegisters } from "./Registers";
import { TIAVideo } from "./Video";
import { TIAAudio } from "./Audio";

export class TIA {
  public registers: TIARegisters = new TIARegisters();
  public video: TIAVideo = new TIAVideo();
  public audio: TIAAudio = new TIAAudio();

  private cyclesThisScanline: number = 0;
  private currentScanline: number = 0;

  public read(address: number): number {
    return this.registers.read(address);
  }

  public write(address: number, value: number): void {
    if ((address & 0x3f) === 0x00) {
      // VSYNC write: start of new frame when bit 1 is set
      if ((value & 0x02) !== 0) {
        this.currentScanline = 0;
      }
    }

    this.registers.write(address, value, this.cyclesThisScanline);
    this.audio.write(address, value);
  }

  public getScanline(): number {
    return this.currentScanline;
  }

  public tick(cpuCycles: number): void {
    this.audio.tick(cpuCycles);

    for (let c = 0; c < cpuCycles; c++) {
      const cycleInLine = this.cyclesThisScanline + c;
      // 3 color clocks per CPU cycle
      for (let clk = 0; clk < 3; clk++) {
        const colorClock = cycleInLine * 3 + clk;
        const x = colorClock - 68; // 68 color clocks for HBLANK
        if (x >= 0 && x < 160 && this.currentScanline >= 37 && this.currentScanline < 229) {
          const renderLine = this.currentScanline - 37;
          this.video.renderPixel(x, renderLine, this.registers);
        }
      }
    }

    this.cyclesThisScanline += cpuCycles;

    // Standard NTSC timing: 76 CPU cycles = 228 color clocks per scanline
    while (this.cyclesThisScanline >= 76) {
      this.cyclesThisScanline -= 76;
      this.registers.WSYNC = false;

      this.currentScanline++;
      if (this.currentScanline >= 262) {
        this.currentScanline = 0;
      }
    }
  }

  public reset(): void {
    this.registers.reset();
    this.video.reset();
    this.audio.reset();
    this.cyclesThisScanline = 0;
    this.currentScanline = 0;
  }
}
