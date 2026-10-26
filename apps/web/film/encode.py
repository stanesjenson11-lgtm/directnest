"""Encodes the villa film's rendered frames into the home page's films and posters (needs ffmpeg on PATH).

  python apps/web/film/encode.py [--draft]

Every file a browser downloads stays under its byte budget (BUDGET, MB): each is encoded at a starting quality and
re-encoded a notch lower until it fits, so the page loads fast on a phone over 4G.
Desktop: HEVC, AV1 and H.264, in the order Tour.tsx tries them. Phones: a 9:16 cut whose centre follows the subject
(shots.py CROP; Tour.tsx moves the hotspots with it): HEVC at the cut's full 608x1080 for iPhones, H.264 for the rest.
RIFE (on the GPU) draws the in-between frames up to 60 fps; across a cut between shots it would blend the two, so
there each in-between frame is replaced by the nearest real one.
Works on a partial render too: each rendered frame is held until the next one.
"""
import glob
import os
import shutil
import subprocess
import sys
import tempfile

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import shots  # noqa: E402

ROOT = os.path.join(os.environ.get("LOCALAPPDATA", os.path.expanduser("~")), "gharaana-villa")
SRC = os.path.join(ROOT, "frames-draft" if "--draft" in sys.argv else "frames-1080")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "tour")
CLEAN = "hqdn3d=1:1:4:4"  # a very light temporal denoise: takes the render's leftover grain, keeps the detail
# the grade: a little less contrast, colours that pop (vibrance, the sky's blues and cyans pushed), a cool sky lift
GRADE = ("eq=contrast=0.94:brightness=0.005:gamma=1.02:saturation=1.06,vibrance=intensity=0.35,"
         "huesaturation=saturation=0.4:colors=c+b:strength=3,colorbalance=bh=0.04:rh=-0.01")
SHARP = "cas=strength=0.5"  # contrast-adaptive sharpening, after any scaling
FPS_OUT = 60
BUDGET = {"film-1080-hevc.mp4": 8.0, "film-1080-av1.mp4": 9.5, "film-1080.mp4": 9.5,
          "film-phone-hevc.mp4": 3.5, "film-phone.mp4": 3.5}
CUTS = [s[1] for s in shots.SHOTS[1:]]  # film seconds where one shot cuts to the next
RIFE = (glob.glob(os.path.join(os.path.dirname(ROOT), "gharaana-film", "rife", "*", "rife-ncnn-vulkan.exe")) or [None])[0]


def gop(fps, every):
    return ["-r", str(fps), "-g", str(every), "-keyint_min", str(every), "-sc_threshold", "0", "-movflags", "+faststart",
            "-an", "-pix_fmt", "yuv420p"]


def phone_x():
    """ffmpeg expression for the phone cut's left edge (px of 1920) at time t: shots.CROP, eased as path.pw eases."""
    rows = shots.CROP
    expr = f"{rows[-1][1]}"
    for (t0, v0), (t1, v1) in reversed(list(zip(rows, rows[1:]))):
        if t1 <= t0:
            continue
        k = f"((t-{t0})/{t1 - t0})"
        expr = f"if(lt(t,{t1}),{v0}+({v1 - v0})*{k}*{k}*(3-2*{k}),{expr})"
    return f"min(max(({expr})*1920-304,0),1312)"


PHONE = f"crop=608:1080:'{phone_x()}':0"


def ffmpeg(*args):
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *args], check=True)


def fit(name, crf, encode):
    """Encodes at crf, then a notch lower until the file is under its budget."""
    path = os.path.join(OUT, name)
    for _ in range(8):
        encode(crf, path)
        mb = os.path.getsize(path) / 1e6
        if mb <= BUDGET[name]:
            print(f"{name}: {mb:.2f} MB (crf {crf})", flush=True)
            return
        crf += 2
    raise SystemExit(f"{name} is still {mb:.2f} MB, over its {BUDGET[name]} MB budget")


