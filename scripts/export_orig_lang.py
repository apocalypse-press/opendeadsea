#!/usr/bin/env python3
"""Export original-language wording from DSS Explorer into Open Dead Sea.

Source of the wording: ETCBC/dss via ~/dss-explorer/data/dss.sqlite3.
Lexical repo (credited, not printed as English): ETCBC/BHSA 2021.
See docs/SOURCES.md.
"""
from __future__ import annotations

import json
import re
import shutil
import sqlite3
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB = Path.home() / "dss-explorer" / "data" / "dss.sqlite3"
CORPUS = ROOT / "corpus"
MSS_DIR = CORPUS / "mss"
SITE = ROOT / "site"
SITE_DATA = SITE / "data"
SITE_MSS = SITE / "m"

WORDING_REPO = "https://github.com/ETCBC/dss"
LEXICON_REPO = "https://github.com/ETCBC/bhsa"
LICENSE = "CC BY-NC 4.0"

FAMILIAR = {
    "1Qisaa": "Great Isaiah Scroll",
    "1QS": "Community Rule",
    "1QSa": "Rule of the Congregation",
    "1QSb": "Rule of the Blessings",
    "1QM": "War Scroll",
    "1QpHab": "Habakkuk Pesher",
    "1QHa": "Hodayot",
    "1Q20": "Genesis Apocryphon",
    "11Q19": "Temple Scroll",
    "11Q10": "Targum of Job",
    "11Q13": "Melchizedek",
    "CD": "Damascus Document",
    "1Q3": "1QpaleoLev-Num",
    "2Q5": "2QpaleoLev",
    "4Q11": "4QpaleoGen-Exod a",
    "4Q12": "4QpaleoGen m",
    "4Q22": "4QpaleoExod m",
    "4Q45": "4QpaleoDeut r",
    "4Q46": "4QpaleoDeut s",
    "4Q101": "4QpaleoJob c",
    "6Q1": "6QpaleoGen",
    "6Q2": "6QpaleoLev",
    "11Q1": "11QpaleoLev a",
}

# Entire manuscript is paleo-Hebrew (Abegg stores the letters as square Unicode).
PALEO_FULL = {
    "1Q3", "2Q5", "4Q11", "4Q12", "4Q22", "4Q45", "4Q46", "4Q101", "6Q1", "6Q2", "11Q1",
}

BOOK_NAMES = {
    "Gen": "Genesis",
    "Ex": "Exodus",
    "Exod": "Exodus",
    "Lev": "Leviticus",
    "Num": "Numbers",
    "Deut": "Deuteronomy",
    "Josh": "Joshua",
    "Judg": "Judges",
    "Ruth": "Ruth",
    "1Sam": "1 Samuel",
    "2Sam": "2 Samuel",
    "1Kgs": "1 Kings",
    "2Kgs": "2 Kings",
    "1Chr": "1 Chronicles",
    "2Chr": "2 Chronicles",
    "Ezra": "Ezra",
    "Neh": "Nehemiah",
    "Esth": "Esther",
    "Job": "Job",
    "Ps": "Psalms",
    "Prov": "Proverbs",
    "Qoh": "Qoheleth",
    "Eccl": "Ecclesiastes",
    "Cant": "Song of Songs",
    "Song": "Song of Songs",
    "Is": "Isaiah",
    "Isa": "Isaiah",
    "Jer": "Jeremiah",
    "Lam": "Lamentations",
    "Ezek": "Ezekiel",
    "Dan": "Daniel",
    "Hos": "Hosea",
    "Joel": "Joel",
    "Amos": "Amos",
    "Obad": "Obadiah",
    "Jonah": "Jonah",
    "Mic": "Micah",
    "Nah": "Nahum",
    "Hab": "Habakkuk",
    "Zeph": "Zephaniah",
    "Hag": "Haggai",
    "Zech": "Zechariah",
    "Mal": "Malachi",
}

IAA_FALLBACK = {
    "1Qisaa": {
        "manuscript_number": "1QIsaa",
        "short_name": "1Q Isa",
        "name": "1Q Isaiah",
        "composition_name": "Isaiah",
        "copy": "a",
        "site": "Qumran, Cave 1",
        "iaa_page": "https://www.deadseascrolls.org.il/explore-the-archive/search#q=1QIsaa",
    },
    "1QpHab": {
        "manuscript_number": "1QpHab",
        "short_name": "1QpHab",
        "name": "1Q Pesher Habakkuk",
        "composition_name": "Habakkuk Pesher",
        "copy": "",
        "site": "Qumran, Cave 1",
        "iaa_page": "https://www.deadseascrolls.org.il/explore-the-archive/search#q=1QpHab",
    },
    "1QS": {
        "manuscript_number": "1QS",
        "short_name": "1Q S",
        "name": "1Q Community Rule",
        "composition_name": "Community Rule",
        "copy": "",
        "site": "Qumran, Cave 1",
        "iaa_page": "https://www.deadseascrolls.org.il/explore-the-archive/search#q=1QS",
    },
}

