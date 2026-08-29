#!/usr/bin/env python3
"""Assign every catalog manuscript a public translation-queue bucket.

Buckets (mutually exclusive):

  none     No translation in the edition yet.
  ai       Complete machine-aid first draft is on the site.
  signoff  A human accepted the English (override only until review ships).
  edit     Human edit recommended: leftover error/invalid/partial AI.

Derived from Explorer detached drafts plus published first-draft packs.
Maintainer overrides live in corpus/translation-queue-overrides.json
(outside corpus/translations, so export_first_drafts rmtree cannot eat them).

Does not unfreeze DSS Explorer production translations.
"""
from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

from detached_draft_sources import load_best_lines as load_draft_records

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "corpus" / "manuscripts.json"
PACK_DIR = ROOT / "corpus" / "translations"
SITE_PACK = ROOT / "site" / "data" / "translations"
OVERRIDES = ROOT / "corpus" / "translation-queue-overrides.json"

BUCKETS = [
    {"key": "none", "label": "No translation"},
    {"key": "ai", "label": "Machine draft"},
    {"key": "signoff", "label": "Human checked"},
    {"key": "edit", "label": "Needs help"},
]
ALLOWED = {row["key"] for row in BUCKETS}


def slugify(label: str) -> str:
    return label.replace("/", "-")


def load_best_lines() -> dict[str, dict[int, str]]:
    return {
        label: {line_id: row["status"] for line_id, row in lines.items()}
        for label, lines in load_draft_records().items()
    }


def pack_stems(pack_dir: Path) -> set[str]:
    if not pack_dir.is_dir():
        return set()
    return {p.stem for p in pack_dir.glob("*.json") if p.name != "index.json" and p.name != "queue.json"}


def load_overrides() -> dict[str, str]:
    if not OVERRIDES.is_file():
        return {}
    payload = json.loads(OVERRIDES.read_text(encoding="utf-8"))
    out: dict[str, str] = {}
    for mss_id, rec in (payload.get("overrides") or {}).items():
        if not isinstance(rec, dict):
            continue
        queue = rec.get("queue")
        if queue in ALLOWED:
            out[str(mss_id)] = queue
    return out


def stats_for(lines: dict[int, str]) -> dict[str, int]:
    counts = Counter(lines.values())
    return {
        "valid": int(counts.get("valid", 0)),
        "planned": int(counts.get("planned", 0)),
        "error": int(counts.get("error", 0)),
        "invalid": int(counts.get("invalid", 0)),
        "line_count": len(lines),
    }


def classify(stats: dict[str, int], has_pack: bool, override: str | None) -> tuple[str, str]:
    if override in ALLOWED:
        return override, "override"
    if has_pack:
        return "ai", "derived"
    # Partial or rejected Explorer work is not published. Calling it "needs
    # help" gives readers an action they cannot take because there is no draft
    # to edit. Keep it in "none" until a maintainer deliberately publishes and
    # overrides a pack for public repair.
    return "none", "derived"


def published_pack_id(mss: dict, stems: set[str]) -> str | None:
    if mss.get("id") in stems:
        return str(mss["id"])
    label = mss.get("label") or ""
    label_slug = slugify(label)
    if label_slug and label_slug in stems:
        return label_slug
    return None


def build_queue(catalog: list[dict], by_label: dict[str, dict[int, str]], stems: set[str], overrides: dict[str, str]) -> dict:
    manuscripts: dict[str, dict] = {}
    counts: Counter[str] = Counter()
    unknown_overrides = [k for k in overrides if not any(m.get("id") == k for m in catalog)]
    if unknown_overrides:
        raise SystemExit(f"override id(s) not in catalog: {unknown_overrides[:8]}")
    for mss in catalog:
        mss_id = mss["id"]
        stats = stats_for(by_label.get(mss.get("label") or "", {}))
        pack_id = published_pack_id(mss, stems)
        packed = pack_id is not None
        queue, source = classify(stats, packed, overrides.get(mss_id))
        counts[queue] += 1
        rec = {
            "queue": queue,
            "source": source,
            **stats,
            "pack": packed,
        }
        if pack_id:
            rec["pack_id"] = pack_id
        if source == "override":
            rec["derived"] = classify(stats, packed, None)[0]
        manuscripts[mss_id] = rec
    return {
        "buckets": BUCKETS,
        "default": "none",
        "authorization": (
            "Public translation-queue buckets for the catalog. "
            "AI translation is a machine-aid first draft, not the edition. "
            "Human checked and needs-help states are maintainer-set after review."
        ),
        "counts": {row["key"]: int(counts.get(row["key"], 0)) for row in BUCKETS},
        "manuscript_count": len(catalog),
        "manuscripts": manuscripts,
    }


def write_queue() -> dict:
    if not CATALOG.is_file():
        raise SystemExit(f"missing catalog {CATALOG}")
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    if not isinstance(catalog, list):
        raise SystemExit("manuscripts.json must be a list")
    payload = build_queue(catalog, load_best_lines(), pack_stems(PACK_DIR), load_overrides())
    blob = json.dumps(payload, ensure_ascii=False, indent=1) + "\n"
    PACK_DIR.mkdir(parents=True, exist_ok=True)
    SITE_PACK.mkdir(parents=True, exist_ok=True)
    (PACK_DIR / "queue.json").write_text(blob, encoding="utf-8")
    (SITE_PACK / "queue.json").write_text(blob, encoding="utf-8")
    counts = payload["counts"]
    print(
        "queue "
        + ", ".join(f"{key}={counts[key]}" for key in ("none", "ai", "signoff", "edit"))
        + f" / {payload['manuscript_count']} manuscripts -> {PACK_DIR / 'queue.json'}"
    )
    return payload


def main() -> int:
    write_queue()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
