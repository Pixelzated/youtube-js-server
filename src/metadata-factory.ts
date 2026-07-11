import { getMetadataInnertube, getPlaylistInnertube } from './innertube-helper.js';
import { Misc, YT, YTNodes } from 'youtubei.js';
import type {
  AlbumMetadata,
  AlbumTrack,
  ArtistMetadata,
  MetadataAlbum,
  MetadataDuration,
  MetadataEntity,
  MetadataThumbnail,
  PlaylistMetadata,
  PlaylistVideoEntry,
  SearchResult,
  SearchResponse,
  SearchOptions,
  TrackMetadata
} from './metadata-types.js';

type Thumbnail = Misc.Thumbnail;
type MusicResponsiveListItem = YTNodes.MusicResponsiveListItem;
type PlaylistPanelVideo = YTNodes.PlaylistPanelVideo;
type PlaylistVideo = YTNodes.PlaylistVideo;
type NavigationEndpoint = YTNodes.NavigationEndpoint;
type Playlist = YT.Playlist;

/**
 * youtubei.js metadata subsystem.
 *
 * All functions here are pure-ish async helpers that turn youtubei.js parser
 * objects into the plain `TrackMetadata` / `SearchResponse` shapes defined in
 * `metadata-types.ts`. They perform no streaming and no PoToken work.
 *
 * youtubei.js limitations encountered (see METADATA_LIMITATIONS.md):
 *  - `like_count` is exposed on `basic_info` for regular videos but is
 *    frequently `undefined` for YouTube Music tracks.
 *  - Album release *year* is only available when the track is part of a known
 *    album (via the Up Next panel's `PlaylistPanelVideo.album.year`). For
 *    standalone videos there is no album year.
 *  - `view_count` is often `undefined` for music tracks (YouTube Music hides
 *    it on the watch page).
 *  - The plain WEB `search()` returns video results; music-oriented fields
 *    (album, artists[]) come from the YTMUSIC `music.search()` client, which
 *    is what we use here.
 */

// ---------------------------------------------------------------------------
// Small extraction helpers
// ---------------------------------------------------------------------------

function mapThumbnails(thumbs: Thumbnail[] | undefined | null): MetadataThumbnail[] {
  if (!Array.isArray(thumbs)) return [];
  return thumbs
    .map((t) => ({
      url: t.url,
      width: t.width,
      height: t.height
    }))
    .filter((t) => t.url);
}

/** Extracts a video/channel/album id from a NavigationEndpoint's raw payload. */
function idFromEndpoint(endpoint: NavigationEndpoint | undefined): string | undefined {
  if (!endpoint?.payload) return undefined;
  const p = endpoint.payload as Record<string, unknown>;
  return (p.videoId ?? p.browseId ?? p.playlistId) as string | undefined;
}

function makeEntity(
  name: string | undefined,
  id?: string
): MetadataEntity {
  return { name: name ?? 'Unknown', ...(id ? { id } : {}) };
}

function makeDuration(seconds: number | undefined, text?: string): MetadataDuration {
  const secs = seconds ?? 0;
  return {
    seconds: secs,
    text: text ?? (secs > 0 ? formatDuration(secs) : 'Unknown')
  };
}

/** "1:23" / "1:02:03" style formatting for a duration in seconds. */
function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '0:00';
  const s = Math.floor(totalSeconds % 60);
  const m = Math.floor((totalSeconds / 60) % 60);
  const h = Math.floor(totalSeconds / 3600);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** Parses a year out of a free-form string ("2019", "Released 2019", etc.). */
