# Standalone YouTube Audio Stream Server

A standalone Node.js HTTP server that streams YouTube audio using YouTube's
SABR (Server-Adaptive Bitrate) protocol. It exposes an HTTP endpoint that
supports HTTP `Range` requests, so any standard media player (VLC, HTML5
`<audio>`, ffmpeg, mpv, etc.) can seek and play the stream in real time.

This server uses only maintained, npm-installable dependencies — no private
or local libraries required.

## How it works

1. **`youtubei.js`** fetches the YouTube player response and the
   `server_abr_streaming_url` + `video_playback_ustreamer_config`.
2. **`bgutils-js`** (+ `jsdom`) generates the Web Proof-of-Origin token
   (PoToken) that YouTube now requires for SABR playback.
3. **`googlevideo`**'s `SabrStream` performs the actual SABR download and
   yields a `ReadableStream<Uint8Array>` of audio.
4. The server buffers the incoming chunks and serves them over HTTP with
   full `Range` support, pumping bytes to the client as they arrive
   (no need to wait for the whole file).

## Dependencies

| Package | Purpose |
| --- | --- |
| `googlevideo` | SABR/UMP streaming client |
| `youtubei.js` | Innertube API client (player response, deciphering) |
| `bgutils-js` | Web PoToken generation |
| `jsdom` | DOM environment for the bgutils challenge VM |
| `express` | HTTP server |

All are published on npm and actively maintained.

## Usage

```bash
# Install dependencies
npm install

# Run in dev mode (no build step, uses tsx)
npm run dev

# Or build + run compiled JS
npm run build
npm start
```

Then point a player at:

```
http://localhost:3001/stream/<videoId>
```

For example, with VLC:

```
vlc http://localhost:3001/stream/dQw4w9WgXcQ
```

Or in an HTML page:

```html
<audio src="http://localhost:3001/stream/dQw4w9WgXcQ" controls></audio>
```

### Query parameters

| Param | Example | Description |
| --- | --- | --- |
| `preferOpus` | `?preferOpus=false` | Prefer Opus codec (default `true`) |
| `audioQuality` | `?audioQuality=AUDIO_QUALITY_MEDIUM` | Override audio quality |

### Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/stream/:id` | Stream audio for the given YouTube video id |
| `GET` | `/search?q=<query>&type=song` | Search YouTube Music (type: `song` or `video`) |
| `GET` | `/metadata/:id` | Full track metadata for a video id |
| `GET` | `/album/:id` | Album metadata + track listing (album id is `MPRE...`) |
| `GET` | `/artist/:id` | Artist metadata (artist id is `UC...`) |
| `GET` | `/playlist/:id` | All video ids in a playlist (handles 1000+ via pagination) |
| `GET` | `/health` | Server status + active downloads |

### Metadata endpoints

The metadata subsystem is built on **youtubei.js** (Innertube) using the
YouTube Music client. It is completely independent of the streaming
subsystem — no SABR or PoToken code is involved.

```bash
# Search for songs
curl 'http://localhost:3001/search?q=half+alive+arrow&type=song'

# Get full metadata for a track
curl http://localhost:3001/metadata/FCibXq0DbV4

# Get album info (use the album id from a metadata/search response)
curl http://localhost:3001/album/MPREb_6A8M7PzJ7zI

# Get artist info
curl http://localhost:3001/artist/UCYQrYophdVI3nVDPOnXyIng

# Get all video ids from a playlist (handles very large playlists, 1000+)
curl http://localhost:3001/playlist/PLFgquLnBQx4RJzCeI9gR7qZcBxgQZ9GZp

# Lighter response: just the video id array
curl 'http://localhost:3001/playlist/PLFgquLnBQx4RJzCeI9gR7qZcBxgQZ9GZp?idsOnly=true'
```

Search results and metadata responses include title, artist, channel, album,
duration, thumbnails, views, and release year — all ready for a music player
UI without additional requests.

#### Playlists

`GET /playlist/:id` returns every video id in a playlist, paginating through
all continuation pages so it works on very large playlists (1000+ videos).
The `:id` accepts any YouTube playlist id (`PL...`, `OLAK5uy...`,
`RDCLAK...`, `RD...`, `UU...`, etc.), optionally `VL`-prefixed.

The response includes both a flat `videoIds` array and a richer `videos`
array (with per-entry title, 1-based index, and duration). Pass
`?idsOnly=true` to get just the ids for a smaller payload.

```json
{
  "id": "PLFgquLnBQx4RJzCeI9gR7qZcBxgQZ9GZp",
  "title": "My Playlist",
  "videoCount": 1234,
  "returnedCount": 1230,
  "videoIds": ["abc123", "def456", "..."],
  "videos": [
    { "id": "abc123", "title": "First Track", "index": 1, "duration": { "seconds": 213, "text": "3:33" } },
    "..."
  ]
}
```

`returnedCount` may be less than `videoCount` when the playlist contains
private or deleted entries (which have no usable id).

See [`METADATA_LIMITATIONS.md`](./METADATA_LIMITATIONS.md) for a full list of
fields that youtubei.js cannot reliably provide (e.g. likes, album year in
some contexts).

### Configuration

| Env var | Default | Description |
| --- | --- | --- |
| `PORT` | `3001` | HTTP listen port |
| `HOST` | `0.0.0.0` | HTTP listen host |
| `MAX_CONCURRENT_STREAMS` | `3` | Max concurrent SABR downloads. When exceeded, the oldest active stream is evicted (aborted) to make room — requests are never denied. Set to `0` for no limit. |

## Notes

- The first request for a video id triggers the SABR download; subsequent
  requests for the same id reuse the in-progress buffer.
- Range requests are supported so players can seek. The server will serve
  any already-downloaded bytes immediately and wait for the rest.
- If the client disconnects and no other client is reading, the underlying
  SABR download is aborted to free resources.
- PoToken generation requires a DOM environment, which is why `jsdom` is
  pulled in. This matches the official `googlevideo` downloader example.
