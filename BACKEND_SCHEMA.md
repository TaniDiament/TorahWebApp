cu# TorahWeb app — static JSON backend schema

The app reads content from a set of static JSON files hosted on `torahweb.org`.
A publish step on the site writes these files; the app fetches them over HTTPS.
No server-side querying, no query strings — every URL is a flat file that a CDN
can cache.

## Base URL

```
https://www.torahweb.org/api/v1/
```

Bump `v1` → `v2` whenever a field is removed or its meaning changes. Adding
optional fields is backward-compatible and does not need a version bump.

## Caching

Every file should be served with:

- `Cache-Control: public, max-age=300, stale-while-revalidate=86400`
- A strong `ETag` (content hash).

The app always re-validates `manifest.json` on launch; every other file is
fetched with `If-None-Match` and reused from local cache on `304`.

---

## Files

### `manifest.json`

Small pointer file the app hits on every launch to decide what's stale.

```json
{
  "version": 1,
  "generatedAt": "2026-04-24T14:00:00Z",
  "counts": { "authors": 14, "topics": 9, "content": 4821 },
  "hashes": {
    "authors": "a1b2…",
    "topics":  "c3d4…",
    "content": "e5f6…",
    "recent":  "0789…",
    "thisWeek":"aabb…",
    "searchIndex": "ccdd…"
  }
}
```

The app compares `hashes.*` against what it has cached. Anything that changed is
re-fetched; everything else stays on disk.

---

### `authors.json` — `Author[]`

```json
[
  {
    "id": "rsch",
    "slug": "rsch",
    "name": "Rabbi Hershel Schachter",
    "bio": "…optional short bio…",
    "portraitUrl": "https://www.torahweb.org/img/portraits/480/rsch-480.jpg"
  }
]
```

---

### `topics.json` — `Topic[]`

```json
[
  {
    "id": "parsha",
    "slug": "parsha",
    "name": "Parsha",
    "description": "Written divrei Torah on every parsha…",
    "thumbnailUrl": "https://www.torahweb.org/img/home1/course/parsha.jpg",
    "cta": "Read this week"
  }
]
```

---

### `content.json` — `ContentSummary[]`

**The core index.** One entry per article / video / audio. No full bodies —
just enough metadata to render list cards, filter by author/topic, and drive
search. Sorted newest-first by `publishedDate`.

```json
[
  {
    "id": "rsch-20260418-01",
    "type": "article",
    "title": "Lessons from the Seder",
    "authorId": "rsch",
    "topicSlugs": ["parsha", "yomtov"],
    "publishedDate": "2026-04-18",
    "excerpt": "A short preview shown on cards…",
    "parshaLabel": "Metzora",
    "thumbnailUrl": null,
    "duration": null,
    "url": "https://www.torahweb.org/torah/2026/parsha/rsch_metzora.html"
  },
  {
    "id": "rleb-20260420-aud",
    "type": "audio",
    "title": "Daf Yomi — Pesachim 42",
    "authorId": "rleb",
    "topicSlugs": ["dafyomi"],
    "publishedDate": "2026-04-20",
    "excerpt": null,
    "parshaLabel": null,
    "thumbnailUrl": null,
    "duration": 2734,
    "url": null
  },
  {
    "id": "rsob-20260419-vid",
    "type": "video",
    "title": "Chol Hamoed Halachos",
    "authorId": "rsob",
    "topicSlugs": ["yomtov"],
    "publishedDate": "2026-04-19",
    "excerpt": null,
    "parshaLabel": null,
    "thumbnailUrl": "https://i.vimeocdn.com/video/…jpg",
    "duration": 1802,
    "url": null
  }
]
```

Fields:

