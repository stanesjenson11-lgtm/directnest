"""The villa: a G+1 contemporary house after the reference photo (taupe plaster boxes under deep low-hip tiled roofs, a
full-height wood-clad pier, ashlar stone piers, a horizontal-plank garage door, frameless glass balconies, soffit
downlights), its plot, the building of it, and the gated layout of villas around it.

One plan drives everything. The hero villa is built part by part as separate objects, each keyed to its stage of the
build (shots.STAGE): footings, rebar, formwork, columns, brick walls that plaster spreads over, scaffolding, roofs,
cladding, glass, then pavers and lawn laid and plants grown. The neighbours are the same villa, finished, merged into one
mesh per material and instanced round the layout.
The villa faces south: its front is the plane y = 0, its plot runs from the road edge at y = -9 back to y = 22.
"""
import math
import random

import bpy

import kit
import ph
import shots
from kit import Boxes, srgb

FFL = 0.45  # ground floor level (the plinth's top)
F1 = 3.75  # first floor level
TOP = {"left": 6.55, "centre": 6.0, "right": 7.1}  # underside of each wing's roof slab
PLOT = (-8.5, 8.5, -9.0, 22.0)
DEPTH = 13.0  # front to back

PLASTER = [0xc8b59c, 0xe6dfd2, 0xbcb2a5, 0xd8c6ad, 0xcfc4b4, 0xa99a88]  # the neighbours' paints (the hero's is the first)


# ---------------------------------------------------------------- materials


def _drive(nd, prop):
    """A shader value following a scene property (keyed per frame by villa.py)."""
    v = nd.new("ShaderNodeValue")
    d = v.outputs[0].driver_add("default_value").driver
    var = d.variables.new()
    var.name = "v"
    var.targets[0].id_type = "SCENE"
    var.targets[0].id = bpy.context.scene
    var.targets[0].data_path = f'["{prop}"]'
    d.expression = "v"
    return v.outputs[0]


def _layer(nd, asset, scale, tint=None, rot=None, res="2k"):
    """One Poly Haven surface in world space: (colour, roughness, height) sockets."""
    maps = ph.texture(asset, res)
    vec = nd.world_pos(scale)
    if rot:
        mp = nd.new("ShaderNodeMapping")
        mp.inputs["Rotation"].default_value = rot
        nd.link(vec, mp.inputs["Vector"])
        vec = mp.outputs["Vector"]
    col = nd.image(maps["diff"], vec).outputs["Color"]
    if tint:
        bw = nd.new("ShaderNodeRGBToBW")
        nd.link(col, bw.inputs[0])
        det = nd.math("MULTIPLY", bw.outputs[0], 2.0)
        dc = nd.new("ShaderNodeCombineColor")
        for i in range(3):
            nd.link(det, dc.inputs[i])
        col = nd.mix("MULTIPLY", det, (*srgb(tint), 1), dc.outputs[0])
    rough = nd.image(maps["rough"], vec, srgb=False).outputs["Color"] if "rough" in maps else (0.8, 0.8, 0.8, 1)
    height = nd.image(maps["disp"], vec, srgb=False).outputs["Color"] if "disp" in maps else (0.5, 0.5, 0.5, 1)
    return col, rough, height


def wipe(name, a, b, axis="Z", reverse=False, bump=0.4, edge=0.12):
    """Surface a, then b spreading over it as the object's 'finish' property goes 0 -> 1: plaster over brick from the
    ground up, pavers laid out from the house. a, b: (asset, metres per tile, tint or None)."""
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nd = kit.Nodes(m.node_tree)
    nd.n.clear()
    ca, ra, ha = _layer(nd, *a)
    cb, rb, hb = _layer(nd, *b)
    fin = nd.new("ShaderNodeAttribute", attribute_type="OBJECT", attribute_name="finish").outputs["Fac"]
    gen = nd.new("ShaderNodeTexCoord")
    sep = nd.new("ShaderNodeSeparateXYZ")
    nd.link(gen.outputs["Generated"], sep.inputs[0])
    g = sep.outputs[axis]
    if reverse:
        g = nd.math("SUBTRACT", 1.0, g)
    nz = nd.new("ShaderNodeTexNoise", noise_dimensions="3D")
    nz.inputs["Scale"].default_value = 1.2
    nz.inputs["Detail"].default_value = 6.0
    nd.link(nd.world_pos(1.0), nz.inputs["Vector"])
    ragged = nd.math("ADD", g, nd.math("MULTIPLY", nd.math("SUBTRACT", nz.outputs["Fac"], 0.5), edge * 2))
    mask = nd.math("LESS_THAN", ragged, nd.math("SUBTRACT", nd.math("MULTIPLY", fin, 1 + 2 * edge), edge))
    col = nd.mix("MIX", mask, ca, cb)
    rough = nd.mix("MIX", mask, ra, rb)
    height = nd.mix("MIX", mask, ha, hb)
    bs = nd.new("ShaderNodeBsdfPrincipled")
    nd.link(col, bs.inputs["Base Color"])
    nd.link(rough, bs.inputs["Roughness"])
    bp = nd.new("ShaderNodeBump")
    bp.inputs["Strength"].default_value = bump
    bp.inputs["Distance"].default_value = 0.02
    nd.link(height, bp.inputs["Height"])
    nd.link(bp.outputs["Normal"], bs.inputs["Normal"])
    kit._out(nd, bs.outputs[0])
    return m


