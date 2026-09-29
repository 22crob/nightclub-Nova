#!/usr/bin/env python3
"""Isometric bar sprite for Nightclub Nova.

One "set" is three pieces along the wall: a front counter, an open gap for the
bartender, and a back bar with a glowing glass rack, lit bottle displays and
bottles. Sets are drawn so they can be placed side by side to build a long bar.

    python bar.py                  # sprites/bar_set.png + sprites/bar_preview.png
    python bar.py --scale 2        # bigger sprite
"""

import argparse
import os

from PIL import Image, ImageChops, ImageDraw, ImageFilter

SS = 3  # supersampling factor

# Colours
WOOD = (74, 42, 26)
WOOD_LINE = (48, 26, 16)
WOOD_HI = (104, 62, 38)
SLATE_TOP = (52, 62, 76)
SLATE_HI = (98, 112, 130)
SLATE_FRONT = (30, 36, 46)
SLATE_SIDE = (38, 45, 57)
TRIM = (18, 20, 26)
CAB_FRONT = (26, 28, 36)
CAB_SIDE = (34, 37, 46)
CAB_TOP = (44, 48, 60)
GLASS = (170, 225, 255)
GLOW_BLUE = (60, 150, 255)
AMBER = (255, 150, 50)
BOTTLE = (34, 52, 46)

# Layout, in tile units. u runs along the bar, v runs back toward the wall, z is up.
LEN = 1.0
FRONT_V0, FRONT_V1 = 0.0, 0.34   # front counter depth
BACK_V0, BACK_V1 = 0.78, 1.08    # back bar depth
FRONT_H = 0.52
BACK_H = 0.46
WALL_H = 1.45


class Iso:
    def __init__(self, tile, origin):
        self.t = tile
        self.ox, self.oy = origin

    def p(self, u, v, z):
        t = self.t
        return (self.ox + (u + v) * t, self.oy + (u - v) * t / 2 - z * t * 0.9)


def shade(c, f):
    return tuple(max(0, min(255, int(x * f))) for x in c[:3])


def box(d, iso, u0, u1, v0, v1, z0, z1, top, front, side, outline=TRIM, lw=2, side_face=True):
    """Draw the three visible faces of a box: top, front (-v) and side (+u)."""
    P = iso.p
    if side_face:
        d.polygon([P(u1, v0, z0), P(u1, v1, z0), P(u1, v1, z1), P(u1, v0, z1)], fill=side, outline=outline, width=lw)
    d.polygon([P(u0, v0, z0), P(u1, v0, z0), P(u1, v0, z1), P(u0, v0, z1)], fill=front, outline=outline, width=lw)
    d.polygon([P(u0, v0, z1), P(u1, v0, z1), P(u1, v1, z1), P(u0, v1, z1)], fill=top, outline=outline, width=lw)


