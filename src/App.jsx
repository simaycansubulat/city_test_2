import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import CityScene from './CityScene.jsx'
import { BAND_M, MAX_SNAP_M, SPEED_M_PER_MIN, SUPERSONIC_M_PER_S, TRAVEL, computeReach, prepareCity } from './reach.js'
import { REACH_COLORS, USE_COLORS, USE_LABELS } from './palette.js'
import { CYBER_COLORS, DENSITY_CELL_M, DENSITY_FULL, DENSITY_RAMP, RESIDENTS_PER_SPECK } from './Cyber.jsx'
import { prepareBusLines } from './Transport.jsx'
import { SMOG_RAMP } from './Pollution.jsx'
import { SMOG_RADIUS_M, TREE_HEALTH, prepareScenery } from './scenery.js'
import { prepareLandmarks } from './landmarks.js'
import { SoundEngine } from './audio.js'
import GhostSubtitles, { useNarration } from './LandmarkPanel.jsx'

const ATTRIBUTION =
  'Buildings: 3D building models LoD2 © GDI-Th (dl-de/by-2-0). Land use and pedestrian network: Egor Gaydukov, InfAU, Bauhaus-Universität Weimar. Census grid: Zensus 2022, © Statistische Ämter des Bundes und der Länder (dl-de/by-2-0). Landmark locations and bus lines: © OpenStreetMap contributors (ODbL).'

// The five modes of Weimar 2077, with the short description shown on each tab before you pick it
const MODES = [
  { id: 'density', icon: '◈', name: 'Density', text: 'Busy blocks burn with signals, links and glitches; quiet ones go dark.', sound: 'chaotic digital noise' },
  { id: 'transport', icon: '⇄', name: 'Transportation', text: "Weimar's real bus lines 1–9, reborn as hover-lines on their real routes.", sound: 'vehicles and propulsion' },
  { id: 'pollution', icon: '☁', name: 'Pollution', text: 'Smog hangs over the dense blocks; exhaust rises from the roofs.', sound: 'rumble, vents, warnings' },
  { id: 'forest', icon: '❦', name: 'Forest', text: 'Fly into the parks: the trees are sick from the smog, many are dying.', sound: 'wind, creaking, few birds' },
  { id: 'architecture', icon: '⌂', name: 'Landmarks', text: "Weimar's landmarks in warm light. Click a label: its ghost rises from the roof.", sound: 'a quiet city atmosphere' },
]

// What each mode takes from the data, and what is imagined
const MODE_NOTES = {
  null: 'The buildings keep their real footprints and heights; their roofs are approximated, because the kit has no roof shapes. Green areas, water and squares come from the land use plots. Imagined, not data: the lit windows, neon, lamps, spotlights, holograms and flight lanes.',
  density: `From the data: the density colours (building footprints, ${DENSITY_CELL_M} m squares) and the number of signal specks per 100 m cell (one per ${RESIDENTS_PER_SPECK} residents, Zensus 2022). Imagined: the motion, links, data streams, glitches and where each speck floats. This is a picture of activity, not measured or live tracking.`,
  transport:
    "From the real city: the routes, stops, numbers and colours of Weimar's city bus lines 1–9 today (OpenStreetMap, operator Stadtwirtschaft Weimar), clipped to the map. Imagined: the hover-lines 18 m above the routes, the pods, the platforms, the flying craft and the light trails. A vision, not a plan.",
  pollution: `From the data: building density (footprints, ${DENSITY_CELL_M} m squares). Imagined: the smog. Its thickness is the building density blurred over about ${SMOG_RADIUS_M} m, so it is thickest over the densest blocks. It is a picture, not a measurement of the air.`,
  forest:
    "From the data: the parks and cemeteries of the land use plots. Imagined: where each tree stands and how sick it is. A tree's health follows the imagined smog around it, so trees near the dense town suffer most.",
  architecture:
    'From the data: every footprint and height; the landmark locations come from OpenStreetMap. Approximated: the pitched roofs. Imagined: the lighting and the holographic shells.',
}

// Every data file goes through BASE_URL, so the app works on localhost and on GitHub Pages
async function loadJSON(name) {
  const r = await fetch(`${import.meta.env.BASE_URL}data/${name}`)
  if (!r.ok) throw new Error(`data/${name}: ${r.status}`)
  return r.json()
}

const fmt = (n) => n.toLocaleString('en-GB')

