"""Full rebuild of the static-JSON backend.

Reads every record under `source/` and rewrites the `dist/api/v1/` tree.

The monotonic publish version is *continued*, never reset: a rebuild bumps
it by one when the search corpus changed, or leaves it untouched when the
rebuilt corpus is byte-identical to what's already published. The prior
`search/full-v*.json` history is preserved across the rebuild so the four
delta tiers can still be emitted — so a rebuild is no more disruptive to
clients than a normal incremental publish.
"""
from __future__ import annotations

import shutil
import sys

from _common import (
    API, DIST, SEARCH_DIR, SOURCE,
    begin_publish, current_version, index_by, load_full_entries,
    load_source_records, publish_search, read_json, search_entry, summarize,
    validate_references, write_json, write_manifest, write_publish_state,
)


def main() -> int:
    # Status output below uses non-ASCII (→); force UTF-8 so a redirected
    # stdout on Windows (cp1252 by default) doesn't crash after the work
    # is already done.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    begin_publish()

    # Capture the current version and published search corpus *before* wiping
    # dist/, so the counter continues and we can tell whether this rebuild
    # actually changed anything.
    prev_version = current_version()
    prev_entries = load_full_entries(prev_version)

    # Wipe everything except the search history (full-v*.json). Dropping the
    # rest guarantees deleted source records don't linger; keeping the fulls
    # lets publish_search still diff the delta tiers across the rebuild.
    if API.exists():
        for child in API.iterdir():
            if child.name == "search":
                for f in child.iterdir():
                    if not (f.name.startswith("full-v") and f.suffix == ".json"):
                        f.unlink()
            elif child.is_dir():
                shutil.rmtree(child)
            else:
                child.unlink()
    API.mkdir(parents=True, exist_ok=True)
    SEARCH_DIR.mkdir(parents=True, exist_ok=True)

    authors, topics, articles, audio, videos = load_source_records()
    authors_by_id = index_by(authors)
    topics_by_slug = index_by(topics, key="slug")

    # content.json — newest first
    summaries: list[dict] = []
    summaries += [summarize(r, "article") for r in articles]
    summaries += [summarize(r, "audio") for r in audio]
    summaries += [summarize(r, "video") for r in videos]
    summaries.sort(key=lambda s: s["publishedDate"], reverse=True)

    # Fail the publish on any dangling author/topic reference before writing.
    validate_references(summaries, authors_by_id, topics_by_slug)

    # full per-item files
    for record in articles:
        write_json(API / "articles" / f"{record['id']}.json", record)
    for record in audio:
        write_json(API / "audio" / f"{record['id']}.json", record)
    for record in videos:
        write_json(API / "videos" / f"{record['id']}.json", record)

    h_authors = write_json(API / "authors.json", authors)
    h_topics = write_json(API / "topics.json", topics)
    h_content = write_json(API / "content.json", summaries)
    h_recent = write_json(API / "recent.json", {"ids": [s["id"] for s in summaries]})

    this_week_path = API / "this-week.json"
    try:
        h_this_week = write_json(this_week_path, read_json(SOURCE / "this-week.json"))
    except FileNotFoundError:
        h_this_week = write_json(this_week_path, {"articleId": None})

    events_path = API / "events.json"
    try:
        h_event = write_json(events_path, read_json(SOURCE / "events.json"))
    except FileNotFoundError:
        h_event = write_json(events_path, {"event": None})

    # search entries
    entries = []
    for r in articles:
        entries.append(search_entry(r, "article", authors_by_id, topics_by_slug))
    for r in audio:
        entries.append(search_entry(r, "audio", authors_by_id, topics_by_slug))
    for r in videos:
        entries.append(search_entry(r, "video", authors_by_id, topics_by_slug))
    entries.sort(key=lambda e: e["date"], reverse=True)

    # Decide the version. Bump only when the search corpus actually changed
    # (BACKEND_SCHEMA.md build-script responsibility #5); a rebuild that
    # produces an identical corpus keeps the version so clients aren't forced
    # to re-sync needlessly. A first-ever build (prev_version 0) starts at 1.
    new_map = {e["id"]: e for e in entries}
    if prev_version >= 1 and prev_entries is not None and new_map == prev_entries:
        version = prev_version
    else:
        version = prev_version + 1

    h_search, _ = publish_search(version, entries)

    write_manifest(
        version=version,
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
            "authors": len(authors),
            "topics": len(topics),
            "content": len(summaries),
        },
    )

    # Persist the counter so the next run continues from here.
    write_publish_state(version)

    if version == prev_version:
        print(f"built {len(summaries)} items @ v{version} (search corpus unchanged) → {DIST}")
    else:
        print(f"built {len(summaries)} items @ v{version} (search v{prev_version} → v{version}) → {DIST}")
    return 0


if __name__ == "__main__":
    sys.exit(main())