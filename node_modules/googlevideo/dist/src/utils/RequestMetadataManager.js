/**
 * Manages request metadata objects.
 */
export class RequestMetadataManager {
    constructor() {
        this.CLEANUP_INTERVAL = 30000;
        this.ENTRY_EXPIRATION_TIME = 1000 * 60 * 3;
        this.metadataMap = new Map();
        this.lastCleanup = Date.now();
    }
    getRequestMetadata(url, del = false) {
        const requestNumber = new URL(url).searchParams.get('rn') || '';
        const streamingContext = this.metadataMap.get(requestNumber);
        // Check if this specific entry is expired.
        if (streamingContext && Date.now() - streamingContext.timestamp > this.ENTRY_EXPIRATION_TIME) {
            this.metadataMap.delete(requestNumber);
            return undefined;
        }
        if (del) {
            this.metadataMap.delete(requestNumber);
        }
        this.conditionalCleanUp();
        return streamingContext;
    }
    setRequestMetadata(url, context) {
        const requestNumber = new URL(url).searchParams.get('rn');
        if (requestNumber) {
            this.metadataMap.set(requestNumber, context);
            this.conditionalCleanUp();
        }
    }
    conditionalCleanUp() {
        const now = Date.now();
        if (now - this.lastCleanup > this.CLEANUP_INTERVAL) {
            this.cleanUp();
            this.lastCleanup = now;
        }
    }
    cleanUp() {
        // Should rarely run. This is only for requests that fail and never get handled (e.g., network errors).
        for (const [key, context] of this.metadataMap.entries()) {
            if (Date.now() - context.timestamp > this.ENTRY_EXPIRATION_TIME) {
                this.metadataMap.delete(key);
            }
        }
    }
}
//# sourceMappingURL=RequestMetadataManager.js.map