export default function App() {
  const [city, setCity] = useState(null)
  const [scenery, setScenery] = useState(null) // what the 2077 view draws; never used in the calculations
  const [busLines, setBusLines] = useState(null)
  const [forestIndex, setForestIndex] = useState(0) // which green area the Forest camera visits
  const [error, setError] = useState(null)
  const [reach, setReach] = useState(null)
  const [working, setWorking] = useState(false)
  const [look2077, setLook2077] = useState(true)
  const [mode, setMode] = useState(null) // null: overview
  const [selected, setSelected] = useState(null) // the open landmark
  const [volume, setVolume] = useState(0.6)
  const [muted, setMuted] = useState(false)

  useEffect(() => {
    Promise.all(['kit.json', 'buildings.geojson', 'streets.graph.json', 'zensus.geojson', 'plots.geojson', 'buslines.json'].map(loadJSON))
      .then(([kit, buildings, graph, zensus, plots, buses]) => {
        const c = prepareCity({ kit, buildings, graph, zensus })
        setScenery(prepareScenery(c, { plots, zensus }))
        setBusLines(prepareBusLines(c, buses))
        setCity(c)
      })
      .catch((e) => setError(e.message))
  }, [])
  const landmarks = useMemo(() => (city ? prepareLandmarks(city) : []), [city])

  // Sound: one engine for the whole page, started by the first click on a tab or a landmark
  const engine = useRef(null)
  if (!engine.current) engine.current = new SoundEngine()
  useEffect(() => engine.current.setVolume(volume), [volume])
  useEffect(() => engine.current.setMuted(muted), [muted])
  useEffect(() => () => engine.current.dispose(), [])

  const chooseMode = (id) => {
    const next = mode === id ? null : id // a second click on the open tab goes back to the overview
    engine.current.unlock()
    engine.current.setMode(next)
    setMode(next)
    if (next === 'forest') setForestIndex(0)
    if (next) setLook2077(true)
  }
  // a click on a label calls up its ghost; a second click on the same label sends it away
  const openLandmark = useCallback((l) => {
    engine.current.unlock()
    setSelected((now) => (now?.id === l.id ? null : l))
  }, [])
  const closeLandmark = useCallback(() => setSelected(null), [])
  const voice = useRef({ mouth: 0, speaking: false }) // read by the ghost every frame
  const narration = useNarration(selected, engine.current, muted, volume, voice)
  const toggleLook = (on) => {
    setLook2077(on)
    if (!on) {
      setMode(null)
      setSelected(null)
      engine.current.setMode(null)
    }
  }

  // In 2077 you don't walk: supersonic pods take you along the same streets
  const travel = look2077 ? TRAVEL.supersonic : TRAVEL.walk
  const onGroundClick = useCallback(
    (point) => {
      if (!city || working) return
      setWorking(true)
      // Let the page show "Working…" before the calculation takes the main thread
      setTimeout(() => {
        setReach(computeReach(city, point, travel))
        setWorking(false)
      }, 20)
    },
    [city, working, travel],
  )
  // Switching 2077 on or off works out the same start again, on foot or supersonic
  useEffect(() => {
    if (city && reach?.levels && reach.travel !== travel.id) setReach(computeReach(city, reach.point, travel))
  }, [city, reach, travel])

  return (
    <div className={`app${working ? ' busy' : ''}${look2077 ? ' y2077' : ''}${mode ? ' mode-' + mode : ''}`}>
      {city && scenery && busLines && (
        <CityScene
          city={city}
          scenery={scenery}
          busLines={busLines}
          landmarks={landmarks}
          reach={reach}
          onGroundClick={onGroundClick}
          look2077={look2077}
          mode={mode}
          forestIndex={forestIndex}
          selected={selected}
          onSelect={openLandmark}
          voice={voice}
        />
      )}
      {!city && <div className="loading">{error ? `The city kit didn't load (${error}).` : 'Loading the city kit…'}</div>}

      <aside className="panel">
        {look2077 && <div className="tag">Weimar · 2077</div>}
        <h1>{look2077 ? 'Supersonic reach' : 'Walking reach'}</h1>
        <p className="hint">
          Click on the ground, between the buildings, to start {look2077 ? 'a supersonic ride' : 'a walk'} there. Drag to
          orbit, right-drag to pan, scroll to zoom.
        </p>

        <div className="switches">
          <label>
            <input type="checkbox" checked={look2077} onChange={(e) => toggleLook(e.target.checked)} />
            Weimar 2077: the real town at night, technologically evolved
          </label>
        </div>

        <h2>Explore</h2>
        <div className="tabs" role="tablist">
          {MODES.map((m) => (
            <button
              key={m.id}
              role="tab"
              aria-selected={mode === m.id}
              className={`tab ${m.id}${mode === m.id ? ' on' : ''}`}
              onClick={() => chooseMode(m.id)}
            >
              <span className="tab-head">
                <span className="tab-icon">{m.icon}</span>
                {m.name}
              </span>
              <span className="tab-text">{m.text}</span>
              <span className="tab-sound">♪ {m.sound}</span>
            </button>
          ))}
        </div>

        <div className="sound">
          <button className="icon" onClick={() => setMuted(!muted)} aria-label={muted ? 'Unmute' : 'Mute'}>
            {muted ? '🔇' : '🔊'}
          </button>
          <input type="range" min="0" max="1" step="0.05" value={volume} onChange={(e) => setVolume(+e.target.value)} aria-label="Volume" />
          <span className="small">{muted ? 'muted' : `${Math.round(volume * 100)}%`}</span>
        </div>
        <p className="small">
          Sound is made live in your browser and starts when you pick a tab or a landmark. Click the open tab again to
          return to the overview.
        </p>
        {look2077 && <p className="imagined">{MODE_NOTES[mode]}</p>}
        {look2077 && <p className="small">Click a labelled landmark in the map: its guide rises from the roof as a ghost and speaks. Click the label again or press Esc to send it away.</p>}

        <Results reach={reach} working={working} />

        <div className="method">
          <h2>How this is worked out</h2>
          {look2077 ? (
            <p>
              In 2077 you don't walk. Supersonic pods run in tubes above the same street network at Mach 1.5, about{' '}
              {SUPERSONIC_M_PER_S} m per second: {SUPERSONIC_M_PER_S} m in 1 second, {2 * SUPERSONIC_M_PER_S} m in 2,{' '}
              {3 * SUPERSONIC_M_PER_S} m in 3. The speed is imagined; the streets, buildings and residents are real. The
              ride starts at the street node nearest to your click, if one lies within {MAX_SNAP_M} m. Switch 2077 off to
              see the same start on foot.
            </p>
          ) : (
            <p>
              The walk starts at the street node nearest to your click, if one lies within {MAX_SNAP_M} m. It follows
              the walkable street network at 4.8 km/h, which is {SPEED_M_PER_MIN} m per minute: {5 * SPEED_M_PER_MIN} m
              in 5 minutes, {10 * SPEED_M_PER_MIN} m in 10, {15 * SPEED_M_PER_MIN} m in 15.
            </p>
          )}
          <p>
            Each area is the street segments reached in that time, including the reachable part of the last segment,
            with a band of {BAND_M} m on each side, joined into one shape. A building counts when it touches the area.
          </p>
          <p>
            Residents come from the Zensus 2022 grid of 100 m cells. For each cell that overlaps the area, its
            population is multiplied by the share of the cell's area that lies inside, then the cells are added up and
            rounded to the nearest 10.
          </p>
          <p>
            Some cells have no published figure. They are not zero, so they are left out of the sum, and the panel
            says how many of them overlap the area.
          </p>
        </div>
      </aside>

      {selected && <GhostSubtitles landmark={selected} narration={narration} muted={muted} onClose={closeLandmark} />}
      <Legend
        look2077={look2077}
        mode={mode}
        travel={travel}
        busLines={busLines}
        scenery={scenery}
        forestIndex={forestIndex}
        onNextForest={() => setForestIndex((i) => i + 1)}
      />

      <footer className="attribution">{ATTRIBUTION}</footer>
    </div>
  )
}

