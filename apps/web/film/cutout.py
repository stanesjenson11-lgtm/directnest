"""Cuts the community's three blocks out of the film's first frame, so the hero title can sit behind them.

  blender -b %LOCALAPPDATA%/gharaana-film/film.blend -P apps/web/film/cutout.py

Renders a matte of the blocks (everything else held out), runs it through the same lens distortion as the film so the
edges line up, then ffmpeg merges it with the rendered frame 1 into a transparent WebP for the page.
"""
import os
import subprocess

import bpy

FILM = os.path.join(os.environ.get("LOCALAPPDATA", os.path.expanduser("~")), "gharaana-film")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "tour")
MATTE = os.path.join(FILM, "matte-0001.png")

sc = bpy.context.scene
sc.frame_set(1)
vl = sc.view_layers[0]


def walk(lc):
    yield lc
    for c in lc.children:
        yield from walk(c)


for lc in walk(vl.layer_collection):  # everything but the blocks becomes a transparent hole
    if lc.name not in ("hero", "Scene Collection") and lc.collection.name != "hero":
        lc.holdout = True
for o in sc.objects:
    if o.name.startswith("wisps"):
        o.animation_data_clear()  # their keyframed visibility would switch them back on
        o.hide_render = True
c = sc.cycles
c.samples, c.use_denoising = 16, False
c.max_bounces = c.diffuse_bounces = c.glossy_bounces = c.transmission_bounces = 1
sc.render.film_transparent = True
# compositor: alpha only, through the film's lens distortion
t = sc.node_tree
t.nodes.clear()
rl = t.nodes.new("CompositorNodeRLayers")
lens = t.nodes.new("CompositorNodeLensdist")
lens.inputs["Dispersion"].default_value = 0.006
lens.inputs["Distortion"].default_value = -0.008
t.links.new(rl.outputs["Alpha"], lens.inputs["Image"])
comp = t.nodes.new("CompositorNodeComposite")
t.links.new(lens.outputs[0], comp.inputs["Image"])
sc.render.image_settings.file_format = "PNG"
sc.render.image_settings.color_mode = "BW"
sc.render.filepath = MATTE
bpy.ops.render.render(write_still=True)

frame = os.path.join(FILM, "frames-1080", "f0001.png")
PHONE = "crop=608:1080:656:0,scale=540:960:flags=lanczos"  # same cut as encode.py's phone film
for name, fit in (("hero-cutout.webp", "scale=1920:1080:flags=lanczos"), ("hero-cutout-phone.webp", PHONE)):
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", frame, "-i", MATTE, "-filter_complex",
                    f"[1]format=gray,scale=1920:1080,{fit}[a];[0]{fit}[c];[c][a]alphamerge", "-c:v", "libwebp",
                    "-quality", "70", os.path.join(OUT, name)], check=True)
    print("[film] cutout ->", os.path.join(OUT, name))
