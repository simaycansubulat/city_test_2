import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import CityScene from './CityScene.jsx'
import { BAND_M, MAX_SNAP_M, SPEED_M_PER_MIN, computeReach, prepareCity } from './reach.js'
import { REACH_COLORS, USE_COLORS, USE_LABELS } from './palette.js'
import { CYBER_COLORS, DENSITY_CELL_M, DENSITY_FULL, DENSITY_RAMP, RESIDENTS_PER_SPECK } from './Cyber.jsx'
import { LINE_COLORS } from './Transport.jsx'
import { prepareScenery } from './scenery.js'
import { prepareLandmarks } from './landmarks.js'
import { SoundEngine } from './audio.js'
import LandmarkPanel from './LandmarkPanel.jsx'

const ATTRIBUTION =
  'Buildings: 3D building models LoD2 © GDI-Th (dl-de/by-2-0). Land use and pedestrian network: Egor Gaydukov, InfAU, Bauhaus-Universität Weimar. Census grid: Zensus 2022, © Statistische Ämter des Bundes und der Länder (dl-de/by-2-0). Landmark locations: © OpenStreetMap contributors (ODbL).'

// The four modes of Weimar 2077, with the short description shown on each tab before you pick it
const MODES = [
  { id: 'density', icon: '◈', name: 'Density', text: 'Busy blocks burn with signals, links and glitches; quiet ones go dark.', sound: 'chaotic digital noise' },
  { id: 'transport', icon: '⇄', name: 'Transportation', text: 'Maglev lines from Goetheplatz, the real bus hub, and racing light trails.', sound: 'vehicles and propulsion' },
  { id: 'forest', icon: '❦', name: 'Forest', text: 'Parks stay green and alive: swaying trees, fireflies, mist.', sound: 'birdsong, wind, leaves' },
  { id: 'architecture', icon: '⌂', name: 'Architecture', text: 'Historic facades, rooflines and landmarks in warm and holographic light.', sound: 'a quiet city atmosphere' },
]

// What each mode takes from the data, and what is imagined
const MODE_NOTES = {
  null: 'The buildings keep their real footprints and heights; their roofs are approximated, because the kit has no roof shapes. Green areas, water and squares come from the land use plots. Imagined, not data: the lit windows, neon, lamps, spotlights, holograms and flight lanes.',
  density: `From the data: the density colours (building footprints, ${DENSITY_CELL_M} m squares) and the number of signal specks per 100 m cell (one per ${RESIDENTS_PER_SPECK} residents, Zensus 2022). Imagined: the motion, links, data streams, glitches and where each speck floats. This is a picture of activity, not measured or live tracking.`,
  transport:
    "From the data and the real city: the street network, Goetheplatz (Weimar's central bus stop today) and the Hauptbahnhof. Imagined: the maglev lines, trains, flying craft and light trails. The lines follow real streets, but they are a vision, not a plan.",
  forest: 'From the data: the parks and cemeteries of the land use plots. Imagined: where each tree stands, the fireflies and the mist. Digital effects stay out of the green.',
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
  const [error, setError] = useState(null)
  const [reach, setReach] = useState(null)
  const [working, setWorking] = useState(false)
  const [look2077, setLook2077] = useState(true)
  const [mode, setMode] = useState(null) // null: overview
  const [selected, setSelected] = useState(null) // the open landmark
  const [volume, setVolume] = useState(0.6)
  const [muted, setMuted] = useState(false)

  useEffect(() => {
    Promise.all(['kit.json', 'buildings.geojson', 'streets.graph.json', 'zensus.geojson', 'plots.geojson'].map(loadJSON))
      .then(([kit, buildings, graph, zensus, plots]) => {
        const c = prepareCity({ kit, buildings, graph, zensus })
        setScenery(prepareScenery(c, { plots, zensus }))
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
    if (next) setLook2077(true)
  }
  const openLandmark = useCallback((l) => {
    engine.current.unlock()
    setSelected(l)
  }, [])
  const toggleLook = (on) => {
    setLook2077(on)
    if (!on) {
      setMode(null)
      setSelected(null)
      engine.current.setMode(null)
    }
  }

  const onGroundClick = useCallback(
    (point) => {
      if (!city || working) return
      setWorking(true)
      // Let the page show "Working…" before the calculation takes the main thread
      setTimeout(() => {
        setReach(computeReach(city, point))
        setWorking(false)
      }, 20)
    },
    [city, working],
  )

  return (
    <div className={`app${working ? ' busy' : ''}${look2077 ? ' y2077' : ''}${mode ? ' mode-' + mode : ''}`}>
      {city && scenery && (
        <CityScene
          city={city}
          scenery={scenery}
          landmarks={landmarks}
          reach={reach}
          onGroundClick={onGroundClick}
          look2077={look2077}
          mode={mode}
          selected={selected}
          onSelect={openLandmark}
        />
      )}
      {!city && <div className="loading">{error ? `The city kit didn't load (${error}).` : 'Loading the city kit…'}</div>}

      <aside className="panel">
        {look2077 && <div className="tag">Weimar · 2077</div>}
        <h1>Walking reach</h1>
        <p className="hint">Click on the ground, between the buildings, to start a walk there. Drag to orbit, right-drag to pan, scroll to zoom.</p>

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
        {look2077 && <p className="small">Click a labelled landmark in the map to meet its holographic guide.</p>}

        <Results reach={reach} working={working} />

        <div className="method">
          <h2>How this is worked out</h2>
          <p>
            The walk starts at the street node nearest to your click, if one lies within {MAX_SNAP_M} m. It follows
            the walkable street network at 4.8 km/h, which is {SPEED_M_PER_MIN} m per minute: {5 * SPEED_M_PER_MIN} m in
            5 minutes, {10 * SPEED_M_PER_MIN} m in 10, {15 * SPEED_M_PER_MIN} m in 15.
          </p>
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

      {selected ? (
        <LandmarkPanel landmark={selected} engine={engine.current} muted={muted} volume={volume} onClose={() => setSelected(null)} />
      ) : (
        <Legend look2077={look2077} mode={mode} />
      )}

      <footer className="attribution">{ATTRIBUTION}</footer>
    </div>
  )
}

function Results({ reach, working }) {
  if (working) return <p className="status">Working…</p>
  if (!reach) return <p className="status">No walk yet.</p>
  if (reach.error) return <p className="status warn">{reach.error}</p>
  return (
    <>
      <table className="results">
        <thead>
          <tr>
            <th>Walk</th>
            <th>Buildings</th>
            <th>Residents</th>
          </tr>
        </thead>
        <tbody>
          {reach.levels.map((l, i) => (
            <tr key={l.minutes}>
              <td>
                <span className="swatch" style={{ background: REACH_COLORS[i] }} />
                {l.minutes} min
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
      <p className="small">The walk starts {Math.round(reach.start.dist)} m from your click.</p>
    </>
  )
}

function Legend({ look2077, mode }) {
  const densityEffect = mode === 'density'
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
      <h2>Reached on foot</h2>
      <ul>
        {['5 minutes', '10 minutes', '15 minutes'].map((label, i) => (
          <li key={label}>
            <span className="swatch" style={{ background: REACH_COLORS[i] }} />
            {label}
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
      {mode === 'transport' && (
        <>
          <h2>Imagined maglev lines from Goetheplatz</h2>
          <ul className="single">
            {['North · Hauptbahnhof', 'South · Bauhaus-Universität', 'East · City Palace', 'West'].map((name, i) => (
              <li key={name}>
                <span className="swatch line" style={{ background: LINE_COLORS[i] }} />
                {name}
              </li>
            ))}
          </ul>
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
