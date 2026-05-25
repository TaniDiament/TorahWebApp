"""Canonical vocabularies + normalizers for the torahweb.org site importer.

The legacy site encodes author / parsha / yom-tov identity only in file *names*
and free-text, with a decade-plus of inconsistent spellings (``metsora`` vs
``metzora`` vs ``metzorah``; ``breishis`` vs ``braishis`` vs ``bereishis``).
This module turns those raw filename tokens into stable ids, display labels,
and a synthetic civil-calendar date used purely for newest-first ordering.

Nothing here touches disk or HTML — it's pure lookup tables so the importer
stays readable and the mappings are reviewable in one place.
"""
from __future__ import annotations

import re
from typing import NamedTuple

# --- authors -----------------------------------------------------------
#
# prefix (filename token) -> full display name. Names taken verbatim from the
# author/{prefix}.html <title> on the live site. typo prefixes seen in a
# handful of filenames are folded onto the real author via AUTHOR_ALIASES.

AUTHORS: dict[str, str] = {
    "dtwe": "Rabbi Dr. Abraham J. Twerski",
    "rdst": "Rabbi Daniel Stein",
    "rhab": "Rabbi Yakov Haber",
    "rkoe": "Rabbi Eliakim Koenigsberg",
    "rleb": "Rabbi Aryeh Lebowitz",
    "rlop": "Rabbi Ahron Lopiansky",
    "rneu": "Rabbi Yaakov Neuburger",
    "rros": "Rabbi Michael Rosensweig",
    "rsac": "Rabbi Yonason Sacks",
    "rsch": "Rabbi Hershel Schachter",
    "rsob": "Rabbi Zvi Sobolofsky",
    "rtwe": "Rabbi Mayer Twersky",
    "rwil": "Rabbi Mordechai Willig",
    "ryud": "Rabbi Benjamin Yudin",
}

# Misspelled / test prefixes folded onto the real author.
AUTHOR_ALIASES: dict[str, str] = {
    "ryds": "ryud",
    "rwie": "rwil",
    "testrtwe": "rtwe",  # a test file; importer skips it separately by name
}

# Prefixes that are listing pages or test artifacts, never real content.
NON_AUTHOR_PREFIXES = {"speakers", "all", "index", "test"}


def resolve_author(prefix: str) -> str | None:
    """Map a raw filename prefix to a known authorId, or None if unknown."""
    p = prefix.lower()
    p = AUTHOR_ALIASES.get(p, p)
    return p if p in AUTHORS else None


# --- parshiyos ---------------------------------------------------------
#
# Canonical 54-parsha list in *civil-calendar reading order*: the approximate
# (month, day) each is leined in a typical year. Ordering within a single civil
# year is what matters for the app's newest-first sort — e.g. an article filed
# under torah/2024/ for Breishis (leined ~Oct 2024) correctly sorts *after* one
# for Bo (leined ~Jan 2024), because both share the 2024 directory year.

class Parsha(NamedTuple):
    slug: str
    label: str
    month: int
    day: int


