import { BinaryReader, BinaryWriter } from "@bufbuild/protobuf/wire";
import { AudioQuality, NetworkMeteredState, PlaybackAudioRouteOutputType, PlaybackAuthorization, VideoQualitySetting } from "../misc/common.js";
import { MediaCapabilities } from "./media_capabilities.js";
export declare const protobufPackage = "video_streaming";
export interface ClientAbrState {
    timeSinceLastManualFormatSelectionMs?: string | undefined;
    lastManualDirection?: number | undefined;
    lastManualSelectedResolution?: number | undefined;
    detailedNetworkType?: number | undefined;
    clientViewportWidth?: number | undefined;
    clientViewportHeight?: number | undefined;
    clientBitrateCapBytesPerSec?: string | undefined;
    stickyResolution?: number | undefined;
    clientViewportIsFlexible?: boolean | undefined;
    bandwidthEstimate?: string | undefined;
    minAudioQuality?: AudioQuality | undefined;
    maxAudioQuality?: AudioQuality | undefined;
    videoQualitySetting?: VideoQualitySetting | undefined;
    audioRoute?: PlaybackAudioRouteOutputType | undefined;
    playerTimeMs?: string | undefined;
    timeSinceLastSeek?: string | undefined;
    dataSaverMode?: boolean | undefined;
    networkMeteredState?: NetworkMeteredState | undefined;
    visibility?: number | undefined;
    playbackRate?: number | undefined;
    elapsedWallTimeMs?: string | undefined;
    mediaCapabilities?: MediaCapabilities | undefined;
    timeSinceLastActionMs?: string | undefined;
    enabledTrackTypesBitfield?: number | undefined;
    maxPacingRate?: number | undefined;
    playerState?: string | undefined;
    drcEnabled?: boolean | undefined;
    field48?: number | undefined;
    field50?: number | undefined;
    field51?: number | undefined;
    sabrReportRequestCancellationInfo?: number | undefined;
    disableStreamingXhr?: boolean | undefined;
    field57?: string | undefined;
    preferVp9?: boolean | undefined;
    /** 2160 */
    av1QualityThreshold?: number | undefined;
    field60?: number | undefined;
    isPrefetch?: boolean | undefined;
    sabrSupportQualityConstraints?: boolean | undefined;
    sabrLicenseConstraint?: Uint8Array | undefined;
    allowProximaLiveLatency?: number | undefined;
    sabrForceProxima?: number | undefined;
    field67?: number | undefined;
    sabrForceMaxNetworkInterruptionDurationMs?: string | undefined;
    audioTrackId?: string | undefined;
    enableVoiceBoost?: boolean | undefined;
    playbackAuthorization?: PlaybackAuthorization | undefined;
}
export declare const ClientAbrState: MessageFns<ClientAbrState>;
export interface MessageFns<T> {
    encode(message: T, writer?: BinaryWriter): BinaryWriter;
    decode(input: BinaryReader | Uint8Array, length?: number): T;
}
