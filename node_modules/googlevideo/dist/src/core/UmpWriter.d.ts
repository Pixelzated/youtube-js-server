import type { CompositeBuffer } from './CompositeBuffer.js';
/**
 * A serialization module that encodes data into the UMP binary format with proper type and size encoding.
 */
export declare class UmpWriter {
    private compositeBuffer;
    constructor(compositeBuffer: CompositeBuffer);
    /**
     * Writes a part to the buffer.
     * @param partType - The type of the part.
     * @param partData - The data of the part.
     */
    write(partType: number, partData: Uint8Array): void;
    /**
     * Writes a variable-length integer to the buffer.
     * @param value - The integer to write.
     */
    private writeVarInt;
}
