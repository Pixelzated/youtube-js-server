import express from 'express';
import cors from 'cors';
import { EventEmitter } from 'node:events';
import { EnabledTrackTypes } from 'googlevideo/utils';
import { createSabrAudioStream } from './sabr-stream-factory.js';
import { search, getMetadata, getAlbum, getArtist, getPlaylist } from './metadata-factory.js';
const app = express();
app.use(express.json());
app.use(cors());
const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? '0.0.0.0';
/**
 * Maximum number of concurrent SABR downloads allowed at once. When the limit
 * is reached, the oldest active stream is evicted (aborted) to make room for
 * the new request — requests are never denied, the oldest stream is simply
 * closed. Set to `0` to disable the limit entirely.
 *
 * Note: this counts *active downloads* (tracks that are not yet `done`).
 * Completed downloads that remain in the buffer for reuse do not count
 * against the limit.
 */
const MAX_CONCURRENT_STREAMS = Number(process.env.MAX_CONCURRENT_STREAMS ?? 3);
/**
 * Default playback options: audio-only, prefer Opus (best quality webm audio).
 * Callers can override per-request via the `?quality=` / `?format=` query
 * params (see route handler).
 */
const DEFAULT_OPTIONS = {
    enabledTrackTypes: EnabledTrackTypes.AUDIO_ONLY,
    preferOpus: true
};
const tracks = new Map();
/**
 * Returns the number of tracks that are actively downloading (not yet done).
 * Completed tracks remaining in the buffer for reuse do not count against
 * the concurrency limit.
 */
function countActiveStreams() {
    let count = 0;
    for (const track of tracks.values()) {
        if (!track.done)
            count++;
    }
    return count;
}
/**
 * Finds and aborts the oldest active (not-yet-done) SABR download to make
 * room for a new stream. The evicted track's buffer is freed and any clients
 * currently reading from it will have their connection destroyed.
 */
function evictOldestStream() {
    let oldest;
    let oldestKey;
    for (const [key, track] of tracks) {
        if (track.done)
            continue; // skip completed downloads
        if (oldest === undefined || track.startedAt < oldest.startedAt) {
            oldest = track;
            oldestKey = key;
        }
    }
    if (!oldest || !oldestKey)
        return;
    console.log(`[stream] evicting oldest active stream ${oldestKey} ` +
        `(started ${Date.now() - oldest.startedAt}ms ago) to make room for new request`);
    // Abort the underlying SABR download. This will cause the reader loop in
    // getOrStartTrack to throw, which sets track.done/error and emits 'error'.
    // The catch block already deletes the track from the map.
    try {
        oldest.sabrStream?.abort();
    }
    catch {
        // abort() can throw if the stream is already closing — ignore.
    }
    // If abort didn't trigger the catch path fast enough (e.g. the stream was
    // already past the reader loop), ensure the track is cleaned up.
    if (tracks.has(oldestKey)) {
        oldest.done = true;
        oldest.ready = true;
        oldest.error = new Error('Stream evicted to make room for a new request');
        tracks.delete(oldestKey);
        oldest.emitter.emit('error', oldest.error);
    }
}
/**
 * Returns an existing in-progress track, or starts a new SABR download for
 * the given video id. The download runs in the background and emits
 * 'ready' | 'data' | 'end' | 'error' on its emitter so HTTP handlers can
 * stream bytes as they arrive.
 *
 * If the concurrency limit has been reached, the oldest active stream is
 * evicted (aborted) before the new one starts — the request is never denied.
 */
