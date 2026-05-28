"""One-shot importer: legacy torahweb.org static site -> Jsongenerators/source/.

Walks the mirrored site under ``<repo>/torahweb.org`` and emits the hand-
authored ``source/`` tree that build_all.py expects:

    source/authors.json
    source/topics.json
    source/articles/{id}.json     (parsha + moadim + special divrei Torah)
    source/audio/{id}.json        (mp3/m4a from each yom-iyun page)
    source/videos/{id}.json       (vimeo embed from each yom-iyun page)
    source/this-week.json
    source/events.json

Design decisions baked in (confirmed with the site owner):
  * Article publishedDate has no day in the source, so we synthesize one from
    the parsha's civil-calendar reading slot (see _taxonomy) inside the article's
    directory year. This orders articles correctly newest-first within a year.
  * Each yom-iyun page embeds both a Vimeo video and an mp3/m4a; we emit BOTH a
    video record and an audio record.
  * Whole corpus (1999-2026).

Audio dates + durations come from the iTunes RSS feeds when available (clean,
authoritative); otherwise the date is parsed from the filename and duration is
left null.

Run:  python import_site.py            # writes source/, prints a summary
      python import_site.py --report   # also writes import_report.txt

Re-runnable: it wipes and rewrites source/articles, source/audio, source/videos
each run, then you run build_all.py.
"""
from __future__ import annotations

import json
import os
import re
import shutil
import sys
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import urljoin
from xml.etree import ElementTree as ET

from bs4 import BeautifulSoup, Comment

from _taxonomy import (
    AUTHORS, NON_AUTHOR_PREFIXES, TOPICS,
    resolve_author, resolve_chag, resolve_parsha,
)

ROOT = Path(__file__).resolve().parent
# The legacy site mirror defaults to <repo>/torahweb.org, but can live anywhere
# (e.g. ~/Downloads) — point at it with the TORAHWEB_SITE env var.
SITE = Path(os.environ.get("TORAHWEB_SITE") or ROOT.parent / "torahweb.org")
SOURCE = ROOT / "source"
SITE_BASE = "https://www.torahweb.org/"

