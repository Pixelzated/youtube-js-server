import type { FormatStream, SabrFormat } from '../types/shared.js';
export declare const MAX_INT32_VALUE = "2147483647";
export declare enum EnabledTrackTypes {
    VIDEO_AND_AUDIO = 0,
    AUDIO_ONLY = 1,
    VIDEO_ONLY = 2
}
/**
 * Determines if a given URL is a Google video URL, specifically for YouTube or SABR-related content.
 *
 * @param url - The URL to check.
 *
 * The function checks the following conditions:
 * 1. If the URL starts with the `sabr://` protocol, it is considered a Google video URL.
 * 2. If the URL ends with `/videoplayback`, it parses the query parameters to check for specific keys
 *    (`source=youtube`, `sabr`, `lsig`, or `expire`) that indicate a Google video URL.
 * 3. If the URL contains `/videoplayback/` (e.g., for live or post-live content), it checks the path
 *    segments for specific keywords (`videoplayback`, `sabr`, `lsig`, or `expire`).
 */
export declare function isGoogleVideoURL(url: string): boolean;
interface Range {
    start: number;
    end: number;
}
/**
 * Parses the Range header value to extract the start and end byte positions.
 * @param rangeHeaderValue
 */
export declare function parseRangeHeader(rangeHeaderValue: string | undefined): Range | undefined;
/**
 * Converts a Uint8Array to a Base64 string.
 * @param u8
 */
export declare function u8ToBase64(u8: Uint8Array): string;
/**
 * Converts a Base64 string to a Uint8Array.
 * @param base64
 */
export declare function base64ToU8(base64: string): Uint8Array;
/**
 * Concatenates multiple Uint8Array chunks into a single Uint8Array.
 * @param chunks
 */
export declare function concatenateChunks(chunks: Uint8Array[]): Uint8Array;
/**
 * Converts a FormatStream object to a SabrFormat object.
 * @param formatStream
 */
export declare function buildSabrFormat(formatStream: FormatStream): SabrFormat;
/**
 * Returns a promise that resolves after a specified number of milliseconds.
 * @param ms - The number of milliseconds to wait.
 */
export declare function wait(ms: number): Promise<void>;
export {};
