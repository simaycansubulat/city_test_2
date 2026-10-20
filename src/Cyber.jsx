// Weimar 2077: the imagined night layer over the real city. Nothing here takes clicks, and nothing
// here changes the buildings, the walks or the resident counts. Facades: facade.js. Land: Landscape.jsx.
//
// The look:   street lamps and smart intersections along the real street network, spotlights on the
//             buildings whose main use is culture or civic, data links between roofs, flight lanes that
//             follow real streets with craft flying both ways, and turning Bauhaus shapes over the
//             culture buildings.
// Density:    its own switch. Building density (share of each 50 m square covered by footprints) drives
//             the chaos: the neon density map, data streams, layered links, glitches and interference.
//             Residents per census cell (Zensus 2022) drive the signal specks: one speck for every
//             2 residents. Green areas stay free of all of it.

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { DENSITY_CELL_M, DENSITY_FULL, RESIDENTS_PER_SPECK, makeRandom } from './scenery.js'
import { shortestPath, simplify } from './paths.js'

export { DENSITY_CELL_M, DENSITY_FULL, RESIDENTS_PER_SPECK }
export const CYBER_COLORS = { holo: '#00e5ff', link: '#00cfff', lane: '#fcee0a', noise: '#00f0ff', lamp: '#ffd9a0' }
// Low to high building density
export const DENSITY_RAMP = ['#2440ff', '#00e5ff', '#fcee0a']

const OVERLAY = 10 // draw the imagined layers after the ground, the areas and the streets
const v3 = (x, y, h) => new THREE.Vector3(x, h, -y)

// Free the graphics memory of objects made here when they are replaced or the layer is switched off
function useDispose(...objects) {
  useEffect(() => () => objects.forEach((o) => o?.dispose()), objects) // eslint-disable-line react-hooks/exhaustive-deps
}

function useTime(material) {
  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.elapsedTime
  })
}

// Lines with light pulses running along them. Each vertex knows how far along its line it is.
function makeFlowMaterial({ color, base = 0.18, pulse = 0.85, freq = 2, speed = 0.25, width = 0.12, additive = true }) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uBase: { value: base },
      uPulse: { value: pulse },
      uFreq: { value: freq },
      uSpeed: { value: speed },
      uWidth: { value: width },
    },
    vertexShader: /* glsl */ `
      attribute float along;
      attribute float seed;
      varying float vAlong;
      varying float vSeed;
      void main() {
        vAlong = along;
        vSeed = seed;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uBase, uPulse, uFreq, uSpeed, uWidth;
      uniform vec3 uColor;
      varying float vAlong;
      varying float vSeed;
      void main() {
        float p = fract(vAlong * uFreq - uTime * uSpeed * (0.7 + 0.6 * vSeed) + vSeed);
        float glow = smoothstep(uWidth, 0.0, p);
        gl_FragColor = vec4(uColor * (1.0 + glow), uBase + uPulse * glow);
            gl_FragColor.rgb = pow(max(gl_FragColor.rgb, 0.0), vec3(2.2));
            #include <colorspace_fragment>
      }`,
  })
}

