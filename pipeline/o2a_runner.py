"""Run One-to-All Animation 1.3B on a 6 GB GPU / 32 GB RAM machine, called by gen_animation.py.
Runs in One-to-All's own environment (.venv-o2a: Python 3.10, torch 2.5.1, diffusers 0.33), with the
working folder set to <repo>/video-generation. Reuses their code unchanged (pose extraction `process_one`,
chunked generation `unified_worker`) and replaces only how the pipeline is built.

Three stages, each meant to run in its OWN process (gen_animation.py does that):
  pre     pose extraction. Its ONNX pose models keep ~5 GB of GPU memory until the process exits.
  prompt  the 11 GB umT5 text encoder alone, on the CPU; the embeddings are saved next to the output.
          (Their build loads the encoder and the 1.3B model together: with 32 GB RAM that swaps to disk.)
  gen     the 1.3B transformer (+ controlnet + reference extractor) and the VAE on the GPU, no text encoder;
          every pipeline call gets the saved embeddings instead of the text.

Usage (from <repo>/video-generation):
  python o2a_runner.py --stage pre|prompt|gen --ref ref.png --drive drive.mp4 --ckpt <1.3b ckpt> --out out_dir
"""
import argparse, gc, glob, hashlib, importlib.util, os, sys, time
ap = argparse.ArgumentParser()
ap.add_argument("--stage", choices=["keypoints", "pre", "prompt", "gen"], required=True)
ap.add_argument("--ref", required=True); ap.add_argument("--drive", required=True)
ap.add_argument("--ckpt"); ap.add_argument("--out")
ap.add_argument("--align", action="store_true", help="let their retargeting stretch the driving poses to the reference's skeleton")
ap.add_argument("--ref-pose", choices=["drive", "detect"], default="drive",
                help="drive: use the first driving pose as the reference pose (the detector misreads Nine: no face, jacket shoulders as arms)")
ap.add_argument("--base", default="../pretrained_models/Wan2.1-T2V-1.3B-Diffusers")
ap.add_argument("--prompt", default="a woman in a tailored navy suit jacket and white shirt, whose head is a curved graphite display on a mechanical neck, "
                                     "moving naturally; the jacket and shirt fold and swing with her movement; plain green background")
ap.add_argument("--max-short", type=int, default=384)
ap.add_argument("--offload", choices=["none", "group", "model", "sequential"], default="group",
                help="group: transformer blocks stream from RAM one at a time (6 GB GPUs); none: all on the GPU (12 GB+)")
ap.add_argument("--steps", type=int, default=30)
ap.add_argument("--ref-cfg", type=float, default=2.5); ap.add_argument("--pose-cfg", type=float, default=1.5)
ap.add_argument("--frame-interval", type=int, default=1)
a = ap.parse_args()
os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")
sys.path.insert(0, os.getcwd())
import torch
try:
    import deepspeed  # noqa: F401
except ImportError:      # only their training helpers use it (gradient norms); it does not install on Windows
    import types, importlib.machinery
    _ds = types.ModuleType("deepspeed"); _ds.__spec__ = importlib.machinery.ModuleSpec("deepspeed", None)
    sys.modules["deepspeed"] = _ds

def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m
def drop_stub():
    if getattr(sys.modules.get("deepspeed"), "__file__", None) is None: sys.modules.pop("deepspeed", None)

t0 = time.time()
if a.stage == "keypoints":
    # body keypoints of one image, as JSON on stdout (gen_animation.py uses them to frame the driving video like the still)
    import json, numpy as np
    from PIL import Image
    U = load("o2a_utils", "infer_utils.py"); drop_stub()
    for path in (a.ref, a.drive):
        im = np.array(Image.open(path).convert("RGB")); H, W = im.shape[:2]
        c = np.array(U.aaposemeta_to_dwpose(U.wanpose2d(im[None])[0])["bodies"]["candidate"])[:, :2]
        if c.max() <= 1.5: c = c * [W, H]
        print("KP " + json.dumps({"path": path, "size": [W, H], "pts": c.round(1).tolist()}), flush=True)
    sys.exit(0)
os.makedirs(a.out, exist_ok=True)
refname = os.path.splitext(os.path.basename(a.ref))[0]
cache_ptr = os.path.join(a.out, "cache_dir.txt")
emb_path = os.path.join(a.out, f"prompt_{hashlib.sha1(a.prompt.encode()).hexdigest()[:10]}.pt")

if a.stage == "pre":
    pre = load("o2a_pre", "infer_preprocess.py"); drop_stub()
    before = set(glob.glob(os.path.join(pre.cache_base_dir, "*")))
    pre.process_one(a.ref, a.drive, a.frame_interval, True, "ref")
    made = [d for d in glob.glob(os.path.join(pre.cache_base_dir, "*")) if d not in before] or \
           sorted(glob.glob(os.path.join(pre.cache_base_dir, f"ref_{refname}_driven_*")), key=os.path.getmtime)[-1:]
    open(cache_ptr, "w").write(os.path.abspath(made[0]))
    print(f"poses extracted in {time.time() - t0:.0f}s -> {made[0]}", flush=True)

