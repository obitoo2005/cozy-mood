"""
Slices the 4x3 mood-sticker grid into 12 individual transparent PNGs.

- Loads grid.png from assets/moods/grid.png
- Auto-detects rows/columns by finding the whitespace bands between stickers
- Falls back to even 4x3 split if detection fails
- Removes the white background per-tile (alpha threshold) so each sticker is transparent
- Saves to assets/moods/{name}.png with the canonical mood names
"""

from PIL import Image
import os
import numpy as np

NAMES = [
    # row 1 (top, left→right)
    'happy', 'excited', 'calm', 'sleepy',
    # row 2
    'tired', 'sad', 'angry', 'sick',
    # row 3
    'love', 'meh', 'anxious', 'great',
]

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'assets', 'moods', 'grid.png')
OUT_DIR = os.path.join(ROOT, 'assets', 'moods')
DEBUG_DIR = os.path.join(ROOT, 'assets', 'moods', '_debug')


def detect_bands(mask_axis, min_gap=8):
    """
    Given a 1D boolean array (True = content row/col present, False = empty),
    return list of (start, end) tuples for each contiguous content band.
    """
    bands = []
    in_band = False
    start = 0
    for i, v in enumerate(mask_axis):
        if v and not in_band:
            in_band = True
            start = i
        elif not v and in_band:
            in_band = False
            if i - start >= min_gap:
                bands.append((start, i))
    if in_band:
        bands.append((start, len(mask_axis)))
    return bands


def split_grid(img):
    arr = np.array(img.convert('RGBA'))
    h, w = arr.shape[:2]
    rgb = arr[..., :3]
    # "content" = pixel that isn't pure-ish white
    not_white = np.any(rgb < 240, axis=2)

    # rows: True if any content in that row
    row_has = not_white.any(axis=1)
    col_has = not_white.any(axis=0)

    rows = detect_bands(row_has, min_gap=20)
    cols = detect_bands(col_has, min_gap=20)

    print(f'detected {len(rows)} rows × {len(cols)} cols')

    # If detection didn't find 3 rows × 4 cols, fall back to even split
    if len(rows) != 3 or len(cols) != 4:
        print('  → falling back to even 3×4 split')
        rows = [(int(i*h/3), int((i+1)*h/3)) for i in range(3)]
        cols = [(int(i*w/4), int((i+1)*w/4)) for i in range(4)]

    return rows, cols


def remove_white_bg(tile, threshold=240, soft=18):
    """
    Make near-white pixels transparent. Soft-edges by ramping alpha.
    """
    arr = np.array(tile.convert('RGBA'))
    rgb = arr[..., :3].astype(np.int32)
    # distance from white
    d = 255 - rgb.min(axis=2)  # how far from pure white the brightest channel is
    # alpha: 0 if pure white, 255 if d>=soft+threshold-distance
    alpha = np.clip((d / soft) * 255, 0, 255).astype(np.uint8)
    # if all channels are >=threshold AND alpha small, force fully transparent
    near_white = (rgb >= threshold).all(axis=2)
    alpha[near_white] = np.minimum(alpha[near_white], 0)
    arr[..., 3] = alpha
    return Image.fromarray(arr, 'RGBA')


def crop_to_content(tile, padding=12):
    """Tighten the bounding box around the visible (non-transparent) area."""
    arr = np.array(tile)
    if arr.shape[2] < 4:
        return tile
    alpha = arr[..., 3]
    if alpha.max() == 0:
        return tile
    ys, xs = np.where(alpha > 12)
    if len(ys) == 0:
        return tile
    y0, y1 = max(ys.min() - padding, 0), min(ys.max() + padding + 1, arr.shape[0])
    x0, x1 = max(xs.min() - padding, 0), min(xs.max() + padding + 1, arr.shape[1])
    return tile.crop((x0, y0, x1, y1))


def main():
    if not os.path.exists(SRC):
        raise SystemExit(f'no source image at {SRC}')

    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(DEBUG_DIR, exist_ok=True)

    img = Image.open(SRC).convert('RGBA')
    print(f'loaded {SRC} → {img.size}')

    rows, cols = split_grid(img)

    idx = 0
    for r_idx, (y0, y1) in enumerate(rows):
        for c_idx, (x0, x1) in enumerate(cols):
            if idx >= len(NAMES):
                break
            name = NAMES[idx]
            tile = img.crop((x0, y0, x1, y1))
            tile = remove_white_bg(tile)
            tile = crop_to_content(tile, padding=10)
            # final size — keep aspect, max 512 on longest side
            max_side = max(tile.size)
            if max_side > 512:
                scale = 512 / max_side
                tile = tile.resize((int(tile.size[0]*scale), int(tile.size[1]*scale)), Image.LANCZOS)
            out_path = os.path.join(OUT_DIR, f'{name}.png')
            tile.save(out_path, 'PNG')
            print(f'  [{idx+1:2d}/12] {name:8s} → {tile.size} → {out_path}')
            idx += 1

    print('done!')


if __name__ == '__main__':
    main()
