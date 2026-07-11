import { BinaryReader, BinaryWriter } from "@bufbuild/protobuf/wire";
export declare const protobufPackage = "video_streaming";
export interface RequestIdentifier {
    token?: string | undefined;
}
export declare const RequestIdentifier: MessageFns<RequestIdentifier>;
export interface MessageFns<T> {
    encode(message: T, writer?: BinaryWriter): BinaryWriter;
    decode(input: BinaryReader | Uint8Array, length?: number): T;
}
