"""Nine moves: gestures and walking, by motion transfer from a driving video.

Model: One-to-All Animation 1.3B (ssj9596/One-to-All-Animation; code Apache-2.0; built on Wan2.1-1.3B).
  * It is "alignment-free": the reference (Nine) and the driving person do not need the same framing
    or body proportions, which matters because Nine is a waist-up still.
  * Its authors run the 1.3B model on a free Kaggle T4 (16 GB): about 11 minutes for 10 s at 832x480.
    Nobody publishes a 6 GB figure, so the default target here is Kaggle/Colab; --local tries the RTX 3050
    with the text encoder dropped after encoding and sequential offload, at 480x832 or smaller.
  * Check the licence on the model card of the CHECKPOINTS before the website goes live: the README
    licenses the code (Apache-2.0) and does not state the weights' licence.
  * Wan2.2-Animate-14B (Apache-2.0) is the stronger model, but its transformer alone is ~69 GB in bf16:
    it needs a 40-80 GB GPU. Not used here.

Pipeline (each stage writes to --work, so stages can be re-run on their own):
  1. prepare   driving video -> 16 fps, trimmed, resized, person centred           (ffmpeg via imageio)
               reference     -> Nine on green, padded to the model's aspect          (PIL)
  2. animate   One-to-All preprocess (pose extraction) + inference, run as a subprocess in its repo
  3. matte     BiRefNet per frame + motion-aware temporal smoothing + green despill (matting.py)
  4. head      track the neck (shoulder midpoint and tilt) in every output frame and save track.json, so the
               website can pin the crisp Blender head and the live face to the moving body if the model's
               own rendering of the head drifts (--head-lock)
  5. export    transparent WebP frames + manifest.json for the site (same format as the turntable)

One-to-All pins old libraries (torch 2.5.1, diffusers 0.33, transformers 4.40), so it runs in its own
environment (.venv-o2a, Python 3.10) through o2a_runner.py, which reuses their pose extraction and chunked
generation and swaps in a low-memory pipeline (prompt encoded once on the CPU, then the encoder is dropped).

Usage:
  python gen_animation.py --repo One-to-All-Animation --ref final/nine_green.png \
      --drive drives/wave.mp4 --work clips/anim_wave --matte <BiRefNet dir> --site-out <site>/assets/nine/wave
On Kaggle: clone the repo, pip install -r requirements.txt, upload final/nine_green.png and the driving
video as a dataset, run the same command with --matte pointing at BiRefNet_lite downloaded there.

Driving video: use footage you have the rights to (film a colleague, or a CC0 clip). Only the motion is
transferred; the person's face and clothes are not.
For walking, generate a full-length still first (gen_portrait.py with a full-body framing): from a
waist-up still the model has to invent legs and trousers, and they will not match from clip to clip.
"""
import argparse, json, os, re, shutil, subprocess, sys, tempfile

ap = argparse.ArgumentParser()
ap.add_argument("--repo", required=True, help="local clone of ssj9596/One-to-All-Animation")
ap.add_argument("--o2a-python", help="python of One-to-All's environment (default: .venv-o2a next to this script)")
ap.add_argument("--ckpt", help="One-to-All checkpoint folder (default: One-to-All-1.3b_2 from the HF cache)")
ap.add_argument("--offload", choices=["none", "group", "model", "sequential"], default="group", help="group fits a 6 GB GPU; none needs ~12 GB")
ap.add_argument("--steps", type=int, default=30)
ap.add_argument("--prompt", help="override the description passed to the model")
ap.add_argument("--ref", help="Nine still on green (final/nine_green.png)")
ap.add_argument("--drive", help="driving video (a person walking or gesturing)")
ap.add_argument("--work", default="clips/anim")
ap.add_argument("--seconds", type=float, default=5.0)
ap.add_argument("--fps", type=int, default=16)
ap.add_argument("--size", default="480x832", help="WxH; portrait")
ap.add_argument("--local", action="store_true", help="try the 6 GB GPU (smaller size, offload); default assumes a 16 GB GPU")
ap.add_argument("--matte", help="BiRefNet_lite folder")
ap.add_argument("--head-lock", action="store_true", help="also write track.json for pinning the Blender head on the site")
ap.add_argument("--site-out")
ap.add_argument("--stages", default="prepare,animate,matte,head,export")
a = ap.parse_args()
VSRC = os.path.join(a.repo, "video-generation")

W, H = (int(v) for v in a.size.split("x"))
if a.local: W, H = min(W, 384), min(H, 672)               # smaller frames for 6 GB
stages = set(a.stages.split(","))
os.makedirs(a.work, exist_ok=True)
P = lambda *p: os.path.join(a.work, *p)

