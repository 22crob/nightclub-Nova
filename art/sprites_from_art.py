"""Turns a drawn character into a patron spritesheet for the game.

Input: one image with the character's FRONT view on the left half and BACK
view on the right half, on a plain white background (labels underneath are
fine). The front view should face down-left, the back view up-right.

Output: game/src/assets/sprites/patrons/patron_NN.png in the same layout as
the old Blender sheets (see patrons.json): rows idle/walk/dance x
front/back, 16 columns. The animation is made by moving pieces of the
picture: the head bobs and tilts on the body, the arms swing from the
shoulders (they are cut free below the armpits), the legs take turns stepping,
and the whole figure bounces and sways to the beat.

    python3 art/sprites_from_art.py IMAGE INDEX [--chin 631] [--hip 361]

--chin and --hip are how far the chin and the hips are above the soles,
in pixels of the picture. Every outfit is drawn on the same base body at
the same size, so the defaults fit them all; measuring from the feet keeps
tall hair or a hat from shifting the cuts. The body is scaled the same for
every outfit too (feet to chin = BODY of the standing height), so hair and
hats simply stand taller.
"""
import argparse
import json
import math
import os

from PIL import Image, ImageChops, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(HERE, '..', 'game', 'src', 'assets', 'sprites', 'patrons')
META = json.load(open(os.path.join(OUT_DIR, 'patrons.json')))
FW, FH = META['frameWidth'], META['frameHeight']
FEET_Y = META['originY'] * FH          # where the feet stand in a frame
HEIGHT = META['standingHeight']        # character height in a frame, px
BODY = 0.63                            # feet-to-chin share of standing height
SS = 4                                 # work at 4x, then shrink: smooth edges
TAU = 2 * math.pi


def cut_out(img):
    """Removes the white background reachable from the picture's edges."""
    rgb = img.convert('RGB')
    key = (255, 0, 255)
    w, h = rgb.size
    for x in range(0, w, 16):
        for y in (0, h - 1):
            if sum(rgb.getpixel((x, y))) > 700:
                ImageDraw.floodfill(rgb, (x, y), key, thresh=60)
    for y in range(0, h, 16):
        for x in (0, w - 1):
            if sum(rgb.getpixel((x, y))) > 700:
                ImageDraw.floodfill(rgb, (x, y), key, thresh=60)
    r, g, b = rgb.split()
    bg = ImageChops.multiply(
        ImageChops.multiply(r.point(lambda v: 255 if v == 255 else 0), g.point(lambda v: 255 if v == 0 else 0)),
        b.point(lambda v: 255 if v == 255 else 0))
    alpha = ImageChops.invert(bg).filter(ImageFilter.MinFilter(3))  # trim the white fringe
    out = img.convert('RGBA')
    out.putalpha(alpha)
    return out


def figure(img):
    """The character only: the biggest blob, cropped (drops the label)."""
    a = img.getchannel('A')
    # Keep rows down to the first fully empty gap below the body (the label
    # sits under that gap).
    w, h = img.size
    box = a.getbbox()
    top = box[1]
    rows = [a.crop((0, y, w, y + 1)).getbbox() is not None for y in range(h)]
    y = top
    while y < h and rows[y]:
        y += 1
    return img.crop((box[0], top, box[2], y)).crop(img.crop((box[0], top, box[2], y)).getbbox())


def runs(a, y, w):
    """The opaque stretches (x0, x1) along row y."""
    out, start = [], None
    for x in range(w):
        on = a.getpixel((x, y)) > 0
        if on and start is None:
            start = x
        elif not on and start is not None:
            out.append((start, x))
            start = None
    if start is not None:
        out.append((start, w))
    return out


