import ClipperLib from 'clipper-lib'
import { makeProjection, ringArea } from './geo.js'

// The method, in one place. The panel and the README quote these numbers.
export const SPEED_M_PER_MIN = 80 // 4.8 km/h
export const MINUTES = [5, 10, 15]

// Weimar 2077: you don't walk, you ride supersonic pods through tubes above the same street network.
// Mach 1.5 is about 515 m per second; the three areas are what you reach in 1, 2 and 3 seconds.
// Imagined, like the rest of 2077: the street network and the counts are real, the speed is not.
export const SUPERSONIC_M_PER_S = 515
export const SECONDS = [1, 2, 3]

// The two ways of travelling. Each level has a time, its unit and the metres it allows.
export const TRAVEL = {
  walk: { id: 'walk', unit: 'min', levels: MINUTES.map((t) => ({ time: t, budget: t * SPEED_M_PER_MIN })) },
  supersonic: { id: 'supersonic', unit: 's', levels: SECONDS.map((t) => ({ time: t, budget: t * SUPERSONIC_M_PER_S })) },
}
export const BAND_M = 25 // band on each side of a reached street segment
export const MAX_SNAP_M = 100 // farthest a click may be from a walkable node

const SCALE = 100 // Clipper works in whole numbers: we use centimetres
const ARC_TOLERANCE_M = 0.25 // how closely the round ends follow a true circle, in metres

// ---------------------------------------------------------------------------
// Preparing the data: everything in metres, once, after loading.

export function prepareCity({ kit, buildings, graph, zensus }) {
  const project = makeProjection(kit.center)

  const nodes = graph.nodes.map((n) => {
    const [x, y] = project([n.lon, n.lat])
    return { id: n.id, x, y }
  })
  const nodeIndex = new Map(nodes.map((n, i) => [n.id, i]))

  const edges = []
  const adjacency = nodes.map(() => [])
  for (const e of graph.edges) {
    if (!e.walkable) continue
    const u = nodeIndex.get(e.from)
    const v = nodeIndex.get(e.to)
    if (u === undefined || v === undefined) continue
    const k = edges.length
    edges.push({ u, v, length: e.length, pts: e.coords.map(project) })
    adjacency[u].push(k)
    adjacency[v].push(k)
  }
  // Only nodes on at least one walkable edge can be a start
  const walkableNodes = nodes.map((_, i) => i).filter((i) => adjacency[i].length > 0)

  const blds = buildings.features.map((f) => {
    const rings = f.geometry.coordinates.map((ring) => ring.map(project))
    return {
      id: f.properties.id,
      height: f.properties.height,
      floors: f.properties.floors,
      use: f.properties.use ?? 'undefined',
      rings,
      bbox: bboxOf(rings[0]),
    }
  })

  const cells = zensus.features.map((f) => {
    const ring = f.geometry.coordinates[0].map(project)
    return {
      id: f.properties.id,
      population: f.properties.population, // may be null: no published figure
      ring,
      area: Math.abs(ringArea(ring)),
      bbox: bboxOf(ring),
      path: toClipperPath(ring),
    }
  })

  const [w, s, e, n] = kit.bbox
  const [x0, y0] = project([w, s])
  const [x1, y1] = project([e, n])

  return { project, nodes, edges, adjacency, walkableNodes, buildings: blds, cells, extent: { x0, y0, x1, y1 } }
}

// ---------------------------------------------------------------------------
// The reach from one clicked point [x, y] in metres.

export function computeReach(city, point, travel = TRAVEL.walk) {
  const start = nearestNode(city, point)
  if (!start || start.dist > MAX_SNAP_M) {
    return { error: `No walkable street within ${MAX_SNAP_M} m of this point.`, point }
  }

  const dist = shortestDistances(city, start.index)

  // Work from the largest area down: smaller areas only need the buildings and cells the larger one found
  const levels = []
  let buildingCandidates = city.buildings.map((_, i) => i)
  let cellCandidates = city.cells.map((_, i) => i)
  for (const { time, budget } of [...travel.levels].reverse()) {
    const pieces = reachedPieces(city, dist, budget)
    const polygons = bandPolygons(pieces)
    const grid = segmentGrid(pieces)
    const buildingsHit = buildingsTouching(city, grid, buildingCandidates)
    const residents = countResidents(city, grid, cellCandidates)
    levels.unshift({ time, unit: travel.unit, budget, polygons, buildings: buildingsHit, ...residents })
    buildingCandidates = buildingsHit
    cellCandidates = residents.cellsHit
  }

  const node = city.nodes[start.index]
  return { point, travel: travel.id, start: { x: node.x, y: node.y, dist: start.dist }, levels }
}

