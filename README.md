# Fitness

Installable web app (PWA) to browse exercises by muscle, build programs, log workouts and track progress.
Everything is stored in the browser (localStorage); no account, no server.

**On your phone**: open https://gauthierdesmaizieres-sketch.github.io/stamina/ and use "Add to Home screen". Every push to `main` redeploys it.

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # helper tests (node:test)
npm run build    # production build in dist/, with offline service worker
```

- **Week**: the weekly routine (lifting Mon–Tue–Thu–Fri, runs Wed + Sun, tendons 3×, stretching every day). Missed sessions move to free days: never legs the day before a run, tendons never two days in a row.
- **Exercises**: search and filter by muscle (dropdown or tap the body map) and equipment.
- **My gym**: tick the equipment your gym has; the list and the program builder only show exercises you can do there.
- **Exercise page**: photos, instructions, primary/secondary muscles on a body map, progress chart.
- **Programs**: add exercises with sets × reps, reorder, see the muscles the program works.
- **Workout**: log reps/kg per set; the draft survives a page reload. Each exercise is prefilled with a progression suggestion: +2.5 kg once every set reached the target reps (one more rep for bodyweight exercises), otherwise the same weight again.
- **Progress**: one chart per exercise with the best set of each session (kg, or reps for bodyweight).
- **History**: past workouts.

## Anime-style exercise images

`public/manga/<exercise>/<n>.webp` are the dataset photos redrawn as 90s shonen-anime characters (style only, no real characters).
The app shows them when they exist and falls back to the original photo otherwise.

They are generated locally on an NVIDIA GPU by [tools/manga/generate.py](tools/manga/generate.py)
(Stable Diffusion 1.5 anime model `Lykon/AnyLoRA` + Canny ControlNet to keep pose and equipment; about 5 GB of models on first run):

```bash
cd tools/manga
uv venv --python 3.12 .venv
uv pip install --python .venv/Scripts/python.exe torch --index-url https://download.pytorch.org/whl/cu124
uv pip install --python .venv/Scripts/python.exe diffusers transformers accelerate safetensors opencv-python-headless pillow rembg
.venv/Scripts/python.exe generate.py Pullups Barbell_Squat   # some exercises
.venv/Scripts/python.exe generate.py --all                    # all of them, skips images already done
.venv/Scripts/python.exe generate.py --category stretching --first --style soft   # Flexibility module: pastel, golden hair, gym cut out
.venv/Scripts/python.exe generate.py --all --skip-category stretching --style night --strength 0.9 --control 0.7   # other exercises: silver hair, dark night gym
```

## Credits
- Exercise data and photos: [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (Unlicense). `src/data/exercises.json` is a copy of `dist/exercises.json`; photos load from GitHub and are cached offline once seen.
- Body map: [react-body-highlighter](https://github.com/GV79/react-body-highlighter) (MIT).
