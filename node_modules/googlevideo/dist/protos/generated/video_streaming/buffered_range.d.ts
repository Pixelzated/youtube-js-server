import { BinaryReader, BinaryWriter } from "@bufbuild/protobuf/wire";
import { FormatId } from "../misc/common.js";
import { TimeRange } from "./time_range.js";
export declare const protobufPackage = "video_streaming";
export interface BufferedRange {
    formatId: FormatId | undefined;
    startTimeMs: string;
    durationMs: string;
    startSegmentIndex: number;
    endSegmentIndex: number;
    timeRange?: TimeRange | undefined;
    field9?: BufferedRange_UnknownMessage1 | undefined;
    field11?: BufferedRange_UnknownMessage2 | undefined;
    field12?: BufferedRange_UnknownMessage2 | undefined;
}
export interface BufferedRange_UnknownMessage1 {
    field1: BufferedRange_UnknownMessage1_UnknownInnerMessage[];
}
export interface BufferedRange_UnknownMessage1_UnknownInnerMessage {
    videoId?: string | undefined;
    lmt?: string | undefined;
}
export interface BufferedRange_UnknownMessage2 {
    field1?: number | undefined;
    field2?: number | undefined;
    field3?: number | undefined;
}
export declare const BufferedRange: MessageFns<BufferedRange>;
export declare const BufferedRange_UnknownMessage1: MessageFns<BufferedRange_UnknownMessage1>;
export declare const BufferedRange_UnknownMessage1_UnknownInnerMessage: MessageFns<BufferedRange_UnknownMessage1_UnknownInnerMessage>;
export declare const BufferedRange_UnknownMessage2: MessageFns<BufferedRange_UnknownMessage2>;
export interface MessageFns<T> {
    encode(message: T, writer?: BinaryWriter): BinaryWriter;
    decode(input: BinaryReader | Uint8Array, length?: number): T;
}
