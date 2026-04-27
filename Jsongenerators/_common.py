"""Shared helpers for build_all.py and add_content.py.

Everything that touches disk, hashes JSON, builds search documents, or talks
to Tantivy lives here so the two entry-point scripts stay short.

The search index is built with `tantivy-py`. The output is a directory of
binary segment files at `dist/api/v1/search/tantivy-v{N}/`. The manifest
(`search/index-manifest.json`) lists each file with its size and sha256, so
the app can do per-file delta downloads (skip files whose hash already
matches what's on disk).
"""
from __future__ import annotations

import hashlib
import json
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

import tantivy
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "source"
DIST = ROOT / "dist"
API = DIST / "api" / "v1"
SEARCH_DIR = API / "search"

# How many old tantivy-v{N} dirs to keep around for in-flight clients.
TANTIVY_RETAIN = 2


# --- io ---------------------------------------------------------------

def read_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def write_json(path: Path, data: Any) -> str:
    """Write JSON deterministically. Returns sha256 of serialized bytes."""
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(data, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    blob = payload.encode("utf-8")
    path.write_bytes(blob)
    return hashlib.sha256(blob).hexdigest()


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


# --- text helpers ------------------------------------------------------

_PUNCT_RE = re.compile(r"[^a-z0-9]+")


def strip_html(html: str) -> str:
    if not html:
        return ""
    return BeautifulSoup(html, "html.parser").get_text(" ")


def normalize(text: str) -> str:
    return _PUNCT_RE.sub(" ", (text or "").lower()).strip()


# --- summaries ---------------------------------------------------------

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
    return common


# --- tantivy index building -------------------------------------------

# Field names mirror what the Rust reader expects in `tantivy-bridge/src/lib.rs`.
# Keep them in lockstep — the Tantivy meta.json embeds the schema, but the
# reader still has to look up fields *by name* to extract `id` from each hit.
_FIELDS = ("id", "type", "date", "author_id", "topic_slugs",
           "title", "author_name", "topic_names", "parsha", "excerpt",
           "body", "description")


def _build_schema() -> tantivy.Schema:
    sb = tantivy.SchemaBuilder()
    # Stored / filterable fields use the `raw` tokenizer (no analysis).
    sb.add_text_field("id", stored=True, tokenizer_name="raw")
    sb.add_text_field("type", stored=True, tokenizer_name="raw")
    sb.add_text_field("date", stored=True, tokenizer_name="raw")
    sb.add_text_field("author_id", stored=True, tokenizer_name="raw")
    sb.add_text_field("topic_slugs", stored=True, tokenizer_name="raw")
    # Searchable text fields use the `default` tokenizer (whitespace + lowercase).
    # Bodies aren't stored — we only need `id` back from each hit.
    sb.add_text_field("title", stored=False)
    sb.add_text_field("author_name", stored=False)
    sb.add_text_field("topic_names", stored=False)
    sb.add_text_field("parsha", stored=False)
    sb.add_text_field("excerpt", stored=False)
    sb.add_text_field("body", stored=False)
    sb.add_text_field("description", stored=False)
    return sb.build()


def search_doc(record: dict, kind: str, authors: dict, topics: dict) -> dict:
    """Build the per-record document handed to Tantivy.

    Field-level structure (instead of a single haystack) lets the Rust reader
    apply BM25 scoring with per-field boosts — the whole point of moving from
    Lunr to Tantivy.
    """
    author = authors.get(record.get("authorId"), {})
    topic_names = " ".join(
        topics.get(slug, {}).get("name", "")
        for slug in record.get("topicSlugs", []) or []
    )
    body_text = ""
    if kind == "article" and record.get("content"):
        body_text = strip_html(record["content"])
    return {
        "id": record["id"],
        "type": kind,
        "date": record["publishedDate"],
        "author_id": record.get("authorId", ""),
        "topic_slugs": " ".join(record.get("topicSlugs", []) or []),
        "title": record.get("title", "") or "",
        "author_name": author.get("name", "") or "",
        "topic_names": topic_names,
        "parsha": record.get("parshaLabel") or "",
        "excerpt": record.get("excerpt") or "",
        "body": body_text,
        "description": record.get("description") or "",
    }


def build_tantivy_index(index_dir: Path, docs: Iterable[dict]) -> None:
    """(Re)build the Tantivy index in `index_dir` from `docs`. Idempotent —
    wipes the directory first so partial state from a prior run can't leak."""
    if index_dir.exists():
        shutil.rmtree(index_dir)
    index_dir.mkdir(parents=True)
    schema = _build_schema()
    index = tantivy.Index(schema, path=str(index_dir))
    writer = index.writer(heap_size=64_000_000)
    for d in docs:
        doc = tantivy.Document()
        for field in _FIELDS:
            value = d.get(field, "")
            if value:
                doc.add_text(field, str(value))
        writer.add_document(doc)
    writer.commit()
    writer.wait_merging_threads()


def tantivy_index_files(index_dir: Path) -> list[dict]:
    """List every file in the index directory with its size and sha256.

    The app uses these hashes to decide which files it can reuse from the
    previous version's local copy and which it has to re-download — this is
    where Tantivy's per-file deltas come from.
    """
    out: list[dict] = []
    for p in sorted(index_dir.iterdir()):
        if not p.is_file():
            continue
        blob = p.read_bytes()
        out.append({
            "name": p.name,
            "size": len(blob),
            "sha256": hashlib.sha256(blob).hexdigest(),
        })
    return out


# --- manifest writers --------------------------------------------------

def write_index_manifest(version: int, index_dir: Path) -> str:
    files = tantivy_index_files(index_dir)
    payload = {
        "schemaVersion": 1,
        "version": version,
        "generatedAt": now_iso(),
        "tantivy": {
            "indexDir": f"search/{index_dir.name}/",
            "totalBytes": sum(f["size"] for f in files),
            "files": files,
        },
    }
    return write_json(SEARCH_DIR / "index-manifest.json", payload)


def write_manifest(hashes: dict, counts: dict) -> None:
    manifest = {
        "version": 1,
        "generatedAt": now_iso(),
        "counts": counts,
        "hashes": hashes,
    }
    write_json(API / "manifest.json", manifest)


# --- pruning -----------------------------------------------------------

def prune_old_tantivy_dirs(current_version: int) -> None:
    """Drop any tantivy-v{N} directories older than the retention window so
    `dist/` doesn't grow unbounded across many publishes."""
    if not SEARCH_DIR.exists():
        return
    pattern = re.compile(r"^tantivy-v(\d+)$")
    keep = {f"tantivy-v{current_version - i}" for i in range(TANTIVY_RETAIN + 1)}
    for child in SEARCH_DIR.iterdir():
        if not child.is_dir():
            continue
        if pattern.match(child.name) and child.name not in keep:
            shutil.rmtree(child)


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


def all_docs(articles, audio, videos, authors_by_id, topics_by_slug) -> list[dict]:
    docs: list[dict] = []
    for r in articles:
        docs.append(search_doc(r, "article", authors_by_id, topics_by_slug))
    for r in audio:
        docs.append(search_doc(r, "audio", authors_by_id, topics_by_slug))
    for r in videos:
        docs.append(search_doc(r, "video", authors_by_id, topics_by_slug))
    return docs


def all_summaries(articles, audio, videos) -> list[dict]:
    summaries: list[dict] = []
    summaries += [summarize(r, "article") for r in articles]
    summaries += [summarize(r, "audio") for r in audio]
    summaries += [summarize(r, "video") for r in videos]
    summaries.sort(key=lambda s: s["publishedDate"], reverse=True)
    return summaries


def read_current_version() -> int:
    path = SEARCH_DIR / "index-manifest.json"
    if not path.exists():
        return 0
    try:
        return int(read_json(path).get("version", 0))
    except (ValueError, TypeError):
        return 0
