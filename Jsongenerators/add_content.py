"""Incremental publish: add (or update) one article / audio / video.

Usage:
    python add_content.py <path-to-source-json>

The path must live under `source/articles/`, `source/audio/`, or
`source/videos/`. The script bumps the search index `version` by 1, rebuilds
the Tantivy index from the *full* current source set into a new
`dist/api/v1/search/tantivy-v{N+1}/` directory, and rewrites the surrounding
manifests. Old `tantivy-v{N}` dirs are kept around for one publish window so
in-flight clients can finish downloading the old set before it disappears.
"""
from __future__ import annotations

import sys
from pathlib import Path

from _common import (
    API, SEARCH_DIR, SOURCE,
    all_docs, all_summaries, build_tantivy_index, index_by,
    load_source_records, prune_old_tantivy_dirs, read_current_version,
    read_json, write_index_manifest, write_json, write_manifest,
)


KIND_BY_DIR = {"articles": "article", "audio": "audio", "videos": "video"}


def kind_from_path(src: Path) -> str:
    try:
        rel = src.resolve().relative_to(SOURCE.resolve())
    except ValueError:
        sys.exit(f"error: {src} is not under {SOURCE}")
    parent = rel.parts[0]
    if parent not in KIND_BY_DIR:
        sys.exit(f"error: source must live in articles/, audio/, or videos/ (got {parent}/)")
    return KIND_BY_DIR[parent]


def main() -> int:
    if len(sys.argv) != 2:
        sys.exit("usage: python add_content.py <path-to-source-json>")
    src = Path(sys.argv[1])
    if not src.exists():
        sys.exit(f"error: {src} not found")

    kind = kind_from_path(src)
    record = read_json(src)
    rec_id = record["id"]

    # Mirror the source file under dist/ so the per-item endpoint works.
    target_dir = {"article": "articles", "audio": "audio", "video": "videos"}[kind]
    write_json(API / target_dir / f"{rec_id}.json", record)

    # Re-load the full source set (including the just-added/updated record)
    # and rebuild every derived artefact from it. The cost is small at this
    # corpus size and avoids a whole class of "stale subset" bugs that come
    # from trying to mutate the index in place.
    authors, topics, articles, audio, videos = load_source_records()
    authors_by_id = index_by(authors)
    topics_by_slug = index_by(topics, key="slug")

    summaries = all_summaries(articles, audio, videos)
    is_update = any(
        Path(API / target_dir).glob(f"{rec_id}.json")
    )  # purely for the printed summary; not load-bearing

    h_content = write_json(API / "content.json", summaries)
    h_recent = write_json(API / "recent.json", {"ids": [s["id"] for s in summaries]})
    h_authors = write_json(API / "authors.json", authors)
    h_topics = write_json(API / "topics.json", topics)
    h_this_week = write_json(
        API / "this-week.json",
        read_json(SOURCE / "this-week.json") if (SOURCE / "this-week.json").exists()
        else {"articleId": None},
    )

    prev_version = read_current_version()
    new_version = prev_version + 1
    docs = all_docs(articles, audio, videos, authors_by_id, topics_by_slug)
    index_dir = SEARCH_DIR / f"tantivy-v{new_version}"
    build_tantivy_index(index_dir, docs)
    h_search = write_index_manifest(new_version, index_dir)
    prune_old_tantivy_dirs(new_version)

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

    verb = "updated" if is_update else "added"
    print(f"{verb} {kind} {rec_id} — search v{prev_version} → v{new_version}, {len(docs)} docs")
    return 0


if __name__ == "__main__":
    sys.exit(main())
