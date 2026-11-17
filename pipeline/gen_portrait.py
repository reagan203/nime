"""Generate photo-real body options for Nine with RealVisXL V5 (SDXL, OpenRAIL++).
v2: prompts split across SDXL's two text encoders, each kept under its 77-token limit, with the
emphasis on 3D volume, real fabric (weight, weave, folds) and neck skin detail.

Usage: .venv\\Scripts\\python.exe gen_portrait.py <model_dir> [count] [first_seed]
Env overrides: NINE_PROMPT / NINE_PROMPT_2 / NINE_NEGATIVE / NINE_NEGATIVE_2 / NINE_PREFIX

Why two prompts: SDXL has two text encoders (CLIP ViT-L and OpenCLIP ViT-bigG). diffusers sends `prompt`
to the first and `prompt_2` to the second; each reads at most 77 tokens and silently drops the rest.
One long prompt (v1) lost its last clauses. Here the first carries subject, light and volume, the second
carries materials and skin.
"""
import sys, os, time, torch
from diffusers import StableDiffusionXLPipeline, DPMSolverMultistepScheduler
from PIL import Image

model_dir = sys.argv[1]
count = int(sys.argv[2]) if len(sys.argv) > 2 else 4
seed0 = int(sys.argv[3]) if len(sys.argv) > 3 else 9001
out_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "options")
os.makedirs(out_dir, exist_ok=True)

# 1. CLIP ViT-L: subject, framing, light that models volume
PROMPT = os.environ.get("NINE_PROMPT") or (
    "RAW photo, waist-up portrait of a 30 year old Kenyan woman with light skin, "
    "shoulders turned slightly, natural curves of shoulders, bust and waist, "
    "soft key light from the left, gentle rim light separating her from a dark grey studio backdrop, "
    "85mm lens, shallow depth of field")
# 2. OpenCLIP bigG: materials, cloth physics, skin
PROMPT_2 = os.environ.get("NINE_PROMPT_2") or (
    "tailored navy wool-blend suit jacket with visible twill weave and real weight, natural drape, "
    "soft folds at the elbows and waist, crisp white cotton shirt with fine creases, open collar, "
    "visible collarbones, real neck skin with pores, subtle tone variation and faint veins, no makeup on the neck")
NEGATIVE = os.environ.get("NINE_NEGATIVE") or (
    "cartoon, anime, 3d render, cgi, illustration, painting, doll, mannequin, plastic skin, airbrushed, waxy, "
    "flat lighting, deformed, bad anatomy, extra fingers, blurry, low quality, watermark, text, logo")
NEGATIVE_2 = os.environ.get("NINE_NEGATIVE_2") or (
    "shiny polyester, satin suit, stiff cardboard fabric, wrinkle-free plastic cloth, heavy jewellery, tattoo, "
    "bulging veins, bruises, scars, glasses, tie")

pipe = StableDiffusionXLPipeline.from_pretrained(model_dir, torch_dtype=torch.float16, variant="fp16", use_safetensors=True)
pipe.scheduler = DPMSolverMultistepScheduler.from_config(pipe.scheduler.config, use_karras_sigmas=True, algorithm_type="sde-dpmsolver++")
pipe.enable_model_cpu_offload()       # fits a 6 GB GPU
pipe.vae.enable_tiling()

# warn if any prompt would be cut off
for name, text, tok in (("prompt", PROMPT, pipe.tokenizer), ("prompt_2", PROMPT_2, pipe.tokenizer_2),
                        ("negative", NEGATIVE, pipe.tokenizer), ("negative_2", NEGATIVE_2, pipe.tokenizer_2)):
    n = len(tok(text).input_ids)
    print(f"{name}: {n} tokens" + ("  <-- over 77, the end will be dropped" if n > 77 else ""), flush=True)

paths = []
for i in range(count):
    seed = seed0 + i
    t = time.time()
    g = torch.Generator("cpu").manual_seed(seed)
    img = pipe(prompt=PROMPT, prompt_2=PROMPT_2, negative_prompt=NEGATIVE, negative_prompt_2=NEGATIVE_2,
               width=896, height=1152, num_inference_steps=34, guidance_scale=5.0, generator=g).images[0]
    p = os.path.join(out_dir, f"{os.environ.get('NINE_PREFIX', 'nine_v2')}_{seed}.png")
    img.save(p); paths.append(p)
    print(f"saved {p} in {time.time() - t:.0f}s", flush=True)

thumbs = [Image.open(p).resize((448, 576)) for p in paths]
sheet = Image.new("RGB", (448 * len(thumbs), 576), "white")
for k, im in enumerate(thumbs):
    sheet.paste(im, (448 * k, 0))
sheet.save(os.path.join(out_dir, os.environ.get("NINE_PREFIX", "nine_v2") + "_sheet.png"))
print("contact sheet saved", flush=True)
