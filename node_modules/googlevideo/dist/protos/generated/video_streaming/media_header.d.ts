import { BinaryReader, BinaryWriter } from "@bufbuild/protobuf/wire";
import { CompressionType, FormatId } from "../misc/common.js";
import { TimeRange } from "./time_range.js";
export declare const protobufPackage = "video_streaming";
export interface MediaHeader {
    headerId?: number | undefined;
    videoId?: string | undefined;
    itag?: number | undefined;
    lmt?: string | undefined;
    xtags?: string | undefined;
    startRange?: string | undefined;
    compressionAlgorithm?: CompressionType | undefined;
    isInitSeg?: boolean | undefined;
    sequenceNumber?: number | undefined;
    bitrateBps?: string | undefined;
    startMs?: string | undefined;
    durationMs?: string | undefined;
    formatId?: FormatId | undefined;
    contentLength?: string | undefined;
    timeRange?: TimeRange | undefined;
    sequenceLmt?: string | undefined;
}
export declare const MediaHeader: MessageFns<MediaHeader>;
export interface MessageFns<T> {
    encode(message: T, writer?: BinaryWriter): BinaryWriter;
    decode(input: BinaryReader | Uint8Array, length?: number): T;
}
