"""The villa film's shots, in film seconds (24 fps, 25 s, frames 1..601). Unlike the apartment's one continuous move,
this film cuts between shots, as a property film would: clouds down to the plot; the villa building itself and settling
on its front at dusk; then the hall, the bedroom and the bathroom; then up over the roof.

The page's ticks (components/tour/config.ts, TOTAL = 100) map onto film time through MAP; the flat stretches hold the
film still while the page shows HTML over it (the hero title, the "from the ground up" card, the floor plan).
Blender coordinates: x east, y north, z up. The villa faces south (its front is the plane y = 0), centred on x = 0.
"""
import math

from path import _crs, pw

FPS = 24
SECONDS = 25.0
FRAMES = round(SECONDS * FPS)  # 600: frames 1..601


def frame_of(sec):
    return 1 + round(sec * FPS)


def sec_of(frame):
    return (frame - 1) / FPS


# page ticks -> film seconds (linear between rows)
# (a hold sits at least 0.3 s before a cut: the player may run up to 0.25 s past where the tour stops, and past a cut
# that would show the next shot)
MAP = [(0, 0.0), (6, 0.0), (20, 4.0), (30, 4.05), (50, 11.0), (54, 13.6), (61, 13.65), (62, 14.0), (70, 17.0), (77, 20.0),
       (84, 23.0), (90, 25.0), (100, 25.0)]

# where the three room sets stand, far outside the city (each is lit by the same sky through its own windows)
HALL, BED, BATH = (5000.0, 0.0, 0.0), (5100.0, 0.0, 0.0), (5200.0, 0.0, 0.0)


def _at(origin, p):
    return tuple(a + b for a, b in zip(origin, p))


# name, start s, end s, keys: (s, camera, look-at, vertical fov, lens shift up)
SHOTS = [
    ("aerial", 0.0, 4.0, [
        (0.0, (-150, -320, 460), (0, 0, 0), 36, 0.0),  # above the cloud deck, the community faint below
        (1.7, (-104, -214, 290), (0, 2, 0), 36, 0.0),
        (3.1, (-52, -104, 118), (0, 4, 0), 37, 0.0),  # out of the clouds
        (4.0, (-32, -62, 56), (0, 5, 0), 38, 0.0),  # the empty plot among the finished villas
    ]),
    ("build", 4.0, 14.0, [  # one drone move: the villa rises as it circles in, then settles on the front at dusk
        (4.0, (-16, -34, 15), (0.5, 5, 1.5), 40, 0.0),  # in from the front-left, over the road (the trees stay out of it)
        (6.6, (-12, -33, 10.5), (0.4, 5, 2.6), 40, 0.0),
        (9.0, (-7.5, -30, 6.2), (0.3, 4, 3.3), 38, 0.0),
        (11.2, (-3.0, -25, 2.6), (0.2, 2, 3.4), 33, 0.06),
        (14.0, (0.0, -19.5, 1.7), (0.0, 0.0, 1.7), 30, 0.12),  # the front as in the reference photo, verticals straight
    ]),
    ("hall", 14.0, 17.0, [  # straight down the room at the TV wall, through the wood portal
        (14.0, _at(HALL, (0.0, -2.3, 1.22)), _at(HALL, (0.0, 7.5, 1.22)), 53, 0.07),
        (17.0, _at(HALL, (0.0, -1.65, 1.22)), _at(HALL, (0.0, 7.5, 1.22)), 53, 0.07),
    ]),
    ("bedroom", 17.0, 20.0, [  # from the corner: panelled bed wall on the left, the glass wall to the terrace on the right
        (17.0, _at(BED, (3.1, -1.6, 1.45)), _at(BED, (-1.3, 3.5, 1.05)), 52, 0.03),
        (20.0, _at(BED, (2.5, -1.0, 1.45)), _at(BED, (-1.5, 3.7, 1.05)), 52, 0.03),
    ]),
    ("bath", 20.0, 23.0, [  # facing the shower wall: vanity on the left, the tub and the slatted court on the right
        (20.0, _at(BATH, (0.15, -2.05, 1.32)), _at(BATH, (0.15, 4.0, 1.25)), 52, 0.04),
        (23.0, _at(BATH, (0.15, -1.35, 1.32)), _at(BATH, (0.15, 4.0, 1.25)), 52, 0.04),
    ]),
    ("top", 23.0, 25.0, [  # up over the roof at dusk; the page lays the floor plan over the last frame
        (23.0, (0.0, 2.0, 30.0), (0.0, 2.01, 0.0), 44, 0.0),
        (25.0, (0.0, 3.0, 54.0), (0.0, 3.01, 0.0), 44, 0.0),
    ]),
]


def shot_of(sec):
    for s in SHOTS:
        if sec < s[2]:
            return s
    return SHOTS[-1]