IAA_NAMES: dict = {}


def pretty_siglum(label: str) -> str:
    if label.lower() == "1qisaa":
        return "1QIsaa"
    return (
        label.replace("hev", "Hev")
        .replace("HEV", "Hev")
        .replace("Hev", "Hev")
    )


def load_iaa_names() -> None:
    path = CORPUS / "iaa-names.json"
    if path.exists():
        IAA_NAMES.update(json.loads(path.read_text(encoding="utf-8")))
    for key, rec in IAA_FALLBACK.items():
        cur = IAA_NAMES.get(key)
        if not cur or not cur.get("name") or "Multiple Compositions" in (cur.get("name") or ""):
            IAA_NAMES[key] = rec


def official_names(raw_label: str, familiar: str) -> tuple[str, str, dict]:
    iaa = dict(IAA_NAMES.get(raw_label) or {})
    iaa_num = (iaa.get("manuscript_number") or "").strip()
    siglum = pretty_siglum(raw_label)
    if iaa_num and iaa_num.lower() == raw_label.lower():
        siglum = iaa_num
    elif iaa_num and iaa_num.lower() == siglum.lower():
        siglum = iaa_num
    name = (iaa.get("name") or "").strip()
    if "Multiple Compositions" in name:
        name = familiar or (iaa.get("short_name") or "")
    if not name:
        name = familiar
    return siglum, name, iaa


def book_display(book: str | None, scroll_label: str) -> str:
    if not book:
        return ""
    if book == scroll_label:
        return "Column"
    return BOOK_NAMES.get(book, book)


def chapter_heading(book: str | None, chapter: str | None, scroll_label: str) -> str:
    if not chapter:
        return "Unplaced lines"
    shown = book_display(book, scroll_label)
    if shown == "Column":
        return f"Column {chapter}"
    if shown:
        return f"{shown} {chapter}"
    return f"Chapter {chapter}"


def chapter_slug(book: str | None, chapter: str | None, single_book: bool) -> str:
    ch = str(chapter).strip() if chapter else ""
    if not ch:
        return "unplaced"
    ch_safe = re.sub(r"[^A-Za-z0-9._-]+", "-", ch).strip("-.") or "x"
    if single_book:
        return ch_safe
    b = re.sub(r"[^A-Za-z0-9]+", "", str(book or "x")) or "x"
    return f"{b.lower()}-{ch_safe}"


def chapter_toc(fragments: list, slug: str, scroll_label: str) -> list[dict]:
    books = {ln.get("book") for frag in fragments for ln in frag["lines"] if ln.get("book")}
    single = len(books) == 1
    order: list[dict] = []
    seen: dict[tuple, int] = {}
    for frag in fragments:
        for ln in frag["lines"]:
            key = (ln.get("book") or "", ln.get("chapter") or "")
            if key not in seen:
                seen[key] = len(order)
                cid = chapter_slug(ln.get("book"), ln.get("chapter"), single)
                order.append(
                    {
                        "id": cid,
                        "book": ln.get("book") or None,
                        "chapter": ln.get("chapter") or None,
                        "label": chapter_heading(ln.get("book"), ln.get("chapter"), scroll_label),
                        "short": ln.get("chapter") or "unplaced",
                        "path": f"/m/{slug}/{cid}/",
                        "line_count": 0,
                    }
                )
            order[seen[key]]["line_count"] += 1
    return order


def fragments_for_chapter(fragments: list, book: str | None, chapter: str | None) -> list:
    want_b = book or ""
    want_c = chapter or ""
    out = []
    for frag in fragments:
        lines = [
            ln
            for ln in frag["lines"]
            if (ln.get("book") or "") == want_b and (ln.get("chapter") or "") == want_c
        ]
        if lines:
            out.append({"label": frag["label"], "lines": lines})
    return out


SOURCE_BLOCK = {
    "wording_repo": WORDING_REPO,
    "wording_dataset": "ETCBC/dss",
    "wording_license": LICENSE,
    "wording_credit": "Martin G. Abegg, Jr.; CACCHT; Eep Talstra Centre for Bible and Computer",
    "lexicon_repo": LEXICON_REPO,
    "lexicon_dataset": "ETCBC/BHSA 2021",
    "lexicon_license": LICENSE,
    "lexicon_credit": "Eep Talstra Centre for Bible and Computer",
    "note": "Wording is the DSS diplomatic transcription. BHSA is lexical grounding, not the English of a Qumran line.",
}


