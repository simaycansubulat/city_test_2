import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import * as THREE from 'three'
import { GROUND, REACH_COLORS, STREET, USE_COLORS } from './palette.js'
import { CyberLook, DensityEffect } from './Cyber.jsx'
import Landscape, { ForestWarning } from './Landscape.jsx'
import Transport from './Transport.jsx'
import Pollution, { SMOG_FOG } from './Pollution.jsx'
import Architecture from './Architecture.jsx'
import { LandmarkLabelLayer, LandmarkTracker } from './LandmarkLabels.jsx'
import Ghost from './Ghost.jsx'
import { makeFacadeMaterial } from './facade.js'
import { buildBuildingGeometry } from './buildingGeometry.js'

// Night colours for Weimar 2077
const NIGHT = { ground: '#090b14', street: '#22b8ff', fog: '#0a0c18', marker: '#fcee0a' }

// Flat metres [x east, y north] at a height h become Three.js [x, up, -north]
const v3 = (x, y, h) => [x, h, -y]

// mode: null (overview), 'density', 'transport', 'pollution', 'forest' or 'architecture'
export default function CityScene({ city, scenery, busLines, landmarks, reach, onGroundClick, look2077, mode, forestIndex, selected, onSelect, voice }) {
  const { x0, y0, x1, y1 } = city.extent
  const colorOf = (b) => USE_COLORS[b.use] ?? USE_COLORS.undefined
  // both building versions, built once: flat roofs for the plain map, pitched roofs for 2077
  const day = useMemo(() => buildBuildingGeometry(city.buildings, { colorOf }), [city]) // eslint-disable-line react-hooks/exhaustive-deps
  const historic = useMemo(
    () => buildBuildingGeometry(city.buildings, { pitched: true, colorOf, densityAt: scenery.densityAt }),
    [city, scenery], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const m = look2077 ? mode : null
  const labelRefs = useRef([])
  const size = Math.max(x1 - x0, y1 - y0)
  // Look at the kit a little left of its centre, so the city sits to the right of the panel
  // made once, so a re-render never pulls the camera back while it flies somewhere else
  const target = useMemo(() => [(x0 + x1) / 2 - size * 0.12, 0, -(y0 + y1) / 2 + size * 0.04], [x0, x1, y0, y1, size])
  const home = useMemo(() => [target[0], size * 1.1, target[2] + size * 0.9], [target, size])
  // Pollution mode: the whole air turns brown-grey and closes in
  const smoggy = m === 'pollution'
  const fogNear = smoggy ? size * 0.5 : size * 1.4
  const fogFar = smoggy ? size * 2.2 : size * 3.6

  return (
    <>
    <Canvas
      camera={{ position: home, fov: 35, near: 5, far: size * 20 }}
      flat // no film-like tone curve: colours show as picked
      dpr={[1, 2]}
      style={{
        background: !look2077
          ? '#e8e5de'
          : smoggy
            ? 'radial-gradient(ellipse at 50% 25%, #3a3424 0%, #221e15 55%, #0f0d09 100%)'
            : 'radial-gradient(ellipse at 50% 25%, #1b2142 0%, #0b0d1a 55%, #05060c 100%)',
      }}
    >
      {look2077 ? (
        <>
          {/* night haze and a cool moonlight for the trees and the land */}
          <fog attach="fog" args={[smoggy ? SMOG_FOG : NIGHT.fog, fogNear, fogFar]} />
          <hemisphereLight args={['#9db4ea', '#0b0d16', m === 'forest' ? 1.5 : 1.05]} />
          <directionalLight color="#c4d2ff" position={[-800, 1500, 600]} intensity={0.85} />
        </>
      ) : (
        <>
          <hemisphereLight args={['#ffffff', '#d6d0c2', 1.7]} />
          <directionalLight position={[-800, 1500, 600]} intensity={0.9} />
        </>
      )}
      <Ground city={city} onGroundClick={onGroundClick} night={look2077} />
      {look2077 && <Landscape scenery={scenery} forest={m === 'forest'} />}
      <ReachAreas reach={reach} night={look2077} />
      <Streets city={city} night={look2077} mode={m} />
      <Buildings built={look2077 ? historic : day} reach={reach} night={look2077} mode={m} fogNear={fogNear} fogFar={fogFar} />
      <StartMarker reach={reach} night={look2077} />
      {look2077 && reach?.travel === 'supersonic' && <SonicBoom reach={reach} />}
      {/* imagined layers: decoration only, they take no clicks and change no numbers */}
      {look2077 && <CyberLook city={city} scenery={scenery} mode={m} />}
      {m === 'density' && <DensityEffect scenery={scenery} night />}
      {m === 'transport' && <Transport city={city} busLines={busLines} />}
      {m === 'pollution' && <Pollution scenery={scenery} />}
      {m === 'forest' && <ForestWarning forest={scenery.forests[forestIndex % scenery.forests.length]} />}
      <CameraDirector focus={focusOf(look2077 ? selected : null, m === 'forest' ? scenery.forests[forestIndex % scenery.forests.length] : null)} />
      {m === 'architecture' && <Architecture city={city} landmarks={landmarks} roofLines={historic.roofLines} />}
      {look2077 && <LandmarkTracker landmarks={landmarks} refs={labelRefs} selected={selected} />}
      {look2077 && selected && <Ghost landmark={selected} voice={voice} />}
      <OrbitControls
        makeDefault
        enableDamping
        target={target}
        maxPolarAngle={Math.PI / 2 - 0.05}
        minDistance={60}
        maxDistance={size * 4}
      />
      {/* a soft glow around the brightest lights only: neon, lit windows, lamps */}
      {look2077 && (
        <EffectComposer multisampling={0}>
          <Bloom mipmapBlur luminanceThreshold={0.55} luminanceSmoothing={0.2} intensity={1.1} radius={0.75} />
        </EffectComposer>
      )}
    </Canvas>
    {look2077 && <LandmarkLabelLayer landmarks={landmarks} selected={selected} onSelect={onSelect} refs={labelRefs} />}
    </>
  )
}

function Ground({ city, onGroundClick, night }) {
  const { x0, y0, x1, y1 } = city.extent
  const margin = 300
  const w = x1 - x0 + 2 * margin
  const h = y1 - y0 + 2 * margin
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[(x0 + x1) / 2, 0, -(y0 + y1) / 2]}
      onClick={(e) => {
        if (e.delta > 4) return // that was a drag to orbit or pan, not a click
        onGroundClick([e.point.x, -e.point.z])
      }}
    >
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial color={night ? NIGHT.ground : GROUND} />
    </mesh>
  )
}

