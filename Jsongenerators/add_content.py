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
    API, SEARCH_DIR, DELTA_TIERS, SOURCE,
    index_by, read_json, search_entry, summarize,
    write_index_manifest, write_json, write_lunr, write_manifest,
    write_search_delta, write_search_full,
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


def load_current_search() -> tuple[int, dict[str, dict]]:
    """Return (current_version, {id: entry}) from the latest full file."""
    manifest_path = SEARCH_DIR / "index-manifest.json"
    if not manifest_path.exists():
        return 0, {}
    manifest = read_json(manifest_path)
    full = read_json(SEARCH_DIR / Path(manifest["fullUrl"]).name)
    return manifest["version"], {e["id"]: e for e in full["entries"]}


def load_full(version: int) -> dict[str, dict] | None:
    path = SEARCH_DIR / f"full-v{version}.json"
    if not path.exists():
        return None
    return {e["id"]: e for e in read_json(path)["entries"]}


def diff_entries(old: dict[str, dict], new: dict[str, dict]) -> tuple[list[dict], list[dict], list[str]]:
    added = [v for k, v in new.items() if k not in old]
    updated = [v for k, v in new.items() if k in old and old[k] != v]
    removed = [k for k in old if k not in new]
    return added, updated, removed


def main() -> int:
    if len(sys.argv) != 2:
        sys.exit("usage: python add_content.py <path-to-source-json>")
    src = Path(sys.argv[1])
    if not src.exists():
        sys.exit(f"error: {src} not found")

    kind = kind_from_path(src)
    record = read_json(src)
    rec_id = record["id"]

    # 1. write the per-item full record
    target_dir = {"article": "articles", "audio": "audio", "video": "videos"}[kind]
    write_json(API / target_dir / f"{rec_id}.json", record)

    # 2. update content.json (add or replace)
    content_path = API / "content.json"
    summaries: list[dict] = read_json(content_path) if content_path.exists() else []
    summary = summarize(record, kind)
    summaries = [s for s in summaries if s["id"] != rec_id]
    summaries.append(summary)
    summaries.sort(key=lambda s: s["publishedDate"], reverse=True)

    # 3. authors / topics for haystack
    authors_by_id = index_by(read_json(API / "authors.json"))
    topics_by_slug = index_by(read_json(API / "topics.json"), key="slug")

    # 4. search: bump version, compute delta vs prior full
    prev_version, prev_entries = load_current_search()
    new_version = prev_version + 1
    new_entry = search_entry(record, kind, authors_by_id, topics_by_slug)

    is_update = rec_id in prev_entries
    new_entries_map = dict(prev_entries)
    new_entries_map[rec_id] = new_entry
    new_entries = sorted(new_entries_map.values(), key=lambda e: e["date"], reverse=True)

    full_path, full_bytes = write_search_full(new_version, new_entries)
    write_lunr(new_version, new_entries)

    # 5. delta tiers — diff each tier-boundary full against the new full.
    # Tier-boundary fulls are kept on disk for exactly this purpose.
    deltas_meta: list[dict] = []
    tier_boundary_versions: set[int] = set()
    for tier in DELTA_TIERS:
        from_v = new_version - tier
        if from_v < 1:
            continue
        old_entries = load_full(from_v)
        if old_entries is None:
            # No historical full at that version (e.g. first few publishes
            # past tier boundary). Skip — users that far behind will fall
            # through to fullUrl, which is the documented fallback.
            continue
        added, updated, removed = diff_entries(old_entries, new_entries_map)
        delta_path, delta_bytes = write_search_delta(
            from_v=from_v, to_v=new_version,
            added=added, updated=updated, removed=removed,
        )
        deltas_meta.append({"from": from_v, "url": f"search/{delta_path.name}", "bytes": delta_bytes})
        tier_boundary_versions.add(from_v)
    deltas_meta.sort(key=lambda d: d["from"], reverse=True)

    # 6. prune old search files no longer referenced. We keep:
    #    - the new full + its lunr index
    #    - the index manifest
    #    - the four tier-boundary full files (so the *next* publish can diff)
    #    - the deltas we just emitted
    keep = {full_path.name, f"lunr-v{new_version}.json", "index-manifest.json"}
    keep |= {Path(d["url"]).name for d in deltas_meta}
    for tier in DELTA_TIERS:
        boundary = new_version + 1 - tier  # boundary the *next* publish will need
        if boundary >= 1:
            keep.add(f"full-v{boundary}.json")
    # Also keep the boundaries the current publish referenced, for safety
    # during the transition until the next publish supersedes them.
    for v in tier_boundary_versions:
        keep.add(f"full-v{v}.json")
    for path in SEARCH_DIR.iterdir():
        if path.name not in keep:
            path.unlink()

    # 7. publish manifests
    h_search = write_index_manifest(new_version, full_path, full_bytes, deltas_meta)
    h_content = write_json(content_path, summaries)
    h_recent = write_json(API / "recent.json", {"ids": [s["id"] for s in summaries]})
    h_authors = write_json(API / "authors.json", read_json(API / "authors.json"))
    h_topics = write_json(API / "topics.json", read_json(API / "topics.json"))
    h_this_week = write_json(API / "this-week.json", read_json(API / "this-week.json"))

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
            "authors": len(read_json(API / "authors.json")),
            "topics": len(read_json(API / "topics.json")),
            "content": len(summaries),
        },
    )

    verb = "updated" if is_update else "added"
    print(f"{verb} {kind} {rec_id} — search v{prev_version} → v{new_version} ({len(deltas_meta)} delta tiers)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
