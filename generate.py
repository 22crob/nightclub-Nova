#!/usr/bin/env python3
"""Procedural 2D image generator for Nightclub Nova.

Renders neon, synthwave-style poster art: a gradient night sky, stars, an
exploding "nova" burst, sweeping club light beams, a perspective grid dance
floor, and glowing title text. Every image is deterministic for a given seed.

Examples:
    python generate.py                                  # one random poster
    python generate.py --seed 42 --palette magenta
    python generate.py --count 6 --out output/
    python generate.py --title NOVA --subtitle "FRI 10PM" --size 1920x1080
"""

import argparse
import math
import os
import random

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
TITLE_FONT = os.path.join(HERE, "fonts", "Tektur-Medium.ttf")
BODY_FONT = os.path.join(HERE, "fonts", "Outfit-Regular.ttf")

# Each palette: sky top, sky horizon, primary neon, secondary neon, accent.
PALETTES = {
    "magenta": [(8, 2, 24), (70, 8, 90), (255, 45, 170), (0, 230, 255), (255, 210, 90)],
    "cyber": [(2, 6, 20), (10, 40, 90), (0, 255, 200), (140, 80, 255), (255, 80, 160)],
    "sunset": [(12, 4, 30), (140, 30, 70), (255, 120, 40), (255, 50, 140), (255, 230, 120)],
    "ice": [(2, 4, 16), (20, 30, 80), (120, 200, 255), (220, 120, 255), (255, 255, 255)],
    "acid": [(4, 10, 6), (20, 60, 30), (170, 255, 40), (255, 40, 200), (40, 220, 255)],
}


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def load_font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except OSError:
        return ImageFont.load_default(size)


def glow(layer, radii=(2, 8, 24)):
    """Additive bloom: stack progressively blurrier copies of a layer."""
    out = layer.copy()
    for r in radii:
        out = ImageChops.add(out, layer.filter(ImageFilter.GaussianBlur(r)))
    return out


def sky(w, h, horizon, pal):
    y = np.linspace(0, 1, horizon)[:, None]
    top, bot = np.array(pal[0]), np.array(pal[1])
    grad = top + (bot - top) * (y ** 1.6)[..., None]
    arr = np.zeros((h, w, 3))
    arr[:horizon] = grad
    arr[horizon:] = np.array(pal[0]) * 0.6
    return Image.fromarray(arr.clip(0, 255).astype(np.uint8), "RGB")


def stars(w, horizon, rng):
    layer = Image.new("RGB", (w, horizon))
    d = ImageDraw.Draw(layer)
    for _ in range(int(w * horizon / 2500)):
        x, y = rng.uniform(0, w), rng.uniform(0, horizon) ** 1.0
        b = int(255 * rng.random() ** 3 * (1 - y / horizon * 0.7))
        r = rng.choice([0, 0, 0, 1])
        d.ellipse([x - r, y - r, x + r, y + r], fill=(b, b, b))
    return layer


def nova(w, h, cx, cy, radius, pal, rng):
    """Radial burst: soft core, rings and spiky rays."""
    layer = Image.new("RGB", (w, h))
    d = ImageDraw.Draw(layer)
    for i in range(rng.randint(40, 90)):
        a = rng.uniform(0, math.tau)
        length = radius * rng.uniform(0.6, 2.4)
        col = pal[2] if i % 3 else pal[3]
        d.line([cx, cy, cx + math.cos(a) * length, cy + math.sin(a) * length],
               fill=tuple(int(c * rng.uniform(0.2, 0.6)) for c in col), width=rng.randint(1, 3))
    for k in range(3):
        r = radius * (0.5 + k * 0.35)
        d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=pal[3 if k % 2 else 2], width=2)
    for k in range(12, 0, -1):
        r = radius * 0.4 * k / 12
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=lerp(pal[4], (255, 255, 255), 1 - k / 12))
    return glow(layer, (4, 16, 48))