function Streets({ city, night, mode }) {
  const color = mode === 'architecture' ? '#ffb04a' : NIGHT.street
  const opacity = mode === 'forest' ? 0.4 : mode === 'pollution' ? 0.35 : 0.75
  const geometry = useMemo(() => {
    const pos = []
    for (const e of city.edges) {
      for (let i = 1; i < e.pts.length; i++) {
        pos.push(...v3(...e.pts[i - 1], 2), ...v3(...e.pts[i], 2))
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    return g
  }, [city])
  return (
    <lineSegments geometry={geometry} renderOrder={5}>
      {night ? (
        <lineBasicMaterial key="night" color={color} transparent opacity={opacity} blending={THREE.AdditiveBlending} depthWrite={false} />
      ) : (
        <lineBasicMaterial key="day" color={STREET} transparent opacity={0.8} />
      )}
    </lineSegments>
  )
}

// All buildings in one merged mesh, so orbiting stays smooth. The plain map uses flat roofs; the
// Weimar 2077 view uses the same footprints and heights with approximate pitched roofs.
// Each building knows which vertices are its own, so it can be recoloured when a walk reaches it.
function Buildings({ built, reach, night, mode, fogNear, fogFar }) {
  const { geometry, ranges, baseColors } = built

  const facade = useMemo(() => makeFacadeMaterial(), [])
  facade.uniforms.uFogNear.value = fogNear
  facade.uniforms.uFogFar.value = fogFar
  facade.uniforms.uFogColor.value.set(mode === 'pollution' ? SMOG_FOG : NIGHT.fog)
  facade.uniforms.uDensityOn.value = mode === 'density' ? 1 : 0
  facade.uniforms.uDim.value = mode === 'forest' ? 1 : mode === 'pollution' ? 0.6 : 0 // the smog swallows the lights
  facade.uniforms.uDetail.value = mode === 'architecture' ? 1 : 0
  useFrame((state) => {
    facade.uniforms.uTime.value = state.clock.elapsedTime
  })

  useEffect(() => {
    const colors = geometry.getAttribute('color')
    colors.array.set(baseColors)
    if (reach?.levels) {
      // Paint from the largest area to the smallest, so each building ends in the shade of the smallest area it touches
      const shade = new THREE.Color()
      for (let l = reach.levels.length - 1; l >= 0; l--) {
        shade.set(REACH_COLORS[l])
        for (const i of reach.levels[l].buildings) {
          const [start, count] = ranges[i]
          for (let k = start; k < start + count; k++) shade.toArray(colors.array, k * 3)
        }
      }
    }
    colors.needsUpdate = true
  }, [geometry, ranges, baseColors, reach])

  return (
    // A click on a building is not a click on the ground: stop it here
    <mesh geometry={geometry} onClick={(e) => e.stopPropagation()}>
      {night ? <primitive key="night" object={facade} attach="material" /> : <meshLambertMaterial key="day" vertexColors />}
    </mesh>
  )
}

// The three areas on the ground, largest first so the smaller ones lie on top
// At night they glow half-transparent over the dark ground, so the buildings stay readable
function ReachAreas({ reach, night }) {
  const layers = useMemo(() => {
    if (!reach?.levels) return []
    return reach.levels.map((level) => {
      const shapes = level.polygons.map(({ outer, holes }) => {
        const shape = new THREE.Shape(outer.map(([x, y]) => new THREE.Vector2(x, y)))
        shape.holes = holes.map((h) => new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))))
        return shape
      })
      const g = new THREE.ShapeGeometry(shapes)
      g.rotateX(-Math.PI / 2) // lay it flat: shape y (north) becomes -z
      return g
    })
  }, [reach])

  useEffect(() => () => layers.forEach((g) => g.dispose()), [layers])

  // Smallest area first, each a little above the next larger one, all writing depth: a larger area cannot paint
  // over a smaller one, so every spot shows exactly one shade, even when the areas are see-through.
  return layers.map((g, l) => (
    <mesh key={l} geometry={g} position={[0, 0.2 + 0.6 * (2 - l), 0]} renderOrder={2 + l}>
      <meshBasicMaterial
        color={REACH_COLORS[l]}
        transparent
        opacity={night ? 0.85 : 1}
        depthWrite
        polygonOffset
        polygonOffsetFactor={-2}
        polygonOffsetUnits={-4}
      />
    </mesh>
  ))
}