function lineGeometry(polylines, random) {
  const pos = []
  const along = []
  const seed = []
  for (const pts of polylines) {
    const s = random()
    const n = pts.length - 1
    for (let i = 1; i < pts.length; i++) {
      pos.push(pts[i - 1].x, pts[i - 1].y, pts[i - 1].z, pts[i].x, pts[i].y, pts[i].z)
      along.push((i - 1) / n, i / n)
      seed.push(s, s)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('along', new THREE.Float32BufferAttribute(along, 1))
  g.setAttribute('seed', new THREE.Float32BufferAttribute(seed, 1))
  return g
}

// Arcs between roofs
function arcs(pairs, lift, random) {
  return pairs.map(([a, b]) => {
    const pa = v3(a.x, a.y, a.h + 1)
    const pb = v3(b.x, b.y, b.h + 1)
    const mid = pa.clone().add(pb).multiplyScalar(0.5)
    mid.y += pa.distanceTo(pb) * lift * (0.7 + 0.6 * random())
    return new THREE.QuadraticBezierCurve3(pa, mid, pb).getPoints(16)
  })
}

function nearestPairs(points, kOf, maxDist) {
  const pairs = []
  const seen = new Set()
  points.forEach((a, i) => {
    const k = kOf(a)
    if (!k) return
    const near = points
      .map((b, j) => ({ j, d: Math.hypot(a.x - b.x, a.y - b.y) }))
      .filter((n) => n.j !== i && n.d <= maxDist)
      .sort((p, q) => p.d - q.d)
      .slice(0, k)
    for (const { j } of near) {
      const key = i < j ? `${i}-${j}` : `${j}-${i}`
      if (seen.has(key)) continue
      seen.add(key)
      pairs.push([a, points[j]])
    }
  })
  return pairs
}

// The tallest roof in each square of the given size, outside green areas
function hubsOf(scenery, size, minHeight) {
  const best = new Map()
  scenery.roofs.forEach((r) => {
    if (r.h < minHeight || scenery.isGreen(r.x, r.y)) return
    const key = `${Math.floor(r.x / size)},${Math.floor(r.y / size)}`
    const cur = best.get(key)
    if (!cur || cur.h < r.h) best.set(key, r)
  })
  return [...best.values()]
}

// ---------------------------------------------------------------------------
// The look (night only)

// mode: null (overview), 'density', 'transport', 'forest' or 'architecture'
export function CyberLook({ city, scenery, mode }) {
  const densityOn = mode === 'density'
  const show = {
    lattice: mode !== 'forest' && mode !== 'pollution',
    junctions: mode !== 'forest',
    spotlights: !mode || mode === 'architecture',
    links: !mode || mode === 'architecture',
    lanes: !mode || mode === 'transport',
    bauhaus: !mode || mode === 'architecture',
  }
  return (
    <group>
      {show.lattice && <SurveyLattice city={city} scenery={scenery} />}
      <StreetLamps scenery={scenery} densityOn={densityOn} />
      {show.junctions && <Junctions scenery={scenery} densityOn={densityOn} />}
      {show.spotlights && <Spotlights scenery={scenery} />}
      {show.links && <DataLinks scenery={scenery} />}
      {show.lanes && <FlightLanes city={city} />}
      {show.bauhaus && <BauhausHolograms scenery={scenery} />}
    </group>
  )
}

// Small crosses every 100 m on the ground, like a survey lattice; none in green areas
function SurveyLattice({ city, scenery }) {
  const geometry = useMemo(() => {
    const { x0, y0, x1, y1 } = city.extent
    const pos = []
    const s = 4
    for (let x = Math.ceil(x0 / 100) * 100; x <= x1; x += 100) {
      for (let y = Math.ceil(y0 / 100) * 100; y <= y1; y += 100) {
        if (scenery.isGreen(x, y)) continue
        pos.push(x - s, 0.25, -y, x + s, 0.25, -y, x, 0.25, -(y - s), x, 0.25, -(y + s))
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    return g
  }, [city, scenery])
  useDispose(geometry)
  return (
    <lineSegments geometry={geometry} renderOrder={OVERLAY}>
      <lineBasicMaterial color={CYBER_COLORS.holo} transparent opacity={0.35} depthWrite={false} blending={THREE.AdditiveBlending} />
    </lineSegments>
  )
}

// Street lamps: a slim pole, a glowing head and a pool of light on the ground. In green areas they are
// few, low and warm. With the density signal on, busy blocks burn brighter and quiet ones dim.
function StreetLamps({ scenery, densityOn }) {
  const { poles, heads, pools } = useMemo(() => {
    const n = scenery.lamps.length
    const poles = new THREE.InstancedMesh(new THREE.BoxGeometry(0.25, 1, 0.25), new THREE.MeshBasicMaterial({ color: '#2a2e3e' }), n)
    const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.75, 8, 6), new THREE.MeshBasicMaterial(), n)
    const pools = new THREE.InstancedMesh(
      new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.09, depthWrite: false, blending: THREE.AdditiveBlending }),
      n,
    )
    pools.renderOrder = OVERLAY
    const m = new THREE.Object3D()
    scenery.lamps.forEach((l, i) => {
      const h = l.green ? 3 : 6.5
      m.position.set(l.x, h / 2, -l.y)
      m.scale.set(1, h, 1)
      m.updateMatrix()
      poles.setMatrixAt(i, m.matrix)
      m.position.set(l.x, h, -l.y)
      m.scale.set(1, 1, 1)
      m.updateMatrix()
      heads.setMatrixAt(i, m.matrix)
      const r = l.green ? 3 : 6
      m.position.set(l.x, 0.3, -l.y)
      m.scale.set(r, 1, r)
      m.updateMatrix()
      pools.setMatrixAt(i, m.matrix)
    })
    return { poles, heads, pools }
  }, [scenery])

  // colours follow the density switch
  useEffect(() => {
    const warm = new THREE.Color(CYBER_COLORS.lamp)
    const cool = new THREE.Color('#9ff3ff')
    const c = new THREE.Color()
    scenery.lamps.forEach((l, i) => {
      const k = l.green ? 0.45 : densityOn ? 0.3 + 1.0 * l.density : 0.85
      c.copy(l.green || i % 3 ? warm : cool).multiplyScalar(k)
      heads.setColorAt(i, c)
      pools.setColorAt(i, c)
    })
    heads.instanceColor.needsUpdate = true
    pools.instanceColor.needsUpdate = true
  }, [scenery, densityOn, heads, pools])

  useEffect(
    () => () => {
      for (const mesh of [poles, heads, pools]) {
        mesh.geometry.dispose()
        mesh.material.dispose()
        mesh.dispose()
      }
    },
    [poles, heads, pools],
  )
  return (
    <group>
      <primitive object={poles} />
      <primitive object={heads} />
      <primitive object={pools} />
    </group>
  )
}

