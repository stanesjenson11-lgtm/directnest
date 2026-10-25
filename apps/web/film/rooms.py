"""The three rooms the villa film shows, each a set built after its reference photo and lit like an architectural
photograph: daylight through its windows (the film's sky, with portal lights so the daylight resolves cleanly), warm
recessed lights, and a soft fill.

  hall: a wood portal and open shelving; a marble TV wall between slatted oak panels, louvred windows either side; two
        slatted oak sofas, a coffee table and a patchwork rug on a herringbone floor; a wood-panelled ceiling and fan.
  bedroom: an oak-panelled wall with a cove light; a low upholstered bed; a black-framed glass wall to a garden terrace.
  bath: split-face stone walls, a frameless shower, a floating wood vanity with a stone vessel basin and a round
        backlit mirror, a freestanding tub, and a slatted screen to a planted court.

Each set stands at its own origin (shots.HALL/BED/BATH), far from the city, and is on screen only during its shot.
"""
import math
import random

import bmesh
import bpy

import house
import kit
import ph
import shots
from kit import Boxes, srgb


# ---------------------------------------------------------------- helpers


def _coll(name):
    return kit.coll(name)


def _place(objs, origin, span):
    for o in objs:
        o.location = tuple(a + b for a, b in zip(o.location, origin))
        house.show(o, [span])


class Set:
    """Collects a room's pieces (boxes by material, imported models, lights), then builds them at the room's origin."""

    def __init__(self, name):
        self.name = name
        self.c = _coll(name)
        self.boxes = {}
        self.objs = []

    def box(self, mat, *b):
        self.boxes.setdefault(mat, Boxes()).add(*b)

    def mesh(self, name, verts, faces, mat, smooth=False, at=None, rot=None):
        """verts in place, or (with at) round their own origin, placed at `at` and turned by `rot` about it."""
        o = kit.mesh_obj(f"{self.name}_{name}", verts, faces, mat, self.c, smooth)
        if at:
            o.location = at
        if rot:
            o.rotation_euler = rot
        self.objs.append(o)
        return o

    def model(self, asset, x, y, z, rot=0.0, height=None, scale=1.0, paint=None):
        m, h = ph.model(asset)
        if paint:  # repaint the model's own materials (shared by every instance of it)
            for o in m.all_objects:
                for slot in getattr(o, "material_slots", []):
                    bsdf = slot.material and slot.material.node_tree and slot.material.node_tree.nodes.get("Principled BSDF")
                    if bsdf:
                        for l in list(bsdf.inputs["Base Color"].links):
                            slot.material.node_tree.links.remove(l)
                        bsdf.inputs["Base Color"].default_value = (*srgb(paint), 1)
        s = (height / max(0.01, h)) if height else scale
        o = kit.instance(f"{self.name}_{asset}_{len(self.objs)}", m, x, y, z, rot, s, self.c)
        self.objs.append(o)
        return o

    def light(self, kind, loc, energy, color=(1.0, 0.82, 0.62), size=0.1, rot=(0, 0, 0), spot=None, portal=False, size_y=None):
        d = bpy.data.lights.new(f"{self.name}_l{len(self.objs)}", kind)
        d.energy = energy
        d.color = color
        if kind == "AREA":
            d.shape = "RECTANGLE"
            d.size = size
            d.size_y = size_y or size
            d.cycles.is_portal = portal
        else:
            d.shadow_soft_size = size
        if spot:
            d.spot_size, d.spot_blend = math.radians(spot[0]), spot[1]
        o = kit.link(bpy.data.objects.new(d.name, d), self.c)
        o.location = loc
        o.rotation_euler = rot
        self.objs.append(o)
        return o

    def done(self, origin, span, mats):
        for key, b in self.boxes.items():
            o = b.build(f"{self.name}_{key}", mats[key], self.c)
            if key not in ("glass", "glow", "led", "sky_card"):
                m = o.modifiers.new("bevel", "BEVEL")
                m.width, m.segments, m.limit_method = 0.006, 2, "ANGLE"
            self.objs.append(o)
        _place(self.objs, origin, span)


def _lathe(profile, seg=48):
    """(r, z) profile turned round the z axis: tubs, basins, vases."""
    verts, faces = [], []
    n = len(profile)
    for i in range(seg):
        a = i / seg * math.tau
        for r, z in profile:
            verts.append((r * math.cos(a), r * math.sin(a), z))
    for i in range(seg):
        j = (i + 1) % seg
        for k in range(n - 1):
            faces.append((i * n + k, j * n + k, j * n + k + 1, i * n + k + 1))
    return verts, faces