MONTHS = {m: i for i, m in enumerate(
    ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
     "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], start=1)}


# --- report ------------------------------------------------------------

@dataclass
class Report:
    articles: int = 0
    audio: int = 0
    videos: int = 0
    skipped: list[str] = field(default_factory=list)
    unmapped_label: list[str] = field(default_factory=list)
    no_author: list[str] = field(default_factory=list)

    def note_skip(self, path: Path, why: str) -> None:
        self.skipped.append(f"{rel(path)}: {why}")


def rel(path: Path) -> str:
    return path.relative_to(SITE).as_posix()


def site_url(path: Path) -> str:
    return SITE_BASE + rel(path)


# --- html helpers ------------------------------------------------------

_WS = re.compile(r"\s+")


def read_soup(path: Path) -> BeautifulSoup:
    return BeautifulSoup(path.read_text(encoding="utf-8", errors="replace"), "html.parser")


def page_title(soup: BeautifulSoup) -> str:
    t = soup.find("title")
    return _WS.sub(" ", t.get_text(" ")).strip() if t else ""


def dt_title_and_author(soup: BeautifulSoup, fallback_prefix: str) -> tuple[str, str | None]:
    """Pull the essay title and authorId from <h1 class="dt-title">.

    The h1 looks like:  <small><a href="../author/rdst.html">Rabbi…</a></small>Title
    so the title is the h1 text with the <small> author block removed.
    """
    h1 = soup.find("h1", class_="dt-title")
    author_id = None
    title = ""
    if h1:
        small = h1.find("small")
        if small:
            a = small.find("a", href=True)
            if a:
                m = re.search(r"author/([a-z]+)\.html", a["href"], re.I)
                if m:
                    author_id = resolve_author(m.group(1))
            small.extract()
        title = _WS.sub(" ", h1.get_text(" ")).strip()
    if not title:
        # Fallback to <title> = "Essay Title - Author Name"
        title = page_title(soup).rsplit(" - ", 1)[0].strip()
    if author_id is None:
        author_id = resolve_author(fallback_prefix)
    return title, author_id


def clean_body_html(soup: BeautifulSoup) -> str:
    """Return sanitized inner HTML of #dt-content, minus the trailing
    'More divrei Torah from…' navigation links."""
    content = soup.find(id="dt-content")
    if not content:
        return ""
    # Drop the footer nav <p>s: centered paragraphs whose links point back into
    # author/ or parsha/ listings ("More divrei Torah from Rabbi…").
    for p in content.find_all("p"):
        text = p.get_text(" ").strip().lower()
        links = p.find_all("a", href=True)
        if links and text.startswith("more") and any(
            ("/author/" in a["href"] or "/parsha/" in a["href"] or
             a["href"].startswith(("../author", "../../../author", "../parsha",
                                    "../../../parsha")))
            for a in links
        ):
            p.extract()
    # Sanitize: strip active content + event handlers per BACKEND_SCHEMA security note.
    for tag in content.find_all(["script", "style", "iframe", "object", "embed"]):
        tag.extract()
    for comment in content.find_all(string=lambda s: isinstance(s, Comment)):
        comment.extract()
    for tag in content.find_all(True):
        for attr in list(tag.attrs):
            if attr.lower().startswith("on"):
                del tag[attr]
            elif attr.lower() in ("href", "src") and \
                    str(tag.get(attr, "")).strip().lower().startswith("javascript:"):
                del tag[attr]
    return content.decode_contents().strip()


def make_excerpt(body_html: str, limit: int = 220) -> str | None:
    text = _WS.sub(" ", BeautifulSoup(body_html, "html.parser").get_text(" ")).strip()
    if not text:
        return None
    if len(text) <= limit:
        return text
    cut = text[:limit]
    if " " in cut:
        cut = cut[:cut.rfind(" ")]
    return cut + "…"


# --- ids ---------------------------------------------------------------

_used_ids: set[str] = set()


def unique_id(base: str) -> str:
    base = re.sub(r"[^a-z0-9-]+", "-", base.lower()).strip("-")
    candidate = base
    n = 2
    while candidate in _used_ids:
        candidate = f"{base}-{n}"
        n += 1
    _used_ids.add(candidate)
    return candidate


# --- filename parsing --------------------------------------------------

def split_prefix_suffix(stem: str) -> tuple[str, str]:
    """`rdst_bo` -> ('rdst', 'bo'); `rros_09092001` -> ('rros', '09092001')."""
    if "_" in stem:
        prefix, suffix = stem.split("_", 1)
    else:
        prefix, suffix = stem, ""
    return prefix.lower(), suffix


def date_from_digits(digits: str) -> str | None:
    """Decode the date encoded in an audio filename.

    Handles MMDDYY (6), MDDYY (5), MMDDYYYY (8), MDDYYYY (7).
    """
    d = re.sub(r"\D", "", digits)
    if len(d) in (5, 6):
        mm, dd, yy = d[:-4], d[-4:-2], d[-2:]
        year = 2000 + int(yy) if int(yy) <= 50 else 1900 + int(yy)
    elif len(d) in (7, 8):
        mm, dd, year = d[:-6], d[-6:-4], int(d[-4:])
    else:
        return None
    try:
        m, day = int(mm), int(dd)
        if not (1 <= m <= 12 and 1 <= day <= 31):
            return None
        return f"{year:04d}-{m:02d}-{day:02d}"
    except ValueError:
        return None


# --- RSS audio metadata ------------------------------------------------

ITUNES = "{http://www.itunes.com/dtds/podcast-1.0.dtd}"


def parse_rss_dates() -> dict[str, dict]:
    """stem (e.g. 'rsch_061823') -> {date, duration} from the iTunes feeds."""
    meta: dict[str, dict] = {}
    for name in ("yomiyun.rss", "yomiyun_updated.rss"):
        feed = SITE / "xml" / name
        if not feed.exists():
            continue
        try:
            root = ET.fromstring(feed.read_text(encoding="utf-8", errors="replace"))
        except ET.ParseError:
            continue
        for item in root.iter("item"):
            enc = item.find("enclosure")
            if enc is None:
                continue
            stem = Path(enc.get("url", "")).stem
            if not stem:
                continue
            date = rss_date(item.findtext("pubDate", ""))
            dur = rss_duration(item.findtext(f"{ITUNES}duration", ""))
            meta[stem] = {"date": date, "duration": dur}
    return meta


def rss_date(pubdate: str) -> str | None:
    m = re.search(r"(\d{1,2})\s+(\w{3})\s+(\d{4})", pubdate)
    if not m:
        return None
    day, mon, year = int(m.group(1)), m.group(2), int(m.group(3))
    if mon not in MONTHS:
        return None
    return f"{year:04d}-{MONTHS[mon]:02d}-{day:02d}"


def rss_duration(text: str) -> int | None:
    text = text.strip()
    if not text:
        return None
    if ":" in text:
        parts = [int(p) for p in text.split(":")]
        seconds = 0
        for p in parts:
            seconds = seconds * 60 + p
        return seconds
    return int(text) if text.isdigit() else None


# --- article import ----------------------------------------------------

def import_articles(rep: Report) -> dict[str, str]:
    """Write source/articles/*.json. Returns {site relpath -> id} so this-week
    can resolve its redirect target to an id."""
    relpath_to_id: dict[str, str] = {}
    torah = SITE / "torah"
    # Articles are filed under two different path shapes on the site:
    #   torah/YYYY/{parsha,moadim}/*.html   (year first, then category)
    #   torah/special/YYYY/*.html           (category first, then year)
    # The old single glob only matched the year-first shape, so every Special
    # Topics dvar Torah was silently skipped. Collect both shapes as
    # (path, year_str, category) so special content is imported too.
    candidates: list[tuple[Path, str, str]] = []
    for path in torah.glob("[0-9][0-9][0-9][0-9]/*/*.html"):
        candidates.append((path, path.parts[-3], path.parts[-2]))
    for path in torah.glob("special/[0-9][0-9][0-9][0-9]/*.html"):
        candidates.append((path, path.parts[-2], "special"))
    for path, year_str, category in sorted(candidates, key=lambda c: str(c[0])):
        if category not in ("parsha", "moadim", "special"):
            continue
        try:
            year = int(year_str)
        except ValueError:
            continue
        stem = path.stem
        prefix, suffix = split_prefix_suffix(stem)
        if prefix in NON_AUTHOR_PREFIXES or stem.startswith("test") or "copy" in stem.lower():
            rep.note_skip(path, "test/listing/copy artifact")
            continue

        soup = read_soup(path)
        title, author_id = dt_title_and_author(soup, prefix)
        if author_id is None:
            rep.no_author.append(rel(path))
            rep.note_skip(path, f"unknown author prefix {prefix!r}")
            continue
        body = clean_body_html(soup)
        if not body or len(body) < 40:
            rep.note_skip(path, "empty/short body")
            continue

        topic = {"parsha": "parsha", "moadim": "yomtov", "special": "special"}[category]
        parsha_label = None
        month, day = 6, 15  # neutral mid-year default (special, or unmapped)

        if category == "parsha":
            p = resolve_parsha(suffix)
            if p:
                parsha_label, month, day = p.label, p.month, p.day
            else:
                # A yom-tov occasionally filed under parsha/ (e.g. rros_roshHashana).
                # Reclassify to Moadim when the token is a known chag.
                c = resolve_chag(suffix)
                if c:
                    topic = "yomtov"
                    parsha_label, month, day = c.label, c.month, c.day
                else:
                    rep.unmapped_label.append(f"{rel(path)} (parsha token {suffix!r})")
        elif category == "moadim":
            c = resolve_chag(suffix)
            if c:
                parsha_label, month, day = c.label, c.month, c.day
            else:
                rep.unmapped_label.append(f"{rel(path)} (moadim token {suffix!r})")

        published = f"{year:04d}-{month:02d}-{day:02d}"
        slug = (resolve_parsha(suffix).slug if (category == "parsha" and resolve_parsha(suffix))
                else re.sub(r"[^a-z0-9]+", "-", suffix.lower()).strip("-") or category)
        rec_id = unique_id(f"{prefix}-{year}-{slug}")

        record = {
            "id": rec_id,
            "title": title,
            "content": body,
            "authorId": author_id,
            "topicSlugs": [topic],
            "publishedDate": published,
            "parshaLabel": parsha_label,
            "excerpt": make_excerpt(body),
            "url": site_url(path),
        }
        write_record(SOURCE / "articles" / f"{rec_id}.json", record)
        relpath_to_id[rel(path)] = rec_id
        rep.articles += 1
    return relpath_to_id


# --- audio / video import ----------------------------------------------

_AUDIO_PAGE = re.compile(r"^[a-z]+_\d{5,8}(_video)?$")


def import_media(rep: Report, rss: dict[str, dict]) -> None:
    audio_dir = SITE / "audio"
    # Collect single-shiur pages; dedupe the _video.html variant when the base
    # page exists (both render the same shiur; the base already has the embed).
    stems = {p.stem for p in audio_dir.glob("*.html")}
    for path in sorted(audio_dir.glob("*.html")):
        stem = path.stem
        if not _AUDIO_PAGE.match(stem):
            continue  # listing page (allAudio, *_audio, speakers_*, index, …)
        if stem.endswith("_video") and stem[:-6] in stems:
            continue  # duplicate of the base page
        base_stem = stem[:-6] if stem.endswith("_video") else stem
        prefix, suffix = split_prefix_suffix(base_stem)
        author_id = resolve_author(prefix)
        if author_id is None:
            rep.no_author.append(rel(path))
            rep.note_skip(path, f"unknown author prefix {prefix!r}")
            continue

        soup = read_soup(path)
        title, a_id = dt_title_and_author(soup, prefix)
        author_id = a_id or author_id
        html = path.read_text(encoding="utf-8", errors="replace")

        meta = rss.get(base_stem) or {}
        published = meta.get("date") or date_from_digits(suffix) or copyright_year(soup)
        if not published:
            rep.note_skip(path, "no resolvable date")
            continue
        duration = meta.get("duration")

        vimeo = extract_vimeo(html)
        audio_url = extract_audio_url(html, path)
        base_id = f"{prefix}-{suffix}"

        if not vimeo and not audio_url:
            rep.note_skip(path, "no vimeo or audio media found")
            continue

        # The yom-iyun page itself (the one we're parsing) is the canonical
        # "normal webpage" for this shiur — it carries the title, player, and
        # mp3 link. Store it so a shared audio/video link can land there
        # instead of on a bare mp3 / Vimeo. `path` is the exact page, so this
        # captures the _video.html variant correctly for video-only shiurim.
        page_url = site_url(path)
        if audio_url:
            aid = unique_id(f"{base_id}-aud")
            write_record(SOURCE / "audio" / f"{aid}.json", {
                "id": aid,
                "title": title,
                "audioUrl": audio_url,
                "authorId": author_id,
                "topicSlugs": ["shiurim"],
                "publishedDate": published,
                "duration": duration,
                "description": None,
                "url": page_url,
            })
            rep.audio += 1
        if vimeo:
            vid = unique_id(f"{base_id}-vid")
            write_record(SOURCE / "videos" / f"{vid}.json", {
                "id": vid,
                "title": title,
                "vimeoId": vimeo,
                "videoUrl": None,
                "thumbnailUrl": None,
                "authorId": author_id,
                "topicSlugs": ["shiurim"],
                "publishedDate": published,
                "duration": duration,
                "description": None,
                "url": page_url,
            })
            rep.videos += 1


def extract_vimeo(html: str) -> str | None:
    m = re.search(r"player\.vimeo\.com/video/(\d+)", html)
    return m.group(1) if m else None


def extract_audio_url(html: str, path: Path) -> str | None:
    base = site_url(path)
    # Prefer the explicit download link, then the <audio><source>.
    m = re.search(r'href=["\']([^"\']+\.(?:m4a|mp3))["\'][^>]*\bdownload', html, re.I)
    if not m:
        m = re.search(r'<source[^>]+src=["\']([^"\']+\.(?:m4a|mp3))["\']', html, re.I)
    if not m:
        m = re.search(r'src=["\']([^"\']+\.(?:m4a|mp3))["\']', html, re.I)
    if not m:
        return None
    url = urljoin(base, m.group(1))
    return url.replace("http://", "https://")


def copyright_year(soup: BeautifulSoup) -> str | None:
    el = soup.find(id="copyright")
    if el:
        m = re.search(r"(19|20)\d{2}", el.get_text())
        if m:
            return f"{m.group(0)}-06-15"
    return None


# --- this-week / events ------------------------------------------------

def import_this_week(rep: Report, relpath_to_id: dict[str, str]) -> None:
    tw = SITE / "thisweek.html"
    article_id = None
    if tw.exists():
        m = re.search(r'URL=([^"\']+)', tw.read_text(encoding="utf-8", errors="replace"), re.I)
        if m:
            target = m.group(1)
            relpath = re.sub(r"^https?://(www\.)?torahweb\.org/", "", target).split("#")[0]
            article_id = relpath_to_id.get(relpath)
            if article_id is None:
                rep.skipped.append(f"this-week target not in corpus: {relpath}")
    write_json(SOURCE / "this-week.json", {"articleId": article_id})


# --- io ----------------------------------------------------------------

def write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def write_record(path: Path, record: dict) -> None:
    write_json(path, record)


def build_authors() -> list[dict]:
    return [
        {
            "id": prefix,
            "slug": prefix,
            "name": name,
            "bio": None,
            "portraitUrl": (f"{SITE_BASE}img/portraits/480/{prefix}-480.jpg"
                            if (SITE / "img" / "portraits" / "480" / f"{prefix}-480.jpg").exists()
                            else None),
        }
        for prefix, name in sorted(AUTHORS.items())
    ]


# --- main --------------------------------------------------------------

def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if not SITE.exists():
        sys.exit(f"error: site mirror not found at {SITE}")

    # Fresh start for the regenerated trees.
    for sub in ("articles", "audio", "videos"):
        shutil.rmtree(SOURCE / sub, ignore_errors=True)
    SOURCE.mkdir(parents=True, exist_ok=True)

    rep = Report()
    write_json(SOURCE / "authors.json", build_authors())
    write_json(SOURCE / "topics.json", TOPICS)
    write_json(SOURCE / "events.json", {"event": None})

    rss = parse_rss_dates()
    relpath_to_id = import_articles(rep)
    import_media(rep, rss)
    import_this_week(rep, relpath_to_id)

    print(f"authors : {len(AUTHORS)}")
    print(f"topics  : {len(TOPICS)}")
    print(f"articles: {rep.articles}")
    print(f"audio   : {rep.audio}")
    print(f"videos  : {rep.videos}")
    print(f"skipped : {len(rep.skipped)}   unmapped labels: {len(rep.unmapped_label)}"
          f"   unknown authors: {len(rep.no_author)}")
    print(f"\nwrote source/ at {SOURCE}")
    print("next: python build_all.py")

    if "--report" in sys.argv:
        lines = ["# import_report\n", "## skipped\n", *[f"- {s}\n" for s in rep.skipped],
                 "\n## unmapped parsha/moadim labels (kept, neutral date, no label)\n",
                 *[f"- {s}\n" for s in rep.unmapped_label],
                 "\n## unknown author prefixes\n", *[f"- {s}\n" for s in rep.no_author]]
        (ROOT / "import_report.txt").write_text("".join(lines), encoding="utf-8")
        print(f"report  : {ROOT / 'import_report.txt'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())