// The land in Weimar 2077, from the kit's land use plots. Green areas (parks and cemeteries) stay
// green and natural, with trees and no neon; water is dark with soft reflections; the public squares,
// Weimar's historic plazas, get a lit stone paving with slow holographic rings.
// Decoration only: no clicks, no effect on any calculation.

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { makeRandom, pointInRing } from './scenery.js'

function shapesOf(polys) {
  return polys.map(({ rings }) => {
    const shape = new THREE.Shape(rings[0].map(([x, y]) => new THREE.Vector2(x, y)))
    shape.holes = rings.slice(1).map((h) => new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))))
    return shape
  })
}

function flatGeometry(polys, extra) {
  const g = new THREE.ShapeGeometry(shapesOf(polys))
  if (extra) extra(g)
  g.rotateX(-Math.PI / 2)
  return g
}

function useDispose(...objects) {
  useEffect(() => () => objects.forEach((o) => o?.dispose()), objects) // eslint-disable-line react-hooks/exhaustive-deps
}

function useTime(material) {
  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.elapsedTime
  })
}

export default function Landscape({ city, scenery, forest = false }) {
  return (
    <group>
      <Green scenery={scenery} />
      <Trees city={city} scenery={scenery} forest={forest} />
      <Water scenery={scenery} />
      <Squares scenery={scenery} />
      {/* Forest mode: the green areas come alive */}
      {forest && <Fireflies scenery={scenery} />}
      {forest && <Mist scenery={scenery} />}
    </group>
  )
}

function Green({ scenery }) {
  const geometry = useMemo(() => flatGeometry(scenery.green), [scenery])
  useDispose(geometry)
  return (
    <mesh geometry={geometry} position={[0, 0.02, 0]}>
      <meshLambertMaterial color="#2f6e3b" polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-2} />
    </mesh>
  )
}

