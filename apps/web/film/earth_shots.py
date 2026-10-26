"""The explorer film's shots (the home page hero on the hero-page branch), in film seconds: 24 fps, 34 s, frames 1..817.
After the director's sketch: above the clouds at sunrise; the Earth, India and Karnataka in one move down from orbit;
Bengaluru in 3D; the property markers; into one villa; its amenities; back to the map; the closing.
The first 4 s are a seamless loop of the clouds drifting under a still camera (frame 97 picks up where frame 1 began):
the page plays it until the visitor scrolls, then scrubs the film from 4 s.

Three sets share the origin and take turns on screen (SHOW): the cloud sea (metres, the camera facing the sunrise
along +y), the Earth (kilometres: centre at the origin, z the north pole, x through lon 0, y through lon 90E) and
Bengaluru (city.py's neighbourhood around our villa layout, metres; x east, y north, the hero villa's front at y = 0).
Pure maths, no bpy: encode.py imports it too.
"""
import math

from path import _crs, pw

FPS = 24
LOOP = 4.0  # the idle loop before the film proper
SECONDS = 34.0
FRAMES = round(SECONDS * FPS)  # 816: frames 1..817
R = 6371.0  # the Earth's radius, km


def frame_of(sec):
    return 1 + round(sec * FPS)


def sec_of(frame):
    return (frame - 1) / FPS


def geo(lon, lat, alt=0.0):
    """A point on (or above) the globe, km."""
    lo, la = math.radians(lon), math.radians(lat)
    r = R + alt
    return (r * math.cos(la) * math.cos(lo), r * math.cos(la) * math.sin(lo), r * math.sin(la))


# the subsolar point: mid-morning in Bengaluru in January (India in clear light, the night still over Africa and Europe)
SUN = (125.0, -15.0)


# ---------------------------------------------------------------- shots

# name, start s, end s, keys. Ground shots: (s, camera, look-at, vertical fov, lens shift up).
# The Earth: (s, (lon, lat, altitude km), (look-at lon, lat, k), fov, up) where k blends the look-at from the Earth's
# centre (0) to that point on the ground (1), and up blends the camera's up from north (0) to the local vertical (1).
SHOTS = [
    ("loop", 0.0, LOOP, [  # still: only the clouds move
        (0.0, (0, 0, 1650), (0, 4000, 1420), 42, 0.0),
        (LOOP, (0, 0, 1650), (0, 4000, 1420), 42, 0.0),
    ]),
    ("clouds", LOOP, 7.0, [  # 01: a slow crane up out of the cloud tops, tilting to the sunrise
        (4.0, (0, 0, 1650), (0, 4000, 1420), 42, 0.0),
        (5.5, (0, 140, 1980), (0, 4000, 1620), 42, 0.0),
        (7.0, (0, 320, 2700), (0, 4000, 2380), 44, 0.0),
    ]),
    ("earth", 7.0, 14.0, [  # 02 the Earth reveal, 03 zoom to India, 04 focus on Karnataka: one move down from orbit
        (7.0, (72.0, -2.0, 900.0), (78.0, 14.0, 1.0), 52, 1.0),  # just over the cloud tops of the Indian Ocean
        (8.4, (69.0, 2.0, 5200.0), (73.0, 11.0, 0.55), 42, 0.55),
        (10.0, (63.0, 8.0, 13500.0), (70.0, 14.0, 0.0), 38, 0.0),  # the whole Earth, turning; night still over Africa
        (11.9, (78.0, 9.5, 4300.0), (79.0, 21.5, 1.0), 38, 0.35),  # India
        (13.3, (76.4, 8.3, 720.0), (76.1, 14.6, 1.0), 38, 0.85),  # Karnataka, from the south-south-west
        (14.0, (77.2, 10.6, 430.0), (77.5, 13.6, 1.0), 38, 1.0),  # on towards Bengaluru
    ]),
    ("city", 14.0, 18.0, [  # 05: Bengaluru in 3D, down out of the cloud deck, gliding forward
        (14.0, (-300, -720, 560), (0, 0, 0), 40, 0.0),
        (16.0, (-200, -520, 380), (0, 30, 0), 40, 0.0),
        (18.0, (-150, -380, 250), (0, 50, 0), 40, 0.0),
    ]),
    ("markers", 18.0, 22.0, [  # 06: the property markers pop up on the roofs; a slow fly-through
        (18.0, (-150, -380, 250), (0, 50, 0), 40, 0.0),
        (20.0, (-60, -300, 175), (10, 40, 0), 40, 0.0),
        (22.0, (40, -250, 140), (10, 30, 0), 40, 0.0),
    ]),
    ("villa", 22.0, 28.0, [  # 07: fly into the selected villa; settles on its front at dusk
        (22.0, (40, -250, 140), (10, 30, 0), 40, 0.0),
        (24.0, (30, -130, 62), (2, 5, 3), 38, 0.0),
        (26.0, (8, -48, 14), (0.5, 0, 2.6), 34, 0.04),
        (28.0, (0.0, -19.5, 1.7), (0.0, 0.0, 1.7), 30, 0.12),  # the front, verticals straight
    ]),
    ("pool", 28.0, 29.0, [  # 08 amenities: the clubhouse and its pool
        (28.0, (44, 82, 7.5), (24, 105, 0.5), 44, 0.0),
        (29.0, (38, 80, 7.0), (22, 105, 0.5), 44, 0.0),
    ]),
    ("park", 29.0, 30.0, [  # 08: the park
        (29.0, (116, -52, 34), (150, 8, 0), 44, 0.0),  # from over the road, above the street trees
        (30.0, (126, -52, 34), (152, 8, 0), 44, 0.0),
    ]),
    ("lake", 30.0, 31.0, [  # 08: the lake and its walk
        (30.0, (-212, -48, 38), (-110, -165, 0), 44, 0.0),  # down over the walk to the water
        (31.0, (-198, -55, 38), (-100, -168, 0), 44, 0.0),
    ]),
    ("map", 31.0, 33.0, [  # 09: back up over the map, every marker lit
        (31.0, (-30, -110, 70), (0, 10, 0), 42, 0.0),
        (32.0, (-130, -330, 260), (0, 30, 0), 42, 0.0),
        (33.0, (-280, -660, 560), (0, 40, 0), 42, 0.0),
    ]),
    ("closing", 33.0, 34.0, [  # 10: the wide aerial under the tagline, easing back
        (33.0, (-280, -660, 560), (0, 40, 0), 42, 0.0),
        (34.0, (-300, -705, 598), (0, 40, 0), 42, 0.0),
    ]),
]
CUTS = [7.0, 14.0, 28.0, 29.0, 30.0, 31.0]  # where one shot cuts to the next (the others flow on)
GLOBE = ("earth",)
SKY = ("loop", "clouds")


