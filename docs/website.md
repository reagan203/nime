# The website

`index.html` holds the whole site: styles in one `<style>` block at the top, the page in the middle, and the scripts at the end. There are no libraries, frameworks or build tools.

## Sections, top to bottom

| Section | Id | What it shows |
|---|---|---|
| Hero | | Nine's opening: who she is, the headline, her first line, a box to tell her about your organisation (with a microphone), what she understood so far, starting-point chips, and Nine herself |
| Band | | "Everyone is buying AI. Very few organisations are becoming AI-first." and the "Buying ChatGPT… won't transform an organisation" paragraph |
| Five levels of AI maturity | `#approach` | A ladder of the five levels; select a level to read what it looks like |
| Training | `#training` | Upskilling as the thread through every stage |
| Services | `#services` | Five service areas (Think, Build & Transform, Enable, Sustain, Innovate) as tiles, then cards with a details sheet for each service |
| The programme | `#programme` | Timeline, pipeline, rules, data classes and structures from the strategy document |
| MFI Group | `#mfi` | How Ninth Mind leads the AI journey within the MFI Group |
| Future plans | `#planned` | What is planned next |
| Contact | `#contact` | Talk to Nine, and the Managing Director's card (initials only, no photo) |
| Footer | | Address, email, website |

The services, levels and programme content are JavaScript data (`STAGES`, `LEVELS` and friends near the top of the script), and the page builds the tiles, cards and ladder from them. To change a service, edit its entry in `STAGES`.

## AI first

The site is built around Nine:

- **The hero is Nine talking.** A live dot and "Nine · Ninth Mind's AI assistant", the headline, then her first line in a speech bubble. As the visitor types in the box under it, Nine looks at the box, shows dots on her screen, and lists what she understood so far under it ("Nine understood: Healthcare · 400 staff · Spreadsheets and paper", from `Nine.peek`, which reads the sentence without storing anything).
- **Every section has an "Ask Nine" button** (`.nm-ask-nine`, with a tiny Nine screen) that starts the conversation for that section: find your level, plan training, find the service for a problem, how a programme would start, or interest in a future plan (`data-talk="level|train|need|quick"`).
- **Mini Nine comments on each section** as it comes into view ("Five levels. Want me to find yours?"), once per section, and a click on her starts that section's conversation (`SECTION_TALK`).

The page leads with Nine rather than with buttons. The hero box (`#heroAsk`) sends whatever the visitor types straight into Nine's conversation (`Nine.open({ text })`), and the chips under it are ready-made first messages (`data-ask`) or the level questions (`data-talk="level"`). Nine then learns about the organisation before asking for contact details: see [Nine's conversation](nine-chat.md).

## Where each statement comes from

Every factual element carries a `data-src` attribute: `P` (Service Portfolio), `S §n` (AI Adoption Strategy, section n) or `F` (AI Transformation Journey Framework). The attributes are not shown on the page (the Sources button was removed on 2026-11-17); they stay in the HTML as a record for whoever edits the copy.

Rule for edits: a new statement needs a `data-src`, and it must come from one of the three documents.

## The logo

The header, footer and chat use a lockup: the wave mark as an image (`assets/ninth-mind-mark.png`, cut from `assets/ninth-mind-logo.png`) and "NINTH MIND" plus the tagline as real text in Montserrat. In the original PNG the tagline is a twentieth of the image height, so at header size it was under 2 pixels tall and unreadable.

## Light and dark mode

Colours are CSS variables (tokens) on `:root`, redefined under `[data-theme="dark"]`. The moon or sun button, or asking Nine ("switch to dark mode"), switches the theme through `window.nmSetTheme(mode)` and remembers the choice in `localStorage` (`nm-theme`). A tiny script at the very top applies the saved theme before the page draws, so it never flashes the wrong colours.

## Phones, tablets and laptops

The layout uses CSS grid with breakpoints at 820 px (tablet: one column, the menu becomes a button) and 560 px (phone: smaller header and type). Nine scales with the column; in the chat on a phone she shows head and shoulders above the conversation.

## Accessibility

- Buttons are real `<button>`s with labels; the chat is a dialog with `aria-modal` and returns focus where it came from when closed.
- `prefers-reduced-motion` turns off Nine's breathing, swaying, walking and the 360 turn.
- Voice is optional: everything can be typed or tapped.