# Order = position in this list. Dates are deliberately approximate.
_PARSHA_LIST: list[Parsha] = [
    Parsha("vayechi",     "Vayechi",          1, 5),
    Parsha("shemos",      "Shemos",           1, 12),
    Parsha("vaera",       "Vaera",            1, 19),
    Parsha("bo",          "Bo",               1, 26),
    Parsha("beshalach",   "Beshalach",        2, 2),
    Parsha("yisro",       "Yisro",            2, 9),
    Parsha("mishpatim",   "Mishpatim",        2, 16),
    Parsha("terumah",     "Terumah",          2, 23),
    Parsha("tetzaveh",    "Tetzaveh",         3, 1),
    Parsha("kisisa",      "Ki Sisa",          3, 8),
    Parsha("vayakhel",    "Vayakhel",         3, 15),
    Parsha("pekudei",     "Pekudei",          3, 20),
    Parsha("vayikra",     "Vayikra",          3, 25),
    Parsha("tzav",        "Tzav",             4, 1),
    Parsha("shemini",     "Shemini",          4, 12),
    Parsha("tazria",      "Tazria",           4, 19),
    Parsha("metzora",     "Metzora",          4, 26),
    Parsha("acharei",     "Acharei Mos",      5, 3),
    Parsha("kedoshim",    "Kedoshim",         5, 10),
    Parsha("emor",        "Emor",             5, 17),
    Parsha("behar",       "Behar",            5, 24),
    Parsha("bechukosai",  "Bechukosai",       5, 31),
    Parsha("bamidbar",    "Bamidbar",         6, 1),
    Parsha("naso",        "Naso",             6, 8),
    Parsha("behaaloscha", "Behaaloscha",      6, 15),
    Parsha("shelach",     "Shelach",          6, 22),
    Parsha("korach",      "Korach",           6, 29),
    Parsha("chukas",      "Chukas",           7, 6),
    Parsha("balak",       "Balak",            7, 13),
    Parsha("pinchas",     "Pinchas",          7, 20),
    Parsha("matos",       "Matos",            7, 27),
    Parsha("masei",       "Masei",            8, 1),
    Parsha("devarim",     "Devarim",          8, 3),
    Parsha("vaeschanan",  "Vaeschanan",       8, 10),
    Parsha("eikev",       "Eikev",            8, 17),
    Parsha("reeh",        "Re'eh",            8, 24),
    Parsha("shoftim",     "Shoftim",          8, 31),
    Parsha("kiseitzei",   "Ki Seitzei",       9, 7),
    Parsha("kisavo",      "Ki Savo",          9, 14),
    Parsha("nitzavim",    "Nitzavim",         9, 21),
    Parsha("vayelech",    "Vayelech",         9, 28),
    Parsha("haazinu",     "Haazinu",          10, 5),
    Parsha("vezos",       "Vezos Habracha",   10, 12),
    Parsha("breishis",    "Bereishis",        10, 20),
    Parsha("noach",       "Noach",            10, 27),
    Parsha("lech",        "Lech Lecha",       11, 3),
    Parsha("vayera",      "Vayera",           11, 10),
    Parsha("chayeysara",  "Chayei Sarah",     11, 17),
    Parsha("toldos",      "Toldos",           11, 24),
    Parsha("vayetze",     "Vayetze",          12, 1),
    Parsha("vayishlach",  "Vayishlach",       12, 8),
    Parsha("vayeshev",    "Vayeshev",         12, 15),
    Parsha("mikeitz",     "Mikeitz",          12, 22),
    Parsha("vayigash",    "Vayigash",         12, 29),
]

PARSHA_BY_SLUG: dict[str, Parsha] = {p.slug: p for p in _PARSHA_LIST}
PARSHA_ORDER: dict[str, int] = {p.slug: i for i, p in enumerate(_PARSHA_LIST)}

