import { Constants, Innertube, type ClientType, Platform, UniversalCache, YTNodes } from 'youtubei.js';
import type { IPlayerResponse, Types } from 'youtubei.js';

import { generateWebPoToken, resetWebPoMinter } from './webpo-helper.js';
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
 * Drops the cached WEB Innertube session (and the WebPoMinter tied to its
 * visitorData — see the module doc comment above) so the next call starts
 * completely fresh. Used when the session appears to have gone stale after
 * running for a long time (observed: the WEB player stops returning
 * `server_abr_streaming_url` in its response, even though the request
 * itself succeeds) — a manual server restart would fix it, but this lets
 * the server self-heal instead.
 */
function resetStreamingInnertube(): void {
  streamingInnertube = undefined;
  resetWebPoMinter();
}

/**
 * Content-playback context sent with every player request. `isInlinePlaybackNoAd`
 * is documented (as of the field's discovery in mid-2025, see
 * https://iter.ca/post/yt-adblock/) to tell YouTube's backend not to inject
 * ads for this playback session. In practice (verified empirically against
 * this codebase) it does not prevent the WEB-client SABR backoff described
 * below; it is kept on the chance it still has partial effect.
 *
 * About that backoff: playback sessions created by the signed-out desktop
 * WEB client get a server-directed `NEXT_REQUEST_POLICY.backoffTimeMs`
 * (observed: a constant 4000ms) plus a SABR context update (type 5) on the
 * first segment request of every stream — YouTube's anti-adblock "fake
 * buffering" simulating ad time. Verified properties (July 2026):
 *   - It is a wall-clock countdown enforced server-side and anchored to the
 *     FIRST segment request. Ignoring `backoffTimeMs` and re-requesting just
 *     returns the remaining countdown (4000 → 3864 → … → 34ms) with no media
 *     until it expires, so it must not be bypassed client-side. Delaying the
 *     SABR start after the player request does not help either — the timer
 *     only starts on the first segment request.
 *   - It is unaffected by the PoToken passed at init (real vs cold-start
 *     placeholder), browser-like headers on the SABR fetch, the pinned
 *     youtubei.js clientVersion, or this playback-context field.
 *   - It does NOT apply to playback sessions created by the YTMUSIC
 *     (WEB_REMIX) or TV clients — hence the client order in
 *     STREAMING_PLAYER_CLIENTS below, which eliminates the delay for music
 *     content. Only the WEB fallback path still pays the ~4s cost.
 */
function buildContentPlaybackContext(innertube: Innertube) {
  return {
    vis: 0,
    splay: false,
    lactMilliseconds: '-1',
    signatureTimestamp: innertube.session.player?.signature_timestamp,
    isInlinePlaybackNoAd: true
  };
}

/**
 * Clients tried for the streaming player request, in order. YTMUSIC first:
 * playback sessions created by the YouTube Music web client (WEB_REMIX) are
 * not subject to the ~4s WEB-client startup backoff (see
 * buildContentPlaybackContext docs), so audio starts near-instantly. WEB is
 * kept as a fallback for content the Music client won't serve (e.g. regular
 * non-music videos, whose YTMUSIC player response comes back without
 * `server_abr_streaming_url`).
 *
 * Note this only switches the client on the player request itself — the
 * Innertube session and the WebPoMinter stay WEB. (Creating the whole session
 * as YTMUSIC would break PoToken generation: the Music client returns no
 * BotGuard attestation challenge.) Attestation still passes on the YTMUSIC
 * path: streamProtectionStatus stays 1 with the WEB-session-minted PoToken.
 */
const STREAMING_PLAYER_CLIENTS: Types.InnerTubeClient[] = ['YTMUSIC', 'WEB'];

interface StreamingPlayerResult {
  playerResponse: IPlayerResponse;
  client: Types.InnerTubeClient;
}

/**
 * Fetches a player response for streaming, trying each client in
 * STREAMING_PLAYER_CLIENTS until one returns a `server_abr_streaming_url`
 * (`preferredClient`, when given, is tried first — used on reloads to stick
 * with the client that created the original playback session).
 *
 * Uses a raw player request via NavigationEndpoint.call instead of
 * getBasicInfo(). Both produce the same player response, but getBasicInfo()
 * causes an additional ~4 second server-side delay in YouTube's SABR backend
 * (a bandwidth-estimation probe before it sends audio data).
 *
 * If no client returns a streaming URL, the last obtained response is
 * returned anyway so the caller can run its stale-session self-heal; throws
 * only if every request itself failed.
 */
