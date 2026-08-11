import { CPU6502 } from "./CPU6502";
import { AccessMemoryFunc, ReadWrite } from "./types";

/**
 * MOS 6507
 *
 * Version simplifiée du 6502 utilisée dans l'Atari 2600.
 *
 * Différences avec le 6502 :
 *  - Bus d'adresse limité à 13 bits (8 Ko visibles)
 *  - Pas de NMI
 *  - Pas d'IRQ sur l'Atari 2600
 *
 * Le jeu d'instructions est strictement identique au 6502.
 */
export class CPU6507 extends CPU6502 {

    public constructor({
        accessMemory,
        logInstructions,
        maxInstructions,
    }: {
        accessMemory?: AccessMemoryFunc;
        logInstructions?: boolean;
        maxInstructions?: number;
    }) {
        super({
            accessMemory,
            logInstructions,
            maxInstructions,
        });
    }

    /**
     * Le 6507 ne possède que 13 lignes d'adresse.
     */
    protected normalizeAddress(address: number): number {
        return address & 0x1FFF;
    }

    /**
     * Lecture mémoire 8 bits.
     */
    public override _read8BitValue(address: number): number {
        return super._read8BitValue(this.normalizeAddress(address));
    }

    /**
     * Écriture mémoire 8 bits.
     */
    public override _write8BitValue(address: number, value: number): void {
        super._write8BitValue(this.normalizeAddress(address), value);
    }

    /**
     * Lecture mémoire 16 bits.
     *
     * Les deux lectures sont masquées individuellement afin de respecter
     * le bus d'adresse du 6507.
     */
    public override _read16BitValue(address: number): number {

        const low =
            this._read8BitValue(address);

        const high =
            this._read8BitValue(address + 1);

        return (high << 8) | low;
    }

    /**
     * Écriture mémoire 16 bits.
     */
    public override _write16BitValue(address: number, value: number): void {

        this._write8BitValue(address, value & 0xFF);

        this._write8BitValue(address + 1, (value >> 8) & 0xFF);
    }

    /**
     * Le 6507 ne possède pas de NMI.
     */
    public override triggerNMIB(): void {
        // NOP
    }

    /**
     * L'Atari 2600 n'utilise pas d'IRQ.
     */
    public override triggerIRQB(_setBrk: boolean): void {
        // NOP
    }

}