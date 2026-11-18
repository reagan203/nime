"""Find Nine's display in every frame of a gesture clip, so the site can draw her live face on it.

The clip shows the display as a blank blue panel. For each frame we take the blue pixels near where
the display was in the still (frame 0), and read the four corners from the extremes of x+y and x-y.
The site gets, per frame, how far each corner moved from frame 0 (in fractions of the frame), and adds
that to the still's screen corners (nine.json), so the face sits exactly where the still's face sits.

Run: python track_screen.py <site>/assets/nine/anim/<clip> [<site>/assets/nine/photo/nine.json]
Writes "screen" into the clip's manifest.json (list of [dtlx,dtly,dtrx,dtry,dbrx,dbry,dblx,dbly]).
"""
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw

clip = sys.argv[1]
geom = json.load(open(sys.argv[2] if len(sys.argv) > 2 else os.path.join(clip, "..", "..", "photo", "nine.json")))
man_path = os.path.join(clip, "manifest.json"); man = json.load(open(man_path))
FW, FH = geom["frame"]; hd = geom["head"]; Q = hd["screen"]
KEYS = ["tl", "tr", "br", "bl"]

def largest_blob(m):
    # connected parts after a 2-pixel erosion (cuts thin bridges such as the cable), keep the biggest
    e = m.copy()
    for _ in range(2):
        e = e & np.roll(e, 1, 0) & np.roll(e, -1, 0) & np.roll(e, 1, 1) & np.roll(e, -1, 1)
    lab = np.zeros(m.shape, int); best, size, n = 0, 0, 0
    for y0, x0 in zip(*np.nonzero(e)):
        if lab[y0, x0]: continue
        n += 1; stack = [(y0, x0)]; lab[y0, x0] = n; cnt = 0
        while stack:
            y, x = stack.pop(); cnt += 1
            for yy, xx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= yy < m.shape[0] and 0 <= xx < m.shape[1] and e[yy, xx] and not lab[yy, xx]:
                    lab[yy, xx] = n; stack.append((yy, xx))
        if cnt > size: best, size = n, cnt
    keep = lab == best
    for _ in range(2):                                              # grow back to the panel's edge
        keep = keep | np.roll(keep, 1, 0) | np.roll(keep, -1, 0) | np.roll(keep, 1, 1) | np.roll(keep, -1, 1)
    return keep & m

def corners(path, box):
    im = np.array(Image.open(path).convert("RGBA")).astype(int)
    r, g, b, a = (im[..., i] for i in range(4))
    m = (a > 128) & (b - r > 25) & (b > g + 8) & (g > r + 15)       # the panel's teal-blue, not the navy jacket
    x0, y0, x1, y1 = box
    keep = np.zeros_like(m); keep[y0:y1, x0:x1] = True; m &= keep
    m = largest_blob(m)                                             # the panel, not the blue-lit cable beside it
    ys, xs = np.nonzero(m)
    if len(xs) < 200: return None
    s, d = xs + ys, xs - ys
    return np.array([[xs[s.argmin()], ys[s.argmin()]], [xs[d.argmax()], ys[d.argmax()]],
                     [xs[s.argmax()], ys[s.argmax()]], [xs[d.argmin()], ys[d.argmin()]]], float), im.shape[1], im.shape[0]

frames = sorted(f for f in os.listdir(clip) if f.endswith(".webp"))
W, H = Image.open(os.path.join(clip, frames[0])).size
still = np.array([[(hd["x"] + Q[k][0] * hd["w"]) / FW * W, (hd["y"] + Q[k][1] * hd["h"]) / FH * H] for k in KEYS])
pad = 45
box0 = [int(max(0, still[:, 0].min() - pad)), int(max(0, still[:, 1].min() - pad)), int(min(W, still[:, 0].max() + pad)), int(min(H, still[:, 1].max() + pad))]
c0 = corners(os.path.join(clip, frames[0]), box0)[0]
print("frame 0 detected", c0.round(1).tolist(), "still", still.round(1).tolist())
out, prev, check = [], c0, []
for i, f in enumerate(frames):
    # follow the display: search around where it was in the previous frame
    box = [int(max(0, prev[:, 0].min() - pad)), int(max(0, prev[:, 1].min() - pad)), int(min(W, prev[:, 0].max() + pad)), int(min(H, prev[:, 1].max() + pad))]
    got = corners(os.path.join(clip, f), box)
    c = got[0] if got else prev
    # a corner hidden by a hand jumps: keep the shape, move it with the others
    jump = np.linalg.norm(c - prev, axis=1)
    if i and jump.max() > 14 and np.median(jump) < 6:
        c = np.where((jump > 14)[:, None], prev + np.median(c - prev, axis=0), c)
    prev = c
    dlt = (c - c0) / [W, H]
    out.append([round(float(v), 4) for v in dlt.flatten()])
    if i % 20 == 0: check.append((f, c))
# detection jitters by about a pixel: smooth over 5 frames so the face doesn't shimmer
a = np.array(out); k = 2
sm = np.array([a[max(0, i - k):i + k + 1].mean(0) for i in range(len(a))]); sm[0] = 0
out = [[round(float(v), 4) for v in row] for row in sm]
man["screen"] = out
json.dump(man, open(man_path, "w"))
# a check sheet: the tracked display outline on every 20th frame
tiles = []
for f, c in check:
    im = Image.open(os.path.join(clip, f)).convert("RGB"); d = ImageDraw.Draw(im)
    d.polygon([tuple(p) for p in c], outline=(255, 40, 40), width=2); tiles.append(im)
sheet = Image.new("RGB", (W * len(tiles), H), "white")
for k, t in enumerate(tiles): sheet.paste(t, (k * W, 0))
sheet.save(os.path.join(os.environ.get("TMP", "."), f"screen_track_{os.path.basename(clip.rstrip('/'))}.png"))
print(f"{len(out)} frames tracked; max corner move {np.abs(np.array(out)).max():.3f} of the frame")