// Trees scattered through the green areas, kept out of the building footprints
function Trees({ city, scenery, forest }) {
  // the crowns sway in the wind; a little more in Forest mode
  const wind = useMemo(() => ({ uTime: { value: 0 }, uSway: { value: 0.1 } }), [])
  wind.uSway.value = forest ? 0.22 : 0.1
  useFrame((state) => {
    wind.uTime.value = state.clock.elapsedTime
  })
  const { crowns, trunks, count } = useMemo(() => {
    // building footprints in a bucket grid, so each tree only checks the buildings near it
    const G = 40
    const grid = new Map()
    city.buildings.forEach((b) => {
      const r = b.rings[0]
      let x0 = Infinity
      let y0 = Infinity
      let x1 = -Infinity
      let y1 = -Infinity
      for (const [x, y] of r) {
        x0 = Math.min(x0, x)
        y0 = Math.min(y0, y)
        x1 = Math.max(x1, x)
        y1 = Math.max(y1, y)
      }
      for (let i = Math.floor(x0 / G); i <= Math.floor(x1 / G); i++) {
        for (let j = Math.floor(y0 / G); j <= Math.floor(y1 / G); j++) {
          const k = `${i},${j}`
          if (!grid.has(k)) grid.set(k, [])
          grid.get(k).push(r)
        }
      }
    })
    const inBuilding = (x, y) => (grid.get(`${Math.floor(x / G)},${Math.floor(y / G)}`) || []).some((r) => pointInRing([x, y], r))

    const random = makeRandom(1776)
    const trees = []
    for (const poly of scenery.green) {
      const n = Math.min(900, Math.round(poly.area / 120))
      const b = poly.bbox
      for (let k = 0, tries = 0; k < n && tries < n * 6; tries++) {
        const x = b.x0 + random() * (b.x1 - b.x0)
        const y = b.y0 + random() * (b.y1 - b.y0)
        if (!pointInRing([x, y], poly.rings[0]) || poly.rings.slice(1).some((h) => pointInRing([x, y], h))) continue
        if (inBuilding(x, y)) continue
        trees.push({ x, y, r: 2.6 + random() * 2.8, h: 7 + random() * 11, tone: random() })
        k++
      }
    }

    const greens = ['#2c6b37', '#3a8445', '#24592f', '#4b9150'].map((c) => new THREE.Color(c))
    const crownMaterial = new THREE.MeshLambertMaterial({ flatShading: true })
    crownMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = wind.uTime
      shader.uniforms.uSway = wind.uSway
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uSway;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          float ph = instanceMatrix[3].x * 0.07 + instanceMatrix[3].z * 0.05;
          float up = position.y + 1.0;
          transformed.x += sin(uTime * 1.3 + ph) * uSway * up;
          transformed.z += cos(uTime * 1.05 + ph * 1.3) * uSway * 0.7 * up;`,
        )
    }
    const crowns = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), crownMaterial, trees.length)
    const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.32, 1, 5), new THREE.MeshLambertMaterial({ color: '#4a3a2c' }), trees.length)
    const m = new THREE.Object3D()
    trees.forEach((t, i) => {
      m.position.set(t.x, t.h - t.r * 0.9, -t.y)
      m.scale.set(t.r, t.r * 1.15, t.r)
      m.updateMatrix()
      crowns.setMatrixAt(i, m.matrix)
      crowns.setColorAt(i, greens[Math.floor(t.tone * greens.length)])
      const trunkH = t.h - t.r * 1.6
      m.position.set(t.x, trunkH / 2, -t.y)
      m.scale.set(1, trunkH, 1)
      m.updateMatrix()
      trunks.setMatrixAt(i, m.matrix)
    })
    crowns.instanceMatrix.needsUpdate = true
    trunks.instanceMatrix.needsUpdate = true
    if (crowns.instanceColor) crowns.instanceColor.needsUpdate = true
    return { crowns, trunks, count: trees.length }
  }, [city, scenery, wind])
  useEffect(
    () => () => {
      for (const mesh of [crowns, trunks]) {
        mesh.geometry.dispose()
        mesh.material.dispose()
        mesh.dispose()
      }
    },
    [crowns, trunks],
  )
  if (!count) return null
  return (
    <group>
      <primitive object={crowns} />
      <primitive object={trunks} />
    </group>
  )
}

// Water: dark, with slow soft reflections of the city lights
function Water({ scenery }) {
  const geometry = useMemo(() => flatGeometry(scenery.water), [scenery])
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -2,
        vertexShader: /* glsl */ `
          varying vec2 vM;
          void main() {
            vec4 w = modelMatrix * vec4(position, 1.0);
            vM = w.xz;
            gl_Position = projectionMatrix * viewMatrix * w;
          }`,
        fragmentShader: /* glsl */ `
          uniform float uTime;
          varying vec2 vM;
          void main() {
            float r = sin(vM.x * 0.35 + uTime * 0.8) * sin(vM.y * 0.5 - uTime * 0.6);
            float shine = smoothstep(0.75, 1.0, r);
            vec3 col = vec3(0.03, 0.12, 0.22) + vec3(0.0, 0.45, 0.6) * shine * 0.5 + vec3(0.6, 0.1, 0.35) * smoothstep(0.92, 1.0, -r) * 0.3;
            gl_FragColor = vec4(col, 1.0);
            gl_FragColor.rgb = pow(max(gl_FragColor.rgb, 0.0), vec3(2.2));
            #include <colorspace_fragment>
          }`,
      }),
    [],
  )
  useTime(material)
  useDispose(geometry, material)
  if (!scenery.water.length) return null
  return <mesh geometry={geometry} material={material} position={[0, 0.025, 0]} />
}

// The public squares: warm lit stone paving, with slow holographic rings spreading from each square's centre
function Squares({ scenery }) {
  const geometry = useMemo(() => {
    const centres = scenery.squares.map(({ rings }) => {
      let x = 0
      let y = 0
      for (const p of rings[0]) {
        x += p[0]
        y += p[1]
      }
      return [x / rings[0].length, y / rings[0].length]
    })
    const parts = scenery.squares.map((sq, i) => {
      const g = flatGeometry([sq])
      const n = g.getAttribute('position').count
      g.setAttribute('centre', new THREE.Float32BufferAttribute(new Array(n).fill(0).flatMap(() => centres[i]), 2))
      return g
    })
    // merge by hand: positions and centres, with indices
    const pos = []
    const cen = []
    const idx = []
    let offset = 0
    for (const g of parts) {
      pos.push(...g.getAttribute('position').array)
      cen.push(...g.getAttribute('centre').array)
      const index = g.getIndex()
      if (index) idx.push(...Array.from(index.array, (k) => k + offset))
      offset += g.getAttribute('position').count
      g.dispose()
    }
    const merged = new THREE.BufferGeometry()
    merged.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    merged.setAttribute('centre', new THREE.Float32BufferAttribute(cen, 2))
    merged.setIndex(idx)
    return merged
  }, [scenery])
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -2,
        vertexShader: /* glsl */ `
          attribute vec2 centre;
          varying vec2 vM;
          varying vec2 vC;
          void main() {
            vec4 w = modelMatrix * vec4(position, 1.0);
            vM = vec2(w.x, -w.z);
            vC = centre;
            gl_Position = projectionMatrix * viewMatrix * w;
          }`,
        fragmentShader: /* glsl */ `
          uniform float uTime;
          varying vec2 vM;
          varying vec2 vC;
          void main() {
            // stone paving
            vec2 s = fract(vM / vec2(1.6, 1.1) + vec2(floor(vM.y / 1.1) * 0.5, 0.0));
            float joint = step(0.92, max(s.x, s.y));
            vec3 col = vec3(0.16, 0.13, 0.11) * (1.0 - 0.4 * joint) + vec3(0.12, 0.08, 0.03);
            // holographic rings spreading slowly from the centre
            float d = length(vM - vC);
            float ring = smoothstep(1.2, 0.0, abs(fract(d / 18.0 - uTime * 0.12) - 0.5) * 18.0);
            col += vec3(0.0, 0.75, 0.9) * ring * 0.35 * exp(-d / 70.0);
            gl_FragColor = vec4(col, 1.0);
            gl_FragColor.rgb = pow(max(gl_FragColor.rgb, 0.0), vec3(2.2));
            #include <colorspace_fragment>
          }`,
      }),
    [],
  )
  useTime(material)
  useDispose(geometry, material)
  if (!scenery.squares.length) return null
  return <mesh geometry={geometry} material={material} position={[0, 0.02, 0]} />
}

// Fireflies drifting and blinking low over the green areas
function Fireflies({ scenery }) {
  const geometry = useMemo(() => {
    const random = makeRandom(1832)
    const pos = []
    const seed = []
    for (const poly of scenery.green) {
      const n = Math.min(160, Math.round(poly.area / 400))
      const b = poly.bbox
      for (let k = 0, tries = 0; k < n && tries < n * 6; tries++) {
        const x = b.x0 + random() * (b.x1 - b.x0)
        const y = b.y0 + random() * (b.y1 - b.y0)
        if (!pointInRing([x, y], poly.rings[0])) continue
        pos.push(x, 1 + random() * 6, -y)
        seed.push(random())
        k++
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('seed', new THREE.Float32BufferAttribute(seed, 1))
    return g
  }, [scenery])
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 } },
        vertexShader: /* glsl */ `
          uniform float uTime;
          attribute float seed;
          varying float vGlow;
          void main() {
            vec3 p = position;
            p.x += sin(uTime * 0.4 + seed * 40.0) * 3.0;
            p.z += cos(uTime * 0.35 + seed * 25.0) * 3.0;
            p.y += sin(uTime * 0.9 + seed * 12.0) * 0.8;
            vGlow = pow(0.5 + 0.5 * sin(uTime * (0.8 + seed) + seed * 60.0), 6.0);
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_PointSize = clamp(1800.0 / -mv.z, 1.5, 6.0);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          varying float vGlow;
          void main() {
            float d = length(gl_PointCoord - 0.5);
            if (d > 0.5) discard;
            gl_FragColor = vec4(vec3(0.85, 1.0, 0.45), vGlow * (1.0 - d * 2.0));
            gl_FragColor.rgb = pow(max(gl_FragColor.rgb, 0.0), vec3(2.2));
            #include <colorspace_fragment>
          }`,
      }),
    [],
  )
  useTime(material)
  useDispose(geometry, material)
  return <points geometry={geometry} material={material} renderOrder={10} />
}

// A soft, drifting ground mist over the parks
function Mist({ scenery }) {
  const geometry = useMemo(() => flatGeometry(scenery.green), [scenery])
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { uTime: { value: 0 } },
        vertexShader: /* glsl */ `
          varying vec2 vM;
          void main() {
            vec4 w = modelMatrix * vec4(position, 1.0);
            vM = w.xz;
            gl_Position = projectionMatrix * viewMatrix * w;
          }`,
        fragmentShader: /* glsl */ `
          uniform float uTime;
          varying vec2 vM;
          void main() {
            float n = sin(vM.x * 0.03 + uTime * 0.15) * sin(vM.y * 0.025 - uTime * 0.11) + sin((vM.x + vM.y) * 0.05 + uTime * 0.2) * 0.5;
            float a = 0.07 + 0.08 * (0.5 + 0.5 * n);
            gl_FragColor = vec4(vec3(0.75, 0.85, 0.95), a);
            gl_FragColor.rgb = pow(max(gl_FragColor.rgb, 0.0), vec3(2.2));
            #include <colorspace_fragment>
          }`,
      }),
    [],
  )
  useTime(material)
  useDispose(geometry, material)
  return <mesh geometry={geometry} material={material} position={[0, 3, 0]} renderOrder={9} />
}
