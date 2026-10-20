# Walking reach, Weimar

A 3D map of central Weimar that shows how far you can walk from any point in 5, 10 and 15 minutes, and about how many people live there.

## What the app does

- It shows the whole city kit in 3D. The buildings are extruded from their footprints to their measured height and coloured by their main use, with a legend. The street network is drawn as thin lines on a pale ground. Drag to orbit, right-drag to pan, scroll to zoom.
- When you click on the ground, the walk starts at the nearest node of the pedestrian network. If no walkable street lies within 100 m of the click, the panel says so.
- The app draws three nested areas, for 5, 10 and 15 minutes, in three shades of one accent colour. Buildings that touch an area are highlighted in the matching shade.
- For each area, the panel gives the number of buildings reached and about how many residents live there.

## Run it

You need [Node.js](https://nodejs.org) (version 20 or newer).

```
npm install     install the packages (once)
npm run dev     start the app at http://localhost:5173
```

`npm run build` makes the published version in `dist/`. Every push to `main` publishes the app to GitHub Pages at `https://<user>.github.io/<repo>/`, through the workflow in `.github/workflows/`.

## Method and its limits

- **Walking speed.** 4.8 km/h, which is 80 m per minute: 400 m in 5 minutes, 800 m in 10 and 1200 m in 15. The walk follows only the walkable edges of the pedestrian network, using each edge's length in metres, in both directions. Slopes, steps, crossings and waiting at traffic lights are not counted.
- **Start.** The walk starts at the walkable street node nearest to the click. The few metres from the click to that node are not counted as walking time.
- **The 25 m band.** Each area is the street segments reached in that time, including the reachable part of the last segment, with a band of 25 m on each side, joined into one shape. It is not a circle and not a convex hull. A building counts as reached when any part of its footprint touches the area, even if its entrance is somewhere else.
- **How residents are counted.** The residents come from the Zensus 2022 grid of 100 m cells. For every cell that overlaps the area, the app takes the cell's population times the share of the cell's area that lies inside the area. It adds these up and rounds to the nearest 10. This assumes people are spread evenly across each cell, which they are not: they live in the buildings. The census also changes small counts slightly to protect privacy, so single cells are approximate.
- **Cells without a figure are left out.** Some cells have no published resident count (`population` is `null`). They are not zero, so the app leaves them out of the sum and shows next to it how many such cells overlap the area. The true number of residents is therefore at least the figure shown.
- **Edges of the kit.** The kit ends about 1.3 × 2 km around the Markt. A walk that would continue past its edge stops there, so areas near the edge are smaller than in reality.

## Weimar 2077: an imagined layer

The **Weimar 2077** switch turns the map into Weimar at night in 2077. Five **Explore** tabs then open modes, each with its own picture and sound. Landmark labels call up the ghosts of their guides. The tabs and guides are visual and sound only: they take no clicks on the ground and don't change the buildings, the resident counts or the data files. With the switch off, the plain daytime map and the walk come back.

### Supersonic reach (2077 only)

In 2077 nobody walks: a click starts a ride in an imagined supersonic pod, running in tubes above the same street network at Mach 1.5, about 515 m per second. The three areas are what you reach in **1, 2 and 3 seconds** (515 m, 1,030 m and 1,545 m), worked out exactly like the walk, with the same 25 m band, building count and resident estimate. The panel also says how long the 3-second ride would take on foot. A yellow shock wave rings out from the start. Switching 2077 off works out the same start again on foot (5, 10, 15 minutes). The speed is imagined; the streets, buildings and residents are real.

### The town at night (always on in 2077)

- **Buildings.** Every building keeps its real footprint and its measured height (the highest point of the roof). About 2,950 buildings of historic size get an approximate pitched roof that rises to that height. The kit has no roof shapes, so the roof form is an approximation; large blocks and courtyard buildings keep flat roofs.
- **Facades.** Plaster in the building's use colour, lit from the street below, cornice lines at every floor, tall framed windows in a historic rhythm, shopfronts with a neon strip, neon under the eaves and tiled roofs. The use colours stay readable.
- **Land.** Parks, cemeteries, water and public squares come from the kit's land use plots. Green areas stay green, with trees swaying in the wind. Water is dark with soft reflections. The squares get lit paving with slow holographic rings.
- **Streets.** Cyan street lines, about 1,700 street lamps and lit rings at the 351 intersections where three or more ways meet.
- **Lighting.** Moonlight and a glow around the brightest lights. The walk areas show in their three shades.

### Explore tabs

Each tab shows a short description before you pick it. Clicking the open tab again returns to the overview.

- **Density.** Busy blocks burn with lights, links, data streams, glitches and interference; quiet ones go dark. Two real figures drive it. The first is building density: the share of each 50 m square covered by footprints, shown as a glowing grid from blue (sparse) through cyan to yellow (55 % built or more). The second is residents: one signal speck for every 2 residents of each 100 m census cell (Zensus 2022), floating over that cell's buildings. Which building a speck floats over is made up; cells without a published figure show none. This is a picture of activity, not measured movement or live tracking. Green areas are left out. *Sound: a chaotic digital soundscape.*
- **Transportation.** Weimar's real city bus lines 1 to 9 in a version for 2077. The routes, stops, line numbers and line colours are today's, from OpenStreetMap (operator Stadtwirtschaft Weimar), shown where they cross the map. Each line becomes a glowing hover-line 18 m above its real route, in its real colour, side by side where lines share a street, so the busy Goetheplatz–Hauptbahnhof corridor shows as a wide band. Hover pods run back and forth, every real stop has a lit platform with a light lift to the street (white where several lines stop), and Goetheplatz, the hub today, has the largest. Flying craft use higher lanes and light trails race along the streets. The legend lists the lines with their real end stops. *Sound: propulsion hum, vehicles passing by, station chimes.*
- **Pollution.** Smog hangs over the dense parts of town. Its thickness is imagined from real data: the building density (share of each 50 m square covered by footprints), blurred over about 100 m. Over the densest blocks the smog is thick and rises up to about 75 m; over sparse areas there is only a thin haze. Exhaust plumes rise from the 60 tallest roofs in dense blocks, the whole air turns brown-grey and the town's lights dim. It is a picture, not a measurement of the air. *Sound: low rumble, roaring vents, hissing exhaust, air-quality warnings.*
- **Forest.** The camera flies close to the largest green area, and a button in the legend flies on to the next of the four largest. The trees are sick from the smog: each tree's health is imagined from the smog around it (blurred over about 200 m, with some chance between neighbours), so trees near the dense town suffer most. Most trees are hit: about half are dead and a third are dying; only a few far from the town stay healthy. Healthy trees stay green, sick ones turn yellow, dying ones rust-brown with sparse crowns, and dead ones lose their crowns entirely: they stand as charred, leaning trunks with bare branches, and some have fallen over. The grass has dried to a dusty brown, brown leaves and ash fall, a yellow-grey haze drifts through and almost no fireflies are left. A red warning sign floats over the area with the share of dying and dead trees, and the legend counts the trees in each class. Leaving the tab flies back to the overview. *Sound: wind, dry leaves, creaking dead wood, few birds, the town's drone.*
- **Landmarks.** Weimar's real buildings in warm light: every roofline traced, cornices and window frames picked out, streets in amber, and a holographic shell scanning each landmark building. *Sound: a quiet, atmospheric city.*

### Landmark ghosts

Yellow labels mark Weimar landmarks in the map, so you can see what to explore before you click. A click on a label calls up the guide of that place as a ghost: the camera glides to the building, and a pale, see-through hologram rises out of its roof, floats above it and fades into a wisp of light at the bottom. There is no side panel; the ghost stands in the 3D map, so it stays on its building when you orbit. It is a stylised, animated drawing, not a portrait: it sways, blinks and flickers, and its mouth moves while it speaks. It tells a few sentences about the place, spoken by your browser's built-in voice, with each sentence as a subtitle at the bottom of the screen. Clicking the label again, the ✕ under the subtitles or Esc sends the ghost away, and the camera glides back.

| Landmark | Guide |
| --- | --- |
| Goethe's House, Frauenplan | Johann Wolfgang von Goethe |
| Schiller's House, Schillerstraße | Friedrich Schiller |
| German National Theatre, Theaterplatz | Friedrich Ebert (the 1919 National Assembly) |
| Bauhaus-Museum | Walter Gropius |
| Van de Velde Building, Bauhaus-Universität | Henry van de Velde |
| Herderkirche | Johann Gottfried Herder |
| Duchess Anna Amalia Library | Duchess Anna Amalia |
| Liszt House | Franz Liszt |
| Cranach House, Markt | Lucas Cranach the Elder |
| City Palace | Duke Carl August |
| Goetheplatz, Hauptbahnhof | an imagined transit guide |

The landmark locations were looked up once in OpenStreetMap and stored in `src/landmarks.js`; the app fetches nothing. Every building landmark falls inside a building footprint of the kit. The texts are short summaries of well-documented history.

### Sound

All sound is generated live in the browser with the Web Audio API; there are no audio files. It starts only after you click a tab or a landmark, because browsers block sound before that. Modes crossfade smoothly. The panel has a mute button and a volume slider. While a guide speaks, the ambient sound fades down, and a new narration always stops the old one, so voices never overlap. When sound is muted, the captions still play on their own.

## Data sources

All data is in `public/data/` and loads with the app. Nothing is fetched from the internet. See `public/data/SOURCES.md` for the fields and units.

| File | Content | Source | Licence |
| --- | --- | --- | --- |
| `buildings.geojson` | 4316 footprints with height (m), floors and main use | 3D building models LoD2 of Thuringia, © GDI-Th; uses: Egor Gaydukov | dl-de/by-2-0 |
| `streets.graph.json` | pedestrian network: 962 nodes, 1186 edges with length (m) | Egor Gaydukov, InfAU, Bauhaus-Universität Weimar | |
| `plots.geojson` | land use per plot (green areas, water, squares for the 2077 view) | Egor Gaydukov, InfAU, Bauhaus-Universität Weimar | |
| `zensus.geojson` | 245 census cells of 100 m with residents (persons) | Zensus 2022, © Statistische Ämter des Bundes und der Länder | dl-de/by-2-0 |
| `kit.json` | centre and bounding box of the kit area | the kit generator | |
| `buslines.json` | Weimar city bus lines 1–9: route, stops, line colour, clipped to the kit | OpenStreetMap route relations (operator Stadtwirtschaft Weimar), looked up once on 2026-10-20 | ODbL |
| `src/landmarks.js` | locations of 12 landmarks | © OpenStreetMap contributors | ODbL |

Attribution, as shown on the map:

> Buildings: 3D building models LoD2 © GDI-Th (dl-de/by-2-0). Land use and pedestrian network: Egor Gaydukov, InfAU, Bauhaus-Universität Weimar. Census grid: Zensus 2022, © Statistische Ämter des Bundes und der Länder (dl-de/by-2-0). Landmark locations and bus lines: © OpenStreetMap contributors (ODbL).

## How this was made

1. Tools: Claude Code, with the model Claude Opus 5.5.
2. I decided:
3. The agent did: it read the city kit, wrote the 3D map and the walking, band and resident calculations in Vite, React and React Three Fiber, added the Weimar 2077 layers, the five Explore modes (with the real bus lines from OpenStreetMap, the imagined smog and tree health), the supersonic reach with generated sound and the landmark guides, checked the results in a browser on localhost and with the GitHub Pages path, and wrote this README.
4. I checked:
