# JSON generators for torahweb.org/api/v1/

Two scripts produce the static-JSON backend described in
`../BACKEND_SCHEMA.md`:

- `build_all.py` — full rebuild from scratch. Reads `source/`, writes `dist/`.
  Resets the search index version to `1` and emits a single `full-v1.json`
  with no deltas.
- `add_content.py` — incremental publish. Adds (or updates) one item, bumps
  the search index version by 1, regenerates `content.json` / `recent.json` /
  `manifest.json`, writes a new full file, and rebuilds the four delta tiers
  (1 / 5 / 50 / 500) pointing at the new version.

## Search: Apache Lucene

Search indexing is powered by **Apache Lucene** (Java). A small CLI tool
(`lucene-indexer/`) reads the search entries JSON, builds an in-memory
Lucene index using `EnglishAnalyzer` (lowercase, stop-word removal,
Porter stemming) with BM25 scoring, and exports a **pre-computed inverted
index** as JSON. Each publish writes a `lucene-v{N}.json` next to
`full-v{N}.json`.

The React Native app downloads this JSON and queries it locally in pure
TypeScript — no native Lucene dependency at runtime. A matching Porter
stemmer in TypeScript ensures query terms map to the same stems Lucene
used at build time.

**Why Lucene instead of Lunr?**
- Lucene's `EnglishAnalyzer` produces higher-quality tokenization and
  stemming than Lunr's default pipeline.
- BM25 scoring is computed once at build time; query-time look-up is a
  simple `Map.get()` — faster than Lunr's in-memory index traversal.
- The output is a plain JSON file with no library-specific format — the
  app has zero search-library dependencies.

## Prerequisites

- **Python 3.10+** with `pip`
- **JDK 21+** (for the Lucene indexer)
- **Maven 3.8+** (or use the Maven wrapper if included)

## Install

```bash
pip install -r requirements.txt
```

## Build the Lucene indexer (one-time)

```bash
cd lucene-indexer
mvn package
cd ..
```

This produces `lucene-indexer/target/lucene-indexer-1.0.0.jar`. The
Python scripts call it via `java -jar`.

## Source layout

```
source/
  authors.json          # Author[]      — see schema
  topics.json           # Topic[]       — see schema
  articles/{id}.json    # full Article record incl. "content" HTML
  audio/{id}.json       # full audio record
  videos/{id}.json      # full video record
  this-week.json        # { "articleId": "..." } or { "articleId": null }
```

Every file under `articles/`, `audio/`, `videos/` is one full record. The
build derives `content.json` (the summary index) from these.

## First build (from an empty `dist/`)

Do this once, after populating `source/` for the first time, or any time
the source has changed in ways that aren't a single-item add (bulk import,
schema change, manual fix-ups, etc.).

1. **Populate `source/`:**
   - `source/authors.json` — array of `Author` records (see `BACKEND_SCHEMA.md`).
   - `source/topics.json` — array of `Topic` records.
   - `source/this-week.json` — `{"articleId": "<id>"}` or `{"articleId": null}`.
   - `source/articles/{id}.json` — one file per article, full record incl.
     `content` HTML.
   - `source/audio/{id}.json` — one file per audio record.
   - `source/videos/{id}.json` — one file per video record.
2. **Install deps:** `pip install -r requirements.txt`.
3. **Build the Lucene indexer:** `cd lucene-indexer && mvn package && cd ..`
4. **Run the full build:** `python build_all.py`.
   This wipes `dist/` and writes a complete `dist/api/v1/` tree. Search
   index resets to `version: 1` with `full-v1.json` + `lucene-v1.json`
   and no deltas.
5. **Deploy:** upload `dist/api/v1/` to `https://www.torahweb.org/api/v1/`,
   preserving paths. Cache headers per the schema doc:
   - `manifest.json`, `content.json`, `recent.json`, `this-week.json`,
     `index-manifest.json` → `Cache-Control: public, max-age=300, stale-while-revalidate=86400`
     with a strong ETag.
   - `articles/*`, `audio/*`, `videos/*`, `search/full-v*.json`,
     `search/lucene-v*.json`, `search/delta-*.json` →
     `Cache-Control: public, max-age=31536000, immutable` (filenames
     already encode version/id).
   - Serve `search/full-v*.json` and `search/lucene-v*.json` with
     `Content-Encoding: gzip`.
6. **Verify:** open `https://www.torahweb.org/api/v1/manifest.json` in a
   browser; confirm the hashes line up with the files. Launch the app —
   it should fetch `manifest.json`, then everything else, then
   `index-manifest.json` → `lucene-v1.json`.

## Subsequent publishes (adding or updating one item)

Do this every time you publish a new article, audio, or video — one run
per item.

1. **Author the source record.** Drop a new file at
   `source/articles/{id}.json` (or `audio/`, `videos/`). If the `id`
   already exists in `content.json` the run is treated as an update; the
   per-item file under `dist/api/v1/articles|audio|videos/` is overwritten.
2. **(Optional) Update `source/this-week.json`** if the new article should
   become the "this week" pick.
3. **Run the incremental publish:**
   ```
   python add_content.py source/articles/rsch-20260418-01.json
   ```
   The script will:
   - Write `dist/api/v1/articles/{id}.json` (or audio/videos equivalent).
   - Rebuild `content.json` (sorted newest-first) and `recent.json`.
   - Bump `search/index-manifest.json` `version` by 1.
   - Write a fresh `search/full-v{N}.json` and `search/lucene-v{N}.json`.
   - Diff against the tier-boundary full files on disk (1 / 5 / 50 / 500
     versions back) and emit one `search/delta-{from}-{N}.json` per tier
     that has history.
   - Prune `search/` files no longer referenced by the new manifest *or*
     needed by the next publish's tier diffs.
   - Rewrite `manifest.json` with new hashes/counts/timestamp.
4. **Deploy the changed files.** Only files inside `dist/api/v1/` whose
   mtime advanced need to ship. In practice that's:
   `manifest.json`, `content.json`, `recent.json`, `articles|audio|videos/{id}.json`,
   `search/index-manifest.json`, `search/full-v{N}.json`, `search/lucene-v{N}.json`,
   the new `search/delta-*-{N}.json` files, **and** any `search/full-v{N-tier}.json`
   that the prune step kept (used as a build input next time, not served
   to clients but uploading is harmless).
5. **Verify** by re-fetching `manifest.json` and `search/index-manifest.json`
   from the live host. The app will pick up the change on its next
   manifest poll.

### What if I edited several source files at once?

Run `add_content.py` once per file (the search version bumps once per
run, which is what the delta tiers expect), or just run `build_all.py`
and ship the whole tree. Both are correct; `build_all.py` is simpler when
the change set is large.

### What if I deleted a source record?

`add_content.py` doesn't handle removals — re-run `build_all.py`. The
fresh build will omit the removed id, and on the app side the next
manifest fetch will trigger a full re-download (because `version` resets
to 1, which the app sees as either a smaller-than-cached version or a
schema mismatch). For a less disruptive removal flow, bump
`schemaVersion` so the app discards its cache cleanly.
