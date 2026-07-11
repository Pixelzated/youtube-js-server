import { BinaryReader, BinaryWriter } from "@bufbuild/protobuf/wire";
export declare const protobufPackage = "video_streaming";
export interface StreamProtectionStatus {
    status?: number | undefined;
    maxRetries?: number | undefined;
}
export declare const StreamProtectionStatus: MessageFns<StreamProtectionStatus>;
export interface MessageFns<T> {
    encode(message: T, writer?: BinaryWriter): BinaryWriter;
    decode(input: BinaryReader | Uint8Array, length?: number): T;
}
