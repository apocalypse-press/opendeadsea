#!/usr/bin/env python3
"""Unit checks for catalog translation-queue classification."""
from export_translation_queue import classify


def check(stats, has_pack, override, expected_queue, expected_source):
    got = classify(stats, has_pack, override)
    if got != (expected_queue, expected_source):
        raise SystemExit(f"{stats} pack={has_pack} override={override}: {got} != {(expected_queue, expected_source)}")


empty = {"valid": 0, "planned": 0, "error": 0, "invalid": 0, "line_count": 0}
planned = {"valid": 0, "planned": 12, "error": 0, "invalid": 0, "line_count": 12}
partial = {"valid": 8, "planned": 4, "error": 0, "invalid": 0, "line_count": 12}
reject = {"valid": 10, "planned": 0, "error": 2, "invalid": 0, "line_count": 12}
invalid = {"valid": 10, "planned": 0, "error": 0, "invalid": 2, "line_count": 12}
valid = {"valid": 12, "planned": 0, "error": 0, "invalid": 0, "line_count": 12}

check(empty, False, None, "none", "derived")
check(planned, False, None, "none", "derived")
check(valid, False, None, "none", "derived")
check(valid, True, None, "ai", "derived")
check(partial, False, None, "edit", "derived")
check(reject, False, None, "edit", "derived")
check(invalid, False, None, "edit", "derived")
check(valid, True, "signoff", "signoff", "override")
check(valid, True, "edit", "edit", "override")
check(empty, False, "none", "none", "override")
print("OK translation-queue classify")