// Smart intersections: a lit ring where three or more ways meet
function Junctions({ scenery, densityOn }) {
  const rings = useMemo(() => {
    const mesh = new THREE.InstancedMesh(
      new THREE.RingGeometry(4.2, 5, 28).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }),
      scenery.junctions.length,
    )
    mesh.renderOrder = OVERLAY
    const m = new THREE.Object3D()
    scenery.junctions.forEach((j, i) => {
      m.position.set(j.x, 2.1, -j.y)
      const s = 0.8 + 0.15 * j.deg
      m.scale.set(s, 1, s)
      m.updateMatrix()
      mesh.setMatrixAt(i, m.matrix)
    })
    return mesh
  }, [scenery])
  useEffect(() => {
    const cyan = new THREE.Color(CYBER_COLORS.holo)
    const c = new THREE.Color()
    scenery.junctions.forEach((j, i) => rings.setColorAt(i, c.copy(cyan).multiplyScalar(densityOn ? 0.2 + 0.9 * j.density : 0.55)))
    rings.instanceColor.needsUpdate = true
  }, [scenery, densityOn, rings])
  useEffect(
    () => () => {
      rings.geometry.dispose()
      rings.material.dispose()
      rings.dispose()
    },
    [rings],
  )
  return <primitive object={rings} />
}

// Spotlights from the roofs of the larger buildings whose main use is culture or civic: the landmarks
// of the kit, slowly sweeping the night sky
function Spotlights({ scenery }) {
  const items = useMemo(
    () => scenery.roofs.filter((r) => (r.use === 'culture' || r.use === 'civic') && r.area > 350 && !scenery.isGreen(r.x, r.y)),
    [scenery],
  )
  const geometry = useMemo(() => new THREE.CylinderGeometry(7, 0.8, 160, 16, 1, true).translate(0, 80, 0), [])
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        uniforms: { uColor: { value: new THREE.Color('#bff6ff') } },
        vertexShader: /* glsl */ `
          varying float vH;
          void main() {
            vH = uv.y;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          varying float vH;
          void main() {
            gl_FragColor = vec4(uColor, 0.22 * pow(1.0 - vH, 1.6));
            gl_FragColor.rgb = pow(max(gl_FragColor.rgb, 0.0), vec3(2.2));
            #include <colorspace_fragment>
          }`,
      }),
    [],
  )
  useDispose(geometry, material)
  const group = useRef()
  useFrame((state) => {
    const t = state.clock.elapsedTime
    group.current.children.forEach((beam, i) => {
      beam.rotation.x = Math.sin(t * 0.21 + i * 1.7) * 0.32
      beam.rotation.z = Math.cos(t * 0.17 + i * 2.3) * 0.32
    })
  })
  return (
    <group ref={group}>
      {items.map((r, i) => (
        <mesh key={i} geometry={geometry} material={material} position={[r.x, r.h, -r.y]} renderOrder={OVERLAY} />
      ))}
    </group>
  )
}

