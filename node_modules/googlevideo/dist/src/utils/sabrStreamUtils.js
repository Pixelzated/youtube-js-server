/**
 * Determines the media type (video or audio) based on the format initialization metadata.
 * @param initializedFormat
 */
export function getMediaType(initializedFormat) {
    return initializedFormat.formatInitializationMetadata?.mimeType?.includes('video') ? 'video' : 'audio';
}
/**
 * Calculates the total duration of downloaded segments in milliseconds.
 * @param initializedFormat
 */
export function getTotalDownloadedDuration(initializedFormat) {
    return Array.from(initializedFormat.downloadedSegments.values())
        .reduce((sum, segment) => sum + (parseInt(segment.durationMs || '0')), 0);
}
/**
 * Filters formats by media type (audio or video)
 */
export function filterFormatsByType(formats, isAudio) {
    return formats.filter((format) => {
        if (!format.mimeType)
            return false;
        return isAudio
            ? format.mimeType.includes('audio')
            : format.mimeType.includes('video');
    });
}
/**
 * Choose the best format based on options
 */
export function chooseFormat(formats, formatOption, preferences) {
    if (!formats.length)
        return undefined;
    const typeFormats = filterFormatsByType(formats, preferences.isAudio);
    if (!typeFormats.length)
        return undefined;
    if (typeof formatOption === 'number') {
        return typeFormats.find((format) => format.itag === formatOption);
    }
    if (formatOption && typeof formatOption !== 'function') {
        return formatOption;
    }
    if (typeof formatOption === 'function') {
        return formatOption(typeFormats);
    }
    let filteredFormats = typeFormats;
    if (preferences.language) {
        filteredFormats = filteredFormats.filter((format) => format.language === preferences.language);
    }
    if (preferences.quality) {
        filteredFormats = filteredFormats.filter((format) => preferences.isAudio
            ? !!format.audioQuality?.toLowerCase().includes(preferences.quality?.toLowerCase() || '')
            : !!format.qualityLabel?.toLowerCase().includes(preferences.quality?.toLowerCase() || ''));
    }
    if (preferences.isAudio) {
        if (preferences.preferOpus) {
            filteredFormats = applyMimeTypeFilter(filteredFormats, 'opus');
        }
    }
    else if (preferences.preferH264) {
        filteredFormats = filteredFormats.filter((format) => !!format.mimeType && format.mimeType.includes('mp4') && format.mimeType.includes('avc'));
    }
    if (preferences.preferWebM) {
        filteredFormats = applyMimeTypeFilter(filteredFormats, 'webm');
    }
    else if (preferences.preferMP4) {
        filteredFormats = applyMimeTypeFilter(filteredFormats, 'mp4');
    }
    return preferences.isAudio
        ? filteredFormats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0]
        : filteredFormats.sort((a, b) => (b.height || 0) - (a.height || 0))[0];
}
function applyMimeTypeFilter(formats, mimeTypePart) {
    return formats.filter((format) => format.mimeType?.includes(mimeTypePart));
}
//# sourceMappingURL=sabrStreamUtils.js.map