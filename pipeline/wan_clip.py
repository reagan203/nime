"""Render one short action clip of Nine with Wan 2.2 TI2V-5B (Apache-2.0), image to video, on a 6 GB GPU.
Usage: .venv\\Scripts\\python.exe wan_clip.py <wan_dir> <name> "<prompt>" [frames] [steps]
Writes clips/<name>.mp4 and clips/<name>/frame_###.png
"""
import os, sys, time, gc
os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")
import torch
from PIL import Image
from diffusers import WanImageToVideoPipeline
from diffusers.utils import export_to_video
import diffusers.pipelines.wan.pipeline_wan_i2v as _wan_i2v
if not hasattr(_wan_i2v, "ftfy"):        # ftfy isn't installed; our prompts are plain ASCII, so text clean-up can be a no-op
    import types; _wan_i2v.ftfy = types.SimpleNamespace(fix_text=lambda t: t)

wan_dir, name, prompt = sys.argv[1:4]
frames = int(sys.argv[4]) if len(sys.argv) > 4 else 49      # 4k+1; 49 = 2 s at 24 fps
steps = int(sys.argv[5]) if len(sys.argv) > 5 else 30
W, H = int(os.environ.get("NINE_W", 512)), int(os.environ.get("NINE_H", 704))   # multiples of 32
NEG = ("camera movement, zoom, pan, shaky, blurry, low quality, flicker, distorted hands, extra fingers, deformed arms, "
       "human face, human head, hair, text, watermark, logo, morphing, melting, background change, shadows on background")

base = os.path.dirname(os.path.abspath(__file__))
img = Image.open(os.environ.get("NINE_IMG") or os.path.join(base, "final", "nine_green.png")).convert("RGB").resize((W, H), Image.LANCZOS)
t0 = time.time()

pipe = WanImageToVideoPipeline.from_pretrained(wan_dir, torch_dtype=torch.bfloat16)
# 1. encode the prompt on the CPU once, then drop the 11 GB text encoder
with torch.no_grad():
    pe, ne = pipe.encode_prompt(prompt=prompt, negative_prompt=NEG, do_classifier_free_guidance=True, device="cpu")
pipe.text_encoder = None; gc.collect()
print(f"prompt encoded in {time.time() - t0:.0f}s", flush=True)

# 2. move each layer to the GPU only while it runs (slow, but fits 6 GB); tile the VAE
pipe.enable_sequential_cpu_offload()
if hasattr(pipe.vae, "enable_tiling"): pipe.vae.enable_tiling()

t1 = time.time()
out = pipe(image=img, prompt_embeds=pe, negative_prompt_embeds=ne, height=H, width=W,
           num_frames=frames, num_inference_steps=steps, guidance_scale=5.0,
           generator=torch.Generator("cpu").manual_seed(9)).frames[0]
print(f"generated in {time.time() - t1:.0f}s", flush=True)

out_dir = os.path.join(base, "clips", name); os.makedirs(out_dir, exist_ok=True)
for i, f in enumerate(out):
    (f if isinstance(f, Image.Image) else Image.fromarray((f * 255).clip(0, 255).astype("uint8"))).save(os.path.join(out_dir, f"frame_{i:03d}.png"))
pil = [f if isinstance(f, Image.Image) else Image.fromarray((f * 255).clip(0, 255).astype("uint8")) for f in out]
pil[0].save(os.path.join(base, "clips", f"{name}.webp"), save_all=True, append_images=pil[1:], duration=42, loop=0, quality=82)
try:
    export_to_video(out, os.path.join(base, "clips", f"{name}.mp4"), fps=24)
except Exception as e:
    print("mp4 export skipped:", e, flush=True)
print("saved", name, f"total {time.time() - t0:.0f}s", flush=True)
