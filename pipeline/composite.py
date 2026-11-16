"""Combine the photographic body (head painted out) with the rendered display head.
Usage: .venv\\Scripts\\python.exe composite.py
Writes final/nine_lisa_style.png, final/nine_lisa_style_face.png (sample face) and final/nine_lisa_style.json
"""
import json, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

base = os.path.dirname(os.path.abspath(__file__))
body = Image.open(os.path.join(base, "options", "body_7104_headless.png")).convert("RGBA")
mask = Image.open(os.path.join(base, "options", "body_7104_headless_mask.png")).convert("L")
head = Image.open(os.path.join(base, "head", "display_head.png")).convert("RGBA")
info = json.load(open(os.path.join(base, "head", "display_head.json")))
W, H = body.size

# 1. smooth the repainted backdrop (only above the shoulders, so the jacket edge stays crisp)
m = np.array(mask, dtype=np.float32) / 255.0
m[560:, :] = 0
soft = Image.fromarray((np.clip(m, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(20))
body = Image.composite(body.filter(ImageFilter.GaussianBlur(28)), body, soft)

# 2. where the neck is in the photo
NECK_L, NECK_R, NECK_TOP = 305, 480, 486
neck_cx, neck_w = (NECK_L + NECK_R) / 2, NECK_R - NECK_L

# 3. scale the head so its collar matches the neck, and sit the collar on the neck
s = neck_w / info["collar_width_px"] * 1.12
head_s = head.resize((round(head.width * s), round(head.height * s)), Image.LANCZOS)
cb_x, cb_y = info["collar_bottom"]
ox = round(neck_cx - cb_x * s)
oy = round(NECK_TOP + 22 - cb_y * s)

# 4. soft contact shadow on the neck under the collar, then the head
shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
ImageDraw.Draw(shadow).ellipse((neck_cx - neck_w * 0.55, NECK_TOP + 6, neck_cx + neck_w * 0.55, NECK_TOP + 46), fill=(0, 0, 0, 120))
body = Image.alpha_composite(body, shadow.filter(ImageFilter.GaussianBlur(10)))
canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
canvas.paste(head_s, (ox, oy), head_s)
final = Image.alpha_composite(body, canvas).convert("RGB")

out_dir = os.path.join(base, "final"); os.makedirs(out_dir, exist_ok=True)
final.save(os.path.join(out_dir, "nine_lisa_style.png"))
scr = {k: [round(v[0] * s + ox, 1), round(v[1] * s + oy, 1)] for k, v in info["screen"].items()}
json.dump({"image": "nine_lisa_style.png", "width": W, "height": H, "screen": scr}, open(os.path.join(out_dir, "nine_lisa_style.json"), "w"), indent=2)

# 5. a sample face on the screen, to show how the live face will sit
face = final.copy(); d = ImageDraw.Draw(face)
x0, y0 = scr["tl"]; x1, y1 = scr["br"]; sw, sh = x1 - x0, y1 - y0
eye = (205, 238, 255)
for ex in (0.36, 0.64):
    cx, cy = x0 + sw * ex, y0 + sh * 0.45
    d.rounded_rectangle((cx - sw * 0.045, cy - sh * 0.16, cx + sw * 0.045, cy + sh * 0.16), radius=int(sw * 0.04), fill=eye)
d.arc((x0 + sw * 0.40, y0 + sh * 0.50, x0 + sw * 0.60, y0 + sh * 0.78), 20, 160, fill=eye, width=max(3, int(sw * 0.018)))
glow = face.filter(ImageFilter.GaussianBlur(6))
face = Image.blend(face, glow, 0.25)
face.save(os.path.join(out_dir, "nine_lisa_style_face.png"))
print("saved", out_dir, "scale", round(s, 3), "screen", scr)