function Results({ reach, working }) {
  if (working) return <p className="status">Working…</p>
  if (!reach) return <p className="status">No walk yet.</p>
  if (reach.error) return <p className="status warn">{reach.error}</p>
  const supersonic = reach.travel === 'supersonic'
  const last = reach.levels[reach.levels.length - 1]
  return (
    <>
      <table className="results">
        <thead>
          <tr>
            <th>{supersonic ? 'Ride' : 'Walk'}</th>
            <th>Buildings</th>
            <th>Residents</th>
          </tr>
        </thead>
        <tbody>
          {reach.levels.map((l, i) => (
            <tr key={l.time}>
              <td>
                <span className="swatch" style={{ background: REACH_COLORS[i] }} />
                {l.time} {l.unit}
                {supersonic && <span className="note"> ({fmt(l.budget)} m)</span>}
              </td>
              <td>{fmt(l.buildings.length)}</td>
              <td>
                about {fmt(l.residents)}
                {l.nullCells > 0 && (
                  <span className="note">
                    {' '}
                    + {l.nullCells} {l.nullCells === 1 ? 'cell' : 'cells'} without a figure
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {supersonic && (
        <p className="small">
          On foot, the {last.time}-second ride would take about {Math.round(last.budget / SPEED_M_PER_MIN)} minutes.
        </p>
      )}
      <p className="small">
        The {supersonic ? 'ride' : 'walk'} starts {Math.round(reach.start.dist)} m from your click.
      </p>
    </>
  )
}

function Legend({ look2077, mode, travel, busLines, scenery, forestIndex, onNextForest }) {
  const densityEffect = mode === 'density'
  const forest = scenery && mode === 'forest' ? scenery.forests[forestIndex % scenery.forests.length] : null
  return (
    <div className="legend">
      <h2>Main use of the building{look2077 ? ': neon edges and roofs' : ''}</h2>
      <ul>
        {Object.keys(USE_COLORS).map((use) => (
          <li key={use}>
            <span className="swatch" style={{ background: USE_COLORS[use] }} />
            {USE_LABELS[use]}
          </li>
        ))}
      </ul>
      <h2>{travel.id === 'supersonic' ? 'Reached by supersonic pod' : 'Reached on foot'}</h2>
      <ul>
        {travel.levels.map((l, i) => (
          <li key={l.time}>
            <span className="swatch" style={{ background: REACH_COLORS[i] }} />
            {l.time} {travel.unit === 's' ? (l.time === 1 ? 'second' : 'seconds') : 'minutes'}
          </li>
        ))}
      </ul>
      {look2077 && (
        <>
          <h2>Land, from the land use plots</h2>
          <ul>
            <li>
              <span className="swatch" style={{ background: '#2f6e3b' }} />
              Parks, cemeteries
            </li>
            <li>
              <span className="swatch" style={{ background: '#0f3557' }} />
              Water
            </li>
            <li>
              <span className="swatch" style={{ background: '#5a4632' }} />
              Public squares
            </li>
          </ul>
        </>
      )}
      {densityEffect && (
        <>
          <h2>Building density, {DENSITY_CELL_M} m squares</h2>
          <div className="ramp" style={{ background: `linear-gradient(90deg, ${DENSITY_RAMP.join(', ')})` }} />
          <div className="ramp-labels">
            <span>sparse</span>
            <span>{Math.round(DENSITY_FULL * 100)}%+ of the ground built</span>
          </div>
          <ul className="single">
            <li>
              <span className="swatch dot" style={{ background: CYBER_COLORS.noise }} />
              Signal specks: 1 per {RESIDENTS_PER_SPECK} residents of each 100 m census cell, over its buildings
            </li>
          </ul>
        </>
      )}
      {mode === 'transport' && busLines && (
        <>
          <h2>Weimar's bus lines today, as 2077 hover-lines</h2>
          <ul className="single">
            {busLines.map((l) => (
              <li key={l.ref}>
                <span className="line-badge" style={{ background: l.color }}>
                  {l.ref}
                </span>
                {l.from} – {l.to}
              </li>
            ))}
          </ul>
          <p className="small">
            Real routes, stops and colours (OpenStreetMap), shown where they cross the map. Rings mark the real stops;
            white rings are shared by several lines. The big ring is Goetheplatz, the hub.
          </p>
        </>
      )}
      {mode === 'pollution' && (
        <>
          <h2>Smog, imagined from building density</h2>
          <div className="ramp" style={{ background: `linear-gradient(90deg, ${SMOG_RAMP.join(', ')})` }} />
          <div className="ramp-labels">
            <span>light haze</span>
            <span>thick smog over the densest blocks</span>
          </div>
          <ul className="single">
            <li>
              <span className="swatch dot" style={{ background: '#8f8462' }} />
              Exhaust plumes from the tallest roofs in dense blocks
            </li>
          </ul>
        </>
      )}
      {forest && (
        <>
          <h2>Tree health, imagined from the smog</h2>
          <ul className="single">
            {TREE_HEALTH.map((h, i) => (
              <li key={h.id}>
                <span className="swatch" style={{ background: h.color }} />
                {h.label}: {fmt(forest.health[i])}
              </li>
            ))}
          </ul>
          <p className="small">
            Green area {(forestIndex % scenery.forests.length) + 1} of {scenery.forests.length}: about{' '}
            {(forest.area / 10000).toFixed(1)} ha, {fmt(forest.trees)} trees.
          </p>
          <button className="next-forest" onClick={onNextForest}>
            Fly to the next green area ›
          </button>
        </>
      )}
      {look2077 && (
        <>
          <h2>Imagined, not data</h2>
          <ul className="single">
            <li>
              <span className="swatch line" style={{ background: CYBER_COLORS.holo }} />
              Holograms, links, data streams, glitches
            </li>
            <li>
              <span className="swatch line" style={{ background: CYBER_COLORS.lane }} />
              Flight lanes and maglev, traced along real streets
            </li>
            <li>
              <span className="swatch dot" style={{ background: '#fcee0a' }} />
              Labels: landmarks with a holographic guide
            </li>
          </ul>
        </>
      )}
    </div>
  )
}
