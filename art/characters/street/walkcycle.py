# Builds a proper left-right walk from a ChatGPT walk sheet (6 frames front,
# 6 back) where the same leg may be forward in every frame: the widest
# stride, the frame with the feet closest together, and the stride with its
# legs flipped for the other step.
import sys, os
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from cutwhite import cut_white  # noqa: E402

def frames(sheet):
    im = Image.open(sheet).convert('RGB'); w, h = im.size
    cw = w / 6; mid = h // 2
    rows = []
    for r in range(2):
        rows.append([cut_white(im.crop((int(i * cw), r * mid, int((i + 1) * cw), (r + 1) * mid)), 225) for i in range(6)])
    return rows

def runs(v):
    out = []; s = None
    for i, x in enumerate(v):
        if x and s is None: s = i
        if not x and s is not None: out.append((s, i)); s = None
    if s is not None: out.append((s, len(v)))
    return out

def leg_split(fr):
    """The row where the legs part (two separate runs, all the way to the feet)."""
    a = np.array(fr)[:, :, 3] > 0
    h = a.shape[0]
    y = h - 1
    for yy in range(h - 1, int(h * 0.55), -1):
        if len([r for r in runs(a[yy]) if r[1] - r[0] > 3]) >= 2: y = yy
        elif yy < h - 12: break
    return y

def stride(fr):
    """How far apart the feet are (bottom 12% of the figure)."""
    a = np.array(fr)[:, :, 3] > 0
    h = a.shape[0]; ys, xs = np.nonzero(a[int(h * 0.88):])
    return (xs.max() - xs.min()) + 2 * (ys.max() - ys.min())

HIP = 0.68
def hem(fr):
    """Where to swap the legs: just under a skirt or shorts (only bare legs and
    shoes swap, no seam in the clothes); from the hips for long trousers."""
    a = np.array(fr).astype(int); h = a.shape[0]
    rgb, al = a[..., :3], a[..., 3] > 0
    skin = (rgb[..., 0] > 200) & (rgb[..., 0] - rgb[..., 2] > 25) & (rgb[..., 1] > 140) & (rgb[..., 0] - rgb[..., 1] < 70) & (rgb[..., 1] - rgb[..., 2] < 28)
    frac = [(skin[y] & al[y]).sum() / max(1, al[y].sum()) for y in range(h)]
    seen_legs = False
    for y in range(int(h * 0.92), int(h * 0.55), -1):
        if frac[y] > 0.55: seen_legs = True
        elif seen_legs and frac[y] < 0.3:
            y_hem = y + 3
            return y_hem if y_hem < h * 0.84 else int(h * HIP)
    return int(h * HIP)
def flip_legs(fr):
    """The other step: the legs below where they part, mirrored round the hips."""
    a = np.array(fr)
    y = hem(fr)
    row = np.nonzero(a[y, :, 3] > 0)[0]
    cx = (row.min() + row.max()) / 2
    lower = Image.fromarray(a[y:]).transpose(Image.FLIP_LEFT_RIGHT)
    out = Image.new('RGBA', (a.shape[1] * 2, a.shape[0]))
    off = a.shape[1] // 2
    upper = a.copy(); upper[y:] = 0
    out.alpha_composite(Image.fromarray(upper), (off, 0))
    # place the mirrored legs so their hip centre lands where it was
    lx = int(round(off + 2 * cx - (a.shape[1] - 1)))
    out.alpha_composite(lower, (lx, y))
    return out.crop(out.getbbox())

def anchor(fr):
    """Feet bottom and the head's centre (the steady part of a walking figure)."""
    a = np.array(fr)[:, :, 3] > 0
    h = a.shape[0]; xs = np.nonzero(a[: int(h * 0.4)].any(0))[0]
    return (xs.min() + xs.max()) / 2, np.nonzero(a.any(1))[0].max()

def cycle(row):
    s = [stride(f) for f in row]
    A = row[int(np.argmax(s))]; P = row[int(np.argmin(s))]
    return [A, P, flip_legs(A), P]

def place(fr, size, base_x, base_y, scale, lift=0):
    cx, by = anchor(fr)
    im = fr.resize((max(1, int(fr.width * scale)), max(1, int(fr.height * scale))), Image.LANCZOS)
    return im, (int(base_x - cx * scale), int(base_y - by * scale - lift))
