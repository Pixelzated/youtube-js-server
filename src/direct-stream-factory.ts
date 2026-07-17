import { Constants, Innertube, type ClientType, UniversalCache } from 'youtubei.js';
import type { SabrFormat } from 'googlevideo/shared-types';
import { buildSabrFormat } from 'googlevideo/utils';

import type { StreamResults } from './sabr-stream-factory.js';

/**
 * Experimental alternative to the SABR pipeline (see sabr-stream-factory.ts).
 * The IOS client gets a pre-signed, directly-fetchable adaptive format URL
 * instead of a `server_abr_streaming_url` requiring the SABR POST protocol —
 * no PoToken/BotGuard flow, no server-directed backoff. IOS only offers AAC
 * audio (no Opus). This is opt-in (see the `engine=ios` query param on
 * /stream/:id) so it can be compared directly against the default SABR path.
 *
 * IMPORTANT: these URLs must be fetched with explicit `Range` headers, never
 * a single unranged GET. Verified empirically: an unranged GET of the whole
 * file gets throttled to ~32 KB/s after a brief initial burst (a real player
 * never requests a whole file in one shot, so this looks like scraping to
 * whatever's rate-limiting it); the exact same file fetched as a sequence of
 * ~1MB Range requests is served at full CDN speed (~2.7-3 MB/s, no throttle
 * observed). We fetch in RANGE_CHUNK_SIZE pieces for this reason, not for
 * parallelism — sequential range-chunked fetches alone were enough to avoid
 * the throttle entirely in testing.
 */
let directInnertube: Innertube | undefined;

async function getDirectInnertube(): Promise<Innertube> {
  if (directInnertube) return directInnertube;
  directInnertube = await Innertube.create({
    cache: new UniversalCache(true),
    client_type: 'IOS' as ClientType
  });
  return directInnertube;
}

/**
 * Drops the cached IOS Innertube session, forcing the next call to start
 * completely fresh. Same rationale as sabr-stream-factory.ts's
 * resetStreamingInnertube(): a long-lived session can go stale after
 * sustained use (observed: getBasicInfo() failing outright, or succeeding
 * but with no usable audio formats) — this lets the server self-heal
 * instead of requiring a manual restart.
 */
function resetDirectInnertube(): void {
  directInnertube = undefined;
}

interface ResolvedFormat {
  url: string;
  contentLength: number;
  videoTitle: string;
  durationMs: number;
  sabrFormat: SabrFormat;
}

/** Issues a fresh player request and picks the best directly-fetchable audio-only format. */
async function resolveDirectFormat(videoId: string, isRetryAfterSessionReset = false): Promise<ResolvedFormat> {
  const innertube = await getDirectInnertube();

  let info: Awaited<ReturnType<Innertube['getBasicInfo']>>;
  try {
    info = await innertube.getBasicInfo(videoId, { client: 'IOS' });
  } catch (e) {
    if (isRetryAfterSessionReset) throw e;
    console.warn(
      `[direct-stream] [${videoId}] getBasicInfo failed, session looks stale — resetting and retrying once:`,
      e instanceof Error ? e.message : e
    );
    resetDirectInnertube();
    return resolveDirectFormat(videoId, true);
  }

  const audioFormats = (info.streaming_data?.adaptive_formats || []).filter(
    (f) => f.has_audio && !f.has_video && f.url
  );
  if (!audioFormats.length) {
    if (!isRetryAfterSessionReset) {
      console.warn(
        `[direct-stream] [${videoId}] no directly-fetchable audio formats returned, session looks stale — ` +
          'resetting and retrying once'
      );
      resetDirectInnertube();
      return resolveDirectFormat(videoId, true);
    }
    throw new Error('No directly-fetchable audio-only formats found for the IOS client');
  }
  const best = audioFormats.sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0))[0];
  const contentLength = Number(best.content_length ?? 0);
  if (!contentLength) {
    throw new Error('Selected format has no known content length');
  }

  return {
    url: best.url as string,
    contentLength,
    videoTitle: info.basic_info?.title || 'Unknown Video',
    durationMs: (info.basic_info?.duration ?? 0) * 1000,
    sabrFormat: buildSabrFormat(best as unknown as Parameters<typeof buildSabrFormat>[0])
  };
}

const RANGE_CHUNK_SIZE = 1024 * 1024;

/**
 * Minimum gap between the end of one chunk request and the start of the
 * next. A real player naturally paces requests based on buffering/playback;
 * firing them back-to-back with zero gap looks more bot-like to whatever's
 * rate-limiting these URLs. Costs little overall (each 1MB chunk already
 * takes ~300-400ms at full speed).
 */
const CHUNK_PACING_MS = 200;

interface RetryBudget {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  /** Attempt number (1-indexed) at which to get a fresh signed URL instead of retrying the same one. */
  refreshAtAttempt: number;
}

/**
 * The first chunk gets a short, fast-failing retry budget: if it still 403s
 * after ~1.5s total, createDirectAudioStream() rejects *before* anything has
 * been sent to the client, so the caller can fall back to the SABR engine
 * quickly instead of leaving the listener waiting on a doomed retry loop.
 */
const FIRST_CHUNK_RETRY_BUDGET: RetryBudget = {
  maxAttempts: 4,
  baseDelayMs: 200,
  maxDelayMs: 500,
  refreshAtAttempt: 3
};

