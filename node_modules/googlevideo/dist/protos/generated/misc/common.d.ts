import { BinaryReader, BinaryWriter } from "@bufbuild/protobuf/wire";
export declare const protobufPackage = "misc";
export declare enum CompressionType {
    UNKNOWN = 0,
    GZIP = 1,
    BROTLI = 2,
    UNRECOGNIZED = -1
}
export declare enum AudioQuality {
    UNKNOWN = 0,
    ULTRALOW = 5,
    LOW = 10,
    MEDIUM = 20,
    HIGH = 30,
    UNRECOGNIZED = -1
}
export declare enum VideoQualitySetting {
    UNKNOWN = 0,
    HIGHER_QUALITY = 1,
    DATA_SAVER = 2,
    ADVANCED_MENU = 3,
    UNRECOGNIZED = -1
}
export declare enum PlaybackAudioRouteOutputType {
    UNKNOWN = 0,
    LINE_OUT = 1,
    HEADPHONES = 2,
    BLUETOOTH_A2DP = 3,
    BUILT_IN_RECEIVER = 4,
    BUILT_IN_SPEAKER = 5,
    HDMI = 6,
    AIR_PLAY = 7,
    BLUETOOTH_LE = 8,
    BLUETOOTH_HFP = 9,
    USB_AUDIO = 10,
    CAR_PLAY = 11,
    ANDROID_AUDIO = 12,
    UNRECOGNIZED = -1
}
export declare enum NetworkMeteredState {
    UNKNOWN = 0,
    UNMETERED = 1,
    METERED = 2,
    UNRECOGNIZED = -1
}
export declare enum SeekSource {
    UNKNOWN = 0,
    TIMESTAMP_IN_COMMENTS = 1,
    TIMESTAMP_IN_DESCRIPTION = 2,
    MACRO_MARKER_LIST_ITEM = 3,
    DOUBLE_TAP_TO_SEEK = 4,
    DOUBLE_TAP_TO_SKIP_CHAPTER = 5,
    PICK_UP_PLAY_HEAD = 6,
    SLIDE_ON_SCRUBBER_BAR = 7,
    SLIDE_ON_PLAYER = 8,
    SABR_PARTIAL_CHUNK = 9,
    SABR_SEEK_TO_HEAD = 10,
    SABR_LIVE_DVR_USER_SEEK = 11,
    SABR_SEEK_TO_DVR_LOWER_BOUND = 12,
    SABR_SEEK_TO_DVR_UPPER_BOUND = 13,
    SSDAI_INTERNAL = 14,
    START_PLAYBACK = 15,
    SABR_ACCURATE_SEEK = 17,
    START_PLAYBACK_SEEK_TO_END = 18,
    IOS_PLAYER_REMOVED_SEGMENTS = 19,
    IOS_PLAYER_SEGMENT_LIST = 20,
    IOS_PLAYER_ITEM_SEEK = 21,
    IOS_PLAYER_ITEM_SEEK_TO_END = 22,
    IOS_PLAYER_SEEK_TO_END_TO_RESYNC = 23,
    IOS_SEEK_ACCESSIBILITY_BUTTON = 24,
    FINE_SCRUBBER_SLIDE_ON_FILMSTRIP = 25,
    FINE_SCRUBBER_TAP_ON_FILMSTRIP = 26,
    FINE_SCRUBBER_SLIDE_ON_SCRUBBER_BAR = 27,
    SEEK_BUTTON_ON_PLAYER_CONTROL = 28,
    SABR_INGESTION_WALL_TIME_SEEK = 29,
    PLAYER_VIEW_REPARENT_INTERNAL = 30,
    PRESS_REWIND_PLAY_BACK_CONTROL = 31,
    PRESS_FAST_FORWARD_PLAY_BACK_CONTROL = 32,
    PRESS_LIVE_SYNC_ICON = 33,
    PEG_TO_LIVE = 34,
    ANDROID_MEDIA_SESSION = 35,
    TAP_ON_REPLAY_ACTION = 36,
    AUTOMATIC_REPLAY_ACTION = 37,
    NON_USER_SEEK_TO_PREVIOUS = 38,
    NON_USER_SEEK_TO_NEXT = 39,
    HIGHLIGHTS_TAP_PREVIOUS_PLAY = 66,
    HIGHLIGHTS_TAP_NEXT_PLAY = 40,
    HIGHLIGHTS_TAP_HIDDEN_NEXT_PLAY = 41,
    HIGHLIGHTS_TAP_LIST_ITEM = 42,
    HIGHLIGHTS_AUTOMATIC_NEXT_PLAY = 43,
    HIGHLIGHTS_SEEK_TO_FIRST_PLAY = 44,
    HIGHLIGHTS_SEEK_TO_END = 45,
    SEGMENTS_TAP_LIST_ITEM = 46,
    PIP_FAST_FORWARD_BUTTON = 47,
    PIP_REWIND_BUTTON = 48,
    PIP_RESUME_ON_HEAD = 49,
    MOVING_CLIP_FRAME = 50,
    RESUME_CLIP_PREVIOUS_POSITION = 51,
    SEEK_TO_NEXT_CHAPTER = 52,
    SEEK_TO_PREVIOUS_CHAPTER = 53,
    IOS_SHAREPLAY_PAUSE = 54,
    IOS_SHAREPLAY_SEEK = 55,
    IOS_SHAREPLAY_SYNC_RESPONSE = 56,
    SEEK_TO_HEAD_IMMERSIVE_LIVE_VIDEO = 57,
    SEEK_TO_START_OF_LOOPING_RANGE_OF_SHORTS = 58,
    SABR_SEEK_TO_CLOSEST_KEYFRAME = 59,
    SEEK_TO_END_OF_LOOPING_RANGE_OF_SHORTS = 60,
    CLIP_SLIDE_ON_FLIMSTRIP = 61,
    PICK_UP_CLIP_SLIDER = 62,
    FINE_SCRUBBER_CANCELLED = 63,
    INLINE_PLAYER_SEEK_CHAPTER = 64,
    INLINE_PLAYER_SEEK_SECONDS = 65,
    HIGHLIGHTS_PLAYER_EXIT_FULLSCREEN = 67,
    LARGE_CONTROLS_FORWARD_BUTTON = 68,
    LARGE_CONTROLS_REWIND_BUTTON = 69,
    LARGE_CONTROLS_SCRUBBER_BAR = 70,
    SEEK_BACKWARD_5S = 71,
    SEEK_FORWARD_5S = 72,
    SEEK_BACKWARD_10S = 73,
    SEEK_FORWARD_10S = 74,
    SEEK_FORWARD_60S = 75,
    SEEK_BACKWARD_60S = 76,
    SEEK_TO_NEXT_FRAME = 77,
    SEEK_TO_PREV_FRAME = 78,
    KEYBOARD_SEEK_TO_BEGINNING = 79,
    KEYBOARD_SEEK_TO_END = 80,
    SEEK_PERCENT_OF_VIDEO = 81,
    HIDDEN_FAST_FORWARD_BUTTON = 82,
    HIDDEN_REWIND_BUTTON = 83,
    TIMESTAMP = 84,
    LR_MEDIA_SESSION_SEEK = 87,
    MIDROLLS_WITH_TIME_RANGE = 88,
    SKIP_AD = 89,
    SEEK_TO_PREVIOUS = 90,
    SEEK_TO_NEXT = 91,
    LR_QUICK_SEEK = 92,
    ONESIE_LIVE = 93,
    LR_PLAYER_CONTROL_ACTION = 94,
    UNPLUGGED_LENS_START_CLIP = 95,
    LR_KEY_PLAYS = 96,
    SSAP_AD_FMT_FATAL = 97,
    TVHTML5_INPUT_SOURCE_KEY_EVENT = 98,
    TVHTML5_INPUT_SOURCE_CONTROLS = 99,
    TVHTML5_INPUT_SOURCE_TOUCH = 100,
    TVHTML5_INPUT_SOURCE_TOUCHPAD = 101,
    SEEK_TO_HEAD = 102,
    AUTOMATIC_PREVIEW_REPLAY_ACTION = 103,
    H5_MEDIA_ELEMENT_EVENT = 104,
    H5_WORKAROUND_SEEK = 105,
    MINIPLAYER_REWIND_BUTTON = 106,
    MINIPLAYER_FAST_FORWARD_BUTTON = 107,
    SABR_RELOAD_PLAYER_RESPONSE_TOKEN_SEEK = 108,
    SLIDE_ON_SCRUBBER_BAR_CHAPTER = 109,
    ANDROID_CLEAR_BUFFER = 110,
    UNRECOGNIZED = -1
}
export declare enum OnesieRequestTarget {
    UNKNOWN = 0,
    ENCRYPTED_PLAYER_SERVICE = 1,
    ENCRYPTED_WATCH_SERVICE_DEPRECATED = 2,
    ENCRYPTED_WATCH_SERVICE = 3,
    INNERTUBE_ENCRYPTED_SERVICE = 4,
    UNRECOGNIZED = -1
}
export interface HttpHeader {
    name?: string | undefined;
    value?: string | undefined;
}
export interface FormatId {
    itag?: number | undefined;
    lastModified?: string | undefined;
    xtags?: string | undefined;
}
export interface Range {
    legacyStart?: number | undefined;
    legacyEnd?: number | undefined;
    start?: number | undefined;
    end?: number | undefined;
}
export interface IdentifierToken {
    requestNumber?: number | undefined;
    field5?: number | undefined;
}
export interface KeyValuePair {
    key?: string | undefined;
    value?: string | undefined;
}
export interface AuthorizedFormat {
    trackType?: number | undefined;
    isHdr?: boolean | undefined;
}
export interface PlaybackAuthorization {
    authorizedFormats: AuthorizedFormat[];
    sabrLicenseConstraint?: Uint8Array | undefined;
}
export declare const HttpHeader: MessageFns<HttpHeader>;
export declare const FormatId: MessageFns<FormatId>;
export declare const Range: MessageFns<Range>;
export declare const IdentifierToken: MessageFns<IdentifierToken>;
export declare const KeyValuePair: MessageFns<KeyValuePair>;
export declare const AuthorizedFormat: MessageFns<AuthorizedFormat>;
export declare const PlaybackAuthorization: MessageFns<PlaybackAuthorization>;
export interface MessageFns<T> {
    encode(message: T, writer?: BinaryWriter): BinaryWriter;
    decode(input: BinaryReader | Uint8Array, length?: number): T;
}
