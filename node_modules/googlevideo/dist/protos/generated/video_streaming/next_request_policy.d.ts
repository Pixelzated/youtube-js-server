import { BinaryReader, BinaryWriter } from "@bufbuild/protobuf/wire";
import { PlaybackCookie } from "./playback_cookie.js";
export declare const protobufPackage = "video_streaming";
export interface NextRequestPolicy {
    targetAudioReadaheadMs?: number | undefined;
    targetVideoReadaheadMs?: number | undefined;
    maxTimeSinceLastRequestMs?: number | undefined;
    backoffTimeMs?: number | undefined;
    minAudioReadaheadMs?: number | undefined;
    minVideoReadaheadMs?: number | undefined;
    playbackCookie?: PlaybackCookie | undefined;
    videoId?: string | undefined;
}
export declare const NextRequestPolicy: MessageFns<NextRequestPolicy>;
export interface MessageFns<T> {
    encode(message: T, writer?: BinaryWriter): BinaryWriter;
    decode(input: BinaryReader | Uint8Array, length?: number): T;
}
