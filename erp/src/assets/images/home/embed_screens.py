"""
@file embed_screens.py
@description Vloží screenshoty do hero mockup SVG jako base64 data URI
             (SVG v <img> nesmí načítat externí soubory). Obrázky nejdřív
             zmenší a převede na WebP kvůli velikosti.
Použití:  pip install pillow   &&   python3 embed_screens.py
"""
import base64, io, re
from pathlib import Path
from PIL import Image

HERE = Path(__file__).parent
SVGS = ["hero-mockup-cs.svg", "hero-mockup-en.svg"]
# soubor -> max šířka v px (2× velikost obrazovky v SVG kvůli retina displejům)
SCREENS = {"dashboard_sc_desktop.png": 1160, "dashboard_sc_mobil.png": 344}

def to_data_uri(name: str, max_w: int) -> str:
    img = Image.open(HERE / name).convert("RGB")
    if img.width > max_w:
        img = img.resize((max_w, round(img.height * max_w / img.width)), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, "WEBP", quality=80, method=6)
    return "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode()

uris = {n: to_data_uri(n, w) for n, w in SCREENS.items()}
for svg_name in SVGS:
    p = HERE / svg_name
    if not p.exists():
        continue
    svg = p.read_text(encoding="utf-8")
    for n, uri in uris.items():
        svg = re.sub(r'href="[^"]*' + re.escape(n) + '"', f'href="{uri}"', svg)
    out = p.with_name(p.stem + "-embedded.svg")
    out.write_text(svg, encoding="utf-8")
    print(f"{out.name}: {out.stat().st_size / 1024:.0f} kB")