def _cushion(sx, sy, sz, puff=0.35, seg=10):
    """A soft cushion: a superellipse block, its faces bulging a little (verts, faces, centred, bottom at z = 0)."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=seg, use_grid_fill=True)
    for v in bm.verts:
        x, y, z = v.co.x * 2, v.co.y * 2, v.co.z * 2  # -1..1
        r = max(abs(x), abs(y), abs(z))
        p = 4.0  # superellipse: rounded corners, flat-ish faces
        k = (abs(x) ** p + abs(y) ** p + abs(z) ** p) ** (1 / p)
        x, y, z = x / k * r, y / k * r, z / k * r
        bulge = 1 + puff * (1 - x * x) * (1 - y * y) * 0.5
        v.co.x, v.co.y, v.co.z = x * sx / 2, y * sy / 2, (z * bulge * sz / 2) + sz / 2
    verts = [tuple(v.co) for v in bm.verts]
    faces = [tuple(v.index for v in f.verts) for f in bm.faces]
    bm.free()
    return verts, faces


def _moved(vf, dx, dy, dz, rz=0.0):
    v, f = vf
    c, s = math.cos(rz), math.sin(rz)
    return [(x * c - y * s + dx, x * s + y * c + dy, z + dz) for x, y, z in v], f


def fabric(name, asset, tint, scale=0.5, sheen=0.4):
    m, nd = kit._material(name)
    if not nd:
        return m
    col, rough, height = house._layer(nd, asset, scale, tint, res="1k")
    b = nd.new("ShaderNodeBsdfPrincipled")
    nd.link(col, b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 0.9
    b.inputs["Sheen Weight"].default_value = sheen
    bp = nd.new("ShaderNodeBump")
    bp.inputs["Strength"].default_value = 0.25
    nd.link(height, bp.inputs["Height"])
    nd.link(bp.outputs["Normal"], b.inputs["Normal"])
    kit._out(nd, b.outputs[0])
    return m


def patchwork(name):
    """A hide-patchwork rug: irregular cells in soft greys and ivory, a fine pile."""
    m, nd = kit._material(name)
    if not nd:
        return m
    vec = nd.world_pos(1.0)
    vo = nd.new("ShaderNodeTexVoronoi")
    vo.inputs["Scale"].default_value = 4.2
    nd.link(vec, vo.inputs["Vector"])
    col = nd.ramp(vo.outputs["Color"], [0xe9e7e3, 0xc9c7c4, 0xdcdad6, 0xb3b1ae, 0xf1efea, 0xa6a4a1])
    edge = nd.new("ShaderNodeTexVoronoi", feature="DISTANCE_TO_EDGE")
    edge.inputs["Scale"].default_value = 4.2
    nd.link(vec, edge.inputs["Vector"])
    seam = nd.math("LESS_THAN", edge.outputs["Distance"], 0.02)
    col = nd.mix("MIX", nd.math("MULTIPLY", seam, 0.5), col, (0.55, 0.54, 0.52, 1))
    pile = nd.new("ShaderNodeTexNoise", noise_dimensions="3D")
    pile.inputs["Scale"].default_value = 300.0
    nd.link(vec, pile.inputs["Vector"])
    b = nd.new("ShaderNodeBsdfPrincipled")
    nd.link(col, b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 0.95
    b.inputs["Sheen Weight"].default_value = 0.6
    bp = nd.new("ShaderNodeBump")
    bp.inputs["Strength"].default_value = 0.3
    nd.link(pile.outputs["Fac"], bp.inputs["Height"])
    nd.link(bp.outputs["Normal"], b.inputs["Normal"])
    kit._out(nd, b.outputs[0])
    return m


def emit(name, color, strength):
    m, nd = kit._material(name)
    if not nd:
        return m
    e = nd.new("ShaderNodeEmission")
    e.inputs["Color"].default_value = (*srgb(color), 1)
    e.inputs["Strength"].default_value = strength
    kit._out(nd, e.outputs[0])
    return m


def sheer(name, color=0xece6dc):
    """Sheer linen: light passes through, glowing where the sun is behind it."""
    m, nd = kit._material(name)
    if not nd:
        return m
    b = nd.new("ShaderNodeBsdfDiffuse")
    b.inputs["Color"].default_value = (*srgb(color), 1)
    t = nd.new("ShaderNodeBsdfTranslucent")
    t.inputs["Color"].default_value = (*srgb(color), 1)
    tr = nd.new("ShaderNodeBsdfTransparent")
    mx = nd.new("ShaderNodeMixShader")
    mx.inputs[0].default_value = 0.55
    nd.link(b.outputs[0], mx.inputs[1])
    nd.link(t.outputs[0], mx.inputs[2])
    mx2 = nd.new("ShaderNodeMixShader")
    mx2.inputs[0].default_value = 0.25
    nd.link(mx.outputs[0], mx2.inputs[1])
    nd.link(tr.outputs[0], mx2.inputs[2])
    kit._out(nd, mx2.outputs[0])
    return m


def split_stone(name):
    """Split-face stone tiles: a rough quarried face, laid in a running bond with fine joints."""
    m, nd = kit._material(name)
    if not nd:
        return m
    col, rough, height = house._layer(nd, "rock_face_03", 0.9, 0xc9ab8d, res="2k")
    u, v = kit._plane_uv(nd, (0.62, 0.41))
    row = nd.math("FLOOR", v)
    uu = nd.math("FRACT", nd.math("ADD", u, nd.math("MULTIPLY", nd.math("MODULO", row, 2.0), 0.5)))
    vv = nd.math("FRACT", v)
    edge = nd.math("MAXIMUM", nd.math("MAXIMUM", nd.math("LESS_THAN", uu, 0.008), nd.math("GREATER_THAN", uu, 0.992)),
                   nd.math("MAXIMUM", nd.math("LESS_THAN", vv, 0.012), nd.math("GREATER_THAN", vv, 0.988)))
    cell = nd.new("ShaderNodeCombineXYZ")
    nd.link(nd.math("FLOOR", nd.math("ADD", u, nd.math("MULTIPLY", nd.math("MODULO", row, 2.0), 0.5))), cell.inputs[0])
    nd.link(row, cell.inputs[1])
    wn = nd.new("ShaderNodeTexWhiteNoise", noise_dimensions="3D")
    nd.link(cell.outputs[0], wn.inputs["Vector"])
    shade = nd.math("ADD", 0.86, nd.math("MULTIPLY", wn.outputs["Value"], 0.26))
    sc = nd.new("ShaderNodeCombineColor")
    for i in range(3):
        nd.link(shade, sc.inputs[i])
    col = nd.mix("MULTIPLY", 1.0, col, sc.outputs[0])
    col = nd.mix("MIX", edge, col, (*srgb(0x8f7a64), 1))
    b = nd.new("ShaderNodeBsdfPrincipled")
    nd.link(col, b.inputs["Base Color"])
    nd.link(rough, b.inputs["Roughness"])
    bp = nd.new("ShaderNodeBump")
    bp.inputs["Strength"].default_value = 0.9
    bp.inputs["Distance"].default_value = 0.02
    nd.link(nd.math("SUBTRACT", nd.math("MULTIPLY", height, 1.0), nd.math("MULTIPLY", edge, 0.6)), bp.inputs["Height"])
    nd.link(bp.outputs["Normal"], b.inputs["Normal"])
    kit._out(nd, b.outputs[0])
    return m


def mats():
    oak = 0xc69f74
    return {
        "oak": kit.pbr("room_oak", "oak_veneer_01", 1.1, tint=oak, bump=0.08),
        "oak_dark": kit.pbr("room_oak_dark", "oak_veneer_01", 1.1, tint=0x8e6440, bump=0.08),
        "oak_v": kit.pbr("room_oak_v", "oak_veneer_01", 1.1, tint=oak, bump=0.08, rot=(0, math.pi / 2, 0)),
        "panel": kit.tiles("room_oak_panel", "oak_veneer_01", 1.1, 0xc4a078, rough=0.45, size=(0.58, 9.0), grout=0x7d5f42),
        "herring": kit.pbr("room_herringbone", "herringbone_parquet", 2.2, tint=0xd3b48c, bump=0.1),
        "floor_oak": kit.pbr("room_floor_oak", "oak_veneer_01", 1.8, tint=0xb48a62, bump=0.05),
        "marble": kit.pbr("room_marble", "marble_01", 2.6, bump=0.02),
        "wall": kit.pbr("room_wall", "beige_wall_001", 2.0, tint=0xf0ebe3, bump=0.03),
        "ceiling": kit.flat("room_ceiling", 0xf4f2ee, rough=0.9),
        "lacquer": kit.flat("room_lacquer", 0xeeebe5, rough=0.3, coat=0.4),
        "black": kit.flat("room_black", 0x141414, rough=0.4),
        "tv": kit.flat("room_tv", 0x070707, rough=0.06, coat=1.0),
        "louvre": kit.flat("room_louvre", 0xf1f1ef, rough=0.4),
        "frame_grey": kit.flat("room_frame_grey", 0xbdbdbb, rough=0.4, metal=0.5),
        "brass": kit.flat("room_brass", 0xc8a052, rough=0.25, metal=1.0),
        "steel": kit.flat("room_steel", 0x1b1b1b, rough=0.35, metal=0.6),
        "glass": kit.glass("room_glass", 0xe4ecea, rough=0.0),
        "cushion": fabric("room_cushion", "rough_linen", 0xe7e3dc),
        "pillow_rust": fabric("room_pillow_rust", "velour_velvet", 0xc0602c, scale=0.4),
        "pillow_grey": fabric("room_pillow_grey", "velour_velvet", 0x7f7b76, scale=0.4),
        "pillow_dark": fabric("room_pillow_dark", "rough_linen", 0x4d4945),
        "pillow_white": fabric("room_pillow_white", "rough_linen", 0xdedad3),
        "rug": patchwork("room_rug"),
        "art_bw": kit.painting("room_art_bw", [0x1d1d1d, 0xd9d6d0, 0x6f6c68, 0xf3f1ec, 0x2e2d2b], seed=3.0),
        "art_gold": kit.painting("room_art_gold", [0xe7e3dc, 0xb59a5e, 0x4d4b48, 0xd9d4ca, 0x8a8478], seed=7.0),
        "art_green": kit.painting("room_art_green", [0x2d3b2a, 0x56704a, 0x1d241b, 0x7b9468, 0x39492f], seed=11.0),
        "mat_white": kit.flat("room_mat", 0xf2f0eb, rough=0.8),
        "led": emit("room_led", 0xffc98a, 9.0),
        "glow": emit("room_downlight_lens", 0xfff0d8, 25.0),
        "bed": fabric("room_bed", "rough_linen", 0xd6d0c6),
        "sheet": fabric("room_sheet", "rough_linen", 0xf1efea),
        "pillow_taupe": fabric("room_pillow_taupe", "rough_linen", 0xa69b8b),
        "throw": fabric("room_throw", "knitted_fleece", 0x6b5544, scale=0.35, sheen=0.6),
        "rug_wool": fabric("room_rug_wool", "rough_linen", 0xd6cfc4, scale=0.3),
        "curtain": sheer("room_curtain"),
        "stone": split_stone("room_split_stone"),
        "bath_floor": kit.tiles("room_bath_floor", "marble_01", 1.6, 0xcdbfac, rough=0.35, size=(0.9, 0.9), grout=0xa69886),
        "vanity": kit.pbr("room_vanity", "oak_veneer_01", 1.0, tint=0x8b5a36, bump=0.05),
        "basin": kit.pbr("room_basin", "rock_tile_floor", 0.6, tint=0xbfb5a8, bump=0.6),
        "tub": kit.flat("room_tub", 0xebe6de, rough=0.35, coat=0.3),
        "mirror": kit.flat("room_mirror", 0xe8e8e8, rough=0.01, metal=1.0),
        "pebbles": kit.pbr("room_pebbles", "river_small_rocks", 0.6, tint=0xa49684, bump=0.8),
        "towel": fabric("room_towel", "terry_cloth", 0xddd3c4, scale=0.4),
        "lawn": house.materials()["lawn"],
        "hedge": kit.leaf("room_hedge", 0x3f5e2a),
        "deck": kit.pbr("room_deck", "dark_wooden_planks", 1.0, tint=0x8a6748, bump=0.2),
        "court": kit.pbr("room_court_stone", "rock_wall_08", 1.4, tint=0xc9bba6, bump=0.8),
        "rattan": fabric("room_rattan", "rough_linen", 0xb88a52, scale=0.15, sheen=0.1),
    }


# ---------------------------------------------------------------- the hall


def hall():
    M = mats()
    S = Set("hall")
    W, D, H = 3.2, 5.6, 3.05  # half width, the TV wall's y, ceiling height
    S.box("herring", -W, -4.4, -0.05, W, D, 0.0)  # (back to behind the camera, which stands outside the portal)
    S.box("ceiling", -W, -4.4, H, W, D, H + 0.05)
    S.box("wall", -W - 0.2, -4.4, 0.0, -W, D, H)
    S.box("wall", W, -4.4, 0.0, W + 0.2, D, H)
    S.box("wall", -W, -4.6, 0.0, W, -4.4, H)
    S.box("oak", -W, -4.4, 0.0, -W + 0.02, D, 0.09)  # skirting
    S.box("oak", W - 0.02, -4.4, 0.0, W, D, 0.09)
    # the TV wall: louvred windows either side, between them slatted oak, marble and the floating console
    for x0, x1 in ((-W, -2.85), (-1.62, 1.62), (2.85, W)):
        S.box("wall", x0, D, 0.0, x1, D + 0.2, H)
    for x0, x1 in ((-2.85, -1.62), (1.62, 2.85)):
        S.box("wall", x0, D, 0.0, x1, D + 0.2, 0.72)
        S.box("wall", x0, D, 2.55, x1, D + 0.2, H)
        S.box("frame_grey", x0, D - 0.02, 0.72, x1, D + 0.02, 0.78)
        S.box("frame_grey", x0, D - 0.02, 2.49, x1, D + 0.02, 2.55)
        S.box("frame_grey", x0, D - 0.02, 0.72, x0 + 0.05, D + 0.02, 2.55)
        S.box("frame_grey", x1 - 0.05, D - 0.02, 0.72, x1, D + 0.02, 2.55)
        z = 0.82
        while z < 2.46:  # tilted blades: daylight between them
            blade = _cushion(x1 - x0 - 0.1, 0.09, 0.008, puff=0.0, seg=1)
            S.mesh(f"louvre{x0}_{z:.2f}", *blade, M["louvre"], at=((x0 + x1) / 2, D - 0.05, z), rot=(math.radians(-28), 0, 0))
            z += 0.075
        S.light("AREA", ((x0 + x1) / 2, D + 0.3, 1.63), 1.0, size=x1 - x0, size_y=1.85, rot=(math.radians(-90), 0, 0), portal=True)
    S.box("marble", -0.98, D - 0.04, 0.62, 0.98, D, 2.56)
    for side in (-1, 1):
        x0 = 0.98 if side > 0 else -1.62
        S.box("oak_dark", x0, D - 0.06, 0.62, x0 + 0.64, D - 0.04, 2.56)
        for k in range(9):  # vertical slats
            x = x0 + 0.03 + k * 0.072
            S.box("oak_v", x, D - 0.13, 0.62, x + 0.045, D - 0.06, 2.56)
        S.light("SPOT", (x0 + 0.32, D - 0.25, 2.5), 25.0, size=0.02, rot=(math.radians(18) * 0, 0, 0), spot=(40, 0.6))
    S.box("oak", -2.3, D - 0.32, 2.56, 2.3, D, 2.62)  # the ledge over it all
    S.box("lacquer", -2.3, D - 0.46, 0.3, 2.3, D - 0.02, 0.6)  # floating console
    S.box("oak", -2.3, D - 0.47, 0.6, 2.3, D - 0.02, 0.63)
    S.box("black", -0.62, D - 0.09, 1.2, 0.62, D - 0.05, 1.92)  # TV
    S.box("tv", -0.6, D - 0.095, 1.22, 0.6, D - 0.09, 1.9)
    for x in (-1.9, 1.9):
        S.model("potted_plant_02", x, D - 0.5, 0.0, 0.6, height=1.15)
    S.model("ceramic_vase_02", 0.62, D - 0.25, 0.63, 0.0, height=0.26)
    S.model("brass_vase_02", -0.62, D - 0.25, 0.63, 0.0, height=0.2)
    # the ceiling: a perimeter of downlights, an oak panel and the fan, and four oak beam ends with lights
    S.box("oak", -0.95, 1.9, H - 0.16, 0.95, 3.1, H)
    for k in range(4):
        S.box("oak_dark", -0.95 + k * 0.475, 1.9, H - 0.165, -0.95 + k * 0.475 + 0.006, 3.1, H - 0.16)
    S.model("ceiling_fan", 0.0, 2.5, H - 0.62, 0.3, height=0.6, paint=0xf1f0ec)
    for x in (-1.75, -0.9, 0.9, 1.75):
        S.box("oak", x - 0.17, 3.35, H - 0.22, x + 0.17, 3.85, H)
    lights = [(x, y) for x in (-2.4, 2.4) for y in (0.0, 1.4, 2.8, 4.2)] + [(x, 4.9) for x in (-1.2, 1.2)] + [(x, 3.6) for x in (-1.75, -0.9, 0.9, 1.75)]
    for x, y in lights:
        z = H - (0.22 if y == 3.6 else 0.0)
        S.box("glow", x - 0.045, y - 0.045, z - 0.006, x + 0.045, y + 0.045, z)
        S.light("SPOT", (x, y, z - 0.02), 32.0, size=0.03, spot=(95, 0.7))
    # the wood portal in the foreground, and the open shelves on its left
    S.box("oak", -W, -0.35, 2.78, W, 0.05, H)
    S.box("oak", 2.9, -0.35, 0.0, W, 0.05, 2.78)
    for x0, x1 in ((-W, -3.13), (-2.37, -2.3)):
        S.box("oak", x0, -0.42, 0.0, x1, 0.05, 2.78)
    S.box("oak", -2.3, -0.42, 0.0, -2.0, 0.05, 2.78)  # the post
    for z in (0.0, 0.42, 0.88, 1.34, 1.8, 2.26):
        S.box("oak", -3.13, -0.42, z, -2.37, 0.05, z + 0.04)
        S.box("glow", -3.0, -0.2, z + 0.4 - 0.004, -2.5, -0.15, z + 0.4)  # shelf lights
    S.model("book_encyclopedia_set_01", -2.75, -0.18, 1.34 + 0.04, 0.0, height=0.24)
    S.model("book_encyclopedia_set_01", -2.75, -0.18, 0.42 + 0.04, 0.0, height=0.26)
    S.model("horse_statue_01", -2.75, -0.18, 0.88 + 0.04, math.pi / 2, height=0.26)
    S.model("ceramic_vase_04", -2.75, -0.18, 1.8 + 0.04, 0.0, height=0.3)
    S.model("brass_vase_01", -2.75, -0.18, 2.26 + 0.04, 0.0, height=0.22)
    # framed black-and-white prints on the left wall, two tall abstracts on the right
    for y, z, w, h in ((1.0, 1.55, 0.42, 0.62), (1.62, 1.75, 0.38, 0.55), (1.62, 1.12, 0.38, 0.5), (2.2, 1.45, 0.3, 0.5), (2.65, 1.05, 0.36, 0.5)):
        S.box("black", -W, y - w / 2, z - h / 2, -W + 0.03, y + w / 2, z + h / 2)
        S.box("mat_white", -W + 0.03, y - w / 2 + 0.03, z - h / 2 + 0.03, -W + 0.032, y + w / 2 - 0.03, z + h / 2 - 0.03)
        S.box("art_bw", -W + 0.032, y - w / 2 + 0.08, z - h / 2 + 0.08, -W + 0.034, y + w / 2 - 0.08, z + h / 2 - 0.08)
    for y in (2.6, 3.25):
        S.box("black", W - 0.03, y - 0.27, 1.05, W, y + 0.27, 2.05)
        S.box("mat_white", W - 0.032, y - 0.24, 1.08, W - 0.03, y + 0.24, 2.02)
        S.box("art_gold", W - 0.034, y - 0.18, 1.18, W - 0.032, y + 0.18, 1.92)
    # two slatted oak sofas facing each other, the coffee table, the rug
    for side in (-1, 1):
        sofa(S, M, side * 1.95, 2.95, side)
    S.box("oak", -0.62, 2.55, 0.38, 0.62, 3.35, 0.43)
    S.box("oak", -0.6, 2.57, 0.1, 0.6, 3.33, 0.13)
    for x in (-0.58, 0.54):
        for y in (2.57, 3.29):
            S.box("oak", x, y, 0.0, x + 0.05, y + 0.05, 0.38)
    S.model("brass_candleholders", 0.2, 2.95, 0.43, 0.0, height=0.2)
    S.box("rug", -1.65, 1.75, 0.0, 1.65, 4.25, 0.012)
    S.box("brass", 2.62, 4.1, 0.0, 2.66, 4.14, 0.55)  # side table with a lamp
    S.box("brass", 2.9, 4.1, 0.0, 2.94, 4.14, 0.55)
    S.box("brass", 2.62, 4.38, 0.0, 2.66, 4.42, 0.55)
    S.box("brass", 2.9, 4.38, 0.0, 2.94, 4.42, 0.55)
    S.box("marble", 2.58, 4.06, 0.55, 2.98, 4.46, 0.58)
    S.box("brass", 2.76, 4.24, 0.58, 2.8, 4.28, 1.0)
    shade = _lathe([(0.17, 1.0), (0.2, 1.24), (0.0001, 1.24)], seg=32)
    S.mesh("lampshade", *_moved(shade, 2.78, 4.26, 0.0), M["cushion"], smooth=True)
    S.light("POINT", (2.78, 4.26, 1.1), 18.0, size=0.08)
    # daylight and a soft fill from behind the camera, as a photographer would
    S.light("AREA", (0.0, -4.1, 1.6), 160.0, color=(1.0, 0.95, 0.9), size=5.0, size_y=2.0, rot=(math.radians(90), 0, 0))
    S.done(shots.HALL, shots.SHOW["hall"][0], M)


def sofa(S, M, cx, cy, side):
    """An oak-framed sofa with slatted arms and back, a deep white seat cushion and scattered pillows; faces the room's
    centre (side -1: on the left, facing +x)."""
    L, Dp = 2.0, 0.82  # length along y, depth along x
    back = cx - side * Dp / 2  # the back runs along y at the wall side
    x0, x1 = sorted((back, cx + side * Dp / 2))
    S.box("oak", x0, cy - L / 2, 0.18, x1, cy + L / 2, 0.26)  # seat frame
    for y in (cy - L / 2, cy + L / 2 - 0.06):  # arms: two rails and slats
        S.box("oak", x0, y, 0.0, x1, y + 0.06, 0.08)
        S.box("oak", x0, y, 0.58, x1, y + 0.06, 0.64)
        for k in range(6):
            x = x0 + 0.04 + k * (Dp - 0.1) / 5
            S.box("oak", x, y + 0.01, 0.08, x + 0.035, y + 0.05, 0.58)
        S.box("oak", x0, y, 0.0, x0 + 0.06, y + 0.06, 0.64)
        S.box("oak", x1 - 0.06, y, 0.0, x1, y + 0.06, 0.64)
    bx0, bx1 = (back - 0.06, back) if side < 0 else (back, back + 0.06)
    bx0, bx1 = sorted((back, back - side * 0.06))
    S.box("oak", bx0, cy - L / 2, 0.26, bx1, cy + L / 2, 0.32)
    S.box("oak", bx0, cy - L / 2, 0.84, bx1, cy + L / 2, 0.9)
    for k in range(12):
        y = cy - L / 2 + 0.1 + k * (L - 0.25) / 11
        S.box("oak", bx0, y, 0.32, bx1, y + 0.04, 0.84)
    seat = _cushion(Dp - 0.12, L - 0.14, 0.15, puff=0.25)
    S.mesh(f"seat{side}", *_moved(seat, cx + side * 0.03, cy, 0.26), M["cushion"], smooth=True)
    r = random.Random(5 if side < 0 else 9)
    for k, (dy, mat) in enumerate(((-0.62, "pillow_white"), (-0.38, "pillow_rust"), (-0.12, "pillow_dark"), (0.5, "pillow_grey"))):
        p = _cushion(0.13, 0.48, 0.46, puff=0.6)
        S.mesh(f"pillow{side}_{k}", *p, M[mat], smooth=True, at=(back + side * 0.16, cy + dy * side, 0.4),
               rot=(0.0, math.radians(-14 * side), math.radians(r.uniform(-8, 8))))


# ---------------------------------------------------------------- the bedroom


def bedroom():
    M = mats()
    S = Set("bedroom")
    H = 3.0
    # an oak-panelled wall along x = -2, the glass wall along y = 4.6 to the garden, plain walls behind the camera
    S.box("floor_oak", -2.0, -2.5, -0.05, 4.2, 4.6, 0.0)
    S.box("ceiling", -2.0, -2.5, H, 4.2, 4.6, H + 0.05)
    S.box("black", 0.4, 0.2, H - 0.02, 0.45, 4.6, H)  # the linear air slot
    S.box("wall", -2.2, -2.5, 0.0, -2.0, 4.6, H)
    S.box("panel", -2.0, -2.5, 0.0, -1.97, 4.6, H - 0.12)
    S.box("led", -1.97, -2.5, H - 0.12, -1.95, 4.6, H - 0.1)  # cove light along the top of the panels
    S.box("wall", 4.2, -2.5, 0.0, 4.4, 4.6, H)
    S.box("wall", -2.0, -2.7, 0.0, 4.2, -2.5, H)
    # the glass wall: black frames, sliding panels, a sheer curtain gathered at the corner
    for x in (-2.0, -0.45, 1.1, 2.65, 4.15):
        S.box("steel", x, 4.55, 0.0, x + 0.06, 4.68, H)
    S.box("steel", -2.0, 4.55, H - 0.08, 4.2, 4.68, H)
    S.box("steel", -2.0, 4.55, 0.0, 4.2, 4.68, 0.04)
    S.box("glass", -2.0, 4.6, 0.0, 4.2, 4.62, H)
    S.light("AREA", (1.1, 4.8, 1.5), 1.0, size=6.2, size_y=3.0, rot=(math.radians(-90), 0, 0), portal=True)
    for k in range(9):  # gathered folds
        x = -1.95 + k * 0.07
        S.box("curtain", x, 4.35 + (k % 2) * 0.06, 0.02, x + 0.07, 4.38 + (k % 2) * 0.06, H - 0.05)
    # the bed: upholstered frame, mattress, duvet, pillows, a knit throw across the foot
    bx0, bx1, by0, by1 = -1.97, 0.35, 1.0, 2.9
    S.box("bed", bx0, by0, 0.0, bx1, by1, 0.36)
    S.mesh("headboard", *_moved(_cushion(0.16, by1 - by0 + 0.1, 0.62, puff=0.06), bx0 + 0.08, (by0 + by1) / 2, 0.36), M["bed"], smooth=True)
    S.mesh("mattress", *_moved(_cushion(bx1 - bx0 - 0.22, by1 - by0 - 0.08, 0.2, puff=0.03), (bx0 + bx1) / 2 + 0.1, (by0 + by1) / 2, 0.36), M["sheet"], smooth=True)
    S.mesh("duvet", *_moved(_cushion(bx1 - bx0 - 0.5, by1 - by0 + 0.04, 0.07, puff=0.12), (bx0 + bx1) / 2 + 0.28, (by0 + by1) / 2, 0.55), M["sheet"], smooth=True)
    for k, (y, mat) in enumerate(((1.35, "sheet"), (2.55, "sheet"), (1.5, "pillow_taupe"), (2.4, "pillow_taupe"), (1.95, "pillow_taupe"))):
        p = _cushion(0.16 if k < 2 else 0.14, 0.6 if k < 2 else 0.48, 0.42 if k < 2 else 0.38, puff=0.7)
        S.mesh(f"pillow{k}", *p, M[mat], smooth=True, at=(bx0 + 0.3 + (0 if k < 2 else 0.14), y, 0.58), rot=(0.0, math.radians(-16), 0.0))
    S.mesh("throw", *_moved(_cushion(0.55, by1 - by0 + 0.2, 0.04, puff=0.2), bx1 - 0.35, (by0 + by1) / 2 + 0.1, 0.62), M["throw"], smooth=True)
    S.box("throw", bx1 - 0.08, by0 + 0.4, 0.15, bx1 - 0.02, by0 + 1.2, 0.66)  # where it falls over the end
    # nightstand, sconce, art, the rug
    S.box("oak", -1.97, 0.25, 0.0, -1.47, 0.85, 0.5)
    S.model("book_encyclopedia_set_01", -1.72, 0.55, 0.5, 0.4, height=0.12)
    S.model("potted_plant_04", -1.72, 0.4, 0.5, 0.0, height=0.25)
    S.box("steel", -1.97, 0.7, 1.15, -1.75, 0.74, 1.19)
    S.light("SPOT", (-1.8, 0.72, 1.12), 6.0, size=0.02, spot=(70, 0.5))
    S.box("black", -1.97, 1.15, 1.25, -1.93, 2.75, 2.45)
    S.box("mat_white", -1.93, 1.2, 1.3, -1.928, 2.7, 2.4)
    S.box("art_green", -1.928, 1.45, 1.5, -1.926, 2.45, 2.2)
    S.box("rug_wool", -1.6, 0.0, 0.0, 2.6, 3.9, 0.015)
    # outside: the terrace, a lounge chair, the lawn and the garden's hedge, a banana plant and trees
    S.box("deck", -2.0, 4.68, -0.05, 4.2, 6.8, 0.0)
    S.box("lawn", -6.0, 6.8, -0.1, 9.0, 14.0, 0.0)
    S.model("mid_century_lounge_chair", 2.8, 5.6, 0.0, math.radians(200), height=0.8)
    for k in range(9):
        S.model("shrub_04" if k % 2 else "shrub_02", -4.0 + k * 1.4, 11.5, 0.0, k * 0.7, height=2.3)
    S.model("potted_plant_02", 0.4, 7.4, 0.0, 0.0, height=2.4)
    for k, (x, y) in enumerate(((-2.5, 13.5), (3.0, 15.0), (7.0, 13.0))):
        S.model("island_tree_01" if k % 2 else "island_tree_02", x, y, 0.0, k, height=8.5)
    for x, y in ((0.4, 0.8), (2.2, 0.8), (0.4, 3.2), (2.2, 3.2), (-0.8, -1.2), (2.2, -1.2)):
        S.box("glow", x - 0.04, y - 0.04, H - 0.006, x + 0.04, y + 0.04, H)
        S.light("SPOT", (x, y, H - 0.02), 22.0, size=0.03, spot=(90, 0.7))
    S.light("AREA", (2.6, -2.3, 1.6), 90.0, color=(1.0, 0.93, 0.86), size=4.0, size_y=2.0, rot=(math.radians(90), 0, 0))
    S.done(shots.BED, shots.SHOW["bedroom"][0], M)


# ---------------------------------------------------------------- the bathroom


def bath():
    M = mats()
    S = Set("bath")
    H = 3.0
    # floor and walls: stone tiles everywhere but the shower's back wall is the deeper split-face stone
    S.box("bath_floor", -2.0, -2.6, -0.05, 2.4, 4.4, 0.0)
    S.box("ceiling", -2.0, -2.6, H, 2.4, 4.4, H + 0.05)
    S.box("stone", -2.2, -2.6, 0.0, -2.0, 4.4, H)  # vanity wall
    S.box("stone", -0.75, 4.0, 0.0, 1.55, 4.2, H)  # the shower's back wall
    S.box("stone", -0.95, 1.6, 0.0, -0.75, 4.2, H)  # the shower's left wall (a pier between vanity and shower)
    S.box("stone", -2.0, 1.6, 0.0, -0.95, 1.8, H)
    S.box("stone", -2.0, -2.8, 0.0, 2.4, -2.6, H)
    S.box("stone", 1.55, 4.0, 0.0, 2.4, 4.2, H)
    S.box("pebbles", -0.75, 2.2, 0.0, 1.55, 4.0, 0.012)  # the shower's pebble floor
    S.box("stone", -0.75, 3.75, 1.02, 1.55, 4.0, 1.07)  # the lit ledge
    S.box("led", -0.72, 3.74, 1.065, 1.52, 3.76, 1.08)
    S.box("glass", 1.55, 2.2, 0.0, 1.565, 4.0, 2.2)  # frameless panel
    S.box("steel", 1.55, 2.2, 2.2, 1.565, 4.0, 2.21)
    S.box("steel", 1.1, 3.98, 2.25, 1.13, 4.0, 2.27)  # rain head arm
    S.box("steel", 0.9, 3.4, 2.25, 1.13, 3.42, 2.27)
    S.mesh("rainhead", *_moved(_lathe([(0.0001, 0.0), (0.15, 0.0), (0.15, 0.015), (0.0001, 0.02)], 32), 0.9, 3.4, 2.23), M["steel"])
    S.mesh("mixer", *_moved(_lathe([(0.0001, 0.0), (0.06, 0.0), (0.06, 0.03), (0.0001, 0.03)], 24), 0.4, 3.99, 1.25), M["steel"])
    S.model("brass_vase_03", 1.0, 3.88, 1.07, 0.0, height=0.17)
    S.model("ceramic_vase_01", 1.25, 3.88, 1.07, 0.0, height=0.15)
    # the vanity: floating wood counter and a shelf of towels, a stone vessel basin, wall spout, round backlit mirror
    S.box("vanity", -2.0, -0.6, 0.72, -1.4, 1.45, 0.9)
    S.box("vanity", -2.0, -0.6, 0.18, -1.45, 1.45, 0.24)
    for y in (-0.45, 0.05):
        S.mesh(f"towel{y}", *_moved(_cushion(0.38, 0.4, 0.14, puff=0.3), -1.75, y + 0.2, 0.24), M["towel"], smooth=True)
    S.model("wicker_basket_01", -1.75, 0.95, 0.24, 0.0, height=0.25)
    basin = _lathe([(0.0001, 0.0), (0.16, 0.005), (0.24, 0.06), (0.27, 0.15), (0.26, 0.19), (0.22, 0.2), (0.2, 0.08), (0.0001, 0.06)], 48)
    S.mesh("basin", *_moved(basin, -1.68, 0.2, 0.9), M["basin"], smooth=True)
    S.box("steel", -2.0, 0.17, 1.33, -1.73, 0.23, 1.36)  # spout
    S.box("steel", -2.0, 0.08, 1.4, -1.94, 0.11, 1.46)
    S.box("steel", -2.0, 0.29, 1.4, -1.94, 0.32, 1.46)
    mirror = _lathe([(0.0001, 0.0), (0.5, 0.0), (0.5, 0.015), (0.0001, 0.015)], 64)
    o = S.mesh("mirror", *_moved(mirror, 0.0, 0.0, 0.0), M["mirror"])
    o.location = (-1.98, 0.2, 1.95)
    o.rotation_euler = (0.0, math.radians(90), 0.0)
    ring = _lathe([(0.49, 0.0), (0.53, 0.0), (0.53, 0.01), (0.49, 0.01)], 64)
    o = S.mesh("mirror_glow", *_moved(ring, 0.0, 0.0, 0.0), M["led"])
    o.location = (-1.995, 0.2, 1.95)
    o.rotation_euler = (0.0, math.radians(90), 0.0)
    S.model("ceramic_vase_03", -1.75, 0.85, 0.9, 0.0, height=0.3)
    S.model("brass_candleholders", -1.72, 1.2, 0.9, 0.0, height=0.12)
    # the rattan pendant over the counter, glowing
    shade = _lathe([(0.0001, 0.0), (0.13, 0.0), (0.14, 0.05), (0.14, 0.32), (0.11, 0.38), (0.0001, 0.39)], 32)
    S.mesh("pendant", *_moved(shade, -1.45, 0.75, 1.75), M["rattan"], smooth=True)
    S.box("black", -1.455, 0.745, 2.14, -1.445, 0.755, H)
    S.light("POINT", (-1.45, 0.75, 1.9), 30.0, color=(1.0, 0.72, 0.45), size=0.06)
    # a niche with a vase in the pier
    S.box("led", -0.96, 1.0, 1.3, -0.95, 1.4, 1.31)
    # the freestanding tub in the foreground on the right, its floor filler, a stool with a candle
    tub = _lathe([(0.0001, 0.0), (0.42, 0.0), (0.52, 0.08), (0.6, 0.35), (0.62, 0.55), (0.6, 0.58), (0.55, 0.56),
                  (0.52, 0.3), (0.42, 0.12), (0.0001, 0.11)], 64)
    o = S.mesh("tub", *_moved(tub, 0.0, 0.0, 0.0), M["tub"], smooth=True)
    o.location = (1.55, 0.2, 0.0)
    o.scale = (1.0, 1.45, 1.0)
    o.rotation_euler.z = math.radians(-12)
    S.box("steel", 2.15, 1.25, 0.0, 2.19, 1.29, 1.0)
    S.box("steel", 2.0, 1.25, 0.96, 2.19, 1.29, 1.0)
    S.mesh("stool", *_moved(_lathe([(0.0001, 0.0), (0.16, 0.0), (0.16, 0.42), (0.18, 0.44), (0.0001, 0.45)], 32), 1.05, -0.95, 0.0), M["vanity"], smooth=True)
    S.mesh("candle", *_moved(_lathe([(0.0001, 0.0), (0.045, 0.0), (0.045, 0.09), (0.0001, 0.09)], 24), 1.0, -0.95, 0.45), M["mat_white"])
    S.light("POINT", (1.0, -0.95, 0.58), 1.2, color=(1.0, 0.6, 0.3), size=0.01)
    # the slatted screen to the planted court on the right
    S.box("stone", 2.4, -2.6, 0.0, 2.6, 0.4, H)
    for k in range(20):
        y = 0.4 + k * 0.18
        S.box("vanity", 2.38, y, 0.0, 2.44, y + 0.07, H)
    S.box("court", 4.2, -1.0, 0.0, 4.4, 5.0, 4.0)
    S.box("pebbles", 2.4, -1.0, -0.02, 4.2, 5.0, 0.0)
    for k, (x, y) in enumerate(((3.1, 0.8), (3.5, 2.2), (3.0, 3.6), (3.6, 4.4))):
        S.model("potted_plant_04" if k % 2 else "potted_plant_02", x, y, 0.0, k * 1.3, height=1.3 + k * 0.25)
    S.light("AREA", (3.3, 2.0, 3.6), 1.0, size=1.8, size_y=6.0, rot=(0, 0, 0), portal=True)
    for x, y in ((-0.2, 3.1), (0.8, 3.1), (-1.4, -1.0), (0.6, -1.4)):
        S.box("glow", x - 0.04, y - 0.04, H - 0.006, x + 0.04, y + 0.04, H)
        S.light("SPOT", (x, y, H - 0.02), 20.0, size=0.03, spot=(70, 0.7))
    S.light("AREA", (0.2, -2.4, 1.7), 45.0, color=(1.0, 0.9, 0.78), size=3.0, size_y=1.6, rot=(math.radians(90), 0, 0))
    S.done(shots.BATH, shots.SHOW["bath"][0], M)
