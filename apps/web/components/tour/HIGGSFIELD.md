# The hero's opening clip (Higgsfield)

The home page opens on a short film from space down to south India, then hands over to the live map (`map.ts`),
which flies on into Bengaluru and shows the real homes' prices. The film is made in Higgsfield as two clips joined
into one file. Until that file exists, the page opens on the live globe instead, so nothing is broken in the meantime.

The page expects:

| File | What |
|---|---|
| `apps/web/public/tour/space.mp4` | the two clips joined: H.264, 1920x1080, 24 fps, 12-18 s, no sound, under 8 MB |
| `apps/web/public/tour/space-poster.webp` | its first frame (the first thing a visitor sees, under the title) |

The scroll plays the clip from its first frame to its last (`config.ts` `CLIP`), whatever its exact length. At its last
frame the map fades in over it (`HANDOFF`), so **the clip must end exactly as the map begins**. Clip B gets that
frame as its end frame.

## 1. Get the handoff frame (the clip's last frame)

1. Run the site (`pnpm dev`) and open `http://localhost:3000/?handoff` in a browser window sized 1920x1080 (Chrome
   DevTools, device toolbar, Responsive, 1920 x 1080).
2. Wait for the globe's imagery to load. It shows south India from orbit, north up, with nothing over it.
3. Screenshot the page (DevTools menu, "Capture screenshot") and save it as `handoff.png`.

## 2. Clip A: arrival (text to video)

16:9, 1080p, 24 fps, 8-10 s. Its first frame is the hero's background, with the title over its left side, so keep the
left half of the opening frame empty space.

> Cinematic shot from deep space. Black space with fine, sparse stars, no nebula. The Earth starts small in the right
> third of the frame, lit from the right by a low sun, a thin bright blue atmosphere on its edge. The camera glides
> slowly and steadily towards the planet as it turns; by the end the Earth fills most of the frame, with the Indian
> Ocean and the Indian subcontinent in daylight at its centre, a few white clouds over the sea. Photoreal, like NASA's
> Blue Marble imagery: true colours, deep blue ocean, green and ochre land. Smooth, slow, no shake, no cuts.

Avoid (negative prompt, where the model takes one): text, captions, logos, country borders or outlines, city name
labels, lens flares, spaceships, satellites, purple nebulae, fast motion, cuts.

## 3. Clip B: descent (start and end frame)

Start frame: the last frame of clip A (export it: `ffmpeg -sseof -0.05 -i arrival.mp4 -frames:v 1 a-last.png`).
End frame: `handoff.png`. 16:9, 1080p, 24 fps, 6-8 s.

> The camera descends straight down towards south India from orbit, slow and steady, the planet's curve flattening
> as it comes closer, thin clouds sliding past and clearing. It ends looking straight down, north up, over the south of
> India in clear daylight, matching the end frame exactly. Photoreal satellite imagery, true colours, no shake.

Same things to avoid as clip A, and above all no borders or outlines on India: the map after it draws none either.

## 4. Join, encode, poster

From the repository root, with ffmpeg (a short keyframe interval, `-g 12`, keeps scrubbing smooth):

```sh
ffmpeg -i arrival.mp4 -i descent.mp4 -filter_complex \
  "[0:v]scale=1920:1080,fps=24,setsar=1[a];[1:v]scale=1920:1080,fps=24,setsar=1[b];[a][b]concat=n=2:v=1[v]" \
  -map "[v]" -c:v libx264 -preset slow -crf 22 -g 12 -keyint_min 12 -sc_threshold 0 -pix_fmt yuv420p \
  -movflags +faststart -an apps/web/public/tour/space.mp4
ffmpeg -i apps/web/public/tour/space.mp4 -frames:v 1 -c:v libwebp -quality 70 apps/web/public/tour/space-poster.webp
```

Over 8 MB? Run the first command again with `-crf 24` (or 26). Then commit both files.

## Before it goes live

- Check Higgsfield's terms for your plan: commercial use of its output can depend on the plan.
- Look through every frame for drawn borders or text over India: the map and the clip must never draw a border.
