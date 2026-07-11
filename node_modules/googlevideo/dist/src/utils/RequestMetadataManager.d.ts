import type { SabrRequestMetadata } from '../types/sabrStreamingAdapterTypes.js';
/**
 * Manages request metadata objects.
 */
export declare class RequestMetadataManager {
    metadataMap: Map<string, SabrRequestMetadata>;
    private lastCleanup;
    private readonly CLEANUP_INTERVAL;
    private readonly ENTRY_EXPIRATION_TIME;
    constructor();
    getRequestMetadata(url: string, del?: boolean): SabrRequestMetadata | undefined;
    setRequestMetadata(url: string, context: SabrRequestMetadata): void;
    private conditionalCleanUp;
    private cleanUp;
}
