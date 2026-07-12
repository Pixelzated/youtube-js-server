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
 */
let metadataInnertube: Innertube | undefined;

/**
 * Returns the shared metadata Innertube instance, creating it on first use.
 *
 * NOTE: This is a separate instance from anything the streaming code uses.
 * Streaming and metadata are intentionally independent subsystems.
 */
export async function getMetadataInnertube(): Promise<Innertube> {
  if (metadataInnertube) return metadataInnertube;

  metadataInnertube = await Innertube.create({
    cache: new UniversalCache(true),
    // YTMUSIC gives us music.search / music.getInfo / music.getAlbum /
    // music.getArtist with rich, music-oriented metadata (album, artists,
    // release year, etc.) that the plain WEB client does not expose.
    client_type: ClientType.MUSIC
  });

  return metadataInnertube;
}
