import { BG, buildURL, GOOG_API_KEY, USER_AGENT, type WebPoSignalOutput } from 'bgutils-js';
import type { Innertube } from 'youtubei.js';
import { JSDOM } from 'jsdom';

const REQUEST_KEY = 'O43z0dpjhgX20SCx4KAo';

let botguardEnvSetup = false;

/**
 * Sets up the global DOM environment BotGuard's VM expects. Only done once.
 * Mirrors the original lib-origin node_potoken implementation.
 */
function setupBotguardEnvironment(): void {
  if (botguardEnvSetup) return;

  const dom = new JSDOM(
    '<!DOCTYPE html><html lang="en"><head><title></title></head><body></body></html>',
    {
      url: 'https://www.youtube.com/',
      referrer: 'https://www.youtube.com/',
      userAgent: USER_AGENT
    }
  );

  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    location: dom.window.location,
    origin: dom.window.origin
  });

  if (!Reflect.has(globalThis, 'navigator')) {
    Object.defineProperty(globalThis, 'navigator', {
      value: dom.window.navigator
    });
  }

  // jsdom doesn't implement canvas; stub getContext so BotGuard's VM doesn't throw.
  Object.defineProperty(dom.window.HTMLCanvasElement.prototype, 'getContext', {
    value: () => null,
    writable: true
  });

  botguardEnvSetup = true;
}

// ---------------------------------------------------------------------------
// Cached WebPoMinter (the expensive part — created once, reused forever)
// ---------------------------------------------------------------------------

/**
 * A cached WebPoMinter plus the visitorData of the Innertube session it was
 * created with. The minter itself is cheap to reuse: `mintAsWebsafeString(id)`
 * is a local cryptographic operation with no network I/O. The expensive parts
 * (BotGuard challenge fetch, interpreter download/execution, snapshot, and
 * integrity-token exchange) only happen once during `initWebPoMinter()`.
 *
 * This mirrors the official googlevideo SABR Shaka example, which creates a
 * `BotguardService` singleton and reuses its `integrityTokenBasedMinter` for
 * every subsequent video, minting a fresh per-video PoToken from it each time.
 */
interface CachedMinter {
  minter: InstanceType<typeof BG.WebPoMinter>;
  /** visitorData of the Innertube session the minter was created with. */
  visitorData: string;
}

let cachedMinter: CachedMinter | undefined;
let minterInitPromise: Promise<CachedMinter> | undefined;

/**
 * Creates the WebPoMinter by solving a BotGuard challenge from YouTube's
 * attestation API and exchanging it for an integrity token. This is the
 * expensive operation (multiple network round-trips + VM execution) and is
 * only performed once; subsequent calls reuse the cached minter.
 *
 * The `visitorData` from the supplied Innertube session is embedded in the
 * challenge flow, so the same Innertube instance (or at least one with the
 * same visitorData) must be used for the player request.
 */
