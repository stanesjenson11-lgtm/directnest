"""Small helpers the film's scene builders share: materials, box meshes, Geometry Nodes instancing."""
import bpy
import bmesh

import ph

# ---------------------------------------------------------------- collections


def coll(name, parent=None):
    c = bpy.data.collections.get(name)
    if not c:
        c = bpy.data.collections.new(name)
        (parent or bpy.context.scene.collection).children.link(c)
    return c


def link(obj, collection):
    collection.objects.link(obj)
    return obj


# ---------------------------------------------------------------- shader node plumbing


def _sock(sockets, name, kind=None):
    for s in sockets:
        if s.name == name and (kind is None or s.type == kind):
            return s
    raise KeyError(name)


class Nodes:
    """Thin wrapper so material code reads like a recipe."""

    def __init__(self, tree):
        self.t = tree
        self.n = tree.nodes
        self.l = tree.links

    def new(self, kind, **props):
        node = self.n.new(kind)
        for k, v in props.items():
            setattr(node, k, v)
        return node

    def link(self, a, b):
        self.l.new(a, b)

    def math(self, op, a, b=None, clamp=False):
        m = self.new("ShaderNodeMath", operation=op, use_clamp=clamp)
        self._in(m.inputs[0], a)
        if b is not None:
            self._in(m.inputs[1], b)
        return m.outputs[0]

    def mix(self, blend, fac, a, b):
        m = self.new("ShaderNodeMix", data_type="RGBA", blend_type=blend)
        self._in(_sock(m.inputs, "Factor", "VALUE"), fac)
        self._in(_sock(m.inputs, "A", "RGBA"), a)
        self._in(_sock(m.inputs, "B", "RGBA"), b)
        return _sock(m.outputs, "Result", "RGBA")

    def _in(self, sock, v):
        if hasattr(v, "is_output"):
            self.link(v, sock)
        else:
            sock.default_value = v

    def world_pos(self, scale):
        g = self.new("ShaderNodeNewGeometry")
        v = self.new("ShaderNodeVectorMath", operation="SCALE")
        self.link(g.outputs["Position"], v.inputs[0])
        v.inputs["Scale"].default_value = 1.0 / scale
        return v.outputs[0]

    def image(self, path, vector, srgb=True, box=True):
        t = self.new("ShaderNodeTexImage")
        t.image = bpy.data.images.load(path, check_existing=True)
        t.image.colorspace_settings.name = "sRGB" if srgb else "Non-Color"
        if box:
            t.projection = "BOX"
            t.projection_blend = 0.25
        if vector is not None:
            self.link(vector, t.inputs["Vector"])
        return t

    def rand(self):
        """0..1, different per piece: the 'rnd' face attribute of merged meshes, plus Object Info random for instances."""
        a = self.new("ShaderNodeAttribute", attribute_name="rnd")
        o = self.new("ShaderNodeObjectInfo")
        return self.math("FRACT", self.math("ADD", a.outputs["Fac"], o.outputs["Random"]))

    def night(self):
        """The scene's 'night' value (0 day .. 1 evening), animated by the timeline."""
        v = self.new("ShaderNodeValue")
        d = v.outputs[0].driver_add("default_value").driver
        var = d.variables.new()
        var.name = "night"
        var.targets[0].id_type = "SCENE"
        var.targets[0].id = bpy.context.scene
        var.targets[0].data_path = '["night"]'
        d.expression = "night"
        return v.outputs[0]

    def ramp(self, fac, colors, constant=True):
        r = self.new("ShaderNodeValToRGB")
        r.color_ramp.interpolation = "CONSTANT" if constant else "LINEAR"
        els = r.color_ramp.elements
        while len(els) < len(colors):
            els.new(0.5)
        for i, c in enumerate(colors):
            els[i].position = i / len(colors)
            els[i].color = (*srgb(c), 1)
        self._in(r.inputs["Fac"], fac)
        return r.outputs["Color"]


def srgb(hex_):
    """0xRRGGBB (as seen on screen) -> linear RGB for Blender."""
    def ch(v):
        v /= 255
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    return (ch((hex_ >> 16) & 255), ch((hex_ >> 8) & 255), ch(hex_ & 255))


def _material(name):
    m = bpy.data.materials.get(name)
    if m:
        return m, None
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    return m, Nodes(nt)


def _out(nodes, shader):
    o = nodes.new("ShaderNodeOutputMaterial")
    nodes.link(shader, o.inputs["Surface"])


# ---------------------------------------------------------------- materials


