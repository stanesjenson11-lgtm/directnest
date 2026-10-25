"""Builds the villa film (the home page hero on the villa-hero branch) in Blender and renders it.

  blender -b --factory-startup -P apps/web/film/villa.py -- [--preview|--draft] [--only outside|rooms|hall|bedroom|bath]
                                                         [--stills 0,6,13.9] [--frames 1-601] [--sheepit]

Without --stills, --frames or --sheepit it only builds and saves villa.blend. --stills takes film seconds (shots.py).
--sheepit saves a packed, farm-ready villa-sheepit.blend (Blender 4.5, Cycles, OIDN, no compositor; samples keyed per
shot) and zips it for upload to sheepit-renderfarm.com; its frames come back as PNGs for encode.py.
Everything heavy lives in %LOCALAPPDATA%/gharaana-villa (the Poly Haven cache stays shared in gharaana-film/assets).
"""
import json
import math
import os
import sys

sys.dont_write_bytecode = True  # no __pycache__ under apps/web (Turbopack watches it)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Euler, Vector

import city
import house
import kit
import shots
import world
from path import pw
from scene import look

OUT = os.path.join(os.environ.get("LOCALAPPDATA", os.path.expanduser("~")), "gharaana-villa")
FILM_JSON = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "components", "tour", "film.json")
SAMPLES = {"outside": 128, "rooms": 384}  # on the farm: the rooms are lit through windows and need more


def args():
    a = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    # --trial: a quick look at the whole film before the farm renders it: draft settings at 480x270 on the CPU (the GPU
    # may be busy earning SheepIt points), every other frame (encode.py --draft fills the gaps)
    trial = "--trial" in a
    opt = {"preview": "--preview" in a or "--draft" in a or trial, "draft": "--draft" in a or trial, "sheepit": "--sheepit" in a,
           "trial": trial, "cpu": "--cpu" in a or trial,
           "stills": None, "frames": None, "only": None}
    for k in ("--stills", "--frames", "--only"):
        if k in a:
            opt[k[2:]] = a[a.index(k) + 1]
    return opt


OPT = args()


def wanted(part):
    only = OPT["only"]
    if only is None:
        return True
    if only == "rooms":
        return part in ("hall", "bedroom", "bath")
    return only == part


def keyed(sc, name, table):
    """A scene property keyed every frame from a shots table (no easing of its own between frames)."""
    for f in range(1, shots.FRAMES + 2):
        sc[name] = pw(table, shots.sec_of(f))
        sc.keyframe_insert(f'["{name}"]', frame=f)


def camera(sc):
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    sc.collection.objects.link(cam)
    sc.camera = cam
    cam.data.sensor_fit = "VERTICAL"
    cam.data.sensor_height = 24.0
    for f in range(1, shots.FRAMES + 2):
        s = shots.sec_of(f)
        pos, tgt, fov, shift = shots.camera_at(s)
        name = shots.shot_of(s)[0]
        dist = (Vector(tgt) - Vector(pos)).length
        hp, hr = handheld(f, dist, name)
        cam.location = Vector(pos) + Vector(hp)
        e = look(pos, tgt)
        cam.rotation_euler = Euler((e.x + hr[0], e.y + hr[1], e.z + hr[2]))
        cam.data.lens = 12.0 / math.tan(math.radians(fov) / 2)
        cam.data.shift_y = shift
        cam.data.clip_start = 0.03 if name in ("hall", "bedroom", "bath") else 0.1 if dist < 40 else 0.5
        cam.keyframe_insert("location", frame=f)
        cam.keyframe_insert("rotation_euler", frame=f)
        for k in ("lens", "shift_y", "clip_start"):
            cam.data.keyframe_insert(k, frame=f)
    for ad in (cam.animation_data, cam.data.animation_data):
        for fc in ad.action.fcurves:
            for kp in fc.keyframe_points:
                kp.interpolation = "LINEAR"
    return cam


def handheld(frame, dist, shot):
    """A filmed camera never sits perfectly still; a gimbal drone and a dolly drift less than a hand."""
    t = frame / shots.FPS
    amp = min(0.12, 0.004 + dist * 0.001) * (0.35 if shot in ("hall", "bedroom", "bath") else 1.0)
    ang = math.radians(0.06)
    pos = (amp * (math.sin(t * 0.71) * 0.6 + math.sin(t * 1.93 + 1.3) * 0.4),
           amp * (math.sin(t * 0.53 + 2.1) * 0.6 + math.sin(t * 1.61) * 0.4),
           amp * 0.6 * (math.sin(t * 0.87 + 0.4) * 0.7 + math.sin(t * 2.3) * 0.3))
    rot = (ang * math.sin(t * 0.61 + 0.7), ang * 0.5 * math.sin(t * 0.37), ang * math.sin(t * 0.83 + 2.2))
    return pos, rot


