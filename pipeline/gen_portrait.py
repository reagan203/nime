"""Generate photo-real portrait options of a fictional Nine with RealVisXL V5 (SDXL, OpenRAIL++).
Usage: .venv\\Scripts\\python.exe gen_portrait.py <model_dir> [count] [first_seed]
"""
import sys, os, time, torch
from diffusers import StableDiffusionXLPipeline, DPMSolverMultistepScheduler
from PIL import Image

model_dir = sys.argv[1]
count = int(sys.argv[2]) if len(sys.argv) > 2 else 4
seed0 = int(sys.argv[3]) if len(sys.argv) > 3 else 9001
out_dir = os.path.join(os.path.dirname(__file__), "options")
os.makedirs(out_dir, exist_ok=True)

PROMPT = os.environ.get("NINE_PROMPT") or ("RAW photo, medium close-up portrait of a 30 year old Kenyan woman with light skin tone, "
          "natural skin texture with visible pores, subtle imperfections, slight facial asymmetry, "
          "warm dark brown eyes, soft genuine smile, long dark brown hair neatly styled, "
          "navy tailored suit jacket over white blouse, small stud earrings, looking at camera, "
          "85mm lens, shallow depth of field, soft studio portrait lighting, light grey background")
NEGATIVE = os.environ.get("NINE_NEGATIVE") or ("cartoon, anime, 3d render, cgi, illustration, painting, doll, plastic skin, airbrushed, "
            "overly smooth skin, waxy, deformed, distorted face, extra fingers, bad anatomy, "
            "cross-eyed, blurry, low quality, watermark, text, logo, jewelry heavy, glasses")

pipe = StableDiffusionXLPipeline.from_pretrained(model_dir, torch_dtype=torch.float16, variant="fp16", use_safetensors=True)
pipe.scheduler = DPMSolverMultistepScheduler.from_config(pipe.scheduler.config, use_karras_sigmas=True, algorithm_type="sde-dpmsolver++")
pipe.enable_model_cpu_offload()       # fits a 6 GB GPU
pipe.vae.enable_tiling()

paths = []
for i in range(count):
    seed = seed0 + i
    t = time.time()
    g = torch.Generator("cpu").manual_seed(seed)
    img = pipe(prompt=PROMPT, negative_prompt=NEGATIVE, width=896, height=1152,
               num_inference_steps=30, guidance_scale=5.0, generator=g).images[0]
    p = os.path.join(out_dir, f"{os.environ.get('NINE_PREFIX', 'nine_opt')}_{seed}.png")
    img.save(p); paths.append(p)
    print(f"saved {p} in {time.time() - t:.0f}s", flush=True)

# contact sheet
thumbs = [Image.open(p).resize((448, 576)) for p in paths]
sheet = Image.new("RGB", (448 * len(thumbs), 576), "white")
for k, im in enumerate(thumbs):
    sheet.paste(im, (448 * k, 0))
sheet.save(os.path.join(out_dir, os.environ.get("NINE_PREFIX", "nine_opt") + "_sheet.png"))
print("contact sheet saved", flush=True)