def lamp(name, color, strength):
    """An emitter that comes on with the scene's 'lamps' value (downlight lenses, sconces, lit rooms behind glass)."""
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nd = kit.Nodes(m.node_tree)
    nd.n.clear()
    e = nd.new("ShaderNodeEmission")
    e.inputs["Color"].default_value = (*srgb(color), 1)
    nd.link(nd.math("MULTIPLY", _drive(nd, "lamps"), strength), e.inputs["Strength"])
    b = nd.new("ShaderNodeBsdfDiffuse")
    b.inputs["Color"].default_value = (*srgb(color), 1)
    add = nd.new("ShaderNodeAddShader")
    nd.link(e.outputs[0], add.inputs[0])
    nd.link(b.outputs[0], add.inputs[1])
    kit._out(nd, add.outputs[0])
    return m


def materials(neighbour=False):
    """The finished villa's surfaces. neighbour=True: the plaster takes a different paint per instance."""
    up = (0, math.pi / 2, 0)  # stands horizontal boards upright
    M = {
        "plaster": kit.pbr("villa_plaster_n" if neighbour else "villa_plaster", "beige_wall_001", 2.2,
                           palette=PLASTER if neighbour else None, tint=None if neighbour else PLASTER[0], bump=0.12),
        "band": kit.pbr("villa_band", "beige_wall_001", 2.2, tint=0xa8937c, bump=0.12),
        "panel": kit.tiles("villa_panel", "beige_wall_001", 2.2, 0xb9a68e, rough=0.55, size=(0.32, 9.0), grout=0x8a7a68),
        "stone": kit.pbr("villa_stone", "rock_tile_floor", 1.7, tint=0xc4baac, bump=0.7),
        "wood": kit.pbr("villa_wood", "dark_wooden_planks", 1.4, tint=0x8b5636, bump=0.25, rot=up),
        "garage": kit.pbr("villa_garage", "dark_wooden_planks", 1.2, tint=0x7e4b2d, bump=0.3),
        "soffit": kit.pbr("villa_soffit", "dark_wooden_planks", 1.2, tint=0x5a3a26, bump=0.1),
        "roof": kit.pbr("villa_roof", "grey_roof_tiles_02", 1.4, tint=0x4f4036, bump=0.7),
        "frame": kit.flat("villa_frame", 0x2a2522, rough=0.35, metal=0.7),
        "glass": kit.glass("villa_glass", 0xd3dcdc, rough=0.0),
        "rail": kit.glass("villa_rail", 0xe2ebe8, rough=0.0),
        "step": kit.pbr("villa_step", "rock_tile_floor", 1.2, tint=0x9d968d, bump=0.3),
        "deck": kit.pbr("villa_deck", "dark_wooden_planks", 1.0, tint=0x7a4e30, bump=0.3),
        "pavers": kit.terrain("villa_pavers", [("rectangular_paving", 2.4), ("patterned_concrete_pavers", 2.0)],
                              [(9.0, 0.72, 0.05)], bump=0.6, tint=0x968a80, tint_mix=0.45),
        "lawn": kit.terrain("villa_lawn", [("leafy_grass", 2.5), ("sparse_grass", 3.0)], [(14.0, 0.7, 0.06)], bump=0.9,
                            tint=0x5f8f34, tint_mix=0.55),
        "room": kit.room_card(),
        "lens": lamp("villa_lens", 0xffd2a0, 30.0),
        "glow": lamp("villa_glow", 0xffd7ab, 2.2),  # a lit room seen through glass and a sheer curtain
        "sofa": kit.pbr("villa_outdoor_fabric", "rough_linen", 0.6, tint=0x9c9890, bump=0.2),
        "concrete": kit.pbr("villa_concrete", "brushed_concrete", 2.5, tint=0xb3aea6, bump=0.2),
    }
    return M


def build_materials():
    """Surfaces only the building site has."""
    return {
        "wall": wipe("villa_wall", ("brick_wall_02", 1.3, None), ("beige_wall_001", 2.2, PLASTER[0])),
        "wall_band": wipe("villa_band_wipe", ("brushed_concrete", 2.5, 0xb3aea6), ("beige_wall_001", 2.2, 0xa8937c)),
        "slab": wipe("villa_slab", ("brushed_concrete", 2.5, 0xb3aea6), ("beige_wall_001", 2.2, PLASTER[0])),
        "drive": wipe("villa_drive", ("red_laterite_soil_stones", 3.0, None), ("rectangular_paving", 2.4, 0x968a80),
                      axis="Y", reverse=True, bump=0.8, edge=0.05),
        "lawn": wipe("villa_lawn_wipe", ("red_laterite_soil_stones", 3.0, None), ("leafy_grass", 2.5, 0x5f8f34),
                     axis="X", bump=0.9, edge=0.08),
        "concrete": kit.pbr("villa_concrete", "brushed_concrete", 2.5, tint=0xb3aea6, bump=0.2),
        "rebar": kit.flat("rebar", 0x4a2e22, rough=0.6, metal=0.8),
        "ply": kit.pbr("formwork_ply", "plywood", 1.2, bump=0.1),
        "pole": kit.pbr("casuarina", "bark_brown_02", 0.8, bump=0.3),
        "brick": kit.pbr("villa_brick", "brick_wall_02", 1.3, bump=0.4),
        "sand": kit.pbr("sand_pile", "coast_sand_01", 1.5, tint=0xa98c6a, bump=0.6),
    }


# ---------------------------------------------------------------- the plan


class Part:
    """Boxes of one material that go up together (one object on the hero villa)."""

    def __init__(self, name, mat, stage, anim="grow"):
        self.name, self.mat, self.stage, self.anim = name, mat, stage, anim
        self.b = Boxes()
        self.meshes = []  # extra (verts, faces) pieces: roofs

    def add(self, *box):
        self.b.add(*box)
        return self