// A calm network of data links between the tallest roofs in each 100 m square
function DataLinks({ scenery }) {
  const geometry = useMemo(() => {
    const hubs = hubsOf(scenery, 100, 10)
    return lineGeometry(arcs(nearestPairs(hubs, () => 2, 230), 0.22, makeRandom(7)), makeRandom(8))
  }, [scenery])
  const material = useMemo(() => makeFlowMaterial({ color: CYBER_COLORS.link, base: 0.22, pulse: 0.8, freq: 1, speed: 0.35, width: 0.18 }), [])
  useTime(material)
  useDispose(geometry, material)
  return <lineSegments geometry={geometry} material={material} renderOrder={OVERLAY} />
}

// Flight lanes: four routes along real shortest paths through the street network,
// lifted to different heights, with craft flying both ways
function FlightLanes({ city }) {
  const lanes = useMemo(() => {
    const n = city.walkableNodes.map((i) => city.nodes[i])
    const pick = (f) => n.reduce((best, p) => (f(p) > f(best) ? p : best))
    const ends = [
      [pick((p) => p.y), pick((p) => -p.y)],
      [pick((p) => p.x), pick((p) => -p.x)],
      [pick((p) => p.x + p.y), pick((p) => -p.x - p.y)],
      [pick((p) => p.x - p.y), pick((p) => p.y - p.x)],
    ]
    const index = new Map(city.nodes.map((p, i) => [p, i]))
    return ends.map(([a, b], k) => {
      const path = shortestPath(city, index.get(a), index.get(b))
      const simple = simplify(path.map((i) => [city.nodes[i].x, city.nodes[i].y]), 35)
      return new THREE.CatmullRomCurve3(simple.map(([x, y]) => v3(x, y, 70 + k * 18)), false, 'centripetal')
    })
  }, [city])

  const geometry = useMemo(() => lineGeometry(lanes.map((c) => c.getSpacedPoints(400)), makeRandom(3)), [lanes])
  // Dashed, drifting lane markings
  const material = useMemo(() => makeFlowMaterial({ color: CYBER_COLORS.lane, base: 0.08, pulse: 0.55, freq: 60, speed: 0.6, width: 0.45 }), [])
  useTime(material)
  useDispose(geometry, material)

  return (
    <group>
      <lineSegments geometry={geometry} material={material} renderOrder={OVERLAY} />
      <Craft lanes={lanes} />
    </group>
  )
}

const CRAFT_PER_LANE = 10

function Craft({ lanes }) {
  const bodies = useRef()
  const trails = useRef()
  const plan = useMemo(() => {
    const random = makeRandom(2077)
    const list = []
    lanes.forEach((curve) => {
      const length = curve.getLength()
      for (let i = 0; i < CRAFT_PER_LANE; i++) {
        list.push({ curve, length, start: random(), speed: 16 + random() * 12, dir: i % 2 ? 1 : -1, offset: (i % 2 ? 1 : -1) * 3 })
      }
    })
    return list
  }, [lanes])

  const dummy = useMemo(() => new THREE.Object3D(), [])
  const ahead = useMemo(() => new THREE.Vector3(), [])
  const side = useMemo(() => new THREE.Vector3(), [])
  useFrame((state) => {
    const t = state.clock.elapsedTime
    plan.forEach((c, i) => {
      let u = (c.start + (c.dir * c.speed * t) / c.length) % 1
      if (u < 0) u += 1
      const p = c.curve.getPointAt(u)
      const tangent = c.curve.getTangentAt(u).multiplyScalar(c.dir)
      side.set(-tangent.z, 0, tangent.x).normalize().multiplyScalar(c.offset) // keep to one side of the lane
      p.add(side)
      ahead.copy(p).add(tangent)
      dummy.position.copy(p)
      dummy.lookAt(ahead)
      dummy.updateMatrix()
      bodies.current.setMatrixAt(i, dummy.matrix)
      dummy.translateZ(-12) // a light trail behind
      dummy.updateMatrix()
      trails.current.setMatrixAt(i, dummy.matrix)
    })
    bodies.current.instanceMatrix.needsUpdate = true
    trails.current.instanceMatrix.needsUpdate = true
  })

  return (
    <group>
      <instancedMesh ref={bodies} args={[null, null, plan.length]} frustumCulled={false}>
        <boxGeometry args={[3.2, 1.6, 8]} />
        <meshBasicMaterial color="#e9f2ff" />
      </instancedMesh>
      <instancedMesh ref={trails} args={[null, null, plan.length]} frustumCulled={false} renderOrder={OVERLAY}>
        <boxGeometry args={[1, 0.8, 16]} />
        <meshBasicMaterial color="#ff2a55" transparent opacity={0.7} depthWrite={false} blending={THREE.AdditiveBlending} />
      </instancedMesh>
    </group>
  )
}

