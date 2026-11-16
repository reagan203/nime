# Ninth Mind website, with Nine

The Ninth Mind website, built with **Bun**, **TanStack Start** (React, server rendering, server functions) and **Vite**. It looks exactly like the original single-file mock (kept in [legacy/mock.html](legacy/mock.html)) and adds what a real site needs:

- **Nine sends emails.** When a visitor says "send it", the summary goes to the team by email (Resend or any SMTP server), with the conversation attached, and the visitor can ask for a copy.
- **Nine takes "no" for an answer.** Every question can be skipped or declined, by tapping, typing or saying no, and Nine responds sensibly at each step (see [docs/nine-chat.md](docs/nine-chat.md#when-someone-says-no)).
- **Nine is client-facing.** On the page she greets, pays attention and offers help that fits the section the visitor is reading. Clicking her starts that conversation.

## Run it

```sh
bun install
bun run dev          # http://localhost:3000
```

Production:

```sh
cp .env.example .env # then fill in RESEND_API_KEY or SMTP_*
bun run build
bun run start        # serves dist/ with server.ts on $PORT (default 3000)
```

Without an email service configured, development writes each email to `.data/outbox/` instead of sending it. Production refuses to pretend: it reports the failure to the visitor and offers retry or their own email app. Every lead is also appended to `.data/leads.jsonl`.

## Checks

```sh
bun run test         # unit tests: understanding answers (yes, no, commands), emails
bun run typecheck
BASE_URL=http://localhost:3000 bun tests/e2e/chat.e2e.ts   # full conversations in Chrome or Edge
```

## Where things are

| Path | What it is |
|---|---|
| `src/routes/` | The page (`index.tsx`) and the document shell (`__root.tsx`) |
| `src/components/` | The page's sections, the service sheet, and the chat's frame |
| `src/data/content.ts` | Services, maturity levels and contact details, each statement with its source |
| `src/nine/` | Nine: face, photo body and 360 turn, autopilot, conversation, language understanding |
| `src/server/` | The `sendLead` server function, validation, rate limit and email delivery |
| `src/styles/site.css` | The mock's styles, unchanged, plus a short section for new features |
| `public/assets/` | Nine's images and the 360 turn frames, and the logo |
| `pipeline/` | How Nine's images were made (run with `public` as the site folder) |
| `legacy/mock.html` | The original single-file mock, for reference |

How everything was made, and how Nine works, is in [docs/](docs/README.md).

The person in the body photo is AI-generated and fictional. The display head is an original design.
