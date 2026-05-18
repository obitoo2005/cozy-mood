"""
Slices header_icons_grid.png (5 cols x 1 row) into 5 transparent PNGs:
  assets/header/search.png
  assets/header/theme.png
  assets/header/dark.png
  assets/header/bell.png
  assets/header/menu.png
"""

from PIL import Image
import numpy as np
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'assets', 'header_icons_grid.png')
OUT = os.path.join(ROOT, 'assets', 'header')
NAMES = ['search', 'theme', 'dark', 'bell', 'menu']
MAX_SIDE = 256


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
        raise SystemExit(f'no source at {SRC}')

    os.makedirs(OUT, exist_ok=True)
    img = Image.open(SRC).convert('RGBA')
    w, h = img.size
    print(f'loaded {SRC} → {img.size}')

    cw = w / len(NAMES)
    for i, name in enumerate(NAMES):
        x0, x1 = int(i * cw), int((i + 1) * cw)
        tile = img.crop((x0, 0, x1, h))
        tile = remove_white_bg(tile)
        tile = crop_to_content(tile, padding=10)
        tile = resize_max(tile, MAX_SIDE)
        out_path = os.path.join(OUT, f'{name}.png')
        tile.save(out_path, 'PNG')
        print(f'  → {name:8s} {tile.size!s:>14}  →  {out_path}')

    print('done!')


if __name__ == '__main__':
    main()