def _wall_x(p, x0, x1, y, z0, z1, t=0.3, holes=()):
    """A wall along x (front face at y), with rectangular openings (xa, xb, za, zb)."""
    xs = sorted({x0, x1, *[h[0] for h in holes], *[h[1] for h in holes]})
    for xa, xb in zip(xs, xs[1:]):
        cuts = sorted((h[2], h[3]) for h in holes if h[0] <= xa and xb <= h[1])
        z = z0
        for za, zb in cuts:
            if za > z:
                p.add(xa, y, z, xb, y + t, za)
            z = max(z, zb)
        if z < z1:
            p.add(xa, y, z, xb, y + t, z1)


def _wall_y(p, y0, y1, x, z0, z1, t=0.3, holes=()):
    """A wall along y (face at x), with openings (ya, yb, za, zb)."""
    ys = sorted({y0, y1, *[h[0] for h in holes], *[h[1] for h in holes]})
    for ya, yb in zip(ys, ys[1:]):
        cuts = sorted((h[2], h[3]) for h in holes if h[0] <= ya and yb <= h[1])
        z = z0
        for za, zb in cuts:
            if za > z:
                p.add(x, ya, z, x + t, yb, za)
            z = max(z, zb)
        if z < z1:
            p.add(x, ya, z, x + t, yb, z1)


def _window(frame, glass, x0, x1, z0, z1, y, panes=1, axis="x", depth=0.06):
    """A dark aluminium frame with glass: along x at y, or along y at x (axis='y')."""
    w = 0.05

    def bx(p, a0, a1, b0, b1, c0, c1):  # a along the wall, b across it, c up
        p.add(a0, b0, c0, a1, b1, c1) if axis == "x" else p.add(b0, a0, c0, b1, a1, c1)

    bx(frame, x0, x1, y, y + depth, z0, z0 + w)
    bx(frame, x0, x1, y, y + depth, z1 - w, z1)
    for k in range(panes + 1):
        a = x0 + (x1 - x0) * k / panes
        lo, hi = (x0, x0 + w) if k == 0 else (x1 - w, x1) if k == panes else (a - w / 2, a + w / 2)
        bx(frame, lo, hi, y, y + depth, z0, z1)
    bx(glass, x0, x1, y + depth / 2 - 0.006, y + depth / 2 + 0.006, z0, z1)


def _hip(part, x0, x1, y0, y1, z, rise):
    """A low hipped roof over a rectangle: the ridge runs along the longer side."""
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    if (y1 - y0) >= (x1 - x0):
        h = (x1 - x0) / 2
        r0, r1 = (cx, y0 + h, z + rise), (cx, y1 - h, z + rise)
        v = [(x0, y0, z), (x1, y0, z), (x1, y1, z), (x0, y1, z), r0, r1]
        f = [(0, 1, 4), (1, 2, 5, 4), (2, 3, 5), (3, 0, 4, 5)]
    else:
        h = (y1 - y0) / 2
        r0, r1 = (x0 + h, cy, z + rise), (x1 - h, cy, z + rise)
        v = [(x0, y0, z), (x1, y0, z), (x1, y1, z), (x0, y1, z), r0, r1]
        f = [(0, 1, 5, 4), (1, 2, 5), (2, 3, 4, 5), (3, 0, 4)]
    part.meshes.append((v, f))