function nearestNode(city, [px, py]) {
  let best = null
  for (const i of city.walkableNodes) {
    const n = city.nodes[i]
    const d = Math.hypot(n.x - px, n.y - py)
    if (!best || d < best.dist) best = { index: i, dist: d }
  }
  return best
}

// Dijkstra along walkable edges, using their length in metres; edges go both ways
function shortestDistances(city, source) {
  const dist = new Float64Array(city.nodes.length).fill(Infinity)
  dist[source] = 0
  const heap = new MinHeap()
  heap.push(0, source)
  while (heap.size) {
    const [d, u] = heap.pop()
    if (d > dist[u]) continue
    for (const k of city.adjacency[u]) {
      const e = city.edges[k]
      const v = e.u === u ? e.v : e.u
      const nd = d + e.length
      if (nd < dist[v]) {
        dist[v] = nd
        heap.push(nd, v)
      }
    }
  }
  return dist
}

// The street lines walked within the budget, including the reachable part of the last segments
function reachedPieces(city, dist, budget) {
  const pieces = []
  for (const e of city.edges) {
    const fromU = budget - dist[e.u] // metres left when standing at one end
    const fromV = budget - dist[e.v] // ...and at the other
    if (fromU <= 0 && fromV <= 0) continue
    if (fromU >= e.length || fromV >= e.length || Math.max(fromU, 0) + Math.max(fromV, 0) >= e.length) {
      pieces.push(e.pts)
      continue
    }
    if (fromU > 0) pieces.push(cutLine(e.pts, 0, fromU / e.length))
    if (fromV > 0) pieces.push(cutLine(e.pts, 1 - fromV / e.length, 1))
  }
  return pieces
}

// Part of a polyline between two fractions of its length
function cutLine(pts, t0, t1) {
  const seg = []
  let total = 0
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
    seg.push(l)
    total += l
  }
  const a = t0 * total
  const b = t1 * total
  const out = []
  let run = 0
  for (let i = 0; i < seg.length; i++) {
    const s0 = run
    const s1 = run + seg[i]
    const lerp = (s) => {
      const t = seg[i] === 0 ? 0 : (s - s0) / seg[i]
      return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t]
    }
    if (s1 >= a && s0 <= b) {
      if (!out.length) out.push(lerp(Math.max(a, s0)))
      out.push(lerp(Math.min(b, s1)))
    }
    run = s1
  }
  return out
}

// A band of BAND_M on each side of every piece, with round ends, all joined into one shape
function bandTree(pieces) {
  const offset = new ClipperLib.ClipperOffset(2, ARC_TOLERANCE_M * SCALE)
  for (const p of pieces) {
    offset.AddPath(toClipperPath(p), ClipperLib.JoinType.jtRound, ClipperLib.EndType.etOpenRound)
  }
  const tree = new ClipperLib.PolyTree()
  offset.Execute(tree, BAND_M * SCALE)
  return tree
}

// The joined band as polygons with their holes, back in metres, for drawing
function bandPolygons(pieces) {
  const polygons = []
  const walk = (node) => {
    for (const outer of node.Childs()) {
      polygons.push({
        outer: fromClipperPath(outer.Contour()),
        holes: outer.Childs().map((h) => fromClipperPath(h.Contour())),
      })
      for (const hole of outer.Childs()) walk(hole)
    }
  }
  walk(bandTree(pieces))
  return polygons
}

// All reached street segments in a bucket grid, to find the ones near a building or cell
function segmentGrid(pieces) {
  const grid = new SegmentGrid(50)
  for (const p of pieces) {
    for (let i = 1; i < p.length; i++) grid.add(p[i - 1], p[i])
    if (p.length === 1) grid.add(p[0], p[0])
  }
  return grid
}

// A building touches the area when some part of it lies within BAND_M of a reached piece.
// That is exactly "the footprint overlaps the band", tested without cutting polygons.
function buildingsTouching(city, grid, candidates) {
  const hit = []
  for (const i of candidates) {
    const b = city.buildings[i]
    const segs = grid.near(b.bbox, BAND_M)
    if (segs.some(([a, c]) => polygonSegmentDistance(b.rings, a, c) <= BAND_M)) hit.push(i)
  }
  return hit
}

