"""Turn a rendered clip (green screen) into transparent web frames: BiRefNet matte + green despill.
Usage: .venv\\Scripts\\python.exe turn_frames.py <birefnet_dir> <clip_dir> <site_out_dir>
Writes <site_out_dir>/f000.webp ... and a contact sheet next to the clip.
"""
import os, sys, glob, torch
import numpy as np
from PIL import Image
from torchvision import transforms
from transformers import AutoModelForImageSegmentation

model_dir, clip_dir, out_dir = sys.argv[1:4]
os.makedirs(out_dir, exist_ok=True)
model = AutoModelForImageSegmentation.from_pretrained(model_dir, trust_remote_code=True).to("cuda").eval().half()
tf = transforms.Compose([transforms.Resize((1024, 1024)), transforms.ToTensor(),
                         transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])])
frames = sorted(glob.glob(os.path.join(clip_dir, "frame_*.png")))
thumbs = []
for i, p in enumerate(frames):
    img = Image.open(p).convert("RGB")
    with torch.no_grad():
        m = model(tf(img).unsqueeze(0).to("cuda").half())[-1].sigmoid().float().cpu()[0, 0].numpy()
    a = np.array(Image.fromarray((m * 255).astype(np.uint8)).resize(img.size, Image.LANCZOS), dtype=np.float32) / 255
    rgb = np.asarray(img, dtype=np.float32)
    # also drop anything that is plainly the green screen, and pull green spill off the edges
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    green = np.clip((g - np.maximum(r, b) - 40) / 40, 0, 1)
    a = a * (1 - green)
    rgb[..., 1] = np.minimum(g, np.maximum(r, b) + 6)
    out = np.dstack([rgb, a * 255]).clip(0, 255).astype(np.uint8)
    im = Image.fromarray(out, "RGBA")
    im.save(os.path.join(out_dir, f"f{i:03d}.webp"), quality=86, method=5)
    if i % 10 == 0: thumbs.append(im)
sheet = Image.new("RGBA", (128 * len(thumbs), 176), (17, 19, 23, 255))
for k, t in enumerate(thumbs): sheet.alpha_composite(t.resize((128, 176)), (128 * k, 0))
sheet.convert("RGB").save(os.path.join(os.path.dirname(clip_dir.rstrip("/\\")), os.path.basename(clip_dir.rstrip("/\\")) + "_sheet.png"))
print("frames", len(frames), flush=True)
