"""Builds the explorer film (the home page hero on the hero-page branch: from the clouds to the Earth, down to Bengaluru
and one villa; after the director's sketch, timeline in earth_shots.py) in Blender and renders it.

  blender -b --factory-startup -P apps/web/film/earth.py -- [--preview|--draft|--trial] [--cpu] [--stills 2,9.5,13]
                                                          [--frames 1-817] [--sheepit]

Without --stills, --frames or --sheepit it only builds and saves earth.blend. --stills takes film seconds.
--sheepit saves a packed, farm-ready earth-sheepit.blend (Blender 4.5, Cycles, OIDN, no compositor; samples keyed per
shot) and zips it for upload to sheepit-renderfarm.com; its frames come back as PNGs for encode.py (--film earth).
Everything heavy lives in %LOCALAPPDATA%/gharaana-earth (the Poly Haven and NASA caches stay shared in gharaana-film/assets).
"""
import json
import math
import os
import sys

sys.dont_write_bytecode = True  # no __pycache__ under apps/web (Turbopack watches it)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Euler, Matrix, Vector

import city
import earth_shots as shots
import globe
import house
import kit
import world
from globe import show
from house import _drive
from path import pw

OUT = os.path.join(os.environ.get("LOCALAPPDATA", os.path.expanduser("~")), "gharaana-earth")
EARTH_JSON = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "components", "tour", "earth.json")
SAMPLES = {"sky": 192, "earth": 64, "city": 128}  # on the farm: the cloud sea is all volume and needs the most
SUN_DAWN = (math.radians(28), math.radians(6.0))  # the sunrise in the cloud set: azimuth from +y towards +x, elevation


def args():
    a = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    # --trial: a quick look at the whole film before the farm renders it: draft settings at 480x270 on the CPU, every
    # other frame (encode.py --draft fills the gaps)
    trial = "--trial" in a
    opt = {"preview": "--preview" in a or "--draft" in a or trial, "draft": "--draft" in a or trial, "sheepit": "--sheepit" in a,
           "trial": trial, "cpu": "--cpu" in a or trial, "stills": None, "frames": None}
    for k in ("--stills", "--frames"):
        if k in a:
            opt[k[2:]] = a[a.index(k) + 1]
    return opt


OPT = args()


def keyed(sc, name, fn):
    """A scene property keyed every frame from fn(film second) (no easing of its own between frames)."""
    for f in range(1, shots.FRAMES + 2):
        sc[name] = fn(shots.sec_of(f))
        sc.keyframe_insert(f'["{name}"]', frame=f)


def _linear(*ads):
    for ad in ads:
        for fc in ad.action.fcurves:
            for kp in fc.keyframe_points:
                kp.interpolation = "LINEAR"


# ---------------------------------------------------------------- sky


