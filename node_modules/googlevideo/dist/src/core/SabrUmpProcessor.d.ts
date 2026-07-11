import { type CacheManager } from '../utils/index.js';
import { MediaHeader } from '../utils/Protos.js';
import type { Part } from '../types/shared.js';
import type { SabrRequestMetadata } from '../types/sabrStreamingAdapterTypes.js';
interface Segment {
    headerId?: number;
    mediaHeader: MediaHeader;
    complete?: boolean;
    bufferedChunks: Uint8Array[];
    lastChunkSize: number;
}
export interface UmpProcessingResult {
    data?: Uint8Array;
    done: boolean;
}
/**
 * This class is responsible for reading a UMP stream, handling different part types
 * (like media headers, media data, and server directives), and populating a
 * metadata object with the extracted information. It is supposed to be used
 * in conjunction with a {@linkcode SabrPlayerAdapter} in video player
 * implementations.
 */
export declare class SabrUmpProcessor {
    private requestMetadata;
    private cacheManager?;
    partialPart?: Part;
    private readonly formatInitMetadata;
    private desiredHeaderId?;
    private partialSegments;
    private readonly umpPartHandlers;
    constructor(requestMetadata: SabrRequestMetadata, cacheManager?: CacheManager | undefined);
    /**
     * Processes a chunk of data from a UMP stream and updates the request context.
     * @returns A promise that resolves with a processing result if a terminal part is found (e.g., MediaEnd), or undefined otherwise.
     * @param value
     */
    processChunk(value: Uint8Array): Promise<UmpProcessingResult | undefined>;
    getSegmentInfo(): Segment | undefined;
    private decodePart;
    private handleFormatInitMetadata;
    private handleNextRequestPolicy;
    private handleMediaHeader;
    private handleMedia;
    private handleMediaEnd;
    private handleSnackbarMessage;
    private handleSabrError;
    private handleStreamProtectionStatus;
    private handleReloadPlayerResponse;
    private handleSabrRedirect;
    private handleSabrContextUpdate;
    private handleSabrContextSendingPolicy;
}
export {};