def beams(w, h, horizon, pal, rng):
    """Club spotlights fanning up from the floor line."""
    layer = Image.new("RGB", (w, h))
    d = ImageDraw.Draw(layer)
    for _ in range(rng.randint(4, 8)):
        x0 = rng.uniform(0, w)
        a = math.radians(rng.uniform(-160, -20))
        spread = math.radians(rng.uniform(2, 6))
        L = h * 1.5
        pts = [(x0, horizon),
               (x0 + math.cos(a - spread) * L, horizon + math.sin(a - spread) * L),
               (x0 + math.cos(a + spread) * L, horizon + math.sin(a + spread) * L)]
        col = rng.choice(pal[2:])
        d.polygon(pts, fill=tuple(int(c * 0.22) for c in col))
    return layer.filter(ImageFilter.GaussianBlur(6))


def grid_floor(w, h, horizon, pal, rng):
    """Perspective grid receding to a vanishing point on the horizon."""
    layer = Image.new("RGB", (w, h))
    d = ImageDraw.Draw(layer)
    vx = w / 2 + rng.uniform(-w * 0.1, w * 0.1)
    col = pal[2]
    for i in range(-24, 25):
        d.line([vx, horizon, vx + i * w / 8, h], fill=col, width=2)
    depth = h - horizon
    for i in range(1, 22):
        t = (i / 21) ** 2.2
        y = horizon + depth * t
        d.line([0, y, w, y], fill=lerp((0, 0, 0), col, 0.3 + 0.7 * t), width=2)
    d.line([0, horizon, w, horizon], fill=pal[3], width=3)
    return glow(layer, (2, 10))


def neon_text(w, h, text, font, xy, color, anchor="mm"):
    layer = Image.new("RGB", (w, h))
    d = ImageDraw.Draw(layer)
    d.text(xy, text, font=font, fill=color, anchor=anchor)
    core = Image.new("RGB", (w, h))
    ImageDraw.Draw(core).text(xy, text, font=font, fill=lerp(color, (255, 255, 255), 0.75), anchor=anchor)
    return ImageChops.add(glow(layer, (3, 12, 36)), core)


def scanlines(img, strength=0.12):
    arr = np.asarray(img).astype(np.float32)
    arr[::3] *= 1 - strength
    return Image.fromarray(arr.clip(0, 255).astype(np.uint8))


def generate(seed, size=(1080, 1350), palette=None, title="NOVA", subtitle="NIGHTCLUB"):
    rng = random.Random(seed)
    w, h = size
    pal = PALETTES[palette or rng.choice(sorted(PALETTES))]
    horizon = int(h * rng.uniform(0.58, 0.66))

    img = sky(w, h, horizon, pal)
    img = ImageChops.add(img, stars(w, horizon, rng).crop((0, 0, w, h)))
    img = ImageChops.add(img, beams(w, h, horizon, pal, rng))
    cx, cy = w / 2 + rng.uniform(-w * 0.15, w * 0.15), horizon * rng.uniform(0.3, 0.45)
    img = ImageChops.add(img, nova(w, h, cx, cy, min(w, h) * rng.uniform(0.12, 0.2), pal, rng))
    img = ImageChops.add(img, grid_floor(w, h, horizon, pal, rng))

    title_font = load_font(TITLE_FONT, int(min(w / max(len(title), 3) * 0.95, h * 0.2)))
    img = ImageChops.add(img, neon_text(w, h, title, title_font, (w / 2, horizon - h * 0.04), pal[2], "ms"))
    if subtitle:
        sub_font = load_font(BODY_FONT, int(w * 0.055))
        spaced = " ".join(subtitle.upper())
        img = ImageChops.add(img, neon_text(w, h, spaced, sub_font, (w / 2, h * 0.9), pal[3]))

    return scanlines(img)


def parse_size(s):
    w, h = s.lower().split("x")
    return int(w), int(h)


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--seed", type=int, help="seed for the first image (random if omitted)")
    p.add_argument("--count", type=int, default=1)
    p.add_argument("--palette", choices=sorted(PALETTES))
    p.add_argument("--size", type=parse_size, default=(1080, 1350), help="WIDTHxHEIGHT")
    p.add_argument("--title", default="NOVA")
    p.add_argument("--subtitle", default="NIGHTCLUB")
    p.add_argument("--out", default="output")
    args = p.parse_args()

    os.makedirs(args.out, exist_ok=True)
    base = args.seed if args.seed is not None else random.randrange(10**6)
    for i in range(args.count):
        seed = base + i
        path = os.path.join(args.out, f"nova_{seed}.png")
        generate(seed, args.size, args.palette, args.title, args.subtitle).save(path)
        print(path)


if __name__ == "__main__":
    main()
