import { Constants, Innertube, Platform, UniversalCache } from 'youtubei.js';
import { generateWebPoToken } from './webpo-helper.js';
import { SabrStream } from 'googlevideo/sabr-stream';
import { buildSabrFormat } from 'googlevideo/utils';
/**
 * youtubei.js ships a small JS VM (Platform.shim.eval) used to decipher
 * signature/n tokens. In the browser it uses an iframe; in Node we evaluate
 * the generated code with `new Function`. This is exactly what the official
 * googlevideo downloader example does.
 */
Platform.shim.eval = async (data, env) => {
    const properties = [];
    if (env.n) {
        properties.push(`n: exportedVars.nFunction("${env.n}")`);
    }
    if (env.sig) {
        properties.push(`sig: exportedVars.sigFunction("${env.sig}")`);
    }
    const code = `${data.output}\nreturn { ${properties.join(', ')} }`;
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
    return new Function(code)();
};
/**
 * Builds a configured SabrStream for the given video and returns the audio
 * ReadableStream plus metadata. The caller is responsible for reading the
 * stream.
 */
export async function createSabrAudioStream(videoId, options) {
    // Use the WEB client for everything: it returns a BotGuard attestation
    // challenge (required for PoToken generation) AND provides playable
    // streaming data via getInfo(). The ANDROID client does not return a
    // BotGuard challenge, so it can't be used for PoToken generation.
    // NOTE: do NOT use the MUSIC client — it breaks PoToken generation.
    const innertube = await Innertube.create({
        cache: new UniversalCache(true),
        client_type: 'WEB'
    });
    // Generate the Web PoToken using YouTube's own attestation challenge
    // (innertube.getAttestationChallenge), bound to the video id. This is the
    // same approach the original lib-origin used and produces a token the SABR
    // backend accepts.
    const webPoTokenResult = await generateWebPoToken(innertube, videoId);
    // Use getInfo() (not a raw player request) — it includes the extra
    // parameters needed for the WEB client to return playable streaming data.
    const info = await innertube.getInfo(videoId);
    const videoTitle = info.basic_info?.title || 'Unknown Video';
    const durationMs = (info.basic_info?.duration ?? 0) * 1000;
    const serverAbrStreamingUrl = await innertube.session.player?.decipher(info.streaming_data?.server_abr_streaming_url);
    const videoPlaybackUstreamerConfig = info.player_config?.media_common_config?.media_ustreamer_request_config
        ?.video_playback_ustreamer_config;
    if (!videoPlaybackUstreamerConfig) {
        throw new Error('ustreamerConfig not found');
    }
    if (!serverAbrStreamingUrl) {
        throw new Error('serverAbrStreamingUrl not found');
    }
    const sabrFormats = info.streaming_data?.adaptive_formats.map(buildSabrFormat) || [];
    const sabrStream = new SabrStream({
        formats: sabrFormats,
        serverAbrStreamingUrl,
        videoPlaybackUstreamerConfig,
        // Pass the real PoToken up front (same as the official googlevideo
        // downloader example). The placeholder is kept as a fallback.
        poToken: webPoTokenResult.poToken || webPoTokenResult.placeholderPoToken,
        clientInfo: {
            clientName: parseInt(Constants.CLIENT_NAME_IDS[innertube.session.context.client.clientName]),
            clientVersion: innertube.session.context.client.clientVersion
        }
    });
    // If the stream signals protection status 2 (attestation pending) after
    // starting, refresh and re-apply the PoToken.
    sabrStream.on('streamProtectionStatusUpdate', async (status) => {
        if (status?.status !== 2)
            return;
        try {
            const refreshed = await generateWebPoToken(innertube, videoId);
            if (refreshed.poToken) {
                sabrStream.setPoToken(refreshed.poToken);
            }
        }
        catch (e) {
            console.error('[SABR] Failed to refresh poToken on SPS=2:', e);
        }
    });
    // Handle player response reload events (e.g. when IP changes or formats expire).
    sabrStream.on('reloadPlayerResponse', async (reloadPlaybackContext) => {
        try {
            const newInfo = await innertube.getInfo(videoId);
            const newUrl = await innertube.session.player?.decipher(newInfo.streaming_data?.server_abr_streaming_url);
            const newConfig = newInfo.player_config?.media_common_config?.media_ustreamer_request_config
                ?.video_playback_ustreamer_config;
            if (newUrl && newConfig) {
                sabrStream.setStreamingURL(newUrl);
                sabrStream.setUstreamerConfig(newConfig);
            }
        }
        catch (e) {
            console.error('[SABR] Failed to reload player response:', e);
        }
    });
    const { audioStream, selectedFormats } = await sabrStream.start(options);
    return {
        innertube,
        sabrStream,
        streamResults: {
            audioStream,
            selectedFormats: {
                audioFormat: selectedFormats.audioFormat
            },
            videoTitle,
            durationMs
        }
    };
}
//# sourceMappingURL=sabr-stream-factory.js.map