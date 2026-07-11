import { BinaryReader, BinaryWriter } from "@bufbuild/protobuf/wire";
import { OnesieRequestTarget } from "../misc/common.js";
import { BufferedRange } from "./buffered_range.js";
import { ClientAbrState } from "./client_abr_state.js";
import { InnertubeRequest } from "./innertube_request.js";
import { ReloadPlaybackParams } from "./reload_player_response.js";
import { StreamerContext } from "./streamer_context.js";
export declare const protobufPackage = "video_streaming";
export interface OnesieRequest {
    urls: string[];
    clientAbrState?: ClientAbrState | undefined;
    innertubeRequest?: InnertubeRequest | undefined;
    onesieUstreamerConfig?: Uint8Array | undefined;
    maxVp9Height?: number | undefined;
    clientDisplayHeight?: number | undefined;
    streamerContext?: StreamerContext | undefined;
    /** MLOnesieRequestTarget */
    requestTarget?: OnesieRequestTarget | undefined;
    bufferedRanges: BufferedRange[];
    reloadPlaybackParams?: ReloadPlaybackParams | undefined;
}
export declare const OnesieRequest: MessageFns<OnesieRequest>;
export interface MessageFns<T> {
    encode(message: T, writer?: BinaryWriter): BinaryWriter;
    decode(input: BinaryReader | Uint8Array, length?: number): T;
}