function getOrStartTrack(videoId, options) {
    const existing = tracks.get(videoId);
    if (existing)
        return existing;
    // Evict the oldest active stream if we're at the concurrency limit.
    // (0 = unlimited, so skip the check entirely in that case.)
    if (MAX_CONCURRENT_STREAMS > 0 && countActiveStreams() >= MAX_CONCURRENT_STREAMS) {
        evictOldestStream();
    }
    const track = {
        chunks: [],
        downloadedLength: 0,
        mimeType: 'audio/webm',
        ready: false,
        done: false,
        emitter: new EventEmitter(),
        startedAt: Date.now()
    };
    // Guard against unhandled 'error' emissions which would crash the process.
    track.emitter.on('error', () => { });
    tracks.set(videoId, track);
    (async () => {
        try {
            const { streamResults, sabrStream } = await createSabrAudioStream(videoId, options);
            track.sabrStream = sabrStream;
            const audioFormat = streamResults.selectedFormats.audioFormat;
            track.mimeType = audioFormat?.mimeType?.split(';')[0] ?? 'audio/webm';
            if (audioFormat?.contentLength && audioFormat.contentLength > 0) {
                track.totalSize = audioFormat.contentLength;
            }
            track.ready = true;
            track.emitter.emit('ready');
            const reader = streamResults.audioStream.getReader();
            for (;;) {
                const { done, value } = await reader.read();
                if (done)
                    break;
                if (!value)
                    continue;
                track.chunks.push(Buffer.from(value));
                track.downloadedLength += value.byteLength;
                track.emitter.emit('data');
            }
            track.done = true;
            if (track.totalSize === undefined)
                track.totalSize = track.downloadedLength;
            track.emitter.emit('end');
        }
        catch (e) {
            track.error = e instanceof Error ? e : new Error(String(e));
            track.ready = true;
            track.done = true;
            tracks.delete(videoId);
            track.emitter.emit('error', track.error);
        }
    })().catch((e) => {
        track.error = e instanceof Error ? e : new Error(String(e));
        track.ready = true;
        track.done = true;
        tracks.delete(videoId);
        track.emitter.emit('error', track.error);
    });
    return track;
}
async function waitForTrackReady(track) {
    if (track.ready) {
        if (track.error)
            throw track.error;
        return;
    }
    return new Promise((resolve, reject) => {
        const onReady = () => {
            cleanup();
            track.error ? reject(track.error) : resolve();
        };
        const onError = (e) => {
            cleanup();
            reject(e);
        };
        function cleanup() {
            track.emitter.off('ready', onReady);
            track.emitter.off('error', onError);
        }
        track.emitter.once('ready', onReady);
        track.emitter.once('error', onError);
    });
}
async function waitForTotalSize(track) {
    if (track.totalSize !== undefined)
        return track.totalSize;
    if (track.done)
        return track.downloadedLength;
    return new Promise((resolve, reject) => {
        const onProgress = () => {
            if (track.totalSize !== undefined) {
                cleanup();
                resolve(track.totalSize);
            }
            else if (track.done) {
                cleanup();
                resolve(track.downloadedLength);
            }
        };
        const onError = (e) => {
            cleanup();
            reject(e);
        };
        function cleanup() {
            track.emitter.off('ready', onProgress);
            track.emitter.off('end', onProgress);
            track.emitter.off('error', onError);
        }
        track.emitter.on('ready', onProgress);
        track.emitter.on('end', onProgress);
        track.emitter.on('error', onError);
    });
}
/**
 * Reads a contiguous byte slice [start, end] from the buffered chunks,
 * even when not all chunks have arrived yet (caller must ensure the range
 * is already downloaded).
 */
function readBufferedSlice(track, start, end) {
    const parts = [];
    let pos = 0;
    for (const chunk of track.chunks) {
        const chunkStart = pos;
        const chunkEnd = pos + chunk.length;
        pos = chunkEnd;
        if (chunkEnd <= start)
            continue;
        if (chunkStart > end)
            break;
        const sliceStart = Math.max(start, chunkStart) - chunkStart;
        const sliceEnd = Math.min(end + 1, chunkEnd) - chunkStart;
        parts.push(chunk.subarray(sliceStart, sliceEnd));
    }
    return parts.length === 1 ? parts[0] : Buffer.concat(parts);
}
/**
 * Streams the byte range [start, end] (inclusive) to the response, pumping
 * new data as it arrives from the SABR download. Supports backpressure via
 * the response 'drain' event and aborts the download if the client closes.
 */