def cut_left_arm(fig, cy, hy):
    """Lifts the left arm off the figure, following it down row by row
    from the armpit (the first row where it hangs free of the body) to the
    hand, and straight up from there to the shoulder. The shoulder cap
    stays on the body too, so no hole shows when the arm swings. Returns (arm, pivot) or None."""
    w, h = fig.size
    a = fig.getchannel('A')
    box = a.getbbox()
    narrow = 0.3 * (box[2] - box[0])     # an arm is under a third of his width
    rows, prev = {}, None
    for y in range(cy, min(h, hy + int(0.15 * h))):
        r = runs(a, y, w)
        arm = r[0] if len(r) >= 2 and r[0][1] - r[0][0] < narrow else None
        if arm and prev and (arm[1] < prev[0] or arm[0] > prev[1]):
            arm = None                   # a different part, not the arm
        if arm is None:
            if rows:
                break
            continue
        rows[y] = (arm[1] + r[1][0]) // 2   # split in the middle of the gap
        prev = arm
    if len(rows) < 0.05 * h:
        return None
    top = min(rows)
    split = rows[top]
    # Above the armpit the upper arm touches the jacket; carry the cut
    # straight up to the shoulder (where the outline first reaches out
    # past the split line below the neck).
    left_edge = {y: r[0][0] for y in range(cy, top) if (r := runs(a, y, w))}
    neck = max(left_edge, key=left_edge.get, default=top)
    shoulder = next((y for y in range(neck, top)
                     if left_edge.get(y, w) <= split + 0.02 * w), top)
    cap = int(0.05 * h)
    piece = Image.new('RGBA', fig.size)
    for y in range(shoulder, max(rows) + 1):
        x1 = rows.get(y, split)
        piece.paste(fig.crop((0, y, x1, y + 1)), (0, y))
        if y >= shoulder + cap:
            fig.paste((0, 0, 0, 0), (0, y, x1, y + 1))
    box = piece.crop((0, shoulder, w, shoulder + cap)).getbbox()
    pivot = ((box[0] + box[2]) / 2, shoulder + cap * 0.6)
    return piece, pivot


def cut_arms(fig, cy, hy):
    """Both arms, as armL/armR pieces with pivots at the shoulders."""
    out = {'armL': None, 'armR': None}
    left = cut_left_arm(fig, cy, hy)
    flipped = fig.transpose(Image.FLIP_LEFT_RIGHT)
    right = cut_left_arm(flipped, cy, hy)
    fig.paste(flipped.transpose(Image.FLIP_LEFT_RIGHT))
    w = fig.size[0]
    if left:
        out['armL'], out['armL_pivot'] = left
    if right:
        out['armR'] = right[0].transpose(Image.FLIP_LEFT_RIGHT)
        out['armR_pivot'] = (w - right[1][0], right[1][1])
    return out


