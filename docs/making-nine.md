# How Nine was made

Everything was made locally with free, open models and Blender, on a laptop with an RTX 3050 (6 GB) graphics card, 32 GB of memory and Windows 11. No paid service and no real person's likeness was used: the body is an AI-generated fictional person, and the display head is an original design.

The scripts are in `pipeline/`. They expect a Python 3.12 virtual environment with PyTorch (CUDA 12.8), `diffusers`, `transformers`, `accelerate`, `torchvision`, `timm`, `kornia` and `einops`, and Blender 5.3.

## The models

| Model | Licence | Used for |
|---|---|---|
| RealVisXL V5.0 (SDXL) | CreativeML OpenRAIL++-M | The photographic body, and painting the original head out |
| BiRefNet-lite | MIT | Cutting Nine out of the background, in the still and in every video frame |
| Wan 2.2 TI2V-5B | Apache 2.0 | The 360 turn video |
| Depth Anything V2 Small | Apache 2.0 | Tried for the cut-out; BiRefNet did it better |
| Blender 5.3, Cycles | GPL (the renders are ours) | The display head and mechanical neck |

## Step by step

### 1. A photographic body

`gen_portrait.py` generates portrait options of a fictional woman in a navy suit at 896 × 1152 with RealVisXL (30 steps, guidance 5, DPM++ SDE Karras). Option 4 (seed 7104) was chosen.

```bash
python gen_portrait.py <RealVisXL folder> 4 7101
```

### 2. Paint the head out

`remove_head.py` masks the head and hair (keeping the neck and the jacket) and inpaints a plain studio backdrop there.

```bash
python remove_head.py <RealVisXL folder> options/nine_display_7104.png options/body_7104_headless.png
```

### 3. The display head and mechanical neck

`display_head.py` builds the head in Blender from code and renders it with Cycles (GPU, 160 samples, AgX, transparent background):

- a graphite brushed-aluminium shell, a satin bezel and a slightly curved glass screen with faint specks;
- a brand-blue light strip, a power light, screws, rear vents, a side port panel with two braided cables;
- the **mechanical neck**: a steel mount ring with ten bolts and a rubber gasket on her neck; four graphite vertebrae on steel spacers with a blue light ring; three hydraulic pistons (barrel, chrome rod and ball ends); a steel ball-joint gimbal; a bolted mounting plate under the head; and a thin blue cable spiralling up the spine.

It also writes `display_head.json`: where the screen's corners and the neck ring are in the image.

```bash
blender --background --factory-startup --python display_head.py -- D:/full/path/head -9 160
```

Give Blender a full output path: a relative one is resolved against Blender's own folder, not yours.

### 4. Cut the body out

`matte.py` runs BiRefNet-lite over the headless body and saves it with a transparent background.

```bash
python matte.py <BiRefNet folder> matte options/body_7104_headless.png
```

### 5. Web layers

`export_web.py` scales the head so its neck ring fits her neck, places it, adds a soft contact shadow on the neck, and writes the site's `body.webp`, `head.webp` and `nine.json` (head position, pivot and screen corners). It also writes `final/nine_full.png` (transparent) and `final/nine_green.png` (on a green screen, for the video model).

```bash
python export_web.py <website folder>
```

### 6. The 360 turn

`wan_clip.py` turns a still into a short video with Wan 2.2 TI2V-5B at 512 × 704, 81 frames (24 frames a second), 30 steps:

- The prompt is encoded once on the processor, and then the 11 GB text encoder is dropped.
- `enable_sequential_cpu_offload()` moves each layer onto the graphics card only while it runs, so the 5-billion-parameter model fits in 6 GB. One clip takes about 25–30 minutes.
- The first clip (front to back) starts from `nine_green.png`. The second starts from the first clip's last frame and keeps turning the same way round. Its first half (her back to her other side) is good; after that the model drifts (the monitor turns into a flat panel), so only frames 0–46 are used.

```bash
python wan_clip.py <Wan folder> turn "<prompt>" 81 30
NINE_IMG=clips/turn/frame_080.png python wan_clip.py <Wan folder> turn2 "<prompt>" 81 30
```

`turn_frames.py` cuts every frame out with BiRefNet, removes anything still plainly green and the green tint at the edges, and saves transparent WebP frames for the site.

```bash
python turn_frames.py <BiRefNet folder> clips/turn clips/turn_web
python turn_frames.py <BiRefNet folder> clips/turn2 clips/turn2_web
```

`join_turn.py` makes the full 360 (161 frames) from them: clip 1 (front, her side, back), then clip 2 up to her other side, then clip 1's first quarter **mirrored and played backwards** (her other side back to the front). It picks the join between true side views where the silhouettes overlap most, ramps clip 2's colours toward clip 1 (clip 2 renders a little darker), and cross-fades five frames across the join.

```bash
python join_turn.py <website>/assets/nine/turn
```

## Problems met, and the fixes

| Problem | Fix |
|---|---|
| SDXL would not draw a monitor for a head | Paint the human head out and add a rendered head instead |
| Wan ran out of graphics memory with group offloading | Sequential offload, and encode the prompt on the processor first |
| Wan's pipeline wanted the `ftfy` package | The prompts are plain text, so the clean-up step is replaced with a no-op in the script |
| The depth-map cut-out left a ghost where the old head was | BiRefNet instead |
| One 81-frame clip only turned her halfway | A second clip from her back onward |
| The second clip drifted at the end (flat-panel monitor) | Keep its good half; finish the turn with the first clip mirrored and reversed |
| Joining on silhouette alone matched a back view to a front view | Search only side-profile frames for the join |
| Blender wrote the render to the wrong folder | Always pass a full output path |

## Version 2 of the head and neck (2026-11)

`display_head.py` now adds more mechanical definition and renders at 2000 px (was 1400):

- **Head:** a parting seam around the shell, cooling fins on both sides, hex screws in the bezel corners, and a camera module with an indicator light on the top bezel.
- **Neck:** a toothed gear ring around the gimbal, two blue-grey anodised servo motors with output horns, screws and chrome links to the ball joint, ribs around every vertebra, knurled rings and end caps on the three pistons, a knurled grip band and three status lights on the collar, and a second (dark) cable spiralling the other way.
- A soft light from below and in front lifts the neck's mechanics out of the shadow.

```bash
blender --background --factory-startup --python display_head.py -- D:/full/path/head -9 256 2000
```

`export_head.ts` places a new head render onto the existing body without needing the original body files or Python imaging: it scales the render so the collar is as wide as before, puts the collar where it was, crops it, saves `head.webp` at twice the display size, and rewrites the head box, pivot and screen corners in `nine.json`. The site reads those from `nine.json`, so the face lines up with any new render.

```bash
bun pipeline/export_head.ts D:/full/path/head          # writes public/assets/nine/photo/
```

The 360 turn frames were made with the first head; making them again needs the video model (step 6).
