import * as THREE from 'three'

// All buildings in one merged geometry. Each building knows its own vertex range, so it can be
// recoloured when a walk reaches it.
//
// Plain map: every footprint extruded straight up to its height, flat roof.
// Weimar 2077 (pitched: true): the same footprint and the same highest point, but buildings of
// historic size get an approximate pitched roof: the walls stop at the eave and the roof slopes
// inwards up to the measured height. The kit has no roof shapes, so this is an approximation;
// large blocks, courtyard buildings and awkward outlines keep a flat roof.
//
// Per vertex, for the facade shader:
//   facade = (distance along this wall, wall length, floor height, part: 0 wall, 1 flat roof, 2 roof slope)
//   bld    = (eave height, a random number for this building, building density around it)

const v3 = (x, y, h) => [x, h, -y]
const ROOF_SLOPE = 0.85 // horizontal inset per metre of roof height (about 50°)

function signedArea(ring) {
  let a = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1]
  return a / 2
}

function inside([px, py], ring) {
  let c = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) c = !c
  }
  return c
}

function cross(a, b, c, d) {
  const o = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0
}

// Move every corner of an anticlockwise ring inwards by d, along the bisector of its two walls
function insetRing(ring, d) {
  const n = ring.length
  const out = []
  for (let i = 0; i < n; i++) {
    const p = ring[(i - 1 + n) % n]
    const c = ring[i]
    const q = ring[(i + 1) % n]
    let e1x = c[0] - p[0]
    let e1y = c[1] - p[1]
    let e2x = q[0] - c[0]
    let e2y = q[1] - c[1]
    const l1 = Math.hypot(e1x, e1y) || 1
    const l2 = Math.hypot(e2x, e2y) || 1
    e1x /= l1
    e1y /= l1
    e2x /= l2
    e2y /= l2
    let mx = -e1y - e2y
    let my = e1x + e2x
    const ml = Math.hypot(mx, my)
    if (ml < 1e-6) {
      mx = -e1y
      my = e1x
    } else {
      mx /= ml
      my /= ml
    }
    const cos = Math.max(0.35, mx * -e1y + my * e1x)
    out.push([c[0] + (mx * d) / cos, c[1] + (my * d) / cos])
  }
  return out
}

function validInset(inset, ring) {
  const a = signedArea(inset)
  if (a <= 0 || a < 0.08 * signedArea(ring)) return false
  if (!inset.every((p) => inside(p, ring))) return false
  const n = inset.length
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue
      if (cross(inset[i], inset[(i + 1) % n], inset[j], inset[(j + 1) % n])) return false
    }
  }
  return true
}

export function buildBuildingGeometry(buildings, { pitched = false, colorOf, densityAt = () => 0 }) {
  const pos = []
  const facade = []
  const bld = []
  const baseColors = []
  const ranges = []
  const roofLines = [] // eave, ridge and hip lines of every roof, for the Architecture mode
  const color = new THREE.Color()
  let seed = 1

  for (const b of buildings) {
    const start = pos.length / 3
    const h = Math.max(b.height, 0.5)
    const rings = b.rings.map((r) => {
      const pts = r.map(([x, y]) => [x, y])
      const f = pts[0]
      const l = pts[pts.length - 1]
      if (pts.length > 1 && f[0] === l[0] && f[1] === l[1]) pts.pop()
      return pts
    })
    const outer = rings[0]
    const holes = rings.slice(1)
    // Outline anticlockwise, courtyards clockwise
    if (signedArea(outer) < 0) outer.reverse()
    for (const hole of holes) if (signedArea(hole) > 0) hole.reverse()

    // Roof: flat at the full height, or an approximate pitched roof up to it
    let eave = h
    let top = null
    const area = signedArea(outer)
    if (pitched && holes.length === 0 && h >= 5 && area <= 2000 && outer.length <= 48) {
      const depth = Math.min(6.5, Math.max(2, h * 0.3))
      for (const f of [1, 0.6, 0.35]) {
        const inset = insetRing(outer, depth * f * ROOF_SLOPE)
        if (validInset(inset, outer) && h - depth * f >= 2.5) {
          top = inset
          eave = h - depth * f
          break
        }
      }
    }

    const nFloors = Math.max(1, Math.min(b.floors > 0 ? b.floors : 99, Math.round(eave / 3)))
    const floorH = eave / nFloors
    seed = (seed * 16807) % 2147483647
    const rnd = seed / 2147483647

    const triangulate = (contour, hs, z, part) => {
      const all = [contour, ...hs].flat()
      const faces = THREE.ShapeUtils.triangulateShape(
        contour.map(([x, y]) => new THREE.Vector2(x, y)),
        hs.map((hole) => hole.map(([x, y]) => new THREE.Vector2(x, y))),
      )
      for (const tri of faces) {
        for (const k of tri) {
          pos.push(...v3(all[k][0], all[k][1], z))
          facade.push(0, 0, floorH, part)
        }
      }
    }

    if (top) {
      // roof slopes from the eave line up to the inset ridge outline
      for (let i = 0; i < outer.length; i++) {
        const j = (i + 1) % outer.length
        roofLines.push(
          ...v3(outer[i][0], outer[i][1], eave), ...v3(outer[j][0], outer[j][1], eave),
          ...v3(top[i][0], top[i][1], h), ...v3(top[j][0], top[j][1], h),
          ...v3(outer[i][0], outer[i][1], eave), ...v3(top[i][0], top[i][1], h),
        )
        const P = v3(outer[i][0], outer[i][1], eave)
        const Q = v3(outer[j][0], outer[j][1], eave)
        const I = v3(top[i][0], top[i][1], h)
        const J = v3(top[j][0], top[j][1], h)
        pos.push(...P, ...Q, ...J, ...P, ...J, ...I)
        for (let k = 0; k < 6; k++) facade.push(0, 0, floorH, 2)
      }
      triangulate(top, [], h, 1)
    } else {
      triangulate(outer, holes, h, 1)
      for (let i = 0; i < outer.length; i++) {
        const j = (i + 1) % outer.length
        roofLines.push(...v3(outer[i][0], outer[i][1], h), ...v3(outer[j][0], outer[j][1], h))
      }
    }

    // Walls up to the eave, facing outwards (and into courtyards)
    for (const ring of [outer, ...holes]) {
      for (let i = 0; i < ring.length; i++) {
        const p = ring[i]
        const q = ring[(i + 1) % ring.length]
        const L = Math.hypot(q[0] - p[0], q[1] - p[1])
        const A = v3(p[0], p[1], 0)
        const B = v3(q[0], q[1], 0)
        const C = v3(q[0], q[1], eave)
        const D = v3(p[0], p[1], eave)
        pos.push(...A, ...B, ...C, ...A, ...C, ...D)
        facade.push(0, L, floorH, 0, L, L, floorH, 0, L, L, floorH, 0, 0, L, floorH, 0, L, L, floorH, 0, 0, L, floorH, 0)
      }
    }

    const count = pos.length / 3 - start
    ranges.push([start, count])
    color.set(colorOf(b))
    const d = densityAt(outer[0][0], outer[0][1])
    for (let k = 0; k < count; k++) {
      baseColors.push(color.r, color.g, color.b)
      bld.push(eave, rnd, d)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(baseColors), 3))
  geometry.setAttribute('facade', new THREE.Float32BufferAttribute(facade, 4))
  geometry.setAttribute('bld', new THREE.Float32BufferAttribute(bld, 3))
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return { geometry, ranges, baseColors: new Float32Array(baseColors), roofLines: new Float32Array(roofLines) }
}
