"""Second pass on the neck skin only: pores, tone variation and faint veins, at twice the resolution.
A full 896x1152 portrait gives the neck ~180 px, too few for skin detail, so this crops the neck,
upscales it 2x, inpaints it lightly with RealVisXL (strength ~0.35 keeps the shape and light),
then scales it back and feathers it in. Run it on the headless body, before matte.py.

Usage: .venv\\Scripts\\python.exe refine_neck.py <model_dir> <in.png> <out.png> [strength]
"""
import sys, torch
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from diffusers import StableDiffusionXLInpaintPipeline, DPMSolverMultistepScheduler

model_dir, src, out = sys.argv[1:4]
strength = float(sys.argv[4]) if len(sys.argv) > 4 else 0.35
img = Image.open(src).convert("RGB")
# the neck in body_7104 (see export_web.py: NECK_L, NECK_R, NECK_TOP); widen to include the throat
x0, y0, x1, y1 = 280, 470, 512, 700
crop = img.crop((x0, y0, x1, y1)).resize(((x1 - x0) * 4, (y1 - y0) * 4), Image.LANCZOS)   # 928 x 920

# only skin is repainted: a warm, saturated pixel mask, shrunk away from the shirt collar
a = np.asarray(crop, dtype=np.float32) / 255
mx, mn = a.max(2), a.min(2); sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
skin = (a[..., 0] > a[..., 1]) & (a[..., 1] > a[..., 2]) & (sat > 0.2) & (mx > 0.25)
mask = Image.fromarray((skin * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(9)).filter(ImageFilter.GaussianBlur(10))
W, H = (crop.width // 8) * 8, (crop.height // 8) * 8
crop, mask = crop.resize((W, H)), mask.resize((W, H))

pipe = StableDiffusionXLInpaintPipeline.from_pretrained(model_dir, torch_dtype=torch.float16, variant="fp16", use_safetensors=True)
pipe.scheduler = DPMSolverMultistepScheduler.from_config(pipe.scheduler.config, use_karras_sigmas=True)
pipe.enable_model_cpu_offload(); pipe.vae.enable_tiling()
res = pipe(prompt="macro photo of a woman's neck and collarbone skin, natural pores, fine vellus hair, subtle tone variation",
           prompt_2="faint blue-green veins just visible under light skin, soft natural light, realistic skin texture, no makeup",
           negative_prompt="plastic, airbrushed, smooth, cgi, painting, blurry", negative_prompt_2="bulging veins, bruises, tattoo, scars, rash",
           image=crop, mask_image=mask, width=W, height=H, strength=strength, num_inference_steps=36, guidance_scale=5.0,
           generator=torch.Generator("cpu").manual_seed(31)).images[0]
res = Image.composite(res, crop, mask).resize((x1 - x0, y1 - y0), Image.LANCZOS)
feather = Image.new("L", (x1 - x0, y1 - y0), 0)
ImageDraw.Draw(feather).rectangle((10, 10, x1 - x0 - 10, y1 - y0 - 10), fill=255)
# the repaint comes out smoother than the photo: add back skin grain with the photo's own strength
orig = np.asarray(img.crop((x0, y0, x1, y1)), dtype=np.float32); r = np.asarray(res, dtype=np.float32)
hp = lambda x: x - np.asarray(Image.fromarray(x.clip(0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.5)), dtype=np.float32)
cs = np.asarray(Image.fromarray((skin * 255).astype(np.uint8)).resize((x1 - x0, y1 - y0)), dtype=np.float32)[..., None] / 255
want, have = hp(orig)[cs[..., 0] > .5].std(), hp(r)[cs[..., 0] > .5].std()
if want > have:
    g = np.random.default_rng(7).normal(0, 1, r.shape[:2])[..., None]
    g = np.asarray(Image.fromarray(((g * 40) + 128).clip(0, 255).astype(np.uint8)[..., 0]).filter(ImageFilter.GaussianBlur(.6)), dtype=np.float32)[..., None] - 128
    g = g / (g.std() + 1e-6) * np.sqrt(want ** 2 - have ** 2) * np.array([1.0, .9, .8])
    res = Image.fromarray((r + g * cs).clip(0, 255).astype(np.uint8))
    print(f"grain added: photo {want:.1f}, repaint {have:.1f}", flush=True)
img.paste(res, (x0, y0), feather.filter(ImageFilter.GaussianBlur(6)))
img.save(out)
print("saved", out, flush=True)
