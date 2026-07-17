import { Innertube, UniversalCache, ClientType } from 'youtubei.js';

/**
 * Lazily-initialized, reusable Innertube instance for **metadata** lookups.
 *
 * The streaming subsystem (`sabr-stream-factory.ts`) intentionally creates its
 * own per-request WEB Innertube instance because it needs the WEB client's
 * BotGuard attestation challenge for PoToken generation. Metadata has no such
 * constraint, so we use a single shared YTMUSIC client here — it is the
 * natural fit for music search / track / album / artist endpoints and avoids
 * the per-request overhead of building a new client every call.
 *
 * The instance is created once and reused for the lifetime of the process.
 * youtubei.js' own `UniversalCache` handles session caching.
 *
 * The in-flight creation `Promise` itself (not just its resolved value) is
 * memoized: without this, concurrent calls that land before the first
 * `Innertube.create()` resolves would each kick off their own session
 * creation, defeating the "single shared instance" point of this module.
 */
let metadataInnertube: Promise<Innertube> | undefined;

/**
 * Returns the shared metadata Innertube instance, creating it on first use.
 *
 * NOTE: This is a separate instance from anything the streaming code uses.
 * Streaming and metadata are intentionally independent subsystems.
 */
export function getMetadataInnertube(): Promise<Innertube> {
  if (!metadataInnertube) {
    metadataInnertube = Innertube.create({
      cache: new UniversalCache(true),
      // YTMUSIC gives us music.search / music.getInfo / music.getAlbum /
      // music.getArtist with rich, music-oriented metadata (album, artists,
      // release year, etc.) that the plain WEB client does not expose.
      client_type: ClientType.MUSIC
    });
    // Don't leave a rejected promise memoized — a transient failure (e.g. a
    // network blip during session init) shouldn't permanently break every
    // future call for the rest of the process's lifetime.
    metadataInnertube.catch(() => { metadataInnertube = undefined; });
  }
  return metadataInnertube;
}

/**
 * Lazily-initialized, reusable Innertube instance for **playlist** lookups.
 *
 * `Innertube.getPlaylist()` (the continuable `parser/youtube/Playlist`) only
 * returns usable `PlaylistVideo` items when the browse request is issued from
 * the regular **WEB** client. The YTMUSIC (`WEB_REMIX`) client returns a
 * music-formatted browse response whose playlist items the `Playlist` parser
 * cannot extract (items come back empty even though a continuation exists).
 *
 * We therefore keep a dedicated WEB instance here, separate from the music
 * metadata instance, and reuse it for the lifetime of the process. As with
 * `getMetadataInnertube`, the in-flight `Promise` is memoized so concurrent
 * first-time callers share one session creation instead of racing to create
 * their own.
 */
let playlistInnertube: Promise<Innertube> | undefined;

/**
 * Returns the shared playlist Innertube instance (regular WEB client),
 * creating it on first use.
 */
export function getPlaylistInnertube(): Promise<Innertube> {
  if (!playlistInnertube) {
    playlistInnertube = Innertube.create({
      cache: new UniversalCache(true),
      // The plain WEB client is required for getPlaylist() to return
      // continuable PlaylistVideo items.
      client_type: ClientType.WEB
    });
    playlistInnertube.catch(() => { playlistInnertube = undefined; });
  }
  return playlistInnertube;
}