async function fetchStreamingPlayerResponse(
  innertube: Innertube,
  videoId: string,
  preferredClient?: Types.InnerTubeClient,
  reloadPlaybackContext?: ReloadPlaybackContext
): Promise<StreamingPlayerResult> {
  const clients = preferredClient
    ? [preferredClient, ...STREAMING_PLAYER_CLIENTS.filter((c) => c !== preferredClient)]
    : STREAMING_PLAYER_CLIENTS;

  let lastResult: StreamingPlayerResult | undefined;
  let lastError: unknown;

  for (const client of clients) {
    const watchEndpoint = new YTNodes.NavigationEndpoint({
      watchEndpoint: {
        videoId,
        racyCheckOk: true,
        contentCheckOk: true
      }
    });
    const playbackContext: Record<string, unknown> = {
      contentPlaybackContext: buildContentPlaybackContext(innertube)
    };
    if (reloadPlaybackContext) playbackContext.reloadPlaybackContext = reloadPlaybackContext;

    try {
      const playerResponse = await watchEndpoint.call<IPlayerResponse>(innertube.actions, {
        playbackContext,
        client,
        parse: true
      });
      lastResult = { playerResponse, client };
      if (playerResponse.streaming_data?.server_abr_streaming_url) return lastResult;
      console.warn(
        `[SABR] [${videoId}] ${client} player response has no server_abr_streaming_url`
      );
    } catch (e) {
      lastError = e;
      console.warn(
        `[SABR] [${videoId}] ${client} player request failed:`,
        e instanceof Error ? e.message : e
      );
    }
  }

  if (!lastResult) {
    throw lastError instanceof Error
      ? lastError
      : new Error(String(lastError ?? 'All streaming player requests failed'));
  }
  return lastResult;
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
  options: SabrPlaybackOptions,
  isRetryAfterSessionReset = false
): Promise<{
  innertube: Innertube;
  streamResults: StreamResults;
  sabrStream: SabrStream;
}> {
  // The Innertube session stays WEB: it returns a BotGuard attestation
  // challenge (required for PoToken generation). The ANDROID client does not
  // return a BotGuard challenge, and a MUSIC *session* breaks PoToken
  // generation too — only the player request below switches clients.
  const innertube = await getStreamingInnertube();

  // Generate the Web PoToken. This reuses the cached WebPoMinter (created
  // once on first use) and just mints a per-video token — cheap, no network.
  const webPoTokenResult = await generateWebPoToken(innertube, videoId);

  // Player request: YTMUSIC first (no ~4s startup backoff), WEB fallback.
  const { playerResponse, client: playerClient } = await fetchStreamingPlayerResponse(
    innertube,
    videoId
  );

  // A long-lived WEB session can go stale and stop returning streaming URLs
  // even though the request itself succeeds (observed after sustained use).
  // Self-heal once: drop the cached session/minter and retry with a
  // completely fresh one, instead of surfacing an opaque decipher error.
  if (!playerResponse.streaming_data?.server_abr_streaming_url) {
    if (isRetryAfterSessionReset) {
      throw new Error('serverAbrStreamingUrl not found (still missing after session refresh)');
    }
    console.warn(
      `[SABR] [${videoId}] server_abr_streaming_url missing from player response — ` +
        'session looks stale, resetting and retrying once'
    );
    resetStreamingInnertube();
    return createSabrAudioStream(videoId, options, true);
  }

  const videoTitle = playerResponse.video_details?.title || 'Unknown Video';
  const durationMs = (playerResponse.video_details?.duration ?? 0) * 1000;

  const serverAbrStreamingUrl = await innertube.session.player?.decipher(
    playerResponse.streaming_data.server_abr_streaming_url
  );
  const videoPlaybackUstreamerConfig =
    playerResponse.player_config?.media_common_config?.media_ustreamer_request_config
      ?.video_playback_ustreamer_config;

  if (!videoPlaybackUstreamerConfig) {
    throw new Error('ustreamerConfig not found');
  }
  if (!serverAbrStreamingUrl) {
    throw new Error('serverAbrStreamingUrl not found');
  }

  const sabrFormats: SabrFormat[] =
    playerResponse.streaming_data?.adaptive_formats.map(buildSabrFormat) || [];

  // clientInfo must describe the client that created the playback session
  // (i.e. the one used for the player request), not the session's client.
  const clientInfo =
    playerClient === 'YTMUSIC'
      ? {
          clientName: parseInt(Constants.CLIENT_NAME_IDS.WEB_REMIX),
          clientVersion: Constants.CLIENTS.YTMUSIC.VERSION
        }
      : {
          clientName: parseInt(
            Constants.CLIENT_NAME_IDS[
              innertube.session.context.client.clientName as keyof typeof Constants.CLIENT_NAME_IDS
            ]
          ),
          clientVersion: innertube.session.context.client.clientVersion
        };

  const sabrStream = new SabrStream({
    formats: sabrFormats,
    serverAbrStreamingUrl,
    videoPlaybackUstreamerConfig,
    // Pass the real PoToken up front (same as the official googlevideo
    // downloader example). The placeholder is kept as a fallback.
    poToken: webPoTokenResult.poToken || webPoTokenResult.placeholderPoToken,
    clientInfo
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
      const { playerResponse: newInfo } = await fetchStreamingPlayerResponse(
        innertube,
        videoId,
        playerClient,
        reloadPlaybackContext
      );
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
