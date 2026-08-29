#!/usr/bin/env python3
"""Stage complete DSS Explorer machine drafts as Open Dead Sea first drafts.

A manuscript is eligible when every unique line in its detached lane files is
status=valid (nothing left but human review). Packs are separate from wording
JSON so source PRs and translation PRs do not collide.

Does not unfreeze DSS Explorer production translations.
"""
from __future__ import annotations

import json
import shutil
from pathlib import Path

from detached_draft_sources import REVIEWS, load_best_lines

ROOT = Path(__file__).resolve().parents[1]
CORPUS = ROOT / "corpus" / "translations"
SITE = ROOT / "site" / "data" / "translations"


def slugify(label: str) -> str:
    return label.replace("/", "-")


def ready_manuscripts(by_label: dict[str, dict]) -> list[tuple[str, dict, dict]]:
    ready = []
    for label, lines in sorted(by_label.items()):
        if not lines:
            continue
        if any(row["status"] != "valid" for row in lines.values()):
            continue
        generator = next(iter(lines.values()))["generator"]
        corpus_commit = next(iter(lines.values()))["corpus_commit"]
        ready.append((label, lines, {"generator": generator, "corpus_commit": corpus_commit}))
    return ready


def pack_for(label: str, lines: dict, meta: dict) -> dict:
    ordered = [lines[k]["item"] for k in sorted(lines)]
    recovered = [
        item
        for item in ordered
        if item.get("publication_tier") == "audited-recovery-machine-draft"
    ]
    return {
        "id": slugify(label),
        "label": label,
        "status": "first-draft",
        "review": "human-pending",
        "authorization": (
            "machine-aid first draft for crowdsourced human review; "
            "not the edition translation, not a BHSA gloss, not a DSS Explorer release"
        ),
        "line_count": len(ordered),
        "scroll_id": ordered[0].get("scroll_id") if ordered else None,
        "corpus_commit": meta.get("corpus_commit"),
        "generator": {
            "model": (meta.get("generator") or {}).get("model"),
            "backend": (meta.get("generator") or {}).get("backend"),
            "prompt_version": (meta.get("generator") or {}).get("prompt_version"),
            "response_contract": (meta.get("generator") or {}).get("response_contract"),
        },
        **(
            {
                "recovery_overlay": {
                    "version": "dss-detached-draft-recovery-publication-overlay-v1",
                    "line_count": len(recovered),
                    "review": "provider-free-audited",
                }
            }
            if recovered
            else {}
        ),
        "lines": {
            str(item.get("reference")): {
                "en": item.get("translation") or "",
                "notes": item.get("notes") or "",
                "line_id": item.get("line_id"),
                "source_hash": item.get("source_hash"),
                "source_condition": item.get("source_condition"),
                **(
                    {
                        "recovery": {
                            "prompt_version": item.get("recovery_prompt_version"),
                            "provider": item.get("provider"),
                            "model": item.get("model"),
                            "request_identity": item.get("request_identity"),
                        }
                    }
                    if item.get("publication_tier")
                    == "audited-recovery-machine-draft"
                    else {}
                ),
            }
            for item in ordered
            if item.get("reference")
        },
    }


def main() -> int:
    if not REVIEWS.is_dir():
        raise SystemExit(f"missing Explorer reviews {REVIEWS}")
    by_label = load_best_lines()
    ready = ready_manuscripts(by_label)
    if CORPUS.exists():
        shutil.rmtree(CORPUS)
    if SITE.exists():
        shutil.rmtree(SITE)
    CORPUS.mkdir(parents=True)
    SITE.mkdir(parents=True)
    index = {
        "status": "first-draft",
        "review": "human-pending",
        "authorization": "machine-aid first drafts; human review is the next step",
        "manuscript_count": 0,
        "line_count": 0,
        "manuscripts": [],
    }
    for label, lines, meta in ready:
        pack = pack_for(label, lines, meta)
        name = f"{pack['id']}.json"
        blob = json.dumps(pack, ensure_ascii=False, indent=1) + "\n"
        (CORPUS / name).write_text(blob, encoding="utf-8")
        (SITE / name).write_text(blob, encoding="utf-8")
        index["manuscripts"].append(
            {
                "id": pack["id"],
                "label": pack["label"],
                "path": f"/m/{pack['id']}/",
                "line_count": pack["line_count"],
            }
        )
        index["line_count"] += pack["line_count"]
    index["manuscript_count"] = len(index["manuscripts"])
    index["manuscripts"].sort(key=lambda row: (-row["line_count"], row["id"]))
    for dest in (CORPUS, SITE):
        (dest / "index.json").write_text(
            json.dumps(index, ensure_ascii=False, indent=1) + "\n", encoding="utf-8"
        )
    print(
        f"wrote {index['manuscript_count']} first-draft packs, "
        f"{index['line_count']} lines -> {CORPUS}"
    )
    skipped = sum(1 for lines in by_label.values() if any(r["status"] != "valid" for r in lines.values()))
    print(f"held back {skipped} manuscripts with leftover planned/error/invalid lines")
    import subprocess
    import sys

    queue_script = Path(__file__).with_name("export_translation_queue.py")
    subprocess.check_call([sys.executable, str(queue_script)])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
