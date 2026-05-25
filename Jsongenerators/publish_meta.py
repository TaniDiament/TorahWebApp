"""Lightweight publish for the curated, search-independent files.

`events.json` (home-screen banner) and `this-week.json` (the weekly pick) don't
touch the search corpus, so they must NOT trigger a full rebuild or a search
version bump. This script copies whichever of them exist in `source/` into
`dist/`, recomputes only that file's hash, and patches `manifest.json` in place
(same version, same other hashes, refreshed `generatedAt`).

The app re-validates `manifest.json` on launch, sees the one changed hash, and
re-fetches just that file. Search index, deltas, and per-item files are left
exactly as they were.

Usage:
    python publish_meta.py                 # publish event + this-week if present
    python publish_meta.py event           # publish only events.json
    python publish_meta.py this-week       # publish only this-week.json

Deploy: upload the changed files only — manifest.json plus whichever of
events.json / this-week.json this run touched.
"""
from __future__ import annotations

import sys

from _common import API, SOURCE, begin_publish, now_iso, read_json, write_json

# what -> (source filename, dist filename, manifest hash key)
TARGETS = {
    "event": ("events.json", "events.json", "event"),
    "this-week": ("this-week.json", "this-week.json", "thisWeek"),
}


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    begin_publish()

    which = sys.argv[1:] or list(TARGETS)
    unknown = [w for w in which if w not in TARGETS]
    if unknown:
        sys.exit(f"unknown target(s) {unknown}; choose from {list(TARGETS)}")

    manifest_path = API / "manifest.json"
    if not manifest_path.exists():
        sys.exit(f"error: {manifest_path} not found — run build_all.py first.")
    manifest = read_json(manifest_path)

    touched: list[str] = []
    for key in which:
        src_name, dist_name, hash_key = TARGETS[key]
        src = SOURCE / src_name
        if not src.exists():
            print(f"skip {src_name}: not present in source/")
            continue
        h = write_json(API / dist_name, read_json(src))
        manifest["hashes"][hash_key] = h
        touched.append(dist_name)

    if not touched:
        print("nothing to publish.")
        return 0

    manifest["generatedAt"] = now_iso()
    write_json(manifest_path, manifest)

    print(f"published {', '.join(touched)} @ v{manifest['version']} "
          f"(no version bump) → {API}")
    print(f"deploy: manifest.json, {', '.join(touched)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())