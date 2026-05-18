"""
Generates all PWA + Android + iOS icons from assets/mascot.png.
Outputs into assets/icons/.

Sizes:
  android (PWA):   192, 512 + 192-maskable, 512-maskable
  ios:             180 (apple-touch-icon)
  favicons:        32, 16
"""

from PIL import Image, ImageDraw
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'assets', 'mascot.png')
OUT = os.path.join(ROOT, 'assets', 'icons')
BG_COLOR = (255, 214, 224)  # var(--primary-soft) pink

REGULAR = [192, 512, 180, 32, 16]
MASKABLE = [192, 512]


def make_circle_bg(size):
    """Solid pastel-pink rounded square background for plain icons."""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    radius = int(size * 0.22)
    draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=BG_COLOR + (255,))
    return img


def make_full_bg(size):
    """Solid pastel-pink full square (for maskable icons that get cropped to circle)."""
    return Image.new('RGBA', (size, size), BG_COLOR + (255,))


def fit_mascot(mascot, target_size, scale=0.78):
    """Resize mascot to fit centered inside target_size with given scale."""
    inner = int(target_size * scale)
    m = mascot.copy()
    m.thumbnail((inner, inner), Image.LANCZOS)
    return m


def compose(bg, mascot):
    canvas = bg.copy()
    mw, mh = mascot.size
    cw, ch = canvas.size
    canvas.paste(mascot, ((cw - mw) // 2, (ch - mh) // 2), mascot)
    return canvas


def main():
    if not os.path.exists(SRC):
        raise SystemExit(f'no mascot at {SRC}')

    os.makedirs(OUT, exist_ok=True)
    mascot = Image.open(SRC).convert('RGBA')
    print(f'loaded {SRC}  →  {mascot.size}')

    # Regular icons (rounded background)
    for sz in REGULAR:
        bg = make_circle_bg(sz)
        m = fit_mascot(mascot, sz, scale=0.78)
        out = compose(bg, m)
        path = os.path.join(OUT, f'icon-{sz}.png')
        out.save(path, 'PNG')
        print(f'  regular   {sz:>4}px  →  {path}')

    # Maskable icons (full background, smaller mascot to survive Android safe-zone crop)
    for sz in MASKABLE:
        bg = make_full_bg(sz)
        m = fit_mascot(mascot, sz, scale=0.62)  # safe-zone is ~80% of canvas
        out = compose(bg, m)
        path = os.path.join(OUT, f'icon-{sz}-maskable.png')
        out.save(path, 'PNG')
        print(f'  maskable  {sz:>4}px  →  {path}')

    # favicon.ico (multi-resolution)
    fav32 = Image.open(os.path.join(OUT, 'icon-32.png'))
    fav16 = Image.open(os.path.join(OUT, 'icon-16.png'))
    fav_path = os.path.join(ROOT, 'favicon.ico')
    fav32.save(fav_path, format='ICO', sizes=[(32, 32), (16, 16)])
    print(f'  favicon       →  {fav_path}')

    print('done!')


if __name__ == '__main__':
    main()
