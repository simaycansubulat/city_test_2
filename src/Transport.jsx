// Transportation mode, imagined for 2077 but anchored in Weimar's real transport: Goetheplatz is the
// city's central bus stop today, and many bus lines run north from it to the Hauptbahnhof.
// Four elevated maglev lines leave Goetheplatz along real streets (shortest paths in the street
// graph): north to the Hauptbahnhof, south to the Bauhaus-Universität, east into the old town to the
// City Palace, and west. Trains glide along them; fast light trails stream along the real streets.
// Decoration only: no clicks, no effect on any calculation.

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { makeRandom } from './scenery.js'
import { nearestNode, shortestPath, simplify } from './paths.js'

const HEIGHT = 26 // guideway height in metres
export const LINE_COLORS = ['#fcee0a', '#ff2a6d', '#00e5ff', '#9dff6a']

const v3 = (x, y, h) => new THREE.Vector3(x, h, -y)

function useDispose(...objects) {
  useEffect(() => () => objects.forEach((o) => o?.dispose()), objects) // eslint-disable-line react-hooks/exhaustive-deps
}

export default function Transport({ city, landmarks }) {
  const lines = useMemo(() => {
    const at = (id) => landmarks.find((l) => l.id === id)
    const hub = at('goetheplatz')
    const hubNode = nearestNode(city, [hub.x, hub.y])
    // west terminus: the westernmost street node at about the latitude of the hub
    let west = -1
    for (const i of city.walkableNodes) {
      const n = city.nodes[i]
      if (Math.abs(n.y - hub.y) < 120 && (west < 0 || n.x < city.nodes[west].x)) west = i
    }
    const ends = [
      ['North line · Hauptbahnhof', nearestNode(city, [at('hauptbahnhof').x, at('hauptbahnhof').y])],
      ['South line · Bauhaus-Universität', nearestNode(city, [at('bauhaus-university').x, at('bauhaus-university').y])],
      ['East line · City Palace', nearestNode(city, [at('city-palace').x, at('city-palace').y])],
      ['West line', west],
    ]
    return ends.map(([name, end], k) => {
      const path = shortestPath(city, hubNode, end)
      const pts = simplify(path.map((i) => [city.nodes[i].x, city.nodes[i].y]), 12)
      const curve = new THREE.CatmullRomCurve3(pts.map(([x, y]) => v3(x, y, HEIGHT)), false, 'centripetal', 0.3)
      return { name, curve, color: LINE_COLORS[k], length: curve.getLength() }
    })
  }, [city, landmarks])

  return (
    <group>
      {lines.map((l, i) => (
        <Guideway key={i} line={l} />
      ))}
      <Pylons lines={lines} />
      <Stations lines={lines} />
      <Trains lines={lines} />
      <LightTrails city={city} />
    </group>
  )
}

// A slim glowing tube on top of the pylons
function Guideway({ line }) {
  const geometry = useMemo(() => new THREE.TubeGeometry(line.curve, Math.ceil(line.length / 6), 0.9, 6, false), [line])
  useDispose(geometry)
  return (
    <mesh geometry={geometry} renderOrder={10}>
      <meshBasicMaterial color={line.color} transparent opacity={0.75} depthWrite={false} blending={THREE.AdditiveBlending} />
    </mesh>
  )
}

function Pylons({ lines }) {
  const mesh = useMemo(() => {
    const spots = []
    for (const l of lines) {
      const n = Math.max(2, Math.floor(l.length / 45))
      for (let i = 0; i <= n; i++) spots.push(l.curve.getPointAt(i / n))
    }
    const m = new THREE.InstancedMesh(new THREE.BoxGeometry(1.4, 1, 1.4), new THREE.MeshLambertMaterial({ color: '#3a4058' }), spots.length)
    const o = new THREE.Object3D()
    spots.forEach((p, i) => {
      o.position.set(p.x, HEIGHT / 2, p.z)
      o.scale.set(1, HEIGHT, 1)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
    })
    return m
  }, [lines])
  useEffect(
    () => () => {
      mesh.geometry.dispose()
      mesh.material.dispose()
      mesh.dispose()
    },
    [mesh],
  )
  return <primitive object={mesh} />
}

