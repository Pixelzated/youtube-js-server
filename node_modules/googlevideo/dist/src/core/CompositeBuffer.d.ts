/**
 * A memory-efficient buffer that manages discontinuous chunks as a single logical stream.
 */
export declare class CompositeBuffer {
    chunks: Uint8Array[];
    currentChunkOffset: number;
    currentChunkIndex: number;
    currentDataView?: DataView;
    totalLength: number;
    constructor(chunks?: Uint8Array[]);
    append(chunk: Uint8Array | CompositeBuffer): void;
    split(position: number): {
        extractedBuffer: CompositeBuffer;
        remainingBuffer: CompositeBuffer;
    };
    getLength(): number;
    canReadBytes(position: number, length: number): boolean;
    getUint8(position: number): number;
    focus(position: number): void;
    isFocused(position: number): boolean;
    private resetFocus;
    private canMergeWithLastChunk;
}