def camera_at(sec):
    """(position, target, fov degrees, shift_y) at a film second."""
    name, a, b, keys = shot_of(sec)
    if len(keys) == 2:  # a slow, steady push: eased a touch at both ends, as a dolly would be
        k0, k1 = keys
        f = (sec - k0[0]) / (k1[0] - k0[0])
        f = 0.7 * f + 0.3 * f * f * (3 - 2 * f)  # a gentle ease, never a stop
        lerp = lambda p, q: tuple(x + (y - x) * f for x, y in zip(p, q))
        return lerp(k0[1], k1[1]), lerp(k0[2], k1[2]), k0[3] + (k1[3] - k0[3]) * f, k0[4] + (k1[4] - k0[4]) * f
    # several keys: through them on a smooth curve, at the keys' own times; the last stretch eases into its hold
    i = 0
    while i < len(keys) - 2 and sec >= keys[i + 1][0]:
        i += 1
    k0, k1 = keys[i], keys[i + 1]
    f = min(1.0, max(0.0, (sec - k0[0]) / (k1[0] - k0[0])))
    if i == len(keys) - 2 and name == "build":
        f = 1 - (1 - f) ** 2  # settles on the front
    u = (i + f) / (len(keys) - 1)
    return (_crs([k[1] for k in keys], u), _crs([k[2] for k in keys], u), k0[3] + (k1[3] - k0[3]) * f,
            k0[4] + (k1[4] - k0[4]) * f)


def step(rows):
    """A table that jumps at the cuts: (s, v) rows; a row (s, v, True) starts a new value at s without easing into it."""
    out = []
    for r in rows:
        if len(r) == 3:
            out.append((r[0] - 0.0001, out[-1][1] if out else r[1]))
        out.append((r[0], r[1]))
    return out


# piecewise tables in film seconds, eased between rows (path.pw)
TABLES = {
    # 0 day sky .. 1 sunset sky; the rooms each have their own hour
    "night": step([(0, 0.0), (8.4, 0.0), (10.8, 1.0), (14, 0.0, True), (17, 0.32, True), (20, 0.55, True), (23, 1.0, True)]),
    # the sky turning (degrees): a slow drift, then the build's timelapse sweeps the sun round the house
    "spin": step([(0, 0.0), (4, 2.0), (4, 2.0, True), (10.6, 140.0), (14, 142.0), (14, 30.0, True), (17, 31.0), (17, 205.0, True),
                  (20, 206.0), (20, 95.0, True), (23, 96.0), (23, 142.0, True), (25, 143.0)]),
    "lamps": [(0, 0.0), (9.8, 0.0), (10.8, 1.0)],  # the villa's own lights, coming on at dusk
    "wisps": [(0, 1.0), (2.3, 1.0), (3.5, 0.0)],  # the cloud deck the opening drops through
}

# what is on screen when: (from s, to s) spans
SHOW = {
    "outside": [(0.0, 14.0), (23.0, 25.01)],
    "hall": [(14.0, 17.0)],
    "bedroom": [(17.0, 20.0)],
    "bath": [(20.0, 23.0)],
}

# the build: when each stage starts and ends (film seconds)
STAGE = {
    "dig": (4.0, 4.0), "footings": (4.15, 4.6), "rebar": (4.3, 4.8), "forms": (4.5, 5.0), "columns": (4.8, 5.3),
    "plinth": (5.0, 5.5), "walls_gf": (5.4, 6.4), "scaffold": (5.7, 6.1), "props": (6.0, 6.3), "slab_1": (6.3, 6.8),
    "walls_ff": (6.8, 7.6), "compound": (7.0, 7.6), "slab_roof": (7.5, 8.0), "roof": (8.0, 8.5), "plaster": (8.2, 9.0),
    "stone": (8.6, 9.1), "wood": (8.8, 9.3), "glass": (9.1, 9.5), "garage": (9.3, 9.6), "pavers": (9.4, 10.2),
    "lawn": (9.6, 10.2), "plants": (9.8, 10.5), "scaffold_off": (9.4, 9.8), "props_off": (7.2, 7.5), "forms_off": (5.3, 5.5),
    "piles": (4.0, 4.0), "piles_off": (7.0, 7.6),
}

# hotspots on the finished front (world positions): the page shows them over the end of the build shot
HOTSPOTS = {"hall": (-4.9, -0.4, 1.7), "bedroom": (3.6, -0.4, 5.1), "bath": (-4.4, -0.4, 5.0)}
HOTSPOT_SECONDS = (11.0, 14.0)

# phones see a 9:16 cut of the 16:9 frame: where its centre sits (0..1 across the frame), eased between rows; on the
# villa's front it pans from the living room to the garage
CROP = step([(0, 0.5), (11.0, 0.5), (12.2, 0.31), (14.0, 0.69), (14, 0.5, True), (17, 0.44, True), (20, 0.5, True), (25, 0.5)])


def crop_at(sec):
    return pw(CROP, sec)