# Raw filename token -> canonical slug. Covers every spelling variant observed
# in torah/**/parsha/. A combined parsha (e.g. Acharei-Kedoshim) maps to its
# first half — good enough for a label + ordering.
_PARSHA_ALIASES: dict[str, str] = {
    # Bereishis
    "breishis": "breishis", "braishis": "breishis", "beraishis": "breishis",
    "bereishis": "breishis",
    "noach": "noach", "noach2000": "noach", "noach2": "noach",
    "lech": "lech", "lechlecha": "lech",
    "vayera": "vayera",
    "chayey": "chayeysara", "chayeysara": "chayeysara", "chayaysara": "chayeysara",
    "toldos": "toldos",
    "vayetze": "vayetze", "vayetse": "vayetze", "vayeitze": "vayetze",
    "vayeitzei": "vayetze", "vayeitsei": "vayetze", "vayetsei": "vayetze",
    "vayeytze": "vayetze", "vayetzei": "vayetze", "vay": "vayetze",
    "vayishlach": "vayishlach",
    "vayeshev": "vayeshev", "vayeishev": "vayeshev",
    "mikeitz": "mikeitz", "mekeitz": "mikeitz", "miketz": "mikeitz",
    "vayigash": "vayigash",
    "vayechi": "vayechi", "vayech": "vayechi",
    # Shemos
    "shemos": "shemos", "shemot": "shemos",
    "vaera": "vaera", "vaeira": "vaera",
    "bo": "bo",
    "beshalach": "beshalach", "bshalach": "beshalach",
    "yisro": "yisro",
    "mishpatim": "mishpatim",
    "terumah": "terumah", "teruma": "terumah",
    "tetzaveh": "tetzaveh", "tetzave": "tetzaveh", "tetzav": "tetzaveh",
    "tezaveh": "tetzaveh",
    "kisisa": "kisisa", "kisissa": "kisisa", "kitissa": "kisisa", "kisisa2": "kisisa",
    "vayakhel": "vayakhel", "vayakheil": "vayakhel", "vayak": "vayakhel",
    "vapi": "vayakhel",  # Vayakhel-Pikudei (combined -> first half, cf. matos-masei)
    "pikudei": "pekudei", "pekudei": "pekudei",
    # Vayikra
    "vayikra": "vayikra",
    "tzav": "tzav",
    "shmini": "shemini", "shemini": "shemini",
    "tazria": "tazria", "tazriah": "tazria", "taz": "tazria",
    "metzora": "metzora", "metsora": "metzora", "metzorah": "metzora",
    "acharei": "acharei", "achrei": "acharei", "achareimos": "acharei",
    "achmos": "acharei", "achmot": "acharei", "achmoskedoshim": "acharei",
    "kedoshim": "kedoshim",
    "emor": "emor",
    "behar": "behar",
    "bechukosai": "bechukosai", "bchukosai": "bechukosai",
    "bechukotai": "bechukosai",
    # Bamidbar
    "bamidbar": "bamidbar",
    "naso": "naso", "nasso": "naso",
    "behaaloscha": "behaaloscha", "behaalos": "behaaloscha", "behalos": "behaaloscha",
    "bahalos": "behaaloscha", "bhalos": "behaaloscha", "behaloscha": "behaaloscha",
    "shelach": "shelach", "shlach": "shelach",
    "korach": "korach",
    "chukas": "chukas",
    "balak": "balak",
    "pinchas": "pinchas",
    "matos": "matos", "matot": "matos", "matos-masei": "matos",
    "masei": "masei", "massei": "masei",
    # Devarim
    "devarim": "devarim", "dvarim": "devarim", "dvorim": "devarim", "dvorim2": "devarim",
    "vaeschanan": "vaeschanan", "vaetchanan": "vaeschanan", "vetchanan": "vaeschanan",
    "eikev": "eikev", "ekev": "eikev",
    "reeh": "reeh",
    "shoftim": "shoftim",
    "kiseitsei": "kiseitzei", "kiteitsei": "kiseitzei", "kitetzei": "kiseitzei",
    "kiteitzei": "kiseitzei", "teitsei": "kiseitzei",
    "kisavo": "kisavo", "kisovo": "kisavo", "kitavo": "kisavo", "kiseitzei2": "kiseitzei",
    "nitzavim": "nitzavim", "netsavim": "nitzavim", "netzavim": "nitzavim",
    "vayelech": "vayelech",
    "haazinu": "haazinu", "hazinu": "haazinu",
    "vezos": "vezos", "vzos": "vezos",
}


def resolve_parsha(token: str) -> Parsha | None:
    """Map a raw parsha filename token to a canonical Parsha, or None."""
    t = re.sub(r"[^a-z0-9-]", "", token.lower())
    slug = _PARSHA_ALIASES.get(t)
    if slug is None and t in PARSHA_BY_SLUG:
        slug = t
    return PARSHA_BY_SLUG.get(slug) if slug else None


# --- yom tov / moadim --------------------------------------------------

