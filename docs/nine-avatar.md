# Nine on the page

Nine appears three times, all from the same component (`Photo.mount` in `index.html`):

- **Hero Nine**, beside the headline;
- **Chat Nine**, in the full-screen conversation;
- **Mini Nine**, head and shoulders, who appears at the bottom of the screen once the hero scrolls away, glides after the pointer and opens the chat when clicked.

## The layers

Nine is not one picture. She is built from layers so that parts can move on their own:

| Layer | File | What it does |
|---|---|---|
| Body | `assets/nine/photo/body.webp` | The photographic body, cut out (transparent), breathing gently |
| Head | `assets/nine/photo/head.webp` | The display head and mechanical neck, turning, nodding and tilting around the neck ring |
| Face | live HTML | Eyes and a mouth mapped onto the glass |
| 360 turn | `assets/nine/turn/f000.webp` … | Video frames of a full turn, drawn on a canvas |

There is no frame or backdrop: Nine sits on the page's own background, with a soft blue glow behind her and a fade at the bottom.

### How the face sits on the glass

`assets/nine/photo/nine.json` records where the screen's four corners are in the head image. The script builds a CSS `matrix3d` (a perspective transform from a 400 × 272 box to those four corners) so the HTML face lines up with the glass at any size. The face uses `mix-blend-mode: screen`, so it glows like a real display, and faint scan lines on top.

## Following the pointer

- The eyes and head of every Nine track the pointer (`Faces` animation loop), and the head turns, tilts and leans toward it. When the pointer has been still for about nine seconds, Nine looks around on her own.
- The whole figure leans a little toward the pointer, in perspective, so she feels three-dimensional.
- Mini Nine glides along the bottom of the screen to wherever the pointer rests (a quarter of a second still, 90 px away or more), and winks when she gets there.
- While a gesture clip plays (wave, talk) the figure is a video frame and does not track the pointer; she picks it up again when the clip ends. A clip always hands back to the still, even if frames stop arriving, so Nine can never be left invisible.
- A click on an empty part of the page makes Nine look at that spot.

## Talking

- While Nine speaks (in the chat, or a speech bubble on the page), the LED mouth on her screen bounces with a syllable rhythm of its own, with short gaps between words, and small sound waves pulse out on both sides of it. Most browser voices send no word timings, so the rhythm doesn't wait for them; when they do arrive they add extra bounce.
- During the wave and talk clips her live screen stays on: `track_screen.py` (in `pipeline/`) finds the display in every clip frame and stores how far each corner moved (`screen` in the clip's manifest), and the player places the face on the display frame by frame (`is-clip`). So she keeps talking, blinking and showing pictures while she gestures.
- The clips fade out at the left and right edges like the bottom does, so a hand that reaches past the video's frame fades instead of ending in a hard line.

## The screen: faces and pictures

`Faces.show(face, kind, ms, arg)` puts something on Nine's display for `ms` milliseconds (0 keeps it until cleared). The kinds:

| Kind | Looks like | Used for |
|---|---|---|
| `heart`, `star`, `wink`, `wow`, `dizzy`, `question` | Heart eyes, star eyes, a wink, wide eyes, spiral eyes, a puzzled face | Moods and reactions |
| `loading`, `eq`, `dots`, `check` | Spinner, sound meter, typing dots, a tick | The chat |
| `num` | "LEVEL" and a number | Maturity levels |
| `chart`, `bolt`, `cap`, `shield`, `flask` | The five service areas: Advise, Build, Train, Govern, Research | Hovering a service |
| `services` | The five symbols in turn | Juggling |
| `idea`, `clock`, `music`, `battery`, `sun`, `moon`, `matrix`, `logo` | Light bulb, clock, notes, charging battery, sun, moon, scrolling code, "NINTH MIND" | Actions and page events |
| `text` | Any short text, for example "Morning!" | Greetings |
| `glitch` | The face jitters for a moment | Hiccups and sneezes |

To add one, write a function in the `SHOW` table that returns SVG drawn in a 400 × 272 box (stroke and fill `currentColor`), and add its name to `SCREENS` if Nine may show it at random.

## Actions

The site asks Nine for actions with `nine.act(name, ms)`, and the same names drive every Nine. Because the photo body cannot bend, each action becomes a head movement (`MOVES`) and often a picture on the screen (`SCREEN_FOR`):

| Action | Head | Screen |
|---|---|---|
| wave, celebrate | Friendly tilt | celebrate: star eyes |
| nod, bow, tap | Nod | bow: heart; tap: dots |
| think, listen | Tilt one way or the other, held | |
| talk | Small bobs while speaking | Moving mouth |
| shrug | Shoulders and head lift | `?` |
| dance, juggle | Sway | music; the five services |
| jump, hiccup, kick | Hop | wow; glitch |
| sneeze, trip | Jerk | glitch; dizzy |
| stretch, yawn | Roll | battery |
| watch | Looks down | clock |
| spin | The full 360 turn | dizzy afterwards, sometimes |

Poses: `stand`, `sit` (head lowered, relaxed) and `sleep` (head drooped, screen dimmed, "Zzz").

The **autopilot** (`autopilot()`) picks random actions every few seconds while Nine is on screen, puts random pictures on the screen, sits her down after 20 seconds without activity and puts her to sleep after 45. Any movement wakes her.

## Nine reacts to the page

| The visitor… | Nine… |
|---|---|
| arrives | waves, says "Morning!", "Afternoon!" or "Evening!" on her screen, then shows off a full turn |
| hovers a service area or card | shows that area's symbol |
| hovers a maturity level | shows its number |
| switches light or dark mode | shows a sun or a moon |
| copies text | shows a tick and says "Copied!" |
| scrolls very fast | goes dizzy |
| comes back to the tab | shows "Hi again!" and waves |
| clicks somewhere empty | looks there, sometimes wide-eyed |
| rests the pointer on her | shows heart eyes |
| drags her sideways | spins her round (see below) |

## The 360 turn

The turn is 161 frames, rendered with a video model and cut out frame by frame (see [making-nine.md](making-nine.md)). The site loads the frames after the page has loaded, then:

- plays the turn once after the welcome wave, and now and then as a random action;
- lets visitors **drag Nine sideways to spin her by hand** (one width of drag is about one full turn). Let go and she finishes the turn and faces you again. A drag never opens the chat; a plain click still does.

While the turn plays, the photo layers fade out and the canvas fades in; when she faces front again they swap back and the live face returns.
