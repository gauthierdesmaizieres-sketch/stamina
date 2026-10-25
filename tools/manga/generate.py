"""Redraw the exercise photos as 90s shonen-anime style characters, locally on the GPU.

Usage (from this folder, after setup in README.md):
    .venv/Scripts/python generate.py Pullups Barbell_Squat   # only these exercises
    .venv/Scripts/python generate.py --all                    # every exercise, skips images already done
    .venv/Scripts/python generate.py --category stretching --first --style soft   # Flexibility module

Writes public/manga/<exercise>/<n>.webp, which the app shows instead of the original photo.
Img2img keeps colours and composition; a Canny ControlNet keeps the pose and the equipment.
"""

import argparse
import json
import time
import urllib.request
from pathlib import Path

import cv2
import numpy as np
import torch
from diffusers import ControlNetModel, StableDiffusionControlNetImg2ImgPipeline, UniPCMultistepScheduler
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
OUT = ROOT / "public" / "manga"
CACHE = HERE / "cache"  # original photos, downloaded once
IMG_BASE = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/"

MODEL = "Lykon/AnyLoRA"
CONTROLNET = "lllyasviel/control_v11p_sd15_canny"
# Style only: generic 90s shonen look, never a named character or series.
STYLES = {
    "shonen": ("1990s shonen anime screencap, retro anime style, cel shading, bold black outlines, flat colors, "
               "muscular martial artist, spiky hair, intense determined expression, sweat, training in a gym, "
               "dynamic, masterpiece, best quality"),
    # Flexibility module ("C · Doux"): pastel, calm, long golden spiky hair. Still a generic character.
    "soft": ("1boy, long spiky upswept golden blonde hair, soft pastel anime illustration, "
             "clean thin lines, gentle cel shading, calm relaxed face, athletic man stretching, "
             "white t-shirt, dark grey shorts, plain light blue background, masterpiece, best quality"),
    # Main exercises: silver-haired young man, dark blue night gym (chosen 2026-10-24, "style B").
    "night": ("1man, young adult man, spiky silver white hair, sharp eyes, muscular, grey hoodie sleeves rolled, black shorts, "
              "modern tv anime screencap, 2010s shonen anime style, clean sharp lineart, cel shading, "
              "dark gym at night, blue moody lighting, weight racks and benches in background, "
              "sweat drops, effort, gritted teeth, masterpiece, best quality"),
}
SOFT_BG = (0xDC, 0xEA, 0xF5)  # illustration background of the Flexibility module
BG = {"soft": SOFT_BG, "night": (22, 30, 52)}  # person cut out onto this; "night" lets the model draw a dark gym
STYLE_NEGATIVE = {"night": ", white background, plain background, bright daylight, chibi, nsfw", "soft": ", blue hair, black hair, brown hair, dark hair, short hair, gym, window, wooden floor"}
NEGATIVE = ("photo, realistic, 3d render, blurry, lowres, deformed, bad anatomy, bad hands, extra limbs, "
            "extra fingers, missing limbs, text, watermark, signature, logo")


def photo(path):
    f = CACHE / path
    if not f.exists():
        f.parent.mkdir(parents=True, exist_ok=True)
        urllib.request.urlretrieve(IMG_BASE + path, f)
    img = Image.open(f).convert("RGB")
    # SD 1.5 works best around 512 px on the short side; sizes must be multiples of 8.
    s = 512 / min(img.size)
    return img.resize((round(img.width * s / 8) * 8, round(img.height * s / 8) * 8), Image.LANCZOS)


def cutout(img, session, bg):
    """Person on a plain background, so the photo's room (windows, floor) is not redrawn."""
    from rembg import remove
    mask = remove(img, session=session, only_mask=True)
    return Image.composite(img, Image.new("RGB", img.size, bg), mask)


def edges(img):
    e = cv2.Canny(np.array(img), 80, 160)
    return Image.fromarray(np.stack([e] * 3, axis=-1))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("ids", nargs="*", help="exercise ids (folder names); default: none unless --all")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--category", help="every exercise of this category, e.g. stretching")
    ap.add_argument("--skip-category", help="leave out this category, e.g. stretching")
    ap.add_argument("--first", action="store_true", help="only the first image of each exercise")
    ap.add_argument("--style", choices=STYLES, default="shonen")
    ap.add_argument("--force", action="store_true", help="redo images that already exist")
    ap.add_argument("--strength", type=float, default=0.75, help="how far to move away from the photo")
    ap.add_argument("--control", type=float, default=0.8, help="how strictly to follow the photo's outlines")
    ap.add_argument("--seed", type=int, default=7)
    args = ap.parse_args()

    exercises = json.loads((ROOT / "src" / "data" / "exercises.json").read_text(encoding="utf-8"))
    if args.category:
        exercises = [e for e in exercises if e["category"] == args.category]
    elif args.all:
        exercises = [e for e in exercises if e["category"] != args.skip_category]
    else:
        unknown = set(args.ids) - {e["id"] for e in exercises}
        if unknown or not args.ids:
            raise SystemExit(f"Unknown or missing ids: {sorted(unknown) or 'give ids or --all'}")
        exercises = [e for e in exercises if e["id"] in args.ids]
    todo = [p for e in exercises for p in e["images"][:1 if args.first else None]
            if args.force or not (OUT / Path(p).with_suffix(".webp")).exists()]
    print(f"{len(todo)} images to draw")
    if not todo:
        return

    controlnet = ControlNetModel.from_pretrained(CONTROLNET, torch_dtype=torch.float16)
    pipe = StableDiffusionControlNetImg2ImgPipeline.from_pretrained(
        MODEL, controlnet=controlnet, torch_dtype=torch.float16, safety_checker=None, requires_safety_checker=False)
    pipe.scheduler = UniPCMultistepScheduler.from_config(pipe.scheduler.config)
    pipe.to("cuda")
    pipe.set_progress_bar_config(disable=True)
    session = None
    if args.style in BG:
        from rembg import new_session
        session = new_session("u2net_human_seg")

    start = time.time()
    for i, path in enumerate(todo, 1):
        try:
            img = photo(path)
            # "night" keeps the photo's outlines: the cutout drops the barbell and the gym the model should redraw.
            ctrl = edges(img) if args.style == "night" else None
            if session:
                img = cutout(img, session, BG[args.style])
            ctrl = ctrl or edges(img)
        except OSError as err:  # a missing photo should not stop a multi-hour run
            print(f"skip {path}: {err}")
            continue
        # fp16 sometimes overflows and returns a black image: retry with the next seeds.
        for seed in range(args.seed, args.seed + 4):
            out = pipe(STYLES[args.style], negative_prompt=NEGATIVE + STYLE_NEGATIVE.get(args.style, ""), image=img, control_image=ctrl,
                       strength=args.strength, controlnet_conditioning_scale=args.control,
                       num_inference_steps=25, guidance_scale=7,
                       generator=torch.Generator("cuda").manual_seed(seed)).images[0]
            if np.asarray(out).mean() > 5:
                break
        else:
            print(f"skip {path}: black output on every seed")
            continue
        dest = OUT / Path(path).with_suffix(".webp")
        dest.parent.mkdir(parents=True, exist_ok=True)
        out.save(dest, "WEBP", quality=80)
        eta = (time.time() - start) / i * (len(todo) - i)
        print(f"[{i}/{len(todo)}] {dest.relative_to(ROOT)}  ~{eta / 60:.0f} min left", flush=True)


if __name__ == "__main__":
    main()