class Chag(NamedTuple):
    label: str
    month: int
    day: int


# Raw moadim filename token -> (display label, approx civil month/day).
_MOADIM: dict[str, Chag] = {}


def _add_chag(label: str, month: int, day: int, *tokens: str) -> None:
    for t in tokens:
        _MOADIM[t] = Chag(label, month, day)


_add_chag("Rosh Hashana", 9, 25, "rh", "rh5781", "roshhashana", "rhyk", "shabrh")
_add_chag("Rosh Chodesh", 6, 15, "rch", "mocharchodesh")  # monthly; neutral mid-year slot
_add_chag("Yom Kippur", 10, 4, "yk", "yomkippur")
_add_chag("Sukkos", 10, 9, "sukkos", "succos", "succot", "sukkot", "tav", "hallel")
_add_chag("Shemini Atzeres", 10, 16, "shminiatzeres", "shemini")
_add_chag("Simchas Torah", 10, 16, "sim")  # end of Sukkos season
_add_chag("Chanukah", 12, 10, "chanu", "chanuka", "chanukah")
_add_chag("Asara B'Teves", 12, 22, "10teves")
_add_chag("Shovavim", 1, 20, "shevat")
_add_chag("The Four Parshios", 3, 1, "shekalim", "zachor", "para", "parah",
          "hachodesh", "4parshas", "bechira", "esther")
_add_chag("Purim", 3, 10, "purim", "adar")
_add_chag("Pesach", 4, 15, "pesach", "pesach2", "hagadol", "gadol", "vhigadta",
          "vhigadt", "chazon")
_add_chag("Sefiras HaOmer", 5, 1, "sefira", "sefirah", "omer", "lagbomer")
_add_chag("Yom Yerushalayim", 5, 18, "yy", "yerushalayim", "israel")
_add_chag("Shavuos", 6, 5, "shavuos", "shavuot")
_add_chag("The Three Weeks", 7, 25, "3weeks", "9days", "9av", "tishabav",
          "tishabaav", "tishbav", "tbav", "tubav", "15av", "nachamu", "nechemta",
          "av", "wtc")
_add_chag("Elul / Yamim Noraim", 9, 15, "elul", "teshuva", "shuva", "noraim",
          "shofar", "malchiyos", "yomkippur")


def resolve_chag(token: str) -> Chag | None:
    """Map a raw moadim filename token to a Chag, or None if unknown."""
    t = re.sub(r"[^a-z0-9]", "", token.lower())
    return _MOADIM.get(t)


# --- topics ------------------------------------------------------------
#
# The app's small topic taxonomy. Every topicSlug a content item carries must
# appear here (the build script validates it).

TOPICS: list[dict] = [
    {
        "id": "parsha", "slug": "parsha", "name": "Parsha",
        "description": "Written divrei Torah on every parsha, by the TorahWeb rebbeim since 1999.",
        "thumbnailUrl": "https://www.torahweb.org/img/home1/course/parsha.jpg",
        "cta": "Read this week",
    },
    {
        "id": "yomtov", "slug": "yomtov", "name": "Yomim Tovim",
        "description": "Divrei Torah focused on the yomim tovim and special days of the Jewish calendar.",
        "thumbnailUrl": "https://www.torahweb.org/img/home1/course/yomtov.jpg",
        "cta": "Prepare for yom tov",
    },
    {
        "id": "special", "slug": "special", "name": "Special Topics",
        "description": "Guidance from the rebbeim on contemporary religious and social issues.",
        "thumbnailUrl": "https://www.torahweb.org/img/home1/course/special.jpg",
        "cta": "Explore",
    },
    {
        "id": "shiurim", "slug": "shiurim", "name": "Audio/Video Shiurim",
        "description": "Recorded yom iyun shiurim from the TorahWeb rebbeim.",
        "thumbnailUrl": "https://www.torahweb.org/img/home1/course/video.jpg",
        "cta": "Watch & listen",
    },
]