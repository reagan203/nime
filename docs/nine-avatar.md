# Nine on the page

Nine appears twice, both from the same code (`mountPhoto` in `src/nine/photo.ts`):

- **Hero Nine**, beside the headline;
- **Chat Nine**, in the full-screen conversation;
- (Mini Nine, who used to follow visitors along the bottom of the page, has been removed: Nine stays at the top.)

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

- The eyes and head of every Nine track the pointer (`Faces` animation loop), and the head turns, tilts and leans toward it. When the pointer has been still for a few seconds, Nine looks around on her own.
- The whole figure leans a little toward the pointer, in perspective, so she feels three-dimensional.
- A click on an empty part of the page makes Nine look at that spot.

## The screen: faces and pictures

`Faces.show(face, kind, ms, arg)` (in `src/nine/faces.ts`) puts something on Nine's display for `ms` milliseconds (0 keeps it until cleared). The kinds:

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
| spin | The full 360 turn | |

Poses: `stand`, `sit` (head lowered, relaxed) and `sleep` (head drooped, screen dimmed, "Zzz").

### Client-facing

On the page Nine behaves like a good receptionist, not a mascot. The **autopilot** (`src/nine/autopilot.ts`) has her look around, nod, think, point, now and then quote the company's own lines, show the company logo or a service area on her screen, and, rarely, turn. There is no tripping, sneezing, hiccupping or dancing, and she doesn't go dizzy. After 30 seconds without activity she sits and says "I'm here whenever you need me"; she never falls asleep on the page. Hovering her brings an offer of help ("Can I help you find the right service?").

Screens added in the rebuild: `mail` (an envelope flying off), `sent`, `ok`, `sad`, `bye` (a waving hand), `shh` (muted), `phone`, `error`. Actions added: `decline` (shake, OK), `goodbye` (wave, Bye!), `send` (nod, envelope), `sorry` (looks down, sad face).

## Nine reacts to the page

| The visitor… | Nine… |
|---|---|
| arrives | waves, says "Good morning", "Good afternoon" or "Good evening" on her screen, then shows off a full turn |
| hovers a service area or card | shows that area's symbol |
| hovers a maturity level | shows its number |
| switches light or dark mode | shows a sun or a moon |
| copies text | shows a tick and says "Copied!" |
| comes back to the tab | shows "Welcome back" and waves |
| loses or regains the connection | shows an error and "We're offline. I'll wait.", then a tick |
| clicks somewhere empty | looks there |
| drags her sideways | spins her round (see below) |

## The 360 turn

The turn is 161 frames, rendered with a video model and cut out frame by frame (see [making-nine.md](making-nine.md)). The site loads the frames after the page has loaded, then:

- plays the turn once after the welcome wave, and now and then as a random action;
- lets visitors **drag Nine sideways to spin her by hand** (one width of drag is about one full turn). Let go and she finishes the turn and faces you again. A drag never opens the chat; a plain click still does.

While the turn plays, the photo layers fade out and the canvas fades in; when she faces front again they swap back and the live face returns.
