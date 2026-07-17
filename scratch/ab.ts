/**
 * A/B timing harness: measures time from sabrStream.start() to first audio
 * byte for different flow variants, to isolate what triggers YouTube's SABR
 * backoff (fake buffering) on the StandaloneServer but not on lib-origin.
 *
 * Env flags:
 *   VIDEO_ID        (default GieQq3eWSnE)
 *   INIT_TOKEN      'real' | 'placeholder'   (what poToken SabrStream gets at init)
 *   INLINE_NO_AD    '1' | '0'                (isInlinePlaybackNoAd in playbackContext)
 *   CLIENT_OVERRIDE '1' | '0'                (pass client:'WEB' to the player call)
 *   LABEL           free-form label for the report line
 */
import { Constants, Innertube, Platform, YTNodes, type ClientType } from 'youtubei.js';
import type { IPlayerResponse, Types } from 'youtubei.js';
import { SabrStream } from 'googlevideo/sabr-stream';
import { EnabledTrackTypes, buildSabrFormat, Logger, LogLevel } from 'googlevideo/utils';
import type { SabrFormat } from 'googlevideo/shared-types';
import { generateWebPoToken } from '../src/webpo-helper.js';

const VIDEO_ID = process.env.VIDEO_ID ?? 'GieQq3eWSnE';
const INIT_TOKEN = (process.env.INIT_TOKEN ?? 'real') as 'real' | 'placeholder';
const INLINE_NO_AD = process.env.INLINE_NO_AD !== '0';
const CLIENT_OVERRIDE = process.env.CLIENT_OVERRIDE !== '0';
const CLIENT_VERSION = process.env.CLIENT_VERSION; // e.g. 2.20260206.01.00 to mimic youtubei.js 17.0.1
const BROWSER_HEADERS = process.env.BROWSER_HEADERS === '1'; // origin/referer/UA on SABR fetch
const IGNORE_BACKOFF = process.env.IGNORE_BACKOFF === '1'; // zero out server backoffTimeMs
const PLAYER_CLIENT = process.env.PLAYER_CLIENT; // e.g. WEB_EMBEDDED / TV — client for the player request
const SLEEP_AFTER_PLAYER = Number(process.env.SLEEP_AFTER_PLAYER ?? 0); // ms to wait between player response and sabr start
const LABEL = process.env.LABEL ?? 'unlabeled';

// Same shim the server installs (needed for decipher in Node).
Platform.shim.eval = async (data: Types.BuildScriptResult, env: Record<string, Types.VMPrimative>) => {
  const properties: string[] = [];
  if (env.n) properties.push(`n: exportedVars.nFunction("${env.n}")`);
  if (env.sig) properties.push(`sig: exportedVars.sigFunction("${env.sig}")`);
  const code = `${data.output}\nreturn { ${properties.join(', ')} }`;
  return new Function(code)();
};

Logger.getInstance().setLogLevels(LogLevel.ALL);

if (IGNORE_BACKOFF) {
  const proto = SabrStream.prototype as any;
  const orig = proto.handleNextRequestPolicy;
  proto.handleNextRequestPolicy = function (...args: unknown[]) {
    const r = orig.apply(this, args);
    if (this.nextRequestPolicy?.backoffTimeMs) {
      console.log(`[patch] zeroing server backoffTimeMs=${this.nextRequestPolicy.backoffTimeMs}`);
      this.nextRequestPolicy.backoffTimeMs = 0;
    }
    return r;
  };
}

const t0 = Date.now();
const mark = (name: string) => console.log(`[timing] ${name}: +${Date.now() - t0}ms`);

