"""Export Nine for the website as two layers, so the head can move on its own.
Usage: .venv\\Scripts\\python.exe export_web.py <site_dir>
Writes <site_dir>/assets/nine/photo/{body.webp, head.webp, nine.json}
"""
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

base = os.path.dirname(os.path.abspath(__file__))
out = os.path.join(sys.argv[1], "assets", "nine", "photo")
os.makedirs(out, exist_ok=True)

body = Image.open(os.environ.get("NINE_BODY") or os.path.join(base, "matte", "body_7104_headless.png")).convert("RGBA")   # cut out by BiRefNet
HEAD_DIR = os.environ.get("NINE_HEAD_DIR") or os.path.join(base, "head")
head = Image.open(os.path.join(HEAD_DIR, "display_head.png")).convert("RGBA")
info = json.load(open(os.path.join(HEAD_DIR, "display_head.json")))
W, H0 = body.size

NECK_L, NECK_R, NECK_TOP = 305, 480, 486
neck_cx, neck_w = (NECK_L + NECK_R) / 2, NECK_R - NECK_L
s = neck_w / info["collar_width_px"] * 1.12
hs = head.resize((round(head.width * s), round(head.height * s)), Image.LANCZOS)
l, t, r, b = hs.getchannel("A").getbbox()
hs = hs.crop((l, t, r, b))
cb_x, cb_y = info["collar_bottom"]
hx, hy = round(neck_cx - cb_x * s) + l, round(NECK_TOP + 22 - cb_y * s) + t
PAD = max(0, 24 - hy)                       # room above for the taller mechanical neck
H = H0 + PAD; hy += PAD

# body on a taller transparent canvas, with a soft contact shadow on the neck under the ring (only on her)
canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0)); canvas.paste(body, (0, PAD))
shadow = Image.new("L", (W, H), 0)
ImageDraw.Draw(shadow).ellipse((neck_cx - neck_w * 0.55, PAD + NECK_TOP + 6, neck_cx + neck_w * 0.55, PAD + NECK_TOP + 46), fill=130)
shadow = Image.fromarray((np.array(shadow.filter(ImageFilter.GaussianBlur(10)), dtype=np.float32) * (np.array(canvas.getchannel("A"), dtype=np.float32) / 255)).astype(np.uint8))
dark = Image.new("RGBA", (W, H), (0, 0, 0, 255)); dark.putalpha(shadow)
body = Image.alpha_composite(canvas, dark)
body.putalpha(canvas.getchannel("A"))
body.save(os.path.join(out, "body.webp"), quality=88, method=6)
hs.save(os.path.join(out, "head.webp"), quality=90, method=6)

# collar layer: the clothes (not skin) in a band below the neck, laid back OVER the head layer,
# so the hydraulic hoses disappear under the shirt collar and lapels
rgb = np.asarray(canvas.convert("RGB"), dtype=np.float32) / 255
mx_, mn_ = rgb.max(2), rgb.min(2); sat = np.where(mx_ > 0, (mx_ - mn_) / np.maximum(mx_, 1e-6), 0)
skin = (rgb[..., 0] > rgb[..., 1]) & (rgb[..., 1] > rgb[..., 2]) & (sat > 0.18) & (sat < 0.75) & (mx_ > 0.25)
skin = np.array(Image.fromarray((skin * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(2)), dtype=np.float32) / 255
band = np.zeros((H, W), np.float32); y0, y1 = PAD + NECK_TOP + 24, PAD + NECK_TOP + 260
band[y0:y1] = 1; band = np.array(Image.fromarray((band * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(8)), dtype=np.float32) / 255
ca = (np.asarray(canvas.getchannel("A"), dtype=np.float32) / 255) * band * (1 - skin)
collar_layer = canvas.copy(); collar_layer.putalpha(Image.fromarray((ca * 255).astype(np.uint8)))
collar_layer = collar_layer.crop(collar_layer.getchannel("A").getbbox() or (0, 0, 1, 1))
cl_x, cl_y = Image.fromarray((ca * 255).astype(np.uint8)).getbbox()[:2]
collar_layer.save(os.path.join(out, "collar.webp"), quality=88, method=6)

# full stills: transparent, and on chroma green for the video model
full = body.copy(); full.alpha_composite(hs, (hx, hy)); full.alpha_composite(collar_layer, (cl_x, cl_y))
os.makedirs(os.path.join(base, "final"), exist_ok=True)
full.save(os.path.join(base, "final", "nine_full.png"))
green = Image.new("RGBA", full.size, (0, 177, 64, 255)); green.alpha_composite(full)
green.convert("RGB").save(os.path.join(base, "final", "nine_green.png"))
def rel(p):  # head-image coordinates as fractions of the head image
    return [round((p[0] * s - l) / hs.width, 4), round((p[1] * s - t) / hs.height, 4)]

data = {
    "frame": [W, H],
    "collar": {"x": cl_x, "y": cl_y, "w": collar_layer.width, "h": collar_layer.height},
    "head": {"x": hx, "y": hy, "w": hs.width, "h": hs.height,
             "pivot": rel(info["collar_bottom"]),
             "screen": {k: rel(v) for k, v in info["screen"].items()},
             "screen_grid": {"cols": info["screen_grid"]["cols"], "rows": info["screen_grid"]["rows"],
                             "points": [[rel(p) for p in row] for row in info["screen_grid"]["points"]]} if "screen_grid" in info else None},
}
json.dump(data, open(os.path.join(out, "nine.json"), "w"), indent=2)
# the same data as a script, so the page can read it even when opened from disk (file://, no fetch)
open(os.path.join(out, "nine.js"), "w").write("window.NINE_GEOM = " + json.dumps(data) + ";" + chr(10))
print(json.dumps(data))
for f in ("body.webp", "head.webp"):
    print(f, os.path.getsize(os.path.join(out, f)) // 1024, "KB")