def pieces(fig, chin, hip):
    """Splits the figure into head, body, arms and the two legs (left/right
    of the middle), each the full figure's size so they line up."""
    w, h = fig.size
    cy, hy = int(h * chin), int(h * hip)
    fig = fig.copy()

    def band(y0, y1, x0=0, x1=None):
        p = Image.new('RGBA', fig.size)
        region = fig.crop((x0, y0, x1 or w, y1))
        p.paste(region, (x0, y0))
        return p

    # Find the middle between the legs from the opaque pixels at the hips.
    arms = cut_arms(fig, cy, hy)
    a = fig.getchannel('A')
    xs = [x for x in range(w) if a.getpixel((x, min(h - 1, hy + (h - hy) // 2))) > 0]
    mid = (xs[0] + xs[-1]) // 2 if xs else w // 2
    return {
        **arms,
        'head': band(0, cy),
        'body': band(cy, hy),
        'legL': band(hy, h, 0, mid),
        'legR': band(hy, h, mid, w),
        'chin_y': cy,
        'hip_y': hy,
    }


def place(canvas, piece, dx, dy, angle=0.0, pivot=None, scale=(1.0, 1.0)):
    """Pastes a piece, rotated (degrees) about pivot and scaled, offset."""
    p = piece
    if scale != (1.0, 1.0):
        w, h = p.size
        p = p.resize((max(1, int(w * scale[0])), max(1, int(h * scale[1]))), Image.LANCZOS)
    if angle:
        p = p.rotate(angle, resample=Image.BICUBIC, center=pivot, expand=False)
    canvas.alpha_composite(p, (int(dx), int(dy)))


def frame(parts, size, anim, t):
    """One animation frame of the figure at 4x, feet at the bottom middle."""
    w, h = size
    cw, ch = FW * SS, FH * SS
    canvas = Image.new('RGBA', (cw, ch))
    ox = (cw - w) // 2
    oy = int(FEET_Y * SS) - h
    head_dy = head_rot = body_rot = 0.0
    lift_l = lift_r = 0.0
    arm_l = arm_r = 0.0               # degrees; positive swings outward
    bob = 0.0
    sq = 1.0
    if anim == 'idle':
        bob = -0.004 * h * (0.5 - 0.5 * math.cos(TAU * t))
        head_dy = -0.004 * h * math.sin(TAU * t)
        head_rot = 1.5 * math.sin(TAU * t)
        arm_l = arm_r = 2 * (0.5 - 0.5 * math.cos(TAU * t))
    elif anim == 'walk':
        s = math.sin(TAU * t)
        bob = -0.02 * h * abs(s)
        lift_l = 0.035 * h * max(0.0, s)
        lift_r = 0.035 * h * max(0.0, -s)
        body_rot = 2.5 * s
        head_rot = -1.5 * s
        arm_l, arm_r = 14 * s, -14 * s
    elif anim == 'dance':
        beat = t * 4
        bounce = abs(math.sin(math.pi * beat))
        bob = -0.05 * h * bounce
        sq = 1.0 - 0.03 * (1 - bounce)
        body_rot = 7 * math.sin(TAU * t)
        head_rot = -5 * math.sin(math.pi * beat) - 0.5 * body_rot
        head_dy = 0.012 * h * (1 - bounce)
        side = math.sin(math.pi * beat)
        lift_l = 0.03 * h * max(0.0, side)
        lift_r = 0.03 * h * max(0.0, -side)
        # Bar 1: arms pump on the beat; bar 2: one hand up, then the other.
        pump = 0.5 - 0.5 * math.cos(TAU * beat)
        if t < 0.5:
            arm_l = arm_r = 20 + 30 * pump
        else:
            u = (t - 0.5) * 2
            up = math.sin(math.pi * u) ** 2
            arm_l = 20 + (115 * up if u < 0.5 else 15 * pump)
            arm_r = 20 + (115 * up if u >= 0.5 else 15 * pump)

    hip_pivot = (w / 2, parts['hip_y'])
    chin_pivot = (w / 2, parts['chin_y'])
    # Upper body = body + head, swaying about the hips.
    upper = Image.new('RGBA', size)
    upper.alpha_composite(parts['body'])
    place(upper, parts['head'], 0, head_dy, head_rot, chin_pivot)
    for side, ang in (('armL', -arm_l), ('armR', arm_r)):
        if parts.get(side) is not None:
            place(upper, parts[side], 0, 0, ang, parts[side + '_pivot'])
    legs = Image.new('RGBA', size)
    place(legs, parts['legL'], 0, -lift_l)
    place(legs, parts['legR'], 0, -lift_r)
    whole = Image.new('RGBA', size)
    whole.alpha_composite(legs)
    place(whole, upper, 0, 0, body_rot, hip_pivot)
    if sq != 1.0:
        nh = int(h * sq)
        whole = whole.resize((w, nh), Image.LANCZOS)
        canvas.alpha_composite(whole, (ox, int(oy + (h - nh) + bob)))
    else:
        canvas.alpha_composite(whole, (ox, int(oy + bob)))
    return canvas.resize((FW, FH), Image.LANCZOS)


def build_sheet(path, chin, hip):
    src = Image.open(path)
    W, H = src.size
    views = {}
    for name, box in (('front', (0, 0, W // 2, H)), ('back', (W // 2, 0, W, H))):
        fig = figure(cut_out(src.crop(box)))
        # Room around him for arms swinging out and up.
        fw, fh = fig.size
        mx, my = fw // 2, fh // 4
        padded = Image.new('RGBA', (fw + 2 * mx, fh + my))
        padded.paste(fig, (mx, my))
        # Cut at full size (the gaps under the arms are clearer), then shrink.
        ph = fh + my
        parts = pieces(padded, (ph - chin) / ph, (ph - hip) / ph)
        scale = BODY * HEIGHT * SS / chin
        size = (int(padded.size[0] * scale), int(padded.size[1] * scale))
        for k, v in list(parts.items()):
            if isinstance(v, Image.Image):
                parts[k] = v.resize(size, Image.LANCZOS)
            elif isinstance(v, tuple):
                parts[k] = (v[0] * scale, v[1] * scale)
            elif v is not None:
                parts[k] = v * scale
        views[name] = (parts, size)
    sheet = Image.new('RGBA', (FW * META['columns'], FH * len(META['rows'])))
    for row_name, row in META['rows'].items():
        anim, direction = row_name.split('_')
        parts, size = views[direction]
        n = META['frames'][anim]
        for f in range(n):
            sheet.alpha_composite(frame(parts, size, anim, f / n), (f * FW, row * FH))
    return sheet


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('image')
    ap.add_argument('index', type=int)
    ap.add_argument('--chin', type=float, default=631)
    ap.add_argument('--hip', type=float, default=361)
    ap.add_argument('--out', default=None)
    args = ap.parse_args()
    sheet = build_sheet(args.image, args.chin, args.hip)
    out = args.out or os.path.join(OUT_DIR, f'patron_{args.index:02d}.png')
    sheet.quantize(256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(out, optimize=True)
    print('wrote', out)


if __name__ == '__main__':
    main()
