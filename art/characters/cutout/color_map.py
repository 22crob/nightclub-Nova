"""Colour maps for the cut-out guests, so the game can repaint them.

    python3 art/characters/cutout/color_map.py [NAME ...]   (default: all)
    python3 art/characters/cutout/color_map.py --preview DIR [NAME ...]

For each guest sheet (game/src/assets/sprites/patrons/patron_cut_NAME.png)
this finds the skin, the clothes and the hair, and writes
patrons/colors/NAME.png: a grey map in the sheet's own layout, each pixel's
grey level saying what it is (CODE below, times STEP; black is "leave it"),
and patrons/colors/NAME.json with the colours they were drawn in, which the
game repaints from (scene/variety.js): skin and clothes keep their drawn
shading by taking pixel / drawn colour x new colour, hair takes a ramp from
shadow to highlight at each pixel's own lightness. Run it again after
cutout_rig.py rebuilds a sheet. --preview writes each look in a few new
colours, as the game would make them, for a quick look.

Some parts are left alone on purpose: an outfit that's black already (emo01,
girl02), grey01's grey hair and emo01's two-tone hair are part of who they
are, and girl04's long hair runs into her dark top. The eyes were tried and
dropped (October 2026): their irises are too small to find reliably.
"""
import json
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
SHEETS = os.path.join(HERE, '..', '..', '..', 'game', 'src', 'assets', 'sprites', 'patrons')
OUT = os.path.join(SHEETS, 'colors')
CODE = {'skin': 1, 'cloth': 2, 'cloth2': 3, 'hair': 4}
STEP = 50  # grey level per code, far apart so image decoding can't blur them together


def rgb_to_hsv(rgb):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx = rgb.max(-1); mn = rgb.min(-1); d = mx - mn
    h = np.zeros_like(mx)
    nz = d > 1e-6
    rm = nz & (mx == r); gm = nz & (mx == g) & ~rm; bm = nz & ~rm & ~gm
    h[rm] = ((g - b)[rm] / d[rm]) % 6; h[gm] = ((b - r)[gm] / d[gm]) + 2; h[bm] = ((r - g)[bm] / d[bm]) + 4
    return np.stack([h / 6, np.where(mx > 0, d / np.maximum(mx, 1e-6), 0), mx], -1)


def hue_in(h, lo, hi):
    return (h >= lo) & (h <= hi) if lo <= hi else (h >= lo) | (h <= hi)


# Clothes: a colour rule and the band of each figure (fraction of its height
# from the top of the hair) the garment may be in. The first is 'cloth', a
# second 'cloth2'.
GARMENTS = {
    'suit01': [dict(cream=True, band=(0.42, 0.93))],
    'grey01': [dict(hue=(0.56, 0.72), s=(0.18, 1), v=(0.06, 0.6), band=(0.42, 0.93)),
               dict(hue=(0.93, 0.03), s=(0.4, 1), v=(0.2, 1), band=(0.42, 0.75))],
    'girl01': [dict(hue=(0.78, 0.97), s=(0.18, 1), v=(0.08, 0.7), band=(0.45, 0.94))],
    'girl03': [dict(hue=(0.58, 0.74), s=(0.18, 1), v=(0.1, 0.6), band=(0.42, 0.78))],
    'girl04': [dict(white=True, band=(0.42, 0.80))],
}
HAIR = {
    'suit01': dict(rule=lambda h, s, v: (v < 0.5) & (v > 0.06), band=(0, 0.42)),
    'girl01': dict(rule=lambda h, s, v: v < 0.4, band=(0, 0.5)),
    'girl02': dict(rule=lambda h, s, v: hue_in(h, 0.93, 0.06) & (s > 0.35) & (v > 0.12), band=(0, 0.55)),
    'girl03': dict(rule=lambda h, s, v: hue_in(h, 0.075, 0.17) & (s > 0.15) & (v > 0.45), band=(0, 0.75)),
}


def load(name):
    meta = json.load(open(os.path.join(SHEETS, f'patron_cut_{name}.json')))
    a = np.array(Image.open(os.path.join(SHEETS, f'patron_cut_{name}.png')).convert('RGBA')).astype(float) / 255
    return meta, a


