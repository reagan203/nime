# The website

The page is `src/routes/index.tsx`, built from the components in `src/components/`. The styles are `src/styles/site.css`, carried over unchanged from the original mock (`legacy/mock.html`), so the class names in the components are the mock's. Content (services, levels, contact details) is data in `src/data/content.ts`. Nine is plain TypeScript in `src/nine/`, started once the page is in the browser (`bootNine()`), because she animates every frame and talks to the speech APIs directly.

Anything with a `data-talk` attribute opens Nine: `data-talk="level"`, `"train"`, `"project"`, `"quick"` or `"explore"` starts that conversation, and `data-voice` starts in voice mode.

## Sections, top to bottom

| Section | Id | What it shows |
|---|---|---|
| Hero | | "AI is not the answer. AI is the process.", the main buttons, and Nine |
| Band | | "Everyone is buying AI. Very few organisations are becoming AI-first." |
| Five levels of AI maturity | `#approach` | A ladder of the five levels; select a level to read what it looks like |
| Training | `#training` | Upskilling as the thread through every stage |
| Services | `#services` | Five service areas (Think, Build & Transform, Enable, Sustain, Innovate) as tiles, then cards with a details sheet for each service |
| The programme | `#programme` | Timeline, pipeline, rules, data classes and structures from the strategy document |
| MFI Group | `#mfi` | How Ninth Mind leads the AI journey within the MFI Group |
| Future plans | `#planned` | What is planned next |
| Contact | `#contact` | Talk to Nine, and the Managing Director's card with his photo (`public/assets/anup-tabe.webp`, initials if it fails to load) |
| Footer | | Address, email, website |

The services and levels are data (`STAGES`, `LEVELS` in `src/data/content.ts`), and the components build the tiles, cards and ladder from them. To change a service, edit its entry in `STAGES`.

## Sources switch

Every factual element carries a `data-src` attribute: `P` (Service Portfolio), `S §n` (AI Adoption Strategy, section n) or `F` (AI Transformation Journey Framework). The **Sources** button at the bottom left adds the class `show-src` to the page, and CSS then shows a small badge on each element. The legend explains the letters.

Rule for edits: a new statement needs a `data-src`, and it must come from one of the three documents.

## Light and dark mode

Colours are CSS variables (tokens) on `:root`, redefined under `[data-theme="dark"]`. The moon or sun button switches the theme and remembers the choice in `localStorage` (`nm-theme`). A tiny script at the very top applies the saved theme before the page draws, so it never flashes the wrong colours.

## Phones, tablets and laptops

The layout uses CSS grid with breakpoints at 820 px (tablet: one column, the menu becomes a button) and 560 px (phone: smaller header and type). Nine scales with the column; in the chat on a phone she shows head and shoulders above the conversation.

## Accessibility

- Buttons are real `<button>`s with labels; the chat is a dialog with `aria-modal` and returns focus where it came from when closed.
- `prefers-reduced-motion` turns off Nine's breathing, swaying, walking and the 360 turn.
- Voice is optional: everything can be typed or tapped.