def provenance(label: str) -> str:
    lab = label.lower()
    m = re.match(r"^(\d+)q", lab)
    if m:
        return f"Qumran, Cave {m.group(1)}"
    if lab.startswith("cd"):
        return "Cairo Genizah"
    if lab.startswith("mur"):
        return "Wadi Murabbaat"
    if lab.startswith("mas"):
        return "Masada"
    if "hev" in lab:
        return "Nahal Hever"
    if lab.startswith("34se"):
        return "Nahal Seelim"
    return "Other"


FOUND_YEAR = {
    "Qumran, Cave 1": 1947,
    "Qumran, Cave 2": 1952,
    "Qumran, Cave 3": 1952,
    "Qumran, Cave 4": 1952,
    "Qumran, Cave 5": 1952,
    "Qumran, Cave 6": 1952,
    "Qumran, Cave 7": 1952,
    "Qumran, Cave 8": 1952,
    "Qumran, Cave 9": 1952,
    "Qumran, Cave 10": 1952,
    "Qumran, Cave 11": 1956,
    "Masada": 1963,
    "Nahal Hever": 1951,
    "Wadi Murabbaat": 1951,
    "Nahal Seelim": 1960,
    "Cairo Genizah": 1896,
}

SITE_KEYS = {
    "Qumran, Cave 1": "cave-1",
    "Qumran, Cave 2": "cave-2",
    "Qumran, Cave 3": "cave-3",
    "Qumran, Cave 4": "cave-4",
    "Qumran, Cave 5": "cave-5",
    "Qumran, Cave 6": "cave-6",
    "Qumran, Cave 7": "cave-7",
    "Qumran, Cave 8": "cave-8",
    "Qumran, Cave 9": "cave-9",
    "Qumran, Cave 10": "cave-10",
    "Qumran, Cave 11": "cave-11",
    "Masada": "masada",
    "Nahal Hever": "hever",
    "Wadi Murabbaat": "murabbaat",
    "Nahal Seelim": "seelim",
    "Cairo Genizah": "genizah",
    "Other": "other",
}


def normalize_site(raw: str | None) -> str:
    s = (raw or "").strip()
    if not s:
        return "Other"
    m = re.search(r"cave\s*(\d+)", s, re.I)
    if re.search(r"qumran", s, re.I) and m:
        return f"Qumran, Cave {m.group(1)}"
    key = s.lower()
    if "genizah" in key:
        return "Cairo Genizah"
    if "murabba" in key:
        return "Wadi Murabbaat"
    if "masada" in key:
        return "Masada"
    if "hever" in key or "hev" in key:
        return "Nahal Hever"
    if "seelim" in key or "se'elim" in key:
        return "Nahal Seelim"
    return SITE_KEYS.get(s) and s or s


def site_key(site: str) -> str:
    return SITE_KEYS.get(site, "other")


def lang_keys(languages: list[str] | None) -> list[str]:
    joined = " ".join(languages or []).lower()
    keys = []
    if "hebrew" in joined:
        keys.append("hebrew")
    if "aramaic" in joined:
        keys.append("aramaic")
    if "greek" in joined:
        keys.append("greek")
    return keys


def script_keys(script: str | None) -> list[str]:
    return ["paleo"] if script == "paleohebrew" else []


def catalog_fields(provenance_raw: str | None, languages: list[str] | None, script: str | None) -> dict:
    site = normalize_site(provenance_raw)
    found = FOUND_YEAR.get(site)
    return {
        "site": site,
        "site_key": site_key(site),
        "lang_keys": lang_keys(languages),
        "script_keys": script_keys(script),
        "found": found,
    }


SKIP_IAA_TYPES = {
    "Tefillin and Mezuzot",
    "Documents",
    "Scribal Exercise",
    "Unidentified Texts",
    "Biblical Compositions",
    "Biblical Compositions?",
}