def slats(d, iso, u0, u1, v, z0, z1, n, color=WOOD_LINE, hi=WOOD_HI, lw=2):
    """Vertical wood slats on a front (-v) face."""
    for i in range(1, n):
        u = u0 + (u1 - u0) * i / n
        d.line([iso.p(u, v, z0), iso.p(u, v, z1)], fill=color, width=lw)
        d.line([iso.p(u + 0.006, v, z0), iso.p(u + 0.006, v, z1)], fill=hi, width=max(1, lw // 2))


def glossy_top(d, iso, u0, u1, v0, v1, z, n):
    """Split the counter top into tiles, each with a diagonal sheen."""
    for i in range(n):
        a, b = u0 + (u1 - u0) * i / n, u0 + (u1 - u0) * (i + 1) / n
        d.polygon([iso.p(a, v0, z), iso.p(b, v0, z), iso.p(b, v1, z), iso.p(a, v1, z)],
                  fill=SLATE_TOP, outline=TRIM, width=2 * SS)
        m = (a + b) / 2
        w = (b - a) * 0.18
        d.polygon([iso.p(m - w, v0 + 0.03, z), iso.p(m + w * 0.4, v0 + 0.03, z),
                   iso.p(m + w * 1.6, v1 - 0.03, z), iso.p(m + w * 0.2, v1 - 0.03, z)],
                  fill=shade(SLATE_HI, 0.8))


def glass(d, glow_d, x, y, s):
    """Tall pint glass in screen space, base centre at (x, y)."""
    w, h = 5 * s, 16 * s
    d.polygon([(x - w, y - h), (x + w, y - h), (x + w * 0.75, y), (x - w * 0.75, y)],
              fill=shade(GLASS, 0.75), outline=GLASS, width=max(1, int(s)))
    d.line([(x - w * 0.5, y - h + 2 * s), (x - w * 0.35, y - 2 * s)], fill=(255, 255, 255), width=max(1, int(s)))
    glow_d.ellipse([x - w * 1.6, y - h * 1.1, x + w * 1.6, y + 3 * s], fill=GLOW_BLUE)


def wine_glass(d, x, y, s):
    d.line([(x, y), (x, y - 7 * s)], fill=(235, 240, 245), width=max(1, int(s)))
    d.line([(x - 3 * s, y), (x + 3 * s, y)], fill=(235, 240, 245), width=max(1, int(s)))
    d.polygon([(x - 4 * s, y - 13 * s), (x + 4 * s, y - 13 * s), (x, y - 7 * s)], fill=(235, 240, 245))


def bottle(d, x, y, s, color=BOTTLE, hi=(110, 150, 130)):
    """Wine bottle silhouette, base centre at (x, y)."""
    w, h = 6 * s, 42 * s
    d.rounded_rectangle([x - w, y - h * 0.62, x + w, y], radius=w, fill=color)
    d.polygon([(x - w, y - h * 0.6), (x + w, y - h * 0.6), (x + w * 0.35, y - h * 0.8), (x - w * 0.35, y - h * 0.8)], fill=color)
    d.rectangle([x - w * 0.35, y - h, x + w * 0.35, y - h * 0.78], fill=color)
    d.line([(x - w * 0.5, y - h * 0.55), (x - w * 0.5, y - h * 0.1)], fill=hi, width=max(1, int(s)))


def display_tower(d, glow_d, iso, u, s):
    """Lit bottle display box on a post, sitting on the back counter."""
    v0, v1 = BACK_V0 + 0.08, BACK_V1 - 0.04
    w = 0.07
    # post
    box(d, iso, u - 0.012, u + 0.012, v0 + 0.1, v0 + 0.14, BACK_H, BACK_H + 0.42, CAB_TOP, CAB_FRONT, CAB_SIDE, lw=SS)
    # box
    z0, z1 = BACK_H + 0.42, BACK_H + 0.72
    box(d, iso, u - w, u + w, v0, v1, z0, z1, CAB_TOP, CAB_FRONT, CAB_SIDE, lw=2 * SS)
    # lit niche with an amber bottle inside
    a, b = iso.p(u - w * 0.6, v0, z0 + 0.05), iso.p(u + w * 0.6, v0, z1 - 0.04)
    x0, x1 = a[0], b[0]
    y_bot, y_top = a[1], b[1]
    d.polygon([iso.p(u - w * 0.6, v0, z0 + 0.05), iso.p(u + w * 0.6, v0, z0 + 0.05),
               iso.p(u + w * 0.6, v0, z1 - 0.04), iso.p(u - w * 0.6, v0, z1 - 0.04)], fill=(120, 50, 20))
    cx = (x0 + x1) / 2
    base = iso.p(u, v0, z0 + 0.06)[1]
    bottle(d, cx, base, s * 0.8, color=AMBER, hi=(255, 230, 170))
    glow_d.ellipse([cx - 18 * s, base - 40 * s, cx + 18 * s, base + 4 * s], fill=AMBER)
    # wine glasses on top
    for du in (-0.035, 0.035):
        x, y = iso.p(u + du, (v0 + v1) / 2, z1)
        wine_glass(d, x, y, s)


def draw_set(img, glow, iso, u0, s, end_face=True):
    d = ImageDraw.Draw(img)
    gd = ImageDraw.Draw(glow)
    u1 = u0 + LEN
    lw = 2 * SS

    # --- back wall panel ---
    box(d, iso, u0, u1, BACK_V1, BACK_V1 + 0.05, 0, WALL_H, CAB_TOP, (22, 20, 24), CAB_SIDE, lw=lw, side_face=end_face)
    slats(d, iso, u0, u1, BACK_V1, BACK_H, WALL_H, 18, color=(12, 12, 16), hi=(34, 32, 38), lw=SS)

    # --- back bar cabinet ---
    box(d, iso, u0, u1, BACK_V0, BACK_V1, 0, BACK_H, CAB_TOP, WOOD, shade(WOOD, 1.15), lw=lw, side_face=end_face)
    slats(d, iso, u0, u1, BACK_V0, 0.04, BACK_H - 0.05, 16, lw=SS)
    box(d, iso, u0, u1, BACK_V0 - 0.02, BACK_V1, BACK_H - 0.05, BACK_H, CAB_TOP, TRIM, CAB_SIDE, lw=SS, side_face=end_face)

    # items on the back counter, back to front, left to right
    towers = [u0 + LEN * 0.25, u0 + LEN * 0.75]
    for i in range(4):
        uu = u0 + LEN * (0.125 + i * 0.25)
        x, y = iso.p(uu, BACK_V1 - 0.07, BACK_H)
        bottle(d, x, y, s)
    for t in towers:
        display_tower(d, gd, iso, t, s)
    for i in range(10):
        uu = u0 + LEN * (0.05 + i * 0.1)
        for row, vv in enumerate((BACK_V0 + 0.14, BACK_V0 + 0.06)):
            x, y = iso.p(uu + row * 0.03, vv, BACK_H)
            glass(d, gd, x, y, s)

    # --- front counter ---
    # kick plate
    box(d, iso, u0, u1, FRONT_V0 - 0.01, FRONT_V1, 0, 0.04, TRIM, TRIM, TRIM, lw=SS, side_face=end_face)
    box(d, iso, u0, u1, FRONT_V0, FRONT_V1, 0, FRONT_H - 0.05, CAB_TOP, WOOD, shade(WOOD, 1.15), lw=lw, side_face=end_face)
    slats(d, iso, u0, u1, FRONT_V0, 0.03, FRONT_H - 0.08, 20, lw=SS)
    # slab top overhanging the front
    box(d, iso, u0, u1, FRONT_V0 - 0.05, FRONT_V1 + 0.02, FRONT_H - 0.05, FRONT_H,
        SLATE_TOP, SLATE_FRONT, SLATE_SIDE, lw=lw, side_face=end_face)
    glossy_top(d, iso, u0, u1, FRONT_V0 - 0.05, FRONT_V1 + 0.02, FRONT_H, 2)


def render(n_sets=1, tile=220, scale=1.0):
    t = int(tile * scale * SS)
    s = max(1, int(scale * SS))
    w = int((n_sets * LEN + BACK_V1 + 0.12) * t) + 2 * t // 10
    h = int((n_sets * LEN + BACK_V1) * t / 2 + WALL_H * t * 0.9) + t // 3
    iso = Iso(t, (t // 10, h - (n_sets * LEN) * t / 2 - t // 8))
    iso.oy = WALL_H * t * 0.9 + BACK_V1 * t / 2 + t // 10

    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    glow = Image.new("RGB", (w, h))
    for i in range(n_sets):
        draw_set(img, glow, iso, i * LEN, s, end_face=True)

    glow = glow.filter(ImageFilter.GaussianBlur(10 * s))
    glow = ImageChops.multiply(glow, Image.new("RGB", glow.size, (150, 150, 150)))
    rgb = ImageChops.add(img.convert("RGB"), glow)
    alpha = img.getchannel("A")
    alpha = ImageChops.lighter(alpha, glow.convert("L").point(lambda v: min(255, v * 2)))
    out = rgb.convert("RGBA")
    out.putalpha(alpha)
    out = out.crop(out.getbbox())
    return out.resize((out.width // SS, out.height // SS), Image.LANCZOS)


def preview(sprite, bg=(38, 40, 50)):
    pad = 40
    im = Image.new("RGBA", (sprite.width + pad * 2, sprite.height + pad * 2), bg + (255,))
    im.alpha_composite(sprite, (pad, pad))
    return im.convert("RGB")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--scale", type=float, default=1.0)
    ap.add_argument("--out", default="sprites")
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)

    one = render(1, scale=args.scale)
    one.save(os.path.join(args.out, "bar_set.png"))
    preview(one).save(os.path.join(args.out, "bar_set_preview.png"))
    preview(render(3, scale=args.scale)).save(os.path.join(args.out, "bar_x3_preview.png"))
    print("wrote", args.out)


if __name__ == "__main__":
    main()
