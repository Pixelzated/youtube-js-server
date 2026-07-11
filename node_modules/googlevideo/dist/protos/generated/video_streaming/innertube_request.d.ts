import { BinaryReader, BinaryWriter } from "@bufbuild/protobuf/wire";
export declare const protobufPackage = "video_streaming";
export interface InnertubeRequest {
    context?: Uint8Array | undefined;
    encryptedOnesieInnertubeRequest?: Uint8Array | undefined;
    encryptedClientKey?: Uint8Array | undefined;
    iv?: Uint8Array | undefined;
    hmac?: Uint8Array | undefined;
    reverseProxyConfig?: string | undefined;
    serializeResponseAsJson?: boolean | undefined;
    enableAdPlacementsPreroll?: boolean | undefined;
    enableCompression?: boolean | undefined;
    ustreamerFlags?: UstreamerFlags | undefined;
    unencryptedOnesieInnertubeRequest?: Uint8Array | undefined;
    useJsonformatterToParsePlayerResponse?: boolean | undefined;
}
export interface UstreamerFlags {
    sendVideoPlaybackConfig?: boolean | undefined;
}
export declare const InnertubeRequest: MessageFns<InnertubeRequest>;
export declare const UstreamerFlags: MessageFns<UstreamerFlags>;
export interface MessageFns<T> {
    encode(message: T, writer?: BinaryWriter): BinaryWriter;
    decode(input: BinaryReader | Uint8Array, length?: number): T;
}
