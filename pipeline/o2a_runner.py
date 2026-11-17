"""Run One-to-All Animation 1.3B on a 6 GB GPU, called by gen_animation.py.
Runs in One-to-All's own environment (.venv-o2a: Python 3.10, torch 2.5.1, diffusers 0.33), with the
working folder set to <repo>/video-generation.

It reuses their code unchanged (pose extraction `process_one`, chunked generation `unified_worker`) and
only swaps their `build_pipe` for a low-memory one:
  * the prompt is encoded ONCE on the CPU with the 11 GB umT5 encoder, which is then dropped;
  * the 1.3B transformer (+ controlnet + reference extractor) and the VAE go on the GPU, or are
    offloaded with --offload model/sequential if that does not fit;
  * every call to the pipeline gets the cached embeddings instead of the prompt text.

Usage (from <repo>/video-generation):
  <repo>/../.venv-o2a/Scripts/python.exe <this file> --ref ref.png --drive drive.mp4 --ckpt ../checkpoints/One-to-All-1.3b_1 \
      --out out_dir [--prompt "..."] [--max-short 384] [--offload none|model|sequential]
"""
import argparse, glob, importlib.util, os, sys, time
ap = argparse.ArgumentParser()
ap.add_argument("--ref", required=True); ap.add_argument("--drive", required=True)
ap.add_argument("--ckpt", required=True); ap.add_argument("--out", required=True)
ap.add_argument("--base", default="../pretrained_models/Wan2.1-T2V-1.3B-Diffusers")
ap.add_argument("--prompt", default="a woman in a tailored navy suit jacket and white shirt, whose head is a curved graphite display on a mechanical neck, "
                                     "moving naturally; the jacket and shirt fold and swing with her movement; plain green background")
ap.add_argument("--max-short", type=int, default=384)
ap.add_argument("--offload", choices=["none", "model", "sequential"], default="none")
ap.add_argument("--ref-cfg", type=float, default=2.5); ap.add_argument("--pose-cfg", type=float, default=1.5)
ap.add_argument("--frame-interval", type=int, default=1)
a = ap.parse_args()
os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")
sys.path.insert(0, os.getcwd())
import torch

def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m

t0 = time.time()
# 1. pose extraction and reference alignment (their code)
pre = load("o2a_pre", "infer_preprocess.py")
before = set(glob.glob(os.path.join(pre.cache_base_dir, "*")))
pre.process_one(a.ref, a.drive, a.frame_interval, True, "ref")
made = [d for d in glob.glob(os.path.join(pre.cache_base_dir, "*")) if d not in before] or \
       sorted(glob.glob(os.path.join(pre.cache_base_dir, f"ref_{os.path.splitext(os.path.basename(a.ref))[0]}_driven_*")), key=os.path.getmtime)[-1:]
cache_dir = made[0]
print(f"poses extracted in {time.time() - t0:.0f}s -> {cache_dir}", flush=True)

# 2. generation (their code) with a low-memory pipeline
inf = load("o2a_inf", "inference_1.3b.py")
inf.model_path, inf.vae_path, inf.max_short, inf.output_base_dir = a.base, os.path.join(a.base, "vae"), a.max_short, a.out
original_build = inf.build_pipe
class EmbedPipe:
    """passes cached prompt embeddings instead of text, so the text encoder never touches the GPU"""
    def __init__(self, pipe, pe, ne): self.pipe, self.pe, self.ne = pipe, pe, ne
    def __call__(self, **kw):
        kw.pop("prompt", None); kw.pop("negative_prompt", None)
        return self.pipe(prompt_embeds=self.pe, negative_prompt_embeds=self.ne, **kw)
    def __getattr__(self, k): return getattr(self.pipe, k)
def build_low_vram(device, ckpt_path):
    pipe = original_build("cpu", ckpt_path)                          # builds everything on the CPU
    # the encoder stays in bf16 on the CPU: fp32 would need 22 GB of RAM next to the transformer
    with torch.no_grad():
        pe, ne = pipe.encode_prompt(prompt=a.prompt, negative_prompt=inf.negative_prompt, do_classifier_free_guidance=True, device="cpu", dtype=inf.model_dtype)
    pipe.text_encoder = None; import gc; gc.collect()
    if a.offload == "sequential": pipe.enable_sequential_cpu_offload()
    elif a.offload == "model": pipe.enable_model_cpu_offload()
    else: pipe.transformer.to(device); pipe.vae.to(device)
    print(f"pipeline ready ({a.offload}), GPU memory {torch.cuda.memory_allocated() / 1e9:.1f} GB", flush=True)
    return EmbedPipe(pipe, pe.to(device), ne.to(device))
inf.build_pipe = build_low_vram
job = os.path.basename(cache_dir)
inf.unified_worker(0, 1, [(job, cache_dir, None, None, a.ref_cfg, a.pose_cfg, a.prompt)], a.ckpt)
print(f"done in {time.time() - t0:.0f}s; output under {a.out}", flush=True)
