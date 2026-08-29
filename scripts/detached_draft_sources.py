"""Load Explorer lane drafts plus an explicitly audited recovery overlay."""
from __future__ import annotations

import hashlib
import json
from collections import defaultdict
from pathlib import Path

EXPLORER = Path.home() / "dss-explorer"
REVIEWS = EXPLORER / "reviews"
GLOB = "p*_w*_c*-command-a-03-2025-detached-drafts.json"
RECOVERY_OVERLAY = (
    REVIEWS / "dss-command-a-03-2025-recovery-publication-overlay.json"
)
OVERLAY_VERSION = "dss-detached-draft-recovery-publication-overlay-v1"
RANK = {"valid": 3, "invalid": 2, "error": 1, "planned": 0}


class DetachedDraftSourceError(ValueError):
    pass


def canonical_sha256(payload: dict) -> str:
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


def _load_json(path: Path, label: str) -> dict:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise DetachedDraftSourceError(f"cannot read {label} {path}: {exc}") from exc
    if not isinstance(payload, dict):
        raise DetachedDraftSourceError(f"{label} must be a JSON object: {path}")
    return payload


def _repository_file(relative: object, reviews: Path, label: str) -> Path:
    explorer = reviews.parent.resolve()
    candidate = Path(str(relative or ""))
    if candidate.is_absolute() or not candidate.parts:
        raise DetachedDraftSourceError(f"{label} path must be Explorer-relative")
    resolved = (explorer / candidate).resolve()
    try:
        resolved.relative_to(explorer)
    except ValueError as exc:
        raise DetachedDraftSourceError(f"{label} path escapes Explorer") from exc
    return resolved


def _validate_overlay(overlay: dict) -> None:
    if overlay.get("overlay_version") != OVERLAY_VERSION:
        raise DetachedDraftSourceError("unexpected recovery publication overlay version")
    recorded = str(overlay.get("overlay_sha256") or "")
    material = {key: value for key, value in overlay.items() if key != "overlay_sha256"}
    if recorded != canonical_sha256(material):
        raise DetachedDraftSourceError("recovery publication overlay hash mismatch")
    items = overlay.get("items")
    sources = overlay.get("sources")
    if not isinstance(items, list) or len(items) != overlay.get("item_count"):
        raise DetachedDraftSourceError("recovery publication overlay item count mismatch")
    if not isinstance(sources, list) or len(sources) != overlay.get("source_count"):
        raise DetachedDraftSourceError("recovery publication overlay source count mismatch")
    line_ids = [int(item["line_id"]) for item in items]
    if len(line_ids) != len(set(line_ids)):
        raise DetachedDraftSourceError("recovery publication overlay duplicates a line")


