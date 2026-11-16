# Ninth Mind website, with Nine

The Ninth Mind website, built with **Bun**, **TanStack Start** (React, server rendering, server functions) and **Vite**. It looks exactly like the original single-file mock (kept in [legacy/mock.html](legacy/mock.html)) and adds what a real site needs:

- **Nine sends emails.** When a visitor says "send it", the summary goes to the team by email (Resend or any SMTP server), with the conversation attached, and the visitor can ask for a copy.
- **Nine takes "no" for an answer.** Every question can be skipped or declined, by tapping, typing or saying no, and Nine responds sensibly at each step (see [docs/nine-chat.md](docs/nine-chat.md#when-someone-says-no)).
- **Nine is client-facing.** She lives in the hero at the top of the page: she greets, pays attention and offers help. No slapstick, and she never falls asleep on a visitor.
- **Visitors can email the team directly** with the "Send us an email" form in the contact section, and reach the team members on their cards.
- **The Managing Director gets a website report by email**: visitors, where they came from, where on the page they spent their time, and what they did (enquiries, contact clicks, services read). It's first-party and cookie-free; see [Website report](#website-report).
- **Built to be found and fast.** Structured data, Open Graph cards, `robots.txt`, `sitemap.xml` and `llms.txt` (for AI assistants) come from the same content as the page. Fonts are self-hosted, Nine's image is in the server-rendered page, responses are Brotli-compressed, and the heavy 360 turn loads only when the browser is idle.

## Website report

`REPORT_FREQUENCY` (weekly by default, Monday 08:00 Nairobi time, for the week before) sends the report to `REPORT_TO` (the Managing Director's address by default). It goes through the same email service as Nine.

```sh
bun run report                              # send last week's report now
bun run report -- --days 30 --preview r.html   # write the last 30 days to a file instead
```

With `REPORT_KEY` set, `/api/report?key=…&days=7` shows the report in a browser. Visits are stored in `.data/analytics/`, one file per day; nothing personal is kept (a visitor is a hash with a salt that is deleted daily). "Do Not Track" and Global Privacy Control are respected.

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
REPORT_KEY=… BASE_URL=http://localhost:3000 bun tests/e2e/chat.e2e.ts   # conversations, the form and the report, in Chrome or Edge
```

## Where things are

| Path | What it is |
|---|---|
| `src/routes/` | The page (`index.tsx`) and the document shell (`__root.tsx`) |
| `src/components/` | The page's sections, the service sheet, and the chat's frame |
| `src/data/content.ts` | Services, maturity levels and contact details, each statement with its source |
| `src/nine/` | Nine: face, photo body and 360 turn, autopilot, conversation, language understanding |
| `src/server/` | The `sendLead` server function, email delivery, analytics storage and the website report |
| `src/analytics/` | The browser side of the analytics: what is measured and sent |
| `src/data/site.ts` | SEO: title, description, structured data and `llms.txt`, built from the content |
| `scripts/report.ts` | Send or preview the website report |
| `src/styles/site.css` | The mock's styles, unchanged, plus a short section for new features |
| `public/assets/` | Nine's images and the 360 turn frames, the logo and Anup Tabe's photo |
| `brand/` | The full-size logo (not served) |
| `pipeline/` | How Nine's images were made (run with `public` as the site folder) |
| `legacy/mock.html` | The original single-file mock, for reference |

How everything was made, and how Nine works, is in [docs/](docs/README.md).

The person in the body photo is AI-generated and fictional. The display head is an original design.
