import { Constants, Innertube, type ClientType, Platform, UniversalCache } from 'youtubei.js';
import type { Types } from 'youtubei.js';

import { generateWebPoToken } from './webpo-helper.js';
import type { SabrFormat } from 'googlevideo/shared-types';
import type { ReloadPlaybackContext } from 'googlevideo/protos';
import { SabrStream, type SabrPlaybackOptions } from 'googlevideo/sabr-stream';
import { buildSabrFormat } from 'googlevideo/utils';

/**
 * youtubei.js ships a small JS VM (Platform.shim.eval) used to decipher
 * signature/n tokens. In the browser it uses an iframe; in Node we evaluate
 * the generated code with `new Function`. This is exactly what the official
 * googlevideo downloader example does.
 */
Platform.shim.eval = async (
  data: Types.BuildScriptResult,
  env: Record<string, Types.VMPrimative>
) => {
  const properties: string[] = [];

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

export interface StreamResults {
  audioStream: ReadableStream<Uint8Array>;
  selectedFormats: {
    audioFormat: SabrFormat;
  };
  videoTitle: string;
  durationMs: number;
}

/**
 * A lazily-initialized, shared WEB Innertube instance used for all SABR
 * streams. This is critical: the `visitorData` on this session must match the
 * `visitorData` used to create the cached WebPoMinter (see `webpo-helper.ts`).
 * If each stream created its own Innertube instance, each would have a
 * different `visitorData`, and the PoToken (which is tied to the minter's
 * session) would not match the player request — causing SABR to stall.
 *
 * This mirrors the official googlevideo SABR Shaka example, which creates one
 * Innertube instance and reuses it for every video.
 */
let streamingInnertube: Innertube | undefined;

async function getStreamingInnertube(): Promise<Innertube> {
  if (streamingInnertube) return streamingInnertube;
  streamingInnertube = await Innertube.create({
    cache: new UniversalCache(true),
    client_type: 'WEB' as ClientType
  });
  return streamingInnertube;
}

/**
 * Builds a configured SabrStream for the given video and returns the audio
 * ReadableStream plus metadata. The caller is responsible for reading the
 * stream.
 *
 * Uses a shared WEB Innertube instance (so visitorData is consistent with the
 * cached WebPoMinter) and the cached minter for PoToken generation. Only the
 * first stream pays the BotGuard challenge + integrity-token cost; subsequent
 * streams just mint a cheap per-video PoToken from the cached minter.
 */
export async function createSabrAudioStream(
  videoId: string,
  options: SabrPlaybackOptions
): Promise<{
  innertube: Innertube;
  streamResults: StreamResults;
  sabrStream: SabrStream;
}> {
  // Use the WEB client for everything: it returns a BotGuard attestation
  // challenge (required for PoToken generation) AND provides playable
  // streaming data via getInfo(). The ANDROID client does not return a
  // BotGuard challenge, so it can't be used for PoToken generation.
  // NOTE: do NOT use the MUSIC client — it breaks PoToken generation.
  const innertube = await getStreamingInnertube();

  // Generate the Web PoToken. This reuses the cached WebPoMinter (created
  // once on first use) and just mints a per-video token — cheap, no network.
  const webPoTokenResult = await generateWebPoToken(innertube, videoId);

  // Use getBasicInfo() instead of getInfo() — getInfo() makes TWO API calls
  // (watch + watch_next) and waits for both via Promise.all. The watch_next
  // response (related videos, comments, etc.) is unnecessary for streaming and
  // adds latency. getBasicInfo() makes only the single watch call, which is
  // ~40-50% faster. We pass the PoToken in the player request so YouTube's
  // SABR backend sees it from the start.
  const info = await innertube.getBasicInfo(videoId, {
    client: 'WEB',
    po_token: webPoTokenResult.poToken
  });
  const videoTitle = info.basic_info?.title || 'Unknown Video';
  const durationMs = (info.basic_info?.duration ?? 0) * 1000;

  const serverAbrStreamingUrl = await innertube.session.player?.decipher(
    info.streaming_data?.server_abr_streaming_url
  );
  const videoPlaybackUstreamerConfig =
    info.player_config?.media_common_config?.media_ustreamer_request_config
      ?.video_playback_ustreamer_config;

  if (!videoPlaybackUstreamerConfig) {
    throw new Error('ustreamerConfig not found');
  }
  if (!serverAbrStreamingUrl) {
    throw new Error('serverAbrStreamingUrl not found');
  }

  const sabrFormats: SabrFormat[] =
    info.streaming_data?.adaptive_formats.map(buildSabrFormat) || [];

  const sabrStream = new SabrStream({
    formats: sabrFormats,
    serverAbrStreamingUrl,
    videoPlaybackUstreamerConfig,
    // Pass the real PoToken up front (same as the official googlevideo
    // downloader example). The placeholder is kept as a fallback.
    poToken: webPoTokenResult.poToken || webPoTokenResult.placeholderPoToken,
    clientInfo: {
      clientName: parseInt(
        Constants.CLIENT_NAME_IDS[
          innertube.session.context.client.clientName as keyof typeof Constants.CLIENT_NAME_IDS
        ]
      ),
      clientVersion: innertube.session.context.client.clientVersion
    }
  });

  // If the stream signals protection status 2 (attestation pending) after
  // starting, refresh and re-apply the PoToken.
  sabrStream.on('streamProtectionStatusUpdate', async (status: { status?: number }) => {
    if (status?.status !== 2) return;
    try {
      const refreshed = await generateWebPoToken(innertube, videoId);
      if (refreshed.poToken) {
        sabrStream.setPoToken(refreshed.poToken);
      }
    } catch (e) {
      console.error('[SABR] Failed to refresh poToken on SPS=2:', e);
    }
  });

  // Handle player response reload events (e.g. when IP changes or formats expire).
  sabrStream.on('reloadPlayerResponse', async (reloadPlaybackContext: ReloadPlaybackContext) => {
    try {
      const newInfo = await innertube.getBasicInfo(videoId, {
        client: 'WEB',
        po_token: webPoTokenResult.poToken
      });
      const newUrl = await innertube.session.player?.decipher(
        newInfo.streaming_data?.server_abr_streaming_url
      );
      const newConfig =
        newInfo.player_config?.media_common_config?.media_ustreamer_request_config
          ?.video_playback_ustreamer_config;

      if (newUrl && newConfig) {
        sabrStream.setStreamingURL(newUrl);
        sabrStream.setUstreamerConfig(newConfig);
      }
    } catch (e) {
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
