"""The Earth for the explorer film: a globe of radius R km at the origin (z the north pole, x through lon 0, y through
lon 90E) in NASA's imagery, a cloud shell, a thin atmosphere, India's and Karnataka's borders drawn in gold, and beacons
rising over the world's cities.

Imagery from NASA GIBS (public domain; credit NASA): Blue Marble Next Generation by day, VIIRS Black Marble by night,
one January day of VIIRS true colour for the clouds. Fetched once over WMS into the cache in 2048 px chunks and stitched:
a global map plus two sharper patches (all India; south India around Karnataka) for the close shots. Any map can be
replaced by hand: drop an equirectangular image of the same extent at the path the error names.
Borders and cities (geo.json): Natural Earth 10 m (public domain), India's own view of its borders (admin_0_countries_ind).
"""
import json
import math
import os
import urllib.parse
import urllib.request

import bpy
import bmesh
import numpy as np
from mathutils import Vector

import earth_shots as shots
import kit
from house import _drive
from path import pw

CACHE = os.path.join(os.environ.get("LOCALAPPDATA", os.path.expanduser("~")), "gharaana-film", "assets", "earth")
GEO = os.path.join(os.path.dirname(os.path.abspath(__file__)), "geo.json")
WMS = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi"
# each map's GIBS layers, tried in order: (layer, TIME or None, format)
LAYERS = {
    "day": [("BlueMarble_NextGeneration", None, "image/jpeg"), ("BlueMarble_ShadedRelief_Bathymetry", None, "image/jpeg")],
    "night": [("VIIRS_Black_Marble", "2016-01-01", "image/png"), ("VIIRS_CityLights_2012", None, "image/jpeg")],
    "clouds": [("VIIRS_SNPP_CorrectedReflectance_TrueColor", "2024-01-15", "image/jpeg"),
               ("MODIS_Terra_CorrectedReflectance_TrueColor", "2024-01-15", "image/jpeg")],
}
# extents (lon0, lat0, lon1, lat1) and widths: the whole Earth at ~4.9 km a pixel, India at ~1.1 km, south India at ~440 m
TIERS = {"world": ((-180.0, -90.0, 180.0, 90.0), 8192), "india": ((66.0, 4.0, 100.0, 38.0), 3400),
         "south": ((71.0, 9.0, 82.0, 20.0), 2750)}
CHUNK = 2048
GOLD = (1.0, 0.5, 0.13)  # saturated: AgX bleaches bright light towards white


def show(o, spans):
    """Renders only within these (from s, to s) spans of the film."""
    o.hide_render = True
    o.keyframe_insert("hide_render", frame=1)
    for a, b in spans:
        o.hide_render = False
        o.keyframe_insert("hide_render", frame=shots.frame_of(a))
        o.hide_render = True
        o.keyframe_insert("hide_render", frame=shots.frame_of(b))
    for fc in o.animation_data.action.fcurves:
        for kp in fc.keyframe_points:
            kp.interpolation = "CONSTANT"


# ---------------------------------------------------------------- imagery


def _wms(kind, bbox, w, h, path):
    errors = []
    for layer, time, fmt in LAYERS[kind]:
        q = {"SERVICE": "WMS", "REQUEST": "GetMap", "VERSION": "1.1.1", "LAYERS": layer, "STYLES": "", "SRS": "EPSG:4326",
             "BBOX": ",".join(f"{v:g}" for v in bbox), "WIDTH": w, "HEIGHT": h, "FORMAT": fmt}
        if time:
            q["TIME"] = time
        url = WMS + "?" + urllib.parse.urlencode(q)
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "gharaana-film/1"})
            with urllib.request.urlopen(req, timeout=300) as r:
                data = r.read()
                if not r.headers.get_content_type().startswith("image/"):  # a WMS error comes back as XML
                    raise OSError(data[:300].decode("utf-8", "replace"))
        except OSError as e:
            errors.append(f"{layer}: {e}")
            continue
        with open(path, "wb") as f:
            f.write(data)
        return
    raise SystemExit(f"[earth] could not fetch the {kind} map from NASA GIBS ({'; '.join(errors)}).\n"
                     f"Put an equirectangular image of lon/lat {bbox} there by hand: {path}")


def _pixels(path):
    """An image's pixels as a uint8 (rows bottom-up, as Blender keeps them, RGBA) array."""
    img = bpy.data.images.load(path)
    w, h = img.size
    buf = np.empty(w * h * 4, np.float32)
    img.pixels.foreach_get(buf)
    bpy.data.images.remove(img)
    return (buf.reshape(h, w, 4) * 255 + 0.5).astype(np.uint8)


