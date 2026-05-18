"""
Slices everything_grid.png (4 cols × 3 rows) into individual transparent PNGs.

Layout (must match the prompt):
  row 1: mascot,     flower,    star,    heart
  row 2: cloud,      calendar,  health,  todo
  row 3: journal,    stats,     archive, settings

Outputs:
  assets/mascot.png
  assets/deco/flower.png, star.png, heart.png, cloud.png
  assets/tabs/calendar.png, health.png, todo.png, journal.png, stats.png, archive.png, settings.png
"""

from PIL import Image
import numpy as np
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'assets', 'everything_grid.png')

# (filename, destination subfolder relative to assets/, padding, max-side-px)
LAYOUT = [
    # row 1
    [('mascot.png',   '',     14, 600),
     ('flower.png',   'deco', 14, 400),
     ('star.png',     'deco', 14, 400),
     ('heart.png',    'deco', 14, 400)],
    # row 2
    [('cloud.png',    'deco', 14, 400),
     ('calendar.png', 'tabs', 14, 256),
     ('health.png',   'tabs', 14, 256),
     ('todo.png',     'tabs', 14, 256)],
    # row 3
    [('journal.png',  'tabs', 14, 256),
     ('stats.png',    'tabs', 14, 256),
     ('archive.png',  'tabs', 14, 256),
     ('settings.png', 'tabs', 14, 256)],
]


def remove_white_bg(tile, threshold=240, soft=18):
    arr = np.array(tile.convert('RGBA'))
    rgb = arr[..., :3].astype(np.int32)
    d = 255 - rgb.min(axis=2)
    alpha = np.clip((d / soft) * 255, 0, 255).astype(np.uint8)
    near_white = (rgb >= threshold).all(axis=2)
    alpha[near_white] = np.minimum(alpha[near_white], 0)
    arr[..., 3] = alpha
    return Image.fromarray(arr, 'RGBA')


def crop_to_content(tile, padding=12):
    arr = np.array(tile)
    if arr.shape[2] < 4:
        return tile
    alpha = arr[..., 3]
    if alpha.max() == 0:
        return tile
    ys, xs = np.where(alpha > 12)
    if len(ys) == 0:
        return tile
    y0 = max(ys.min() - padding, 0)
    y1 = min(ys.max() + padding + 1, arr.shape[0])
    x0 = max(xs.min() - padding, 0)
    x1 = min(xs.max() + padding + 1, arr.shape[1])
    return tile.crop((x0, y0, x1, y1))


def resize_max(tile, max_side):
    w, h = tile.size
    m = max(w, h)
    if m <= max_side:
        return tile
    scale = max_side / m
    return tile.resize((int(w*scale), int(h*scale)), Image.LANCZOS)


def main():
    if not os.path.exists(SRC):
        raise SystemExit(f'no source image at {SRC}')

    img = Image.open(SRC).convert('RGBA')
    w, h = img.size
    print(f'loaded {SRC} → {img.size}')

    cols = len(LAYOUT[0])  # 4
    rows = len(LAYOUT)     # 3
    cw = w / cols
    ch = h / rows

    for r_idx, row in enumerate(LAYOUT):
        for c_idx, (fname, subdir, pad, max_side) in enumerate(row):
            x0 = int(c_idx * cw)
            y0 = int(r_idx * ch)
            x1 = int((c_idx + 1) * cw)
            y1 = int((r_idx + 1) * ch)
            tile = img.crop((x0, y0, x1, y1))
            tile = remove_white_bg(tile)
            tile = crop_to_content(tile, padding=pad)
            tile = resize_max(tile, max_side)

            out_dir = os.path.join(ROOT, 'assets', subdir) if subdir else os.path.join(ROOT, 'assets')
            os.makedirs(out_dir, exist_ok=True)
            out_path = os.path.join(out_dir, fname)
            tile.save(out_path, 'PNG')
            print(f'  → {fname:14s} {tile.size!s:>14}  →  {out_path}')

    print('done!')


if __name__ == '__main__':
    main()
