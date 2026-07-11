import { BinaryReader, BinaryWriter } from "@bufbuild/protobuf/wire";
export declare const protobufPackage = "video_streaming";
export interface SabrContextUpdate {
    type?: number | undefined;
    scope?: SabrContextUpdate_SabrContextScope | undefined;
    value?: Uint8Array | undefined;
    sendByDefault?: boolean | undefined;
    writePolicy?: SabrContextUpdate_SabrContextWritePolicy | undefined;
}
export declare enum SabrContextUpdate_SabrContextScope {
    UNKNOWN = 0,
    PLAYBACK = 1,
    REQUEST = 2,
    WATCH_ENDPOINT = 3,
    CONTENT_ADS = 4,
    UNRECOGNIZED = -1
}
export declare enum SabrContextUpdate_SabrContextWritePolicy {
    UNSPECIFIED = 0,
    OVERWRITE = 1,
    KEEP_EXISTING = 2,
    UNRECOGNIZED = -1
}
/** For debugging */
export interface SabrContextValue {
    timing?: SabrContextValue_TimingInfo | undefined;
    signature?: Uint8Array | undefined;
    field5?: number | undefined;
}
export interface SabrContextValue_ContentInfo {
    /** Looks like a content identifier of some sort "mQxOaLekHJ2f-LAPtq3hwQ4" */
    contentId?: string | undefined;
    /** Value of 1 observed (unsure what it truly means/is) */
    contentType?: number | undefined;
}
export interface SabrContextValue_TimingInfo {
    timestampMs?: string | undefined;
    durationMs?: number | undefined;
    content?: SabrContextValue_ContentInfo | undefined;
}
export declare const SabrContextUpdate: MessageFns<SabrContextUpdate>;
export declare const SabrContextValue: MessageFns<SabrContextValue>;
export declare const SabrContextValue_ContentInfo: MessageFns<SabrContextValue_ContentInfo>;
export declare const SabrContextValue_TimingInfo: MessageFns<SabrContextValue_TimingInfo>;
export interface MessageFns<T> {
    encode(message: T, writer?: BinaryWriter): BinaryWriter;
    decode(input: BinaryReader | Uint8Array, length?: number): T;
}
