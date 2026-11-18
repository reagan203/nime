# Ninth Mind website mock, with Nine

A single-page HTML mock of the Ninth Mind website (`index.html`, open it in a browser, no build step), with **Nine**, Ninth Mind's assistant: a scripted, voice-enabled chat that collects a visitor's needs for the team.

## Nine, the avatar

Nine is a photographic body in a navy suit with an original display head on a mechanical neck. On the page:

- the face on the screen is live HTML (eyes and mouth), mapped onto the glass, and it reacts to the chat (listening, thinking, talking, happy, sleeping);
- the head is its own layer, so it looks toward the pointer, nods, tilts and dozes; the body breathes;
- a full 360-degree turn plays now and then, and visitors can **drag Nine to spin her**;
- she has no frame: she is cut out and sits on the page's own background, in light and dark mode.

## How Nine was made (`pipeline/`)

All free and open models, run locally on a 6 GB laptop GPU:

| Step | Script | Model (licence) |
|---|---|---|
| Body photo, fictional person | `gen_portrait.py` | RealVisXL V5.0, SDXL (OpenRAIL++) |
| Head painted out | `remove_head.py` | RealVisXL V5.0 inpainting |
| Display head and mechanical neck | `display_head.py` | Blender 5.3, Cycles |
| Body cut out of the backdrop | `matte.py` | BiRefNet-lite (MIT) |
| Web layers (body, head, screen corners) | `export_web.py` | |
| Neck skin detail | `refine_neck.py` | RealVisXL V5.0 inpainting |
| 360 turntable from one still | `gen_360_turntable.py` | Wan 2.2 I2V-A14B, GGUF Q4_K_S (Apache-2.0) + 360 Rotation LoRA (CC0) |
| Frames cut out for the web | `matting.py` | BiRefNet-lite (MIT) |
| Gestures with moving clothes (wave, talk) | `gen_360_turntable.py --motion wave` | Wan 2.2 I2V-A14B, GGUF Q4_K_S (Apache-2.0) |
| Motion transfer, tried and not used | `gen_animation.py`, `o2a_runner.py`, `make_drive.py` | One-to-All Animation 1.3B (code Apache-2.0) |

The first turn (two Wan 2.2 TI2V-5B clips joined) is kept in `pipeline/legacy/`. Details: [docs/pipeline-v3.md](docs/pipeline-v3.md).

The person in the body photo is AI-generated and fictional. The display head is an original design.

## Documentation

How everything in the site was made is in [docs/](docs/README.md).
