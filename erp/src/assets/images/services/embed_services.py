"""
@file embed_services.py
@project RPSW Web
@description Replaces the green-screen areas in the "services" SVG illustrations with real
             screenshots, embedded as base64 WebP (SVG loaded via <img> must not reference
             external files). Each screenshot is scaled to 2x the size of its screen area
             (sharp on retina) and cropped from the top by the SVG itself
             (preserveAspectRatio="xMidYMin slice" + the existing clipPath).
             Missing screenshots are skipped - that screen simply stays green.
@usage       pip install pillow
             Put this script next to the SVGs and screenshots, then: python3 embed_services.py
             Output: services-*-final.svg (originals are left untouched).
"""
import base64
import io
import re
from pathlib import Path

from PIL import Image

HERE = Path(__file__).parent

# SVG file -> { clipPath id of the green screen : screenshot file }
MAPPING = {
    "services-main.svg": {
        "gsMon": "localhost_4200_admin_web_welcome-page_desktop.png",  # monitor  (672 x 394)
        "gsLap": "localhost_4200_admin_web_welcome-page_tablet.png",   # notebook (446 x 268)
        "gsPh":  "localhost_4200_admin_web_welcome-page_mobile.png",   # telefon  (168 x 358)
    },
    "services-card1.svg": {
        "gsC1": "localhost_4200_admin_core_edit-roles.png",            # role     (424 x 286)
    },
    "services-card4.svg": {
        "gsC4": "localhost_4200_admin_core_edit-website.png",          # editor   (424 x 256)
    },
}

SCALE = 2          # embedded image = 2x the screen area (retina)
WEBP_QUALITY = 82

# Matches exactly what the generator writes for every green screen:
# <clipPath id="ID"><rect x y width height rx/></clipPath><rect ... fill="#00ff00"/>
GREEN_RE = re.compile(
    r'(<clipPath id="(?P<id>[^"]+)"><rect x="(?P<x>[\d.]+)" y="(?P<y>[\d.]+)" '
    r'width="(?P<w>[\d.]+)" height="(?P<h>[\d.]+)"[^>]*/></clipPath>)'
    r'<rect [^>]*fill="#00ff00"/>'
)


def to_data_uri(path: Path, target_w: int, target_h: int) -> str:
    """Scale the screenshot so it COVERS target_w x target_h (keeps aspect), then WebP-encode."""
    img = Image.open(path).convert("RGB")
    scale = max(target_w / img.width, target_h / img.height)
    if scale < 1:  # only downscale; never upscale a small screenshot (would get blurry)
        img = img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, "WEBP", quality=WEBP_QUALITY, method=6)
    return "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode()


def embed(svg_name: str, screens: dict[str, str]) -> None:
    svg_path = HERE / svg_name
    if not svg_path.exists():
        print(f"! {svg_name} not found - skipped")
        return
    svg = svg_path.read_text(encoding="utf-8")

    def repl(m: re.Match) -> str:
        cid = m.group("id")
        shot = screens.get(cid)
        if not shot or not (HERE / shot).exists():
            print(f"  - {cid}: screenshot '{shot}' not found, left green")
            return m.group(0)
        x, y, w, h = (float(m.group(k)) for k in ("x", "y", "w", "h"))
        uri = to_data_uri(HERE / shot, round(w * SCALE), round(h * SCALE))
        print(f"  + {cid}: {shot}")
        return (f'{m.group(1)}<image href="{uri}" x="{m.group("x")}" y="{m.group("y")}" '
                f'width="{m.group("w")}" height="{m.group("h")}" preserveAspectRatio="xMidYMin slice" '
                f'clip-path="url(#{cid})"/>')

    print(svg_name)
    out = GREEN_RE.sub(repl, svg)
    out_path = svg_path.with_name(svg_path.stem + "-final.svg")
    out_path.write_text(out, encoding="utf-8")
    print(f"  -> {out_path.name} ({out_path.stat().st_size / 1024:.0f} kB)")


if __name__ == "__main__":
    for name, screens in MAPPING.items():
        embed(name, screens)