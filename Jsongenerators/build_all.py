"""Full rebuild of the static-JSON backend.

Reads every record under `source/` and writes a fresh `dist/api/v1/` tree.
The search index is reset to version 1 with a single `full-v1.json`; no
deltas are emitted by a from-scratch build.
"""
from __future__ import annotations

import shutil
import sys

from _common import (
    API, DIST, SEARCH_DIR,
    index_by, load_source_records,
    search_entry, summarize,
    write_index_manifest, write_json, write_lunr, write_manifest,
    write_search_full,
)


def main() -> int:
    if DIST.exists():
        shutil.rmtree(DIST)
    API.mkdir(parents=True, exist_ok=True)
    SEARCH_DIR.mkdir(parents=True, exist_ok=True)

    authors, topics, articles, audio, videos = load_source_records()
    authors_by_id = index_by(authors)
    topics_by_slug = index_by(topics, key="slug")

    # full per-item files
    for record in articles:
        write_json(API / "articles" / f"{record['id']}.json", record)
    for record in audio:
        write_json(API / "audio" / f"{record['id']}.json", record)
    for record in videos:
        write_json(API / "videos" / f"{record['id']}.json", record)

    # content.json — newest first
    summaries: list[dict] = []
    summaries += [summarize(r, "article") for r in articles]
    summaries += [summarize(r, "audio") for r in audio]
    summaries += [summarize(r, "video") for r in videos]
    summaries.sort(key=lambda s: s["publishedDate"], reverse=True)

    h_authors = write_json(API / "authors.json", authors)
    h_topics = write_json(API / "topics.json", topics)
    h_content = write_json(API / "content.json", summaries)
    h_recent = write_json(API / "recent.json", {"ids": [s["id"] for s in summaries]})

    this_week_path = API / "this-week.json"
    try:
        from _common import SOURCE, read_json
        h_this_week = write_json(this_week_path, read_json(SOURCE / "this-week.json"))
    except FileNotFoundError:
        h_this_week = write_json(this_week_path, {"articleId": None})

    # search: build entries + version-1 full file + Lunr index
    entries = []
    for r in articles:
        entries.append(search_entry(r, "article", authors_by_id, topics_by_slug))
    for r in audio:
        entries.append(search_entry(r, "audio", authors_by_id, topics_by_slug))
    for r in videos:
        entries.append(search_entry(r, "video", authors_by_id, topics_by_slug))
    entries.sort(key=lambda e: e["date"], reverse=True)

    version = 1
    full_path, full_bytes = write_search_full(version, entries)
    write_lunr(version, entries)
    h_search = write_index_manifest(version, full_path, full_bytes, deltas=[])

    write_manifest(
        hashes={
            "authors": h_authors,
            "topics": h_topics,
            "content": h_content,
            "recent": h_recent,
            "thisWeek": h_this_week,
            "searchIndex": h_search,
        },
        counts={
            "authors": len(authors),
            "topics": len(topics),
            "content": len(summaries),
        },
    )

    print(f"built {len(summaries)} items @ search v{version} → {DIST}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