def no_blend_at_cuts(folder, n_src):
    """RIFE's frames between the last frame of one shot and the first of the next blend the two: hold the nearest real
    frame instead."""
    files = sorted(os.listdir(folder))
    for cut in CUTS:
        ta, tb = cut - 1 / shots.FPS, cut  # the last frame of the shot before, the first of the next
        if tb * shots.FPS >= n_src:
            continue
        for j, f in enumerate(files):
            t = j / FPS_OUT
            if ta < t < tb:
                k = int(ta * FPS_OUT) if t - ta < tb - t else min(len(files) - 1, int(-(-tb * FPS_OUT // 1)))
                shutil.copyfile(os.path.join(folder, files[k]), os.path.join(folder, f))


# our frames are f0001.png; the farm's download names them its own way: the frame is the number in the name
rendered = {int("".join(c for c in f if c.isdigit())): f for f in os.listdir(SRC) if f.endswith(".png") and any(c.isdigit() for c in f)}
os.makedirs(OUT, exist_ok=True)
with tempfile.TemporaryDirectory(dir=ROOT) as seq:  # same drive as the frames, so hard links work
    last = None
    for n in range(1, max(rendered) + 1):
        last = rendered.get(n, last)
        os.link(os.path.join(SRC, last), os.path.join(seq, f"{n:04d}.png"))
    print(f"{len(rendered)} of {max(rendered)} frames rendered", flush=True)
    frames = ["-framerate", "24", "-i", os.path.join(seq, "%04d.png")]
    if RIFE:  # 24 -> 60 fps, same length: n = (frames - 1) * 60 / 24 + 1
        smooth = os.path.join(ROOT, "frames-60")
        shutil.rmtree(smooth, ignore_errors=True)
        os.makedirs(smooth)
        n = (max(rendered) - 1) * FPS_OUT // 24 + 1
        subprocess.run([RIFE, "-i", seq, "-o", smooth, "-m", "rife-v4.6", "-n", str(n), "-f", "%05d.png"], check=True,
                       cwd=os.path.dirname(RIFE), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        no_blend_at_cuts(smooth, max(rendered))
        frames = ["-framerate", str(FPS_OUT), "-i", os.path.join(smooth, "%05d.png")]
    DESK = f"{CLEAN},{GRADE},scale=1920:1080:flags=lanczos,{SHARP}"
    CUT = f"{CLEAN},{GRADE},scale=1920:1080:flags=lanczos,{PHONE},{SHARP}"  # (the cut is measured on a 1080p frame)
    x265 = ["-c:v", "libx265", "-preset", "slow", "-tag:v", "hvc1", "-x265-params", "log-level=error"]
    fit("film-1080-hevc.mp4", 28, lambda crf, p: ffmpeg(*frames, "-vf", DESK, "-crf", str(crf), *x265, *gop(FPS_OUT, 20), p))
    fit("film-1080-av1.mp4", 50, lambda crf, p: ffmpeg(*frames, "-vf", DESK, "-crf", str(crf), "-c:v", "libsvtav1", "-preset", "5", *gop(FPS_OUT, 20), p))
    # the H.264 fallback at 30 fps: half the frames for the browsers that play neither HEVC nor AV1
    fit("film-1080.mp4", 25, lambda crf, p: ffmpeg(*frames, "-vf", f"{DESK},fps=30", "-crf", str(crf), "-c:v", "libx264",
                                                    "-preset", "veryslow", "-tune", "film", *gop(30, 15), p))
    fit("film-phone-hevc.mp4", 28, lambda crf, p: ffmpeg(*frames, "-vf", f"{CUT},fps=30", "-crf", str(crf), *x265, *gop(30, 15), p))
    fit("film-phone.mp4", 26, lambda crf, p: ffmpeg(*frames, "-vf", f"{CUT},scale=540:960:flags=lanczos,fps=30", "-crf", str(crf),
                                                     "-c:v", "libx264", "-preset", "veryslow", "-tune", "film", *gop(30, 15), p))
    first = os.path.join(seq, "0001.png")
    webp = ["-c:v", "libwebp", "-quality", "68"]
    ffmpeg("-i", first, "-vf", DESK, *webp, os.path.join(OUT, "film-poster.webp"))
    ffmpeg("-i", first, "-vf", CUT, *webp, os.path.join(OUT, "film-poster-phone.webp"))
for f in ("hero-cutout.webp", "hero-cutout-phone.webp"):  # the apartment film's; the villa's title sits over the clouds
    if os.path.exists(os.path.join(OUT, f)):
        os.remove(os.path.join(OUT, f))
if "--draft" not in sys.argv:  # (a draft keeps the logo white throughout)
    subprocess.run([sys.executable, os.path.join(os.path.dirname(os.path.abspath(__file__)), "tone.py")], check=True)
for f in sorted(os.listdir(OUT)):
    print(f, round(os.path.getsize(os.path.join(OUT, f)) / 1e6, 2), "MB")
