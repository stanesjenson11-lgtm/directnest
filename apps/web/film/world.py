"""Sky, light, camera look and render settings.

The sky is a real photographed sky (Poly Haven pure-sky HDRIs, CC0), used for both the background and the light.
It turns slowly through the film so the clouds drift, and crossfades to a sunset sky for the evening.
Haze is added in the compositor from the mist pass (scene only; the sky comes from the environment pass).
"""
import math

import bpy

import ph

DAY, DUSK = "kloofendal_48d_partly_cloudy_puresky", "qwantani_sunset_puresky"
# where the sun sits in each photo (u across the equirectangular image), and where we want it in the scene
SUN_U = {DAY: 0.607, DUSK: 0.566}
SUN_AZ = {DAY: math.radians(-45), DUSK: math.radians(-160)}  # world azimuth from +x (east), CCW: south-east, west-south-west
DRIFT = math.radians(7) / 1200  # radians per frame: about 7 degrees over the film


def _theta(asset):
    # Blender's equirectangular lookup: u = 0.5 - atan2(y, x) / 2pi, so the photo's sun sits at azimuth pi * (1 - 2u);
    # the mapping rotates lookups by theta, which moves the sun to azimuth (that - theta)
    return math.pi * (1 - 2 * SUN_U[asset]) - SUN_AZ[asset]


def sky(res="8k"):
    w = bpy.data.worlds.new("sky")
    bpy.context.scene.world = w
    w.use_nodes = True
    n, l = w.node_tree.nodes, w.node_tree.links
    n.clear()
    tc = n.new("ShaderNodeTexCoord")
    envs = []
    for asset in (DAY, DUSK):
        mp = n.new("ShaderNodeMapping")
        mp.vector_type = "POINT"
        d = mp.inputs["Rotation"].driver_add("default_value", 2).driver
        d.expression = f"{_theta(asset):.5f} + frame * {DRIFT:.8f}"
        env = n.new("ShaderNodeTexEnvironment")
        env.image = bpy.data.images.load(ph.hdri(asset, res), check_existing=True)
        env.image.use_half_precision = True  # half the VRAM for the two big skies
        l.new(tc.outputs["Generated"], mp.inputs["Vector"])
        l.new(mp.outputs["Vector"], env.inputs["Vector"])
        envs.append(env)
    mix = n.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    night = n.new("ShaderNodeValue")
    d = night.outputs[0].driver_add("default_value").driver
    v = d.variables.new()
    v.name = "night"
    v.targets[0].id_type = "SCENE"
    v.targets[0].id = bpy.context.scene
    v.targets[0].data_path = '["night"]'
    d.expression = "night"
    l.new(night.outputs[0], [s for s in mix.inputs if s.name == "Factor" and s.type == "VALUE"][0])
    l.new(envs[0].outputs["Color"], [s for s in mix.inputs if s.name == "A" and s.type == "RGBA"][0])
    l.new(envs[1].outputs["Color"], [s for s in mix.inputs if s.name == "B" and s.type == "RGBA"][0])
    bg = n.new("ShaderNodeBackground")
    bg.inputs["Strength"].default_value = 1.0
    l.new([s for s in mix.outputs if s.name == "Result" and s.type == "RGBA"][0], bg.inputs["Color"])
    out = n.new("ShaderNodeOutputWorld")
    l.new(bg.outputs[0], out.inputs["Surface"])
    w.mist_settings.start = 60
    w.mist_settings.depth = 2600
    w.mist_settings.falloff = "QUADRATIC"
    return w


def render(preview=False):
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "OPTIX"
    prefs.get_devices()
    for dev in prefs.devices:
        dev.use = dev.type == "OPTIX"
    c = sc.cycles
    c.device = "GPU"
    c.samples = 48 if preview else 256
    c.use_adaptive_sampling = True
    c.adaptive_threshold = 0.04 if preview else 0.012
    c.use_denoising = True
    c.denoiser = "OPTIX"
    c.denoising_input_passes = "RGB_ALBEDO_NORMAL"
    c.max_bounces, c.diffuse_bounces, c.glossy_bounces = 10, 4, 4
    c.transmission_bounces, c.transparent_max_bounces, c.volume_bounces = 8, 16, 1
    c.caustics_reflective = c.caustics_refractive = False
    c.sample_clamp_indirect = 8.0
    c.blur_glossy = 1.0
    c.use_light_tree = True
    sc.render.film_transparent = True  # the sky is composited back from the environment pass, unhazed
    sc.render.use_persistent_data = True  # keep the BVH and textures between frames
    sc.render.use_motion_blur = not preview
    sc.render.motion_blur_shutter = 0.4
    sc.render.resolution_x, sc.render.resolution_y = (960, 540) if preview else (1920, 1080)
    sc.render.resolution_percentage = 100
    sc.render.fps = 24
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGB"
    sc.render.image_settings.color_depth = "8"
    sc.view_settings.view_transform = "AgX"
    sc.view_settings.look = "AgX - Medium High Contrast"
    sc.view_settings.exposure = 0.0
    vl = sc.view_layers[0]
    vl.use_pass_mist = True
    vl.use_pass_environment = True


def compositor():
    """scene (hazed by distance) over the sky, a little glow and lens dispersion."""
    sc = bpy.context.scene
    sc.use_nodes = True
    t = sc.node_tree
    t.nodes.clear()
    n, l = t.nodes, t.links
    rl = n.new("CompositorNodeRLayers")
    haze = n.new("CompositorNodeMixRGB")
    haze.blend_type = "MIX"
    amount = n.new("CompositorNodeMath")
    amount.operation = "MULTIPLY"
    amount.inputs[1].default_value = 0.55
    l.new(rl.outputs["Mist"], amount.inputs[0])
    l.new(amount.outputs[0], haze.inputs["Fac"])
    l.new(rl.outputs["Image"], haze.inputs[1])
    col = n.new("CompositorNodeMixRGB")  # haze colour: day blue-grey to warm evening, by scene['night']
    col.inputs[1].default_value = (0.36, 0.40, 0.48, 1)
    col.inputs[2].default_value = (0.62, 0.50, 0.38, 1)
    d = col.inputs["Fac"].driver_add("default_value").driver
    v = d.variables.new()
    v.name = "night"
    v.targets[0].id_type = "SCENE"
    v.targets[0].id = sc
    v.targets[0].data_path = '["night"]'
    d.expression = "night"
    l.new(col.outputs[0], haze.inputs[2])
    keep_alpha = n.new("CompositorNodeSetAlpha")
    keep_alpha.mode = "REPLACE_ALPHA"
    l.new(haze.outputs[0], keep_alpha.inputs["Image"])
    l.new(rl.outputs["Alpha"], keep_alpha.inputs["Alpha"])
    over = n.new("CompositorNodeAlphaOver")
    l.new(rl.outputs["Env"], over.inputs[1])
    l.new(keep_alpha.outputs[0], over.inputs[2])
    glow = n.new("CompositorNodeGlare")
    glow.glare_type = "FOG_GLOW"
    glow.quality = "HIGH"
    glow.mix = -0.92
    glow.threshold = 1.2
    glow.size = 7
    l.new(over.outputs[0], glow.inputs["Image"])
    lens = n.new("CompositorNodeLensdist")
    lens.inputs["Dispersion"].default_value = 0.006
    lens.inputs["Distortion"].default_value = -0.008
    l.new(glow.outputs[0], lens.inputs["Image"])
    comp = n.new("CompositorNodeComposite")
    l.new(lens.outputs[0], comp.inputs["Image"])