function StartMarker({ reach, night }) {
  const ink = night ? NIGHT.marker : '#3b2a30'
  if (!reach) return null
  const [px, py] = reach.point
  return (
    <group>
      {/* where you clicked */}
      <mesh position={v3(px, py, 1)}>
        <sphereGeometry args={[4, 16, 12]} />
        <meshBasicMaterial color={reach.error ? '#6b6b6b' : ink} />
      </mesh>
      {reach.start && (
        // the street node where the walk starts
        <mesh position={v3(reach.start.x, reach.start.y, 20)}>
          <cylinderGeometry args={[2.5, 2.5, 40, 12]} />
          <meshBasicMaterial color={ink} />
        </mesh>
      )}
    </group>
  )
}

// Where the camera should fly: to the chosen landmark, so its ghost can be seen rising, or in Forest
// mode close to a green area, so the trees can be seen. null: stay where you are.
function focusOf(landmark, forest) {
  if (landmark) {
    const top = Math.max(landmark.h, 2)
    return { key: landmark.id, x: landmark.x, y: landmark.y, h: top + 28, d: 240 }
  }
  if (forest) return { key: `${forest.x},${forest.y}`, x: forest.x, y: forest.y, h: 0, d: THREE.MathUtils.clamp(forest.size * 0.5, 110, 300) }
  return null
}

// Flies the camera smoothly to the focus, and back to where you were when the focus goes away.
// You can orbit and zoom as usual once it has landed.
function CameraDirector({ focus }) {
  const controls = useThree((s) => s.controls)
  const camera = useThree((s) => s.camera)
  const flight = useRef(null)
  const back = useRef(null) // the view before the first flight
  const key = focus?.key ?? null
  useEffect(() => {
    if (!controls) return
    let to
    if (focus) {
      if (!back.current) back.current = { position: camera.position.clone(), target: controls.target.clone() }
      const t = new THREE.Vector3(focus.x, focus.h, -focus.y)
      to = { target: t, position: t.clone().add(new THREE.Vector3(focus.d * 0.35, focus.d * 0.42, focus.d * 0.85)) }
    } else if (back.current) {
      to = back.current
      back.current = null
    } else return
    flight.current = { from: { position: camera.position.clone(), target: controls.target.clone() }, to, t: 0 }
  }, [key, controls]) // eslint-disable-line react-hooks/exhaustive-deps
  useFrame((_, delta) => {
    const f = flight.current
    if (!f || !controls) return
    f.t = Math.min(1, f.t + delta / 2.8)
    const e = f.t < 0.5 ? 4 * f.t ** 3 : 1 - (-2 * f.t + 2) ** 3 / 2 // gentle start and landing
    camera.position.lerpVectors(f.from.position, f.to.position, e)
    controls.target.lerpVectors(f.from.target, f.to.target, e)
    controls.update()
    if (f.t >= 1) flight.current = null
  })
  return null
}

// 2077: a shock wave rings out from the start, again and again, as the supersonic pod leaves
function SonicBoom({ reach }) {
  const ring = useRef()
  const material = useRef()
  const reachM = reach.levels[reach.levels.length - 1].budget
  useFrame((state) => {
    const t = (state.clock.elapsedTime % 2.4) / 2.4
    const r = 10 + t * Math.min(reachM, 900)
    ring.current.scale.set(r, r, r)
    material.current.opacity = 0.8 * (1 - t)
  })
  if (!reach.start) return null
  return (
    <mesh ref={ring} position={v3(reach.start.x, reach.start.y, 6)} rotation={[-Math.PI / 2, 0, 0]} renderOrder={10}>
      <ringGeometry args={[0.97, 1, 96]} />
      <meshBasicMaterial ref={material} color="#fcee0a" transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </mesh>
  )
}
