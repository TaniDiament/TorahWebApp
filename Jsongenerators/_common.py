"""Shared helpers for build_all.py and add_content.py.

Everything that touches disk, hashes JSON, builds haystacks, or invokes
the Lucene indexer lives here so the two entry-point scripts stay short.
"""
from __future__ import annotations

import hashlib
import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "source"
DIST = ROOT / "dist"
API = DIST / "api" / "v1"
SEARCH_DIR = API / "search"

# Durable, monotonic publish counter. Lives OUTSIDE dist/ so that a full
# rebuild (build_all wipes dist/) never loses or resets the version.
STATE_PATH = ROOT / ".publish-state.json"

LUCENE_JAR = ROOT / "lucene-indexer" / "target" / "lucene-indexer-1.0.0.jar"

DELTA_TIERS = (1, 5, 50, 500)


# --- io ---------------------------------------------------------------

def read_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def write_json(path: Path, data: Any) -> str:
    """Write JSON deterministically (sorted keys, no trailing whitespace).

    Returns the sha256 of the serialized bytes — used for manifest hashes.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(data, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    blob = payload.encode("utf-8")
    path.write_bytes(blob)
    return hashlib.sha256(blob).hexdigest()


_PUBLISH_TS: str | None = None


def begin_publish() -> str:
    """Freeze one UTC timestamp for the whole publish run so every file
    written in this run shares a single, consistent `generatedAt`."""
    global _PUBLISH_TS
    _PUBLISH_TS = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    return _PUBLISH_TS


def now_iso() -> str:
    return _PUBLISH_TS or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def hash_file(path: Path) -> str:
    """sha256 of an existing file's bytes — for re-hashing a file we didn't
    rewrite this run (e.g. an unchanged index manifest)."""
    return hashlib.sha256(path.read_bytes()).hexdigest()


# --- versioning / publish state ---------------------------------------

def read_publish_state() -> dict:
    if STATE_PATH.exists():
        try:
            return read_json(STATE_PATH)
        except (json.JSONDecodeError, OSError):
            pass
    return {}


def write_publish_state(version: int) -> None:
    """Persist the last published version so the next run continues from it."""
    write_json(STATE_PATH, {"version": version, "updatedAt": now_iso()})


def current_version() -> int:
    """Highest published version known from any durable source.

    The publish counter must be monotonic across both incremental publishes
    and full rebuilds and must never reset — otherwise a client tracking a
    higher version would be handed a lower one and silently wedge. We take
    the max of every source we can find (the persisted state file, the
    published index manifest, and the on-disk full files) so the counter
    survives a lost state file *or* a wiped dist/ as long as either remains.
    Returns 0 when nothing has ever been published.
    """
    candidates = [0]
    state = read_publish_state()
    if isinstance(state.get("version"), int):
        candidates.append(state["version"])
    manifest_path = SEARCH_DIR / "index-manifest.json"
    if manifest_path.exists():
        try:
            v = read_json(manifest_path).get("version")
            if isinstance(v, int):
                candidates.append(v)
        except (json.JSONDecodeError, OSError):
            pass
    if SEARCH_DIR.exists():
        for full in SEARCH_DIR.glob("full-v*.json"):
            try:
                candidates.append(int(full.stem[len("full-v"):]))
            except ValueError:
                pass
    return max(candidates)


# --- summaries / haystacks --------------------------------------------

_TAG_RE = re.compile(r"<[^>]+>")
_PUNCT_RE = re.compile(r"[^a-z0-9]+")


def strip_html(html: str) -> str:
    if not html:
        return ""
    # BeautifulSoup handles malformed markup better than a regex sweep.
    return BeautifulSoup(html, "html.parser").get_text(" ")


def normalize(text: str) -> str:
    return _PUNCT_RE.sub(" ", (text or "").lower()).strip()


def summarize(record: dict, kind: str) -> dict:
    """Project a full record down to a content.json summary entry."""
    common = {
        "id": record["id"],
        "type": kind,
        "title": record["title"],
        "authorId": record["authorId"],
        "topicSlugs": record.get("topicSlugs", []),
        "publishedDate": record["publishedDate"],
        "excerpt": record.get("excerpt"),
        "parshaLabel": record.get("parshaLabel"),
        "thumbnailUrl": record.get("thumbnailUrl"),
        "duration": record.get("duration"),
        "url": record.get("url"),
    }
    if kind == "article":
        common["duration"] = None
    elif kind in ("audio", "video"):
        common["excerpt"] = None
        common["parshaLabel"] = None
        if kind == "audio":
            common["url"] = None
            common["thumbnailUrl"] = None
        if kind == "video" and not common.get("url"):
            common["url"] = None
    return common


def build_haystack(record: dict, kind: str, authors: dict, topics: dict) -> str:
    """Schema-compliant haystack: title + author + topics + parsha + excerpt + body."""
    parts: list[str] = [record.get("title", "")]
    author = authors.get(record.get("authorId"))
    if author:
        parts.append(author.get("name", ""))
    for slug in record.get("topicSlugs", []) or []:
        topic = topics.get(slug)
        if topic:
            parts.append(topic.get("name", ""))
    if record.get("parshaLabel"):
        parts.append(record["parshaLabel"])
    if record.get("excerpt"):
        parts.append(record["excerpt"])
    if record.get("description"):
        parts.append(record["description"])
    if kind == "article" and record.get("content"):
        parts.append(strip_html(record["content"]))
    return normalize(" ".join(p for p in parts if p))


def search_entry(record: dict, kind: str, authors: dict, topics: dict) -> dict:
    return {
        "id": record["id"],
        "type": kind,
        "date": record["publishedDate"],
        "haystack": build_haystack(record, kind, authors, topics),
    }


# --- validation --------------------------------------------------------

def validate_references(summaries: list[dict], authors: dict, topics: dict) -> None:
    """Fail the publish if any summary references an unknown author or topic.

    Implements BACKEND_SCHEMA.md build-script responsibility #2: every
    authorId must exist in authors.json and every topicSlug in topics.json.
    Aborts with a non-zero exit on the first batch of dangling references.
    """
    errors: list[str] = []
    for s in summaries:
        if s.get("authorId") not in authors:
            errors.append(f"{s.get('id')}: unknown authorId {s.get('authorId')!r}")
        for slug in s.get("topicSlugs") or []:
            if slug not in topics:
                errors.append(f"{s.get('id')}: unknown topicSlug {slug!r}")
    if errors:
        print("error: content references unknown authors/topics:", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        sys.exit(1)


# --- Lucene index ------------------------------------------------------

def _ensure_lucene_jar() -> None:
    """Check that the Lucene indexer JAR exists; abort with a helpful
    message if it hasn't been built yet."""
    if LUCENE_JAR.exists():
        return
    print(
        "error: Lucene indexer JAR not found.\n"
        "       Run:  cd lucene-indexer && mvn package\n"
        f"       Expected at: {LUCENE_JAR}",
        file=sys.stderr,
    )
    sys.exit(1)


