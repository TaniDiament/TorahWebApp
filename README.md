# TorahWeb App

React Native iOS/Android app for [torahweb.org](https://www.torahweb.org).

## Repository layout

| Directory | Description |
| --- | --- |
| `TorahWeb/` | React Native app (iOS + Android) |
| `Jsongenerators/` | Python + Java build scripts that produce the static-JSON backend |

## Search architecture

Full-text search is powered by **Apache Lucene**. A small Java CLI
(`Jsongenerators/lucene-indexer/`) tokenizes, stems (EnglishAnalyzer),
and scores every document with BM25, then exports a pre-computed inverted
index as a static JSON file. The Python build scripts call this tool via
`subprocess` and publish the index alongside the other API files.

The React Native app downloads the Lucene index JSON once (with delta
updates thereafter) and performs fast `Map` look-ups in pure TypeScript —
no native Lucene dependency at runtime.

See `Jsongenerators/README.md` for build instructions and
`BACKEND_SCHEMA.md` for the full API contract.
