#!/usr/bin/env python3
"""Build the provider-free work queue for unpublished catalog records.

Only unresolved Explorer lane rows backed by current, nonempty source wording
are queued. Catalog records without source rows remain explicit exclusions.
This artifact plans detached work; it cannot call a provider, publish a draft,
or change the DSS Explorer production freeze.
"""
from __future__ import annotations

import hashlib
import json
import os
import sqlite3
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXPLORER = Path.home() / "dss-explorer"
DATABASE = EXPLORER / "data" / "dss.sqlite3"
CATALOG = ROOT / "corpus" / "manuscripts.json"
PUBLIC_QUEUE = ROOT / "corpus" / "translations" / "queue.json"
DESTINATION = ROOT / "corpus" / "translation-work-queue.json"

# Keep the OpenDeadSea source loader local even though its inputs live in the
# sibling Explorer checkout.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from detached_draft_sources import load_best_lines  # noqa: E402

QUEUE_VERSION = "opendeadsea-untranslated-source-work-queue-v1"
UNRESOLVED = {"planned", "invalid", "error"}


class TranslationWorkQueueError(RuntimeError):
    """Raised when catalog, draft, or current-source provenance drifts."""


def canonical_sha256(payload: object) -> str:
    encoded = json.dumps(
        payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def load_json(path: Path, label: str) -> object:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise TranslationWorkQueueError(f"cannot read {label} {path}: {exc}") from exc


def source_hash(line: dict) -> str:
    """Reproduce Explorer's production source-hash contract."""
    material = json.dumps(
        {
            "reference": line["reference"],
            "text": line["text"],
            "words": [
                [
                    word.get("text"),
                    word.get("lexeme"),
                    word.get("language"),
                    word.get("part_of_speech"),
                ]
                for word in line["words"]
            ],
        },
        ensure_ascii=False,
        sort_keys=True,
    )
    return hashlib.sha256(material.encode()).hexdigest()


def source_evidence_sha256(line: dict) -> str:
    """Reproduce Explorer's detached source-evidence hash contract."""
    material = {
        "reference": line["reference"],
        "text": line["text"],
        "source_text": line.get("source_text") or "",
        "languages": line.get("languages") or "",
        "reconstructed_count": int(line.get("reconstructed_count") or 0),
        "uncertain_count": int(line.get("uncertain_count") or 0),
        "words": [
            {
                "position": int(word["position"]),
                "text": word.get("text") or "",
                "source_text": word.get("source_text") or "",
                "lexeme": word.get("lexeme") or "",
                "language": word.get("language") or "",
                "part_of_speech": word.get("part_of_speech") or "",
                "person": word.get("person") or "",
                "gender": word.get("gender") or "",
                "number": word.get("number") or "",
                "state": word.get("state") or "",
                "stem": word.get("stem") or "",
                "tense": word.get("tense") or "",
                "morphology": word.get("morphology") or "",
                "reconstructed": bool(word.get("reconstructed")),
                "uncertain": bool(word.get("uncertain")),
            }
            for word in line["words"]
        ],
    }
    return canonical_sha256(material)


def source_condition(line: dict) -> str:
    reconstructed = int(line.get("reconstructed_count") or 0) > 0 or any(
        bool(word.get("reconstructed")) for word in line["words"]
    )
    uncertain = int(line.get("uncertain_count") or 0) > 0 or any(
        bool(word.get("uncertain")) for word in line["words"]
    )
    if reconstructed and uncertain:
        return "reconstructed_and_uncertain"
    if reconstructed:
        return "reconstructed"
    if uncertain:
        return "uncertain"
    return "clean"


def load_source_lines(conn: sqlite3.Connection, line_ids: set[int]) -> dict[int, dict]:
    if not line_ids:
        return {}
    placeholders = ",".join("?" for _ in line_ids)
    rows = conn.execute(
        f"""SELECT l.*, s.label AS scroll_label
            FROM lines l JOIN scrolls s ON s.id=l.scroll_id
            WHERE l.id IN ({placeholders}) ORDER BY l.id""",
        sorted(line_ids),
    )
    lines = {int(row["id"]): dict(row) for row in rows}
    words: dict[int, list[dict]] = {line_id: [] for line_id in lines}
    for row in conn.execute(
        f"SELECT * FROM words WHERE line_id IN ({placeholders}) ORDER BY line_id,position",
        sorted(line_ids),
    ):
        words[int(row["line_id"])].append(dict(row))
    for line_id, line in lines.items():
        line["words"] = words[line_id]
    return lines


def validate_source_binding(lane: dict, line: dict, corpus_commit: str) -> None:
    item = lane["item"]
    line_id = int(item["line_id"])
    if lane.get("corpus_commit") != corpus_commit:
        raise TranslationWorkQueueError(
            f"line {line_id} lane corpus commit differs from current database"
        )
    if (
        not str(line.get("text") or "").strip()
        or not str(line.get("source_text") or "").strip()
        or not line.get("words")
        or int(line.get("word_count") or 0) <= 0
    ):
        raise TranslationWorkQueueError(
            f"line {line_id} lacks current source text or source words"
        )
    checks = {
        "scroll_id": int(line["scroll_id"]),
        "scroll_label": str(line["scroll_label"]),
        "reference": str(line["reference"]),
        "source_hash": source_hash(line),
        "source_evidence_sha256": source_evidence_sha256(line),
        "source_condition": source_condition(line),
    }
    for key, expected in checks.items():
        if item.get(key) != expected:
            raise TranslationWorkQueueError(
                f"line {line_id} {key} drift: lane={item.get(key)!r} current={expected!r}"
            )
    cohort_item = {
        "line_id": line_id,
        "scroll_id": checks["scroll_id"],
        "scroll_label": checks["scroll_label"],
        "reference": checks["reference"],
        "source_hash": checks["source_hash"],
        "source_evidence_sha256": checks["source_evidence_sha256"],
        "word_count": int(line["word_count"]),
        "coverage_disposition": "readable_selection",
        "source_condition": checks["source_condition"],
    }
    if canonical_sha256(cohort_item) != item.get("cohort_item_sha256"):
        raise TranslationWorkQueueError(f"line {line_id} cohort item hash drift")


def queue_item(lane: dict, line: dict) -> dict:
    source = lane["item"]
    item = {
        "line_id": int(line["id"]),
        "scroll_id": int(line["scroll_id"]),
        "scroll_label": str(line["scroll_label"]),
        "reference": str(line["reference"]),
        "source_languages": str(line.get("languages") or ""),
        "word_count": int(line["word_count"]),
        "source_condition": str(source["source_condition"]),
        "source_available": True,
        "source_hash": str(source["source_hash"]),
        "source_evidence_sha256": str(source["source_evidence_sha256"]),
        "cohort_item_sha256": str(source["cohort_item_sha256"]),
        "prior_status": str(lane["status"]),
        "prior_attempt_count": int(source.get("attempt_count") or 0),
    }
    for source_key, queue_key in (
        ("failure_class", "prior_failure_class"),
        ("validation_error", "prior_validation_error"),
    ):
        value = str(source.get(source_key) or "").strip()
        if value:
            item[queue_key] = value
    item["queue_item_sha256"] = canonical_sha256(item)
    return item


def build_work_queue(
    catalog: list[dict], public_queue: dict, by_label: dict[str, dict[int, dict]],
    source_lines: dict[int, dict], *, corpus_commit: str,
    catalog_sha256: str, public_queue_sha256: str,
) -> dict:
    catalog_ids = [str(record.get("id") or "") for record in catalog]
    if not all(catalog_ids) or len(catalog_ids) != len(set(catalog_ids)):
        raise TranslationWorkQueueError("catalog IDs must be unique and nonempty")
    public_rows = public_queue.get("manuscripts") or {}
    untranslated = [record for record in catalog if (public_rows.get(record["id"]) or {}).get("queue") == "none"]
    if len(untranslated) != int((public_queue.get("counts") or {}).get("none", -1)):
        raise TranslationWorkQueueError("public no-translation count does not match catalog rows")

    records: list[dict] = []
    excluded: list[dict] = []
    seen_lines: set[int] = set()
    status_totals: Counter[str] = Counter()
    language_totals: Counter[str] = Counter()

    for catalog_record in untranslated:
        label = str(catalog_record.get("label") or "")
        lanes = by_label.get(label, {})
        unresolved = [lane for lane in lanes.values() if lane["status"] in UNRESOLVED]
        unexpected = sorted({lane["status"] for lane in lanes.values()} - (UNRESOLVED | {"valid"}))
        if unexpected:
            raise TranslationWorkQueueError(f"{label}: unexpected detached status {unexpected}")
        if not lanes:
            if int(catalog_record.get("lines_with_text") or 0) != 0:
                raise TranslationWorkQueueError(
                    f"{label}: catalog claims source wording but no Explorer lane rows exist"
                )
            excluded.append(
                {
                    "catalog_id": str(catalog_record["id"]),
                    "label": label,
                    "path": str(catalog_record.get("path") or ""),
                    "languages": list(catalog_record.get("languages") or []),
                    "catalog_line_count": int(catalog_record.get("line_count") or 0),
                    "lines_with_text": int(catalog_record.get("lines_with_text") or 0),
                    "reason": "no_source_wording_in_current_corpus",
                    "disposition": "source_acquisition_required",
                }
            )
            continue
        if not unresolved:
            raise TranslationWorkQueueError(
                f"{label}: all detached rows are valid but no public pack exists"
            )
        items = []
        for lane in sorted(unresolved, key=lambda value: int(value["item"]["line_id"])):
            line_id = int(lane["item"]["line_id"])
            if line_id in seen_lines:
                raise TranslationWorkQueueError(f"line {line_id} occurs in multiple records")
            line = source_lines.get(line_id)
            if line is None:
                raise TranslationWorkQueueError(f"line {line_id} is absent from current source database")
            validate_source_binding(lane, line, corpus_commit)
            item = queue_item(lane, line)
            items.append(item)
            seen_lines.add(line_id)
            status_totals[item["prior_status"]] += 1
            language_totals[item["source_languages"]] += 1
        lane_counts = Counter(lane["status"] for lane in lanes.values())
        record = {
            "catalog_id": str(catalog_record["id"]),
            "label": label,
            "path": str(catalog_record.get("path") or ""),
            "languages": list(catalog_record.get("languages") or []),
            "catalog_line_count": int(catalog_record.get("line_count") or 0),
            "lines_with_text": int(catalog_record.get("lines_with_text") or 0),
            "detached_line_count": len(lanes),
            "queue_line_count": len(items),
            "prior_status_counts": {
                status: int(lane_counts.get(status, 0))
                for status in ("valid", "planned", "invalid", "error")
            },
            "items": items,
        }
        record["record_sha256"] = canonical_sha256(record)
        records.append(record)

    payload = {
        "queue_version": QUEUE_VERSION,
        "authorization": (
            "Provider-free detached translation planning only. This queue cannot call a provider, "
            "publish a draft, alter a quality gate, change corpus metadata, or unfreeze DSS Explorer production."
        ),
        "source": {
            "catalog_path": "corpus/manuscripts.json",
            "catalog_sha256": catalog_sha256,
            "public_queue_path": "corpus/translations/queue.json",
            "public_queue_sha256": public_queue_sha256,
            "explorer_database": "~/dss-explorer/data/dss.sqlite3",
            "explorer_corpus_commit": corpus_commit,
            "detached_source": "~/dss-explorer/reviews/p*_w*_c*-command-a-03-2025-detached-drafts.json plus audited recovery overlay",
            "wording_policy": "both normalized text and source_text must be nonempty and at least one source word must exist",
        },
        "summary": {
            "catalog_records": len(catalog),
            "untranslated_records": len(untranslated),
            "eligible_records": len(records),
            "excluded_records": len(excluded),
            "queued_lines": len(seen_lines),
            "prior_statuses": {
                status: int(status_totals.get(status, 0))
                for status in ("planned", "invalid", "error")
            },
            "source_languages": dict(sorted(language_totals.items())),
        },
        "records": records,
        "excluded_records": excluded,
    }
    if len(records) + len(excluded) != len(untranslated):
        raise TranslationWorkQueueError("eligible and excluded records do not cover untranslated catalog")
    payload["queue_sha256"] = canonical_sha256(payload)
    return payload


def write_atomic(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.tmp")
    with temporary.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
        handle.flush()
        os.fsync(handle.fileno())
    temporary.replace(path)


def export_work_queue() -> dict:
    catalog = load_json(CATALOG, "catalog")
    public_queue = load_json(PUBLIC_QUEUE, "public translation queue")
    if not isinstance(catalog, list) or not isinstance(public_queue, dict):
        raise TranslationWorkQueueError("catalog must be an array and public queue an object")
    by_label = load_best_lines()
    unresolved_ids = {
        int(lane["item"]["line_id"])
        for lanes in by_label.values()
        for lane in lanes.values()
        if lane["status"] in UNRESOLVED
    }
    if not DATABASE.is_file():
        raise TranslationWorkQueueError(f"missing Explorer source database {DATABASE}")
    conn = sqlite3.connect(f"file:{DATABASE.resolve()}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    try:
        row = conn.execute(
            "SELECT value FROM metadata WHERE key='corpus_commit'"
        ).fetchone()
        if row is None or not str(row[0]).strip():
            raise TranslationWorkQueueError("Explorer database lacks corpus_commit")
        corpus_commit = str(row[0])
        source_lines = load_source_lines(conn, unresolved_ids)
    finally:
        conn.close()
    payload = build_work_queue(
        catalog,
        public_queue,
        by_label,
        source_lines,
        corpus_commit=corpus_commit,
        catalog_sha256=file_sha256(CATALOG),
        public_queue_sha256=file_sha256(PUBLIC_QUEUE),
    )
    write_atomic(DESTINATION, payload)
    summary = payload["summary"]
    print(
        f"work queue: {summary['eligible_records']} source-backed records / "
        f"{summary['queued_lines']} lines; {summary['excluded_records']} records excluded -> {DESTINATION}"
    )
    return payload


def main() -> int:
    export_work_queue()
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except TranslationWorkQueueError as exc:
        raise SystemExit(f"translation work queue refused: {exc}") from exc
