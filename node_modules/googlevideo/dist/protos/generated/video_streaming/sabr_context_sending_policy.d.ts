import { BinaryReader, BinaryWriter } from "@bufbuild/protobuf/wire";
export declare const protobufPackage = "video_streaming";
export interface SabrContextSendingPolicy {
    startPolicy: number[];
    stopPolicy: number[];
    discardPolicy: number[];
}
export declare const SabrContextSendingPolicy: MessageFns<SabrContextSendingPolicy>;
export interface MessageFns<T> {
    encode(message: T, writer?: BinaryWriter): BinaryWriter;
    decode(input: BinaryReader | Uint8Array, length?: number): T;
}