| Field           | Type                            | Notes |
|-----------------|---------------------------------|-------|
| `id`            | string                          | Stable, globally unique, app uses it as cache key. |
| `type`          | `"article" \| "video" \| "audio"` | |
| `title`         | string                          | |
| `authorId`      | string                          | Must appear in `authors.json`. |
| `topicSlugs`    | string[]                        | Each slug must appear in `topics.json`. |
| `publishedDate` | `YYYY-MM-DD`                    | Used for sort + "newest" listing. |
| `excerpt`       | string \| null                  | 1–2 sentence plain-text preview. |
| `parshaLabel`   | string \| null                  | Only meaningful for parsha articles. |
| `thumbnailUrl`  | string \| null                  | |
| `duration`      | number \| null                  | Seconds, only for audio/video. |
| `url`           | string \| null                  | Canonical torahweb.org page. |

---

### `recent.json`

Just an ordered list of content IDs — lets the site control the "Newest" /
"Recent" ordering without the app needing to re-sort the full corpus.

```json
{ "ids": ["rsch-20260418-01", "rleb-20260420-aud", "rsob-20260419-vid"] }
```

---

### `this-week.json`

```json
{ "articleId": "rsch-20260418-01" }
```

Or `{ "articleId": null }` when there's no current pick.

---

### `articles/{id}.json` — `Article` (full body)

```json
{
  "id": "rsch-20260418-01",
  "title": "Lessons from the Seder",
  "content": "<p>Full HTML body of the article…</p>",
  "authorId": "rsch",
  "topicSlugs": ["parsha", "yomtov"],
  "publishedDate": "2026-04-18",
  "parshaLabel": "Metzora",
  "excerpt": "A short preview…",
  "url": "https://www.torahweb.org/torah/2026/parsha/rsch_metzora.html"
}
```

`content` is sanitized HTML (no `<script>`, no inline JS). The app renders it
with `react-native-render-html`.

---

### `audio/{id}.json` — full audio record

```json
{
  "id": "rleb-20260420-aud",
  "title": "Daf Yomi — Pesachim 42",
  "audioUrl": "https://www.torahweb.org/audio/rleb/pesachim_042.mp3",
  "authorId": "rleb",
  "topicSlugs": ["dafyomi"],
  "publishedDate": "2026-04-20",
  "duration": 2734,
  "description": "Optional notes."
}
```

---

### `videos/{id}.json` — full video record

```json
{
  "id": "rsob-20260419-vid",
  "title": "Chol Hamoed Halachos",
  "vimeoId": "123456789",
  "videoUrl": null,
  "thumbnailUrl": "https://i.vimeocdn.com/video/…jpg",
  "authorId": "rsob",
  "topicSlugs": ["yomtov"],
  "publishedDate": "2026-04-19",
  "duration": 1802,
  "description": null
}
```

Prefer `vimeoId`; use `videoUrl` only if the media isn't on Vimeo.

---

### Search index (`search/`) — client-side full-text corpus with delta updates

The search subtree lets the app do **full-text search over essay bodies** while
only downloading changes since the last time it synced. The site publishes one
small manifest plus a tiered set of full/delta files.

The app caches the full index on disk (via `react-native-blob-util`) and keeps
only a tiny pointer `{version, schemaVersion, generatedAt}` in memory/
`AsyncStorage`-equivalent.

#### `search/index-manifest.json`

Small (~1 KB) pointer file. The app re-fetches it on every search (or every
app launch) to decide whether the local cache is stale.

```json
{
  "schemaVersion": 1,
  "version": 847,
  "generatedAt": "2026-04-24T14:00:00Z",
  "fullUrl": "search/full-v847.json",
  "fullBytes": 10485760,
  "luceneUrl": "search/lucene-v847.json",
  "deltas": [
    { "from": 846, "url": "search/delta-846-847.json", "bytes": 4120 },
    { "from": 840, "url": "search/delta-840-847.json", "bytes": 38200 },
    { "from": 800, "url": "search/delta-800-847.json", "bytes": 210500 },
    { "from": 700, "url": "search/delta-700-847.json", "bytes": 980000 }
  ]
}
```

- `schemaVersion` bumps if the entry shape changes (new field semantics,
  renamed field, etc.). The app must discard the local cache on any
  `schemaVersion` mismatch and re-download the full file.
- `version` is a monotonically increasing integer, incremented on every
  publish that changes any content.
