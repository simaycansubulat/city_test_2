// Transportation mode: Weimar's real city bus lines 1 to 9, in a version for 2077.
// The routes, stops, line numbers and line colours are today's, from OpenStreetMap (operator
// Stadtwirtschaft Weimar), stored in public/data/buslines.json and clipped to the kit. Imagined: each
// line runs as an elevated hover-line 18 m above its real route, side by side where lines share a
// street, with fast hover pods instead of buses, lit platforms at the real stops and Goetheplatz as
// the hub it is today. Fast light trails stream along the real streets below.
// Decoration only: no clicks, no effect on any calculation.

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { makeRandom } from './scenery.js'
import { simplify } from './paths.js'

const HEIGHT = 18 // guideway height in metres
const GAP = 2.6 // metres between lines that share a street
const POD_SPEED = 40 // metres per second, about 145 km/h

const v3 = (x, y, h) => new THREE.Vector3(x, h, -y)

function useDispose(...objects) {
  useEffect(() => () => objects.forEach((o) => o?.dispose()), objects) // eslint-disable-line react-hooks/exhaustive-deps
}

// The bus lines in metres, each with its own track beside the others
export function prepareBusLines(city, data) {
  const n = data.lines.length
  return data.lines.map((l, k) => {
    const offset = (k - (n - 1) / 2) * GAP
    const runs = l.runs.map((run) => {
      const pts = simplify(run.map(city.project), 2)
      // shift the route sideways by this line's offset, so shared streets show parallel tracks
      return pts.map(([x, y], i) => {
        const [ax, ay] = pts[Math.max(0, i - 1)]
        const [bx, by] = pts[Math.min(pts.length - 1, i + 1)]
        const len = Math.hypot(bx - ax, by - ay) || 1
        return [x - ((by - ay) / len) * offset, y + ((bx - ax) / len) * offset]
      })
    })
    return {
      ref: l.ref,
      color: l.colour,
      from: l.from,
      to: l.to,
      runs,
      stops: l.stops.map((s) => {
        const [x, y] = city.project(s.lonlat)
        return { name: s.name, x, y }
      }),
    }
  })
}

export default function Transport({ city, busLines }) {
  const lines = useMemo(
    () =>
      busLines.flatMap((l) =>
        l.runs
          .filter((r) => r.length > 1)
          .map((r) => {
            const curve = new THREE.CatmullRomCurve3(r.map(([x, y]) => v3(x, y, HEIGHT)), false, 'centripetal', 0.2)
            return { ref: l.ref, color: l.color, curve, length: curve.getLength() }
          }),
      ),
    [busLines],
  )
  return (
    <group>
      {lines.map((l, i) => (
        <Guideway key={i} line={l} />
      ))}
      <Pylons lines={lines} />
      <Stops busLines={busLines} />
      <Pods lines={lines} />
      <LightTrails city={city} />
    </group>
  )
}

// A slim glowing tube in the line's real colour
function Guideway({ line }) {
  const geometry = useMemo(() => new THREE.TubeGeometry(line.curve, Math.ceil(line.length / 5), 0.55, 6, false), [line])
  useDispose(geometry)
  return (
    <mesh geometry={geometry} renderOrder={10}>
      <meshBasicMaterial color={line.color} transparent opacity={0.85} depthWrite={false} blending={THREE.AdditiveBlending} />
    </mesh>
  )
}

