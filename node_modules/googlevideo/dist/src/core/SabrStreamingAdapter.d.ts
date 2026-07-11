import { CacheManager } from '../utils/index.js';
import { type ReloadPlaybackContext, type SnackbarMessage } from '../utils/Protos.js';
import type { SabrOptions } from '../types/sabrStreamingAdapterTypes.js';
import type { SabrFormat } from '../types/shared.js';
type OnSnackbarMessageCb = (snackbarMessage: SnackbarMessage) => void;
type OnReloadPlayerResponseCb = (reloadPlaybackContext: ReloadPlaybackContext) => Promise<void>;
type OnMintPoTokenCallback = () => Promise<string>;
export declare const SABR_CONSTANTS: {
    readonly PROTOCOL: "sabr:";
    readonly KEY_PARAM: "key";
    readonly DEFAULT_OPTIONS: {
        readonly enableCaching: true;
        readonly enableVerboseRequestLogging: false;
        readonly maxCacheSizeMB: 3;
        readonly maxCacheAgeSeconds: 300;
    };
};
/**
 * Adapter class that handles YouTube SABR integration with media players (e.g., Shaka Player).
 *
 * What it does:
 * - Sets up request/response interceptors so we can send proper SABR requests (UMP response parsing must be done in the player adapter).
 * - Keeps track of initialized formats and their metadata.
 * - Handles SABR-specific things, such as redirects, context updates, and playback cookies.
 */
export declare class SabrStreamingAdapter {
    private readonly playerAdapter;
    private readonly requestMetadataManager;
    private readonly initializedFormats;
    private readonly logger;
    private options;
    private ustreamerConfig?;
    private serverAbrStreamingUrl?;
    private sabrFormats;
    private sabrContexts;
    private activeSabrContextTypes;
    private lastPlaybackCookie?;
    private lastPlayerTimeSecs;
    private cacheManager;
    private requestNumber;
    private activeDelayPromise;
    private onReloadPlayerResponseCallback?;
    private onSnackbarMessageCallback?;
    private onMintPoTokenCallback?;
    isDisposed: boolean;
    /**
     * Registers a callback function to handle snackbar messages.
     */
    onSnackbarMessage(cb: OnSnackbarMessageCb): void;
    /**
     * Handles server requests to reload the player with new parameters.
     * @param cb
     */
    onReloadPlayerResponse(cb: OnReloadPlayerResponseCb): void;
    /**
     * Registers a callback function to mint a new PoToken.
     * @param cb
     */
    onMintPoToken(cb: OnMintPoTokenCallback): void;
    /**
     * @param options - Configuration options for the adapter.
     * @throws SabrAdapterError if a player adapter is not provided.
     */
    constructor(options: SabrOptions);
    /**
     * Initializes the player adapter and sets up request/response interceptors.
     * @throws SabrAdapterError if the adapter has been disposed.
     */
    attach(player: any): void;
    /**
     * Sets the initial server abr streaming URL.
     * @throws SabrAdapterError if the adapter has been disposed.
     */
    setStreamingURL(url?: string): void;
    /**
     * Sets the ustreamer configuration for SABR requests.
     * @throws SabrAdapterError if the adapter has been disposed.
     */
    setUstreamerConfig(ustreamerConfig?: string): void;
    /**
     * Sets the available SABR formats for streaming.
     * @throws SabrAdapterError if the adapter has been disposed.
     */
    setServerAbrFormats(sabrFormats: SabrFormat[]): void;
    /**
     * Returns the cache manager instance, if caching is enabled.
     */
    getCacheManager(): CacheManager | null;
    private setupInterceptors;
    /**
     * Processes incoming requests and modifies them to conform to SABR protocol requirements.
     * For SABR protocol URIs, prepares a VideoPlaybackAbrRequest with current state information.
     * For regular URIs with UMP requirements, adds necessary query parameters.
     * @returns Modified request with SABR-specific changes.
     */
    private handleRequest;
    /**
     * Creates a VideoPlaybackAbrRequest object with current playback state information.
     * @param request - The original player HTTP request.
     * @param currentFormat - The format currently being fetched.
     * @param activeFormats - Object containing references to active audio and video formats.
     * @returns A populated VideoPlaybackAbrRequest object.
     * @throws SabrAdapterError if ustreamer config is not set.
     */
    private createVideoPlaybackAbrRequest;
    /**
     * Adds buffering information to the ABR request for all active formats.
     *
     * NOTE:
     * On the web, mobile, and TV clients, buffered ranges in combination to player time is what dictates the segments you get.
     * In our case, we are cheating a bit by abusing the player time field (in clientAbrState), setting it to the exact start
     * time value of the segment we want, while YouTube simply uses the actual player time.
     *
     * We don't have to fully replicate this behavior for two reasons:
     * 1. The SABR server will only send so much segments for a given player time. That means players like Shaka would
     * not be able to buffer more than what the server thinks is enough. It would behave like YouTube's.
     * 2. We don't have to know what segment a buffered range starts/ends at. It is easy to do in Shaka, but not in other players.
     *
     * @param videoPlaybackAbrRequest - The ABR request to modify with buffering information.
     * @param currentFormat - The format currently being requested.
     * @param activeFormats - References to the currently active audio and video formats.
     * @returns The format to discard (if any) - typically formats that are active but not currently requested.
     */
    private addBufferingInfoToAbrRequest;
    /**
     * Creates a bogus buffered range for a format. Used when we want to signal to the server to not send any
     * segments for this format.
     * @param format - The format to create a full buffer range for.
     * @returns A BufferedRange object indicating the entire format is buffered.
     */
    private createFullBufferRange;
    /**
     * Creates a buffered range representing a partially buffered format.
     * @param initializedFormat - The format with initialization data.
     * @returns A BufferedRange object with segment information, or null if no metadata is available.
     */
    private createPartialBufferRange;
    /**
     * Processes HTTP responses to extract SABR-specific information.
     * @returns The response object.
     */
    private handleResponse;
    /**
     * Makes a followup request and updates the original response object with the new data.
     * @param originalResponse - The original HTTP response.
     * @param url - The URL to request.
     * @param isSABR - Whether this is a SABR request.
     * @param byteRange - Optional byte range for the request.
     * @returns The updated response.
     */
    private makeFollowupRequest;
    private checkDisposed;
    /**
     * Releases resources and cleans up the adapter instance.
     * After calling dispose, the adapter can no longer be used.
     */
    dispose(): void;
}
export {};