- `fullBytes` / `bytes` are uncompressed sizes; the app uses these to decide
  whether a delta is cheaper than a fresh full download.
- `deltas` is sorted by `from` descending (newest smallest delta first). The
  app walks the list and picks the **first** entry whose `from ≤ localVersion`
  — that's the smallest delta that covers the gap.

#### `search/full-v{N}.json` — full index at version N

```json
{
  "schemaVersion": 1,
  "version": 847,
  "generatedAt": "2026-04-24T14:00:00Z",
  "entries": [
    {
      "id": "rsch-20260418-01",
      "type": "article",
      "date": "2026-04-18",
      "haystack": "lessons from the seder rabbi hershel schachter parsha yomtov metzora …full essay body, lowercased, punctuation stripped…"
    }
  ]
}
```

`haystack` is the concatenation, lowercased and stripped of punctuation, of:
`title`, author `name`, every topic `name`, `parshaLabel`, `excerpt`, and —
for articles — **the full essay body with HTML tags removed**. For audio and
video, also include `description` if present. This is what makes full-text
search work client-side.

Expected size with full bodies: ~5000 entries, average essay ~8 KB of plain
text → **~40 MB uncompressed, ~10 MB gzipped**. Downloaded once on first
launch, then only deltas thereafter.

Serve `full-v{N}.json` with `Content-Encoding: gzip` and long-lived cache
headers (`Cache-Control: public, max-age=31536000, immutable`) — the filename
already encodes the version, so it never needs revalidation.

#### `search/delta-{from}-{to}.json` — delta between two versions

```json
{
  "schemaVersion": 1,
  "from": 846,
  "to": 847,
  "generatedAt": "2026-04-24T14:00:00Z",
  "added":   [ { "id": "…", "type": "article", "date": "…", "haystack": "…" } ],
  "updated": [ { "id": "…", "type": "article", "date": "…", "haystack": "…" } ],
  "removed": [ "old-id-1", "old-id-2" ]
}
```

Applying the delta (done in the app): build `Map<id, entry>` from the cached
entries, delete every `removed` id, `set` every `added` and `updated` entry,
write back to disk. Entries in `updated` are the full replacement — no
field-level diffing.

Same long-lived `immutable` cache headers as the full files.

#### Delta tiering — which delta files to publish

Don't publish `delta-{every-pair}.json`; that explodes quadratically. Instead
always keep roughly these four tiers up to date, pointing from an old version
to the current version:

| Tier | Covers gaps up to | Example (current = 847) |
| ---- | ----------------- | ----------------------- |
| 1    | 1 version         | `delta-846-847.json`    |
| 5    | 5 versions        | `delta-842-847.json`    |
| 50   | 50 versions       | `delta-797-847.json`    |
| 500  | 500 versions      | `delta-347-847.json`    |

On each publish, the build script regenerates one delta file per tier (pointing
to the new current version) and drops the previous tier files that are no
longer referenced by `index-manifest.json`. That's ~4 delta files live at any
moment.

A user behind by any amount `≤500` versions will find a single delta that
covers their gap. Users further behind fall through to `fullUrl`. Tune the
500-tier upward if the corpus sees very frequent publishes and the 500-delta
grows close to `fullBytes`.

#### App-side cache layout

The app stores, on the device's document directory:

- `search-index.json` — the full current entries array, serialized.
- `search-index.meta.json` — `{ schemaVersion, version, generatedAt }`.

On every search (or at app launch, whichever is preferred):

1. Fetch `index-manifest.json`.
2. If `manifest.schemaVersion !== cached.schemaVersion` → discard cache,
   download `fullUrl`.
3. Else if `manifest.version === cached.version` → use cache as is.
4. Else scan `manifest.deltas` for the first entry with `from ≤ cached.version`.
   If that delta's `bytes < fullBytes` → download and apply it. Otherwise
   download `fullUrl`.
5. On any parse error or missing file → fall back to `fullUrl`.

#### Lucene inverted index (`search/lucene-v{N}.json`)

