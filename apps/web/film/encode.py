"""Encodes rendered frames into the home page's films and poster (needs ffmpeg on PATH).

  python apps/web/film/encode.py [--draft]

Works on a partial render: each rendered frame is held until the next one, so after scene.py's first coarse pass the film
already spans the whole tour. A keyframe every 8 frames keeps scroll-scrubbing quick; faststart lets the browser begin
before the whole file is in.
"""
import os
import subprocess
import sys
import tempfile

SRC = os.path.join(os.environ.get("LOCALAPPDATA", os.path.expanduser("~")), "gharaana-film",
                   "frames-draft" if "--draft" in sys.argv else "frames-1080")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "tour")
X264 = ["-c:v", "libx264", "-preset", "slow", "-pix_fmt", "yuv420p", "-g", "8", "-keyint_min", "8", "-sc_threshold", "0",
        "-movflags", "+faststart", "-an"]

rendered = {int(f[1:5]): f for f in os.listdir(SRC) if f.startswith("f") and f.endswith(".png")}
os.makedirs(OUT, exist_ok=True)
with tempfile.TemporaryDirectory(dir=os.path.dirname(SRC)) as seq:  # same drive as the frames, so hard links work
    last = None
    for n in range(1, max(rendered) + 1):
        last = rendered.get(n, last)
        os.link(os.path.join(SRC, last), os.path.join(seq, f"{n:04d}.png"))
    print(f"{len(rendered)} of {max(rendered)} frames rendered")
    for name, height, crf in (("film-1080.mp4", 1080, "21"), ("film-720.mp4", 720, "24")):
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", "24", "-i", os.path.join(seq, "%04d.png"),
                        "-vf", f"scale=-2:{height}:flags=lanczos", "-crf", crf, *X264, os.path.join(OUT, name)], check=True)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", os.path.join(seq, "0001.png"), "-vf",
                    "scale=-2:1080:flags=lanczos", "-q:v", "3", os.path.join(OUT, "film-poster.jpg")], check=True)
for f in sorted(os.listdir(OUT)):
    print(f, round(os.path.getsize(os.path.join(OUT, f)) / 1e6, 1), "MB")