/**
 * Later chunks have no fallback available — audio has already reached the
 * client, so we can't switch formats mid-stream. These get a more patient
 * budget to actually recover from transient issues rather than aborting a
 * stream that's already playing.
 */
const LATER_CHUNK_RETRY_BUDGET: RetryBudget = {
  maxAttempts: 5,
  baseDelayMs: 250,
  maxDelayMs: 1200,
  refreshAtAttempt: 3
};

/**
 * Fetches a single byte range, retrying (with backoff) on transient 403s and
 * network errors. Partway through the budget it swaps to a brand-new signed
 * URL (fresh player request) instead of continuing to hammer the same one —
 * a URL that's specifically been flagged stays 403ing no matter how long you
 * wait on it, while a clean session for the same video often just works.
 * `urlRef` is mutated in place so the caller (and subsequent chunks) pick up
 * the refreshed URL too. Failures are logged since they're otherwise
 * invisible to the caller (the stream just errors out).
 */
async function fetchRangeWithRetry(
  urlRef: { current: string },
  videoId: string,
  rangeHeader: string,
  baseHeaders: Record<string, string>,
  signal: AbortSignal,
  budget: RetryBudget
): Promise<ArrayBuffer> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= budget.maxAttempts; attempt++) {
    try {
      const res = await fetch(urlRef.current, { headers: { ...baseHeaders, Range: rangeHeader }, signal });
      if (res.ok) return await res.arrayBuffer();
      throw new Error(`Direct format fetch failed: ${res.status} ${res.statusText}`);
    } catch (e) {
      if (signal.aborted) throw e;
      lastError = e;
      if (attempt < budget.maxAttempts) {
        const delay = Math.min(budget.baseDelayMs * 2 ** (attempt - 1), budget.maxDelayMs);
        console.warn(
          `[direct-stream] range fetch attempt ${attempt}/${budget.maxAttempts} failed ` +
            `(${rangeHeader}), retrying in ${delay}ms:`,
          e instanceof Error ? e.message : e
        );
        if (attempt + 1 === budget.refreshAtAttempt) {
          try {
            const fresh = await resolveDirectFormat(videoId);
            urlRef.current = fresh.url;
            console.warn(`[direct-stream] refreshed to a new signed URL for ${videoId} after repeated 403s`);
          } catch (refreshError) {
            console.warn('[direct-stream] URL refresh failed, will keep retrying the old one:', refreshError);
          }
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  console.error(
    `[direct-stream] range fetch permanently failed (${rangeHeader}) after ${budget.maxAttempts} attempts:`,
    lastError
  );
  throw lastError instanceof Error ? lastError : new Error('Direct format fetch failed');
}

/**
 * Builds the audio ReadableStream starting from `startPosition`, given the
 * first chunk (covering [0, startPosition)) has already been fetched
 * successfully. Enqueues that prefetched chunk immediately, then lazily
 * fetches the rest as the consumer reads.
 */
function createChunkedRangeStream(
  urlRef: { current: string },
  videoId: string,
  contentLength: number,
  headers: Record<string, string>,
  signal: AbortSignal,
  firstChunk: Uint8Array,
  startPosition: number
): ReadableStream<Uint8Array> {
  let position = startPosition;
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(firstChunk);
    },
    async pull(controller) {
      if (signal.aborted) {
        controller.error(new Error('Download aborted.'));
        return;
      }
      if (position >= contentLength) {
        controller.close();
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, CHUNK_PACING_MS));
      const end = Math.min(position + RANGE_CHUNK_SIZE, contentLength) - 1;
      const buf = await fetchRangeWithRetry(
        urlRef,
        videoId,
        `bytes=${position}-${end}`,
        headers,
        signal,
        LATER_CHUNK_RETRY_BUDGET
      );
      position = end + 1;
      controller.enqueue(new Uint8Array(buf));
    }
  });
}

export async function createDirectAudioStream(videoId: string): Promise<{
  streamResults: StreamResults;
  abort: () => void;
}> {
  const resolved = await resolveDirectFormat(videoId);
  const urlRef = { current: resolved.url };

  const abortController = new AbortController();
  const headers = { 'User-Agent': Constants.CLIENTS.IOS.USER_AGENT };

  // Eagerly fetch the first chunk (fast-fail budget) so a persistent 403
  // here rejects createDirectAudioStream() itself, before any bytes reach
  // the client — the caller can then fall back to SABR cleanly.
  const firstChunkEnd = Math.min(RANGE_CHUNK_SIZE, resolved.contentLength) - 1;
  const firstChunkBuf = await fetchRangeWithRetry(
    urlRef,
    videoId,
    `bytes=0-${firstChunkEnd}`,
    headers,
    abortController.signal,
    FIRST_CHUNK_RETRY_BUDGET
  );

  const audioStream = createChunkedRangeStream(
    urlRef,
    videoId,
    resolved.contentLength,
    headers,
    abortController.signal,
    new Uint8Array(firstChunkBuf),
    firstChunkEnd + 1
  );

  return {
    streamResults: {
      audioStream,
      selectedFormats: { audioFormat: resolved.sabrFormat },
      videoTitle: resolved.videoTitle,
      durationMs: resolved.durationMs
    },
    abort: () => abortController.abort()
  };
}