elif a.stage == "prompt":
    if os.path.exists(emb_path):
        print("prompt already encoded:", emb_path, flush=True); sys.exit(0)
    inf = load("o2a_inf", "inference_1.3b.py"); drop_stub()
    from opensora.encoder_variants import get_text_enc
    from diffusers.schedulers import FlowMatchEulerDiscreteScheduler
    enc = get_text_enc("wanx-t2v", a.base, inf.model_dtype)
    tmp = inf.WanPipeline(transformer=None, vae=None, text_encoder=enc.text_encoder, tokenizer=enc.tokenizer,
                          scheduler=FlowMatchEulerDiscreteScheduler(shift=7.0, num_train_timesteps=1000))
    with torch.no_grad():
        pe, ne = tmp.encode_prompt(prompt=a.prompt, negative_prompt=inf.negative_prompt, do_classifier_free_guidance=True, device="cpu", dtype=inf.model_dtype)
    torch.save((pe, ne), emb_path)
    print(f"prompt encoded in {time.time() - t0:.0f}s -> {emb_path}", flush=True)

else:  # gen
    inf = load("o2a_inf", "inference_1.3b.py"); drop_stub()
    from opensora.vae_variants import get_vae
    from diffusers.schedulers import FlowMatchEulerDiscreteScheduler
    from safetensors.torch import load_file as safe_load
    from transformers import AutoTokenizer
    cache_dir = open(cache_ptr).read().strip()
    pe, ne = torch.load(emb_path)
    inf.max_short, inf.output_base_dir = a.max_short, a.out
    class EmbedPipe:
        """passes the saved prompt embeddings instead of text"""
        def __init__(self, pipe, pe, ne): self.pipe, self.pe, self.ne = pipe, pe, ne
        def __call__(self, **kw):
            kw.pop("prompt", None); kw.pop("negative_prompt", None); kw["num_inference_steps"] = a.steps
            return self.pipe(prompt_embeds=self.pe, negative_prompt_embeds=self.ne, **kw)
        def __getattr__(self, k): return getattr(self.pipe, k)
    def build_without_text_encoder(device, ckpt_path):
        # their build_pipe, minus the text encoder; checkpoint shards loaded one at a time
        dt = inf.model_dtype
        model = inf.WanTransformer3DModel_Refextractor_2D_Controlnet_prefix.from_config(inf.config_path).to(dt)
        model.set_up_controlnet("configs/wan2.1_t2v_1.3b_controlnet_2.json", dt)
        model.set_up_refextractor("configs/wan2.1_t2v_1.3b_refextractor_2d_withmask2.json", dt)
        model.eval(); model.requires_grad_(False)
        missing = set(model.state_dict().keys())
        for shard in sorted(f for f in os.listdir(ckpt_path) if f.endswith(".safetensors")):
            sd = safe_load(os.path.join(ckpt_path, shard), device="cpu")
            model.load_state_dict(sd, strict=False); missing -= set(sd); del sd; gc.collect()
        if missing: raise SystemExit(f"checkpoint is missing {len(missing)} weights, e.g. {sorted(missing)[:3]}")
        vae = get_vae("wanx", os.path.join(a.base, "vae"), dt)
        tok = AutoTokenizer.from_pretrained(a.base, subfolder="tokenizer")
        pipe = inf.WanPipeline(transformer=model, vae=vae.vae, text_encoder=None, tokenizer=tok,
                               scheduler=FlowMatchEulerDiscreteScheduler(shift=7.0, num_train_timesteps=1000, use_dynamic_shifting=False))
        if a.offload == "group":
            # the whole model is 4.7 GB: with the activations of an 81-frame chunk it overflows a 6 GB card and
            # Windows silently spills into shared memory (35 min per step). Keep only one block on the GPU at a time.
            from diffusers.hooks import apply_group_offloading
            model.to(dtype=dt); pipe.vae.to(dtype=dt)            # set_up_controlnet/refextractor add float32 layers
            apply_group_offloading(model, onload_device=torch.device(device), offload_device=torch.device("cpu"),
                                   offload_type="block_level", num_blocks_per_group=1, use_stream=False)   # no prefetch: controlnet blocks run interleaved with the main ones
            pipe.vae.to(device)
        elif a.offload == "sequential": pipe.enable_sequential_cpu_offload()
        elif a.offload == "model": pipe.enable_model_cpu_offload()
        else: pipe.to(device, dtype=dt)
        print(f"pipeline ready ({a.offload}) in {time.time() - t0:.0f}s, GPU {torch.cuda.memory_allocated() / 1e9:.1f} GB", flush=True)
        return EmbedPipe(pipe, pe.to(device), ne.to(device))
    inf.build_pipe = build_without_text_encoder
    inf.unified_worker(0, 1, [(os.path.basename(cache_dir), cache_dir, None, None, a.ref_cfg, a.pose_cfg, a.prompt)], a.ckpt)
    print(f"generated in {time.time() - t0:.0f}s; output under {a.out}", flush=True)
