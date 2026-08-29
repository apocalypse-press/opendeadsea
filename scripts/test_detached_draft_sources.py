#!/usr/bin/env python3
"""Unit checks for hash-bound recovery-overlay ingestion."""
from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from detached_draft_sources import (
    OVERLAY_VERSION,
    DetachedDraftSourceError,
    canonical_sha256,
    file_sha256,
    load_best_lines,
)


class DetachedDraftSourcesTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.explorer = Path(self.temporary.name) / "explorer"
        self.reviews = self.explorer / "reviews"
        self.reviews.mkdir(parents=True)
        self.item = {
            "line_id": 17,
            "scroll_id": 7,
            "scroll_label": "1QTest",
            "reference": "1QTest 1:1",
            "source_hash": "source-hash",
            "source_evidence_sha256": "evidence-hash",
            "cohort_item_sha256": "cohort-hash",
            "source_condition": "uncertain",
            "status": "invalid",
        }
        self.lane = self.reviews / "p100_w1_c1-command-a-03-2025-detached-drafts.json"
        self._write(
            self.lane,
            {
                "cohort": {"corpus_commit": "sealed-corpus"},
                "generator": {
                    "backend": "cohere_v2",
                    "model": "command-a-03-2025",
                    "prompt_version": "dss-static-v17",
                },
                "items": [self.item],
            },
        )
        self.plan = self.reviews / "plan.json"
        self._write(self.plan, {"recovery_plan_sha256": "plan-hash"})
        self.result_item = {
            "line_id": 17,
            "status": "valid",
            "translation": "Peace",
            "notes": "Uncertain source.",
            "provider": "api.cohere.com",
            "model": "command-a-03-2025",
        }
        self.result = self.reviews / "result.json"
        self._write(self.result, {"items": [self.result_item]})
        self.overlay = self.reviews / "overlay.json"
        overlay = {
            "overlay_version": OVERLAY_VERSION,
            "authorization": "audited machine-aid first drafts for human-pending review",
            "corpus_commit": "sealed-corpus",
            "source_count": 1,
            "sources": [
                {
                    "result_path": "reviews/result.json",
                    "result_file_sha256": file_sha256(self.result),
                    "result_version": "result-v1",
                    "plan_path": "reviews/plan.json",
                    "plan_file_sha256": file_sha256(self.plan),
                    "plan_sha256": "plan-hash",
                    "audit_version": "audit-v1",
                }
            ],
            "item_count": 1,
            "items": [
                {
                    **{key: self.item.get(key) for key in (
                        "line_id",
                        "scroll_id",
                        "scroll_label",
                        "reference",
                        "source_hash",
                        "source_evidence_sha256",
                        "cohort_item_sha256",
                        "source_condition",
                    )},
                    "status": "valid",
                    "translation": "Peace",
                    "notes": "Uncertain source.",
                    "provider": "api.cohere.com",
                    "model": "command-a-03-2025",
                    "recovery_prompt_version": "dss-detached-bounded-recovery-v2",
                    "request_identity": "a" * 64,
                    "source_artifact_path": "reviews/" + self.lane.name,
                    "source_artifact_sha256": file_sha256(self.lane),
                    "source_artifact_item_sha256": canonical_sha256(self.item),
                    "source_result_path": "reviews/result.json",
                    "source_result_file_sha256": file_sha256(self.result),
                    "source_result_item_sha256": canonical_sha256(self.result_item),
                }
            ],
        }
        overlay["overlay_sha256"] = canonical_sha256(overlay)
        self._write(self.overlay, overlay)

    def tearDown(self):
        self.temporary.cleanup()

    @staticmethod
    def _write(path: Path, payload: dict) -> None:
        path.write_text(json.dumps(payload) + "\n", encoding="utf-8")

    def test_overlay_promotes_only_the_bound_line(self):
        loaded = load_best_lines(reviews=self.reviews, overlay_path=self.overlay)
        row = loaded["1QTest"][17]
        self.assertEqual(row["status"], "valid")
        self.assertEqual(row["item"]["translation"], "Peace")
        self.assertEqual(
            row["item"]["publication_tier"], "audited-recovery-machine-draft"
        )

    def test_overlay_and_source_drift_fail_closed(self):
        payload = json.loads(self.overlay.read_text(encoding="utf-8"))
        payload["items"][0]["translation"] = "tampered"
        self._write(self.overlay, payload)
        with self.assertRaisesRegex(DetachedDraftSourceError, "overlay hash mismatch"):
            load_best_lines(reviews=self.reviews, overlay_path=self.overlay)

        self.setUp_overlay_again()
        result = json.loads(self.result.read_text(encoding="utf-8"))
        result["items"][0]["translation"] = "drifted"
        self._write(self.result, result)
        with self.assertRaisesRegex(DetachedDraftSourceError, "source binding drift"):
            load_best_lines(reviews=self.reviews, overlay_path=self.overlay)

    def setUp_overlay_again(self) -> None:
        # Restore the exact overlay assembled during setUp without recreating paths.
        self.tearDown()
        self.setUp()


if __name__ == "__main__":
    unittest.main()