def air(collection):
    """Aerial haze over the city for the opening (the apartment film did this in the compositor; the farm's frames
    have no compositor): a thin, faintly blue volume, only while the camera is high."""
    m = bpy.data.materials.new("air")
    m.use_nodes = True
    n = m.node_tree.nodes
    n.clear()
    v = n.new("ShaderNodeVolumePrincipled")
    v.inputs["Color"].default_value = (0.78, 0.84, 0.95, 1)
    v.inputs["Density"].default_value = 0.00035
    v.inputs["Anisotropy"].default_value = 0.4
    out = n.new("ShaderNodeOutputMaterial")
    m.node_tree.links.new(v.outputs[0], out.inputs["Volume"])
    o = kit.Boxes().add(-2600, -2600, 0.2, 2600, 2600, 520).build("air", m, collection)
    house.show(o, [(0.0, 4.0)])


def clouds(collection):
    """The cloud deck the opening looks down through (as the reference opens): a broad layer of soft cumulus between
    150 and 240 m, its gaps showing the city, drifting with the wind; faded by scene['wisps'] and off once below it."""
    sc = bpy.context.scene
    m = bpy.data.materials.new("cloud_deck")
    m.use_nodes = True
    nd = kit.Nodes(m.node_tree)
    nd.n.clear()
    geo = nd.new("ShaderNodeNewGeometry")
    wind = nd.new("ShaderNodeVectorMath", operation="ADD")
    for i, rate in ((0, 0.6), (1, 0.2)):
        d = wind.inputs[1].driver_add("default_value", i).driver
        d.expression = f"frame * {rate}"
    nd.link(geo.outputs["Position"], wind.inputs[0])
    scale = nd.new("ShaderNodeVectorMath", operation="MULTIPLY")
    scale.inputs[1].default_value = (1 / 260, 1 / 260, 1 / 90)
    nd.link(wind.outputs[0], scale.inputs[0])
    nz = nd.new("ShaderNodeTexNoise", noise_dimensions="3D")
    nz.inputs["Detail"].default_value = 10.0
    nz.inputs["Roughness"].default_value = 0.62
    nz.inputs["Distortion"].default_value = 0.35
    nd.link(scale.outputs[0], nz.inputs["Vector"])
    # thicker in the middle of the layer, thinning to its top and bottom
    gen = nd.new("ShaderNodeTexCoord")
    sep = nd.new("ShaderNodeSeparateXYZ")
    nd.link(gen.outputs["Generated"], sep.inputs[0])
    h = nd.math("SUBTRACT", 1.0, nd.math("ABSOLUTE", nd.math("MULTIPLY", nd.math("SUBTRACT", sep.outputs["Z"], 0.45), 2.0)))
    mr = nd.new("ShaderNodeMapRange")
    mr.inputs["From Min"].default_value = 0.57  # a narrow band: crisp cloud edges, clear gaps between them
    mr.inputs["From Max"].default_value = 0.63
    nd.link(nd.math("ADD", nz.outputs["Fac"], nd.math("MULTIPLY", h, 0.08)), mr.inputs["Value"])
    dens = nd.math("MULTIPLY", nd.math("MULTIPLY", mr.outputs["Result"], h), house._drive(nd, "wisps"))
    v = nd.new("ShaderNodeVolumePrincipled")
    v.inputs["Color"].default_value = (1.0, 1.0, 1.0, 1)
    v.inputs["Anisotropy"].default_value = 0.2  # seen from above, away from the sun: bright, not grey
    nd.link(nd.math("MULTIPLY", dens, 0.9), v.inputs["Density"])
    out = nd.new("ShaderNodeOutputMaterial")
    nd.link(v.outputs[0], out.inputs["Volume"])
    o = kit.Boxes().add(-700, -760, 140, 500, 360, 260).build("cloud_deck", m, collection)
    house.show(o, [(0.0, 3.6)])


def outside(sc):
    lib = house.build_static()
    places = []
    city.build(OPT["preview"], gated=lambda K, r: house.layout(K, r, places))
    hood = kit.coll("hood")
    for i, (x, y, rot, mirror) in enumerate(places):
        o = kit.instance(f"villa_n{i}", lib, x, y, 0.0, rot, 1.0, hood)
        if mirror:
            o.scale.x = -1.0
    house.build_hero(kit.coll("villa"))
    clouds(kit.coll("sky"))
    air(kit.coll("sky"))
    for c in (bpy.data.collections["city"], hood):  # off while the rooms are on screen
        for o in list(c.all_objects):  # (a copy: keying while iterating the live list crashed Blender)
            if not (o.animation_data and o.animation_data.action and any(fc.data_path == "hide_render" for fc in o.animation_data.action.fcurves)):
                house.show(o, shots.SHOW["outside"])


def rooms_build():
    import rooms
    for name in ("hall", "bedroom", "bath"):
        if wanted(name):
            getattr(rooms, name)()


