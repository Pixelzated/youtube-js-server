import { Logger } from './Logger.js';
const TAG = 'CacheManager';
/**
 * A "proper" cache for storing segments.
 */
export class CacheManager {
    constructor(maxSizeMB = 50, maxAgeSeconds = 600) {
        this.initSegmentCache = new Map();
        this.segmentCache = new Map();
        this.currentSize = 0;
        this.logger = Logger.getInstance();
        this.maxCacheSize = maxSizeMB * 1024 * 1024;
        this.maxAge = maxAgeSeconds * 1000;
        this.startGarbageCollection();
    }
    getCacheEntries() {
        return {
            initSegmentCache: this.initSegmentCache,
            segmentCache: this.segmentCache
        };
    }
    setInitSegment(key, data) {
        const entry = {
            data,
            timestamp: Date.now(),
            size: data.byteLength
        };
        if (!this.initSegmentCache.has(key)) {
            this.currentSize += entry.size;
            this.enforceStorageLimit();
        }
        this.initSegmentCache.set(key, entry);
    }
    setSegment(key, data) {
        const entry = {
            data,
            timestamp: Date.now(),
            size: data.byteLength
        };
        this.currentSize += entry.size;
        this.enforceStorageLimit();
        this.segmentCache.set(key, entry);
    }
    getInitSegment(key) {
        const entry = this.initSegmentCache.get(key);
        if (entry && !this.isExpired(entry)) {
            this.logger.debug(TAG, `Cache hit for init segment: ${key}`);
            entry.timestamp = Date.now();
            return entry.data;
        }
        // Expired. Get rid of it.
        if (entry) {
            this.initSegmentCache.delete(key);
            this.currentSize -= entry.size;
        }
        return undefined;
    }
    getSegment(key) {
        const entry = this.segmentCache.get(key);
        if (entry && !this.isExpired(entry)) {
            this.logger.debug(TAG, `Cache hit for segment: ${key}`);
            const data = entry.data;
            this.segmentCache.delete(key);
            this.currentSize -= entry.size;
            return data;
        }
        // Expired. Get rid of it.
        if (entry) {
            this.segmentCache.delete(key);
            this.currentSize -= entry.size;
        }
        return undefined;
    }
    isExpired(entry) {
        return Date.now() - entry.timestamp > this.maxAge;
    }
    enforceStorageLimit() {
        if (this.currentSize <= this.maxCacheSize)
            return;
        this.clearExpiredEntries();
        // If still over limit, remove oldest entries.
        if (this.currentSize > this.maxCacheSize) {
            this.removeOldestEntries();
        }
    }
    clearExpiredEntries() {
        const now = Date.now();
        for (const [key, entry] of this.segmentCache.entries()) {
            if (now - entry.timestamp > this.maxAge) {
                this.logger.debug(TAG, `Removing expired segment from cache: ${key}`);
                this.segmentCache.delete(key);
                this.currentSize -= entry.size;
            }
        }
        for (const [key, entry] of this.initSegmentCache.entries()) {
            if (now - entry.timestamp > this.maxAge) {
                this.logger.debug(TAG, `Removing expired init segment from cache: ${key}`);
                this.initSegmentCache.delete(key);
                this.currentSize -= entry.size;
            }
        }
    }
    removeOldestEntries() {
        const segments = Array.from(this.segmentCache.entries());
        const initSegments = Array.from(this.initSegmentCache.entries());
        const allEntries = [...segments, ...initSegments]
            .sort((a, b) => a[1].timestamp - b[1].timestamp);
        while (this.currentSize > this.maxCacheSize && allEntries.length > 0) {
            const [key, entry] = allEntries.shift();
            this.segmentCache.delete(key);
            this.initSegmentCache.delete(key);
            this.currentSize -= entry.size;
        }
    }
    startGarbageCollection() {
        this.timerId = setInterval(() => {
            this.clearExpiredEntries();
        }, 60000);
    }
    dispose() {
        this.initSegmentCache.clear();
        this.segmentCache.clear();
        this.currentSize = 0;
        if (this.timerId) {
            clearInterval(this.timerId);
            this.timerId = undefined;
        }
        this.logger.debug(TAG, 'Disposed');
    }
}
//# sourceMappingURL=CacheManager.js.map