# ------------------------------------------------------------------ 1. prepare
if "prepare" in stages:
    import imageio.v3 as iio
    import numpy as np
    from PIL import Image
    frames = []
    meta = iio.immeta(a.drive, plugin="pyav") if hasattr(iio, "immeta") else {}
    src_fps = float(meta.get("fps", 30))
    step = src_fps / a.fps
    for i, fr in enumerate(iio.imiter(a.drive, plugin="pyav")):
        if len(frames) >= a.seconds * a.fps: break
        if i >= len(frames) * step:
            im = Image.fromarray(fr).convert("RGB")
            s = max(W / im.width, H / im.height)                      # cover, then centre-crop to WxH
            im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
            l, t = (im.width - W) // 2, (im.height - H) // 2
            frames.append(np.asarray(im.crop((l, t, l + W, t + H))))
    # the model works in chunks of 4k+1 frames (81 at most): hold the last frame until the count fits
    while len(frames) < 81 and (len(frames) - 1) % 4: frames.append(frames[-1])
    if len(frames) < 81: frames += [frames[-1]] * (81 - len(frames))
    iio.imwrite(P("drive.mp4"), np.stack(frames), fps=a.fps, plugin="pyav", codec="libx264")
    ref = Image.open(a.ref).convert("RGB")
    s = min(W / ref.width, H / ref.height)
    canvas = Image.new("RGB", (W, H), (0, 177, 64))                   # pad with the same green
    r2 = ref.resize((round(ref.width * s), round(ref.height * s)), Image.LANCZOS)
    canvas.paste(r2, ((W - r2.width) // 2, H - r2.height))
    canvas.save(P("ref.png"))
    print(f"prepared {len(frames)} driving frames at {a.fps} fps, {W}x{H}", flush=True)

# ------------------------------------------------------------------ 2. animate (One-to-All in its own environment)
if "animate" in stages:
    here = os.path.dirname(os.path.abspath(__file__))
    py = a.o2a_python or os.path.join(here, ".venv-o2a", "Scripts" if os.name == "nt" else "bin", "python.exe" if os.name == "nt" else "python")
    ckpt = a.ckpt
    if not ckpt:
        from huggingface_hub import snapshot_download
        ckpt = snapshot_download("MochunniaN1/One-to-All-1.3b_2")   # their inference configs match _2, not _1
    base_cmd = [py, os.path.join(here, "o2a_runner.py"), "--ref", os.path.abspath(P("ref.png")), "--drive", os.path.abspath(P("drive.mp4")),
                "--ckpt", ckpt, "--out", os.path.abspath(P("raw")), "--max-short", str(min(W, H)), "--offload", a.offload, "--steps", str(a.steps)]
    if a.prompt: base_cmd += ["--prompt", a.prompt]
    env = dict(os.environ, PYTORCH_CUDA_ALLOC_CONF="expandable_segments:True", PYTHONIOENCODING="utf-8")   # their logs print Chinese text
    # three processes: the pose models hold GPU memory until their process exits, and the text encoder
    # must not share RAM with the 1.3B model (see o2a_runner.py)
    for stage in ("pre", "prompt", "gen"):
        print(f"One-to-All stage {stage}", flush=True)
        subprocess.run(base_cmd + ["--stage", stage], cwd=VSRC, env=env, check=True)

# ------------------------------------------------------------------ 3-5. matte, head track, export
def load_raw():
    import glob, imageio.v3 as iio
    from PIL import Image
    vids = sorted(glob.glob(P("raw", "**", "*.mp4"), recursive=True))
    if not vids: raise SystemExit(f"no output video in {P('raw')}")
    return [Image.fromarray(f).convert("RGB") for f in iio.imiter(vids[-1], plugin="pyav")]
if stages & {"matte", "head", "export"}:
    import numpy as np
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import matting
    frames = load_raw()
    alphas = matting.smooth_alphas(frames, matting.raw_alphas(frames, a.matte), loop=False) if a.matte else [np.ones(f.size[::-1], np.float32) for f in frames]
    track = None
    if a.head_lock:
        # neck from the matte: the narrowest row between the shoulders and the head gives the neck centre;
        # the shoulder line (left/right edge 25% further down) gives the tilt. No pose model needed.
        track = []
        for al in alphas:
            m = al > .5; rows = np.where(m.any(1))[0]
            if not len(rows): track.append(None); continue
            top, bot = rows[0], rows[-1]
            widths = [(m[y].sum(), y) for y in range(top + (bot - top) // 6, top + (bot - top) // 2)]
            w, ny = min(widths); xs = np.where(m[ny])[0]
            cx = xs.mean()
            below = m.copy(); below[: ny + 5] = False                  # ignore the head: shoulders are below the neck
            topy = np.where(below.any(0), below.argmax(0), -1)
            def shoulder(x0, x1):
                c = [x for x in range(max(0, int(x0)), min(al.shape[1], int(x1))) if topy[x] >= 0]
                return (np.mean(c), float(np.median(topy[c]))) if c else None
            sl, sr = shoulder(cx - 2.2 * w, cx - 1.2 * w), shoulder(cx + 1.2 * w, cx + 2.2 * w)
            tilt = float(np.degrees(np.arctan2(sr[1] - sl[1], sr[0] - sl[0]))) if sl and sr else 0.0
            track.append({"x": float(xs.mean() / al.shape[1]), "y": float(ny / al.shape[0]), "w": float(w / al.shape[1]), "tilt": tilt})
        json.dump(track, open(P("track.json"), "w"))
    if a.site_out and "export" in stages:
        m = matting.export_web(frames, alphas, a.site_out, a.fps, extra={"kind": "animation", "loop": False, "track": "track.json" if track else None})
        if track: shutil.copy(P("track.json"), os.path.join(a.site_out, "track.json"))
        print("web frames:", m, flush=True)
print("done", flush=True)
