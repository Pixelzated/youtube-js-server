export interface CacheEntry {
    data: Uint8Array;
    timestamp: number;
    size: number;
}
/**
 * A "proper" cache for storing segments.
 */
export declare class CacheManager {
    private initSegmentCache;
    private segmentCache;
    private currentSize;
    private timerId;
    private readonly maxCacheSize;
    private readonly maxAge;
    private readonly logger;
    constructor(maxSizeMB?: number, maxAgeSeconds?: number);
    getCacheEntries(): {
        initSegmentCache: Map<string, CacheEntry>;
        segmentCache: Map<string, CacheEntry>;
    };
    setInitSegment(key: string, data: Uint8Array): void;
    setSegment(key: string, data: Uint8Array): void;
    getInitSegment(key: string): Uint8Array | undefined;
    getSegment(key: string): Uint8Array | undefined;
    private isExpired;
    private enforceStorageLimit;
    private clearExpiredEntries;
    private removeOldestEntries;
    private startGarbageCollection;
    dispose(): void;
}
