// Visible, clickable labels on the landmarks, and a projection beam on the selected one.
// The labels are ordinary buttons in a layer over the 3D view: a tracker inside the scene moves them
// to their landmark's position on screen every frame. Clicking a label never starts a walk.

import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

const labelHeight = (l) => Math.max(l.h, 4) + 14

// Outside the canvas: the buttons themselves
export function LandmarkLabelLayer({ landmarks, selected, onSelect, refs }) {
  return (
    <div className="lm-layer">
      {landmarks.map((l, i) => (
        <button
          key={l.id}
          ref={(el) => (refs.current[i] = el)}
          className={`lm-label ${l.kind}${selected?.id === l.id ? ' on' : ''}`}
          onClick={() => onSelect(l)}
          title={`${l.name}: ${l.guide.name}`}
        >
          <span className="dot" />
          {l.name}
        </button>
      ))}
    </div>
  )
}

// Inside the canvas: keeps each button on its landmark, and hides it when the landmark is behind the camera
export function LandmarkTracker({ landmarks, refs, selected }) {
  const { camera, size } = useThree()
  const points = useMemo(() => landmarks.map((l) => new THREE.Vector3(l.x, labelHeight(l), -l.y)), [landmarks])
  const v = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    points.forEach((p, i) => {
      const el = refs.current[i]
      if (!el) return
      v.copy(p).project(camera)
      const visible = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1
      el.style.display = visible ? '' : 'none'
      if (!visible) return
      const x = ((v.x + 1) / 2) * size.width
      const y = ((1 - v.y) / 2) * size.height
      el.style.transform = `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`
      el.style.zIndex = String(Math.round((1 - v.z) * 1000))
    })
  })
  return selected ? <Beam landmark={selected} /> : null
}

// A column of light from the selected landmark, with rings rising through it
function Beam({ landmark }) {
  const rings = useRef()
  const geometry = useMemo(() => new THREE.CylinderGeometry(5, 9, 140, 24, 1, true).translate(0, 70, 0), [])
  const ring = useMemo(() => new THREE.TorusGeometry(10, 0.25, 6, 48).rotateX(Math.PI / 2), [])
  useFrame((state) => {
    const t = state.clock.elapsedTime
    rings.current.children.forEach((r, i) => {
      const f = (t * 0.25 + i / 3) % 1
      r.position.y = f * 120
      r.material.opacity = 0.8 * (1 - f)
      r.scale.setScalar(1 - f * 0.4)
    })
  })
  const h = Math.max(landmark.h, 2)
  return (
    <group position={[landmark.x, h, -landmark.y]}>
      <mesh geometry={geometry} renderOrder={12}>
        <meshBasicMaterial color="#00e5ff" transparent opacity={0.12} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <group ref={rings}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} geometry={ring} renderOrder={12}>
            <meshBasicMaterial color="#fcee0a" transparent opacity={0.8} depthWrite={false} blending={THREE.AdditiveBlending} />
          </mesh>
        ))}
      </group>
    </group>
  )
}