COMP_CANON = [
    (r"war scroll|papwar", "War Scroll"),
    (r"community rule", "Community Rule"),
    (r"damascus", "Damascus Document"),
    (r"temple scroll", "Temple Scroll"),
    (r"miqsat|ma`ase ha-torah", "Miqsat Ma'ase ha-Torah"),
    (r"hodayot", "Hodayot"),
    (r"songs of the sabbath", "Songs of the Sabbath Sacrifice"),
    (r"pesher isaiah", "Pesher Isaiah"),
    (r"pesher habakkuk|habakkuk pesher", "Pesher Habakkuk"),
    (r"pesher psalms", "Pesher Psalms"),
    (r"pesher hosea", "Pesher Hosea"),
    (r"pesher micah", "Pesher Micah"),
    (r"pesher nahum", "Pesher Nahum"),
    (r"pesher zephaniah", "Pesher Zephaniah"),
    (r"eschatological commentary", "Eschatological Commentary"),
    (r"commentary on genesis", "Commentary on Genesis"),
    (r"barkhi", "Barkhi Nafshi"),
    (r"berakhot", "Berakhot"),
    (r"festival prayers", "Festival Prayers"),
    (r"rule of the congregation", "Rule of the Congregation"),
    (r"rule of the blessings", "Rule of the Blessings"),
    (r"new jerusalem", "New Jerusalem"),
    (r"^instruction$", "Instruction"),
    (r"^mysteries$", "Mysteries"),
    (r"tohorot", "Tohorot"),
    (r"ordinances", "Ordinances"),
    (r"mishmarot|calendrical|^calendar$", "Calendrical document"),
    (r"pesher on the periods", "Pesher on the Periods"),
]

COMMENTARY_RE = re.compile(r"pesher|commentary|florilegium|catena|midrash", re.I)
LITURGY_RE = re.compile(
    r"hodayot|prayer|hymn|liturg|sabbath sacrifice|barkhi|festival prayers|daily prayers|purification liturgy|personal prayer",
    re.I,
)
COMMUNITY_RE = re.compile(
    r"community rule|damascus|war scroll|temple scroll|miqsat|ma`ase ha-torah|"
    r"rule of the congregation|rule of the blessings|ordinances|tohorot|"
    r"instruction|mysteries|new jerusalem|calendar|mishmarot|halakh|serekh",
    re.I,
)
SKIP_COMP_RE = re.compile(r"^(unidentified|phylacter|mezuzah|account|scribal|multiple compositions)", re.I)
PESHER_LABEL_RE = re.compile(r"p(?:Hab|Isa|Hos|Mic|Nah|Zeph|Ps|Pss)", re.I)


def canon_composition(raw: str) -> str:
    text = (raw or "").strip()
    if not text or SKIP_COMP_RE.search(text):
        return ""
    for pat, name in COMP_CANON:
        if re.search(pat, text, re.I):
            return name
    return text


def classify_community(label: str, name: str, biblical: bool, iaa: dict | None) -> dict:
    if biblical:
        return {"community": None, "composition": None}
    iaa = iaa or {}
    itype = iaa.get("manuscript_type") or ""
    iaa_comp = iaa.get("composition_name") or ""
    blob = " ".join([iaa_comp, name or "", label or "", itype])
    if itype in SKIP_IAA_TYPES or SKIP_COMP_RE.match(iaa_comp or ""):
        # Famous community copies still count even if IAA type is odd (1QS = Multiple Compositions).
        if not (COMMUNITY_RE.search(blob) or PESHER_LABEL_RE.search(label or "") or COMMENTARY_RE.search(blob) or LITURGY_RE.search(blob)):
            return {"community": None, "composition": None}
    composition = canon_composition(iaa_comp) or canon_composition(name or "") or ""
    if PESHER_LABEL_RE.search(label or "") or COMMENTARY_RE.search(blob):
        if not composition:
            composition = "Pesher Habakkuk" if "hab" in (label or "").lower() else "Commentary"
        return {"community": "commentary", "composition": composition}
    if LITURGY_RE.search(blob) and "rule of the blessing" not in blob.lower():
        return {"community": "liturgy", "composition": composition or canon_composition(name or "") or name}
    if COMMUNITY_RE.search(blob) or composition:
        if composition or COMMUNITY_RE.search(blob):
            if not composition:
                composition = canon_composition(name or "") or name or label
            if COMMUNITY_RE.search(blob) or composition in {
                "War Scroll",
                "Community Rule",
                "Damascus Document",
                "Temple Scroll",
                "Miqsat Ma'ase ha-Torah",
                "Rule of the Congregation",
                "Rule of the Blessings",
                "Ordinances",
                "Tohorot",
                "Instruction",
                "Mysteries",
                "New Jerusalem",
                "Calendrical document",
            }:
                return {"community": "other", "composition": composition}
    return {"community": None, "composition": None}


def slugify(label: str) -> str:
    return label.replace("/", "-")


def languages(raw: str | None) -> list[str]:
    if not raw:
        return []
    return [part.strip() for part in str(raw).split(",") if part.strip()]


def script_lang(langs: list[str]) -> tuple[str, str]:
    joined = " ".join(langs).lower()
    if "aramaic" in joined and "hebrew" not in joined:
        return "arc", "rtl"
    if "greek" in joined:
        return "grc", "ltr"
    return "he", "rtl"


