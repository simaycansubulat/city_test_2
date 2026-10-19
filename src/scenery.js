// Data for the Weimar 2077 scenery only. Nothing here feeds the walks, the building counts or the
// resident estimates in reach.js; it only decides where things are drawn and how bright.
//
// From the kit:
//   land use plots     -> green areas (recreation, cemetery), water, public squares
//   building footprints -> building density on a 50 m grid
//   Zensus 2022 cells   -> residents per 100 m cell, shown as signal specks (cells without a figure stay empty)
//   street graph        -> street lamps and smart intersections

import { ringArea } from './geo.js'

export const DENSITY_CELL_M = 50
export const DENSITY_FULL = 0.55 // a square counts as fully dense from this share of built footprint upwards
export const RESIDENTS_PER_SPECK = 2

const GREEN_USES = new Set(['recreation', 'cemetery'])
const WATER_USES = new Set(['flowing water', 'standing water'])

// A tiny seeded random, so the scenery is the same every time the page opens
export function makeRandom(seed) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function pointInRing([px, py], ring) {
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

// A raster of 10 m squares that answers "is this point in a green area?" quickly
function makeRaster(extent, polygons, step = 10) {
  const { x0, y0, x1, y1 } = extent
  const nx = Math.ceil((x1 - x0) / step)
  const ny = Math.ceil((y1 - y0) / step)
  const cells = new Uint8Array(nx * ny)
  for (const poly of polygons) {
    const b = poly.bbox
    for (let j = Math.max(0, Math.floor((b.y0 - y0) / step)); j <= Math.min(ny - 1, Math.floor((b.y1 - y0) / step)); j++) {
      for (let i = Math.max(0, Math.floor((b.x0 - x0) / step)); i <= Math.min(nx - 1, Math.floor((b.x1 - x0) / step)); i++) {
        if (pointInPolygon([x0 + (i + 0.5) * step, y0 + (j + 0.5) * step], poly.rings)) cells[j * nx + i] = 1
      }
    }
  }
  const at = (x, y) => {
    const i = Math.floor((x - x0) / step)
    const j = Math.floor((y - y0) / step)
    return i >= 0 && j >= 0 && i < nx && j < ny && cells[j * nx + i] === 1
  }
  return { at, cells, nx, ny, step }
}

export function prepareScenery(city, { plots, zensus }) {
  const { project, extent } = city

  // Land use: green areas, water, squares
  const toPoly = (f) => {
    const rings = f.geometry.coordinates.map((r) => r.map(project))
    return { landuse: f.properties.landuse, rings, bbox: bboxOf(rings[0]), area: Math.abs(ringArea(rings[0])) }
  }
  const polys = plots.features.filter((f) => f.geometry?.type === 'Polygon').map(toPoly)
  const green = polys.filter((p) => GREEN_USES.has(p.landuse))
  const water = polys.filter((p) => WATER_USES.has(p.landuse))
  const squares = polys.filter((p) => p.landuse === 'square')
  const greenRaster = makeRaster(extent, green)
  const isGreen = greenRaster.at

  // Building density on a 50 m grid, and the share of each square that is green
  const CELL = DENSITY_CELL_M
  const nx = Math.ceil((extent.x1 - extent.x0) / CELL)
  const ny = Math.ceil((extent.y1 - extent.y0) / CELL)
  const cover = new Float32Array(nx * ny)
  const heightSum = new Float32Array(nx * ny)
  const count = new Float32Array(nx * ny)
  const cellOf = (x, y) => {
    const i = Math.floor((x - extent.x0) / CELL)
    const j = Math.floor((y - extent.y0) / CELL)
    return i < 0 || j < 0 || i >= nx || j >= ny ? -1 : j * nx + i
  }
  const roofs = city.buildings.map((b) => {
    const ring = b.rings[0]
    let x = 0
    let y = 0
    for (const p of ring) {
      x += p[0]
      y += p[1]
    }
    const r = { x: x / ring.length, y: y / ring.length, h: b.height, area: Math.abs(ringArea(ring)), use: b.use }
    const k = cellOf(r.x, r.y)
    if (k >= 0) {
      cover[k] += r.area
      heightSum[k] += r.h
      count[k]++
    }
    return r
  })
  const density = new Float32Array(nx * ny)
  const greenShare = new Float32Array(nx * ny)
  const r = greenRaster
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i
      density[k] = Math.min(1, cover[k] / (CELL * CELL) / DENSITY_FULL)
      let g = 0
      let n = 0
      for (let jj = 0; jj < CELL / r.step; jj++) {
        for (let ii = 0; ii < CELL / r.step; ii++) {
          const ri = i * (CELL / r.step) + ii
          const rj = j * (CELL / r.step) + jj
          if (ri < r.nx && rj < r.ny) {
            g += r.cells[rj * r.nx + ri]
            n++
          }
        }
      }
      greenShare[k] = n ? g / n : 0
    }
  }
  const densityAt = (x, y) => {
    const k = cellOf(x, y)
    return k < 0 ? 0 : density[k]
  }
  const cells = []
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i
      cells.push({
        x: extent.x0 + (i + 0.5) * CELL,
        y: extent.y0 + (j + 0.5) * CELL,
        density: density[k],
        green: greenShare[k],
        meanHeight: count[k] ? heightSum[k] / count[k] : 0,
      })
    }
  }
  roofs.forEach((rf) => (rf.density = densityAt(rf.x, rf.y)))

  // Residents: one signal speck per RESIDENTS_PER_SPECK residents of each census cell, floating above
  // the buildings of that cell (residential ones where the cell has them), because people live in
  // buildings. How many specks a cell gets is the census figure; which building and where exactly is
  // made up. Cells whose buildings all lie outside the kit show none.
  const random = makeRandom(2022)
  const specks = []
  let speckCells = 0
  let nullCells = 0
  for (const f of zensus.features) {
    const pop = f.properties.population
    if (pop === null || pop === undefined) {
      nullCells++
      continue
    }
    const ring = f.geometry.coordinates[0].map(project)
    const b = bboxOf(ring)
    const inCell = roofs.filter((rf) => rf.x >= b.x0 && rf.x <= b.x1 && rf.y >= b.y0 && rf.y <= b.y1 && pointInRing([rf.x, rf.y], ring))
    const homes = inCell.filter((rf) => rf.use === 'residential')
    const hosts = homes.length ? homes : inCell
    const n = Math.round(pop / RESIDENTS_PER_SPECK)
    if (!hosts.length || n === 0) continue
    speckCells++
    for (let k = 0; k < n; k++) {
      const host = hosts[Math.floor(random() * hosts.length)]
      const spread = Math.min(12, Math.sqrt(host.area) / 2)
      const x = host.x + (random() - 0.5) * 2 * spread
      const y = host.y + (random() - 0.5) * 2 * spread
      specks.push({ x, y, h: host.h + 2 + random() * (8 + 25 * host.density), seed: random(), density: host.density })
    }
  }

  // Street lamps every 28 m along the walkable streets, alternating sides; in green areas only every
  // 70 m, low and warm, along the existing paths
  const lamps = []
  for (const e of city.edges) {
    const [a, b] = [e.pts[0], e.pts[e.pts.length - 1]]
    const len = Math.hypot(b[0] - a[0], b[1] - a[1])
    if (len < 1) continue
    const ux = (b[0] - a[0]) / len
    const uy = (b[1] - a[1]) / len
    const midGreen = isGreen((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
    const spacing = midGreen ? 70 : 28
    for (let s = spacing / 2, side = 1; s < len; s += spacing, side = -side) {
      const x = a[0] + ux * s
      const y = a[1] + uy * s
      const g = isGreen(x, y)
      const off = g ? 2 : 7
      lamps.push({ x: x - uy * off * side, y: y + ux * off * side, green: g, density: densityAt(x, y) })
    }
  }

  // Smart intersections: street nodes where three or more ways meet, outside green areas
  const degree = new Uint16Array(city.nodes.length)
  for (const e of city.edges) {
    degree[e.u]++
    degree[e.v]++
  }
  const junctions = city.nodes
    .map((n, i) => ({ x: n.x, y: n.y, deg: degree[i], density: densityAt(n.x, n.y) }))
    .filter((n) => n.deg >= 3 && !isGreen(n.x, n.y))

  return {
    green,
    water,
    squares,
    isGreen,
    roofs,
    cells,
    densityAt,
    grid: { x0: extent.x0, y0: extent.y0, nx, ny, CELL, density, greenShare },
    specks,
    speckCells,
    nullCells,
    lamps,
    junctions,
  }
}