// Stations at Goetheplatz, at each end and every 350 m along the way: a lit platform ring
function Stations({ lines }) {
  const spots = useMemo(() => {
    const s = [{ p: lines[0].curve.getPointAt(0), hub: true, color: '#ffffff' }]
    for (const l of lines) {
      const n = Math.max(1, Math.round(l.length / 350))
      for (let i = 1; i <= n; i++) s.push({ p: l.curve.getPointAt(i / n), hub: false, color: l.color })
    }
    return s
  }, [lines])
  const ring = useMemo(() => new THREE.TorusGeometry(1, 0.08, 6, 40).rotateX(Math.PI / 2), [])
  const beam = useMemo(() => new THREE.CylinderGeometry(0.6, 0.6, 1, 8, 1, true), [])
  useDispose(ring, beam)
  return (
    <group>
      {spots.map((s, i) => (
        <group key={i} position={[s.p.x, s.p.y, s.p.z]}>
          <mesh geometry={ring} scale={s.hub ? 16 : 9} renderOrder={10}>
            <meshBasicMaterial color={s.color} transparent opacity={0.9} depthWrite={false} blending={THREE.AdditiveBlending} />
          </mesh>
          <mesh geometry={beam} scale={[s.hub ? 3 : 1.5, s.hub ? 160 : 60, s.hub ? 3 : 1.5]} position={[0, s.hub ? 80 : 30, 0]} renderOrder={10}>
            <meshBasicMaterial color={s.color} transparent opacity={0.18} depthWrite={false} blending={THREE.AdditiveBlending} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

const CARS = 4
const TRAINS_PER_LINE = 2

// Trains of four cars running back and forth, with a light trail
function Trains({ lines }) {
  const cars = useRef()
  const glow = useRef()
  const plan = useMemo(() => {
    const list = []
    lines.forEach((l, li) => {
      for (let t = 0; t < TRAINS_PER_LINE; t++) list.push({ line: l, phase: t / TRAINS_PER_LINE + li * 0.13, speed: 22 })
    })
    return list
  }, [lines])
  const count = plan.length * CARS
  const o = useMemo(() => new THREE.Object3D(), [])
  const ahead = useMemo(() => new THREE.Vector3(), [])

  useEffect(() => {
    const c = new THREE.Color()
    plan.forEach((tr, i) => {
      for (let k = 0; k < CARS; k++) glow.current.setColorAt(i * CARS + k, c.set(tr.line.color))
    })
    glow.current.instanceColor.needsUpdate = true
  }, [plan])

  useFrame((state) => {
    const time = state.clock.elapsedTime
    plan.forEach((tr, i) => {
      const L = tr.line.length
      // ping-pong along the line, slowing near the ends like at a station
      const cycle = (time * tr.speed) / L + tr.phase
      const f = cycle % 2
      const raw = f < 1 ? f : 2 - f
      const eased = 0.5 - 0.5 * Math.cos(Math.PI * raw)
      const dir = f < 1 ? 1 : -1
      for (let k = 0; k < CARS; k++) {
        const u = THREE.MathUtils.clamp(eased - dir * (k * 11) / L, 0.0005, 0.9995)
        const p = tr.line.curve.getPointAt(u)
        const t = tr.line.curve.getTangentAt(u).multiplyScalar(dir)
        o.position.copy(p)
        o.position.y += 2.4
        ahead.copy(o.position).add(t)
        o.lookAt(ahead)
        o.updateMatrix()
        cars.current.setMatrixAt(i * CARS + k, o.matrix)
        o.translateY(-1.5)
        o.scale.set(1, 1, 1)
        o.updateMatrix()
        glow.current.setMatrixAt(i * CARS + k, o.matrix)
      }
    })
    cars.current.instanceMatrix.needsUpdate = true
    glow.current.instanceMatrix.needsUpdate = true
  })

  return (
    <group>
      <instancedMesh ref={cars} args={[null, null, count]} frustumCulled={false}>
        <boxGeometry args={[3.2, 3, 10]} />
        <meshBasicMaterial color="#e8f1ff" />
      </instancedMesh>
      <instancedMesh ref={glow} args={[null, null, count]} frustumCulled={false} renderOrder={10}>
        <boxGeometry args={[3.6, 0.6, 10.5]} />
        <meshBasicMaterial transparent opacity={0.9} depthWrite={false} blending={THREE.AdditiveBlending} />
      </instancedMesh>
    </group>
  )
}

const TRAILS = 260

// Fast light trails along the real streets: each one wanders from edge to edge through the network
function LightTrails({ city }) {
  const mesh = useRef()
  const state = useMemo(() => {
    const random = makeRandom(77)
    return Array.from({ length: TRAILS }, () => {
      const e = city.edges[Math.floor(random() * city.edges.length)]
      return { edge: e, from: e.u, s: random() * e.length, speed: 18 + random() * 22, red: random() > 0.55, random }
    })
  }, [city])
  const o = useMemo(() => new THREE.Object3D(), [])

  useEffect(() => {
    const white = new THREE.Color('#dff6ff')
    const red = new THREE.Color('#ff3355')
    state.forEach((t, i) => mesh.current.setColorAt(i, t.red ? red : white))
    mesh.current.instanceColor.needsUpdate = true
  }, [state])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1)
    state.forEach((t, i) => {
      t.s += t.speed * dt
      // at the end of an edge, carry on along a random edge from the next node
      while (t.s >= t.edge.length) {
        t.s -= t.edge.length
        const node = t.edge.u === t.from ? t.edge.v : t.edge.u
        const next = city.adjacency[node]
        const k = next[Math.floor(t.random() * next.length)]
        t.edge = city.edges[k]
        t.from = node
      }
      const forward = t.edge.u === t.from
      const a = forward ? t.edge.pts[0] : t.edge.pts[t.edge.pts.length - 1]
      const b = forward ? t.edge.pts[t.edge.pts.length - 1] : t.edge.pts[0]
      const f = t.edge.length ? t.s / t.edge.length : 0
      const x = a[0] + (b[0] - a[0]) * f
      const y = a[1] + (b[1] - a[1]) * f
      o.position.set(x, 2.5, -y)
      o.lookAt(b[0], 2.5, -b[1])
      o.updateMatrix()
      mesh.current.setMatrixAt(i, o.matrix)
    })
    mesh.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={mesh} args={[null, null, TRAILS]} frustumCulled={false} renderOrder={10}>
      <boxGeometry args={[0.7, 0.5, 14]} />
      <meshBasicMaterial transparent opacity={0.85} depthWrite={false} blending={THREE.AdditiveBlending} />
    </instancedMesh>
  )
}