// The Bauhaus was founded in Weimar in 1919: circle, square and triangle hover, slowly turning,
// over every building whose main use is culture
function BauhausHolograms({ scenery }) {
  const items = useMemo(
    () =>
      scenery.roofs
        .filter((r) => r.use === 'culture')
        .map((r, i) => ({ ...r, kind: i % 3, size: Math.max(10, Math.min(28, Math.sqrt(r.area) * 0.6)) })),
    [scenery],
  )
  const shapes = useMemo(() => {
    const ring = (outer, inner) => {
      const s = new THREE.Shape(outer)
      s.holes = [new THREE.Path(inner)]
      return new THREE.ShapeGeometry(s, 48)
    }
    const poly = (n, r, rot) => Array.from({ length: n }, (_, k) => new THREE.Vector2(Math.cos(rot + (k * 2 * Math.PI) / n) * r, Math.sin(rot + (k * 2 * Math.PI) / n) * r))
    return [
      new THREE.RingGeometry(0.86, 1, 64),
      ring(poly(4, 1, Math.PI / 4), poly(4, 0.84, Math.PI / 4).reverse()),
      ring(poly(3, 1, Math.PI / 2), poly(3, 0.78, Math.PI / 2).reverse()),
    ]
  }, [])
  useDispose(...shapes)
  const tint = [CYBER_COLORS.holo, CYBER_COLORS.holo, CYBER_COLORS.lane]
  const group = useRef()
  useFrame((state) => {
    const t = state.clock.elapsedTime
    group.current.children.forEach((g, i) => {
      g.children[0].rotation.y = t * 0.3 + i
      g.children[0].position.y = Math.sin(t * 0.8 + i) * 1.5
    })
  })
  return (
    <group ref={group}>
      {items.map((it, i) => (
        <group key={i} position={[it.x, it.h + it.size + 12, -it.y]}>
          <mesh geometry={shapes[it.kind]} scale={it.size} renderOrder={OVERLAY}>
            <meshBasicMaterial color={tint[it.kind]} transparent opacity={0.9} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
          </mesh>
          {/* a thin beam down to the roof */}
          <mesh position={[0, -(it.size + 12) / 2, 0]} renderOrder={OVERLAY}>
            <cylinderGeometry args={[0.4, 0.4, it.size + 12, 6]} />
            <meshBasicMaterial color={tint[it.kind]} transparent opacity={0.5} depthWrite={false} blending={THREE.AdditiveBlending} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// The density effect

export function DensityEffect({ scenery, night }) {
  return (
    <group>
      <DensityMap grid={scenery.grid} night={night} />
      <ResidentSignals scenery={scenery} night={night} />
      <DataStreams scenery={scenery} night={night} />
      <LayeredLinks scenery={scenery} night={night} />
      <GlitchPanes scenery={scenery} night={night} />
    </group>
  )
}

// The density map on the ground, read as a computer signal: squares glow by density (blue, cyan, yellow),
// packets of light run along the grid lines, a scan wave sweeps across, and dense rows glitch sideways.
// Squares that are mostly green are left out, so parks and cemeteries stay natural.
function DensityMap({ grid, night }) {
  const { x0, y0, nx, ny, CELL, density, greenShare } = grid
  const texture = useMemo(() => {
    const data = new Uint8Array(nx * ny * 4)
    for (let k = 0; k < nx * ny; k++) {
      data[k * 4] = Math.round(density[k] * 255)
      data[k * 4 + 1] = Math.round(greenShare[k] * 255)
      data[k * 4 + 3] = 255
    }
    const t = new THREE.DataTexture(data, nx, ny, THREE.RGBAFormat)
    t.magFilter = THREE.NearestFilter
    t.minFilter = THREE.NearestFilter
    t.needsUpdate = true
    return t
  }, [nx, ny, density, greenShare])

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: {
          uTime: { value: 0 },
          uDensity: { value: texture },
          uOrigin: { value: new THREE.Vector2(x0, y0) },
          uCount: { value: new THREE.Vector2(nx, ny) },
          uCell: { value: CELL },
          uNight: { value: night ? 1 : 0 },
          uLow: { value: new THREE.Color(DENSITY_RAMP[0]) },
          uMid: { value: new THREE.Color(DENSITY_RAMP[1]) },
          uHigh: { value: new THREE.Color(DENSITY_RAMP[2]) },
        },
        vertexShader: /* glsl */ `
          varying vec2 vM;
          void main() {
            vec4 w = modelMatrix * vec4(position, 1.0);
            vM = vec2(w.x, -w.z); // metres east, north
            gl_Position = projectionMatrix * viewMatrix * w;
          }`,
        fragmentShader: /* glsl */ `
          uniform float uTime, uCell, uNight;
          uniform sampler2D uDensity;
          uniform vec2 uOrigin, uCount;
          uniform vec3 uLow, uMid, uHigh;
          varying vec2 vM;
          float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          vec4 cellAt(vec2 m) { return texture2D(uDensity, (m - uOrigin) / (uCount * uCell)); }
          void main() {
            vec2 m = vM;
            // glitch: now and then a dense row of the signal jumps sideways
            float row = floor(m.y / 7.0);
            float tick = floor(uTime * 8.0);
            vec4 here = cellAt(m);
            float jump = step(0.94 - 0.1 * here.r, hash(vec2(row, tick))) * step(0.5, here.r);
            m.x += jump * (hash(vec2(tick, row)) - 0.5) * 40.0;

            vec4 cell = cellAt(m);
            float d = cell.r;
            if (d < 0.03 || cell.g > 0.4) discard; // nothing over green areas

            vec3 col = d < 0.5 ? mix(uLow, uMid, d / 0.5) : mix(uMid, uHigh, (d - 0.5) / 0.5);

            // grid lines between the 50 m squares
            vec2 f = fract((m - uOrigin) / uCell);
            vec2 edge = min(f, 1.0 - f) * uCell;
            float lineH = smoothstep(1.4, 0.0, edge.y);
            float lineV = smoothstep(1.4, 0.0, edge.x);

            // packets of light running along the grid lines; faster and more of them where it is dense
            float rowId = floor((m.y - uOrigin.y) / uCell + 0.5);
            float colId = floor((m.x - uOrigin.x) / uCell + 0.5);
            float sp = 0.06 + 0.25 * d;
            float px = fract(m.x / (300.0 - 200.0 * d) - uTime * sp * (0.6 + 0.8 * hash(vec2(rowId, 3.0))) + hash(vec2(rowId, 7.0)));
            float py = fract(m.y / (300.0 - 200.0 * d) - uTime * sp * (0.6 + 0.8 * hash(vec2(colId, 5.0))) + hash(vec2(colId, 9.0)));
            float packets = lineH * smoothstep(0.06, 0.0, px) + lineV * smoothstep(0.06, 0.0, py);

            // a scan wave sweeping diagonally across the city
            float wave = pow(0.5 + 0.5 * sin((m.x * 0.6 + m.y) * 0.01 - uTime * 1.3), 14.0);
            // static in the densest squares
            float stat = step(0.8, hash(floor(m * 1.5) + tick)) * smoothstep(0.6, 1.0, d);

            float a = d * 0.06 + (lineH + lineV) * (0.1 + 0.3 * d) + packets * d * 1.2 + wave * d * 0.18 + stat * 0.1;
            a *= mix(0.7, 1.0, uNight);
            gl_FragColor = vec4(col * (0.8 + packets * 0.9 + wave * 0.3), clamp(a, 0.0, 0.9));
            gl_FragColor.rgb = pow(max(gl_FragColor.rgb, 0.0), vec3(2.2));
            #include <colorspace_fragment>
          }`,
      }),
    [texture, x0, y0, nx, ny, CELL, night],
  )
  useTime(material)
  useDispose(texture, material)

  return (
    <mesh position={[x0 + (nx * CELL) / 2, 0.03, -(y0 + (ny * CELL) / 2)]} rotation={[-Math.PI / 2, 0, 0]} material={material} renderOrder={1}>
      <planeGeometry args={[nx * CELL, ny * CELL]} />
    </mesh>
  )
}

// Residents as signals: one flickering speck for every RESIDENTS_PER_SPECK residents in each census cell.
// The number per cell is the Zensus 2022 figure; where in the cell a speck floats is made up.
function ResidentSignals({ scenery, night }) {
  const geometry = useMemo(() => {
    const pos = []
    const seed = []
    const dens = []
    for (const s of scenery.specks) {
      pos.push(s.x, s.h, -s.y)
      seed.push(s.seed)
      dens.push(s.density)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('seed', new THREE.Float32BufferAttribute(seed, 1))
    g.setAttribute('dens', new THREE.Float32BufferAttribute(dens, 1))
    return g
  }, [scenery])
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: night ? THREE.AdditiveBlending : THREE.NormalBlending,
        uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(night ? CYBER_COLORS.noise : '#0e8fa6') } },
        vertexShader: /* glsl */ `
          uniform float uTime;
          attribute float seed;
          attribute float dens;
          varying float vOn;
          varying float vSeed;
          float hash(float n) { return fract(sin(n) * 43758.5453); }
          void main() {
            vec3 p = position;
            // busy blocks flicker faster and jump about more: the network struggling
            float tick = floor(uTime * (2.0 + seed * 6.0 + dens * 10.0));
            vOn = step(0.4, hash(tick + seed * 101.0));
            vSeed = seed;
            p.y += sin(uTime * (0.5 + seed) + seed * 30.0) * 1.5;
            if (hash(floor(uTime * 3.0) + seed * 57.0) > 0.97 - 0.12 * dens) p.x += (hash(seed * 13.0 + tick) - 0.5) * 30.0;
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_PointSize = clamp(1900.0 / -mv.z, 1.0, 3.6);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          varying float vOn;
          varying float vSeed;
          void main() {
            if (vOn < 0.5) discard;
            vec3 c = vSeed > 0.88 ? vec3(0.99, 0.93, 0.04) : (vSeed > 0.8 ? vec3(1.0, 0.2, 0.45) : uColor);
            gl_FragColor = vec4(c, 0.85);
            gl_FragColor.rgb = pow(max(gl_FragColor.rgb, 0.0), vec3(2.2));
            #include <colorspace_fragment>
          }`,
      }),
    [night],
  )
  useTime(material)
  useDispose(geometry, material)
  return <points geometry={geometry} material={material} renderOrder={OVERLAY} />
}

