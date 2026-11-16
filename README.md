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
| 360 turn video | `wan_clip.py` | Wan 2.2 TI2V-5B (Apache-2.0) |
| Turn frames cut out for the web | `turn_frames.py` | BiRefNet-lite (MIT) |

The person in the body photo is AI-generated and fictional. The display head is an original design.

## Documentation

How everything in the site was made is in [docs/](docs/README.md).