def skies(sc):
    """world.sky's two photographed skies for the city, plus the sunrise over the cloud sea (Nishita) and space (black,
    stars), crossfaded by scene['dawn'] and scene['space']."""
    spin = [(f, math.radians(pw(shots.TABLES["spin"], shots.sec_of(f)))) for f in range(1, shots.FRAMES + 2)]
    w = world.sky("4k" if OPT["preview"] or OPT["sheepit"] else "8k", spin=spin)
    nd = kit.Nodes(w.node_tree)
    bg = next(n for n in nd.n if n.type == "BACKGROUND")
    photo = bg.inputs["Color"].links[0].from_socket
    sky = nd.new("ShaderNodeTexSky", sky_type="NISHITA", sun_disc=True, sun_size=math.radians(0.9), sun_intensity=0.6,
                 sun_rotation=SUN_DAWN[0], sun_elevation=SUN_DAWN[1], altitude=1800.0, air_density=1.0, dust_density=1.0, ozone_density=3.0)
    dawn = nd.mix("MULTIPLY", 1.0, sky.outputs["Color"], (0.3, 0.3, 0.3, 1))
    # stars: one in a few Voronoi cells of the view direction, each its own brightness
    tc = nd.new("ShaderNodeTexCoord")
    vo = nd.new("ShaderNodeTexVoronoi", feature="F1", voronoi_dimensions="3D")
    vo.inputs["Scale"].default_value = 420.0
    nd.link(tc.outputs["Generated"], vo.inputs["Vector"])
    dot = nd.new("ShaderNodeMapRange", clamp=True)
    dot.inputs["From Min"].default_value = 0.1
    dot.inputs["From Max"].default_value = 0.0
    nd.link(vo.outputs["Distance"], dot.inputs["Value"])
    rnd = nd.new("ShaderNodeSeparateColor")
    nd.link(vo.outputs["Color"], rnd.inputs[0])
    lum = nd.math("MULTIPLY", nd.math("POWER", rnd.outputs["Red"], 6.0), nd.math("GREATER_THAN", rnd.outputs["Green"], 0.55))
    star = nd.math("MULTIPLY", nd.math("MULTIPLY", dot.outputs["Result"], lum), 40.0)
    stars = nd.mix("MIX", star, (0.0, 0.0, 0.0, 1), (0.85, 0.9, 1.0, 1))
    col = nd.mix("MIX", _drive(nd, "dawn"), photo, dawn)
    col = nd.mix("MIX", _drive(nd, "space"), col, stars)
    nd.link(col, bg.inputs["Color"])
    sun = bpy.data.objects.new("sun_dawn", bpy.data.lights.new("sun_dawn", "SUN"))
    sc.collection.objects.link(sun)
    sun.data.angle = math.radians(0.9)
    sun.data.color = (1.0, 0.8, 0.6)
    az, el = SUN_DAWN
    to_sun = Vector((math.sin(az) * math.cos(el), math.cos(az) * math.cos(el), math.sin(el)))
    sun.rotation_mode = "QUATERNION"
    sun.rotation_quaternion = to_sun.to_track_quat("Z", "Y")
    for s, e in ((0.0, 3.2), (7.0, 0.0)):  # on only over the cloud sea
        sun.data.energy = e
        sun.data.keyframe_insert("energy", frame=shots.frame_of(s))
    for fc in sun.data.animation_data.action.fcurves:
        for kp in fc.keyframe_points:
            kp.interpolation = "CONSTANT"


