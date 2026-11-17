"""Shared matting for Nine's video frames: BiRefNet-lite (MIT) per frame, then temporal smoothing,
green-screen clean-up and transparent WebP export. Used by gen_360_turntable.py and gen_animation.py.

Temporal smoothing: a per-frame matte flickers at the edges (hair-thin changes from frame to frame).
Each frame's alpha is blended with the median of its neighbours, but only where the picture itself
barely moved, so real motion (an arm swinging, the body turning) keeps a sharp, current edge.
"""
import os, json
import numpy as np
import torch
from PIL import Image
from torchvision import transforms

_model = None
def _load(model_dir, device="cuda"):
    global _model
    if _model is None:
        from transformers import AutoModelForImageSegmentation
        _model = AutoModelForImageSegmentation.from_pretrained(model_dir, trust_remote_code=True).to(device).eval()
        if device == "cuda": _model = _model.half()
    return _model

_tf = transforms.Compose([transforms.Resize((1024, 1024)), transforms.ToTensor(),
                          transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])])

def raw_alphas(frames, model_dir, device="cuda"):
    """frames: list of PIL RGB images -> list of float32 alpha arrays (H, W) in 0..1"""
    m = _load(model_dir, device); out = []
    dtype = torch.float16 if device == "cuda" else torch.float32
    for im in frames:
        with torch.no_grad():
            p = m(_tf(im).unsqueeze(0).to(device, dtype))[-1].sigmoid().float().cpu()[0, 0].numpy()
        out.append(np.asarray(Image.fromarray((p * 255).astype(np.uint8)).resize(im.size, Image.LANCZOS), dtype=np.float32) / 255)
    return out

def smooth_alphas(frames, alphas, loop=False, sigma=6.0, passes=2):
    """motion-aware temporal median: steady pixels take the 3-frame median, moving pixels keep their own alpha"""
    rgb = [np.asarray(f, dtype=np.float32) for f in frames]
    a = [x.copy() for x in alphas]; n = len(a)
    for _ in range(passes):
        nxt = []
        for t in range(n):
            if not loop and (t == 0 or t == n - 1):
                nxt.append(a[t]); continue
            p, q = (t - 1) % n, (t + 1) % n
            med = np.median(np.stack([a[p], a[t], a[q]]), axis=0)
            motion = (np.abs(rgb[t] - rgb[p]).mean(2) + np.abs(rgb[t] - rgb[q]).mean(2)) / 2      # 0..255
            w = np.exp(-motion / sigma)                                                         # 1 = still
            nxt.append(w * med + (1 - w) * a[t])
        a = nxt
    return a

def despill(im, alpha, green_cut=40):
    """remove plainly-green pixels from the matte and pull green spill off the edges"""
    rgb = np.asarray(im, dtype=np.float32).copy()
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    green = np.clip((g - np.maximum(r, b) - green_cut) / 40, 0, 1)
    alpha = alpha * (1 - green)
    rgb[..., 1] = np.minimum(g, np.maximum(r, b) + 6)
    return Image.fromarray(np.dstack([rgb, alpha * 255]).clip(0, 255).astype(np.uint8), "RGBA")

def export_web(frames, alphas, out_dir, fps, extra=None, quality=86, js_var=None):
    os.makedirs(out_dir, exist_ok=True)
    for f in os.listdir(out_dir):
        if f.endswith(".webp"): os.remove(os.path.join(out_dir, f))
    for i, (im, a) in enumerate(zip(frames, alphas)):
        despill(im, a).save(os.path.join(out_dir, f"f{i:03d}.webp"), quality=quality, method=5)
    manifest = {"frames": len(frames), "fps": fps, "src": "f{i}.webp", **(extra or {})}
    json.dump(manifest, open(os.path.join(out_dir, "manifest.json"), "w"), indent=2)
    if js_var:   # the same, as a script the page can load from disk (file:// has no fetch)
        open(os.path.join(out_dir, "manifest.js"), "w").write(f"window.{js_var} = " + json.dumps(manifest) + ";" + chr(10))
    return manifest
