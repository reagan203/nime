"""Nine's 360-degree turntable from ONE still, with the Wan 2.2 "360 Rotation" LoRA. Replaces the
two-clip + mirror-and-reverse join (join_turn.py), which drifted into a flat-panel head.

Model facts that shape this script (checked 2026-11-17):
  * The LoRA is artificialguybr/360Rotation-Redmond-WAN2-I2V-14B (CC0-1.0), trigger "360 Rotation",
    strength 0.8-1.0. It is made for Wan2.2-I2V-A14B: two 14B experts (high noise, low noise), so it
    ships two files, one per expert. It does NOT fit the TI2V-5B model used by wan_clip.py.
  * A14B in bf16 is ~2 x 28 GB of weights: it cannot run on the local RTX 3050 (6 GB) + 32 GB RAM.
    Two ways to run it:
      - Kaggle (T4 16 GB, ~29 GB RAM) or any 16-24 GB GPU, with GGUF Q4_K_M experts (~9-10 GB each):
        --gguf-high/--gguf-low, --offload model.  This is the recommended route.
      - Locally with the same GGUF files and --offload group (sequential offload breaks on GGUF weights).
  * Loop closure: diffusers' WanImageToVideoPipeline accepts `last_image`. With --close-loop the still
    is given as both the first and the last frame, so the model must come back to where it started:
    one seamless 360 with no join. Without it, the script finds the frame that best matches frame 0
    and cross-fades into it.
  * Anti-drift: the prompt names the back of the head (vents, rear housing) and says the display keeps
    its thick, curved shape; the negative prompt bans flat panels and tablets.

Usage (Kaggle or local):
  python gen_360_turntable.py --still final/nine_green.png --lora-dir <dir with the two LoRA files> \
      --gguf-high <...HighNoise-Q4_K_M.gguf> --gguf-low <...LowNoise-Q4_K_M.gguf> \
      --matte <BiRefNet_lite dir> --out clips/turntable --site-out <website>/assets/nine/turn --close-loop
  python gen_360_turntable.py ... --dry-run      # check inputs and print the plan, load nothing
"""
import argparse, gc, os, sys, time
os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")

ap = argparse.ArgumentParser()
ap.add_argument("--still", required=True, help="Nine composited on a flat green screen (export_web.py -> final/nine_green.png)")
ap.add_argument("--base", default="Wan-AI/Wan2.2-I2V-A14B-Diffusers", help="diffusers repo or local folder (VAE, text encoder, configs)")
ap.add_argument("--gguf-high", help="GGUF file of the high-noise expert (transformer)")
ap.add_argument("--gguf-low", help="GGUF file of the low-noise expert (transformer_2)")
ap.add_argument("--text-encoder", help="folder holding text_encoder/ (umT5-XXL); defaults to --base. The TI2V-5B download has the same encoder")
ap.add_argument("--motion", choices=["turn", "wave", "talk"], default="turn",
                help="turn: the 360 with the LoRA; wave/talk: a gesture from the prompt alone, starting and ending on the still")
ap.add_argument("--lora-dir")
ap.add_argument("--lora-high", default="[WAN2.2]360Rotation_Redmond_high_noise.safetensors")
ap.add_argument("--lora-low", default="[WAN2.2]360Rotation_Redmond_low_noise.safetensors")
ap.add_argument("--lora-scale", type=float, default=0.9)
ap.add_argument("--offload", choices=["group", "sequential", "model", "none"], default="model",
                help="group: layer by layer (works with GGUF, fits 6 GB); sequential does not work with GGUF")
ap.add_argument("--width", type=int, default=512); ap.add_argument("--height", type=int, default=704)
ap.add_argument("--frames", type=int, default=81, help="4k+1; 81 = 5 s at 16 fps")
ap.add_argument("--fps", type=int, default=16)
ap.add_argument("--steps", type=int, default=30)
ap.add_argument("--guidance", type=float, default=3.5)
ap.add_argument("--seed", type=int, default=360)
ap.add_argument("--close-loop", action="store_true", help="give the still as the last frame too (seamless loop)")
ap.add_argument("--matte", help="BiRefNet_lite folder; omit to skip matting")
ap.add_argument("--out", default="clips/turntable")
ap.add_argument("--site-out", help="write transparent web frames + manifest.json here")
ap.add_argument("--dry-run", action="store_true")
a = ap.parse_args()

NINE = ("A woman in a tailored navy wool suit jacket and a white shirt, whose head is a thick, gently curved graphite display "
        "on a heavy mechanical neck with pistons and a bolted steel ring, ")
