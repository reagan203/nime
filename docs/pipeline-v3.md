# Nine pipeline v3: review and plan

The brief: fix the join between the human body and the mechanical head, make the body more real, curve the head, replace the patched-together 360 turn, and let Nine move. This page reviews the brief against what the models can actually do, then maps the new pipeline. The code is in `pipeline/`.

## Review: where the brief needs adjusting

| Brief says | What is actually the case | What v3 does |
|---|---|---|
| A TypeScript/Bun exporter | The exporter is Python (`export_web.py`); there is no TypeScript in this pipeline | Extended `export_web.py` |
| Wan 2.2 360 Rotation LoRA with our Wan 2.2 | The LoRA ([artificialguybr/360Rotation-Redmond-WAN2-I2V-14B](https://huggingface.co/artificialguybr/360Rotation-Redmond-WAN2-I2V-14B), CC0) is for **Wan2.2-I2V-A14B**: two 14-billion-parameter experts, one LoRA file each. It does not work with the 5B model we have, and A14B cannot run on 6 GB | `gen_360_turntable.py` targets A14B with GGUF-quantised experts on a Kaggle T4; locally it is possible but very slow and untested |
| A flawless, seamless turn from one still | No model guarantees it | Two safeguards: `--close-loop` gives the still as the last frame too (`last_image`), so the turn must come back to where it started; and the prompt names the back of the head and bans flat panels |
| Wan 2.2 Animate or One-to-All 1.3B on 6 GB | Wan2.2-Animate-14B's transformer is about 69 GB in bf16: it needs a 40–80 GB GPU. One-to-All 1.3B runs on a free Kaggle T4 (16 GB) according to its authors; no 6 GB figure exists | `gen_animation.py` uses One-to-All 1.3B, targets Kaggle, with a `--local` low-resolution attempt |
| The blue light ring casts subsurface scattering onto the skin; the gasket indents the flesh | The skin is in a **photograph**; Blender cannot light or dent it | Blender now renders a short **skin section** under the ring (subsurface-scattering skin, colour sampled from the photo's neck). The gasket presses into it, the flesh bulges around the lip, the blue light scatters into it, and it fades into the photographed neck below |
| Hydraulic lines disappear into the suit | The suit is in the photograph, under the head layer | The hoses run down to the collar, and `export_web.py` makes a **collar layer** (clothes only, not skin) that goes back over the head layer, so they vanish under the shirt collar and lapels |
| The screen UI is emissive and lights the inner bezel | The face is live HTML on the website, so it cannot light the render | The rendered screen panel glows softly (bright in the middle), which lights the bezel lip; the HTML face goes on top |
| The curved head with the existing face mapping | A four-corner perspective map cannot follow a curve | `display_head.py` now writes a 9 × 5 **screen grid**; the website will draw the face in strips along it |
| Faint veins and pores on the neck | At 896 × 1152 the neck is about 180 px wide: too small for pores | `refine_neck.py` repaints only the neck skin at 4× resolution, lightly (strength 0.35), then scales it back |
| One long SDXL prompt | SDXL's text encoders read 77 tokens each and drop the rest; v1's prompt lost its end | Two prompts, one per encoder, each under 77 tokens (checked: 62 and 65) |
| Walking from the current still | Nine is waist-up: the model would invent legs and trousers, differently every clip | Gestures work from the current still; for walking, generate a full-length still first |

Also check before launch: the **One-to-All checkpoints' licence**. Its README licenses the code (Apache-2.0) but not the weights.

![Nine v3: curved head, heavy neck fused into the neck skin](img/nine-v3-preview.png) ![The neck join: gasket, blue glow on the skin, hoses under the collar](img/nine-v3-neck.png)

## 1. Directory structure and file mapping

```text
nime/ (this repository)
├── index.html
├── assets/nine/
│   ├── photo/        body.webp · head.webp · collar.webp (new) · nine.json (adds screen_grid, collar)
│   ├── turn/         f000.webp … · manifest.json (new: frames, fps, loop)
│   └── anim/<name>/  f000.webp … · manifest.json · track.json (neck position per frame)
├── pipeline/
│   ├── gen_portrait.py        1  body photo (v2 prompts)
│   ├── remove_head.py         2  paint the head out
│   ├── refine_neck.py         3  NEW: neck skin detail pass
│   ├── matte.py               4  cut the body out (BiRefNet)
│   ├── display_head.py        5  v3: curved head, glass, heavy neck, skin section
│   ├── export_web.py          6  web layers + collar layer + screen grid; stills for video
│   ├── matting.py             NEW: shared BiRefNet + temporal smoothing + despill + web export
│   ├── gen_360_turntable.py   7  NEW: one-still 360 with the Wan 2.2 A14B LoRA
│   ├── gen_animation.py       8  NEW: motion transfer with One-to-All 1.3B
│   └── legacy/                the v2 turn: wan_clip.py · turn_frames.py · join_turn.py
└── docs/

nine-portrait/ (local working folder, not in git: models and large outputs)
├── .venv/                     Python 3.12, PyTorch cu128, diffusers 0.43, transformers, BiRefNet deps
├── options/  matte/  head_v3/  final/  clips/
├── loras/360/                 the two LoRA files
└── drives/                    driving videos for animation
```

Running order: `gen_portrait` → `remove_head` → `refine_neck` → `matte` → `display_head` → `export_web` → `gen_360_turntable` (Kaggle) → `gen_animation` (Kaggle).

## 2. `display_head.py` v3

The full script is `pipeline/display_head.py`. It was test-rendered on this PC (Blender 5.3, Cycles, RTX 3050, 128 samples). The key parts:

- **Curve.** Every head part is built flat, sliced into vertical strips, then bent around a vertical axis 0.7 m in front of the screen (`bend_co`), so the edges come about 2 cm toward the viewer.
- **Glass.** A real 3 mm cover sits in front of the panel. Refraction through the slab picked up the studio lights as a big bright patch, so the glass is a transparent and glossy mix with Fresnel: you see through it, and it reflects at grazing angles.
- **Panel glow.** The panel emits a soft "on" glow, brightest in the middle, which lights the inner bezel lip.
- **Mount ring.** The ring is heavy: two rows of bolts and a steel band. Its inner gasket (`GASKET_R`) is *smaller* than the neck, so it presses in.
- **Skin section** (`neck_skin`):
  - Its profile tucks under the gasket, slopes up into the metal, and bulges where the lip presses.
  - The shader has subsurface scattering, pores, tone variation and faint veins (a thin, distorted wave tinted blue-green at 22%).
  - It fades out 1–3 cm below the ring, so the photographed neck shows underneath.
- **Blue light.** A soft emissive ring and eight small blue lights just above the skin scatter blue into it.
- **Neck mechanics:** four armoured shroud plates, four pistons, servo housings at the gimbal, a rear cable loom, and two hydraulic hoses down to the collar.
- **Outputs:** the screen grid, the collar position and the hose end points, all in `display_head.json`.
- **Colour matching:** `NINE_SKIN=r,g,b` (linear) sets the skin colour. The default, 0.267, 0.117, 0.060, is the median of the photo's neck.

## 3. SDXL prompt structure (`gen_portrait.py` v2)

| Encoder | Carries | Prompt |
|---|---|---|
| CLIP ViT-L (`prompt`) | subject, framing, light that models volume | RAW photo, waist-up portrait of a 30 year old Kenyan woman with light skin, shoulders turned slightly, natural curves of shoulders, bust and waist, soft key light from the left, gentle rim light separating her from a dark grey studio backdrop, 85mm lens, shallow depth of field |
| OpenCLIP bigG (`prompt_2`) | materials, cloth, skin | tailored navy wool-blend suit jacket with visible twill weave and real weight, natural drape, soft folds at the elbows and waist, crisp white cotton shirt with fine creases, open collar, visible collarbones, real neck skin with pores, subtle tone variation and faint veins, no makeup on the neck |
| negatives | the usual, plus | shiny polyester, satin suit, stiff cardboard fabric, wrinkle-free plastic cloth … bulging veins, bruises, scars |

The script prints each prompt's token count and warns if one goes over 77. Volume comes mostly from the light: a key light from one side plus a rim light give the shoulders and waist shape against the backdrop. The neck pass (`refine_neck.py`) adds the pores and veins that the full portrait is too small to hold.

## 4. `gen_360_turntable.py`

What it does, in order:

1. **Load the model.** Wan2.2-I2V-A14B, with each expert loaded either from a GGUF file (`WanTransformer3DModel.from_single_file` with `GGUFQuantizationConfig`) or in bf16.
2. **Load the LoRA.** The high-noise LoRA goes into `transformer` and the low-noise one into `transformer_2` (`load_into_transformer_2=True`), each at 0.9.
3. **Encode the prompt once on the processor, then drop the 11 GB text encoder.** The prompt starts with the trigger "360 Rotation".
4. **Offload:** sequential, model or none.
5. **Generate.** 81 frames at 16 fps, 512 × 704, from the green-screen still. With `--close-loop`, the still is also the last frame.
6. **Make it loop.**
   - With `--close-loop`: drop the repeated last frame.
   - Without it: cut at the frame closest to frame 0, in the last third, and cross-fade six frames.
7. **Cut it out.** BiRefNet per frame, then motion-aware temporal smoothing:
   - each alpha is blended with the median of its neighbours, wrapping round because it loops;
   - but only where the picture barely moved, so moving edges stay sharp.
   - Then green clean-up, and WebP frames with a `manifest.json`.

`--dry-run` checks every input and prints the plan without loading anything. On Kaggle, use GGUF Q4_K_M experts (about 9–10 GB each) with `--offload model`. A T4 has no bf16, so the script falls back to fp16 automatically.

## 5. `gen_animation.py` architecture

```text
driving video ──► prepare (16 fps, 480×832, centred) ──┐
Nine on green ──► prepare (padded to 480×832, green) ──┤
                                                       ▼
                     One-to-All 1.3B (its own repo, run as a subprocess)
                     infer_preprocess.py (pose)  →  inference_1.3b.py
                                                       ▼
                     matte: BiRefNet + temporal smoothing + despill   (matting.py)
                                                       ▼
                     head track: neck centre and shoulder tilt per frame → track.json
                                                       ▼
                     export: f000.webp … + manifest.json + track.json → assets/nine/anim/<name>/
```

- **Why One-to-All 1.3B.** It is alignment-free: Nine and the driving person needn't match in framing or build. It is small enough for a free Kaggle T4 (the authors quote about 11 minutes for 10 s at 832 × 480). Its code is Apache-2.0.
- **How it runs their code.** Their scripts take paths by editing the file. `--inspect` lists the path variables and options it finds in them, you name them once in `adapter.json`, and the wrapper writes our paths into a temporary copy on every run.
- **Head lock.** The model also redraws the display head, and that is where drift shows. `--head-lock` writes the neck position and shoulder tilt for every frame, measured from the matte (no pose model needed). The website can then pin the crisp Blender head and its live face to the moving body, the same way the head layer already sits on the still.
- **Cloth.** The folds come from the reference still. One-to-All carries the clothes from the reference and deforms them with the pose, so the v2 portrait with real fabric weight is what gives natural folds in motion.
- **6 GB.** `--local` drops to 384 × 672 and sets a flag for a low-VRAM patch. Expect to run it on Kaggle.

## What was tested here, and what was not

| | Status |
|---|---|
| `display_head.py` v3 | Rendered on this PC; composite checked by eye on a dark background |
| `export_web.py` collar layer and screen grid | Run on this PC with the v3 head; the site still uses the v2 assets |
| `gen_portrait.py` / `refine_neck.py` prompts | Token counts checked (all under 77); not generated yet |
| `matting.py` | Run on 12 frames of the old turn |
| `gen_360_turntable.py` | `--dry-run` only: the LoRA and A14B files are not downloaded |
| `gen_animation.py` | Neck tracker run on old frames; the One-to-All stage needs its repo and a driving video |
| Website: strips along the screen grid, collar layer, LED-matrix mouth, reading `manifest.json` | Not done yet |