PAGE = """\
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <title>{title}. Open Dead Sea.</title>
  <meta name="description" content="{description}">
  <link rel="icon" href="/favicon.ico" sizes="48x48">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <link rel="manifest" href="/site.webmanifest">
  <link href="https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@500;700&family=Inter:wght@400;500;600&family=Lora:ital,wght@0,500;0,600;1,500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/tokens.css">
  <link rel="stylesheet" href="/styles.css">
  <link rel="stylesheet" href="/app.css">
  <script src="/js/icons.js" defer></script>
  <script src="/js/session.js" defer></script>
  <script src="/js/lexicon.js" defer></script>
  <script src="/js/mss-page.js" defer></script>
</head>
<body class="app" data-page="manuscript" data-mss-src="{src}">
  <a class="skip" href="#main">Skip to content</a>
  <header class="shell">
    <div class="shell-bar">
      <a class="mark" href="/">Open Dead Sea</a>
      <nav class="nav" aria-label="Edition">
        <a href="/catalog/" data-nav="catalog">Catalog</a>
        <a href="/work/" data-nav="work">Works</a>
        <a href="/community/" data-nav="community">Community</a>
        <a href="/search/" data-nav="search">Search</a>
        <a href="/about/" data-nav="about">About</a>
      </nav>
      <div id="auth-slot" class="auth-slot">
        <a class="btn btn-secondary" href="/signin/">Sign in</a>
      </div>
    </div>
  </header>
  <main id="main" class="page">
    <nav aria-label="Breadcrumb">
      <ol class="crumbs">
        {crumbs}
      </ol>
    </nav>
    <p class="page-kicker">{kicker}</p>
    <h1 id="mss-title">{h1}</h1>
    <p class="lede" id="mss-lede"></p>
    <div id="script-toggle" class="script-toggle" hidden></div>
    <div id="mss-body"></div>
    <aside class="source-credit" id="mss-credit"></aside>
  </main>
  <footer class="foot">
    <div class="foot-inner">
      <p>opendeadsea.org. Wording: ETCBC/dss (Abegg), CC BY-NC 4.0. Lexical grounding: ETCBC/BHSA 2021, CC BY-NC 4.0. Photographs stay at the libraries that published them.</p>
      <p><a href="/about/">Sources and licenses</a></p>
    </div>
  </footer>
</body>
</html>
"""