PROMPTS = {
    "turn": "360 Rotation. " + NINE + "stands on the spot in front of a flat green screen and turns a full circle: her side, then her back "
            "with the back seam of the jacket and the back of the display with its rear housing and vents, then her other side, until she "
            "faces the camera again. The display keeps the same thick, curved, boxy shape at every angle. The jacket swings and folds "
            "naturally as she turns. Static camera, even studio light.",
    # gestures: One-to-All motion transfer could not hold Nine (no face, waist-up), while this model keeps her intact,
    # so the motion is described in words and the still is given as the first AND last frame
    "wave": NINE + "stands facing the camera in front of a flat green screen. She lifts her right hand up beside her shoulder, palm "
            "forward, and waves hello three times from the elbow, then lowers her arm and stands as she started. The jacket sleeve "
            "bunches at the elbow and the jacket shifts with her arm. The display stays still and keeps its shape. Static camera, even studio light.",
    "talk": NINE + "stands facing the camera in front of a flat green screen and explains something with her hands: both forearms come "
            "up in front of her waist, her hands open, turn and gesture, her shoulders move a little, then she lowers her arms and "
            "stands as she started. The jacket creases and swings with every movement. The display stays still and keeps its shape. "
            "Static camera, even studio light.",
}
PROMPT = PROMPTS[a.motion]
NEGATIVE = ("flat panel, thin monitor, tablet, television, morphing head, changing head shape, human head, face, hair, extra arms, "
            "deformed hands, camera movement, zoom, background change, shadows on background, flicker, blurry, low quality, text, watermark"
            + ("" if a.motion == "turn" else ", turning around, back view, walking away, missing jacket, sleeveless"))
USE_LORA = a.motion == "turn"

def check():
    probs = []
    if not os.path.exists(a.still): probs.append(f"still not found: {a.still}")
    for f in ((a.lora_high, a.lora_low) if USE_LORA else ()):
        if not a.lora_dir or not os.path.exists(os.path.join(a.lora_dir, f)): probs.append(f"LoRA file not found: {os.path.join(a.lora_dir, f)}")
    for f in (a.gguf_high, a.gguf_low):
        if f and not os.path.exists(f): probs.append(f"GGUF not found: {f}")
    if bool(a.gguf_high) != bool(a.gguf_low): probs.append("give both --gguf-high and --gguf-low, or neither (bf16)")
    if (a.frames - 1) % 4: probs.append("--frames must be 4k+1 (e.g. 49, 81)")
    if a.width % 16 or a.height % 16: probs.append("--width/--height must be multiples of 16")
    return probs

probs = check()
print("plan:", {"base": a.base, "experts": "GGUF" if a.gguf_high else "bf16", "offload": a.offload, "size": f"{a.width}x{a.height}",
                "frames": a.frames, "fps": a.fps, "close_loop": a.close_loop, "lora_scale": a.lora_scale}, flush=True)
if probs:
    print("\n".join("PROBLEM: " + p for p in probs)); sys.exit(1)
if a.dry_run:
    print("dry run: inputs OK"); sys.exit(0)

import numpy as np, torch
from PIL import Image
from diffusers import WanImageToVideoPipeline, WanTransformer3DModel
import diffusers.pipelines.wan.pipeline_wan_i2v as _wan_i2v
if not hasattr(_wan_i2v, "ftfy"):        # ftfy may be missing; the prompts are plain ASCII
    import types; _wan_i2v.ftfy = types.SimpleNamespace(fix_text=lambda t: t)

t0 = time.time()
dtype = torch.bfloat16 if torch.cuda.is_available() and torch.cuda.get_device_capability()[0] >= 8 else torch.float16  # T4 has no bf16

# 1. prompt embeddings first, with ONLY the 11 GB text encoder in memory (32 GB RAM cannot hold it and both experts)
import hashlib
cache = os.path.join(a.out, f"prompt_{hashlib.sha1((PROMPT + NEGATIVE).encode()).hexdigest()[:10]}.pt")
if os.path.exists(cache):
    pe, ne = torch.load(cache)                                         # encoded before: skip the 4-minute CPU pass
else:
    from transformers import UMT5EncoderModel
    te = UMT5EncoderModel.from_pretrained(a.text_encoder or a.base, subfolder="text_encoder", torch_dtype=dtype)
    tmp = WanImageToVideoPipeline.from_pretrained(a.base, text_encoder=te, transformer=None, transformer_2=None, vae=None, torch_dtype=dtype)
    with torch.no_grad():
        pe, ne = tmp.encode_prompt(prompt=PROMPT, negative_prompt=NEGATIVE, do_classifier_free_guidance=True, device="cpu")
    del tmp, te; gc.collect()
    os.makedirs(a.out, exist_ok=True); torch.save((pe, ne), cache)
print(f"prompt encoded in {time.time() - t0:.0f}s", flush=True)

