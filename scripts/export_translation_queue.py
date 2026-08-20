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
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXPLORER = Path.home() / "dss-explorer"
REVIEWS = EXPLORER / "reviews"
CATALOG = ROOT / "corpus" / "manuscripts.json"
PACK_DIR = ROOT / "corpus" / "translations"
SITE_PACK = ROOT / "site" / "data" / "translations"
OVERRIDES = ROOT / "corpus" / "translation-queue-overrides.json"
GLOB = "p*_w*_c*-command-a-03-2025-detached-drafts.json"
RANK = {"valid": 3, "invalid": 2, "error": 1, "planned": 0}

BUCKETS = [
    {"key": "none", "label": "No translation"},
    {"key": "ai", "label": "AI translation"},
    {"key": "signoff", "label": "Human sign off"},
    {"key": "edit", "label": "Human edit recommended"},
]
ALLOWED = {row["key"] for row in BUCKETS}


def slugify(label: str) -> str:
    return label.replace("/", "-")


def load_best_lines() -> dict[str, dict[int, str]]:
    by_label: dict[str, dict[int, str]] = defaultdict(dict)
    if not REVIEWS.is_dir():
        return by_label
    for path in REVIEWS.glob(GLOB):
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        for item in payload.get("items") or []:
            label = item.get("scroll_label")
            line_id = item.get("line_id")
            if not label or line_id is None:
                continue
            status = str(item.get("status") or "planned")
            prev = by_label[label].get(int(line_id))
            if prev is None or RANK.get(status, -1) > RANK.get(prev, -1):
                by_label[label][int(line_id)] = status
    return by_label


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
    if stats["error"] or stats["invalid"]:
        return "edit", "derived"
    if stats["valid"] and stats["planned"]:
        return "edit", "derived"
    return "none", "derived"


def has_published_pack(mss: dict, stems: set[str]) -> bool:
    if mss.get("id") in stems:
        return True
    label = mss.get("label") or ""
    if label and slugify(label) in stems:
        return True
    return False


def build_queue(catalog: list[dict], by_label: dict[str, dict[int, str]], stems: set[str], overrides: dict[str, str]) -> dict:
    manuscripts: dict[str, dict] = {}
    counts: Counter[str] = Counter()
    unknown_overrides = [k for k in overrides if not any(m.get("id") == k for m in catalog)]
    if unknown_overrides:
        raise SystemExit(f"override id(s) not in catalog: {unknown_overrides[:8]}")
    for mss in catalog:
        mss_id = mss["id"]
        stats = stats_for(by_label.get(mss.get("label") or "", {}))
        packed = has_published_pack(mss, stems)
        queue, source = classify(stats, packed, overrides.get(mss_id))
        counts[queue] += 1
        rec = {
            "queue": queue,
            "source": source,
            **stats,
            "pack": packed,
        }
        if source == "override":
            rec["derived"] = classify(stats, packed, None)[0]
        manuscripts[mss_id] = rec
    return {
        "buckets": BUCKETS,
        "default": "none",
        "authorization": (
            "Public translation-queue buckets for the catalog. "
            "AI translation is a machine-aid first draft, not the edition. "
            "Human sign off is maintainer-set until crowdsourced review ships."
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