def main() -> None:
    if not DB.exists():
        raise SystemExit(f"missing Explorer database {DB}")
    load_iaa_names()

    con = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
    con.row_factory = sqlite3.Row
    meta = {row["key"]: row["value"] for row in con.execute("select key, value from metadata")}
    source = {
        **SOURCE_BLOCK,
        "wording_version": meta.get("corpus_version", "2.0"),
        "wording_commit": meta.get("corpus_commit", ""),
        "explorer_corpus": meta.get("corpus", "ETCBC/dss"),
    }

    scrolls = list(con.execute("select * from scrolls order by label, id"))
    label_counts = Counter(s["label"] for s in scrolls)
    biblical_flags: dict[str, set[int]] = defaultdict(set)
    for s in scrolls:
        biblical_flags[s["label"]].add(int(s["biblical"] or 0))

    def slug_for(s: sqlite3.Row) -> str:
        base = slugify(s["label"])
        if label_counts[s["label"]] == 1:
            return base
        flags = biblical_flags[s["label"]]
        if flags == {0, 1}:
            return f"{base}-biblical" if s["biblical"] else f"{base}-nonbiblical"
        return f"{base}--{s['id']}"

    if MSS_DIR.exists():
        shutil.rmtree(MSS_DIR)
    MSS_DIR.mkdir(parents=True, exist_ok=True)
    site_mss_data = SITE_DATA / "mss"
    if site_mss_data.exists():
        shutil.rmtree(site_mss_data)
    site_mss_data.mkdir(parents=True, exist_ok=True)
    if SITE_MSS.exists():
        shutil.rmtree(SITE_MSS)
    SITE_MSS.mkdir(parents=True, exist_ok=True)

    index = []
    for s in scrolls:
        slug = slug_for(s)
        langs = languages(s["languages"])
        lang, direction = script_lang(langs)
        familiar = FAMILIAR.get(s["label"], "")
        if label_counts[s["label"]] > 1 and s["label"] == "11Q5" and s["biblical"]:
            familiar = "Psalms Scroll"
        lines = list(
            con.execute(
                """
                select l.id as line_id, f.label as frag, l.reference, l.text, l.word_count, l.sort_order,
                       l.book, l.chapter, l.verse
                from lines l
                join fragments f on f.id = l.fragment_id
                where l.scroll_id = ?
                order by l.sort_order
                """,
                (s["id"],),
            )
        )
        paleo_line_ids = {
            row[0]
            for row in con.execute(
                """
                select distinct l.id from lines l
                join words w on w.line_id = l.id
                where l.scroll_id = ? and w.script = 'paleohebrew'
                """,
                (s["id"],),
            )
        }
        line_words: dict[int, list[tuple[str, str | None]]] = defaultdict(list)
        for row in con.execute(
            """
            select w.line_id, w.text, w.script
            from words w
            join lines l on l.id = w.line_id
            where l.scroll_id = ?
            order by l.sort_order, w.position
            """,
            (s["id"],),
        ):
            line_words[int(row[0])].append((row[1] or "", row[2]))
        mixed_words: dict[int, list[dict]] = {}
        if paleo_line_ids and s["label"] not in PALEO_FULL:
            for lid in paleo_line_ids:
                mixed_words[int(lid)] = [
                    {
                        "t": text,
                        "script": "paleo" if script == "paleohebrew" else "square",
                    }
                    for text, script in line_words.get(int(lid), [])
                ]
        translations: dict[int, str] = {}
        for row in con.execute(
            """
            select t.line_id, t.translation
            from translations t
            join lines l on l.id = t.line_id
            where l.scroll_id = ? and t.validation_status = 'valid'
              and t.translation is not null and trim(t.translation) != ''
            order by t.id
            """,
            (s["id"],),
        ):
            translations[int(row[0])] = str(row[1]).strip()
        if s["label"] in PALEO_FULL:
            script = "paleohebrew"
        elif paleo_line_ids:
            script = "mixed"
        elif "Greek" in langs and "Hebrew" not in langs and "Aramaic" not in langs:
            script = "greek"
        else:
            script = "hebrew" if lang == "he" else ("aramaic" if lang == "arc" else "other")

        fragments = []
        current = None
        nonempty = 0
        for row in lines:
            frag = str(row["frag"] or "")
            if current is None or current["label"] != frag:
                current = {"label": frag, "lines": []}
                fragments.append(current)
            text = (row["text"] or "").strip()
            rec = {"ref": row["reference"], "text": text}
            book = (row["book"] or "").strip()
            chapter = (row["chapter"] or "").strip()
            verse = (row["verse"] or "").strip()
            if book:
                rec["book"] = book
            if chapter:
                rec["chapter"] = chapter
            if verse:
                rec["verse"] = verse
            if not text or int(row["word_count"] or 0) == 0:
                rec["lacuna"] = True
            else:
                nonempty += 1
            lid = int(row["line_id"])
            tokens = line_words.get(lid)
            if tokens:
                rec["spaced"] = " ".join(tok for tok, _ in tokens)
            words = mixed_words.get(lid)
            if words:
                rec["words"] = words
            en = translations.get(lid)
            if en:
                rec["en"] = en
                rec["en_kind"] = "machine-aid"
            current["lines"].append(rec)

        siglum, official_name, iaa = official_names(s["label"], familiar)
        iaa_url = iaa.get("iaa_page") or s["iaa_url"]
        if iaa_url and "search#q=" in str(iaa_url):
            iaa_url = f"https://www.deadseascrolls.org.il/explore-the-archive/search#q={siglum}"
        payload = {
            "id": slug,
            "label": siglum,
            "name": official_name,
            "iaa_short": iaa.get("short_name") or "",
            "iaa_copy": iaa.get("copy") or "",
            "provenance": iaa.get("site") or provenance(s["label"]),
            "biblical": bool(s["biblical"]),
            "languages": langs,
            "lang": lang,
            "dir": direction,
            "script": script,
            "fragment_count": int(s["fragment_count"] or 0),
            "line_count": int(s["line_count"] or 0),
            "word_count": int(s["word_count"] or 0),
            "translation_count": sum(1 for frag in fragments for ln in frag["lines"] if ln.get("en")),
            "iaa_url": iaa_url,
            "museum_url": s["museum_url"],
            "source": source,
            "fragments": fragments,
        }
        written = _write_mss(payload, slug, official_name)
        page_dir = SITE_MSS / slug
        kids = [p.name for p in page_dir.iterdir() if p.is_dir()] if page_dir.is_dir() else []
        chapter_bare = bool(kids) and all(k.isdigit() or k == "unplaced" for k in kids)

        facets = catalog_fields(payload["provenance"], langs, script)
        community = classify_community(s["label"], official_name, bool(s["biblical"]), iaa)
        index.append(
            {
                "id": slug,
                "label": siglum,
                "name": official_name,
                "provenance": facets["site"],
                "site": facets["site"],
                "site_key": facets["site_key"],
                "found": facets["found"],
                "biblical": payload["biblical"],
                "languages": langs,
                "lang_keys": facets["lang_keys"],
                "script": script,
                "script_keys": facets["script_keys"],
                "fragment_count": payload["fragment_count"],
                "line_count": payload["line_count"],
                "chapter_count": written.get("chapter_count") or None,
                "chapter_bare": chapter_bare,
                "community": community.get("community"),
                "composition": community.get("composition"),
                "word_count": payload["word_count"],
                "iaa_url": payload["iaa_url"],
                "museum_url": s["museum_url"],
                "path": f"/m/{slug}/",
                "lines_with_text": nonempty,
            }
        )

    extras_path = CORPUS / "extra-mss.json"
    if extras_path.exists():
        extras = json.loads(extras_path.read_text(encoding="utf-8"))
        seen = {item["id"] for item in index} | {item["label"] for item in index}
        extra_source = {
            **SOURCE_BLOCK,
            "wording_dataset": "not in ETCBC/dss",
            "note": extras.get("note", "Greek wording is not in the Abegg Hebrew/Aramaic dump."),
        }
        for rec in extras.get("manuscripts", []):
            if rec["id"] in seen or rec["label"] in seen:
                continue
            payload = _extra_payload(rec, extra_source)
            _write_mss(payload, rec["id"], rec.get("name") or "")
            index.append(_extra_index(payload))
            seen.add(rec["id"])
        cave7 = extras.get("cave7_unidentified") or {}
        for n in range(int(cave7.get("from", 3)), int(cave7.get("to", 19)) + 1):
            lab = f"7Q{n}"
            if lab in seen:
                continue
            rec = {
                "id": lab,
                "label": lab,
                "name": "",
                "provenance": cave7.get("provenance", "Qumran cave 7"),
                "biblical": False,
                "languages": cave7.get("languages", ["Greek"]),
                "script": "greek",
                "lang": "grc",
                "dir": "ltr",
                "contents": cave7.get("contents", "Unidentified Greek fragment."),
                "iaa_url": f"https://www.deadseascrolls.org.il/explore-the-archive/manuscript/{lab}-1",
                "wording_status": "absent",
            }
            payload = _extra_payload(rec, extra_source)
            _write_mss(payload, lab, "")
            index.append(_extra_index(payload))
            seen.add(lab)

    index.sort(key=lambda item: (item.get("provenance") or "", item.get("label") or ""))
    index_path = CORPUS / "manuscripts.json"
    index_path.write_text(json.dumps(index, ensure_ascii=False, indent=1), encoding="utf-8")
    shutil.copy2(index_path, SITE_DATA / "manuscripts.json")
    print(f"{len(index)} manuscripts, {nonempty_total(index)} lines with wording")
    print(f"wrote {MSS_DIR} and {SITE_MSS}")