def load_best_lines(
    *,
    reviews: Path = REVIEWS,
    overlay_path: Path | None = RECOVERY_OVERLAY,
) -> dict[str, dict[int, dict]]:
    """Return best line records, failing closed on any configured overlay drift."""
    by_label: dict[str, dict[int, dict]] = defaultdict(dict)
    base_by_line: dict[int, dict] = {}
    if not reviews.is_dir():
        return by_label

    for path in sorted(reviews.glob(GLOB)):
        payload = _load_json(path, "detached lane")
        generator = payload.get("generator") or {}
        corpus_commit = str((payload.get("cohort") or {}).get("corpus_commit") or "")
        path_relative = str(path.resolve().relative_to(reviews.parent.resolve()))
        path_sha = file_sha256(path)
        for item in payload.get("items") or []:
            label = str(item.get("scroll_label") or "")
            line_id_raw = item.get("line_id")
            if not label or line_id_raw is None:
                continue
            line_id = int(line_id_raw)
            status = str(item.get("status") or "planned")
            identity = {
                "path": path_relative,
                "file_sha256": path_sha,
                "item_sha256": canonical_sha256(item),
                "item": item,
            }
            prior_identity = base_by_line.get(line_id)
            if prior_identity and prior_identity["item_sha256"] != identity["item_sha256"]:
                raise DetachedDraftSourceError(
                    f"detached lanes contain conflicting line {line_id}"
                )
            base_by_line[line_id] = identity
            previous = by_label[label].get(line_id)
            if previous is None or RANK.get(status, -1) > RANK.get(
                previous["status"], -1
            ):
                by_label[label][line_id] = {
                    "status": status,
                    "item": item,
                    "generator": generator,
                    "corpus_commit": corpus_commit,
                }

    if overlay_path is None or not overlay_path.is_file():
        return by_label
    overlay = _load_json(overlay_path, "recovery publication overlay")
    _validate_overlay(overlay)

    result_hashes: dict[str, str] = {}
    for source in overlay["sources"]:
        result_path = _repository_file(source.get("result_path"), reviews, "result")
        plan_path = _repository_file(source.get("plan_path"), reviews, "plan")
        if (
            not result_path.is_file()
            or file_sha256(result_path) != source.get("result_file_sha256")
            or not plan_path.is_file()
            or file_sha256(plan_path) != source.get("plan_file_sha256")
        ):
            raise DetachedDraftSourceError("recovery publication source binding drift")
        result_hashes[str(source["result_path"])] = str(source["result_file_sha256"])

    for recovered in overlay["items"]:
        if recovered.get("status") != "valid":
            raise DetachedDraftSourceError("recovery overlay contains a non-valid row")
        line_id = int(recovered["line_id"])
        base = base_by_line.get(line_id)
        if base is None:
            raise DetachedDraftSourceError(f"recovery overlay line {line_id} has no lane row")
        if (
            base["path"] != recovered.get("source_artifact_path")
            or base["file_sha256"] != recovered.get("source_artifact_sha256")
            or base["item_sha256"] != recovered.get("source_artifact_item_sha256")
        ):
            raise DetachedDraftSourceError(
                f"recovery overlay source binding drift for line {line_id}"
            )
        source_result_path = str(recovered.get("source_result_path") or "")
        if result_hashes.get(source_result_path) != recovered.get(
            "source_result_file_sha256"
        ):
            raise DetachedDraftSourceError(
                f"recovery overlay result binding drift for line {line_id}"
            )
        source_result = _load_json(
            _repository_file(source_result_path, reviews, "result"),
            "recovery result",
        )
        matches = [
            item for item in source_result.get("items") or []
            if int(item.get("line_id") or 0) == line_id
        ]
        if (
            len(matches) != 1
            or canonical_sha256(matches[0])
            != recovered.get("source_result_item_sha256")
            or matches[0].get("status") != "valid"
        ):
            raise DetachedDraftSourceError(
                f"recovery overlay result row drift for line {line_id}"
            )
        original = base["item"]
        for key in (
            "scroll_id",
            "scroll_label",
            "reference",
            "source_hash",
            "source_evidence_sha256",
            "cohort_item_sha256",
            "source_condition",
        ):
            if recovered.get(key) != original.get(key):
                raise DetachedDraftSourceError(
                    f"recovery overlay public identity drift for line {line_id}"
                )
        if not all(
            str(recovered.get(key) or "")
            for key in (
                "translation",
                "provider",
                "model",
                "request_identity",
                "recovery_prompt_version",
            )
        ):
            raise DetachedDraftSourceError(
                f"recovery overlay line {line_id} lacks candidate provenance"
            )
        label = str(recovered["scroll_label"])
        original_row = by_label.get(label, {}).get(line_id)
        if original_row is None or original_row["corpus_commit"] != overlay.get(
            "corpus_commit"
        ):
            raise DetachedDraftSourceError(
                f"recovery overlay corpus binding drift for line {line_id}"
            )
        published = dict(recovered)
        published["publication_tier"] = "audited-recovery-machine-draft"
        by_label[label][line_id] = {
            "status": "valid",
            "item": published,
            "generator": {
                **original_row["generator"],
                "model": recovered["model"],
                "prompt_version": recovered["recovery_prompt_version"],
                "recovery_overlay_version": overlay["overlay_version"],
            },
            "corpus_commit": overlay["corpus_commit"],
        }
    return by_label
