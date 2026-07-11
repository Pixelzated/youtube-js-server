# Metadata Subsystem — youtubei.js Limitations

This document records fields that youtubei.js (v17) **cannot reliably provide**
for YouTube Music metadata. The implementation omits these fields (or returns
`null`) rather than fabricating data.

## `getMetadata(videoId)` — TrackMetadata

| Field | Availability | Notes |
| --- | --- | --- |
| `id` | ✅ Always | From the requested video id. |
| `title` | ✅ Always | From `basic_info.title`. |
| `artist` | ✅ Usually | From `basic_info.channel` (the uploader). For music tracks this is typically the artist, but it may differ for compilations. |
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
