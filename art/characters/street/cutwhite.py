import numpy as np
from collections import deque
from PIL import Image
def cut_white(im, thresh=232):
    a = np.array(im.convert('RGBA')).astype(int)
    h, w = a.shape[:2]
    white = a[..., :3].min(-1) > thresh
    bg = np.zeros((h, w), bool); q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if white[y, x] and not bg[y, x]: bg[y, x] = True; q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if white[y, x] and not bg[y, x]: bg[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and white[ny, nx] and not bg[ny, nx]:
                bg[ny, nx] = True; q.append((ny, nx))
    a[..., 3] = np.where(bg, 0, 255)
    out = Image.fromarray(a.astype(np.uint8))
    return out.crop(out.getbbox())
