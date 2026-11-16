"""Paint the head and hair out of the chosen body photo with the studio backdrop, keeping the neck.
Usage: .venv\\Scripts\\python.exe remove_head.py <model_dir> <in.png> <out.png>
"""
import sys, torch
from PIL import Image, ImageDraw, ImageFilter
from diffusers import StableDiffusionXLInpaintPipeline, DPMSolverMultistepScheduler

model_dir, src, out = sys.argv[1:4]
img = Image.open(src).convert("RGB")
W, H = img.size

# mask: white = repaint. Head + hair, but not the neck (x 300-480 below y 485) or the jacket.
mask = Image.new("L", (W, H), 0)
d = ImageDraw.Draw(mask)
d.ellipse((140, -20, 690, 500), fill=255)                 # head and top of hair
d.rectangle((160, 420, 302, 575), fill=255)               # hair on her right side (viewer's left)
d.polygon([(478, 430), (672, 430), (672, 600), (560, 600), (478, 520)], fill=255)  # hair over the far shoulder
d.rectangle((302, 420, 478, 486), fill=255)               # chin and jaw, down to the top of the neck
mask = mask.filter(ImageFilter.GaussianBlur(6))
mask.save(out.replace(".png", "_mask.png"))

pipe = StableDiffusionXLInpaintPipeline.from_pretrained(model_dir, torch_dtype=torch.float16, variant="fp16", use_safetensors=True)
pipe.scheduler = DPMSolverMultistepScheduler.from_config(pipe.scheduler.config, use_karras_sigmas=True)
pipe.enable_model_cpu_offload()
pipe.vae.enable_tiling()

g = torch.Generator("cpu").manual_seed(4242)
res = pipe(prompt="empty dark charcoal grey photo studio backdrop, smooth soft gradient, nothing there",
           negative_prompt="person, head, face, hair, skin, eyes, text, object, pattern",
           image=img, mask_image=mask, width=W, height=H, strength=0.99,
           num_inference_steps=30, guidance_scale=6.0, generator=g).images[0]
# keep every unmasked pixel exactly as it was
res = Image.composite(res, img, mask)
res.save(out)
print("saved", out, flush=True)