def plan(site=True):
    """Every part of the villa, in build order. site=False: only what the finished villa has."""
    P = {}

    def part(name, mat, stage, anim="grow"):
        P[name] = Part(name, mat, stage, anim)
        return P[name]

    X = [-6.6, -2.2, 0.3, 3.1, 5.8]
    Y = [0.15, 6.5, 12.85]
    grid = [(x, y) for x in X for y in Y if not (x == 3.1 and y == Y[0])]  # the garage and the wide window span x = 3.1
    if site:
        f = part("footings", "concrete", "footings")
        for x, y in grid:
            f.add(x - 0.6, y - 0.6, 0.0, x + 0.6, y + 0.6, 0.25)
        rb = part("rebar", "rebar", "rebar")
        for x, y in grid:
            for dx in (-0.1, 0.1):
                for dy in (-0.1, 0.1):
                    rb.add(x + dx - 0.008, y + dy - 0.008, 0.25, x + dx + 0.008, y + dy + 0.008, 4.4)
            for z in [0.5 + k * 0.3 for k in range(13)]:  # stirrups
                rb.add(x - 0.11, y - 0.11, z, x + 0.11, y + 0.11, z + 0.012)
        fo = part("forms", "ply", "forms")
        for x, y in grid:
            fo.add(x - 0.19, y - 0.19, FFL, x + 0.19, y + 0.19, F1 - 0.15)
    co = part("columns", "concrete", "columns")
    for x, y in grid:
        co.add(x - 0.14, y - 0.14, 0.25 if site else FFL, x + 0.14, y + 0.14, F1 - 0.15)
    pl = part("plinth", "slab" if site else "plaster", "plinth")
    pl.add(-6.86, 0.0, 0.0, 6.88, DEPTH, FFL)
    pl.add(-2.6, 0.0, 0.0, 0.15, 1.6, FFL)  # the porch

    # ---- ground floor walls (brick, then plaster)
    w = part("walls_gf", "wall" if site else "plaster", "walls_gf")
    _wall_x(w, -6.86, -2.03, 0.55, FFL, F1 - 0.15, holes=[(-6.15, -3.7, FFL, 2.95)])  # living room: full glass
    _wall_x(w, -2.03, 0.15, 1.6, FFL, F1 - 0.15, holes=[(-1.38, -0.18, FFL, 2.6)])  # the front door
    _wall_x(w, 0.15, 6.88, 0.3, 0.0, F1 - 0.15, holes=[(1.07, 5.97, 0.0, 2.55)])  # the garage
    _wall_y(w, 0.55, DEPTH, -6.86, FFL, F1 - 0.15, holes=[(3.0, 5.2, 1.0, 2.5), (8.0, 10.2, 1.0, 2.5)])
    _wall_y(w, 0.3, DEPTH, 6.58, FFL, F1 - 0.15, holes=[(8.5, 10.0, 1.0, 2.5)])
    _wall_x(w, -6.86, 6.88, DEPTH - 0.3, FFL, F1 - 0.15, holes=[(-5.0, -2.5, FFL, 2.6), (1.5, 3.5, 1.0, 2.5)])
    _wall_y(w, 0.55, 1.6, -2.33, FFL, F1 - 0.15)  # the porch's sides
    _wall_y(w, 0.3, 1.6, 0.15, FFL, F1 - 0.15)

    # ---- first floor slab, its deep bands across the front
    s1 = part("slab_1", "slab" if site else "plaster", "slab_1", anim="pour")
    s1.add(-6.86, 0.0, F1 - 0.15, 6.88, DEPTH, F1)
    s1.add(-2.29, 0.0, F1 - 0.15, 0.15, 1.6, F1)  # the centre balcony
    bands = part("bands", "wall_band" if site else "band", "slab_1")
    bands.add(-7.36, -0.3, 3.0, -3.65, 0.55, F1)  # over the living room
    bands.add(-0.47, -0.25, 3.0, 7.25, 0.3, F1)  # the long balcony over the garage
    hdr = part("header", "band", "plaster", anim="pop")
    hdr.add(0.15, 0.28, 2.55, 6.88, 0.3, 3.0)

    # ---- first floor walls
    w2 = part("walls_ff", "wall" if site else "plaster", "walls_ff")
    _wall_x(w2, -6.23, -2.03, 0.0, F1, TOP["left"], holes=[(-5.45, -3.65, 3.95, 6.2)])
    _wall_x(w2, -2.03, 0.15, 1.6, F1, TOP["centre"], holes=[(-1.95, -0.15, F1, 5.95)])
    _wall_x(w2, 0.15, 5.95, 0.0, F1, TOP["right"], holes=[(1.02, 1.75, 4.0, 6.2), (2.5, 4.85, 4.0, 6.2)])
    _wall_y(w2, 0.0, DEPTH, -6.23, F1, TOP["left"], holes=[(4.0, 6.0, 4.6, 6.0), (9.0, 10.5, 4.8, 6.0)])
    _wall_y(w2, 0.0, DEPTH, 5.65, F1, TOP["right"], holes=[(7.0, 9.0, 4.6, 6.2)])
    _wall_x(w2, -6.23, 5.95, DEPTH - 0.3, F1, TOP["centre"], holes=[(-4.5, -2.8, 4.6, 6.0), (2.0, 4.0, 4.6, 6.0)])
    _wall_y(w2, 0.0, 1.6, -2.29, F1, TOP["left"])
    _wall_y(w2, 0.0, 1.6, 0.15, F1, TOP["right"])
    w2.add(-2.03, DEPTH - 0.3, TOP["centre"], 0.15, DEPTH, TOP["left"])  # the back wall up to the higher roofs

    # ---- roof slabs, then the tiled hips over deep eaves (fascia, wood soffit, downlights)
    rs = part("slab_roof", "slab" if site else "plaster", "slab_roof", anim="pour")
    rs.add(-6.23, 0.0, TOP["left"], -2.03, DEPTH, TOP["left"] + 0.15)
    rs.add(-2.29, 0.0, TOP["centre"], 0.15, DEPTH, TOP["centre"] + 0.3)  # the centre's flat roof, a thick edge at the front
    rs.add(0.15, 0.0, TOP["right"], 5.95, DEPTH, TOP["right"] + 0.15)
    fas = part("fascia", "plaster", "roof", anim="pop")
    sof = part("soffits", "soffit", "roof", anim="pop")
    roof = part("roof", "roof", "roof", anim="pop")
    # pitched enough that the tiles show above the eaves from the street, as in the reference photo
    for (x0, x1, z, rise) in ((-7.25, -1.85, TOP["left"], 1.15), (-0.47, 7.25, TOP["right"], 1.55)):
        y0, y1 = -1.0, DEPTH + 1.0
        zt = z + 0.32
        for b in ((x0, y0, z, x1, y0 + 0.08, zt), (x0, y1 - 0.08, z, x1, y1, zt), (x0, y0, z, x0 + 0.08, y1, zt), (x1 - 0.08, y0, z, x1, y1, zt)):
            fas.add(*b)
        sof.add(x0 + 0.08, y0 + 0.08, z, x1 - 0.08, y1 - 0.08, z + 0.03)
        _hip(roof, x0 - 0.05, x1 + 0.05, y0 - 0.05, y1 + 0.05, zt, rise)
    fas.add(-2.29, -0.05, TOP["centre"] + 0.05, 0.15, 0.0, TOP["centre"] + 0.32)

    # ---- cladding: stone piers, the wood pier and the porch panel, the slatted panels over the right wing's windows
    st = part("stone", "stone", "stone")
    st.add(-6.86, -0.05, 0.0, -6.2, 0.55, 3.0)  # left of the living room
    st.add(0.15, -0.05, 0.0, 1.07, 0.3, 2.55)  # the garage's piers
    st.add(5.97, -0.05, 0.0, 6.88, 0.3, 2.55)
    wd = part("wood", "wood", "wood")
    wd.add(-3.65, -0.18, 0.0, -2.29, 0.6, TOP["left"] + 0.05)  # full height, past the band
    wd.add(-2.03, 1.45, FFL, -1.42, 1.6, 2.6)  # the porch panel by the door
    pn = part("panels", "panel", "plaster", anim="pop")
    pn.add(0.95, -0.03, 6.2, 1.82, 0.0, TOP["right"])
    pn.add(2.42, -0.03, 6.2, 4.93, 0.0, TOP["right"])
    stp = part("steps", "step", "stone")
    stp.add(-2.7, -1.25, 0.0, 0.55, -0.6, 0.15)
    stp.add(-2.7, -0.6, 0.0, 0.55, 0.0, 0.3)
    stp.add(-2.7, -0.0, 0.0, 0.55, 1.6, FFL)

    # ---- glass, frames, the garage door, the balcony rails
    fr = part("frames", "frame", "glass", anim="pop")
    gl = part("glass", "glass", "glass", anim="pop")
    _window(fr, gl, -6.15, -3.7, FFL, 2.95, 0.6, panes=3)
    _window(fr, gl, -1.38, -0.18, FFL, 2.6, 1.62, panes=1)
    _window(fr, gl, -5.45, -3.65, 3.95, 6.2, 0.06, panes=2)
    _window(fr, gl, -1.95, -0.15, F1, 5.95, 1.62, panes=2)
    _window(fr, gl, 1.02, 1.75, 4.0, 6.2, 0.06, panes=1)
    _window(fr, gl, 2.5, 4.85, 4.0, 6.2, 0.06, panes=2)
    for (y0, y1, z0, z1) in ((3.0, 5.2, 1.0, 2.5), (8.0, 10.2, 1.0, 2.5)):
        _window(fr, gl, y0, y1, z0, z1, -6.86, panes=2, axis="y")
    for (y0, y1, z0, z1) in ((4.0, 6.0, 4.6, 6.0), (9.0, 10.5, 4.8, 6.0)):
        _window(fr, gl, y0, y1, z0, z1, -6.23, panes=1, axis="y")
    gd = part("garage", "garage", "garage", anim="pop")
    gd.add(1.07, 0.33, 0.0, 5.97, 0.4, 2.55)
    rl = part("rails", "rail", "glass", anim="pop")
    rl.add(0.15, -0.2, F1, 4.95, -0.18, F1 + 1.0)
    rl.add(-2.29, 0.02, F1, 0.15, 0.04, F1 + 1.0)

    # ---- the deck and its outdoor sofa, lit rooms behind the glass
    dk = part("deck", "deck", "plants", anim="pop")
    dk.add(-6.86, -1.5, 0.0, -3.7, 0.55, 0.32)
    sofa = part("sofa", "sofa", "plants", anim="pop")
    sofa.add(-5.9, -1.15, 0.32, -4.1, -0.35, 0.72)  # seat
    sofa.add(-5.9, -0.45, 0.32, -4.1, -0.25, 1.05)  # back
    gw = part("glow", "glow", "glass", anim="pop")
    gw.add(-6.5, 4.5, FFL, -2.4, 4.6, 3.4)  # the living room's back wall, lamplit
    gw.add(-5.4, 0.35, 3.95, -3.7, 0.4, 6.2)  # sheer curtains upstairs, lit from the rooms behind
    gw.add(1.05, 0.35, 4.0, 1.72, 0.4, 6.2)
    gw.add(2.55, 0.35, 4.0, 4.8, 0.4, 6.2)
    gw.add(-1.9, 2.4, F1, -0.2, 2.5, 5.9)
    lens = part("lenses", "lens", "glass", anim="pop")
    for x, y, z in lights():
        lens.add(x - 0.05, y - 0.05, z - 0.012, x + 0.05, y + 0.05, z)
    for x, z in ((-6.53, 1.9), (0.6, 1.9), (6.42, 1.9)):  # wall sconces
        lens.add(x - 0.06, -0.14, z - 0.12, x + 0.06, -0.05, z + 0.12)
    return P