// Slim pylons every 50 m; where several lines share a street, one pylon carries them all
function Pylons({ lines }) {
  const mesh = useMemo(() => {
    const taken = new Set()
    const spots = []
    for (const l of lines) {
      const n = Math.max(2, Math.floor(l.length / 50))
      for (let i = 0; i <= n; i++) {
        const p = l.curve.getPointAt(i / n)
        const key = `${Math.round(p.x / 30)},${Math.round(p.z / 30)}`
        if (taken.has(key)) continue
        taken.add(key)
        spots.push(p)
      }
    }
    const m = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.5, 0.8, 1, 6), new THREE.MeshLambertMaterial({ color: '#3a4058' }), spots.length)
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

// A floating platform with a light lift down to the street at every real stop. A stop served by
// several lines is white; Goetheplatz, the hub, is the largest.
function Stops({ busLines }) {
  const spots = useMemo(() => {
    const byName = new Map()
    for (const l of busLines) {
      for (const s of l.stops) {
        if (!byName.has(s.name)) byName.set(s.name, { ...s, colors: [] })
        byName.get(s.name).colors.push(l.color)
      }
    }
    return [...byName.values()].map((s) => ({
      ...s,
      hub: s.name === 'Goetheplatz',
      color: s.colors.length > 1 ? '#ffffff' : s.colors[0],
      lines: s.colors.length,
    }))
  }, [busLines])
  const ring = useMemo(() => new THREE.TorusGeometry(1, 0.08, 6, 40).rotateX(Math.PI / 2), [])
  const disc = useMemo(() => new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2), [])
  const beam = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, 12, 1, true), [])
  useDispose(ring, disc, beam)
  return (
    <group>
      {spots.map((s, i) => {
        const r = s.hub ? 22 : 5 + Math.min(6, s.lines * 1.2)
        return (
          <group key={i} position={[s.x, HEIGHT, -s.y]}>
            <mesh geometry={disc} scale={r} position={[0, -0.6, 0]} renderOrder={10}>
              <meshBasicMaterial color={s.color} transparent opacity={0.12} depthWrite={false} blending={THREE.AdditiveBlending} />
            </mesh>
            <mesh geometry={ring} scale={r} renderOrder={10}>
              <meshBasicMaterial color={s.color} transparent opacity={0.9} depthWrite={false} blending={THREE.AdditiveBlending} />
            </mesh>
            <mesh geometry={beam} scale={[s.hub ? 2.5 : 1, HEIGHT, s.hub ? 2.5 : 1]} position={[0, -HEIGHT / 2, 0]} renderOrder={10}>
              <meshBasicMaterial color={s.color} transparent opacity={0.16} depthWrite={false} blending={THREE.AdditiveBlending} />
            </mesh>
            {s.hub && (
              <mesh geometry={beam} scale={[3, 160, 3]} position={[0, 80, 0]} renderOrder={10}>
                <meshBasicMaterial color="#ffffff" transparent opacity={0.14} depthWrite={false} blending={THREE.AdditiveBlending} />
              </mesh>
            )}
          </group>
        )
      })}
    </group>
  )
}

const PODS_PER_LINE = 3

// Hover pods in the line colour, running back and forth and slowing at the ends
function Pods({ lines }) {
  const body = useRef()
  const glow = useRef()
  const plan = useMemo(() => {
    const list = []
    lines.forEach((l, li) => {
      for (let t = 0; t < PODS_PER_LINE; t++) list.push({ line: l, phase: (2 * t) / PODS_PER_LINE + li * 0.17 })
    })
    return list
  }, [lines])
  const o = useMemo(() => new THREE.Object3D(), [])
  const ahead = useMemo(() => new THREE.Vector3(), [])
  // a rounded pod, lying along its direction of travel
  const shape = useMemo(() => new THREE.CapsuleGeometry(1.1, 7, 4, 10).rotateX(Math.PI / 2), [])
  useDispose(shape)

  useEffect(() => {
    const c = new THREE.Color()
    plan.forEach((p, i) => glow.current.setColorAt(i, c.set(p.line.color)))
    glow.current.instanceColor.needsUpdate = true
  }, [plan])

  useFrame((state) => {
    const time = state.clock.elapsedTime
    plan.forEach((p, i) => {
      const L = p.line.length
      const f = ((time * POD_SPEED) / L + p.phase) % 2
      const raw = f < 1 ? f : 2 - f
      const u = THREE.MathUtils.clamp(0.5 - 0.5 * Math.cos(Math.PI * raw), 0.0005, 0.9995)
      const dir = f < 1 ? 1 : -1
      o.position.copy(p.line.curve.getPointAt(u))
      o.position.y += 1.8
      ahead.copy(o.position).add(p.line.curve.getTangentAt(u).multiplyScalar(dir))
      o.lookAt(ahead)
      o.updateMatrix()
      body.current.setMatrixAt(i, o.matrix)
      o.translateY(-1.2)
      o.updateMatrix()
      glow.current.setMatrixAt(i, o.matrix)
    })
    body.current.instanceMatrix.needsUpdate = true
    glow.current.instanceMatrix.needsUpdate = true
  })

  return (
    <group>
      <instancedMesh ref={body} args={[shape, null, plan.length]} frustumCulled={false}>
        <meshBasicMaterial color="#e8f1ff" />
      </instancedMesh>
      <instancedMesh ref={glow} args={[null, null, plan.length]} frustumCulled={false} renderOrder={10}>
        <boxGeometry args={[2.4, 0.4, 9]} />
        <meshBasicMaterial transparent opacity={0.95} depthWrite={false} blending={THREE.AdditiveBlending} />
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
