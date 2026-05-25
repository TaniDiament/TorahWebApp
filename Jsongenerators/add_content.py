"""Incremental publish: add (or update) one article / audio / video.

Usage:
    python add_content.py <path-to-source-json>

The path must live under `source/articles/`, `source/audio/`, or
`source/videos/` — that's how the script knows what `type` to assign. If
the record's `id` already appears in `content.json` the change is treated
as an update; otherwise it's an add.

On every run we bump the search index `version` by 1, write a fresh
`full-v{N}.json`, rebuild the four delta tiers (1 / 5 / 50 / 500), and
prune delta files no longer referenced by the manifest. We also rewrite
`content.json`, `recent.json`, and `manifest.json`.
"""
from __future__ import annotations

import shutil
import sys
from pathlib import Path

from _common import (
    API, SOURCE,
    begin_publish, current_version, index_by, load_full_entries, publish_search,
    read_json, search_entry, summarize, validate_references,
    write_json, write_manifest, write_publish_state,
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
    # Status output below uses non-ASCII (—, →); force UTF-8 so a redirected
    # stdout on Windows (cp1252 by default) doesn't crash after the work is
    # already done.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    begin_publish()

    if len(sys.argv) != 2:
        sys.exit("usage: python add_content.py <path-to-source-json>")
    src = Path(sys.argv[1])
    if not src.exists():
        sys.exit(f"error: {src} not found")

    kind = kind_from_path(src)
    record = read_json(src)
    rec_id = record["id"]

    # authors / topics (published copies) — used for ref validation + haystack
    authors_by_id = index_by(read_json(API / "authors.json"))
    topics_by_slug = index_by(read_json(API / "topics.json"), key="slug")

    summary = summarize(record, kind)
    # Fail the publish on a dangling author/topic reference before writing.
    validate_references([summary], authors_by_id, topics_by_slug)

    # 1. write the per-item full record
    target_dir = {"article": "articles", "audio": "audio", "video": "videos"}[kind]
    write_json(API / target_dir / f"{rec_id}.json", record)

    # 2. update content.json (add or replace)
    content_path = API / "content.json"
    summaries: list[dict] = read_json(content_path) if content_path.exists() else []
    summaries = [s for s in summaries if s["id"] != rec_id]
    summaries.append(summary)
    summaries.sort(key=lambda s: s["publishedDate"], reverse=True)

    # 4. search: bump the monotonic publish counter (it never resets — see
    #    _common.current_version), rebuild the entries map, and publish the
    #    full/lucene/delta tree. publish_search diffs against the full files
    #    kept on disk and prunes the history window.
    prev_version = current_version()
    new_version = prev_version + 1
    prev_entries = load_full_entries(prev_version) or {}
    is_update = rec_id in prev_entries

    new_entries_map = dict(prev_entries)
    new_entries_map[rec_id] = search_entry(record, kind, authors_by_id, topics_by_slug)
    new_entries = sorted(new_entries_map.values(), key=lambda e: e["date"], reverse=True)

    # 5. publish manifests
    h_search, deltas_meta = publish_search(new_version, new_entries)
    h_content = write_json(content_path, summaries)
    h_recent = write_json(API / "recent.json", {"ids": [s["id"] for s in summaries]})
    h_authors = write_json(API / "authors.json", read_json(API / "authors.json"))
    h_topics = write_json(API / "topics.json", read_json(API / "topics.json"))
    # this-week.json: prefer the source file so an incremental publish can
    # change the "this week" pick; fall back to the published copy, then to
    # "no pick". (Mirrors the events.json handling below.)
    tw_src = SOURCE / "this-week.json"
    tw_dist = API / "this-week.json"
    if tw_src.exists():
        tw_payload = read_json(tw_src)
    elif tw_dist.exists():
        tw_payload = read_json(tw_dist)
    else:
        tw_payload = {"articleId": None}
    h_this_week = write_json(tw_dist, tw_payload)

    # Republish events.json so its hash refreshes when the source file changes
    # between publishes. Fall back to whatever's already in dist (or {event: null})
    # if no source file exists.
    events_src = SOURCE / "events.json"
    events_dist = API / "events.json"
    if events_src.exists():
        event_payload = read_json(events_src)
    elif events_dist.exists():
        event_payload = read_json(events_dist)
    else:
        event_payload = {"event": None}
    h_event = write_json(events_dist, event_payload)

    write_manifest(
        version=new_version,
        hashes={
            "authors": h_authors,
            "topics": h_topics,
            "content": h_content,
            "recent": h_recent,
            "thisWeek": h_this_week,
            "event": h_event,
            "searchIndex": h_search,
        },
        counts={
            "authors": len(read_json(API / "authors.json")),
            "topics": len(read_json(API / "topics.json")),
            "content": len(summaries),
        },
    )

    # Persist the new counter so the next run (incremental or a full rebuild)
    # continues from here instead of resetting.
    write_publish_state(new_version)

    verb = "updated" if is_update else "added"
    print(f"{verb} {kind} {rec_id} — search v{prev_version} → v{new_version} ({len(deltas_meta)} delta tiers)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