// Residents: each cell's population times the share of its area inside the band.
// The band is a union, so inside one cell it depends only on the street segments near that cell:
// rebuilding it from those alone gives the same shape there, and is much faster.
function countResidents(city, grid, candidates) {
  let sum = 0
  let nullCells = 0
  const cellsHit = []
  for (const i of candidates) {
    const cell = city.cells[i]
    const near = grid.near(cell.bbox, BAND_M)
    if (!near.length) continue
    const localBand = ClipperLib.Clipper.PolyTreeToPaths(bandTree(near))
    const clipper = new ClipperLib.Clipper()
    clipper.AddPath(cell.path, ClipperLib.PolyType.ptSubject, true)
    clipper.AddPaths(localBand, ClipperLib.PolyType.ptClip, true)
    const inter = new ClipperLib.Paths()
    clipper.Execute(ClipperLib.ClipType.ctIntersection, inter, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero)
    let a = 0
    for (const p of inter) a += ClipperLib.Clipper.Area(p)
    const inside = Math.abs(a) / (SCALE * SCALE)
    if (inside <= 0.01) continue
    cellsHit.push(i)
    if (cell.population === null || cell.population === undefined) nullCells++
    else sum += cell.population * Math.min(1, inside / cell.area)
  }
  return { residents: Math.round(sum / 10) * 10, nullCells, cellsHit }
}

// ---------------------------------------------------------------------------
// Small geometry helpers

function toClipperPath(pts) {
  return pts.map(([x, y]) => ({ X: Math.round(x * SCALE), Y: Math.round(y * SCALE) }))
}

function fromClipperPath(path) {
  return path.map((p) => [p.X / SCALE, p.Y / SCALE])
}

function bboxOf(ring) {
  const b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }
  for (const [x, y] of ring) {
    b.x0 = Math.min(b.x0, x)
    b.y0 = Math.min(b.y0, y)
    b.x1 = Math.max(b.x1, x)
    b.y1 = Math.max(b.y1, y)
  }
  return b
}

function pointSegmentDistance([px, py], [ax, ay], [bx, by]) {
  const dx = bx - ax
  const dy = by - ay
  const l2 = dx * dx + dy * dy
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

function segmentsCross(a, b, c, d) {
  const cross = (o, p, q) => (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0])
  const d1 = cross(c, d, a)
  const d2 = cross(c, d, b)
  const d3 = cross(a, b, c)
  const d4 = cross(a, b, d)
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
}

function pointInRing([px, py], ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

function pointInPolygon(p, rings) {
  if (!pointInRing(p, rings[0])) return false
  for (let h = 1; h < rings.length; h++) if (pointInRing(p, rings[h])) return false
  return true
}

// Shortest distance between a footprint (with holes) and a line segment
function polygonSegmentDistance(rings, a, b) {
  if (pointInPolygon(a, rings)) return 0
  let best = Infinity
  for (const ring of rings) {
    for (let i = 1; i < ring.length; i++) {
      const p = ring[i - 1]
      const q = ring[i]
      if (segmentsCross(p, q, a, b)) return 0
      best = Math.min(best, pointSegmentDistance(p, a, b), pointSegmentDistance(a, p, q), pointSegmentDistance(b, p, q))
    }
  }
  return best
}

// A bucket grid, so each building only looks at the street pieces near it
class SegmentGrid {
  constructor(size) {
    this.size = size
    this.cells = new Map()
  }
  key(i, j) {
    return i * 100003 + j
  }
  add(a, b) {
    const s = this.size
    const i0 = Math.floor(Math.min(a[0], b[0]) / s)
    const i1 = Math.floor(Math.max(a[0], b[0]) / s)
    const j0 = Math.floor(Math.min(a[1], b[1]) / s)
    const j1 = Math.floor(Math.max(a[1], b[1]) / s)
    const seg = [a, b]
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        const k = this.key(i, j)
        if (!this.cells.has(k)) this.cells.set(k, [])
        this.cells.get(k).push(seg)
      }
    }
  }
  near(box, margin) {
    const s = this.size
    const out = new Set()
    for (let i = Math.floor((box.x0 - margin) / s); i <= Math.floor((box.x1 + margin) / s); i++) {
      for (let j = Math.floor((box.y0 - margin) / s); j <= Math.floor((box.y1 + margin) / s); j++) {
        const list = this.cells.get(this.key(i, j))
        if (list) for (const seg of list) out.add(seg)
      }
    }
    return [...out]
  }
}

class MinHeap {
  constructor() {
    this.items = []
  }
  get size() {
    return this.items.length
  }
  push(priority, value) {
    const a = this.items
    a.push([priority, value])
    let i = a.length - 1
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (a[parent][0] <= a[i][0]) break
      ;[a[parent], a[i]] = [a[i], a[parent]]
      i = parent
    }
  }
  pop() {
    const a = this.items
    const top = a[0]
    const last = a.pop()
    if (a.length) {
      a[0] = last
      let i = 0
      for (;;) {
        const l = 2 * i + 1
        const r = l + 1
        let m = i
        if (l < a.length && a[l][0] < a[m][0]) m = l
        if (r < a.length && a[r][0] < a[m][0]) m = r
        if (m === i) break
        ;[a[m], a[i]] = [a[i], a[m]]
        i = m
      }
    }
    return top
  }
}
