# Nine's conversation

Nine is a scripted assistant, not a language model: every line Nine says is written in the page, and it comes from the company documents. That keeps Nine accurate and predictable.

## Opening the chat

Any element with `data-talk` opens Nine (`Nine.open()`): the "Talk to Nine" buttons, Nine herself, and "Find your level with Nine" (`data-talk="level"` jumps straight to the level questions). `data-voice` starts in voice mode. The chat covers the screen and shows one line at a time, in the style of a spoken conversation.

## What Nine asks

The start menu offers five routes:

| Route | What happens |
|---|---|
| Start an AI project | What the visitor needs, which service fits, then name, organisation, email and any notes |
| Find our AI maturity level | Where the organisation is today on the five levels, where it should be in 12 months, and what that move involves |
| Train my team | Who needs training, then the details |
| Explore the services | The five areas and their services, read out one by one; any of them can turn into a project |
| Leave a quick message | Just the contact details and the message |

Answers can be tapped from the options, typed, or spoken. Typed and spoken answers are matched to the options by keywords (`matchOption`), so "we use ChatGPT a bit" finds the right level. If Nine doesn't understand twice, it takes the answer as written.

At the end Nine reads back a summary that the visitor can edit, send, send with a copy to themselves, or not send. Then she thanks them, gives the reference number and the Managing Director's email.

The understanding lives in `src/nine/understand.ts` (pure functions, unit tested) and the conversation in `src/nine/chat.ts`.

## When someone says no

"No", "nope", "no thanks", "I'd rather not", "skip", "not interested", "don't send it" and the like are understood at every question, typed, spoken or tapped (many questions also show a "rather not" option). "Not sure" is different from no: where it matters, Nine helps choose instead.

| Question | If the visitor says no |
|---|---|
| Where shall we start? | "No problem at all. I'll be around if you change your mind." Offers to close, or to talk after all |
| Name | Stays anonymous: "That's fine, you don't have to tell me." |
| Organisation | Noted as asking for themselves |
| What they need | Strategy and readiness is noted as the starting point |
| Situation, timing, notes | Skipped |
| Email | Explains the team can read but not reply, then offers: a phone or WhatsApp number instead, sending without contact details, or not sending anything |
| Phone | Send without contact details, or not at all |
| The summary | "Okay, I won't send it. Nothing has left this page." Then: change something, send after all, discard (clears everything) or close |
| Plan it / talk about it | Fine; offers the services, the start, or closing |
| Anything else? | Says goodbye and closes |

Three refusals in a row and Nine stops asking: she checks in ("If now isn't the right moment, that's completely fine") and offers to carry on skipping, a person to talk to, closing, or starting over. Saying bye before sending is safe: Nine confirms nothing has left the page.

## Commands that work anywhere

"start over", "go back", "help", "say that again", "mute" / "unmute", "bye", and "talk to a person" (which shows the Managing Director's email, phone and WhatsApp, and offers to leave him a message). Number keys pick an option when the answer box is empty.

## Sending

"Send it" calls the `sendLead` server function (`src/server/lead.ts`). It validates the answers (`lead-schema.ts`), ignores bots (a hidden honeypot field, or a conversation under three seconds), limits each address to five sends in ten minutes, records the lead in `.data/leads.jsonl`, and emails the team with the summary and the conversation (`mailer.ts`). The visitor's email is the Reply-To, so the team can answer directly. If the visitor asked, they get a copy.

Email goes through Resend (`RESEND_API_KEY`) or any SMTP server (`SMTP_HOST` and friends); see `.env.example`. In development without either, emails are written to `.data/outbox/`. In production without either, sending fails honestly.

While sending, Nine's screen shows an envelope flying off; then a sent envelope and heart eyes. If sending fails, she shows an error, says nothing is lost, and offers to try again, to open the visitor's own email app with everything filled in, or to close.

## Voice

- Nine speaks with the browser's built-in speech (`speechSynthesis`), choosing a natural English voice where one exists. The sound button turns it off, and the choice is remembered (`nm-voice`).
- Visitors can answer by voice with the browser's speech recognition (Chrome and Edge). If the microphone is blocked, Nine says so and the visitor types instead.
- While Nine speaks, the mouth on the screen moves with the words.

## Waiting

If the visitor goes quiet, Nine taps her foot at 12 seconds and sits down at 25 ("Take your time. I'll wait."). At 50 seconds she offers help instead of falling asleep ("Not sure what to say? Type "help", or tap an answer."). Typing or tapping brings her back up. While the visitor types, Nine's face listens.

## What Nine's screen does in the chat

| Moment | Screen |
|---|---|
| Thinking | A spinning loader |
| Listening to the microphone | A sound meter |
| An answer is taken | A tick, and a nod |
| Not understood | A puzzled face with a "?" |
| Talking about maturity levels | The target level number |
| Finished | Heart eyes |
