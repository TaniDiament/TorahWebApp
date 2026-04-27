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


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


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
        timeout=120,
    )
    if result.returncode != 0:
        print(f"Lucene indexer failed (exit {result.returncode}):", file=sys.stderr)
        print(result.stderr, file=sys.stderr)
        sys.exit(1)
    return json.loads(result.stdout)


# --- manifest writing --------------------------------------------------

def write_manifest(hashes: dict, counts: dict) -> None:
    manifest = {
        "version": 1,
        "generatedAt": now_iso(),
        "counts": counts,
        "hashes": hashes,
    }
    write_json(API / "manifest.json", manifest)


# --- search publish ----------------------------------------------------

def write_search_full(version: int, entries: list[dict]) -> tuple[Path, int]:
    payload = {
        "schemaVersion": 1,
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
        "schemaVersion": 1,
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
        "schemaVersion": 1,
        "version": version,
        "generatedAt": now_iso(),
        "fullUrl": f"search/{full_path.name}",
        "fullBytes": full_bytes,
        "luceneUrl": f"search/lucene-v{version}.json",
        "deltas": deltas,
    }
    return write_json(SEARCH_DIR / "index-manifest.json", payload)


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
