"""Encodes rendered frames into the home page's films and posters (needs ffmpeg on PATH).

  python apps/web/film/encode.py [--draft]

Desktop: AV1 (about half the size), HEVC for Safari on Macs without AV1, H.264 for anything else. Phones: a portrait cut from the centre of the frame, which
is all a phone shows anyway, so it is sharper there and a fraction of the size. Scrolling forward plays the video
(Tour.tsx), so a keyframe a second is enough; faststart lets the browser begin before the whole file is in.
Works on a partial render too: each rendered frame is held until the next one.
"""
import os
import subprocess
import sys
import tempfile

SRC = os.path.join(os.environ.get("LOCALAPPDATA", os.path.expanduser("~")), "gharaana-film",
                   "frames-draft" if "--draft" in sys.argv else "frames-1080")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "tour")
CLEAN = "hqdn3d=2:2:7:7"  # a light temporal denoise: the render's leftover grain costs the most bits and nobody misses it
# the grade: a little less contrast, colours that pop (vibrance, and the sky's blues and cyans pushed), a cool sky lift
GRADE = ("eq=contrast=0.9:brightness=0.01:gamma=1.03:saturation=1.08,vibrance=intensity=0.45,"
         "huesaturation=saturation=0.55:colors=c+b:strength=3,colorbalance=bh=0.06:rh=-0.02")
SHARP = "cas=strength=0.55"  # contrast-adaptive sharpening, after any scaling
MATTE = os.path.join(os.environ.get("LOCALAPPDATA", os.path.expanduser("~")), "gharaana-film", "matte-0001.png")  # cutout.py
PHONE = "crop=608:1080:656:0,scale=540:960:flags=lanczos"  # the centre 9:16 of the 1920x1080 frame (Tour.tsx PHONE_CROP)
GOP = ["-g", "24", "-keyint_min", "24", "-sc_threshold", "0", "-movflags", "+faststart", "-an", "-pix_fmt", "yuv420p"]
H264 = ["-c:v", "libx264", "-preset", "veryslow", "-tune", "film", *GOP]
AV1 = ["-c:v", "libsvtav1", "-preset", "5", *GOP]
HEVC = ["-c:v", "libx265", "-preset", "slow", "-tag:v", "hvc1", "-x265-params", "log-level=error", *GOP]  # Safari on any Mac


def ffmpeg(*args):
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *args], check=True)


rendered = {int(f[1:5]): f for f in os.listdir(SRC) if f.startswith("f") and f.endswith(".png")}
os.makedirs(OUT, exist_ok=True)
with tempfile.TemporaryDirectory(dir=os.path.dirname(SRC)) as seq:  # same drive as the frames, so hard links work
    last = None
    for n in range(1, max(rendered) + 1):
        last = rendered.get(n, last)
        os.link(os.path.join(SRC, last), os.path.join(seq, f"{n:04d}.png"))
    print(f"{len(rendered)} of {max(rendered)} frames rendered")
    frames = ["-framerate", "24", "-i", os.path.join(seq, "%04d.png")]
    DESK = f"{CLEAN},{GRADE},scale=1920:1080:flags=lanczos,{SHARP}"
    CUT = f"{CLEAN},{GRADE},{PHONE},{SHARP}"
    ffmpeg(*frames, "-vf", DESK, "-crf", "44", *AV1, os.path.join(OUT, "film-1080-av1.mp4"))
    ffmpeg(*frames, "-vf", DESK, "-crf", "30", *HEVC, os.path.join(OUT, "film-1080-hevc.mp4"))
    ffmpeg(*frames, "-vf", DESK, "-crf", "27", *H264, os.path.join(OUT, "film-1080.mp4"))
    ffmpeg(*frames, "-vf", CUT, "-crf", "27", *H264, os.path.join(OUT, "film-phone.mp4"))
    first = os.path.join(seq, "0001.png")
    webp = ["-c:v", "libwebp", "-quality", "70"]
    ffmpeg("-i", first, "-vf", DESK, *webp, os.path.join(OUT, "film-poster.webp"))
    ffmpeg("-i", first, "-vf", CUT, *webp, os.path.join(OUT, "film-poster-phone.webp"))
    if os.path.exists(MATTE):  # the blocks cut from frame 1, graded like the film, for the hero title to sit behind
        for name, fit in (("hero-cutout.webp", DESK), ("hero-cutout-phone.webp", CUT)):
            shape = fit.replace(f"{CLEAN},{GRADE},", "").replace(f",{SHARP}", "")
            ffmpeg("-i", first, "-i", MATTE, "-filter_complex", f"[0]{fit}[c];[1]format=gray,scale=1920:1080,{shape}[a];[c][a]alphamerge",
                   *webp, os.path.join(OUT, name))
subprocess.run([sys.executable, os.path.join(os.path.dirname(os.path.abspath(__file__)), "tone.py")], check=True)
for f in sorted(os.listdir(OUT)):
    print(f, round(os.path.getsize(os.path.join(OUT, f)) / 1e6, 2), "MB")
