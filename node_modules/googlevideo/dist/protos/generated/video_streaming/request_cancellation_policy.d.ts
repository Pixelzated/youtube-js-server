import { BinaryReader, BinaryWriter } from "@bufbuild/protobuf/wire";
export declare const protobufPackage = "video_streaming";
export interface RequestCancellationPolicy {
    N0?: number | undefined;
    items: RequestCancellationPolicy_Item[];
    jq?: number | undefined;
}
export interface RequestCancellationPolicy_Item {
    fR?: number | undefined;
    NK?: number | undefined;
    minReadaheadMs?: number | undefined;
}
export declare const RequestCancellationPolicy: MessageFns<RequestCancellationPolicy>;
export declare const RequestCancellationPolicy_Item: MessageFns<RequestCancellationPolicy_Item>;
export interface MessageFns<T> {
    encode(message: T, writer?: BinaryWriter): BinaryWriter;
    decode(input: BinaryReader | Uint8Array, length?: number): T;
}
