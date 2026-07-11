/**
 * Player-UI-ready metadata shapes returned by the metadata subsystem.
 *
 * These are intentionally plain (no youtubei.js class instances) so they can
 * be serialized straight to JSON for the Express endpoints and consumed by a
 * music player frontend without further transformation.
 */

export interface MetadataThumbnail {
  url: string;
  width: number;
  height: number;
}

export interface MetadataEntity {
  name: string;
  /** YouTube channel/artist id, when available. */
  id?: string;
}

export interface MetadataAlbum {
  name: string;
  /** Release year of the album, when available. */
  year?: number;
  /** YouTube Music album id, when available. */
  id?: string;
}

export interface MetadataDuration {
  seconds: number;
  text: string;
}

/**
 * A single search result or track metadata record.
 *
 * Fields that youtubei.js cannot provide are omitted (or `null` for `album`)
 * rather than fabricated. See `METADATA_LIMITATIONS.md` for details.
 */
export interface TrackMetadata {
  id: string;
  title: string;
  artist: MetadataEntity;
  channel: MetadataEntity;
  album: MetadataAlbum | null;
  duration: MetadataDuration;
  thumbnails: MetadataThumbnail[];
  views?: number;
  likes?: number;
  releaseYear?: number;
  /** Whether the track came from YouTube Music (vs. a plain YouTube video). */
  isMusic: boolean;
}

/** Supported search filters. */
export type SearchType = 'song' | 'video';

export interface SearchOptions {
  /** Filter the results to a given content type. Defaults to `song`. */
  type?: SearchType;
}

/** A single row in a search response. */
export interface SearchResult extends TrackMetadata {}

export interface SearchResponse {
  query: string;
  type: SearchType;
  results: SearchResult[];
  /**
   * youtubei.js does not always expose an exact hit count for music search.
   * Omitted when unavailable.
   */
  estimatedResults?: number;
  /** Suggested refinement queries, when available. */
  refinements?: string[];
}

/** Album track listing (for future `getAlbum` enrichment). */
export interface AlbumTrack {
  id: string;
  title: string;
  duration: MetadataDuration;
  trackNumber?: number;
}

export interface AlbumMetadata {
  id: string;
  name: string;
  year?: number;
  artist?: MetadataEntity;
  thumbnails: MetadataThumbnail[];
  trackCount?: number;
  tracks: AlbumTrack[];
}

export interface ArtistMetadata {
  id: string;
  name: string;
  thumbnails: MetadataThumbnail[];
  subscribers?: string;
}

/**
 * A single video entry from a playlist.
 *
 * Only the fields needed to identify and play a track are included; richer
 * per-video metadata can be fetched on demand via `getMetadata(videoId)`.
 */
export interface PlaylistVideoEntry {
  id: string;
  title: string;
  /** Position of the video in the playlist (1-based). */
  index: number;
  duration?: MetadataDuration;
}

export interface PlaylistMetadata {
  id: string;
  title: string;
  /** Total number of videos reported by YouTube, when available. */
  videoCount?: number;
  /** Number of video ids actually returned (may be less than videoCount for
   * private/deleted entries). */
  returnedCount: number;
  videoIds: string[];
  videos: PlaylistVideoEntry[];
}
