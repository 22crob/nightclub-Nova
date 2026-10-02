"""Makes a new patron from an existing sheet by changing the skin tone and
shifting the colours of the clothes, so a few drawn outfits give many
different-looking people.

    python3 art/recolor_patron.py SRC.png OUT.png [--skin 0.6] [--hue 120]

--skin scales the skin's brightness (below 1 is darker, above 1 lighter).
--hue turns the clothes' colours around the colour wheel, in degrees; it
only touches clearly coloured pixels, so black, white and grey stay put,
and leaves browns alone (skin, hair, tan).
"""
import argparse
import colorsys

from PIL import Image


def is_skin(h, s, v):
    return 0.02 <= h <= 0.12 and 0.25 <= s <= 0.9 and v >= 0.3


def is_brown(h):
    """Skin, hair and tan shades: never hue-shifted (they'd go green)."""
    return 0.02 < h < 0.14


def recolor(img, skin, hue):
    img = img.convert('RGBA')
    px = img.load()
    cache = {}
    for y in range(img.size[1]):
        for x in range(img.size[0]):
            r, g, b, a = px[x, y]
            if not a:
                continue
            key = (r, g, b)
            if key not in cache:
                h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
                if is_skin(h, s, v):
                    # Darker skin is a touch richer, lighter skin a touch paler.
                    v = min(1.0, v * skin)
                    s = min(1.0, s * (1.15 if skin < 1 else 0.85))
                elif s > 0.3 and v > 0.25 and not is_brown(h):
                    h = (h + hue / 360) % 1.0
                rgb = colorsys.hsv_to_rgb(h, s, v)
                cache[key] = tuple(int(c * 255 + 0.5) for c in rgb)
            px[x, y] = cache[key] + (a,)
    return img


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src')
    ap.add_argument('out')
    ap.add_argument('--skin', type=float, default=1.0)
    ap.add_argument('--hue', type=float, default=0.0)
    args = ap.parse_args()
    out = recolor(Image.open(args.src), args.skin, args.hue)
    out.quantize(256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(args.out, optimize=True)
    print('wrote', args.out)


if __name__ == '__main__':
    main()