Alongside each `full-v{N}.json`, the build script publishes a
`lucene-v{N}.json` — a pre-computed inverted index built by Apache
Lucene's `EnglishAnalyzer` (lowercase, stop-word removal, Porter
stemming) with BM25 scoring.

```json
{
  "version": 1,
  "analyzer": "EnglishAnalyzer",
  "docCount": 5000,
  "terms": {
    "lesson": [
      { "id": "rsch-20260418-01", "s": 8.42 },
      ...
    ],
    ...
  }
}
```

The app downloads this file (URL from `index-manifest.json`'s
`luceneUrl` field), caches it to disk, and queries it at search time:

1. Tokenize the query: lowercase → remove stop words → Porter stem.
2. Look up each stemmed term in the `terms` map.
3. Intersect posting lists (AND semantics), sum BM25 scores.
4. Return ranked results.
5. Apply `authorId`, `topicSlug`, `contentType` filters by joining
   matched IDs against the in-memory `content.json`.

Same `immutable` cache headers as full/delta files.

If the Lucene index is unavailable, the app falls back to the haystack
substring-matching approach over the entries array.

---

## Why this shape

- **One flat file per concept**, no query strings → every request is a plain
  CDN cache hit.
- **`content.json` is the single source of truth for listings.** All
  "by author", "by topic", "audio only", "newest" views are derived from it
  in-memory; the site doesn't have to pre-bake per-author/per-topic files.
- **Full bodies live in their own files** so that scrolling a list of 5000
  items doesn't pull down 500 MB of article HTML.
- **Search is client-side** over a prebuilt haystack — see below.

---

## Deployment on torahweb.org

Everything below goes under `https://www.torahweb.org/api/v1/`. The path is
literal — the app joins it with the filenames above.

### Full file tree

```
/api/v1/
├── manifest.json
├── authors.json
├── topics.json
├── content.json
├── recent.json
├── this-week.json
├── articles/
│   └── {id}.json              one file per article
├── audio/
│   └── {id}.json              one file per audio shiur
├── videos/
│   └── {id}.json              one file per video shiur
└── search/
    ├── index-manifest.json
    ├── full-v{N}.json         one file per published version (immutable)
    ├── lucene-v{N}.json       pre-computed Lucene inverted index (immutable)
    └── delta-{from}-{to}.json four live files (tiers 1, 5, 50, 500)
```

The `{id}` in per-item filenames is the same `id` used everywhere else
(e.g. `rsch-20260418-01.json`). URL-encode if an id contains a `/`.

### Required HTTP headers

| File group | `Cache-Control` | Notes |
| --- | --- | --- |
| `manifest.json`, `search/index-manifest.json` | `public, max-age=60, stale-while-revalidate=86400` | Revalidated on every app launch. |
| `authors.json`, `topics.json`, `content.json`, `recent.json`, `this-week.json` | `public, max-age=300, stale-while-revalidate=86400` | App uses `ETag` for revalidation. |
| `articles/**`, `audio/**`, `videos/**` | `public, max-age=3600, stale-while-revalidate=86400` | Only fetched on user demand. |
| `search/full-v*.json`, `search/lucene-v*.json`, `search/delta-*.json` | `public, max-age=31536000, immutable` | Filename contains version — never changes. |

Also required on every file:

- `Content-Type: application/json; charset=utf-8`
- `Content-Encoding: gzip` (especially for `content.json` and search files)
- A strong `ETag` (content hash).
- `Access-Control-Allow-Origin: *` — **not needed for the native RN app**
  (no CORS on native `fetch`), but required if a future web build of the app
  reads the same files from a different origin.

### Minimum viable day-one deployment

The app will function with just these files present:

1. `manifest.json`
2. `authors.json`, `topics.json`
3. `content.json`
4. `recent.json`, `this-week.json`
5. One `articles/{id}.json`, `audio/{id}.json`, `videos/{id}.json` for every
   `id` referenced by `content.json`.

Search-related files are **optional**. If `search/index-manifest.json` is
missing or returns 404, the app silently degrades to metadata-only search
(matching against the title/author/topic fields it already has from
`content.json`). So the search subtree can ship in a second pass.