def shot_of(sec):
    for s in SHOTS:
        if sec < s[2]:
            return s
    return SHOTS[-1]


def _ease_keys(keys, sec, settle):
    """Through the keys on a smooth curve at the keys' own times; values are tuples."""
    i = 0
    while i < len(keys) - 2 and sec >= keys[i + 1][0]:
        i += 1
    k0, k1 = keys[i], keys[i + 1]
    f = min(1.0, max(0.0, (sec - k0[0]) / (k1[0] - k0[0])))
    if len(keys) == 2:
        f = 0.7 * f + 0.3 * f * f * (3 - 2 * f)  # a slow, steady push: eased a touch at both ends, never a stop
    elif settle and i == len(keys) - 2:
        f = 1 - (1 - f) ** 2  # settles into the last key
    u = (i + f) / (len(keys) - 1)
    return u, i, f


def camera_at(sec):
    """(position, target, vertical fov degrees, shift_y, up) at a film second."""
    name, a, b, keys = shot_of(sec)
    if name in GLOBE:
        # lon, lat, log altitude, look-at lon, lat, k, fov, up: one smooth curve through the keys
        rows = [(c[0], c[1], math.log(c[2]), t[0], t[1], t[2], fov, up) for _, c, t, fov, up in keys]
        u, i, f = _ease_keys(keys, sec, False)
        lon, lat, lalt, tlon, tlat, tk, fov, up = _crs(rows, u)
        pos = geo(lon, lat, math.exp(lalt))
        tgt = tuple(v * min(1.0, max(0.0, tk)) for v in geo(tlon, tlat))
        vert = tuple(v / R for v in geo(tlon, tlat))
        w = min(1.0, max(0.0, up))
        upv = tuple(n * (1 - w) + v * w for n, v in zip((0.0, 0.0, 1.0), vert))
        return pos, tgt, fov, 0.0, upv
    u, i, f = _ease_keys(keys, sec, name == "villa")
    k0, k1 = keys[i], keys[i + 1]
    if len(keys) == 2:
        lerp = lambda p, q: tuple(x + (y - x) * f for x, y in zip(p, q))
        return lerp(k0[1], k1[1]), lerp(k0[2], k1[2]), k0[3] + (k1[3] - k0[3]) * f, k0[4] + (k1[4] - k0[4]) * f, (0, 0, 1)
    return (_crs([k[1] for k in keys], u), _crs([k[2] for k in keys], u), k0[3] + (k1[3] - k0[3]) * f,
            k0[4] + (k1[4] - k0[4]) * f, (0, 0, 1))


def step(rows):
    """A table that jumps at the cuts: (s, v) rows; a row (s, v, True) starts a new value at s without easing into it."""
    out = []
    for r in rows:
        if len(r) == 3:
            out.append((r[0] - 0.0001, out[-1][1] if out else r[1]))
        out.append((r[0], r[1]))
    return out