async function main() {
  console.log(`[cfg] label=${LABEL} video=${VIDEO_ID} initToken=${INIT_TOKEN} inlineNoAd=${INLINE_NO_AD} clientOverride=${CLIENT_OVERRIDE}`);

  const innertube = await Innertube.create({ client_type: 'WEB' as ClientType });
  if (CLIENT_VERSION) {
    innertube.session.context.client.clientVersion = CLIENT_VERSION;
    console.log(`[cfg] overriding clientVersion -> ${CLIENT_VERSION}`);
  }
  mark('innertube created');

  const webPo = await generateWebPoToken(innertube, VIDEO_ID);
  mark('potoken generated');

  const contentPlaybackContext: Record<string, unknown> = {
    vis: 0,
    splay: false,
    lactMilliseconds: '-1',
    signatureTimestamp: innertube.session.player?.signature_timestamp
  };
  if (INLINE_NO_AD) contentPlaybackContext.isInlinePlaybackNoAd = true;

  const watchEndpoint = new YTNodes.NavigationEndpoint({
    watchEndpoint: { videoId: VIDEO_ID, racyCheckOk: true, contentCheckOk: true }
  });
  const callArgs: Record<string, unknown> = {
    playbackContext: { contentPlaybackContext },
    parse: true
  };
  if (PLAYER_CLIENT) callArgs.client = PLAYER_CLIENT;
  else if (CLIENT_OVERRIDE) callArgs.client = 'WEB';
  const playerResponse = await watchEndpoint.call<IPlayerResponse>(innertube.actions, callArgs as any);
  mark('player response');

  if (!playerResponse.streaming_data?.server_abr_streaming_url) {
    throw new Error('no server_abr_streaming_url');
  }

  // Log whether the response contains ad placements (candidate backoff trigger).
  const raw = (playerResponse as any).page?.[0] ?? playerResponse;
  const hasAdPlacements = JSON.stringify(raw?.adPlacements ?? raw?.ad_placements ?? null) !== 'null';
  const hasAdSlots = JSON.stringify(raw?.adSlots ?? raw?.ad_slots ?? null) !== 'null';
  console.log(`[info] adPlacements=${hasAdPlacements} adSlots=${hasAdSlots}`);

  const serverAbrStreamingUrl = await innertube.session.player?.decipher(
    playerResponse.streaming_data.server_abr_streaming_url
  );
  const videoPlaybackUstreamerConfig =
    playerResponse.player_config?.media_common_config?.media_ustreamer_request_config
      ?.video_playback_ustreamer_config;
  if (!serverAbrStreamingUrl || !videoPlaybackUstreamerConfig) throw new Error('missing sabr params');
  mark('deciphered url');

  const sabrFormats: SabrFormat[] =
    playerResponse.streaming_data?.adaptive_formats.map(buildSabrFormat) || [];

  const sabrFetch: typeof fetch = async (input, init) => {
    return fetch(input, {
      ...init,
      headers: {
        ...((init?.headers as Record<string, string>) ?? {}),
        origin: 'https://www.youtube.com',
        referer: 'https://www.youtube.com/',
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36'
      }
    });
  };

  const sabrStream = new SabrStream({
    formats: sabrFormats,
    serverAbrStreamingUrl,
    videoPlaybackUstreamerConfig,
    ...(BROWSER_HEADERS ? { fetch: sabrFetch } : {}),
    poToken: INIT_TOKEN === 'real' ? webPo.poToken : webPo.placeholderPoToken,
    clientInfo:
      process.env.CLIENT_INFO_REMIX === '1'
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
          }
  });

  let realApplied = INIT_TOKEN === 'real';
  sabrStream.on('streamProtectionStatusUpdate', (status: any) => {
    console.log(`[sps] status=${status?.status} +${Date.now() - t0}ms`);
    if (status?.status === 2 && !realApplied) {
      realApplied = true;
      sabrStream.setPoToken(webPo.poToken);
      console.log(`[sps] real poToken applied +${Date.now() - t0}ms`);
    }
  });

  if (SLEEP_AFTER_PLAYER > 0) {
    console.log(`[cfg] sleeping ${SLEEP_AFTER_PLAYER}ms before sabr start()`);
    await new Promise((r) => setTimeout(r, SLEEP_AFTER_PLAYER));
  }

  const tStart = Date.now();
  mark('sabr start() called');
  const { audioStream } = await sabrStream.start({
    enabledTrackTypes: EnabledTrackTypes.AUDIO_ONLY,
    preferOpus: true
  });
  mark('sabr start() resolved');

  const READ_BYTES = Number(process.env.READ_BYTES ?? 256 * 1024);
  const reader = audioStream.getReader();
  let received = 0;
  let firstByteMs: number | null = null;
  while (received < READ_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value || value.byteLength === 0) continue;
    if (firstByteMs === null) {
      firstByteMs = Date.now() - tStart;
      mark('FIRST AUDIO BYTE');
    }
    received += value.byteLength;
  }
  const t256 = Date.now() - tStart;
  console.log(`[result] label=${LABEL} initToken=${INIT_TOKEN} inlineNoAd=${INLINE_NO_AD} clientOverride=${CLIENT_OVERRIDE} firstByteAfterStartMs=${firstByteMs} bytes256kMs=${t256}`);
  try { sabrStream.abort(); } catch { /* ignore */ }
  // reader may reject after abort; swallow and exit.
  process.exit(0);
}

main().catch((e) => {
  console.error('[fatal]', e);
  process.exit(1);
});
