#!/usr/bin/env python3
"""Restage grooming products onto Day / Night / Core catalog plates."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageOps

ROOT = Path("/workspace")
OUT = ROOT / "public" / "sample" / "groom"
OUT.mkdir(parents=True, exist_ok=True)

SIZE = 1400
DAY = (243, 238, 230)
NIGHT = (52, 45, 38)
CORE = (235, 228, 214)


def knock_chroma(im: Image.Image, pred) -> Image.Image:
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            if pred(r, g, b):
                px[x, y] = (r, g, b, 0)
    return im


def knock_white(im: Image.Image, thresh: int = 228) -> Image.Image:
    def pred(r, g, b):
        mn = min(r, g, b)
        mx = max(r, g, b)
        if mn >= thresh:
            return True
        if mn > 210 and mx - mn < 18:
            return True
        return False

    return knock_chroma(im, pred)


def knock_orange(im: Image.Image) -> Image.Image:
    def pred(r, g, b):
        # dotted orange collage bg
        if r > 180 and g > 60 and g < 180 and b < 90:
            return True
        if r > 210 and g > 80 and b < 110:
            return True
        return False

    return knock_chroma(im, pred)


def bbox(im: Image.Image, alpha=12) -> tuple[int, int, int, int]:
    a = im.split()[-1]
    # tighten
    mask = a.point(lambda p: 255 if p > alpha else 0)
    box = mask.getbbox()
    if not box:
        return (0, 0, im.width, im.height)
    return box


def crop_subject(im: Image.Image) -> Image.Image:
    l, t, r, b = bbox(im)
    pad = int(max(r - l, b - t) * 0.02)
    l = max(0, l - pad)
    t = max(0, t - pad)
    r = min(im.width, r + pad)
    b = min(im.height, b + pad)
    return im.crop((l, t, r, b))


def stage(im: Image.Image, bg: tuple[int, int, int], fill: float = 0.58) -> Image.Image:
    im = im.convert("RGBA")
    im = crop_subject(im)
    max_h = int(SIZE * fill)
    max_w = int(SIZE * 0.70)
    scale = min(max_w / im.width, max_h / im.height)
    nw, nh = max(1, int(im.width * scale)), max(1, int(im.height * scale))
    im = im.resize((nw, nh), Image.Resampling.LANCZOS)

    canvas = Image.new("RGB", (SIZE, SIZE), bg)
    # soft contact shadow in studio ink, not white
    shadow = Image.new("L", (SIZE, SIZE), 0)
    sd = ImageDraw.Draw(shadow)
    x = (SIZE - nw) // 2
    y = int(SIZE * 0.56 - nh / 2)
    sd.ellipse((x + 24, y + nh - 22, x + nw - 24, y + nh + 28), fill=55)
    shadow = shadow.filter(ImageFilter.GaussianBlur(16))
    shade = Image.new("RGB", (SIZE, SIZE), (28, 22, 16) if bg[0] > 80 else (12, 10, 8))
    canvas = Image.composite(shade, canvas, shadow)
    canvas.paste(im, (x, y), im)
    return canvas


def load(path: Path) -> Image.Image:
    return Image.open(path).convert("RGBA")


def jack_black_bottles() -> tuple[Image.Image, Image.Image]:
    src = knock_orange(load(ROOT / "artifacts/searched_images/rPspK.jpg"))
    w, h = src.size
    left = crop_subject(src.crop((0, 0, int(w * 0.38), h)))
    right = crop_subject(src.crop((int(w * 0.62), 0, w, h)))
    return left, right


def clay_closed() -> Image.Image:
    src = knock_white(load(ROOT / "artifacts/searched_images/9rzVg.jpg"))
    w, h = src.size
    # closed jar sits lower-right
    return crop_subject(src.crop((int(w * 0.32), int(h * 0.28), w, h)))


def tonka_catalog() -> Image.Image:
    return load(ROOT / "artifacts/imagine_images/2134f1c8-a336-4ae0-9f28-393a3c5ffa09.jpg")


def main() -> None:
    moist, spf20 = jack_black_bottles()
    cleanser = knock_white(load(ROOT / "artifacts/searched_images/dCQg4.jpg"))
    vitc = knock_white(load(ROOT / "public/sample/cut/skinceuticals-ce.webp"))
    retinol = knock_white(load(ROOT / "artifacts/searched_images/OhgPB.jpg"))
    bergamot = knock_white(load(ROOT / "artifacts/searched_images/P7O1a.jpg"))
    vetiver = knock_white(load(ROOT / "artifacts/searched_images/f018u.jpg"))
    balm = knock_white(load(ROOT / "public/sample/cut/lelabo-beard.webp"))
    night = load(ROOT / "artifacts/imagine_images/67360e07-11cd-48ef-a706-645ac97a5a0c.jpg")
    tonka = tonka_catalog()
    clay = clay_closed()

    jobs = [
        ("e_cleanser", cleanser, DAY, 0.62),
        ("e_vitc", vitc, DAY, 0.56),
        ("e_moist", moist, DAY, 0.62),
        ("e_spf", spf20, DAY, 0.62),
        ("e_bergamot", bergamot, DAY, 0.60),
        ("e_retinol", retinol, NIGHT, 0.58),
        ("e_night", night, NIGHT, 0.52),
        ("e_tonka", tonka, NIGHT, 0.56),
        ("e_vetiver", vetiver, CORE, 0.60),
        ("e_clay", clay, CORE, 0.50),
        ("e_balm", balm, CORE, 0.50),
    ]
    for key, im, bg, fill in jobs:
        out = stage(im, bg, fill)
        dest = OUT / f"{key}.webp"
        out.save(dest, "WEBP", quality=88, method=6)
        print("wrote", dest.name)


if __name__ == "__main__":
    main()
