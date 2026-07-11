import { BinaryReader, BinaryWriter } from "@bufbuild/protobuf/wire";
export declare const protobufPackage = "video_streaming";
export interface LiveMetadata {
    broadcastId?: string | undefined;
    headSequenceNumber?: string | undefined;
    headTimeMs?: string | undefined;
    wallTimeMs?: string | undefined;
    videoId?: string | undefined;
    postLiveDvr?: boolean | undefined;
    headm?: string | undefined;
    minSeekableTimeTicks?: string | undefined;
    minSeekableTimescale?: number | undefined;
    maxSeekableTimeTicks?: string | undefined;
    maxSeekableTimescale?: number | undefined;
}
export declare const LiveMetadata: MessageFns<LiveMetadata>;
export interface MessageFns<T> {
    encode(message: T, writer?: BinaryWriter): BinaryWriter;
    decode(input: BinaryReader | Uint8Array, length?: number): T;
}
