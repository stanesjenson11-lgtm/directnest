# The hero: script

## The idea

**From the sky to your street.** One unbroken shot, no cuts. We wake above the clouds at first light, rise until the
clouds curve away into the planet hanging in black space, turn to India and come down onto Bengaluru, where every point
of light is a home you can visit.

Everything is drawn live in the browser, nothing is a video: sharp on any screen, nothing to render or re-encode.

- **The clouds** (`clouds.ts`): one shader over the whole screen, a sea of cumulus at sunrise made of noise, with the
  sun low on the right. The camera rises out of it, the sky darkens to space and the cloud sea curves into a planet
  with a thin blue rim.
- **One horizon:** the clouds' camera (`config.ts` `skyCamera`) also frames the globe while the one dissolves into the
  other (`skyFraming`): the same field of view and the horizon at the same height, curving the same way, on any
  screen. `config.test.ts` checks it.
- **The Earth and the city** (`map.ts`): the app's own map as a globe in NASA's Blue Marble imagery (no borders, no
  labels), then the street map with the homes /search shows, at their owners' prices (`app/api/pins`).

The whole story takes two screens of scrolling. The page follows the scroll directly with a short smooth lag
(`Tour.tsx` `LAG`): scroll fast and it moves fast, stop and it stops.

## Beats

| Beat | Ticks (scroll %) | What we see | On screen |
|---|---|---|---|
| **0. Dawn** | at rest | Just above a sea of cloud at first light, the sun low on the right; the clouds drift on the wind. | "Step inside your next address.", its line and the search in one column on the left, over the sky; "Scroll to rise" |
| **1. Rise** | 0-24 | The camera climbs and tilts down. The cloud sea spreads to the horizon, the sky deepens from gold to cobalt to black, stars come out, and the clouds curve away into a planet with a blue rim. | |
| **2. The Earth** | 17-25 | The clouds dissolve into the real Earth on the same horizon, through the sun's glare on the planet's edge; India comes up over it. | |
| **3. Turn to India** | 25-54 | The camera pulls up and back until the whole Earth hangs in space, India at its heart, then closes in on India. | "Start from anywhere." |
| **4. Bengaluru** | 54-82 | Down onto Bengaluru from high above; the imagery gives way to the street map, the camera tilts and turns. | |
| **5. The homes** | 82-92 | Gold dots rise across the city, with owners' prices where they have room. | "Every pin is a home you can visit." |
| **6. Close** | 92-100 | The map holds, the homes still clickable. | "Pick a pin. Come in." and the search |

The numbers live in `config.ts` (`RISE`, `HANDOFF`, `CAMERA`, `PINS_AT`, `CAPTIONS`, `TONE_BREAKS`).

## Look

- **Light:** first light from the east, a low warm gold sun right of centre; blue shadows in the clouds; in space, hard
  sunlight and a thin blue rim of atmosphere.
- **Colour:** warm gold against deep ultramarine and black, with the brand's sun yellow for the homes.
- **Camera:** one continuous move, eased by the scroll's lag. No shake, no cuts.
- **Nothing drawn on the Earth:** no borders or outlines anywhere (the app's maps never draw them).
- **Grain:** a still, fine film grain over the whole shot.
- **The readout:** bottom left, all the way down, where the camera is and how high (km), worked out from the camera
  itself (`config.ts` `altitudeAt`): from 15 km over the clouds to 22,000 km for the whole Earth, then down over
  Bengaluru.

## Phones and fallbacks

- The clouds are drawn at half the screen's pixels on a desktop and a third on a phone, less if frames run slow.
- No WebGL: the tour opens on the live globe. Reduced motion: still clouds, then the globe and the city without the
  flight between.
- `/?handoff` shows the globe as the clouds leave it, nothing over it, to check the dissolve's framing.