// Data streams: vertical columns of light rising from the roofs; their number grows steeply with density
function DataStreams({ scenery, night }) {
  const geometry = useMemo(() => {
    const random = makeRandom(404)
    const lines = []
    const roofsByCell = new Map()
    for (const r of scenery.roofs) {
      const key = `${Math.floor(r.x / DENSITY_CELL_M)},${Math.floor(r.y / DENSITY_CELL_M)}`
      if (!roofsByCell.has(key)) roofsByCell.set(key, [])
      roofsByCell.get(key).push(r)
    }
    for (const c of scenery.cells) {
      if (c.green > 0.4 || c.density < 0.3) continue
      const here = roofsByCell.get(`${Math.floor(c.x / DENSITY_CELL_M)},${Math.floor(c.y / DENSITY_CELL_M)}`)
      if (!here) continue
      const n = Math.round(c.density * c.density * 5)
      for (let k = 0; k < n; k++) {
        const r = here[Math.floor(random() * here.length)]
        const top = r.h + 30 + random() * 90 * c.density
        lines.push([v3(r.x, r.y, r.h), v3(r.x, r.y, top)])
      }
    }
    return lineGeometry(lines, random)
  }, [scenery])
  const material = useMemo(
    () => makeFlowMaterial({ color: night ? '#7ff9ff' : '#0e8fa6', base: 0.05, pulse: 0.9, freq: 3, speed: 0.8, width: 0.15, additive: night }),
    [night],
  )
  useTime(material)
  useDispose(geometry, material)
  return <lineSegments geometry={geometry} material={material} renderOrder={OVERLAY} />
}

// Links that thicken with density: none in quiet blocks, a few in medium ones, a tangle in dense ones
function LayeredLinks({ scenery, night }) {
  const { medium, dense } = useMemo(() => {
    const hubs = hubsOf(scenery, 50, 6).map((h) => ({ ...h, d: scenery.densityAt(h.x, h.y) }))
    const mid = hubs.filter((h) => h.d >= 0.3 && h.d < 0.6)
    const high = hubs.filter((h) => h.d >= 0.6)
    const medium = lineGeometry(arcs(nearestPairs(mid, () => 2, 150), 0.25, makeRandom(11)), makeRandom(12))
    // dense: many short links plus long crossing ones, overlapping like an overloaded switchboard
    const pairs = [...nearestPairs(high, () => 5, 160), ...nearestPairs(high, () => 2, 420)]
    const dense = lineGeometry(arcs(pairs, 0.4, makeRandom(13)), makeRandom(14))
    return { medium, dense }
  }, [scenery])
  const calm = useMemo(
    () => makeFlowMaterial({ color: night ? CYBER_COLORS.link : '#0e8fa6', base: 0.18, pulse: 0.6, freq: 1, speed: 0.3, width: 0.2, additive: night }),
    [night],
  )
  const busy = useMemo(
    () => makeFlowMaterial({ color: night ? '#9ff9ff' : '#0b7d91', base: 0.22, pulse: 0.9, freq: 4, speed: 1.4, width: 0.08, additive: night }),
    [night],
  )
  useTime(calm)
  useTime(busy)
  useDispose(medium, dense, calm, busy)
  return (
    <group>
      <lineSegments geometry={medium} material={calm} renderOrder={OVERLAY} />
      <lineSegments geometry={dense} material={busy} renderOrder={OVERLAY} />
    </group>
  )
}

// Holographic interference: thin panes that blink and jitter above the densest blocks
function GlitchPanes({ scenery, night }) {
  const { geometry, count } = useMemo(() => {
    const random = makeRandom(1999)
    const CELL = DENSITY_CELL_M
    const matrices = []
    const seeds = []
    const dummy = new THREE.Object3D()
    for (const c of scenery.cells) {
      if (c.density <= 0.55 || c.green > 0.4) continue
      const n = Math.round((c.density - 0.55) * 10) + 1
      for (let k = 0; k < n; k++) {
        dummy.position.set(c.x + (random() - 0.5) * CELL, c.meanHeight + 4 + random() * 40, -(c.y + (random() - 0.5) * CELL))
        dummy.rotation.set(0, random() * Math.PI, 0)
        dummy.scale.set(14 + random() * 44, 1 + random() * 4, 1)
        dummy.updateMatrix()
        matrices.push(dummy.matrix.clone())
        seeds.push(random())
      }
    }
    const g = new THREE.InstancedBufferGeometry().copy(new THREE.PlaneGeometry(1, 1))
    g.instanceCount = matrices.length
    const m = new Float32Array(matrices.length * 16)
    matrices.forEach((mat, i) => mat.toArray(m, i * 16))
    g.setAttribute('paneMatrix', new THREE.InstancedBufferAttribute(m, 16))
    g.setAttribute('seed', new THREE.InstancedBufferAttribute(new Float32Array(seeds), 1))
    return { geometry: g, count: matrices.length }
  }, [scenery])
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: night ? THREE.AdditiveBlending : THREE.NormalBlending,
        uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(night ? CYBER_COLORS.holo : '#139fb5') } },
        vertexShader: /* glsl */ `
          uniform float uTime;
          attribute mat4 paneMatrix;
          attribute float seed;
          varying float vOn;
          varying float vSeed;
          varying vec2 vUv;
          float hash(float n) { return fract(sin(n) * 43758.5453); }
          void main() {
            vUv = uv;
            vSeed = seed;
            float tick = floor(uTime * (4.0 + seed * 6.0));
            vOn = step(0.74, hash(tick * 1.7 + seed * 91.0));
            vec4 world = paneMatrix * vec4(position, 1.0);
            world.x += (hash(tick + seed) - 0.5) * 8.0 * vOn;
            gl_Position = projectionMatrix * viewMatrix * world;
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          uniform float uTime;
          varying float vOn;
          varying float vSeed;
          varying vec2 vUv;
          void main() {
            if (vOn < 0.5) discard;
            float scan = step(0.5, fract(vUv.y * 3.0 + uTime * 4.0));
            vec3 c = vSeed > 0.8 ? vec3(0.99, 0.93, 0.04) : (vSeed > 0.7 ? vec3(1.0, 0.2, 0.45) : uColor);
            gl_FragColor = vec4(c, 0.2 + 0.3 * scan);
            gl_FragColor.rgb = pow(max(gl_FragColor.rgb, 0.0), vec3(2.2));
            #include <colorspace_fragment>
          }`,
      }),
    [night],
  )
  useTime(material)
  useDispose(geometry, material)
  if (!count) return null
  return <mesh geometry={geometry} material={material} frustumCulled={false} renderOrder={OVERLAY} />
}
