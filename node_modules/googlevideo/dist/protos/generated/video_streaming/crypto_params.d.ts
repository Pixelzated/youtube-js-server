import { BinaryReader, BinaryWriter } from "@bufbuild/protobuf/wire";
import { CompressionType } from "../misc/common.js";
export declare const protobufPackage = "video_streaming";
export interface CryptoParams {
    hmac?: Uint8Array | undefined;
    iv?: Uint8Array | undefined;
    compressionType?: CompressionType | undefined;
}
export declare const CryptoParams: MessageFns<CryptoParams>;
export interface MessageFns<T> {
    encode(message: T, writer?: BinaryWriter): BinaryWriter;
    decode(input: BinaryReader | Uint8Array, length?: number): T;
}