def build_lucene_index(entries: list[dict]) -> dict:
    """Invoke the Lucene indexer JAR to build a pre-computed inverted index.

    Sends the entries array as JSON on stdin, reads the inverted index
    JSON from stdout.
    """
    _ensure_lucene_jar()
    input_json = json.dumps(entries, ensure_ascii=False)
    result = subprocess.run(
        ["java", "-jar", str(LUCENE_JAR)],
        input=input_json,
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=120,
    )
    if result.returncode != 0:
        print(f"Lucene indexer failed (exit {result.returncode}):", file=sys.stderr)
        print(result.stderr, file=sys.stderr)
        sys.exit(1)
    return json.loads(result.stdout)


# --- manifest writing --------------------------------------------------

def write_manifest(version: int, hashes: dict, counts: dict) -> None:
    manifest = {
        "version": version,
        "generatedAt": now_iso(),
        "counts": counts,
        "hashes": hashes,
    }
    write_json(API / "manifest.json", manifest)


# --- search publish ----------------------------------------------------

def write_search_full(version: int, entries: list[dict]) -> tuple[Path, int]:
    payload = {
        "schemaVersion": 2,
        "version": version,
        "generatedAt": now_iso(),
        "entries": entries,
    }
    path = SEARCH_DIR / f"full-v{version}.json"
    write_json(path, payload)
    return path, path.stat().st_size


def write_search_delta(from_v: int, to_v: int, added: list[dict],
                       updated: list[dict], removed: list[str]) -> tuple[Path, int]:
    payload = {
        "schemaVersion": 2,
        "from": from_v,
        "to": to_v,
        "generatedAt": now_iso(),
        "added": added,
        "updated": updated,
        "removed": removed,
    }
    path = SEARCH_DIR / f"delta-{from_v}-{to_v}.json"
    write_json(path, payload)
    return path, path.stat().st_size


