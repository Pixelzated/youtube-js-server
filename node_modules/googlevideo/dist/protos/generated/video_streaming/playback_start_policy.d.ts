import { BinaryReader, BinaryWriter } from "@bufbuild/protobuf/wire";
export declare const protobufPackage = "video_streaming";
export interface PlaybackStartPolicy {
    startMinReadaheadPolicy?: PlaybackStartPolicy_ReadaheadPolicy | undefined;
    resumeMinReadaheadPolicy?: PlaybackStartPolicy_ReadaheadPolicy | undefined;
}
export interface PlaybackStartPolicy_ReadaheadPolicy {
    minReadaheadMs?: number | undefined;
    minBandwidthBytesPerSec?: number | undefined;
}
export declare const PlaybackStartPolicy: MessageFns<PlaybackStartPolicy>;
export declare const PlaybackStartPolicy_ReadaheadPolicy: MessageFns<PlaybackStartPolicy_ReadaheadPolicy>;
export interface MessageFns<T> {
    encode(message: T, writer?: BinaryWriter): BinaryWriter;
    decode(input: BinaryReader | Uint8Array, length?: number): T;
}
