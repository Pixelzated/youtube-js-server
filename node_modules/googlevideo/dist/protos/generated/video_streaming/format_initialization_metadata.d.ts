import { BinaryReader, BinaryWriter } from "@bufbuild/protobuf/wire";
import { FormatId, Range } from "../misc/common.js";
export declare const protobufPackage = "video_streaming";
export interface FormatInitializationMetadata {
    videoId?: string | undefined;
    formatId?: FormatId | undefined;
    endTimeMs?: string | undefined;
    endSegmentNumber?: string | undefined;
    mimeType?: string | undefined;
    initRange?: Range | undefined;
    indexRange?: Range | undefined;
    field8?: string | undefined;
    durationUnits?: string | undefined;
    durationTimescale?: string | undefined;
}
export declare const FormatInitializationMetadata: MessageFns<FormatInitializationMetadata>;
export interface MessageFns<T> {
    encode(message: T, writer?: BinaryWriter): BinaryWriter;
    decode(input: BinaryReader | Uint8Array, length?: number): T;
}
