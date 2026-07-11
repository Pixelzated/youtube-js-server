import { BinaryReader, BinaryWriter } from "@bufbuild/protobuf/wire";
import { FormatId } from "../misc/common.js";
import { BufferedRange } from "./buffered_range.js";
import { ClientAbrState } from "./client_abr_state.js";
import { StreamerContext } from "./streamer_context.js";
import { TimeRange } from "./time_range.js";
export declare const protobufPackage = "video_streaming";
export interface VideoPlaybackAbrRequest {
    clientAbrState?: ClientAbrState | undefined;
    selectedFormatIds: FormatId[];
    bufferedRanges: BufferedRange[];
    /** `osts` (Onesie Start Time Seconds) param on Onesie requests. */
    playerTimeMs?: string | undefined;
    videoPlaybackUstreamerConfig?: Uint8Array | undefined;
    field6?: UnknownMessage1 | undefined;
    /** `pai` (Preferred Audio Itags) param on Onesie requests. */
    preferredAudioFormatIds: FormatId[];
    /** `pvi` (Preferred Video Itags) param on Onesie requests. */
    preferredVideoFormatIds: FormatId[];
    preferredSubtitleFormatIds: FormatId[];
    streamerContext?: StreamerContext | undefined;
    field21?: UnknownMessage2 | undefined;
    field22?: number | undefined;
    field23?: number | undefined;
    field1000: UnknownMessage3[];
}
export interface UnknownMessage1 {
    formatId?: FormatId | undefined;
    lmt?: string | undefined;
    sequenceNumber?: number | undefined;
    timeRange?: TimeRange | undefined;
    field5?: number | undefined;
}
export interface UnknownMessage2 {
    field1: string[];
    field2?: Uint8Array | undefined;
    field3?: string | undefined;
    field4?: number | undefined;
    field5?: number | undefined;
    field6?: string | undefined;
}
export interface UnknownMessage3 {
    formatIds: FormatId[];
    ud: BufferedRange[];
    clipId?: string | undefined;
}
export declare const VideoPlaybackAbrRequest: MessageFns<VideoPlaybackAbrRequest>;
export declare const UnknownMessage1: MessageFns<UnknownMessage1>;
export declare const UnknownMessage2: MessageFns<UnknownMessage2>;
export declare const UnknownMessage3: MessageFns<UnknownMessage3>;
export interface MessageFns<T> {
    encode(message: T, writer?: BinaryWriter): BinaryWriter;
    decode(input: BinaryReader | Uint8Array, length?: number): T;
}
