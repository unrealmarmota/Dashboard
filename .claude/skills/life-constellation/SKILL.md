---
name: life-constellation
description: Makes a vertical 1080x1920 video of a whole life told as lines of light. Every person is a glowing line climbing a starry sky with the user's age, people join and leave, the ones who die rise and become stars, and at the end the stars join into a constellation. Rendered with HyperFrames, no music. Use when the user says "make a life constellation", "Lebens-Sternbild" or asks for this life-in-lines-of-light video, usually followed by a list of names.
---

# Life Constellation

A ~131 s vertical video (1080x1920, 30 fps, silent) rendered from one HTML canvas with
[HyperFrames](https://hyperframes.heygen.com). The user adds the song later in Instagram.

Everything lives in this skill folder:

| File | What it is |
|---|---|
| `template/cast.js` | The story: people, colours, what happens when, star spots, texts, clock speeds, ending timing. **The only file you edit per life.** |
| `template/sky.js` | The renderer. One canvas, every frame a pure function of `t`, drawn on HyperFrames' `hf-seek`. |
| `template/index.html` | The HyperFrames composition (canvas root, `data-no-timeline`). |
| `template/fonts/` | Inter + Cormorant Garamond (OFL), loaded locally so renders don't depend on the network. |
| `scripts/new-project.sh <dir> [cast.js]` | `npx hyperframes init`, copies the template in, builds the clock. Keeps an existing `cast.js` unless one is passed. |
| `scripts/clock.mjs <dir>` | Writes `clock.js` (age every 0.1 s), `events.json` (every event's second) and syncs `data-duration`. Prints the event table. |
| `scripts/check-layout.mjs <dir>` | Checks every 0.1 s: name on name, name on a star or a head, text cut off. Exit 1 lists the time ranges. |
| `scripts/snapshots.sh <dir> [out]` | `hyperframes snapshot` at every event + contact sheets + `index.tsv` (frame → event). |
| `scripts/preview.mjs <dir> [out.html]` | One self-contained player page (fonts inlined) with a jump list of the moments. |

Speak the user's language throughout. Work in phases and **stop where it says STOP**.

## Setup

1. `node -v`, `ffmpeg -version`. Install only what is missing, and **say what you will install before you do it**.
2. HyperFrames needs no install (`npx hyperframes`). If it asks, `npx hyperframes telemetry disable` is fine.
3. Pick a project folder outside the repo (scratchpad, or `~/life-constellation-<name>` on the user's machine).

## 1. The cast — STOP for approval

Ask who is in the story and in which language the names (and the on-screen texts) should be.
If they don't want real people, use the default cast already in `template/cast.js`
(translate the names): Grandma, Grandpa, Mom, Dad, Me, Kindergarten friend, Grade school friend,
Childhood friend, Middle school friend, First love, High school friend, College friend, Coworker, Wife, Son.

For each person decide the name on screen, a colour and what happens:

- **FAMILY** – there before I'm born (`type: "family"`, path starts before age 0).
- **JOINS** – arrives at age X and stays (`type: "joins"`, `from: X`, `enter: "left" | "right" | "<parent id>"`). A child branches out of a parent's line: first path keyframe `[X, "<parent id>"]`.
- **CROSSES** – passes through at age X, gone a second later (`type: "crosses"`, `at: X`, `dir: 1 | -1`).
- **LEAVES** – moves away at age X: `end: { leaves: X, side: "left" | "right" }`.
- **BECOMES A STAR** – dies at age X: `end: { star: X, bend: -1 | 1, sky: [x, y] }`.

Show a table **name | colour | from age | to age | what happens** plus the constellation order and the
on-screen texts (axis word, title, subtitle). Wait for "ok".

Casting rules that keep the picture clean:
- Every person in `constellation` except "me" must become a star *before* "me" (age 85).
- Keep living lines ≥ 120 px apart in x; never let two lines swap sides (they'd cross). Move people
  sideways *before* someone arrives between them.
- Leave x < 110 for the age axis; people who join or leave on the left edge may pass through it.
- Default order of the constellation: me → partner → mother → grandmother → grandfather → father → me.
  Place the `sky` spots as a loop around the top half, me at the bottom (I become a star where I stand),
  and keep the child's late-life x clear of every star, because the child keeps climbing in the ending.
- Names longer than ~20 characters get hard to read on a crosser: suggest a shorter one.

## 2. The clock

`cast.clock` holds relative speeds (years per second) by age: slow childhood, fast quiet middle years,
slow again near the end. `clock.mjs` scales them so birth lands at `birthAt` (2 s) and `endAge` (85)
at `lifeEnd` (116 s), and writes the table of ages every 0.1 s. Events then sit on exact seconds.
Move a speed keyframe if two events land too close (< 2 s apart) or a stretch feels empty.

## 3. The sky

Already built into `sky.js`; tune it, don't rewrite it. What it does:
- Pure function of time. No timers, no `requestAnimationFrame`, no unseeded random (mulberry32).
  Listens to `hf-seek` and registers fonts on `window.__hf.buildReady`.
- Navy gradient, soft purple nebulae, 500 seeded stars. Now line at 52 % of the height, age axis on
  the left (tick every 5 years, current age in yellow, axis word top left).
- 80 px = 1 year; each person is a path in (age, x) drawn at `y = nowY + (currentAge − age) × 80`,
  fading out in the bottom 25 %. Three passes per line (wide glow, medium glow, 3 px core).
- Head = white glowing dot, name above it (crossers: below, dimmer, trail fades a few seconds later).
  Names never sit on another name, a head or a star: small overlaps slide sideways, big ones move a
  line out (with a thin leader line). Placement is averaged over the last 0.3 s so names glide.
- Family drifts in S-curves between keyframes plus a small sine wobble. Crossers take 3 s across.
- Star: line bends sideways and stops, a spark with a dotted tail rises to `sky` in 1.5 s, a ring
  flashes, a 4-point star with its name stays.

## 4. The ending

From `lifeEnd`: my head flares with a big warm bloom and becomes the biggest star where I stand;
axis and old lines fade out; the child keeps climbing past the now line; the constellation lines
draw one by one (they stop short of the stars and skip around names); at 75 % height the title in
Cormorant Garamond, a thin rule and the italic subtitle fade in; 1.2 s fade to black.
Timing lives in `cast.ending`.

## 5. Check — STOP for approval

```bash
bash scripts/new-project.sh <dir> <cast.js>      # after every cast change (re-copies sky.js too)
node scripts/check-layout.mjs <dir>               # must print "layout OK"
bash scripts/snapshots.sh <dir>                   # frames + contact sheets in <dir>/snapshots
(cd <dir> && npx hyperframes check)               # lint/runtime must be clean
```

Look at **every** contact sheet yourself before showing anything: names overlapping, text cut off,
a star hidden behind a name, lines crossing that shouldn't, a spark flying through a name, the
child's line touching the closing text. Fix (usually in `cast.js`: x keyframes, `sky` spots, clock
speeds) and check again, **at most 3 rounds**. Then show the user the contact sheets and a preview link:

```bash
node scripts/preview.mjs <dir> <scratchpad>/life-constellation-preview.html
```

Publish that file as an Artifact if the Artifact tool is available (icon "star"); otherwise run
`npx hyperframes preview --background` in the project and give the local Studio link.
Wait for "render" or changes. On changes: edit, re-run this phase.

## 6. Render

```bash
cd <dir> && npx hyperframes render --fps 30 --quality delivery --output renders/life-constellation.mp4
ffprobe -v error -show_entries format=duration:stream=width,height,r_frame_rate,codec_type -of compact renders/life-constellation.mp4
```

Verify: 1080x1920, 30/1 fps, duration = `duration` from `events.json` (±0.1 s), **no audio stream**.
Hand over the MP4 path and say the length. No music: the user adds the song from Instagram's library.