def nonempty_total(index: list[dict]) -> int:
    return sum(int(item.get("lines_with_text") or 0) for item in index)


def _write_json(payload: dict, rel: Path) -> None:
    blob = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    for root in (MSS_DIR, SITE_DATA / "mss"):
        path = root / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(blob, encoding="utf-8")


def _crumbs(parts: list[tuple[str | None, str]]) -> str:
    items = ['<li><a href="/catalog/">Catalog</a></li>']
    for i, (href, label) in enumerate(parts):
        last = i == len(parts) - 1
        if last or not href:
            items.append(f'<li><span aria-current="page">{_esc(label)}</span></li>')
        else:
            items.append(f'<li><a href="{_esc(href)}">{_esc(label)}</a></li>')
    return "\n        ".join(items)


def _write_html(
    html_rel: Path,
    *,
    title: str,
    description: str,
    src: str,
    crumbs: str,
    kicker: str,
    h1: str,
) -> None:
    html = PAGE.format(
        title=_esc(title),
        description=_esc(description),
        src=_esc(src),
        crumbs=crumbs,
        kicker=_esc(kicker),
        h1=_esc(h1),
    )
    page_dir = SITE_MSS / html_rel
    page_dir.mkdir(parents=True, exist_ok=True)
    (page_dir / "index.html").write_text(html, encoding="utf-8")


def _hub_title(payload: dict, familiar: str) -> str:
    siglum = payload.get("label") or ""
    name = payload.get("name") or familiar or ""
    if name and name != siglum:
        return f"{siglum} · {name}"
    return siglum or name


