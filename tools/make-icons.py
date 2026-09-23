"""Génère les images sources pour @capacitor/assets (npx @capacitor/assets generate --android).
Identité : coche ivoire sur fond bleu encre #2B4C7E. Régénérable : python tools/make-icons.py"""
from PIL import Image, ImageDraw
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "assets"
BLUE, IVORY, BG, NIGHT = (43, 76, 126), (247, 246, 242), (247, 246, 242), (21, 21, 20)
S = 4  # suréchantillonnage puis réduction pour des bords lisses

def check(draw, size, cx, cy, scale, color):
    w = int(size * 0.075 * scale)
    pts = [(cx - 0.20 * size * scale, cy + 0.00 * size * scale),
           (cx - 0.05 * size * scale, cy + 0.15 * size * scale),
           (cx + 0.22 * size * scale, cy - 0.14 * size * scale)]
    draw.line(pts, fill=color, width=w, joint="curve")
    r = w // 2
    for x, y in (pts[0], pts[-1]):
        draw.ellipse((x - r, y - r, x + r, y + r), fill=color)

def canvas(size, color):
    return Image.new("RGBA", (size * S, size * S), color)

def done(img, size, name):
    img.resize((size, size), Image.LANCZOS).save(OUT / name)

# Icône complète (anciens lanceurs, fiche Play Store)
img = canvas(1024, BLUE); check(ImageDraw.Draw(img), 1024 * S, 512 * S, 530 * S, 1.0, IVORY); done(img, 1024, "icon-only.png")
# Icône adaptative : fond uni + premier plan (zone sûre = 66 % central)
done(canvas(1024, BLUE), 1024, "icon-background.png")
img = canvas(1024, (0, 0, 0, 0)); check(ImageDraw.Draw(img), 1024 * S, 512 * S, 530 * S, 0.62, IVORY); done(img, 1024, "icon-foreground.png")
# Écrans de démarrage : pastille centrée
for name, bg in (("splash.png", BG), ("splash-dark.png", NIGHT)):
    size = 2732
    img = canvas(size, bg); d = ImageDraw.Draw(img)
    r = 260 * S; c = size * S // 2
    d.rounded_rectangle((c - r, c - r, c + r, c + r), radius=120 * S, fill=BLUE)
    check(d, 2 * r, c, c + 20 * S, 1.0, IVORY)
    img.resize((size, size), Image.LANCZOS).save(OUT / name)
print("assets/ régénéré")