### Build-script responsibilities

Each time the site publishes, a build script runs end-to-end and writes all of
the above. What the script must do:

1. **Scrape or read** the canonical content store (HTML pages, DB — whatever
   the site already uses) and emit in-memory `Author[]`, `Topic[]`, and
   `ContentSummary[]`.
2. **Validate** that every `authorId` in `content.json` exists in
   `authors.json`, and every `topicSlug` exists in `topics.json`. Fail the
   publish on a dangling reference.
3. **Write** `authors.json`, `topics.json`, `content.json`, `recent.json`,
   `this-week.json`, and every per-item file. Sort `content.json` newest-first.
4. **Compute** a SHA-256 of every top-level file, write `manifest.json` with
   those hashes.
5. **Increment** a stored `searchVersion` integer if and only if the set of
   search entries changed (new/removed item, or any entry's haystack changed).
6. **Generate haystacks.** For each content item: concatenate `title`, author
   `name`, every topic `name`, `parshaLabel`, `excerpt`, `description`, and —
   for articles — the full essay body with HTML tags stripped. Lowercase and
   collapse non-alphanumerics to single spaces. This becomes the `haystack`
   field.
7. **Write** `search/full-v{newVersion}.json` (never overwrite an existing
   full file — they're immutable by version).
8. **Compute deltas** against the previous version stored on disk:
   `added` = entries whose id wasn't in the previous version; `removed` =
   ids in the previous version but not the current; `updated` = entries
   whose id existed before but whose haystack changed.
9. **Write** exactly these four delta files (pointing **to** the new
   version): `delta-{N-1}-{N}.json`, `delta-{N-5}-{N}.json`,
   `delta-{N-50}-{N}.json`, `delta-{N-500}-{N}.json`. For each, compose by
   chaining the stored per-step deltas over the gap — or recompute directly
   by diffing the two full files if both are on disk. **Delete** the four
   previous-generation delta files that pointed at version `N-1`.
10. **Write** `search/index-manifest.json` last, with `version: N`,
    `fullUrl`, `fullBytes` (uncompressed byte length), and the four delta
    entries sorted by `from` descending.
11. **Publish atomically.** Write to a staging directory first, then rename
    into place — or use a CDN purge with key-prefix invalidation — so the app
    never reads a manifest that references files not yet uploaded.

### Retention / cleanup

- Keep **all** `full-v{N}.json` files forever unless disk cost becomes a
  problem. Clients that installed the app a year ago and never opened it will
  look up a `fullUrl` by version and expect it to resolve. When deleting old
  fulls, also delete any `delta-*-{oldN}.json` files that point to them.
- Per-item files (`articles/{id}.json` etc.) should be deleted only when the
  content itself is removed, and in that case the removal must also appear in
  the next `content.json` + search delta.

### `bios.json` — not required

Per-author bios live inside `authors.json` via the optional `bio` field; no
separate file needed.

### Security notes

- Sanitize `articles/{id}.json#content` HTML on the site side — the app
  renders it with `react-native-render-html`, which is reasonably safe but
  only as strong as the input. At minimum strip `<script>`, `<iframe>`,
  inline `on*` handlers, and `javascript:` URLs.
- Audio and video URLs should be HTTPS. The app declines cleartext on both
  iOS (ATS) and Android (cleartext is disabled in release builds).

---

## Why this shape

- **One flat file per concept, no query strings** → every request is a plain
  CDN cache hit.
- **`content.json` is the single source of truth for listings.** All
  "by author", "by topic", "audio only", "newest" views are derived from it
  in-memory; the site doesn't have to pre-bake per-author/per-topic files.
- **Full bodies live in their own files** so that scrolling a list of 5000
  items doesn't pull down 500 MB of article HTML.
- **Full-text search is client-side** using a pre-computed Apache Lucene
  inverted index (BM25-scored, stemmed). First launch downloads the
  entries (~10 MB gzipped) plus the Lucene index; every launch after
  fetches a small delta for entries and a fresh Lucene index only when
  the version changes.
