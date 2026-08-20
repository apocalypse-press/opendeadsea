#!/usr/bin/env python3
"""Export Bibla Lingua Macula trees for biblical verses that appear in the ODS catalog.

Writes one JSON file per Hebrew Bible book under site/data/diagrams/.
Does not copy Macula source XML. Does not unfreeze DSS Explorer.
"""
from __future__ import annotations

import json
import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BIBLA = Path.home() / "bibla-lingua"
COVERAGE = ROOT / "corpus" / "works" / "coverage.json"
DEST = ROOT / "site" / "data" / "diagrams"

sys.path.insert(0, str(BIBLA / "scripts"))
from diagram_tree import diagram  # noqa: E402

ODS_TO_MACULA = {
    "Gen": "GEN",
    "Ex": "EXO",
    "Exod": "EXO",
    "Lev": "LEV",
    "Num": "NUM",
    "Deut": "DEU",
    "Josh": "JOS",
    "Judg": "JDG",
    "Ruth": "RUT",
    "1Sam": "1SA",
    "2Sam": "2SA",
    "1Kgs": "1KI",
    "2Kgs": "2KI",
    "1Chr": "1CH",
    "2Chr": "2CH",
    "Ezra": "EZR",
    "Neh": "NEH",
    "Esth": "EST",
    "Job": "JOB",
    "Ps": "PSA",
    "Prov": "PRO",
    "Eccl": "ECC",
    "Song": "SNG",
    "Isa": "ISA",
    "Is": "ISA",
    "Jer": "JER",
    "Lam": "LAM",
    "Ezek": "EZK",
    "Dan": "DAN",
    "Hos": "HOS",
    "Joel": "JOL",
    "Amos": "AMO",
    "Obad": "OBA",
    "Jonah": "JON",
    "Mic": "MIC",
    "Nah": "NAM",
    "Hab": "HAB",
    "Zeph": "ZEP",
    "Hag": "HAG",
    "Zech": "ZEC",
    "Mal": "MAL",
}

RANGE = re.compile(r"^(\d+):(\d+)(?:-(\d+))?$")


def coverage_verses() -> dict[str, set[tuple[int, int]]]:
    payload = json.loads(COVERAGE.read_text(encoding="utf-8"))
    by_book: dict[str, set[tuple[int, int]]] = defaultdict(set)
    for row in payload:
        for book in row.get("books") or []:
            macula = ODS_TO_MACULA.get(book.get("book") or "")
            if not macula:
                continue
            for item in book.get("verses") or []:
                m = RANGE.match(str(item).strip())
                if not m:
                    continue
                ch = int(m.group(1))
                a = int(m.group(2))
                b = int(m.group(3) or a)
                for vs in range(a, b + 1):
                    by_book[macula].add((ch, vs))
    return by_book


def main() -> int:
    if not (BIBLA / "scripts" / "diagram_tree.py").is_file():
        raise SystemExit(f"missing Bibla Lingua at {BIBLA}")
    wanted = coverage_verses()
    DEST.mkdir(parents=True, exist_ok=True)
    index = {
        "source": "Macula Hebrew WLC via Bibla Lingua",
        "authorization": "MT syntax for the biblical verse. Not the Qumran diplomatic line.",
        "books": {},
    }
    built = 0
    missed = 0
    for book, verses in sorted(wanted.items()):
        pack = {}
        for ch, vs in sorted(verses):
            try:
                rec = diagram(book, ch, vs)
            except Exception:
                rec = None
            if not rec or rec.get("shape") != "tree":
                missed += 1
                continue
            pack[f"{ch}.{vs}"] = rec
            built += 1
        dest = DEST / f"{book}.json"
        if not pack:
            if dest.exists():
                dest.unlink()
            continue
        (DEST / f"{book}.json").write_text(
            json.dumps(pack, ensure_ascii=False, separators=(",", ":")) + "\n",
            encoding="utf-8",
        )
        index["books"][book] = sorted(pack.keys(), key=lambda k: tuple(int(p) for p in k.split(".")))
    index["verse_count"] = built
    (DEST / "index.json").write_text(json.dumps(index, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"wrote {built} diagrams, missed {missed}, books {len(index['books'])} -> {DEST}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