def write_lucene_index(version: int, entries: list[dict]) -> Path:
    """Build and write a Lucene inverted index alongside the full file.
    The app loads this JSON and performs fast term look-ups locally."""
    index_data = build_lucene_index(entries)
    path = SEARCH_DIR / f"lucene-v{version}.json"
    write_json(path, index_data)
    return path


def write_index_manifest(version: int, full_path: Path, full_bytes: int,
                         deltas: list[dict]) -> str:
    payload = {
        "schemaVersion": 2,
        "version": version,
        "generatedAt": now_iso(),
        "fullUrl": f"search/{full_path.name}",
        "fullBytes": full_bytes,
        "luceneUrl": f"search/lucene-v{version}.json",
        "deltas": deltas,
    }
    return write_json(SEARCH_DIR / "index-manifest.json", payload)


def load_full_entries(version: int) -> dict[str, dict] | None:
    """Return {id: entry} for full-v{version}.json, or None if it's absent."""
    path = SEARCH_DIR / f"full-v{version}.json"
    if not path.exists():
        return None
    return {e["id"]: e for e in read_json(path)["entries"]}


def diff_entries(old: dict[str, dict],
                 new: dict[str, dict]) -> tuple[list[dict], list[dict], list[str]]:
    added = [v for k, v in new.items() if k not in old]
    updated = [v for k, v in new.items() if k in old and old[k] != v]
    removed = [k for k in old if k not in new]
    return added, updated, removed


def publish_search(version: int, entries: list[dict]) -> tuple[str, list[dict]]:
    """Publish the whole search tree at `version` and return
    (index-manifest hash, delta metadata list).

    Writes `full-v{N}.json` + `lucene-v{N}.json`, emits one delta per tier
    (1/5/50/500) by diffing the full files still on disk, prunes search/ down
    to {current full+lucene+manifest, the deltas just written, every full in
    the window [N-max(tier), N]}, and writes `index-manifest.json` last.

    The caller must leave the prior `full-v*.json` files in SEARCH_DIR when
    deltas are wanted: add_content keeps them between runs, and build_all
    preserves them across its rebuild.
    """
    new_map = {e["id"]: e for e in entries}
    full_path, full_bytes = write_search_full(version, entries)
    write_lucene_index(version, entries)

    deltas_meta: list[dict] = []
    for tier in DELTA_TIERS:
        from_v = version - tier
        if from_v < 1:
            continue
        old = load_full_entries(from_v)
        if old is None:
            # No full at that boundary (early history, or a rebuild started
            # from no preserved history). Clients that far behind fall through
            # to fullUrl — the documented fallback.
            continue
        added, updated, removed = diff_entries(old, new_map)
        delta_path, delta_bytes = write_search_delta(
            from_v=from_v, to_v=version,
            added=added, updated=updated, removed=removed,
        )
        deltas_meta.append({"from": from_v, "url": f"search/{delta_path.name}", "bytes": delta_bytes})
    deltas_meta.sort(key=lambda d: d["from"], reverse=True)

    # Keep the new full + lucene + manifest, the deltas just emitted, and every
    # full within the largest tier window. The tier boundaries (version - tier)
    # advance by 1 each publish, so over time every version in the window
    # becomes a boundary a future publish must diff against; keeping only the
    # four current boundaries would delete each full two publishes after it is
    # written, collapsing every publish to a single tier-1 delta.
    keep = {full_path.name, f"lucene-v{version}.json", "index-manifest.json"}
    keep |= {Path(d["url"]).name for d in deltas_meta}
    oldest_full = max(1, version - max(DELTA_TIERS))
    for v in range(oldest_full, version + 1):
        keep.add(f"full-v{v}.json")
    for path in SEARCH_DIR.iterdir():
        if path.name not in keep:
            path.unlink()

    h = write_index_manifest(version, full_path, full_bytes, deltas_meta)
    return h, deltas_meta


# --- source loading ----------------------------------------------------

def load_source_records() -> tuple[list[dict], list[dict], list[dict], list[dict], list[dict]]:
    authors = read_json(SOURCE / "authors.json")
    topics = read_json(SOURCE / "topics.json")
    articles = [read_json(p) for p in sorted((SOURCE / "articles").glob("*.json"))]
    audio = [read_json(p) for p in sorted((SOURCE / "audio").glob("*.json"))]
    videos = [read_json(p) for p in sorted((SOURCE / "videos").glob("*.json"))]
    return authors, topics, articles, audio, videos


def index_by(records: Iterable[dict], key: str = "id") -> dict:
    return {r[key]: r for r in records}