function parseYear(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const match = /\d{4}/.exec(value);
  if (!match) return undefined;
  const year = parseInt(match[0], 10);
  return Number.isFinite(year) ? year : undefined;
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/**
 * Search YouTube Music and return player-ready track objects.
 *
 * @example
 * ```ts
 * search('half alive arrow', { type: 'song' })
 * ```
 *
 * Supported `options.type` values: `'song'` (default) and `'video'`.
 */
export async function search(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResponse> {
  const type = options.type ?? 'song';
  const innertube = await getMetadataInnertube();

  const results = await innertube.music.search(query, { type });

  let shelf: { contents?: MusicResponsiveListItem[] } | undefined;
  if (type === 'video') {
    shelf = results.videos;
  } else {
    shelf = results.songs;
  }

  const items: MusicResponsiveListItem[] = shelf?.contents ?? [];
  const mapped: SearchResult[] = items
    .map((item) => mapMusicResponsiveListItem(item, type === 'song'))
    .filter((r): r is TrackMetadata => r !== null);

  return {
    query,
    type,
    results: mapped
  };
}

/**
 * Maps a YouTube Music `MusicResponsiveListItem` (a row in a search shelf) to
 * a `TrackMetadata`. Returns `null` for non-track rows (e.g. artist cards).
 */
function mapMusicResponsiveListItem(
  item: MusicResponsiveListItem,
  isMusic: boolean
): TrackMetadata | null {
  const id = item.id ?? idFromEndpoint(item.endpoint);
  if (!id) return null;

  // `title` is parsed by youtubei.js for song/video rows.
  const title = item.title ?? 'Unknown';

  // Artists: prefer the structured `artists[]` array; fall back to `authors[]`
  // (used on video rows) and finally to the first flex column.
  const firstArtist = item.artists?.[0] ?? item.authors?.[0];
  const artist = makeEntity(
    firstArtist?.name,
    firstArtist?.channel_id ?? idFromEndpoint(firstArtist?.endpoint)
  );

  // Channel: same source as artist for music; for video rows the author is
  // the uploading channel.
  const channel = makeEntity(
    firstArtist?.name ?? item.authors?.[0]?.name,
    firstArtist?.channel_id ?? item.authors?.[0]?.channel_id ?? idFromEndpoint(firstArtist?.endpoint)
  );

  const album: MetadataAlbum | null = item.album?.name
    ? {
        name: item.album.name,
        ...(item.album.id ? { id: item.album.id } : {}),
        ...(item.album.endpoint ? {} : {})
      }
    : null;

  const duration = makeDuration(item.duration?.seconds, item.duration?.text);

  // MusicResponsiveListItem exposes a `thumbnails` getter that pulls from
  // its MusicThumbnail. Fall back to the MusicThumbnail's `contents` array.
  const thumbs: Thumbnail[] =
    (item as unknown as { thumbnails?: Thumbnail[] }).thumbnails ??
    item.thumbnail?.contents ??
    [];
  const thumbnails = mapThumbnails(thumbs);

  const views = item.views ? parseViews(item.views) : undefined;

  return {
    id,
    title,
    artist,
    channel,
    album,
    duration,
    thumbnails,
    ...(views !== undefined ? { views } : {}),
    isMusic
  };
}

/** Parses a view-count string like "1.2M views" into a number. */
function parseViews(text: string | undefined): number | undefined {
  if (!text) return undefined;
  const match = /([\d,.]+)\s*([KMB]?)/i.exec(text.replace(/,/g, ''));
  if (!match) return undefined;
  const num = parseFloat(match[1]);
  if (!Number.isFinite(num)) return undefined;
  const suffix = match[2].toUpperCase();
  const mult = suffix === 'K' ? 1e3 : suffix === 'M' ? 1e6 : suffix === 'B' ? 1e9 : 1;
  return Math.round(num * mult);
}

/** Extracts a subscriber count from text like "502 thousand" or "1.2M subscribers". */
function parseSubscribers(text: string | undefined): string | undefined {
  if (!text) return undefined;
  // Handles accessibility labels: "Subscribe to this channel. 502 thousand"
  const match = /([\d.,]+)\s*(thousand|million|billion|K|M|B)?\s*subscribers?/i.exec(text);
  if (match) return match[0].trim();
  // Handles "502 thousand" (from accessibility label tail)
  const tail = /([\d.,]+)\s*(thousand|million|billion)/i.exec(text);
  if (tail) {
    const num = parseFloat(tail[1].replace(/,/g, ''));
    const unit = tail[2].toLowerCase();
    const mult = unit === 'thousand' ? 1e3 : unit === 'million' ? 1e6 : 1e9;
    return `${(num * mult).toLocaleString()} subscribers`;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Metadata lookup
// ---------------------------------------------------------------------------

/**
 * Retrieves full metadata for a single track/video id via YouTube Music.
 *
 * Combines `music.getInfo()` (title, duration, channel, views, likes,
 * thumbnails) with the Up Next panel (`getUpNext()`) which is where
 * youtubei.js exposes the structured `album` (name + year + id) and
 * `artists[]` for a music track.
 *
 * Fields youtubei.js cannot provide are omitted rather than fabricated.
 */
export async function getMetadata(videoId: string): Promise<TrackMetadata | null> {
  const innertube = await getMetadataInnertube();

  let info;
  try {
    console.time('maybe')
    info = await innertube.music.getInfo(videoId);
    console.time('maybe')
    console.log('INFO STARTS NOW ' + info)
  } catch {
    // Some ids are not available on the YTMUSIC client (e.g. plain non-music
    // videos). Fall back to the regular WEB client via getBasicInfo.
    return getMetadataFromWeb(videoId);
  }

  const basic = info.basic_info;
  const title = basic?.title ?? 'Unknown';
  const duration = makeDuration(basic?.duration, basic?.duration ? formatDuration(basic.duration) : undefined);

  const channelId = basic?.channel?.id ?? basic?.channel_id;
  const channelName = basic?.channel?.name ?? basic?.author;
  const channel = makeEntity(channelName, channelId);
  const artist = makeEntity(channelName, channelId);

  const thumbnails = mapThumbnails(basic?.thumbnail);

  const views = basic?.view_count;
  const likes = basic?.like_count;

  // Album + release year come from the Up Next panel's matching entry.
  let album: MetadataAlbum | null = null;
  let releaseYear: number | undefined;
  try {
    const upNext = await info.getUpNext();
    const match = upNext.contents
      ?.filter((c): c is PlaylistPanelVideo => c.is(YTNodes.PlaylistPanelVideo))
      .find((v) => v.video_id === videoId);
    if (match?.album?.name) {
      album = {
        name: match.album.name,
        ...(match.album.id ? { id: match.album.id } : {})
      };
      releaseYear = parseYear(match.album.year);
      if (releaseYear !== undefined) album.year = releaseYear;
    }
  } catch {
    // Up Next is best-effort; ignore failures.
  }

  return {
    id: videoId,
    title,
    artist,
    channel,
    album,
    duration,
    thumbnails,
    ...(views !== undefined ? { views } : {}),
    ...(likes !== undefined ? { likes } : {}),
    ...(releaseYear !== undefined ? { releaseYear } : {}),
    isMusic: true
  };
}

/**
 * Fallback for ids that are not available on the YTMUSIC client. Uses the
 * regular WEB client's `getBasicInfo`, which has no album/artist structure
 * but still provides title, channel, duration, views, likes, thumbnails.
 */
async function getMetadataFromWeb(videoId: string): Promise<TrackMetadata | null> {
  const innertube = await getMetadataInnertube();
  let info;
  try {
    info = await innertube.getBasicInfo(videoId);
  } catch {
    return null;
  }

  const basic = info.basic_info;
  const title = basic?.title ?? 'Unknown';
  const duration = makeDuration(basic?.duration, basic?.duration ? formatDuration(basic.duration) : undefined);

  const channelId = basic?.channel?.id ?? basic?.channel_id;
  const channelName = basic?.channel?.name ?? basic?.author;
  const channel = makeEntity(channelName, channelId);
  const artist = makeEntity(channelName, channelId);

  return {
    id: videoId,
    title,
    artist,
    channel,
    album: null,
    duration,
    thumbnails: mapThumbnails(basic?.thumbnail),
    ...(basic?.view_count !== undefined ? { views: basic.view_count } : {}),
    ...(basic?.like_count !== undefined ? { likes: basic.like_count } : {}),
    isMusic: false
  };
}

// ---------------------------------------------------------------------------
// Album
// ---------------------------------------------------------------------------

/**
 * Retrieves album metadata (name, year, artist, thumbnails) and its track
 * listing via `music.getAlbum()`.
 *
 * Note: this takes a YouTube Music **album id** (a `MPRE...` browse id), not
 * a video id. To get the album for a *track*, call `getMetadata(videoId)`
 * and read the `album.id` field, then pass it here.
 */
export async function getAlbum(albumId: string): Promise<AlbumMetadata | null> {
  const innertube = await getMetadataInnertube();

  let album;
  try {
    album = await innertube.music.getAlbum(albumId);
  } catch {
    return null;
  }

  const header = album.header;
  let title = 'Unknown Album';
  let year: number | undefined;
  let thumbnails: MetadataThumbnail[] = [];
  let artist: MetadataEntity | undefined;

  if (header?.is(YTNodes.MusicDetailHeader)) {
    const h = header as YTNodes.MusicDetailHeader;
    title = h.title?.text ?? title;
    year = parseYear(h.year);
    thumbnails = mapThumbnails(h.thumbnails);
    if (h.author) artist = makeEntity(h.author.name, h.author.channel_id);
  } else if (header?.is(YTNodes.MusicResponsiveHeader)) {
    const h = header as YTNodes.MusicResponsiveHeader;
    title = h.title?.text ?? title;
    // MusicResponsiveHeader wraps its artwork in a MusicThumbnail.
    thumbnails = mapThumbnails(h.thumbnail?.contents);
    // The subtitle often carries "2019 • Album • 12 songs" — pull the year
    // out of it as a fallback when no explicit year is present.
    year = parseYear(h.subtitle?.text);
  }

  const tracks: AlbumTrack[] = (album.contents ?? []).map((item, idx) => {
    const id = item.id ?? idFromEndpoint(item.endpoint);
    return {
      id: id ?? '',
      title: item.title ?? 'Unknown',
      duration: makeDuration(item.duration?.seconds, item.duration?.text),
      ...(typeof idx === 'number' ? { trackNumber: idx + 1 } : {})
    };
  }).filter((t) => t.id);

  return {
    id: albumId,
    name: title,
    ...(year !== undefined ? { year } : {}),
    ...(artist ? { artist } : {}),
    thumbnails,
    ...(album.contents?.length ? { trackCount: album.contents.length } : {}),
    tracks
  };
}

// ---------------------------------------------------------------------------
// Artist
// ---------------------------------------------------------------------------

/**
 * Retrieves artist metadata (name, thumbnails, subscriber count) via
 * `music.getArtist()`.
 *
 * Note: this takes a YouTube Music **artist id** (a `UC...` channel id), not
 * a video id.
 */
export async function getArtist(artistId: string): Promise<ArtistMetadata | null> {
  const innertube = await getMetadataInnertube();

  let artist;
  try {
    artist = await innertube.music.getArtist(artistId);
  } catch {
    return null;
  }

  const header = artist.header;
  let name = 'Unknown Artist';
  let thumbnails: MetadataThumbnail[] = [];
  let subscribers: string | undefined;

  if (header?.is(YTNodes.MusicImmersiveHeader)) {
    const h = header as YTNodes.MusicImmersiveHeader;
    name = h.title?.text ?? name;
    // MusicImmersiveHeader.thumbnail is a MusicThumbnail (wraps Thumbnail[]).
    thumbnails = mapThumbnails(h.thumbnail?.contents);
    // Subscriber count is buried in the subscription button's accessibility
    // label, e.g. "Subscribe to this channel. 502 thousand".
    const subLabel = h.subscription_button?.subscribe_accessibility_label;
    subscribers = parseSubscribers(subLabel);
  } else if (header?.is(YTNodes.MusicVisualHeader)) {
    const h = header as YTNodes.MusicVisualHeader;
    name = h.title?.text ?? name;
    // MusicVisualHeader.thumbnail is a Thumbnail[] directly.
    thumbnails = mapThumbnails(h.thumbnail);
  } else if (header?.is(YTNodes.MusicHeader)) {
    const h = header as YTNodes.MusicHeader;
    name = h.title?.text ?? name;
  }

  return {
    id: artistId,
    name,
    thumbnails,
    ...(subscribers ? { subscribers } : {})
  };
}

// ---------------------------------------------------------------------------
// Playlist
// ---------------------------------------------------------------------------

/**
 * Maximum number of continuation pages to fetch before giving up. Each page
 * typically holds ~100 videos, so 200 pages covers playlists up to ~20,000
 * entries — well beyond any real-world playlist. This is a safety cap to
 * prevent infinite loops on malformed responses, not a practical limit.
 */
const MAX_PLAYLIST_PAGES = 200;

type LockupView = YTNodes.LockupView;

/**
 * Maps a single playlist item into the lightweight `PlaylistVideoEntry`
 * shape. Handles both the legacy `PlaylistVideo` node and the newer
 * `LockupView` node that the current YouTube web UI returns for playlist
 * rows. Returns `null` for entries without a usable id (e.g. private/deleted
 * placeholders, or non-video lockups like channels/playlists).
 */
function mapPlaylistItem(
  item: PlaylistVideo | LockupView,
  index: number
): PlaylistVideoEntry | null {
  // Legacy PlaylistVideo node: has `.id`, `.title`, `.duration`.
  if (item.is(YTNodes.PlaylistVideo)) {
    const v = item as PlaylistVideo;
    if (!v.id) return null;
    return {
      id: v.id,
      title: v.title?.text ?? 'Unknown',
      index,
      ...(v.duration?.seconds !== undefined
        ? { duration: makeDuration(v.duration.seconds, v.duration.text) }
        : {})
    };
  }

  // Newer LockupView node: has `content_id`, `content_type`, `metadata.title`.
  if (item.is(YTNodes.LockupView)) {
    const lv = item as LockupView;
    // Only VIDEO lockups are playlist entries; skip channels/playlists/etc.
    if (lv.content_type !== 'VIDEO') return null;
    if (!lv.content_id) return null;
    return {
      id: lv.content_id,
      title: lv.metadata?.title?.text ?? 'Unknown',
      index
      // LockupView does not expose a duration; clients can fetch per-video
      // metadata via getMetadata() if needed.
    };
  }

  return null;
}

/**
 * Retrieves all video ids from a YouTube playlist, handling pagination for
 * very large playlists (1000+ videos).
 *
 * Uses `Innertube.getPlaylist()` (the regular WEB client's continuable
 * `parser/youtube/Playlist`), which exposes `items` for the current page and
 * `getContinuation()` to fetch the next page. We loop until there is no
 * continuation or the safety cap is reached, collecting every `PlaylistVideo`
 * id along the way.
 *
 * The YTMUSIC client's `music.getPlaylist()` returns a *compact* `Playlist`
 * node (`parser/classes/Playlist`) that only carries `first_videos` with no
 * continuation support, so it cannot be used for large playlists.
 *
 * @param playlistId A YouTube playlist id (`PL...`, `OLAK5uy...`, `RDCLAK...`,
 *   etc.). Also accepts `VL`-prefixed ids and bare ids.
 */
export async function getPlaylist(playlistId: string): Promise<PlaylistMetadata | null> {
  // Use the regular WEB client — the YTMUSIC (WEB_REMIX) client returns a
  // music-formatted browse response whose playlist items the continuable
  // `parser/youtube/Playlist` parser cannot extract.
  const innertube = await getPlaylistInnertube();

  // Normalize: YouTube accepts the bare id; strip a leading "VL" that some
  // URLs carry (e.g. youtube.com/playlist?list=VL...). Innertube.getPlaylist
  // re-adds the VL prefix internally.
  const id = playlistId.replace(/^VL/, '');

  let page: Playlist;
  try {
    page = await innertube.getPlaylist(id);
  } catch (e) {
    console.warn('[playlist] getPlaylist failed:', e instanceof Error ? e.message : e);
    return null;
  }

  const title = page.info?.title ?? 'Unknown Playlist';
  const videoCountText = page.info?.total_items;
  const videoCount = videoCountText ? parseInt(videoCountText.replace(/\D/g, ''), 10) : undefined;

  const allEntries: PlaylistVideoEntry[] = [];
  const seen = new Set<string>();
  let pageIndex = 0;

  for (;;) {
    const items = page.items ?? [];
    for (const item of items) {
      // A playlist page can contain a mix of node types: legacy
      // `PlaylistVideo`, newer `LockupView`, plus `ReelItem` /
      // `ShortsLockupView` for shorts. mapPlaylistItem handles the video
      // variants and returns null for everything else.
      const entry = mapPlaylistItem(item as PlaylistVideo | LockupView, allEntries.length + 1);
      if (!entry) continue;
      if (seen.has(entry.id)) continue; // dedupe across pages
      seen.add(entry.id);
      allEntries.push(entry);
    }

    if (!page.has_continuation) break;
    if (pageIndex >= MAX_PLAYLIST_PAGES) {
      console.warn(
        `[playlist] reached MAX_PLAYLIST_PAGES (${MAX_PLAYLIST_PAGES}) for ${id}; ` +
          `returning ${allEntries.length} of ~${videoCount ?? '?'} videos`
      );
      break;
    }

    try {
      page = await page.getContinuation();
    } catch (e) {
      console.warn(`[playlist] continuation failed on page ${pageIndex + 1}:`, e);
      break;
    }
    pageIndex++;
  }

  if (allEntries.length === 0) return null;

  return {
    id,
    title,
    ...(Number.isFinite(videoCount) ? { videoCount } : {}),
    returnedCount: allEntries.length,
    videoIds: allEntries.map((e) => e.id),
    videos: allEntries
  };
}