async function initWebPoMinter(innertube: Innertube): Promise<CachedMinter> {
  setupBotguardEnvironment();

  const visitorData = innertube.session.context.client.visitorData as string | undefined;
  if (!visitorData) {
    throw new Error('No visitorData on the Innertube session.');
  }

  // Acquire the BotGuard challenge from YouTube's attestation API.
  const challengeResponse = await innertube.getAttestationChallenge('ENGAGEMENT_TYPE_UNBOUND');

  if (!challengeResponse.bg_challenge) {
    throw new Error('Could not get BotGuard challenge');
  }

  let interpreterUrl: string =
    challengeResponse.bg_challenge.interpreter_url
      .private_do_not_access_or_else_trusted_resource_url_wrapped_value ?? '';

  if (!interpreterUrl) {
    throw new Error('Could not get interpreter URL from BotGuard challenge');
  }

  if (interpreterUrl.startsWith('//')) {
    interpreterUrl = `https:${interpreterUrl}`;
  }

  // Fetch and execute the BotGuard interpreter script.
  const bgScriptResponse = await fetch(interpreterUrl);
  const interpreterJavascript = await bgScriptResponse.text();

  if (!interpreterJavascript) {
    throw new Error('Could not load VM');
  }

  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  new Function(interpreterJavascript)();

  const botguard = await BG.BotGuardClient.create({
    program: challengeResponse.bg_challenge.program,
    globalName: challengeResponse.bg_challenge.global_name,
    globalObj: globalThis
  });

  const webPoSignalOutput: WebPoSignalOutput = [];
  const botguardResponse = await botguard.snapshot({ webPoSignalOutput });

  // Request an integrity token from YouTube.
  const integrityTokenResponse = await fetch(buildURL('GenerateIT', true), {
    method: 'POST',
    headers: {
      'content-type': 'application/json+protobuf',
      'x-goog-api-key': GOOG_API_KEY,
      'x-user-agent': 'grpc-web-javascript/0.1',
      'user-agent': USER_AGENT
    },
    body: JSON.stringify([REQUEST_KEY, botguardResponse])
  });

  const integrityTokenData = (await integrityTokenResponse.json()) as unknown[];

  if (typeof integrityTokenData[0] !== 'string') {
    throw new Error('Could not get integrity token');
  }

  const webPoMinter = await BG.WebPoMinter.create(
    { integrityToken: integrityTokenData[0] },
    webPoSignalOutput
  );

  return { minter: webPoMinter, visitorData };
}

/**
 * Returns the cached WebPoMinter, creating it on first use. Concurrent callers
 * share the same initialization promise so the expensive BotGuard flow only
 * runs once even if multiple streams start simultaneously.
 */
export async function getWebPoMinter(innertube: Innertube): Promise<CachedMinter> {
  if (cachedMinter) return cachedMinter;
  if (minterInitPromise) return minterInitPromise;

  minterInitPromise = initWebPoMinter(innertube).then((result) => {
    cachedMinter = result;
    minterInitPromise = undefined;
    console.log('[webpo] WebPoMinter initialized and cached; subsequent streams will reuse it');
    return result;
  }).catch((e) => {
    minterInitPromise = undefined;
    throw e;
  });

  return minterInitPromise;
}

/**
 * Drops the cached WebPoMinter, forcing the next `getWebPoMinter()` call to
 * pay the full BotGuard challenge + integrity-token cost again. Used when a
 * long-lived session appears to have gone stale (e.g. the WEB player stops
 * returning `server_abr_streaming_url` — see sabr-stream-factory.ts) so the
 * server can self-heal by starting a fresh session instead of requiring a
 * manual restart.
 */
export function resetWebPoMinter(): void {
  cachedMinter = undefined;
  minterInitPromise = undefined;
}

// ---------------------------------------------------------------------------
// Per-video PoToken minting (the cheap part — local crypto, no network)
// ---------------------------------------------------------------------------

/**
 * Mints a Web Proof-of-Origin (PoToken) for the given video id, reusing the
 * cached WebPoMinter. The token is bound to the video id (the
 * `contentBinding`/`identifier` passed to `mintAsWebsafeString`), which
 * matches what the official googlevideo examples do.
 *
 * This is cheap: it's a local cryptographic operation with no network
 * round-trips. The expensive BotGuard challenge + integrity-token exchange
 * happened once when the minter was first created.
 *
 * @param innertube - The Innertube instance (must have the same visitorData
 *   as the one used to create the minter; use `getStreamingInnertube()`).
 * @param videoId - The video id to bind the token to.
 */
export async function generateWebPoToken(
  innertube: Innertube,
  videoId: string
): Promise<{
  visitorData: string;
  placeholderPoToken: string;
  poToken: string;
}> {
  const { minter, visitorData } = await getWebPoMinter(innertube);

  const poToken = await minter.mintAsWebsafeString(videoId);

  // generateColdStartToken throws if the identifier > 118 UTF-8 bytes.
  // The video id is always short, so this is safe.
  const placeholderPoToken = BG.PoToken.generateColdStartToken(videoId);

  return {
    visitorData,
    placeholderPoToken,
    poToken
  };
}
