#!/usr/bin/env python3
"""Publish canonical search metadata into the static Pages data tree."""
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "corpus" / "search-metadata.json"
DEST = ROOT / "site" / "data" / "search-metadata.json"


def main() -> None:
    if not SOURCE.is_file():
        raise SystemExit(f"missing {SOURCE}")
    DEST.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(SOURCE, DEST)
    print(f"published {SOURCE.relative_to(ROOT)} -> {DEST.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