def fetch(kind, tier):
    """The cached map (fetching and stitching it once): kind day|night|clouds, tier world|india|south."""
    path = os.path.join(CACHE, f"{kind}_{tier}.jpg")
    if os.path.exists(path):
        return path
    (lon0, lat0, lon1, lat1), w = TIERS[tier]
    h = round(w * (lat1 - lat0) / (lon1 - lon0))
    nx, ny = -(-w // CHUNK), -(-h // CHUNK)
    cw, ch = w // nx, h // ny
    w, h = cw * nx, ch * ny
    os.makedirs(os.path.join(CACHE, "chunks"), exist_ok=True)
    big = np.zeros((h, w, 4), np.uint8)
    for iy in range(ny):  # iy 0 is the northernmost row
        for ix in range(nx):
            bbox = (lon0 + (lon1 - lon0) * ix / nx, lat1 - (lat1 - lat0) * (iy + 1) / ny,
                    lon0 + (lon1 - lon0) * (ix + 1) / nx, lat1 - (lat1 - lat0) * iy / ny)
            part = os.path.join(CACHE, "chunks", f"{kind}_{tier}_{iy}_{ix}.img")
            if not os.path.exists(part):
                _wms(kind, bbox, cw, ch, part + ".part")
                os.replace(part + ".part", part)
            px = _pixels(part)
            big[h - (iy + 1) * ch:h - iy * ch, ix * cw:(ix + 1) * cw] = px[:ch, :cw]
            print(f"[earth] {kind} {tier} chunk {iy},{ix}", flush=True)
    big[..., 3] = 255
    img = bpy.data.images.new(f"{kind}_{tier}", w, h)
    img.pixels.foreach_set((big.astype(np.float32) / 255).ravel())
    img.filepath_raw = path
    img.file_format = "JPEG"
    img.save(quality=92)
    bpy.data.images.remove(img)
    return path


def maps():
    """{kind: {tier: path}}; the clouds have the world tier only."""
    return {k: {t: fetch(k, t) for t in (TIERS if k != "clouds" else ("world",))} for k in LAYERS}


# ---------------------------------------------------------------- shading


def _sphere(name, radius, seg, mat, collection):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=seg // 2, radius=radius)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.shade_smooth()
    me.materials.append(mat)
    return kit.link(bpy.data.objects.new(name, me), collection)


def _lonlat(nd):
    """Longitude and latitude (degrees) of the shading point on a sphere centred on its object's origin."""
    tc = nd.new("ShaderNodeTexCoord")
    n = nd.new("ShaderNodeVectorMath", operation="NORMALIZE")
    nd.link(tc.outputs["Object"], n.inputs[0])
    xyz = nd.new("ShaderNodeSeparateXYZ")
    nd.link(n.outputs[0], xyz.inputs[0])
    lon = nd.math("MULTIPLY", nd.math("ARCTAN2", xyz.outputs["Y"], xyz.outputs["X"]), 180 / math.pi)
    lat = nd.math("MULTIPLY", nd.math("ARCSINE", xyz.outputs["Z"]), 180 / math.pi)
    return lon, lat


def _tier(nd, path, lon, lat, tier, srgb=True):
    """(colour, inside mask) of one map tier at lon/lat; the mask fades out over the patch's outer 3%."""
    (lon0, lat0, lon1, lat1), _ = TIERS[tier]
    u = nd.math("DIVIDE", nd.math("SUBTRACT", lon, lon0), lon1 - lon0)
    v = nd.math("DIVIDE", nd.math("SUBTRACT", lat, lat0), lat1 - lat0)
    uv = nd.new("ShaderNodeCombineXYZ")
    nd.link(u, uv.inputs["X"])
    nd.link(v, uv.inputs["Y"])
    t = nd.image(path, uv.outputs[0], srgb=srgb, box=False)
    t.extension = "REPEAT" if tier == "world" else "EXTEND"
    t.interpolation = "Linear" if tier == "world" else "Cubic"
    if tier == "world":
        return t.outputs["Color"], None
    m = 1.0
    for s in (u, v):
        for edge in (s, nd.math("SUBTRACT", 1.0, s)):
            r = nd.new("ShaderNodeMapRange", clamp=True)
            r.inputs["From Max"].default_value = 0.03
            nd.link(edge, r.inputs["Value"])
            m = nd.math("MULTIPLY", m, r.outputs["Result"]) if m != 1.0 else r.outputs["Result"]
    return t.outputs["Color"], m


def _layered(nd, tiers, lon, lat):
    col, _ = _tier(nd, tiers["world"], lon, lat, "world")
    for t in ("india", "south"):
        if t in tiers:
            c, m = _tier(nd, tiers[t], lon, lat, t)
            col = nd.mix("MIX", m, col, c)
    return col


def _sunlit(nd, lo, hi):
    """0 on the night side .. 1 in daylight, from the angle between the surface and the sun."""
    g = nd.new("ShaderNodeNewGeometry")
    sun = nd.new("ShaderNodeCombineXYZ")
    for k, v in zip("XYZ", sun_dir()):
        sun.inputs[k].default_value = v
    d = nd.new("ShaderNodeVectorMath", operation="DOT_PRODUCT")
    nd.link(g.outputs["Normal"], d.inputs[0])
    nd.link(sun.outputs[0], d.inputs[1])
    r = nd.new("ShaderNodeMapRange", clamp=True)
    r.inputs["From Min"].default_value = lo
    r.inputs["From Max"].default_value = hi
    nd.link(d.outputs["Value"], r.inputs["Value"])
    return r.outputs["Result"], d.outputs["Value"]


def sun_dir():
    return Vector(shots.geo(*shots.SUN)).normalized()


def earth_material(m):
    mat, nd = kit._material("earth")
    lon, lat = _lonlat(nd)
    day = _layered(nd, m["day"], lon, lat)
    night = _layered(nd, m["night"], lon, lat)
    rgb = nd.new("ShaderNodeSeparateColor")
    nd.link(day, rgb.inputs[0])
    # the sea: bluer than it is red or green (the imagery has no water mask)
    water = nd.math("MULTIPLY", nd.math("SUBTRACT", rgb.outputs["Blue"], nd.math("MAXIMUM", rgb.outputs["Red"], rgb.outputs["Green"])), 14.0, clamp=True)
    # aerial haze: the ground goes pale blue towards the limb and in the low, oblique views
    lw = nd.new("ShaderNodeLayerWeight")
    lw.inputs["Blend"].default_value = 0.5
    haze = nd.math("MULTIPLY", nd.math("POWER", lw.outputs["Facing"], 3.0), 0.55)
    base = nd.mix("MIX", haze, nd.mix("MULTIPLY", 1.0, day, (1.15, 1.12, 1.08, 1)), (0.40, 0.58, 0.95, 1))
    b = nd.new("ShaderNodeBsdfPrincipled")
    nd.link(base, b.inputs["Base Color"])
    nd.link(nd.math("SUBTRACT", 0.85, nd.math("MULTIPLY", water, 0.55)), b.inputs["Roughness"])
    nd.link(nd.math("ADD", 0.15, nd.math("MULTIPLY", water, 0.5)), b.inputs["Specular IOR Level"])
    # city lights on the night side, warmed to gold
    lit, _ = _sunlit(nd, 0.06, -0.14)
    bw = nd.new("ShaderNodeRGBToBW")
    nd.link(night, bw.inputs[0])
    glow = nd.math("MULTIPLY", nd.math("POWER", bw.outputs[0], 1.6), lit)
    nd.link(nd.mix("MULTIPLY", 1.0, night, (*GOLD, 1)), b.inputs["Emission Color"])
    nd.link(nd.math("MULTIPLY", glow, 9.0), b.inputs["Emission Strength"])
    kit._out(nd, b.outputs[0])
    return mat


def cloud_material(m):
    mat, nd = kit._material("earth_clouds")
    lon, lat = _lonlat(nd)
    col, _ = _tier(nd, m["clouds"]["world"], lon, lat, "world")
    rgb = nd.new("ShaderNodeSeparateColor")
    nd.link(col, rgb.inputs[0])
    # cloud: bright in every channel (land and sea always have a dark one; deserts are low in blue)
    low = nd.math("MINIMUM", nd.math("MINIMUM", rgb.outputs["Red"], rgb.outputs["Green"]), rgb.outputs["Blue"])
    a = nd.new("ShaderNodeMapRange", clamp=True)
    a.inputs["From Min"].default_value = 0.34
    a.inputs["From Max"].default_value = 0.66
    nd.link(low, a.inputs["Value"])
    b = nd.new("ShaderNodeBsdfPrincipled")
    b.inputs["Base Color"].default_value = (0.92, 0.92, 0.94, 1)
    b.inputs["Roughness"].default_value = 1.0
    b.inputs["Specular IOR Level"].default_value = 0.1
    t = nd.new("ShaderNodeBsdfTransparent")
    mx = nd.new("ShaderNodeMixShader")
    nd.link(nd.math("MULTIPLY", a.outputs["Result"], 0.96), mx.inputs[0])
    nd.link(t.outputs[0], mx.inputs[1])
    nd.link(b.outputs[0], mx.inputs[2])
    kit._out(nd, mx.outputs[0])
    return mat


def atmosphere_material():
    """A rim of light at the limb: blue in daylight, orange along the terminator, nothing on the night side."""
    mat, nd = kit._material("earth_air")
    lw = nd.new("ShaderNodeLayerWeight")
    lw.inputs["Blend"].default_value = 0.5
    f = lw.outputs["Facing"]
    rise = nd.new("ShaderNodeMapRange", clamp=True)
    rise.inputs["From Min"].default_value = 0.5
    rise.inputs["From Max"].default_value = 0.9
    nd.link(f, rise.inputs["Value"])
    fall = nd.new("ShaderNodeMapRange", clamp=True)
    fall.inputs["From Min"].default_value = 1.0
    fall.inputs["From Max"].default_value = 0.94
    nd.link(f, fall.inputs["Value"])
    rim = nd.math("MULTIPLY", nd.math("POWER", rise.outputs["Result"], 2.0), fall.outputs["Result"])
    lit, ndl = _sunlit(nd, -0.15, 0.35)
    warm = nd.new("ShaderNodeMapRange", clamp=True)
    warm.inputs["From Min"].default_value = -0.05
    warm.inputs["From Max"].default_value = 0.45
    nd.link(ndl, warm.inputs["Value"])
    col = nd.mix("MIX", warm.outputs["Result"], (1.0, 0.42, 0.14, 1), (0.30, 0.56, 1.0, 1))
    e = nd.new("ShaderNodeEmission")
    nd.link(col, e.inputs["Color"])
    nd.link(nd.math("MULTIPLY", nd.math("MULTIPLY", rim, lit), 3.0), e.inputs["Strength"])
    t = nd.new("ShaderNodeBsdfTransparent")
    add = nd.new("ShaderNodeAddShader")
    nd.link(t.outputs[0], add.inputs[0])
    nd.link(e.outputs[0], add.inputs[1])
    kit._out(nd, add.outputs[0])
    return mat


def glow_material(name, strength, halo=False):
    """Gold light: the borders' core; halo=True a faint wider glow around it, seen by the camera only."""
    mat, nd = kit._material(name)
    e = nd.new("ShaderNodeEmission")
    e.inputs["Color"].default_value = (*GOLD, 1)
    e.inputs["Strength"].default_value = strength
    if not halo:
        kit._out(nd, e.outputs[0])
        return mat
    lw = nd.new("ShaderNodeLayerWeight")  # brightest on the tube's axis, fading to its edge
    lw.inputs["Blend"].default_value = 0.5
    k = nd.math("POWER", nd.math("SUBTRACT", 1.0, lw.outputs["Facing"]), 2.0)
    t = nd.new("ShaderNodeBsdfTransparent")
    mx = nd.new("ShaderNodeMixShader")
    nd.link(nd.math("MULTIPLY", k, 0.5), mx.inputs[0])
    nd.link(t.outputs[0], mx.inputs[1])
    nd.link(e.outputs[0], mx.inputs[2])
    kit._out(nd, mx.outputs[0])
    return mat


def beam_material():
    """A city's beacon: a light beam fading upwards, a bright bead on top (object z 0..1, the bead above 0.93)."""
    mat, nd = kit._material("beacon")
    tc = nd.new("ShaderNodeTexCoord")
    z = nd.new("ShaderNodeSeparateXYZ")
    nd.link(tc.outputs["Object"], z.inputs[0])
    fade = nd.math("POWER", nd.math("SUBTRACT", 1.0, z.outputs["Z"], clamp=True), 1.5)
    # (bright enough to glow, not so bright that the gold burns out to white)
    s = nd.math("ADD", nd.math("MULTIPLY", fade, 1.8), nd.math("MULTIPLY", nd.math("GREATER_THAN", z.outputs["Z"], 0.93), 4.0))
    e = nd.new("ShaderNodeEmission")
    e.inputs["Color"].default_value = (*GOLD, 1)
    nd.link(nd.math("MULTIPLY", s, _drive(nd, "beacon_glow")), e.inputs["Strength"])
    kit._out(nd, e.outputs[0])
    return mat


# ---------------------------------------------------------------- the set


def _camera_only(o):
    o.visible_shadow = o.visible_diffuse = o.visible_glossy = o.visible_transmission = o.visible_volume_scatter = False


def _border(name, rings, mat, collection):
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_resolution = 2
    cu.use_fill_caps = True
    for ring in rings:
        sp = cu.splines.new("POLY")
        sp.points.add(len(ring) - 1)
        for p, (lon, lat) in zip(sp.points, ring):
            p.co = (*shots.geo(lon, lat, 2.5), 1.0)
    cu.materials.append(mat)
    return kit.link(bpy.data.objects.new(name, cu), collection)


def _key_curve(o, draw, width):
    """Draws the border in (bevel_factor_end) and keeps it a steady width on screen, keyed every frame."""
    for f in range(1, shots.FRAMES + 2):
        s = shots.sec_of(f)
        o.data.bevel_factor_end = max(0.0, min(1.0, pw(shots.TABLES[draw], s)))
        o.data.bevel_depth = pw(shots.TABLES["border_km"], s) * width
        o.data.keyframe_insert("bevel_factor_end", frame=f)
        o.data.keyframe_insert("bevel_depth", frame=f)


def _beacon_mesh():
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=10, radius1=0.035, radius2=0.035, depth=0.93)
    bmesh.ops.translate(bm, verts=bm.verts, vec=(0, 0, 0.465))
    head = bmesh.ops.create_icosphere(bm, subdivisions=2, radius=0.07)
    bmesh.ops.translate(bm, verts=head["verts"], vec=(0, 0, 0.99))
    me = bpy.data.meshes.new("beacon")
    bm.to_mesh(me)
    bm.free()
    me.shade_smooth()
    me.materials.append(beam_material())
    return me


