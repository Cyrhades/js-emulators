export class RIOTRAM {
  private memory: Uint8Array = new Uint8Array(128);

  public read(address: number): number {
    return this.memory[address & 0x7f];
  }

  public write(address: number, value: number): void {
    this.memory[address & 0x7f] = value & 0xff;
  }

  public reset(): void {
    this.memory.fill(0);
  }
}
