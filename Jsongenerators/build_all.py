"""Full rebuild of the static-JSON backend.

Reads every record under `source/` and writes a fresh `dist/api/v1/` tree.
The Tantivy search index is reset to `version: 1` at
`dist/api/v1/search/tantivy-v1/`.
"""
from __future__ import annotations

import shutil
import sys

from _common import (
    API, DIST, SEARCH_DIR, SOURCE,
    all_docs, all_summaries, build_tantivy_index, index_by,
    load_source_records, read_json,
    write_index_manifest, write_json, write_manifest,
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

    summaries = all_summaries(articles, audio, videos)

    h_authors = write_json(API / "authors.json", authors)
    h_topics = write_json(API / "topics.json", topics)
    h_content = write_json(API / "content.json", summaries)
    h_recent = write_json(API / "recent.json", {"ids": [s["id"] for s in summaries]})

    this_week_path = API / "this-week.json"
    try:
        h_this_week = write_json(this_week_path, read_json(SOURCE / "this-week.json"))
    except FileNotFoundError:
        h_this_week = write_json(this_week_path, {"articleId": None})

    # search: build the Tantivy index at version 1
    docs = all_docs(articles, audio, videos, authors_by_id, topics_by_slug)
    version = 1
    index_dir = SEARCH_DIR / f"tantivy-v{version}"
    build_tantivy_index(index_dir, docs)
    h_search = write_index_manifest(version, index_dir)

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
