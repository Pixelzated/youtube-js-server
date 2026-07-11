import type { CompositeBuffer } from './CompositeBuffer.js';
import type { Part } from '../types/shared.js';
/**
 * A parser that efficiently processes chunked UMP binary data.
 */
export declare class UmpReader {
    private compositeBuffer;
    constructor(compositeBuffer: CompositeBuffer);
    /**
     * Parses parts from the buffer and calls the handler for each complete part.
     * @param handlePart - Function called with each complete part.
     * @returns Partial part if parsing is incomplete, undefined otherwise.
     */
    read(handlePart: (part: Part) => void): Part | undefined;
    /**
     * Reads a variable-length integer from the buffer.
     * @param offset - Position to start reading from.
     * @returns Tuple of [value, new offset] or [-1, offset] if incomplete.
     */
    readVarInt(offset: number): [number, number];
    /**
     * Checks if the specified bytes can be read from the current chunk.
     * @param offset - Position to start reading from.
     * @param length - Number of bytes to read.
     * @returns True if bytes can be read from current chunk, false otherwise.
     */
    canReadFromCurrentChunk(offset: number, length: number): boolean;
    /**
     * Gets a DataView of the current chunk, creating it if necessary.
     * @returns DataView for the current chunk.
     */
    getCurrentDataView(): DataView;
}