function serveRange(track, start, end, req, res) {
    let cursor = start;
    let closed = false;
    const cleanup = () => {
        track.emitter.off('data', pump);
        track.emitter.off('end', pump);
        track.emitter.off('error', onError);
    };
    function onError(e) {
        cleanup();
        if (!closed)
            res.destroy(e);
    }
    function pump() {
        if (closed)
            return;
        while (cursor <= end) {
            if (cursor >= track.downloadedLength) {
                if (track.done)
                    break;
                return; // wait for more 'data'
            }
            const availableEnd = Math.min(end, track.downloadedLength - 1);
            const slice = readBufferedSlice(track, cursor, availableEnd);
            cursor = availableEnd + 1;
            if (!res.write(slice))
                return; // resume on 'drain'
        }
        cleanup();
        res.end();
    }
    req.on('close', () => {
        closed = true;
        cleanup();
        // We intentionally do NOT abort the underlying SABR download here:
        // the buffer is reusable by other clients and a completed download
        // makes subsequent requests for the same video instant.
    });
    res.on('drain', pump);
    track.emitter.on('data', pump);
    track.emitter.on('end', pump);
    track.emitter.on('error', onError);
    pump();
}
app.get('/stream/:id', async (req, res) => {
    const videoId = req.params.id;
    // Optional per-request overrides.
    const options = { ...DEFAULT_OPTIONS };
    if (typeof req.query.preferOpus === 'string') {
        options.preferOpus = req.query.preferOpus !== 'false';
    }
    if (typeof req.query.audioQuality === 'string') {
        options.audioQuality = req.query.audioQuality;
    }
    const track = getOrStartTrack(videoId, options);
    try {
        await waitForTrackReady(track);
    }
    catch (e) {
        res.status(500).json({ error: e?.message ?? String(e) });
        return;
    }
    res.setHeader('Content-Type', track.mimeType);
    res.setHeader('Accept-Ranges', 'bytes');
    const range = req.headers.range;
    if (!range) {
        if (track.totalSize !== undefined)
            res.setHeader('Content-Length', track.totalSize);
        const end = track.totalSize !== undefined ? track.totalSize - 1 : Infinity;
        serveRange(track, 0, end, req, res);
        return;
    }
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match || (match[1] === '' && match[2] === '')) {
        res.status(416).setHeader('Content-Range', 'bytes */*').end();
        return;
    }
    let totalSize;
    try {
        totalSize = await waitForTotalSize(track);
    }
    catch (e) {
        res.status(500).json({ error: e?.message ?? String(e) });
        return;
    }
    let start;
    let end;
    if (match[1] === '') {
        // suffix range, e.g. "bytes=-500" -> last 500 bytes
        const suffixLength = parseInt(match[2], 10);
        start = Math.max(totalSize - suffixLength, 0);
        end = totalSize - 1;
    }
    else {
        start = parseInt(match[1], 10);
        end = match[2] === '' ? totalSize - 1 : Math.min(parseInt(match[2], 10), totalSize - 1);
    }
    if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= totalSize) {
        res.status(416).setHeader('Content-Range', `bytes */${totalSize}`).end();
        return;
    }
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${totalSize}`);
    res.setHeader('Content-Length', end - start + 1);
    serveRange(track, start, end, req, res);
});
// ---------------------------------------------------------------------------
// Metadata endpoints (youtubei.js). These are independent of the streaming
// subsystem above and never touch the SABR / PoToken code.
// ---------------------------------------------------------------------------
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{6,}$/;
const ALBUM_ID_RE = /^MPRE[\w-]+$/;
const ARTIST_ID_RE = /^UC[\w-]+$/;
/**
 * Playlist ids come in several prefixes: `PL...` (user playlists),
 * `OLAK5uy...` (albums-as-playlists), `RDCLAK...` (curated), `RD...` (radio),
 * `UU...` (channel uploads), `LL...` (liked), `FL...` (favorites), plus
 * arbitrary ids for some music playlists. We accept any non-empty
 * alphanumeric/`-`/`_` id, optionally prefixed with `VL`.
 */
const PLAYLIST_ID_RE = /^(VL)?[A-Za-z0-9_-]{6,}$/;
/** Sends a consistent JSON error without leaking stack traces. */
function sendError(res, status, message) {
    res.status(status).json({ error: message });
}
app.get('/search', async (req, res) => {
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!query) {
        sendError(res, 400, 'Missing required query parameter "q"');
        return;
    }
    const rawType = typeof req.query.type === 'string' ? req.query.type : 'song';
    if (rawType !== 'song' && rawType !== 'video') {
        sendError(res, 400, 'Invalid "type"; must be "song" or "video"');
        return;
    }
    const type = rawType;
    try {
        const results = await search(query, { type });
        res.json(results);
    }
    catch (e) {
        console.error('[metadata] search failed:', e);
        sendError(res, 500, 'Search failed');
    }
});
app.get('/metadata/:id', async (req, res) => {
    const videoId = req.params.id;
    if (!VIDEO_ID_RE.test(videoId)) {
        sendError(res, 400, 'Invalid video id');
        return;
    }
    try {
        const metadata = await getMetadata(videoId);
        if (!metadata) {
            sendError(res, 404, 'Track not found');
            return;
        }
        res.json(metadata);
    }
    catch (e) {
        console.error('[metadata] getMetadata failed:', e);
        sendError(res, 500, 'Metadata lookup failed');
    }
});
app.get('/album/:id', async (req, res) => {
    const albumId = req.params.id;
    if (!ALBUM_ID_RE.test(albumId)) {
        sendError(res, 400, 'Invalid album id (expected an MPRE... id)');
        return;
    }
    try {
        const album = await getAlbum(albumId);
        if (!album) {
            sendError(res, 404, 'Album not found');
            return;
        }
        res.json(album);
    }
    catch (e) {
        console.error('[metadata] getAlbum failed:', e);
        sendError(res, 500, 'Album lookup failed');
    }
});
app.get('/artist/:id', async (req, res) => {
    const artistId = req.params.id;
    if (!ARTIST_ID_RE.test(artistId)) {
        sendError(res, 400, 'Invalid artist id (expected a UC... channel id)');
        return;
    }
    try {
        const artist = await getArtist(artistId);
        if (!artist) {
            sendError(res, 404, 'Artist not found');
            return;
        }
        res.json(artist);
    }
    catch (e) {
        console.error('[metadata] getArtist failed:', e);
        sendError(res, 500, 'Artist lookup failed');
    }
});
app.get('/playlist/:id', async (req, res) => {
    const playlistId = req.params.id;
    if (!PLAYLIST_ID_RE.test(playlistId)) {
        sendError(res, 400, 'Invalid playlist id');
        return;
    }
    // Optional `?idsOnly=true` returns just the video id array (lighter payload
    // for clients that only need ids, e.g. to feed into /stream/:id).
    const idsOnly = req.query.idsOnly === 'true';
    try {
        const playlist = await getPlaylist(playlistId);
        if (!playlist) {
            sendError(res, 404, 'Playlist not found or is empty');
            return;
        }
        if (idsOnly) {
            res.json({
                id: playlist.id,
                title: playlist.title,
                videoCount: playlist.videoCount,
                returnedCount: playlist.returnedCount,
                videoIds: playlist.videoIds
            });
            return;
        }
        res.json(playlist);
    }
    catch (e) {
        console.error('[metadata] getPlaylist failed:', e);
        sendError(res, 500, 'Playlist lookup failed');
    }
});
// Simple health/info endpoint.
app.get('/health', (_req, res) => {
    const activeCount = countActiveStreams();
    res.json({
        status: 'ok',
        activeTracks: tracks.size,
        activeDownloads: activeCount,
        maxConcurrentStreams: MAX_CONCURRENT_STREAMS > 0 ? MAX_CONCURRENT_STREAMS : 'unlimited',
        tracks: Array.from(tracks.entries()).map(([id, t]) => ({
            id,
            ready: t.ready,
            done: t.done,
            downloaded: t.downloadedLength,
            total: t.totalSize,
            mimeType: t.mimeType,
            ageMs: Date.now() - t.startedAt,
            error: t.error?.message
        }))
    });
});
app.listen(PORT, HOST, () => {
    console.log(`YouTube audio stream server listening on http://${HOST}:${PORT}`);
    console.log(`  Stream:   http://${HOST}:${PORT}/stream/<videoId>`);
    console.log(`  Search:   http://${HOST}:${PORT}/search?q=<query>&type=song`);
    console.log(`  Metadata: http://${HOST}:${PORT}/metadata/<videoId>`);
    console.log(`  Album:    http://${HOST}:${PORT}/album/<albumId>`);
    console.log(`  Artist:   http://${HOST}:${PORT}/artist/<artistId>`);
    console.log(`  Playlist: http://${HOST}:${PORT}/playlist/<playlistId>`);
    console.log(`  Health:   http://${HOST}:${PORT}/health`);
    const limitStr = MAX_CONCURRENT_STREAMS > 0
        ? `${MAX_CONCURRENT_STREAMS} (oldest evicted when exceeded)`
        : 'unlimited';
    console.log(`  Max concurrent SABR streams: ${limitStr}`);
});
//# sourceMappingURL=server.js.map