# 2. the two experts (GGUF or bf16), the VAE and the LoRA
kw = {}
if a.gguf_high:
    from diffusers import GGUFQuantizationConfig
    q = GGUFQuantizationConfig(compute_dtype=dtype)
    kw["transformer"] = WanTransformer3DModel.from_single_file(a.gguf_high, quantization_config=q, config=a.base, subfolder="transformer", torch_dtype=dtype)
    kw["transformer_2"] = WanTransformer3DModel.from_single_file(a.gguf_low, quantization_config=q, config=a.base, subfolder="transformer_2", torch_dtype=dtype)
pipe = WanImageToVideoPipeline.from_pretrained(a.base, text_encoder=None, torch_dtype=dtype, **kw)
if USE_LORA:
    pipe.load_lora_weights(a.lora_dir, weight_name=a.lora_high, adapter_name="rot_high")
    pipe.load_lora_weights(a.lora_dir, weight_name=a.lora_low, adapter_name="rot_low", load_into_transformer_2=True)
    pipe.set_adapters(["rot_high", "rot_low"], adapter_weights=[a.lora_scale, a.lora_scale])
print(f"model and LoRA loaded in {time.time() - t0:.0f}s", flush=True)

if a.offload == "group":
    # each transformer block is moved to the GPU only while it runs; GGUF weights move as they are
    from diffusers.hooks import apply_group_offloading
    for m in (pipe.transformer, pipe.transformer_2):
        apply_group_offloading(m, onload_device=torch.device("cuda"), offload_device=torch.device("cpu"), offload_type="block_level", num_blocks_per_group=1)
    pipe.vae.to("cuda")
elif a.offload == "sequential": pipe.enable_sequential_cpu_offload()
elif a.offload == "model": pipe.enable_model_cpu_offload()
else: pipe.to("cuda")
if hasattr(pipe.vae, "enable_tiling"): pipe.vae.enable_tiling()

still = Image.open(a.still).convert("RGB").resize((a.width, a.height), Image.LANCZOS)
t1 = time.time()
frames = pipe(image=still, last_image=still if a.close_loop else None,
              prompt_embeds=pe.to(dtype), negative_prompt_embeds=ne.to(dtype),
              height=a.height, width=a.width, num_frames=a.frames, num_inference_steps=a.steps,
              guidance_scale=a.guidance, guidance_scale_2=a.guidance,
              generator=torch.Generator("cpu").manual_seed(a.seed)).frames[0]
frames = [f if isinstance(f, Image.Image) else Image.fromarray((f * 255).clip(0, 255).astype("uint8")) for f in frames]
print(f"generated {len(frames)} frames in {time.time() - t1:.0f}s", flush=True)
os.makedirs(a.out, exist_ok=True)
for i, f in enumerate(frames): f.save(os.path.join(a.out, f"frame_{i:03d}.png"))

# make it loop: with --close-loop the last frame IS the still, so drop it (it repeats frame 0);
# otherwise cut at the frame most like frame 0 (in the last third) and cross-fade into it
small = lambda im: np.asarray(im.resize((64, 88)), dtype=np.float32)
if a.motion != "turn":
    loop = frames                       # a gesture plays once: keep the return to the still
elif a.close_loop:
    loop = frames[:-1]
else:
    ref = small(frames[0]); lo = len(frames) * 2 // 3
    end = min(range(lo, len(frames)), key=lambda i: np.abs(small(frames[i]) - ref).mean())
    loop = frames[:end]
    X = min(6, len(loop) // 8)
    for k in range(X):                                     # blend the last X frames toward frame 0..X-1
        w = (k + 1) / (X + 1)
        loop[-X + k] = Image.blend(loop[-X + k], frames[k], w)
    print(f"loop cut at frame {end} of {len(frames)}, cross-fade {X}", flush=True)

if a.matte:
    import matting
    alphas = matting.smooth_alphas(loop, matting.raw_alphas(loop, a.matte), loop=a.motion == "turn")
    if a.site_out and a.motion == "turn":
        m = matting.export_web(loop, alphas, a.site_out, a.fps, extra={"kind": "turntable", "loop": True}, js_var="NINE_TURN")
        print("web frames:", m, flush=True)
    elif a.site_out:
        # an action clip for the site's player (<site>/assets/nine/anim/<motion>/), same format as gen_animation.py
        m = matting.export_web(loop, alphas, a.site_out, a.fps, extra={"kind": "animation", "loop": False, "stage": [0, 0, a.width, a.height]})
        matting.list_clips(os.path.dirname(os.path.abspath(a.site_out)))
        print("web frames:", m, flush=True)
print(f"done in {time.time() - t0:.0f}s", flush=True)
