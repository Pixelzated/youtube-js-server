import type { MediaHeader } from './Protos.js';
import type { FormatInitializationMetadata } from './Protos.js';
import type { SabrFormat } from '../types/shared.js';
import type { SabrRequestMetadata } from '../types/sabrStreamingAdapterTypes.js';
/**
 * Creates a format key based on itag and xtags.
 * @returns A string format key.
 */
export declare function createKey(itag: number | undefined, xtags: string | undefined): string;
/**
 * Creates a format key from a SabrFormat object.
 * @returns A string format key or undefined if format is undefined.
 */
export declare function fromFormat(format?: {
    itag?: number;
    xtags?: string;
}): string | undefined;
/**
 * Creates a format key from a MediaHeader object.
 * @returns A string format key.
 */
export declare function fromMediaHeader(mediaHeader: MediaHeader): string;
/**
 * Creates a format key from FormatInitializationMetadata.
 * @returns A string format key or undefined if formatId is undefined.
 */
export declare function fromFormatInitializationMetadata(formatInitMetadata: FormatInitializationMetadata): string;
/**
 * Creates a segment cache key.
 * @param mediaHeader - The MediaHeader object.
 * @param format - Format object (needed for init segments.)
 * @returns A string key for caching segments.
 */
export declare function createSegmentCacheKey(mediaHeader: MediaHeader, format?: SabrFormat): string;
/**
 * Creates a cache key from request metadata.
 * @returns A string key for caching segments.
 */
export declare function createSegmentCacheKeyFromMetadata(requestMetadata: SabrRequestMetadata): string;
/**
 * Generates a unique format ID based on the SabrFormat properties.
 * @param format - The SabrFormat object.
 * @returns A unique string identifier for the format.
 */
export declare function getUniqueFormatId(format: SabrFormat): string;
