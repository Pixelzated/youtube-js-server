import { BinaryReader, BinaryWriter } from "@bufbuild/protobuf/wire";
import { CryptoParams } from "./crypto_params.js";
import { OnesieHeaderType } from "./onesie_header_type.js";
export declare const protobufPackage = "video_streaming";
export interface OnesieHeader {
    type?: OnesieHeaderType | undefined;
    videoId?: string | undefined;
    itag?: string | undefined;
    cryptoParams?: CryptoParams | undefined;
    lastModified?: string | undefined;
    expectedMediaSizeBytes?: string | undefined;
    restrictedFormats: string[];
    xtags?: string | undefined;
    sequenceNumber?: string | undefined;
    field23?: OnesieHeader_UnknownMessage1 | undefined;
    field34?: OnesieHeader_UnknownMessage2 | undefined;
}
export interface OnesieHeader_UnknownMessage1 {
    videoId?: string | undefined;
}
export interface OnesieHeader_UnknownMessage2 {
    itagDenylist: string[];
}
export declare const OnesieHeader: MessageFns<OnesieHeader>;
export declare const OnesieHeader_UnknownMessage1: MessageFns<OnesieHeader_UnknownMessage1>;
export declare const OnesieHeader_UnknownMessage2: MessageFns<OnesieHeader_UnknownMessage2>;
export interface MessageFns<T> {
    encode(message: T, writer?: BinaryWriter): BinaryWriter;
    decode(input: BinaryReader | Uint8Array, length?: number): T;
}