def _write_mss(payload: dict, slug: str, familiar: str) -> dict:
    fragments = payload.get("fragments") or []
    toc = chapter_toc(fragments, slug, payload.get("id") or slug) if fragments else []
    hub_title = _hub_title(payload, familiar)
    desc = f"Original-language wording of {hub_title} from ETCBC/dss."
    if len(toc) >= 2:
        payload["chapters"] = [
            {k: c[k] for k in ("id", "book", "chapter", "label", "short", "path", "line_count")}
            for c in toc
        ]
        payload["view"] = "index"
        hub = dict(payload)
        hub["fragments"] = []
        _write_json(hub, Path(f"{slug}.json"))
        _write_html(
            Path(slug),
            title=hub_title,
            description=f"{desc} Open a chapter to read.",
            src=f"/data/mss/{slug}.json",
            crumbs=_crumbs([(None, hub_title)]),
            kicker="Manuscript",
            h1=hub_title,
        )
        for i, ch in enumerate(toc):
            ch_payload = dict(payload)
            ch_payload["view"] = "chapter"
            ch_payload["chapter_id"] = ch["id"]
            ch_payload["chapter"] = ch.get("chapter")
            ch_payload["book"] = ch.get("book")
            ch_payload["chapter_label"] = ch["label"]
            ch_payload["fragments"] = fragments_for_chapter(fragments, ch.get("book"), ch.get("chapter"))
            ch_payload["prev"] = (
                {"id": toc[i - 1]["id"], "label": toc[i - 1]["label"], "path": toc[i - 1]["path"]}
                if i > 0
                else None
            )
            ch_payload["next"] = (
                {"id": toc[i + 1]["id"], "label": toc[i + 1]["label"], "path": toc[i + 1]["path"]}
                if i + 1 < len(toc)
                else None
            )
            ch_payload["translation_count"] = sum(
                1 for frag in ch_payload["fragments"] for ln in frag["lines"] if ln.get("en")
            )
            _write_json(ch_payload, Path(slug) / f"{ch['id']}.json")
            _write_html(
                Path(slug) / ch["id"],
                title=f"{hub_title} · {ch['label']}",
                description=f"{ch['label']} of {hub_title}, original-language wording from ETCBC/dss.",
                src=f"/data/mss/{slug}/{ch['id']}.json",
                crumbs=_crumbs([(f"/m/{slug}/", hub_title), (None, ch["label"])]),
                kicker=hub_title,
                h1=ch["label"],
            )
        return {"chapter_count": len(toc)}

    payload["view"] = "text"
    _write_json(payload, Path(f"{slug}.json"))
    _write_html(
        Path(slug),
        title=hub_title,
        description=desc,
        src=f"/data/mss/{slug}.json",
        crumbs=_crumbs([(None, hub_title)]),
        kicker="Manuscript",
        h1=hub_title,
    )
    return {"chapter_count": 0}


def _extra_payload(rec: dict, extra_source: dict) -> dict:
    return {
        "id": rec["id"],
        "label": rec["label"],
        "name": rec.get("name") or "",
        "provenance": rec.get("provenance") or "Other",
        "biblical": bool(rec.get("biblical")),
        "languages": rec.get("languages") or ["Greek"],
        "lang": rec.get("lang") or "grc",
        "dir": rec.get("dir") or "ltr",
        "script": rec.get("script") or "greek",
        "fragment_count": 0,
        "line_count": 0,
        "word_count": 0,
        "iaa_url": rec.get("iaa_url"),
        "museum_url": rec.get("museum_url"),
        "source": extra_source,
        "contents": rec.get("contents") or "",
        "wording_status": rec.get("wording_status") or "absent",
        "fragments": [],
    }


def _extra_index(payload: dict) -> dict:
    langs = payload.get("languages") or []
    script = payload.get("script") or "greek"
    facets = catalog_fields(payload.get("provenance") or "", langs, script)
    return {
        "id": payload["id"],
        "label": payload["label"],
        "name": payload.get("name") or "",
        "provenance": facets["site"],
        "site": facets["site"],
        "site_key": facets["site_key"],
        "found": facets["found"],
        "biblical": payload.get("biblical"),
        "languages": langs,
        "lang_keys": facets["lang_keys"],
        "script": script,
        "script_keys": facets["script_keys"],
        "fragment_count": 0,
        "line_count": 0,
        "word_count": 0,
        "iaa_url": payload.get("iaa_url"),
        "museum_url": payload.get("museum_url"),
        "path": f"/m/{payload['id']}/",
        "lines_with_text": 0,
        "wording_status": payload.get("wording_status") or "absent",
        "chapter_bare": False,
        **classify_community(
            payload.get("label") or "",
            payload.get("name") or "",
            bool(payload.get("biblical")),
            IAA_NAMES.get(payload.get("id") or "") or IAA_NAMES.get(payload.get("label") or ""),
        ),
    }


def _esc(s: str) -> str:
    return (
        s.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


if __name__ == "__main__":
    main()
