# Nine's conversation

Nine is a scripted assistant, not a language model: every line Nine says is written in the page, and it comes from the company documents. That keeps Nine accurate and predictable.

## Opening the chat

Any element with `data-talk` opens Nine (`Nine.open()`): the "Talk to Nine" buttons, Nine herself, and the "Ask Nine" buttons in each section. The value picks where the conversation starts (`FLOWS`): `level` (the level questions), `train` (training), `need` ("what would you like AI to help with?"), `explore` (the services) or `quick` (a message). Without a value Nine shows her start menu. `data-voice` starts in voice mode. The chat covers the screen and shows one line at a time, in the style of a spoken conversation.

## What Nine asks

The start menu offers five routes:

| Route | What happens |
|---|---|
| Start an AI project | What the visitor needs, which service fits, then name, organisation, the questions about the organisation (below), email and any notes |
| Find our AI maturity level | Where the organisation is today on the five levels, where it should be in 12 months, and what that move involves |
| Train my team | Who needs training, a shorter set of questions about the organisation, then the details |
| Explore the services | The five areas and their services, read out one by one; any of them can turn into a project |
| Leave a quick message | Just the contact details and the message |

Answers can be tapped from the options, typed, or spoken. Typed and spoken answers are matched to the options by keywords (`matchOption`), so "we use ChatGPT a bit" finds the right level. If Nine doesn't understand twice, it takes the answer as written.

Visitors can also start from the hero box on the page: whatever they type there becomes their first answer.

## Getting to know the organisation

Before asking for contact details, Nine learns as much as she can about the organisation, so the team's first call starts in the right place. Every question has a "Skip this one" option.

| Question | Notes |
|---|---|
| Industry | Twelve industries (`INDUSTRIES`). If the organisation's name or anything the visitor typed gives it away ("Upendo Microfinance", "we're a lender"), Nine asks "It sounds like … is in microfinance. Is that right?" instead |
| Size | Bands from fewer than 20 to more than 2,000 people |
| Where the time goes | Several choices, and the list depends on the industry (loan appraisal and collections for microfinance, patient records for healthcare…) |
| What the work runs on | Several choices: spreadsheets, Microsoft 365, an ERP, a CRM, a core banking system… |
| AI today | From "not at all yet" to "part of how we work" |
| Information involved | Several choices: personal details, financial, health, children's records, internal documents |
| Role and budget | The visitor's role, and whether money is approved, planned or being sought |

Training enquiries skip the time, systems and information questions.

Nine also picks things up in passing (`glean`): "we have 300 staff and use Excel and Musoni" fills in the size and the systems, so she doesn't ask them again. Then she reads back the picture ("So here's the picture. Upendo Microfinance is in microfinance, with 300 staff. Most of the time goes into…"). If sensitive records are involved she says the team will look at private, on-premise options; if they're looking for funding she mentions the grant support. Everything goes into the summary, and "About the organisation" in the edit menu asks it all again.

## Asking Nine to do things

At any point (except while typing an email, message or notes) the visitor can ask:

| Say or type | What happens |
|---|---|
| "Switch to dark mode", "light mode", "change the theme" | The site's theme changes |
| "Be more formal", "be brief", "be playful", "be friendly" | Nine's tone: her acknowledgements, how chatty she is, and her voice's speed and pitch. Remembered (`nm-tone`) |
| "Speak slower", "speak faster" | Voice speed |
| "Be quiet", "speak out loud" | Turns the voice off or on |
| "Take me to services" (approach, how you work, training, contact, MFI, plans, top) | Closes the chat and scrolls there |
| "Start over", "help" | A new conversation, or the list of things she can do |

After a command Nine asks the question she was on again (`commandFor`, `resume`).

At the end Nine reads back a summary that the visitor can edit, then thanks them and gives the Managing Director's email.

**In this mock, the answers stay in the browser.** Nothing is sent anywhere. Connecting the summary to email or a CRM is the next step for a live site.

## Voice

- Nine speaks with the browser's built-in speech (`speechSynthesis`), choosing a natural English voice where one exists. The sound button turns it off, and the choice is remembered (`nm-voice`).
- Visitors can answer by voice with the browser's speech recognition (Chrome and Edge). If the microphone is blocked, Nine says so and the visitor types instead.
- While Nine speaks, the mouth on the screen moves with the words.

## Waiting

If the visitor goes quiet, Nine taps her foot at 12 seconds, sits down at 25 and dozes off at 50 ("Zzz… type or tap anything to wake Nine"). Typing or tapping wakes her up with a stretch.

## What Nine's screen does in the chat

| Moment | Screen |
|---|---|
| Thinking | A spinning loader |
| Listening to the microphone | A sound meter |
| An answer is taken | A tick, and a nod |
| Not understood | A puzzled face with a "?" |
| Talking about maturity levels | The target level number |
| Finished | Heart eyes |
