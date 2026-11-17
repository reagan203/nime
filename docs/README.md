# How the Ninth Mind website mock was made

This folder explains how everything in the site was built, so anyone can change it or make it again.

| Page | What it covers |
|---|---|
| [website.md](website.md) | The page itself: sections, where the words come from (the Sources switch), light and dark mode, phones and tablets |
| [nine-chat.md](nine-chat.md) | Nine's conversation: the questions, voice, waiting and dozing, and what happens to the answers |
| [nine-avatar.md](nine-avatar.md) | Nine on the page: the layers, the live screen face and everything it can show, following the pointer, actions, page reactions and the 360 turn |
| [making-nine.md](making-nine.md) | How Nine's images and video were produced with free models on a laptop, step by step, with commands |
| [pipeline-v3.md](pipeline-v3.md) | The v3 upgrade: curved head, neck fused into flesh, real fabric and skin, one-still 360 turntable and motion transfer; what the models can and cannot do |

## The short version

- The whole site is **one file**, `index.html`: HTML, CSS and JavaScript, no build step and no server code. Open it in a browser, or serve the folder with any static server (for example `python -m http.server`).
- Every statement about Ninth Mind comes from three company documents: the Service Portfolio (P), the AI Adoption Strategy (S, with section numbers) and the AI Transformation Journey Framework (F). The **Sources** button shows which document each line comes from. Nothing is invented: no made-up figures, clients or claims.
- **Nine** is the site's assistant. Visitors talk to Nine by tapping, typing or speaking. Nine is a photographic body in a navy suit with an original display head on a mechanical neck, generated and rendered with free, open models (see [making-nine.md](making-nine.md)).
- Images live in `assets/`; the scripts that made Nine are in `pipeline/`.
