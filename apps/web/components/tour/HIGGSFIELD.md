# The hero: script and how to make it in Higgsfield

## The idea

**From the sky to your street.** One unbroken shot, no cuts. We wake above the clouds at first light, rise until the
whole Earth hangs in the dark, then fall back towards it, India, then Bengaluru, and land on a living map where every
point of light is a home you can visit.

The first part is a film made in Higgsfield. The last part is the app's real map, drawn live (`map.ts`), so the homes
and prices are real and sharp on any screen. The film's last frame is a screenshot of that map, so the two meet
without a seam.

The whole story takes two screens of scrolling. The page follows the scroll directly, with a short smooth lag
(`Tour.tsx` `LAG`): scroll fast and it moves fast, stop and it stops.

## Look

- **Photoreal, never stylised.** True colours, as in NASA's Blue Marble imagery: deep blue ocean, green and ochre land,
  white cloud.
- **Light:** first light from the east. A low, warm gold sun on the right of frame, long blue shadows in the clouds;
  in space, hard sunlight on the planet and a thin blue rim of atmosphere.
- **Colour:** warm gold against deep ultramarine and black. It sits with the brand's sun yellow and blue.
- **Camera:** a real, heavy camera. Every move is one slow, continuous move that eases in and out. No shake, no whip
  pans, no speed ramps, no lens flares over the planet.
- **Nothing drawn:** no text, logos, borders or outlines anywhere in the film. The map after it draws none either.

## The script

| Beat | Scroll | Film | What we see | On screen |
|---|---|---|---|---|
| **0. Dawn** | at rest | 0-5 s, looping | Just above a sea of clouds at first light. The sun sits a hand's width above the horizon, right of centre. Cloud tops drift slowly towards us; the camera barely breathes. | "Step inside your next address." and the search |
| **1. Rise** | 0-33% | 5-13 s | The camera tilts up and climbs. The cloud sea falls away beneath us, the sky deepens from gold to cobalt to black, stars come out, the curve of the Earth appears, and then the whole planet: India in daylight at its centre, a few white clouds over the Indian Ocean. | "Start from anywhere." |
| **2. Descent** | 33-66% | 13-21 s | The planet turns a little towards us and the camera falls towards India, then the south, thin cloud sliding past and clearing, until we look straight down on Bengaluru from high above, north up. | |
| **3. Handoff** | 66-72% | the last frame | The film's last frame dissolves into the live map at exactly the same framing. | |
| **4. The city** | 72-92% | live map | The satellite view gives way to the street map. The camera tilts to 55 degrees and turns slowly; gold dots rise across the city, and owners' prices on the ones with room. | "Every pin is a home you can visit." |
| **5. Close** | 92-100% | live map | The map holds, the homes still clickable. | "Pick a pin. Come in." and the search |

The numbers live in `config.ts` (`LOOP`, `CLIP`, `HANDOFF`, `CAMERA`, `CAPTIONS`). Until the film exists, the page opens
on the live globe instead (beat 1 without the clouds), so nothing is broken in the meantime.

## Making it in Higgsfield

Three still images (keyframes) and three short videos between them. Each video starts on the frame the one before
it ends on, which is what makes the joins seamless. Generate several takes of each and keep the smoothest.

| | Kind | Start frame | End frame | Length |
|---|---|---|---|---|
| **K1** | image | | | |
| **K2** | image | | | |
| **K3** | screenshot of the live map (below) | | | |
| **S0** dawn loop | video | K1 | K1 | 5 s |
| **S1** rise | video | K1 | K2 | 8 s |
| **S2** descent | video | K2 | K3 | 8 s |

All 16:9, 1080p, 24 fps. Use a video model that takes both a start and an end frame. If the model offers camera
presets, use a crane or tilt up for S1 and a straight push in or zoom in for S2.

### K3: the handoff frame (do this first)

1. Run the site (`pnpm dev`) and open `http://localhost:3000/?handoff` in a browser window sized 1920x1080 (Chrome
   DevTools, device toolbar, Responsive, 1920 x 1080).
