# CLAUDE.md

User speaks French; answer in French. See README.md for stack, commands and image generator.

## Design
Two lights in `src/style.css`: night (default: midnight blue of the manga images + the icon's red, slanted panels) and morning (`.soft`, the "C · Doux" pastel; `:root:has(.soft)` swaps the tokens). Type: Sofia Sans + Sofia Sans Extra Condensed italic. Signature: the slanted stamina `Gauge`. Page changes use the View Transitions API (`useHash`).

## Code map
- React 19 + Vite PWA, no backend. Everything in `src/App.jsx` (one component per page) + helpers in `src/lib.js` (tested in `src/lib.test.js`, `npm test`).
- Routing: hash routes (`#/programs`, ...) parsed in App.jsx; `TABS` in App.jsx is the nav (`#/` Today, `#/exercises`, ...). Persistence: `useStored(key, initial)` hook → localStorage.
- Data: `src/data/exercises.json` (free-exercise-db). Fields: name, level (beginner/intermediate/expert), category, equipment, primaryMuscles, secondaryMuscles, instructions, images.
- Anime images: `public/manga/<exercise id>/<n>.webp`, made by `tools/manga/generate.py` (SD1.5 + ControlNet Canny). App falls back to dataset photo.
  Known issue: generated poses can be wrong (`Plank/0.webp` shows a kneeling man, not a plank) — always look at each generated image before shipping it.

## Current project: "Souplesse" module (branch `feat/souplesse`)
Decided with the user (2026-10-21):
- Integrate into this app as a module (new tab), NOT a separate app. Calisthenics module comes later, same approach.
- Sessions of 5–10 min. 3 difficulty levels. Images only, no video.
- Chrono per stretch, auto-advance to next, short rest between, beep/vibration.
- Pick by body part (hips, hamstrings, back, shoulders, neck, ...) ≈ 5 min, plus a "Full body" ≈ 10 min.
- Source: dataset already has 123 stretches (`category === 'stretching'`): 82 beginner, 29 intermediate, 12 expert, all muscle groups covered. Reuse them first; map level → 3 difficulty levels.
- Design: inspired by the Bend app (simple, clean). Chosen style = "C · Doux": soft pastel (bg #EEF3F8, illustration bg #DCEAF5, accent #8DB8DE, text #2E3A4B), rounded corners (~18px), circular progress ring chrono in the middle, level shown as 3 dots.
- Character: same soft style but with long golden spiky hair "Super Saiyan"-like (style only, no real/licensed character).
- Market gap to target (from reviews of Bend, STRETCHIT, pliability, GOWOD): real free tier, true beginner path, short sessions.

## Later (not now)
- 2 images per pose when one isn't clear.
- Arrows on the image for the direction to lean/move.
- Highlight the stretched muscle (reuse the body map `react-body-highlighter` like exercise pages).
- Calisthenics module: user will give a YouTube channel of tutorial shorts; plan = yt-dlp + ffmpeg keyframes → Claude reads frames → written step-by-step cards + progressions (own wording, credit the creator).
