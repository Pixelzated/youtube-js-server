import type { InitializedFormat } from '../core/SabrStream.js';
import type { SabrFormat } from '../types/shared.js';
/**
 * Determines the media type (video or audio) based on the format initialization metadata.
 * @param initializedFormat
 */
export declare function getMediaType(initializedFormat: InitializedFormat): 'video' | 'audio';
/**
 * Calculates the total duration of downloaded segments in milliseconds.
 * @param initializedFormat
 */
export declare function getTotalDownloadedDuration(initializedFormat: InitializedFormat): number;
/**
 * Filters formats by media type (audio or video)
 */
export declare function filterFormatsByType(formats: SabrFormat[], isAudio: boolean): SabrFormat[];
/**
 * Choose the best format based on options
 */
export declare function chooseFormat(formats: SabrFormat[], formatOption: number | SabrFormat | ((formats: SabrFormat[]) => SabrFormat | undefined) | undefined, preferences: {
    quality?: string;
    language?: string;
    preferWebM?: boolean;
    preferMP4?: boolean;
    preferH264?: boolean;
    preferOpus?: boolean;
    isAudio: boolean;
}): SabrFormat | undefined;
