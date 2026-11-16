"""Join the 360 turn from the cut-out frames:
  clip 1 (front -> her side -> back), clip 2 (back -> her other side, until it drifts),
  then clip 1's first quarter mirrored and reversed (her other side -> front).
The join points are where the silhouettes match best; clip 2's colours are matched to clip 1.
Usage: .venv\\Scripts\\python.exe join_turn.py <site_turn_dir>
"""
import os, sys, glob, shutil
import numpy as np
from PIL import Image, ImageOps

base = os.path.dirname(os.path.abspath(__file__))
out = sys.argv[1]
c1 = [Image.open(p).convert("RGBA") for p in sorted(glob.glob(os.path.join(base, "clips", "turn_web", "f*.webp")))]
c2 = [Image.open(p).convert("RGBA") for p in sorted(glob.glob(os.path.join(base, "clips", "turn2_web", "f*.webp")))]
alpha = lambda im: np.asarray(im.getchannel("A"), dtype=np.float32) / 255 > .5
def iou(a, b): return (a & b).sum() / max(1, (a | b).sum())

# colour-match clip 2 to clip 1's last frame (they start from the same picture), per channel on the figure
def stats(im):
    a = np.asarray(im, dtype=np.float32); m = a[..., 3] > 128
    return a[m][:, :3].mean(0), a[m][:, :3].std(0) + 1e-3
mu_ref, sd_ref = stats(c1[-1])
def match(im):
    a = np.asarray(im, dtype=np.float32).copy(); mu, sd = stats(im)
    a[..., :3] = np.clip((a[..., :3] - mu) / sd * sd_ref + mu_ref, 0, 255)
    return Image.fromarray(a.astype(np.uint8), "RGBA")

# best join: clip 2 frame j (side view, before it drifts) against clip 1 frame k mirrored
best = max(((iou(alpha(c2[j]), alpha(ImageOps.mirror(c1[k]))), j, k) for j in range(38, 47) for k in range(24, 42)))
score, J, K = best
print(f"join clip2 frame {J} to mirrored clip1 frame {K} (overlap {score:.2f})")
# clip 2's colours drift from clip 1's back view toward the mirrored side view it joins
mu_b, sd_b = stats(c1[-1]); mu_s, sd_s = stats(ImageOps.mirror(c1[K]))
def match_t(im, t):
    a = np.asarray(im, dtype=np.float32).copy(); mu, sd = stats(im)
    mr, sr = mu_b * (1 - t) + mu_s * t, sd_b * (1 - t) + sd_s * t
    a[..., :3] = np.clip((a[..., :3] - mu) / sd * sr + mr, 0, 255)
    return Image.fromarray(a.astype(np.uint8), "RGBA")
mid = [match_t(c2[j], j / J) for j in range(1, J + 1)]
tail = [ImageOps.mirror(c1[k]) for k in range(K - 1, 0, -1)]
# a short cross-fade across the join
X = 5
fade = [Image.blend(mid[-X + i], tail[i], (i + 1) / (X + 1)) for i in range(X)]
seq = c1 + mid[:-X] + fade + tail[X:]
if os.path.isdir(out): shutil.rmtree(out)
os.makedirs(out)
for i, im in enumerate(seq):
    im.save(os.path.join(out, f"f{i:03d}.webp"), quality=86, method=5)
print("frames", len(seq))
