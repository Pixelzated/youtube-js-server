import { BinaryReader, BinaryWriter } from "@bufbuild/protobuf/wire";
export declare const protobufPackage = "video_streaming";
export interface MediaCapabilities {
    videoFormatCapabilities: MediaCapabilities_VideoFormatCapability[];
    audioFormatCapabilities: MediaCapabilities_AudioFormatCapability[];
    hdrModeBitmask?: number | undefined;
}
export interface MediaCapabilities_VideoFormatCapability {
    videoCodec?: number | undefined;
    maxHeight?: number | undefined;
    maxWidth?: number | undefined;
    maxFramerate?: number | undefined;
    maxBitrateBps?: number | undefined;
    is10BitSupported?: boolean | undefined;
}
export interface MediaCapabilities_AudioFormatCapability {
    audioCodec?: number | undefined;
    numChannels?: number | undefined;
    maxBitrateBps?: number | undefined;
    spatialCapabilityBitmask?: number | undefined;
}
export declare const MediaCapabilities: MessageFns<MediaCapabilities>;
export declare const MediaCapabilities_VideoFormatCapability: MessageFns<MediaCapabilities_VideoFormatCapability>;
export declare const MediaCapabilities_AudioFormatCapability: MessageFns<MediaCapabilities_AudioFormatCapability>;
export interface MessageFns<T> {
    encode(message: T, writer?: BinaryWriter): BinaryWriter;
    decode(input: BinaryReader | Uint8Array, length?: number): T;
}