def export(cam):
    """film.json for the page: frames, the tick -> second map, the phone crop and the hotspots' screen positions."""
    sc = bpy.context.scene
    f0, f1 = (shots.frame_of(s) for s in shots.HOTSPOT_SECONDS)
    pts = {k: [] for k in shots.HOTSPOTS}
    for f in range(f0, f1 + 1):
        sc.frame_set(f)
        for k, p in shots.HOTSPOTS.items():
            v = world_to_camera_view(sc, cam, Vector(p))
            pts[k].append([round(v.x, 4), round(1 - v.y, 4)])
    old = {}
    if os.path.exists(FILM_JSON):
        with open(FILM_JSON, encoding="utf-8") as fh:
            old = json.load(fh)
    n = shots.FRAMES + 1
    logo = old.get("logo") if old.get("frames") == n else None
    out = {"fps": shots.FPS, "frames": n, "ticks": 100, "map": shots.MAP, "crop": shots.CROP,
           "pins": {"from": f0, "to": f1, "points": pts}, "logo": logo or {"desk": "D" * n, "phone": "D" * n}}
    with open(FILM_JSON, "w", encoding="utf-8") as fh:
        json.dump(out, fh, separators=(",", ":"))
    sc.frame_set(1)


def key_samples(sc):
    """Final quality: samples keyed per shot (the rooms, lit through windows, need more), adaptive, denoised."""
    c = sc.cycles
    c.adaptive_threshold = 0.02
    for f in range(1, shots.FRAMES + 2):
        name = shots.shot_of(shots.sec_of(f))[0]
        c.samples = SAMPLES["rooms" if name in ("hall", "bedroom", "bath") else "outside"]
        c.keyframe_insert("samples", frame=f)
    for fc in sc.animation_data.action.fcurves:
        if fc.data_path.endswith("samples"):
            for kp in fc.keyframe_points:
                kp.interpolation = "CONSTANT"


def farm(sc):
    """Farm settings: OIDN (any node, CPU or GPU), no compositor; packed and zipped."""
    import zipfile
    sc.cycles.denoiser = "OPENIMAGEDENOISE"
    bpy.ops.file.pack_all()
    folder = os.path.join(OUT, "sheepit")
    os.makedirs(folder, exist_ok=True)
    blend = os.path.join(folder, "villa-sheepit.blend")
    bpy.ops.wm.save_as_mainfile(filepath=blend, compress=True)
    with zipfile.ZipFile(blend[:-6] + ".zip", "w", zipfile.ZIP_STORED) as z:  # already compressed
        z.write(blend, "villa-sheepit.blend")
    print(f"[villa] farm project -> {blend[:-6]}.zip ({os.path.getsize(blend[:-6] + '.zip') / 1e6:.0f} MB)", flush=True)


def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    world.render(preview=OPT["preview"], draft=OPT["draft"])
    if OPT["cpu"]:
        sc.cycles.device = "CPU"
        sc.cycles.denoiser = "OPENIMAGEDENOISE"
    if OPT["trial"]:
        sc.render.resolution_percentage = 75
        sc.cycles.samples = 10
    sc.render.film_transparent = False  # no compositor: the sky is the background
    sc.use_nodes = False
    sc.frame_start, sc.frame_end = 1, shots.FRAMES + 1
    spin = [(f, math.radians(pw(shots.TABLES["spin"], shots.sec_of(f)))) for f in range(1, shots.FRAMES + 2)]
    world.sky("4k" if OPT["preview"] or OPT["sheepit"] else "8k", spin=spin)
    sc.world.mist_settings.start = 1e6  # (mist pass unused)
    for name, table in (("night", shots.TABLES["night"]), ("lamps", shots.TABLES["lamps"]), ("wisps", shots.TABLES["wisps"])):
        keyed(sc, name, table)
    if wanted("outside"):
        outside(sc)
    if any(wanted(r) for r in ("hall", "bedroom", "bath")):
        rooms_build()
    cam = camera(sc)
    if not OPT["preview"]:
        key_samples(sc)
    if OPT["only"] is None:
        export(cam)
    os.makedirs(OUT, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "villa-preview.blend" if OPT["preview"] else "villa.blend"))


def render_stills(secs):
    sc = bpy.context.scene
    os.makedirs(os.path.join(OUT, "stills"), exist_ok=True)
    for s in secs:
        sc.frame_set(shots.frame_of(s))
        sc.render.filepath = os.path.join(OUT, "stills", f"s{s:g}.png")
        bpy.ops.render.render(write_still=True)
        print(f"[villa] still {s}s -> {sc.render.filepath}", flush=True)


if __name__ == "__main__":
    build()
    if OPT["stills"]:
        render_stills([float(x) for x in OPT["stills"].split(",")])
    if OPT["sheepit"]:
        farm(bpy.context.scene)
    if OPT["frames"]:
        a, b = (int(x) for x in OPT["frames"].split("-"))
        sc = bpy.context.scene
        folder = os.path.join(OUT, "frames-draft" if OPT["draft"] else "frames-1080")
        os.makedirs(folder, exist_ok=True)
        done = set(os.listdir(folder))
        for step in (24, 8, 4, 2) if OPT["trial"] else (24, 8, 4, 2, 1):  # coarse to fine: whole after the first pass
            for f in [*range(a, b + 1, step), b]:
                name = f"f{f:04d}.png"
                if name in done:
                    continue
                sc.frame_set(f)
                sc.render.filepath = os.path.join(folder, name)
                bpy.ops.render.render(write_still=True)
                done.add(name)
                print(f"[villa] pass {step}: {name}", flush=True)