2. Wait for the imagery to load: Bengaluru from high above, north up, nothing over it.
3. Screenshot the page (DevTools menu, "Capture screenshot") and save it as `k3-handoff.png`.

### K1: dawn above the clouds (image)

> Photograph from an aircraft window height just above a vast, unbroken sea of cumulus clouds at sunrise. The sun sits
> low above the horizon, right of centre, warm gold, its light raking across the cloud tops and leaving long soft blue
> shadows in the valleys between them. The sky shades from pale gold at the horizon to clear deep blue above. Clean,
> calm, photoreal, natural colour, high dynamic range, 16:9.

Keep the left half of the frame calm (open sky and soft cloud): the title sits over it.

### K2: the whole Earth (image)

> The whole Earth seen from space, photoreal, as in NASA's Blue Marble photographs. The Indian subcontinent in clear
> daylight at the centre of the planet, the Indian Ocean deep blue around it, a few white cloud systems over the sea,
> the night side just beginning at the far left edge. A thin bright blue rim of atmosphere. Black space with a few
> faint stars. True colours, sharp, 16:9, the planet filling about three quarters of the frame height.

Reject any take where India's coastline or shape is wrong.

### S0: dawn loop (start K1, end K1, 5 s)

> The camera holds almost still just above the sea of clouds at sunrise. The cloud tops drift slowly and gently
> towards the camera, their edges softly changing, the gold light shimmering across them. Calm, slow, continuous, no
> cuts, no camera shake.

### S1: rise (start K1, end K2, 8 s)

> One continuous shot. The camera tilts up and rises steadily out of the cloud sea at sunrise, the clouds falling away
> below. The sky deepens from gold to cobalt blue to black as the camera climbs into space; stars appear; the curve of
> the Earth comes into view and the camera keeps pulling back until the whole planet hangs in space, India in daylight
> at its centre. Smooth, slow, eased, photoreal, no cuts.

### S2: descent (start K2, end K3, 8 s)

> One continuous shot. The camera moves straight towards the Earth and down onto India, then onto the south of India,
> thin clouds sliding past and clearing, until it looks straight down on the city from high above, north up, matching
> the end frame exactly. Smooth, steady, eased, photoreal satellite view, no cuts.

### Avoid in every shot (negative prompt, where the model takes one)

text, captions, labels, logos, watermarks, country borders, outlines, map lines, city names, lens flares, sun glare
over the planet, spaceships, satellites, purple nebulae, cartoon, illustration, fast motion, camera shake, cuts,
morphing coastlines.

### Check each take before you keep it

- Its first and last frames match its start and end frames, so the joins don't jump.
- One steady move, no sudden speed changes, no cut.
- India's shape is right, and nothing is drawn on it.

## Join, encode, poster

From the repository root, with ffmpeg. `-t 5` keeps the loop exactly as long as `LOOP` in `config.ts`, and `-g 12` (a
keyframe every half second) keeps scrubbing smooth:

```sh
ffmpeg -t 5 -i s0-loop.mp4 -i s1-rise.mp4 -i s2-descent.mp4 -filter_complex \
  "[0:v]scale=1920:1080,fps=24,setsar=1[a];[1:v]scale=1920:1080,fps=24,setsar=1[b];[2:v]scale=1920:1080,fps=24,setsar=1[c];[a][b][c]concat=n=3:v=1[v]" \
  -map "[v]" -c:v libx264 -preset slow -crf 22 -g 12 -keyint_min 12 -sc_threshold 0 -pix_fmt yuv420p \
  -movflags +faststart -an apps/web/public/tour/hero.mp4
ffmpeg -i apps/web/public/tour/hero.mp4 -frames:v 1 -c:v libwebp -quality 72 apps/web/public/tour/hero-poster.webp
```

Aim for under 8 MB: if it is bigger, run the first command again with `-crf 24` (or 26). Commit both files.

## Before it goes live

- Check Higgsfield's terms for your plan: commercial use of its output can depend on the plan.
- Watch the whole film once more for drawn borders or text over India.