def cloud_material(name, scale, density, looped, tops=0.14):
    """Cumulus in a box (Generated z 0..1 its height): billows of `scale` metres with smaller puffs on them, flat-bottomed,
    domed on top (the threshold rises with height by `tops` over the box), crisp-edged, with clear gaps between them.
    looped: the two drifting fields of shots.cloud_phase; otherwise one field drifting with the frame, faded by 'wisps'."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nd = kit.Nodes(m.node_tree)
    nd.n.clear()
    geo = nd.new("ShaderNodeNewGeometry")

    def noise(p, size, detail):
        sv = nd.new("ShaderNodeVectorMath", operation="MULTIPLY")
        sv.inputs[1].default_value = (1 / size, 1 / size, 1 / (size * 0.5))
        nd.link(p, sv.inputs[0])
        nz = nd.new("ShaderNodeTexNoise", noise_dimensions="3D")
        nz.inputs["Detail"].default_value = detail
        nz.inputs["Roughness"].default_value = 0.55
        nz.inputs["Distortion"].default_value = 0.4
        nd.link(sv.outputs[0], nz.inputs["Vector"])
        return nz.outputs["Fac"]

    def field(phase):
        wind = nd.new("ShaderNodeVectorMath", operation="ADD")
        for i in range(2):
            d = wind.inputs[1].driver_add("default_value", i).driver
            if phase:
                v = d.variables.new()
                v.name = "t"
                v.targets[0].id_type = "SCENE"
                v.targets[0].id = bpy.context.scene
                v.targets[0].data_path = f'["{phase}"]'
                d.expression = f"t * {-shots.WIND[i]}"
            else:
                d.expression = f"frame * {-shots.WIND[i] / shots.FPS * 0.4:.4f}"
        nd.link(geo.outputs["Position"], wind.inputs[0])
        return nd.math("ADD", nd.math("MULTIPLY", noise(wind.outputs[0], scale, 3.0), 0.6),
                       nd.math("MULTIPLY", noise(wind.outputs[0], scale * 0.2, 6.0), 0.4))

    if looped:
        # two independent fields crossfading would flatten each other mid-loop: rescale so the clouds keep their contrast
        b = _drive(nd, "clb")
        mix = nd.math("ADD", nd.math("MULTIPLY", field("cl1"), nd.math("SUBTRACT", 1.0, b)), nd.math("MULTIPLY", field("cl2"), b))
        spread = nd.math("SQRT", nd.math("ADD", nd.math("POWER", nd.math("SUBTRACT", 1.0, b), 2.0), nd.math("POWER", b, 2.0)))
        n = nd.math("ADD", nd.math("DIVIDE", nd.math("SUBTRACT", mix, 0.5), spread), 0.5)
    else:
        n = field(None)
    gen = nd.new("ShaderNodeTexCoord")
    sep = nd.new("ShaderNodeSeparateXYZ")
    nd.link(gen.outputs["Generated"], sep.inputs[0])
    z = sep.outputs["Z"]
    # domes: the higher in the layer, the denser the noise must be; where the slow `towers` field is high the domes
    # climb much higher (cumulus towers over the sea of cloud), where it is low the sea opens into gaps
    tw = nd.new("ShaderNodeMapRange", clamp=True)
    tw.inputs["From Min"].default_value = 0.5
    tw.inputs["From Max"].default_value = 0.62
    nd.link(noise(geo.outputs["Position"], scale * 3.0, 2.0), tw.inputs["Value"])
    climb = nd.math("SUBTRACT", tops, nd.math("MULTIPLY", tw.outputs["Result"], tops - 0.03))
    mr = nd.new("ShaderNodeMapRange", clamp=True)
    mr.inputs["From Min"].default_value = 0.5
    mr.inputs["From Max"].default_value = 0.53
    nd.link(nd.math("SUBTRACT", n, nd.math("MULTIPLY", z, climb)), mr.inputs["Value"])
    base = nd.new("ShaderNodeMapRange", clamp=True)  # flat bases
    base.inputs["From Max"].default_value = 0.06
    nd.link(z, base.inputs["Value"])
    dens = nd.math("MULTIPLY", mr.outputs["Result"], base.outputs["Result"])
    if looped:  # thins out towards the box's sides, where the far cloud sheet takes over
        for axis in ("X", "Y"):
            e = nd.math("SUBTRACT", 1.0, nd.math("ABSOLUTE", nd.math("MULTIPLY", nd.math("SUBTRACT", sep.outputs[axis], 0.5), 2.0)))
            r = nd.new("ShaderNodeMapRange", clamp=True)
            r.inputs["From Max"].default_value = 0.25
            nd.link(e, r.inputs["Value"])
            dens = nd.math("MULTIPLY", dens, r.outputs["Result"])
    else:
        dens = nd.math("MULTIPLY", dens, _drive(nd, "wisps"))
    v = nd.new("ShaderNodeVolumePrincipled")
    v.inputs["Color"].default_value = (1.0, 1.0, 1.0, 1)
    v.inputs["Anisotropy"].default_value = 0.3  # a bright silver lining towards the low sun
    nd.link(nd.math("MULTIPLY", dens, density), v.inputs["Density"])
    out = nd.new("ShaderNodeOutputMaterial")
    nd.link(v.outputs[0], out.inputs["Volume"])
    return m


def cloud_sea():
    """Above the clouds at sunrise (shots 'loop' and 'clouds'): a 40 km field of volume cumulus from 600 m, towers to 2.6 km,
    a flat sheet of cloud tops beyond it to the horizon, dark country far below."""
    c = kit.coll("sky")
    # towers up to 2.6 km; the sea itself tops out near 1.4 km
    sea = kit.Boxes().add(-20000, -6000, 600, 20000, 34000, 2600).build("cloud_sea", cloud_material("cloud_sea", 1800.0, 0.035, True, tops=0.3), c)
    sheet = bpy.data.materials.new("cloud_sheet")
    sheet.use_nodes = True
    nd = kit.Nodes(sheet.node_tree)
    nd.n.clear()
    nz = nd.new("ShaderNodeTexNoise", noise_dimensions="3D")
    nz.inputs["Detail"].default_value = 10.0
    nd.link(nd.world_pos(2400.0), nz.inputs["Vector"])
    b = nd.new("ShaderNodeBsdfPrincipled")
    nd.link(nd.mix("MIX", nz.outputs["Fac"], (0.55, 0.58, 0.66, 1), (1.0, 1.0, 1.0, 1)), b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 1.0
    b.inputs["Emission Color"].default_value = (1.0, 0.72, 0.52, 1)  # the glow a low sun gives the far cloud tops
    b.inputs["Emission Strength"].default_value = 0.35
    bump = nd.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.6
    nd.link(nz.outputs["Fac"], bump.inputs["Height"])
    nd.link(bump.outputs["Normal"], b.inputs["Normal"])
    kit._out(nd, b.outputs[0])
    # the sheet starts where the volume field thins out, as a ring round it
    r0, r1, n = 17000.0, 400000.0, 96
    verts = [(r * math.sin(2 * math.pi * i / n), 14000 + r * math.cos(2 * math.pi * i / n), 1080.0) for r in (r0, r1) for i in range(n)]
    faces = [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
    ring = kit.mesh_obj("cloud_sheet", verts, faces, sheet, c)
    ground = kit.Boxes().add(-400000, -400000, -10, 400000, 400000, 0).build("country", kit.flat("country", 0x1d2622, rough=0.9), c)
    for o in (sea, ring, ground):
        show(o, shots.SHOW["sky"])


# ---------------------------------------------------------------- Bengaluru


def haze(collection):
    """Aerial haze over the city (the farm's frames have no compositor): thin, faintly warm, only while high up."""
    m = bpy.data.materials.new("air")
    m.use_nodes = True
    n = m.node_tree.nodes
    n.clear()
    v = n.new("ShaderNodeVolumePrincipled")
    v.inputs["Color"].default_value = (0.86, 0.84, 0.88, 1)
    v.inputs["Density"].default_value = 0.0004
    v.inputs["Anisotropy"].default_value = 0.4
    out = n.new("ShaderNodeOutputMaterial")
    m.node_tree.links.new(v.outputs[0], out.inputs["Volume"])
    o = kit.Boxes().add(-2600, -2600, 0.2, 2600, 2600, 700).build("air", m, collection)
    show(o, [(14.0, 22.0), (31.0, 34.01)])


def pool(collection):
    """The clubhouse's pool, set into its deck (house.layout's white slab east of the clubhouse)."""
    kit.Boxes().add(18.5, 100.0, 0.06, 33.5, 110.0, 0.13).build("pool", kit.water("pool_water"), collection)
    tiles = kit.flat("pool_edge", 0xe9e4d8, rough=0.5)
    b = kit.Boxes()
    for x0, y0, x1, y1 in ((18.0, 99.5, 34.0, 100.0), (18.0, 110.0, 34.0, 110.5), (18.0, 100.0, 18.5, 110.0), (33.5, 100.0, 34.0, 110.0)):
        b.add(x0, y0, 0.06, x1, y1, 0.16)
    for i in range(6):  # loungers along the deck
        b.add(19.0 + i * 2.4, 111.2, 0.12, 20.0 + i * 2.4, 112.0 + 0.0, 0.42)
    b.build("pool_deck", tiles, collection)


def bengaluru():
    lib = house.build_static()
    places = []
    city.build(OPT["preview"], gated=lambda K, r: house.layout(K, r, places))
    hood = kit.coll("hood")
    for i, (x, y, rot, mirror) in enumerate(places + [(0.0, 0.0, 0.0, False)]):  # the neighbours, and ours
        o = kit.instance(f"villa_n{i}", lib, x, y, 0.0, rot, 1.0, hood)
        if mirror:
            o.scale.x = -1.0
    pool(hood)
    sky = kit.coll("city_sky")
    dive = cloud_material("dive", 260.0, 0.9, False)
    show(kit.Boxes().add(*shots.DIVE).build("dive", dive, sky), shots.SHOW["dive"])
    haze(sky)
    for c in (bpy.data.collections["city"], hood):
        for o in list(c.all_objects):  # (a copy: keying while iterating the live list crashed Blender)
            if not (o.animation_data and o.animation_data.action and any(fc.data_path == "hide_render" for fc in o.animation_data.action.fcurves)):
                show(o, shots.SHOW["city"])


def pins(sc):
    """The property markers: a glossy pin standing on each roof (gold for sale, red for rent) over a glowing ring,
    popping up one after another. Returns {key: its head's world position} for earth.json."""
    # the pins stand on roofs, not on the trees, wires or haze over them: those are out of the way while we look down
    skip = [o for o in bpy.data.objects if o.name in ("trees", "palms", "shrubs", "grass_tufts", "city_wires", "city_poles", "air", "dive")]
    for o in skip:
        o.hide_viewport = True
    dg = bpy.context.evaluated_depsgraph_get()
    dg.update()
    gold = kit.flat("pin_gold", 0xe9b450, rough=0.25, metal=1.0, emit=0xffb84d, emit_strength=0.25)
    red = kit.flat("pin_red", 0xc8102e, rough=0.3, coat=1.0, emit=0xff2a3a, emit_strength=0.25)
    ring = kit.flat("pin_ring", 0xffd48a, emit=0xffa53a, emit_strength=1.6)
    c = kit.coll("pins")
    heads = {}
    t0, t1 = shots.PIN_POP
    for i, (key, x, y, kind) in enumerate(shots.PINS):
        hit, loc, *_ = sc.ray_cast(dg, Vector((x, y, 400.0)), Vector((0, 0, -1)))
        z = loc.z if hit else 0.0
        mat = gold if kind == "sale" else red
        head = kit.prim("sphere", f"pin_{key}", mat, c, r=3.2, seg=32)
        tip = kit.prim("cyl", f"pin_{key}_tip", mat, c, r=0.0, r2=2.4, h=6.8, seg=32)  # from a point on the roof up
        disc = kit.prim("cyl", f"pin_{key}_ring", ring, c, r=7.0, h=0.1, seg=48)
        globe._camera_only(disc)
        e = bpy.data.objects.new(f"pin_{key}_root", None)
        c.objects.link(e)
        e.location = (x, y, z + 0.4)
        head.location = (0, 0, 9.2)
        for o in (head, tip, disc):
            o.parent = e
        heads[key] = (x, y, z + 0.4 + 9.2 * 1.3)
        pop = t0 + (t1 - t0) * i / max(1, len(shots.PINS) - 1)
        for s, k in ((0.0, 0.001), (pop, 0.001), (pop + 0.25, 1.5), (pop + 0.45, 1.3)):
            e.scale = (k, k, k)
            e.keyframe_insert("scale", frame=shots.frame_of(s))
        spans = [(17.9, 25.5)] if key == "villa" else shots.SHOW["pins"]
        for o in (head, tip, disc):
            show(o, spans)
    for o in skip:
        o.hide_viewport = False
    return heads


# ---------------------------------------------------------------- camera


def look(pos, tgt, up):
    p, q = Vector(pos), Vector(tgt)
    z = -(q - p).normalized()
    x = Vector(up).normalized().cross(z).normalized()
    y = z.cross(x)
    return Matrix((x, y, z)).transposed().to_euler()


def handheld(frame, dist):
    """A drone never sits perfectly still: a small slow drift, scaled with the distance to the subject."""
    t = frame / shots.FPS
    amp = min(0.5, 0.004 + dist * 0.001)
    ang = math.radians(0.05)
    pos = (amp * (math.sin(t * 0.71) * 0.6 + math.sin(t * 1.93 + 1.3) * 0.4),
           amp * (math.sin(t * 0.53 + 2.1) * 0.6 + math.sin(t * 1.61) * 0.4),
           amp * 0.6 * (math.sin(t * 0.87 + 0.4) * 0.7 + math.sin(t * 2.3) * 0.3))
    return pos, (ang * math.sin(t * 0.61 + 0.7), ang * 0.5 * math.sin(t * 0.37), ang * math.sin(t * 0.83 + 2.2))


def camera(sc):
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    sc.collection.objects.link(cam)
    sc.camera = cam
    cam.data.sensor_fit = "VERTICAL"
    cam.data.sensor_height = 24.0
    for f in range(1, shots.FRAMES + 2):
        s = shots.sec_of(f)
        pos, tgt, fov, shift, up = shots.camera_at(s)
        name = shots.shot_of(s)[0]
        dist = (Vector(tgt) - Vector(pos)).length
        e = look(pos, tgt, up)
        if name in shots.GLOBE + shots.SKY:  # (the idle loop must not move at all; the Earth is seen from orbit)
            hp, hr = (0, 0, 0), (0, 0, 0)
        else:
            hp, hr = handheld(f, dist)
        cam.location = Vector(pos) + Vector(hp)
        cam.rotation_euler = Euler((e.x + hr[0], e.y + hr[1], e.z + hr[2]))
        cam.data.lens = 12.0 / math.tan(math.radians(fov) / 2)
        cam.data.shift_y = shift
        # the Earth is in km: near enough for 400 km over Karnataka, far enough for the whole globe and its stars
        cam.data.clip_start, cam.data.clip_end = (1.0, 60000.0) if name in shots.GLOBE else (0.5, 500000.0) if name in shots.SKY \
            else (0.1 if dist < 40 else 0.5, 30000.0)
        cam.keyframe_insert("location", frame=f)
        cam.keyframe_insert("rotation_euler", frame=f)
        for k in ("lens", "shift_y", "clip_start", "clip_end"):
            cam.data.keyframe_insert(k, frame=f)
    _linear(cam.animation_data, cam.data.animation_data)
    return cam


# ---------------------------------------------------------------- export, samples, farm


def export(cam, heads):
    """earth.json for the page: frames, the loop, the shots, the phone crop, and where each label and marker sits on
    screen (0..1, top-left origin; null while it is hidden, behind the Earth or off screen) for its span of frames."""
    sc = bpy.context.scene
    marks = {}
    # the markers' labels go before the villa's front rises in front of them (labels have no occlusion test)
    rows = [(k, p, span) for k, (p, span) in shots.LABELS.items()] + \
           [(f"pin-{k}", heads[k], (shots.PIN_POP[0], 25.5)) for k, *_ in shots.PINS]
    for key, p, (a, b) in rows:
        f0, f1 = shots.frame_of(a), shots.frame_of(b)
        pts = []
        for f in range(f0, f1 + 1):
            sc.frame_set(f)
            v = world_to_camera_view(sc, cam, Vector(p))
            seen = v.z > 0 and -0.05 < v.x < 1.05 and -0.05 < v.y < 1.05
            if seen and shots.shot_of(shots.sec_of(f))[0] in shots.GLOBE:  # not round the back of the Earth
                seen = Vector(p).dot(cam.matrix_world.translation - Vector(p)) > 0
            pts.append([round(v.x, 4), round(1 - v.y, 4)] if seen else None)
        marks[key] = {"from": f0, "points": pts}
    old = {}
    if os.path.exists(EARTH_JSON):
        with open(EARTH_JSON, encoding="utf-8") as fh:
            old = json.load(fh)
    n = shots.FRAMES + 1
    logo = old.get("logo") if old.get("frames") == n else None
    out = {"fps": shots.FPS, "frames": n, "loop": [1, shots.frame_of(shots.LOOP)], "map": shots.MAP,
           "shots": [[s[0], shots.frame_of(s[1])] for s in shots.SHOTS], "crop": shots.CROP,
           "pins": {k: kind for k, _, _, kind in shots.PINS}, "marks": marks,
           "logo": logo or {"desk": "D" * n, "phone": "D" * n}}
    with open(EARTH_JSON, "w", encoding="utf-8") as fh:
        json.dump(out, fh, separators=(",", ":"))
    sc.frame_set(1)


def key_samples(sc):
    c = sc.cycles
    c.adaptive_threshold = 0.02
    for f in range(1, shots.FRAMES + 2):
        name = shots.shot_of(shots.sec_of(f))[0]
        c.samples = SAMPLES["sky" if name in shots.SKY else "earth" if name in shots.GLOBE else "city"]
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
    blend = os.path.join(folder, "earth-sheepit.blend")
    bpy.ops.wm.save_as_mainfile(filepath=blend, compress=True)
    with zipfile.ZipFile(blend[:-6] + ".zip", "w", zipfile.ZIP_STORED) as z:  # already compressed
        z.write(blend, "earth-sheepit.blend")
    print(f"[earth] farm project -> {blend[:-6]}.zip ({os.path.getsize(blend[:-6] + '.zip') / 1e6:.0f} MB)", flush=True)


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
    sc.cycles.volume_step_rate = 2.0 if OPT["preview"] else 1.0
    sc.cycles.volume_max_steps = 512
    sc.cycles.volume_bounces = 4  # cloud white comes from light scattered many times inside it
    for name, table in (("night", "night"), ("lamps", "lamps"), ("wisps", "wisps"), ("beacons", "beacons"),
                        ("india_beacons", "india_beacons")):
        keyed(sc, name, lambda s, t=shots.TABLES[table]: pw(t, s))
    keyed(sc, "beacon_glow", lambda s: 1.0)
    keyed(sc, "dawn", lambda s: 1.0 if shots.shot_of(s)[0] in shots.SKY else 0.0)
    keyed(sc, "space", lambda s: 1.0 if shots.shot_of(s)[0] in shots.GLOBE else 0.0)
    for i, name in enumerate(("cl1", "cl2", "clb")):
        keyed(sc, name, lambda s, i=i: shots.cloud_phase(s)[i])
    _linear(sc.animation_data)
    skies(sc)
    sc.world.mist_settings.start = 1e6  # (mist pass unused)
    cloud_sea()
    globe.build(globe.maps())
    bengaluru()
    heads = pins(sc)
    cam = camera(sc)
    if not OPT["preview"]:
        key_samples(sc)
    export(cam, heads)
    os.makedirs(OUT, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "earth-preview.blend" if OPT["preview"] else "earth.blend"))


def render_stills(secs):
    sc = bpy.context.scene
    os.makedirs(os.path.join(OUT, "stills"), exist_ok=True)
    for s in secs:
        sc.frame_set(shots.frame_of(s))
        sc.render.filepath = os.path.join(OUT, "stills", f"s{s:g}.png")
        bpy.ops.render.render(write_still=True)
        print(f"[earth] still {s}s -> {sc.render.filepath}", flush=True)


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
                print(f"[earth] pass {step}: {name}", flush=True)
