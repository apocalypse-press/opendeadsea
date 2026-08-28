#!/usr/bin/env python3
"""Build the Open Dead Sea favicon set from site/icon-512.png.

The 512 master is the distressed ODS wordmark (black on transparent).
This script does not invent a mark. It only resizes, composites a
background where a platform requires one, and inverts for dark tabs.

Run from the repo root:

    python3 scripts/generate_favicons.py
"""
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "site"
MASTER = SITE / "icon-512.png"

# Token values from site/tokens.css. Apple and Android cannot read CSS
# variables, so these are frozen at generate time.
SURFACE_PAGE = (255, 255, 255, 255)


def resize(src: Image.Image, size: int) -> Image.Image:
    return src.resize((size, size), Image.Resampling.LANCZOS)


def invert_rgb(src: Image.Image) -> Image.Image:
    """Keep alpha; invert RGB so the mark reads on a dark tab."""
    r, g, b, a = src.split()
    inv = Image.merge("RGB", (r, g, b))
    inv = ImageOps.invert(inv)
    inv.putalpha(a)
    return inv


def on_background(src: Image.Image, size: int, bg: tuple[int, int, int, int], pad: float) -> Image.Image:
    """Center the mark on an opaque square. pad is the fraction of the canvas
    left empty on each side so iOS rounding and Android maskable crop do
    not clip the letters."""
    canvas = Image.new("RGBA", (size, size), bg)
    inner = max(1, int(round(size * (1 - 2 * pad))))
    fitted = resize(src, inner)
    offset = (size - inner) // 2
    canvas.alpha_composite(fitted, (offset, offset))
    return canvas


def save_png(img: Image.Image, name: str) -> None:
    path = SITE / name
    img.save(path, format="PNG", optimize=True)
    print(f"{path.name}: {path.stat().st_size} bytes {img.size}")


def main() -> None:
    if not MASTER.exists():
        raise SystemExit(f"missing master {MASTER}")
    src = Image.open(MASTER).convert("RGBA")
    if src.size != (512, 512):
        raise SystemExit(f"master must be 512x512, got {src.size}")

    save_png(resize(src, 192), "icon-192.png")
    save_png(resize(src, 32), "favicon-32.png")
    save_png(resize(src, 16), "favicon-16.png")
    save_png(resize(invert_rgb(src), 32), "favicon-32-dark.png")
    save_png(resize(invert_rgb(src), 16), "favicon-16-dark.png")

    # iOS ignores transparency and fills with black. Opaque page surface.
    apple = on_background(src, 180, SURFACE_PAGE, pad=0.08)
    save_png(apple, "apple-touch-icon.png")

    # Android adaptive icon safe zone is the center 80 percent.
    maskable = on_background(src, 512, SURFACE_PAGE, pad=0.10)
    save_png(maskable, "icon-512-maskable.png")

    # Pillow ICO uses the first image's size as the max. Save from the
    # 512 master and let it downsample into 16/32/48.
    ico_sizes = [(16, 16), (32, 32), (48, 48)]
    ico_path = SITE / "favicon.ico"
    src.save(ico_path, format="ICO", sizes=ico_sizes)
    print(f"{ico_path.name}: {ico_path.stat().st_size} bytes sizes={ico_sizes}")


if __name__ == "__main__":
    main()