def band_mask(meta, a, lo, hi):
    """Each frame's figure from lo to hi of its height, top of the hair down."""
    W, H = meta['frameWidth'], meta['frameHeight']
    band = np.zeros(a.shape[:2], bool)
    for r in range(a.shape[0] // H):
        for c in range(a.shape[1] // W):
            ys = np.where(a[r * H:(r + 1) * H, c * W:(c + 1) * W, 3].max(1) > 0.5)[0]
            if not len(ys):
                continue
            top, hh = ys[0], ys[-1] - ys[0]
            band[r * H + top + int(lo * hh): r * H + top + int(hi * hh), c * W:(c + 1) * W] = True
    return band


def base_skin(meta, a):
    """The skin colour the guest is drawn in, from the face of the first frame."""
    W, H = meta['frameWidth'], meta['frameHeight']
    f = a[:H, :W]
    ys, xs = np.where(f[..., 3] > 0.5)
    top, h = ys.min(), ys.max() - ys.min()
    mid = int(np.median(xs))
    patch = f[top + int(0.30 * h):top + int(0.42 * h), mid - 12:mid + 12]
    p = patch[patch[..., 3] > 0.9][:, :3]
    hsv = rgb_to_hsv(p)
    return np.median(p[(hsv[:, 1] > 0.12) & (hsv[:, 1] < 0.7) & (hsv[:, 2] > 0.45)], 0)


def skin_mask(a, base, dh=0.02, ds=0.18):
    hb = rgb_to_hsv(base[None])[0]
    hsv = rgb_to_hsv(a[..., :3])
    dhue = np.abs(hsv[..., 0] - hb[0]); dhue = np.minimum(dhue, 1 - dhue)
    m = (a[..., 3] > 0.05) & (dhue < dh) & (hsv[..., 1] > max(hb[1] - ds, hb[1] * 0.72)) & (hsv[..., 1] < hb[1] + ds) & (hsv[..., 2] > hb[2] * 0.55)
    lab, _ = ndimage.label(m)
    keep = np.bincount(lab.ravel()) >= 40; keep[0] = False  # skin comes in solid patches, not specks
    m = keep[lab]
    rim = ndimage.binary_dilation(m) & ~m & (dhue < dh * 1.6) & (a[..., 3] > 0.05)  # the soft edge against the outline
    m = m | rim
    closed = ndimage.binary_closing(m, structure=np.ones((3, 3)), iterations=2)
    holes = closed & ~m & (a[..., 3] > 0.5) & (hsv[..., 2] > 0.55) & (hsv[..., 1] < hb[1] + ds) & ((dhue < 0.06) | (hsv[..., 1] < 0.12))
    return m | holes


def garment_mask(meta, a, rule, skin):
    hsv = rgb_to_hsv(a[..., :3]); h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    if rule.get('white'):
        m = (s < 0.14) & (v > 0.55)
    elif rule.get('cream'):
        m = (s < 0.28) & (v > 0.5) & (hue_in(h, 0.04, 0.17) | (s < 0.08))
    else:
        m = hue_in(h, *rule['hue']) & (s >= rule['s'][0]) & (s <= rule['s'][1]) & (v >= rule['v'][0]) & (v <= rule['v'][1])
    band = band_mask(meta, a, *rule['band'])
    m &= (a[..., 3] > 0.05) & ~skin & band
    lab, _ = ndimage.label(m)
    keep = np.bincount(lab.ravel()) >= 25; keep[0] = False
    m = keep[lab]
    rim = ndimage.binary_dilation(m) & ~m & (a[..., 3] > 0.05) & band & ~skin & (v > 0.15) & (s < 0.5)
    return m | rim


def hair_mask(meta, a, skin, cfg):
    hsv = rgb_to_hsv(a[..., :3])
    m = cfg['rule'](hsv[..., 0], hsv[..., 1], hsv[..., 2]) & (a[..., 3] > 0.05) & ~skin & band_mask(meta, a, *cfg['band'])
    core = ndimage.binary_opening(m, iterations=2)  # hair is one big mass: thin outlines, lips and brows drop out
    lab, _ = ndimage.label(core)
    keep = np.bincount(lab.ravel()) >= 300; keep[0] = False
    return m & ndimage.binary_dilation(keep[lab], iterations=3)


def lightness(rgb):
    return rgb @ np.array([0.3, 0.59, 0.11])


def build(name):
    meta, a = load(name)
    codes = np.zeros(a.shape[:2], np.uint8)
    solid = a[..., 3] > 0.9
    info = {'step': STEP}
    base = base_skin(meta, a)
    skin = skin_mask(a, base)
    codes[skin] = CODE['skin']
    info['skin'] = [round(x * 255) for x in base]
    info['cloth'] = []
    for i, rule in enumerate(GARMENTS.get(name, [])):
        m = garment_mask(meta, a, rule, skin) & (codes == 0)
        codes[m] = CODE['cloth' if i == 0 else 'cloth2']
        info['cloth'].append([round(x * 255) for x in np.median(a[..., :3][m & solid], 0)])
    if name in HAIR:
        m = hair_mask(meta, a, skin, HAIR[name]) & (codes == 0)
        codes[m] = CODE['hair']
        L = lightness(a[..., :3][m & solid])
        info['hair'] = [round(float(np.percentile(L, 3)) * 255), round(float(np.percentile(L, 97)) * 255)]
    os.makedirs(OUT, exist_ok=True)
    Image.fromarray(codes * STEP, 'L').save(os.path.join(OUT, f'{name}.png'), optimize=True)
    json.dump(info, open(os.path.join(OUT, f'{name}.json'), 'w'), indent=2)
    print('wrote', name, {k: int((codes == v).sum()) for k, v in CODE.items()})
    return meta, a, codes, info


# The same repaint the game does (scene/variety.js), for --preview.
def ramp(t, cols):
    cols = np.array(cols) / 255
    t = np.clip(t, 0, 1)[..., None]
    return np.where(t < 0.5, cols[0] + (cols[1] - cols[0]) * (t * 2), cols[1] + (cols[2] - cols[1]) * (t * 2 - 1))


def repaint(a, codes, info, skin=None, cloth=None, hair=None):
    out = a.copy()
    rgb = a[..., :3]
    def by_ratio(code, drawn, new):
        m = codes == code
        out[..., :3][m] = np.clip(rgb[m] / np.maximum(np.array(drawn) / 255, 0.02) * np.array(new) / 255, 0, 1)
    if skin:
        by_ratio(CODE['skin'], info['skin'], skin)
    for i, new in enumerate(cloth or []):
        if i < len(info['cloth']) and new:
            by_ratio(CODE['cloth' if i == 0 else 'cloth2'], info['cloth'][i], new)
    if hair and 'hair' in info:
        m = codes == CODE['hair']
        lo, hi = info['hair'][0] / 255, info['hair'][1] / 255
        out[..., :3][m] = ramp((lightness(rgb[m]) - lo) / max(hi - lo, 1e-3), hair)
    return out


def preview(outdir, names):
    sys.path.insert(0, HERE)
    os.makedirs(outdir, exist_ok=True)
    skins = [(255, 224, 200), (208, 152, 108), (128, 82, 54), (170, 112, 74)]
    cloths = [(28, 32, 48), (120, 24, 40), (40, 70, 52), (190, 170, 140)]
    hairs = [[(30, 18, 12), (70, 44, 28), (130, 92, 64)], [(120, 86, 40), (214, 176, 110), (250, 232, 186)],
             [(60, 20, 12), (140, 58, 30), (210, 120, 80)], [(14, 12, 14), (40, 36, 40), (92, 88, 96)]]
    for name in names:
        meta, a, codes, info = build(name)
        W, H = meta['frameWidth'], meta['frameHeight']
        cells = []
        for k in range(5):
            img = a if k == 0 else repaint(a, codes, info, skins[k - 1], [cloths[k - 1], cloths[-k]], hairs[k - 1])
            for row in ('idle_front', 'walk_front', 'walk_back'):
                st = meta['starts'][row]
                r, c = divmod(st, meta['columns'])
                cells.append(img[r * H:(r + 1) * H, c * W:(c + 1) * W])
        sheet = np.concatenate(cells, 1)
        Image.fromarray((sheet * 255).astype(np.uint8), 'RGBA').save(os.path.join(outdir, f'{name}.png'))


if __name__ == '__main__':
    args = sys.argv[1:]
    out = None
    if args[:1] == ['--preview']:
        out, args = args[1], args[2:]
    names = args or sorted(f[len('patron_cut_'):-4] for f in os.listdir(SHEETS) if f.startswith('patron_cut_') and f.endswith('.png'))
    if out:
        preview(out, names)
    else:
        for n in names:
            build(n)
