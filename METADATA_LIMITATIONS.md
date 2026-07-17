# Metadata Subsystem — youtubei.js Limitations

This document records fields that youtubei.js (v17) **cannot reliably provide**
for YouTube Music metadata. The implementation omits these fields (or returns
`null`) rather than fabricating data.

## `getMetadata(videoId)` — TrackMetadata

| Field | Availability | Notes |
| --- | --- | --- |
| `id` | ✅ Always | From the requested video id. |
| `title` | ✅ Always | From `basic_info.title`. |
| `artist` | ✅ Usually | From the Up Next panel's matching entry's `artists[0]` (parsed from `longBylineText` runs pointing at a real `UC...` channel) — the canonical recording artist, which can differ from the uploading channel (e.g. a fan upload on channel "HouseOfPainTV" still resolves to artist "House of Pain" on its own official channel). Falls back to `basic_info.channel`/`author` (the uploading channel) when Up Next has no artist match. `microformat.tags` was tried as a zero-cost alternative but rejected: it's only `[artist, album, track]` for curated YTMUSIC catalog entries — for regular uploaded music videos it's just the uploader's raw, unordered, lowercase SEO keyword tags. |
| `channel` | ✅ Usually | Same source as `artist`. |
| `album.name` | ✅ For music tracks | Extracted from the Up Next panel's `PlaylistPanelVideo.album`. `null` for standalone videos. |
| `album.year` | ⚠️ Sometimes | Only present when the Up Next panel includes `album.year`. Some tracks omit it even when the album is known. |
| `album.id` | ⚠️ Sometimes | The `MPRE...` album browse id, when the Up Next panel includes it. |
| `duration` | ✅ Always | From `basic_info.duration` (seconds). |
| `thumbnails` | ✅ Always | From `basic_info.thumbnail` (all sizes). |
| `views` | ⚠️ Sometimes | `basic_info.view_count`. YouTube Music frequently hides view counts on the watch page; the field is omitted when unavailable. |
| `likes` | ❌ Rarely | `basic_info.like_count` is almost always `undefined` for YouTube Music tracks. YouTube Music does not display like counts. The field is omitted when unavailable. |
| `releaseYear` | ⚠️ Sometimes | Derived from `album.year` in the Up Next panel. Same availability as `album.year`. |
| `isMusic` | ✅ Always | `true` when retrieved via the YTMUSIC client; `false` when falling back to the WEB client. |

### Likes count

youtubei.js exposes `basic_info.like_count`, but YouTube Music's player
response does not populate this field. For regular YouTube videos (WEB client
fallback), the like count is sometimes available. The metadata endpoint
**omits** `likes` when it is `undefined` rather than returning `0` or a
guessed value.

### Album year

The album release year is only available when the track is part of a known
album **and** the Up Next panel includes the `year` field on the
`PlaylistPanelVideo.album` object. This is not guaranteed for every track.
When unavailable, `album.year` and `releaseYear` are omitted.

## `search(query, { type })` — SearchResponse

| Aspect | Notes |
| --- | --- |
| Result count | YouTube Music returns up to ~20 results per shelf page. Pagination via `getContinuation()` is available but not yet exposed. |
| `views` on search results | `MusicResponsiveListItem.views` is a string and is only present for video-type results. For song results, it is usually absent. |
| `likes` on search results | Not available in search results. |
| `album.year` on search results | Not available in search shelf items (only the album name and id). |
| Refinements | The YouTube Music `Search` parser does not expose refinement suggestions (unlike the regular YouTube `Search`). |

## `getAlbum(albumId)` — AlbumMetadata

| Field | Availability | Notes |
| --- | --- | --- |
| `name` | ✅ Always | From the album header title. |
| `year` | ⚠️ Sometimes | `MusicDetailHeader.year` is present for most albums but not all. Falls back to parsing the `MusicResponsiveHeader.subtitle` text. |
| `artist` | ⚠️ Sometimes | `MusicDetailHeader.author` is not always populated. Some albums (especially compilations) have no artist in the header. |
| `thumbnails` | ✅ Always | From the header's thumbnail array. |
| `tracks` | ✅ Always | From `Album.contents` (MusicResponsiveListItem array). |
| `trackCount` | ✅ Always | Derived from `contents.length`. |

## `getArtist(artistId)` — ArtistMetadata

| Field | Availability | Notes |
| --- | --- | --- |
| `name` | ✅ Always | From the artist header title. |
| `thumbnails` | ✅ Usually | From `MusicImmersiveHeader.thumbnail` or `MusicVisualHeader.thumbnail`. |
| `subscribers` | ⚠️ Sometimes | Extracted from the `SubscribeButton`'s accessibility label (e.g. "Subscribe to this channel. 502 thousand"). Not available for all artists. |

## `getPlaylist(playlistId)` — PlaylistVideoEntry (per video)

Playlist items come from two different node types depending on what YouTube's
web UI returns for a given playlist (the newer `LockupView` is far more
common today, but older/legacy `PlaylistVideo` rows still occur).

| Field | Availability | Notes |
| --- | --- | --- |
| `id` | ✅ Always | Entries without a usable id (private/deleted placeholders) are dropped. |
| `title` | ✅ Always | |
| `index` | ✅ Always | 1-based position in the (deduped) returned list. |
| `duration` | ⚠️ Legacy node only | Only present on `PlaylistVideo` rows. `LockupView` rows never include a duration — call `getMetadata(id)` if needed. |
| `artist.name` | ⚠️ Usually, may be wrong | `PlaylistVideo` rows use the structured `.author.name`; `LockupView` rows fall back to the first metadata row's text. Both are the **uploading channel's display name in this playlist context**, not a resolved recording artist — YouTube sometimes displays the raw channel title here (e.g. `HouseOfPainTV`) even when `getMetadata`'s Up Next lookup resolves the same video to the canonical artist (`House of Pain`, a different channel id). No extra request is made to correct this — see `getMetadata`'s `artist` row above for the accurate source. Omitted if no name is available at all. |
| `artist.id` | ⚠️ Legacy node only | Only `PlaylistVideo`'s `.author.id` provides a channel id (the uploading channel's id, same caveat as `artist.name`). `LockupView`'s metadata rows are plain text with no structured id, so `artist.id` is never set for those rows. |

## General notes

- The metadata subsystem uses a **separate YTMUSIC Innertube instance** from
  the streaming subsystem. Streaming requires the WEB client for PoToken
  generation; metadata uses YTMUSIC for music-oriented fields.
- If a video id is not available on the YTMUSIC client (e.g. non-music
  videos), `getMetadata` falls back to the WEB client's `getBasicInfo`,
  which provides title, channel, duration, views, likes, and thumbnails but
  no album or artist structure (`album: null`, `isMusic: false`).
- All fields that cannot be obtained are **omitted** from the JSON response
  (or `null` for `album`) rather than set to placeholder values.