def lights():
    """Soffit downlights (x, y, z of the lens): along both eaves, under the bands, in the porch ceiling."""
    out = [(x, -0.55, TOP["left"]) for x in (-6.8, -5.5, -4.2, -2.6)]
    out += [(x, -0.55, TOP["right"]) for x in (0.0, 1.5, 3.2, 4.8, 6.6)]
    out += [(x, 0.15, 3.0) for x in (-6.9, -5.2, -4.2)] + [(x, 0.0, 3.0) for x in (0.8, 6.5)]
    out += [(-1.6, 0.8, 2.6), (-0.6, 0.8, 2.6)]
    return out


# ---------------------------------------------------------------- building it


def _object(name, part, mats, collection, origin_axis="z"):
    """One part as one object, its origin on the side it grows from (so a scale key raises it from the ground)."""
    verts, faces = _merge([part])
    o = kit.mesh_obj(name, verts, faces, mats[part.mat], collection)
    me = o.data
    xs = [v.co.x for v in me.vertices]
    ys = [v.co.y for v in me.vertices]
    zs = [v.co.z for v in me.vertices]
    org = ((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, min(zs)) if origin_axis == "z" else (min(xs), (min(ys) + max(ys)) / 2, min(zs))
    for v in me.vertices:
        v.co.x -= org[0]
        v.co.y -= org[1]
        v.co.z -= org[2]
    o.location = org
    return o


def _merge(parts):
    """The boxes and extra pieces of some parts as one (verts, faces)."""
    verts, faces = [], []
    for p in parts:
        i = len(verts)
        verts += p.b.v
        faces += [tuple(i + k for k in f) for f in p.b.f]
        for v, f in p.meshes:
            j = len(verts)
            verts += v
            faces += [tuple(j + k for k in face) for face in f]
    return verts, faces


def _bevel(o, width=0.008):
    m = o.modifiers.new("bevel", "BEVEL")
    m.width = width
    m.segments = 2
    m.limit_method = "ANGLE"
    m.harden_normals = False
    return m


def _keys(o, path, rows, index=-1, constant=False):
    """Keys a property at film seconds: rows of (s, value)."""
    for s, v in rows:
        if index >= 0:
            getattr(o, path)[index] = v
        elif path.startswith('["'):
            o[path[2:-2]] = v
        else:
            setattr(o, path, v)
        o.keyframe_insert(path, index=index, frame=shots.frame_of(s))
    if constant:
        for fc in o.animation_data.action.fcurves:
            if fc.data_path == path:
                for kp in fc.keyframe_points:
                    kp.interpolation = "CONSTANT"


def show(o, spans):
    """Visible in renders only during these (from s, to s) spans (switched with constant keys)."""
    rows = [(0.0, True)]
    for a, b in spans:
        rows += [(a, False), (b, True)]
    o.hide_render = True
    for s, hide in rows:
        o.hide_render = hide
        o.keyframe_insert("hide_render", frame=shots.frame_of(s))
    for fc in o.animation_data.action.fcurves:
        if fc.data_path == "hide_render":
            for kp in fc.keyframe_points:
                kp.interpolation = "CONSTANT"


def stage(o, part):
    """Keys a part to its stage: grow up from the ground, pour along x, or pop into place; and away again for the
    building site's temporary parts."""
    t0, t1 = shots.STAGE[part.stage]
    off = {"scaffold": "scaffold_off", "props": "props_off", "forms": "forms_off", "piles": "piles_off"}.get(part.stage)
    tiny = 0.0001
    if part.anim in ("grow", "pour"):
        axis = 2 if part.anim == "grow" else 0
        o.scale[axis] = tiny
        _keys(o, "scale", [(t0, tiny), (t1, 1.0)], index=axis)
    else:  # pop: a quick rise from slightly smaller, as a fitted part
        _keys(o, "scale", [(t0, tiny), (t0 + 0.12, 1.0)], index=2)
    end = shots.SHOW["outside"]
    spans = [(t0, end[0][1]), end[1]]
    if off:
        a, b = shots.STAGE[off]
        _keys(o, "scale", [(a, 1.0), (b, tiny)], index=2)
        spans = [(t0, b)]
    show(o, spans)


def build_hero(collection):
    """The villa that builds itself."""
    mats = {**materials(), **build_materials()}
    P = plan(site=True)
    site(P)
    objs = {}
    for name, part in P.items():
        o = _object("villa_" + name, part, mats, collection, "x" if part.anim == "pour" else "z")
        if name not in ("rebar", "glass", "rails", "glow", "lenses"):
            _bevel(o, 0.004 if name in ("frames", "scaffold", "props") else 0.01)
        stage(o, part)
        objs[name] = o
    for name, prop in (("walls_gf", "plaster"), ("walls_ff", "plaster"), ("bands", "plaster"), ("slab_1", "plaster"),
                       ("slab_roof", "plaster"), ("plinth", "plaster")):
        a, b = shots.STAGE[prop]
        objs[name]["finish"] = 0.0
        _keys(objs[name], '["finish"]', [(a, 0.0), (b, 1.0)])
    ground(collection, mats)
    downlights(collection)
    return objs


def site(P):
    """The building site's own parts: scaffolding, props under the slab, brick stacks and a sand heap."""
    sc = Part("scaffold", "pole", "scaffold")
    for (x0, x1, y0, y1) in ((-8.0, 8.1, -1.4, -1.3), (-8.0, 8.1, 14.0, 14.1)):
        for k in range(int((x1 - x0) / 2.0) + 1):
            x = x0 + k * 2.0
            sc.add(x - 0.05, y0, 0.0, x + 0.05, y0 + 0.1, 8.2)
        for z in (1.8, 3.6, 5.4, 7.2):
            sc.add(x0, y0, z, x1, y1, z + 0.08)
    for (x, ) in ((-8.0,), (8.1,)):
        for k in range(9):
            y = -1.4 + k * 1.95
            sc.add(x - 0.05, y, 0.0, x + 0.05, y + 0.1, 8.2)
        for z in (1.8, 3.6, 5.4, 7.2):
            sc.add(x, -1.4, z, x + 0.08, 14.1, z + 0.08)
    for (x0, x1, y) in ((-8.0, 8.1, -1.35), (-8.0, 8.1, 14.05)):  # planks to stand on
        for z in (1.8, 3.6, 5.4):
            sc.add(x0, y - 0.25, z + 0.08, x1, y + 0.25, z + 0.11)
    P["scaffold"] = sc
    pr = Part("props", "rebar", "props")
    for i in range(7):
        for j in range(6):
            x, y = -6.2 + i * 2.0, 0.8 + j * 2.2
            pr.add(x - 0.03, y - 0.03, FFL, x + 0.03, y + 0.03, F1 - 0.15)
    P["props"] = pr
    pi = Part("piles", "brick", "piles")
    for x, y in ((5.5, -6.5), (6.8, -6.5), (5.5, -4.8)):
        pi.add(x - 0.5, y - 0.5, 0.0, x + 0.5, y + 0.5, 0.9)
    P["piles"] = pi
    sand = Part("sand", "sand", "piles")
    n = 18
    verts = [(-5.5 + math.cos(a) * 1.8, -6.0 + math.sin(a) * 1.4, 0.0) for a in (i / n * math.tau for i in range(n))] + [(-5.5, -6.0, 1.1)]
    sand.meshes.append((verts, [(i, (i + 1) % n, n) for i in range(n)]))
    P["sand"] = sand


def ground(collection, mats):
    """The plot: dug earth while it is built; then pavers laid from the house to the gate, and the lawn."""
    drive = Boxes().add(-6.9, PLOT[2], 0.0, PLOT[1], 0.0, 0.03).build("villa_drive", mats["drive"], collection)
    lawn = Boxes().add(PLOT[0], PLOT[2], 0.0, -6.9, 0.0, 0.05).add(PLOT[0], 0.0, 0.0, PLOT[1], PLOT[3], 0.05).build(
        "villa_lawn", mats["lawn"], collection)
    for o, key in ((drive, "pavers"), (lawn, "lawn")):
        a, b = shots.STAGE[key]
        o["finish"] = 0.0
        _keys(o, '["finish"]', [(a, 0.0), (b, 1.0)])
        show(o, shots.SHOW["outside"])
    walls = Part("compound", "plaster", "compound")
    walls.add(PLOT[0], PLOT[2] + 2.0, 0.0, PLOT[0] + 0.2, PLOT[3], 1.8)
    walls.add(PLOT[1] - 0.2, PLOT[2] + 2.0, 0.0, PLOT[1], PLOT[3], 1.8)
    walls.add(PLOT[0], PLOT[3] - 0.2, 0.0, PLOT[1], PLOT[3], 1.8)
    walls.add(PLOT[0], -2.0, 0.0, -6.95, -1.75, 1.9)  # garden screen walls either side of the front
    walls.add(6.95, -0.6, 0.0, PLOT[1], -0.35, 1.6)
    o = _object("villa_compound", walls, mats, collection)
    _bevel(o)
    stage(o, walls)
    plants(collection)


def plants(collection):
    """Shrubs and grasses along the front, potted plants on the deck and balcony, the two big trees."""
    r = random.Random(7)
    shrubs = [ph.model(a) for a in ("shrub_02", "shrub_04", "shrub_01")]
    grass = [ph.model(a) for a in ("grass_medium_02", "grass_medium_01")]
    pots = [ph.model(a) for a in ("potted_plant_02", "potted_plant_04", "potted_plant_01")]
    a, b = shots.STAGE["plants"]
    placed = []
    for i in range(16):  # the front-left lawn and the strip along the house
        x = PLOT[0] + 0.4 + r.random() * 1.2
        y = PLOT[2] + 1.0 + i * 0.55
        m, h = grass[i % 2]
        placed.append(kit.instance(f"villa_grass{i}", m, x, y, 0.05, r.random() * 6.3, 0.55 / max(0.05, h), collection))
    for i, (x, y) in enumerate(((-6.6, -1.75), (-3.9, -1.75), (0.6, -0.5), (6.4, -0.6), (-7.6, 1.0), (7.6, 1.5))):
        m, h = shrubs[i % 3]
        placed.append(kit.instance(f"villa_shrub{i}", m, x, y, 0.05, r.random() * 6.3, 0.9 / max(0.1, h), collection))
    for i, (x, y, z) in enumerate(((-6.4, -1.2, 0.32), (-3.95, -1.2, 0.32), (4.45, -0.05, F1), (-2.0, 0.3, F1), (-0.3, 1.25, FFL))):
        m, h = pots[i % 3]
        placed.append(kit.instance(f"villa_pot{i}", m, x, y, z, r.random() * 6.3, 0.85 / max(0.1, h), collection))
    for o in placed:  # each grows in from nothing
        s = o.scale[0]
        o.scale = (0.0001,) * 3
        o.keyframe_insert("scale", frame=shots.frame_of(a))
        o.scale = (s, s, s)
        o.keyframe_insert("scale", frame=shots.frame_of(b))
        show(o, [(a, shots.SHOW["outside"][0][1]), shots.SHOW["outside"][1]])
    trees = [ph.model(a) for a in ("island_tree_01", "island_tree_02")]
    for i, (x, y, hgt) in enumerate(((-12.5, 3.0, 12.0), (11.8, 5.0, 10.5), (-11.0, 17.0, 9.0))):
        m, h = trees[i % 2]
        o = kit.instance(f"villa_tree{i}", m, x, y, 0.0, r.random() * 6.3, hgt / max(1.0, h), collection)
        show(o, shots.SHOW["outside"])


def downlights(collection):
    """Warm spots in the soffits washing down the walls, and the sconces' glow."""
    rows = [(0, 0.0)] + [(s, v) for s, v in shots.TABLES["lamps"]]
    for i, (x, y, z) in enumerate(lights()):
        d = bpy.data.lights.new(f"villa_down{i}", "SPOT")
        d.color = (1.0, 0.76, 0.52)
        d.spot_size = math.radians(115)
        d.spot_blend = 0.75
        d.shadow_soft_size = 0.04
        o = kit.link(bpy.data.objects.new(f"villa_down{i}", d), collection)
        o.location = (x, y, z - 0.02)
        for s, v in rows:
            d.energy = 26.0 * v
            d.keyframe_insert("energy", frame=shots.frame_of(s))
        show(o, shots.SHOW["outside"])
    for i, (x, z) in enumerate(((-6.53, 1.9), (0.6, 1.9), (6.42, 1.9))):
        d = bpy.data.lights.new(f"villa_sconce{i}", "POINT")
        d.color = (1.0, 0.74, 0.48)
        d.shadow_soft_size = 0.05
        o = kit.link(bpy.data.objects.new(f"villa_sconce{i}", d), collection)
        o.location = (x, -0.2, z)
        for s, v in rows:
            d.energy = 9.0 * v
            d.keyframe_insert("energy", frame=shots.frame_of(s))
        show(o, shots.SHOW["outside"])
    for i, (x, y, z, sx, sy, e) in enumerate(((-4.4, 2.5, 3.2, 3.6, 3.0, 160.0), (-4.5, 2.0, 6.0, 1.6, 2.0, 60.0),
                                              (3.2, 2.0, 6.5, 3.4, 2.0, 80.0), (-1.0, 3.5, 5.6, 1.6, 2.0, 50.0))):
        d = bpy.data.lights.new(f"villa_room{i}", "AREA")
        d.shape = "RECTANGLE"
        d.size, d.size_y = sx, sy
        d.color = (1.0, 0.8, 0.58)
        o = kit.link(bpy.data.objects.new(f"villa_room{i}", d), collection)
        o.location = (x, y, z)
        for s, v in rows:
            d.energy = e * v
            d.keyframe_insert("energy", frame=shots.frame_of(s))
        show(o, shots.SHOW["outside"])


def build_static(name="lib_villa"):
    """The finished villa merged into one mesh per material: a library collection for the neighbours."""
    c = kit.coll(name, ph.lib())
    mats = materials(neighbour=True)
    mats["glow"] = mats["room"]
    mats["lens"] = mats["room"]
    mats["sofa"] = mats["deck"]
    P = plan(site=False)
    by_mat = {}
    for part in P.values():
        by_mat.setdefault(part.mat, []).append(part)
    for key, parts in by_mat.items():
        verts, faces = _merge(parts)
        if verts:
            kit.mesh_obj(f"{name}_{key}", verts, faces, mats[key], c)
    return c


# ---------------------------------------------------------------- the gated layout


def layout(K, r, places):
    """Our gated villa layout in the city's community block (city.build(gated=...)): four rows of plots on two
    internal roads, lawns and pavers, yellow-and-black kerbs, rain trees along the roads, a park with a clubhouse.
    Fills `places` with (x, y, rot_z, mirror) for every neighbour villa (the hero plot at x = 0 of row A stays empty)."""
    xs = [17.0 * k for k in range(-4, 5)]
    rows = [(-9.0, 1), (-15.0, -1), (44.0, -1), (56.0, 1)]  # front edge y, and which way the row faces (1 = south)
    K.grass.add(-25.5, -34.0, 0.0, 25.5, -15.0, 0.05)  # across the road from ours: a lawn the camera comes in over
    for x in (-23.0, 23.0):
        K.palms.append((x, -17.0, 0.05, r.random() * 6.3, 1.0, 1.0, 1.0, r.randrange(3)))
    for fy, facing in rows:
        for x in xs:
            if fy == -9.0 and x == 0.0:
                continue  # ours
            if fy == -15.0 and abs(x) < 30:
                continue  # the lawn
            mirror = r.random() < 0.5
            # the villa's front sits 9 m back from the road edge; facing north, it is turned round
            y = fy + 9.0 if facing == 1 else fy - 9.0
            places.append((x, y, 0.0 if facing == 1 else math.pi, mirror))
            depth = 31.0 if facing == 1 else 19.0
            y0, y1 = (fy, fy + depth) if facing == 1 else (fy - depth, fy)
            K.grass.add(x - 8.5, y0, 0.0, x + 8.5, y1, 0.05)
            dy0, dy1 = (fy, fy + 9.0) if facing == 1 else (fy - 9.0, fy)
            K.paved.add(x - 5.0, dy0, 0.0, x + 8.5, dy1, 0.07)
            for side in (-8.5, 8.3):
                K.plain.add(x + side, y0 + 2.0 if facing == 1 else y0, 0.0, x + side + 0.2, y1 if facing == 1 else y1 - 2.0, 1.8, 0.4)
            for k in range(3):
                K.shrubs.append((x - 7.5 + r.random() * 2, dy0 + 1 + r.random() * 7, 0.05, r.random() * 6.3, 1, 1, 1, r.randrange(3)))
    for fy in (-9.0, -15.0):  # rain trees along our road (none in front of ours: the camera looks across there)
        for x in range(-76, 77, 11):
            if abs(x) < 16:
                continue
            K.trees.append((x + r.random() * 3, fy + (1.2 if fy == -9.0 else -1.2), 0.0, r.random() * 6.3, 0.75, 0.75, 0.75, r.randrange(2)))
    for x in range(-76, 77, 13):
        K.trees.append((x + r.random() * 3, 42.0, 0.0, r.random() * 6.3, 0.8, 0.8, 0.8, r.randrange(2)))
    # the park and clubhouse behind the last row, the community's wall and gate
    K.grass.add(-76.0, 88.0, 0.0, 76.0, 124.0, 0.06)
    tree_ring = [(-60 + i * 12.0, 92.0) for i in range(11)] + [(-60 + i * 12.0, 121.0) for i in range(11)]
    for x, y in tree_ring:
        K.palms.append((x, y, 0.06, r.random() * 6.3, 1.05, 1.05, 1.05, r.randrange(3)))
    K.walls.add(-12.0, 100.0, 0.06, 12.0, 114.0, 6.5, 0.62)
    K.roof.add(-12.3, 99.7, 6.5, 12.3, 114.3, 6.65, 0.3)
    K.white.add(16.0, 98.0, 0.06, 36.0, 112.0, 0.12)
    x0, x1, y0, y1 = -89.0, 89.0, -34.0, 125.0
    for a in ((x0, y0, x1, y0 + 0.2), (x0, y1 - 0.2, x1, y1), (x0, y0, x0 + 0.2, y1), (x1 - 0.2, y0, x1, y1)):
        K.plain.add(a[0], a[1], 0.0, a[2], a[3], 2.2, 0.37)
