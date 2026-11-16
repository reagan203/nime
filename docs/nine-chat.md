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