def flat(name, color, rough=0.6, metal=0.0, emit=None, emit_strength=0.0, coat=0.0):
    m, nd = _material(name)
    if not nd:
        return m
    b = nd.new("ShaderNodeBsdfPrincipled")
    b.inputs["Base Color"].default_value = (*srgb(color), 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    b.inputs["Coat Weight"].default_value = coat
    if emit is not None:
        b.inputs["Emission Color"].default_value = (*srgb(emit), 1)
        b.inputs["Emission Strength"].default_value = emit_strength
    _out(nd, b.outputs[0])
    return m


def pbr(name, asset, scale, tint=None, palette=None, rough_mul=1.0, bump=0.2, grime=0.0, metal=0.0, res="2k"):
    """A Poly Haven surface projected in world space (metres per tile = scale), so any size of box keeps true scale.
    palette: a list of 0xRRGGBB picked per object/instance (Object Info > Random), multiplied over the texture's detail."""
    m, nd = _material(name)
    if not nd:
        return m
    maps = ph.texture(asset, res)
    vec = nd.world_pos(scale)
    b = nd.new("ShaderNodeBsdfPrincipled")
    b.inputs["Metallic"].default_value = metal
    col = nd.image(maps["diff"], vec).outputs["Color"]
    if palette or tint:
        # keep the texture's light and dark detail, swap its colour
        bw = nd.new("ShaderNodeRGBToBW")
        nd.link(col, bw.inputs[0])
        detail = nd.math("MULTIPLY", bw.outputs[0], 2.0)
        if palette:
            base = nd.ramp(nd.rand(), palette)
        else:
            base = (*srgb(tint), 1)
        dcol = nd.new("ShaderNodeCombineColor")
        for i in range(3):
            nd.link(detail, dcol.inputs[i])
        col = nd.mix("MULTIPLY", 0.75, base, dcol.outputs[0])
    if grime:
        # monsoon streaks: noise stretched down the walls
        gp = nd.new("ShaderNodeVectorMath", operation="MULTIPLY")
        geo = nd.new("ShaderNodeNewGeometry")
        nd.link(geo.outputs["Position"], gp.inputs[0])
        gp.inputs[1].default_value = (0.9, 0.9, 0.06)
        nz = nd.new("ShaderNodeTexNoise", noise_dimensions="3D")
        nz.inputs["Scale"].default_value = 3.0
        nz.inputs["Detail"].default_value = 6.0
        nd.link(gp.outputs[0], nz.inputs["Vector"])
        streak = nd.math("POWER", nd.math("SUBTRACT", nz.outputs["Fac"], 0.35, clamp=True), 1.5)
        dark = nd.math("MULTIPLY", streak, grime)
        col = nd.mix("MULTIPLY", dark, col, (0.25, 0.24, 0.22, 1))
    nd.link(col, b.inputs["Base Color"])
    if "rough" in maps:
        r = nd.image(maps["rough"], vec, srgb=False).outputs["Color"]
        nd.link(nd.math("MULTIPLY", r, rough_mul, clamp=True), b.inputs["Roughness"])
    if bump and "disp" in maps:
        h = nd.image(maps["disp"], vec, srgb=False).outputs["Color"]
        bn = nd.new("ShaderNodeBump")
        bn.inputs["Strength"].default_value = bump
        bn.inputs["Distance"].default_value = 0.02 * scale
        nd.link(h, bn.inputs["Height"])
        nd.link(bn.outputs["Normal"], b.inputs["Normal"])
    _out(nd, b.outputs[0])
    return m


def glass(name="glass", color=0xdfe8ee, rough=0.02, tint_dark=False):
    """Architectural glass: refracts for camera rays, lets shadow rays through (no caustic noise)."""
    m, nd = _material(name)
    if not nd:
        return m
    g = nd.new("ShaderNodeBsdfGlass")
    g.inputs["Color"].default_value = (*srgb(color), 1)
    g.inputs["Roughness"].default_value = rough
    g.inputs["IOR"].default_value = 1.45
    t = nd.new("ShaderNodeBsdfTransparent")
    t.inputs["Color"].default_value = (*srgb(color), 1)
    lp = nd.new("ShaderNodeLightPath")
    mx = nd.new("ShaderNodeMixShader")
    nd.link(lp.outputs["Is Shadow Ray"], mx.inputs[0])
    nd.link(g.outputs[0], mx.inputs[1])
    nd.link(t.outputs[0], mx.inputs[2])
    _out(nd, mx.outputs[0])
    return m


def palette_flat(name, palette, rough=0.7, metal=0.0):
    """One flat colour per object/instance, picked from a palette."""
    m, nd = _material(name)
    if not nd:
        return m
    b = nd.new("ShaderNodeBsdfPrincipled")
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    nd.link(nd.ramp(nd.rand(), palette), b.inputs["Base Color"])
    _out(nd, b.outputs[0])
    return m


def room_card(name="room_card"):
    """What you glimpse through other flats' windows: a dim room, and a warm lamp in about half of them at night."""
    m, nd = _material(name)
    if not nd:
        return m
    b = nd.new("ShaderNodeBsdfPrincipled")
    r = nd.rand()
    b.inputs["Base Color"].default_value = (*srgb(0x6b625a), 1)
    b.inputs["Roughness"].default_value = 0.9
    b.inputs["Emission Color"].default_value = (*srgb(0xffd6a6), 1)
    # by day a room is lit by its other windows (a faint glow stands in for that bounce); at night about half the lamps are on
    lit = nd.math("GREATER_THAN", r, 0.45)
    lamp = nd.math("MULTIPLY", nd.math("MULTIPLY", lit, nd.night()), nd.math("ADD", nd.math("MULTIPLY", r, 4.0), 2.0))
    nd.link(nd.math("ADD", lamp, nd.math("ADD", 0.05, nd.math("MULTIPLY", r, 0.12))), b.inputs["Emission Strength"])
    _out(nd, b.outputs[0])
    return m


# ---------------------------------------------------------------- geometry


class Boxes:
    """Collects axis-aligned boxes (min corner, max corner) and builds them as one mesh (one draw, one BVH)."""

    def __init__(self):
        self.v, self.f, self.r = [], [], []

    def add(self, x0, y0, z0, x1, y1, z1, rnd=0.0):
        if x1 < x0: x0, x1 = x1, x0
        if y1 < y0: y0, y1 = y1, y0
        if z1 < z0: z0, z1 = z1, z0
        i = len(self.v)
        self.v += [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0), (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
        self.f += [(i, i + 3, i + 2, i + 1), (i + 4, i + 5, i + 6, i + 7), (i, i + 1, i + 5, i + 4),
                   (i + 1, i + 2, i + 6, i + 5), (i + 2, i + 3, i + 7, i + 6), (i + 3, i, i + 4, i + 7)]
        self.r += [rnd] * 6
        return self

    def cbox(self, cx, cy, cz, sx, sy, sz, rnd=0.0):
        """Centred box; cz is the bottom."""
        return self.add(cx - sx / 2, cy - sy / 2, cz, cx + sx / 2, cy + sy / 2, cz + sz, rnd)

    def build(self, name, mat, collection, smooth=False):
        if not self.v:
            return None
        me = bpy.data.meshes.new(name)
        me.from_pydata(self.v, [], self.f)
        me.update()
        if any(self.r):
            me.attributes.new("rnd", "FLOAT", "FACE").data.foreach_set("value", self.r)
        me.materials.append(mat)
        if smooth:
            me.shade_smooth()
        return link(bpy.data.objects.new(name, me), collection)


def mesh_obj(name, verts, faces, mat, collection, smooth=False):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    if mat:
        me.materials.append(mat)
    if smooth:
        me.shade_smooth()
    return link(bpy.data.objects.new(name, me), collection)


def prim(kind, name, mat, collection, **kw):
    """A bmesh primitive as a library mesh object (cylinders, spheres, cones)."""
    bm = bmesh.new()
    if kind == "cyl":
        bmesh.ops.create_cone(bm, cap_ends=True, segments=kw.get("seg", 24), radius1=kw["r"], radius2=kw.get("r2", kw["r"]), depth=kw["h"])
        bmesh.ops.translate(bm, verts=bm.verts, vec=(0, 0, kw["h"] / 2))
    elif kind == "sphere":
        bmesh.ops.create_uvsphere(bm, u_segments=kw.get("seg", 24), v_segments=kw.get("seg", 24) // 2, radius=kw["r"])
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    if kw.get("smooth", True):
        me.shade_smooth()
    me.materials.append(mat)
    return link(bpy.data.objects.new(name, me), collection)


# ---------------------------------------------------------------- Geometry Nodes scatter


def _scatter_tree(name, pick):
    tree = bpy.data.node_groups.new(name, "GeometryNodeTree")
    tree.interface.new_socket(name="Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
    tree.interface.new_socket(name="Source", in_out="INPUT", socket_type="NodeSocketCollection")
    tree.interface.new_socket(name="Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
    n, l = tree.nodes, tree.links
    gi, go = n.new("NodeGroupInput"), n.new("NodeGroupOutput")
    ci = n.new("GeometryNodeCollectionInfo")
    ci.transform_space = "ORIGINAL"
    ci.inputs["Separate Children"].default_value = pick
    ci.inputs["Reset Children"].default_value = pick
    l.new(gi.outputs["Source"], ci.inputs["Collection"])
    iop = n.new("GeometryNodeInstanceOnPoints")
    l.new(gi.outputs["Geometry"], iop.inputs["Points"])
    l.new(ci.outputs[0], iop.inputs["Instance"])
    rot = n.new("GeometryNodeInputNamedAttribute")
    rot.data_type = "FLOAT_VECTOR"
    rot.inputs["Name"].default_value = "rot"
    e2r = n.new("FunctionNodeEulerToRotation")
    l.new(rot.outputs["Attribute"], e2r.inputs[0])
    l.new(e2r.outputs[0], iop.inputs["Rotation"])
    scl = n.new("GeometryNodeInputNamedAttribute")
    scl.data_type = "FLOAT_VECTOR"
    scl.inputs["Name"].default_value = "scl"
    l.new(scl.outputs["Attribute"], iop.inputs["Scale"])
    if pick:
        iop.inputs["Pick Instance"].default_value = True
        var = n.new("GeometryNodeInputNamedAttribute")
        var.data_type = "INT"
        var.inputs["Name"].default_value = "var"
        l.new(var.outputs["Attribute"], iop.inputs["Instance Index"])
    l.new(iop.outputs["Instances"], go.inputs["Geometry"])
    return tree


_trees = {}


def scatter(name, source, points, collection):
    """Instances `source` (a collection; with child collections, each point picks one by 'var') at points.
    points: list of (x, y, z, rot_z, sx, sy, sz[, var]). One object, thousands of instances, shared memory."""
    if not points:
        return None
    pick = len(source.children) > 0
    me = bpy.data.meshes.new(name)
    me.from_pydata([p[:3] for p in points], [], [])
    rot = me.attributes.new("rot", "FLOAT_VECTOR", "POINT")
    rot.data.foreach_set("vector", [c for p in points for c in (0.0, 0.0, p[3])])
    scl = me.attributes.new("scl", "FLOAT_VECTOR", "POINT")
    scl.data.foreach_set("vector", [c for p in points for c in p[4:7]])
    if pick:
        var = me.attributes.new("var", "INT", "POINT")
        var.data.foreach_set("value", [int(p[7]) if len(p) > 7 else 0 for p in points])
    obj = link(bpy.data.objects.new(name, me), collection)
    key = "scatter_pick" if pick else "scatter"
    if key not in _trees:
        _trees[key] = _scatter_tree(key, pick)
    mod = obj.modifiers.new("scatter", "NODES")
    mod.node_group = _trees[key]
    ident = [s.identifier for s in _trees[key].interface.items_tree if getattr(s, "name", "") == "Source" and s.in_out == "INPUT"][0]
    mod[ident] = source
    return obj


def variants(name, objects_or_collections):
    """A collection whose children are one collection per variant (for scatter's pick-by-'var')."""
    parent = coll(name, ph.lib())
    for i, item in enumerate(objects_or_collections):
        if isinstance(item, bpy.types.Collection):
            if item.name not in parent.children:
                parent.children.link(item)
        else:
            c = coll(f"{name}_{i}", parent)
            for o in (item if isinstance(item, (list, tuple)) else [item]):
                for uc in list(o.users_collection):
                    uc.objects.unlink(o)
                c.objects.link(o)
    return parent


def lib_coll(name, objects):
    """Moves objects into a new collection under _lib (a source for scatter or collection instances)."""
    c = coll(name, ph.lib())
    for o in objects:
        for uc in list(o.users_collection):
            uc.objects.unlink(o)
        c.objects.link(o)
    return c


def instance(name, source, x, y, z, rot_z=0.0, s=1.0, collection=None):
    """One collection instance (an empty) of a library collection."""
    e = bpy.data.objects.new(name, None)
    e.instance_type = "COLLECTION"
    e.instance_collection = source
    e.location = (x, y, z)
    e.rotation_euler = (0, 0, rot_z)
    e.scale = (s, s, s)
    return link(e, collection or bpy.context.scene.collection)