def _beacon(name, me, lon, lat, height, prop, delay, collection):
    """A beacon standing on the globe, its height driven by scene[prop] (0..1, each one rising a little after the last)."""
    o = kit.link(bpy.data.objects.new(name, me), collection)
    p = Vector(shots.geo(lon, lat, 0.5))
    o.location = p
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = p.normalized().to_track_quat("Z", "Y")
    for i in range(3):
        d = o.driver_add("scale", i).driver
        v = d.variables.new()
        v.name = "v"
        v.targets[0].id_type = "SCENE"
        v.targets[0].id = bpy.context.scene
        v.targets[0].data_path = f'["{prop}"]'
        d.expression = f"max(0.001, min(1.0, v * 1.6 - {delay:.3f})) * {height:g}"
    return o


def build(m):
    """The Earth set; m is maps(). Everything is keyed to render only in the Earth shots."""
    sc = bpy.context.scene
    c = kit.coll("earth")
    parts = [
        _sphere("earth", shots.R, 1024, earth_material(m), c),
        _sphere("earth_clouds", shots.R + 7.0, 768, cloud_material(m), c),
    ]
    air = _sphere("earth_air", shots.R + 65.0, 768, atmosphere_material(), c)
    _camera_only(air)
    parts.append(air)
    with open(GEO, encoding="utf-8") as fh:
        geo = json.load(fh)
    core, halo = glow_material("border", 4.0), glow_material("border_halo", 0.8, halo=True)
    for name, rings in (("india", geo["india"]), ("karnataka", geo["karnataka"])):
        for kind, mat, width in (("", core, 1.0), ("_halo", halo, 3.2)):
            o = _border(f"border_{name}{kind}", rings, mat, c)
            _key_curve(o, name, width)
            if kind:
                _camera_only(o)
            parts.append(o)
    me = _beacon_mesh()
    for i, (name, lon, lat) in enumerate(geo["world"]):
        parts.append(_beacon(f"beacon_w{i}", me, lon, lat, 150.0, "beacons", ((lon + 180) % 360) / 360 * 0.6, c))
    for i, (name, lon, lat) in enumerate(geo["india_cities"]):
        h = 260.0 if name == "Bengaluru" else 130.0
        parts.append(_beacon(f"beacon_i{i}", me, lon, lat, h, "india_beacons", 0.3 * i / len(geo["india_cities"]), c))
    for o in parts:
        if o.name.startswith("beacon"):  # their light would only add noise to the globe
            _camera_only(o)
        show(o, shots.SHOW["earth"])
    sun = bpy.data.objects.new("sun_space", bpy.data.lights.new("sun_space", "SUN"))
    c.objects.link(sun)
    sun.data.angle = math.radians(0.53)
    sun.data.color = (1.0, 0.97, 0.93)
    sun.rotation_mode = "QUATERNION"
    sun.rotation_quaternion = sun_dir().to_track_quat("Z", "Y")
    for s, e in ((0.0, 0.0), (7.0, 5.0), (14.0, 0.0)):  # on only for the Earth shots
        sun.data.energy = e
        sun.data.keyframe_insert("energy", frame=shots.frame_of(s))
    for fc in sun.data.animation_data.action.fcurves:
        for kp in fc.keyframe_points:
            kp.interpolation = "CONSTANT"
    return c
