# The website

`index.html` holds the whole site: styles in one `<style>` block at the top, the page in the middle, and the scripts at the end. There are no libraries, frameworks or build tools.

## Sections, top to bottom

| Section | Id | What it shows |
|---|---|---|
| Hero | | "AI is not the answer. AI is the process.", a box to tell Nine about your organisation (with a microphone button), starting-point chips, and Nine |
| Band | | "Everyone is buying AI. Very few organisations are becoming AI-first." |
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