# what is on screen when: (from s, to s) spans
SHOW = {
    "sky": [(0.0, 7.0)],
    "earth": [(7.0, 14.0)],
    "city": [(14.0, 34.01)],
    "dive": [(14.0, 15.4)],  # the cloud deck over the city the cut lands in
    "pins": [(18.0, 28.0), (31.0, 34.01)],
}

# piecewise tables in film seconds, eased between rows (path.pw)
TABLES = {
    # the city's sky and windows: 0 day .. 1 sunset (world.sky crossfades its two skies; kit lights windows by it)
    "night": step([(0, 0.7), (14, 0.7, True), (22, 0.7), (27.5, 1.0), (28, 0.72, True), (31, 0.72), (31, 0.9, True), (34, 1.0)]),
    "lamps": step([(0, 0.0), (24.5, 0.0), (26.5, 1.0), (28, 0.6, True), (31, 0.6), (31, 1.0, True)]),
    "wisps": [(0, 1.0), (14.6, 1.0), (15.4, 0.0)],  # the dive's cloud deck thins as the camera drops out of it
    "spin": [(0, 30.0), (14, 30.0), (34, 36.0)],  # the city sky turning (degrees): the clouds in it drift
    # the Earth: borders drawn in (0..1) and their thickness (km), the beacons' height (km)
    "india": [(0, 0.0), (10.4, 0.0), (11.8, 1.0)],
    "karnataka": [(0, 0.0), (12.3, 0.0), (13.3, 1.0)],
    "border_km": [(0, 7.0), (11.0, 7.0), (12.8, 1.1), (14, 0.6)],
    "beacons": [(0, 0.0), (8.0, 0.0), (9.6, 1.0), (11.6, 1.0), (12.8, 0.0)],  # the world's cities, then off
    "india_beacons": [(0, 0.0), (9.0, 0.0), (10.4, 1.0), (12.4, 1.0), (13.4, 0.35)],
}

# the cloud loop: the two noise fields' drift (m) and how much of the second one shows; see cloud_phase
WIND = (70.0, 18.0, 0.0)  # m per second, a timelapse breeze across the frame


def cloud_phase(sec):
    """Seamless loop: frame 1 and frame 97 show the same clouds. In the loop the field drifts by WIND * t while
    crossfading into the same field a whole loop earlier; after it, the first field drifts on alone."""
    if sec < LOOP:
        return sec, sec - LOOP, sec / LOOP
    return sec - LOOP, 0.0, 0.0


# where the dive into Bengaluru lands: the cloud deck the camera drops out of (x0, y0, z0, x1, y1, z1, m)
DIVE = (-1600.0, -2000.0, 420.0, 1000.0, 800.0, 680.0)

# the property markers: key, x, y, kind (for sale / for rent) - the page lays the prices over them (earth.json)
PINS = [
    ("villa", 0.0, 4.0, "sale"),  # ours: the selected property
    ("v1", -34.0, 4.0, "sale"), ("v2", 51.0, 4.0, "rent"), ("v3", -17.0, 50.0, "sale"), ("v4", 34.0, 50.0, "rent"),
    ("a1", -255.0, 95.0, "sale"), ("a2", 215.0, 255.0, "rent"), ("a3", -330.0, 300.0, "sale"), ("a4", 300.0, -15.0, "rent"),
    ("a5", -150.0, 210.0, "rent"), ("a6", 120.0, 400.0, "sale"), ("a7", -420.0, -10.0, "rent"),
]
PIN_POP = (18.3, 20.6)  # they pop up one after another across this span

# labels the page lays over the film (earth.json carries their screen positions): key -> (point, (from s, to s))
LABELS = {
    "india": (geo(79.0, 22.5), (10.6, 12.6)),
    "karnataka": (geo(75.9, 15.0), (12.6, 14.0)),
    "bengaluru": (geo(77.59, 12.97, 80.0), (12.6, 14.0)),
    "mysuru": (geo(76.64, 12.30), (12.6, 14.0)),
    "tamil-nadu": (geo(78.6, 11.2), (12.6, 14.0)),
    "city-bengaluru": ((0.0, 420.0, 0.0), (14.4, 18.0)),
    "yelahanka": ((-320.0, 2100.0, 0.0), (14.4, 18.0)),
    "whitefield": ((2100.0, 520.0, 0.0), (14.4, 18.0)),
    "sarjapur": ((1500.0, -1500.0, 0.0), (14.4, 18.0)),
    "electronic-city": ((-150.0, -2100.0, 0.0), (14.4, 18.0)),
    "villa-card": ((0.0, 0.0, 4.5), (26.5, 28.0)),
    "clubhouse": ((0.0, 107.0, 7.0), (28.0, 29.0)),
    "park": ((150.0, 10.0, 6.0), (29.0, 30.0)),
    "lake": ((-80.0, -230.0, 2.0), (30.0, 31.0)),
}

# phones see a 9:16 cut of the 16:9 frame: where its centre sits (0..1 across the frame)
CROP = [(0, 0.5), (34, 0.5)]


def crop_at(sec):
    return pw(CROP, sec)
