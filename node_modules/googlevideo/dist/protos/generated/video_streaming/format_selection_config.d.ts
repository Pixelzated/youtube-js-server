import { BinaryReader, BinaryWriter } from "@bufbuild/protobuf/wire";
export declare const protobufPackage = "video_streaming";
export interface FormatSelectionConfig {
    itags: number[];
    videoId?: string | undefined;
    resolution?: number | undefined;
}
export declare const FormatSelectionConfig: MessageFns<FormatSelectionConfig>;
export interface MessageFns<T> {
    encode(message: T, writer?: BinaryWriter): BinaryWriter;
    decode(input: BinaryReader | Uint8Array, length?: number): T;
}
