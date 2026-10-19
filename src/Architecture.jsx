// Architecture mode: Weimar's real buildings, read through light. Warm lines trace every roof (eaves,
// ridges and hips of the approximate pitched roofs), and each landmark building in the kit gets a
// holographic shell with scan lines sweeping up its real footprint and height.
// Decoration only: no clicks, no effect on any calculation.

import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

function useDispose(...objects) {
  useEffect(() => () => objects.forEach((o) => o?.dispose()), objects) // eslint-disable-line react-hooks/exhaustive-deps
}

export default function Architecture({ city, landmarks, roofLines }) {
  return (
    <group>
      <Rooflines roofLines={roofLines} />
      <LandmarkShells city={city} landmarks={landmarks} />
    </group>
  )
}

function Rooflines({ roofLines }) {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(roofLines, 3))
    return g
  }, [roofLines])
  useDispose(geometry)
  return (
    <lineSegments geometry={geometry} renderOrder={10}>
      <lineBasicMaterial color="#ffc86b" transparent opacity={0.55} depthWrite={false} blending={THREE.AdditiveBlending} />
    </lineSegments>
  )
}

function LandmarkShells({ city, landmarks }) {
  const { geometry, edges } = useMemo(() => {
    const shapes = []
    const heights = []
    for (const l of landmarks) {
      if (l.building < 0) continue
      const ring = city.buildings[l.building].rings[0]
      shapes.push(new THREE.Shape(ring.map(([x, y]) => new THREE.Vector2(x, y))))
      heights.push(city.buildings[l.building].height + 1.5)
    }
    const parts = shapes.map((s, i) => {
      const g = new THREE.ExtrudeGeometry(s, { depth: heights[i], bevelEnabled: false })
      g.rotateX(-Math.PI / 2)
      return g
    })
    // merge by hand, keeping height above ground for the scan shader
    const pos = []
    for (const g of parts) {
      const ng = g.index ? g.toNonIndexed() : g
      pos.push(...ng.getAttribute('position').array)
      g.dispose()
      if (ng !== g) ng.dispose()
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    const edges = new THREE.EdgesGeometry(geometry, 30)
    return { geometry, edges }
  }, [city, landmarks])

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 } },
        vertexShader: /* glsl */ `
          varying float vY;
          void main() {
            vY = position.y;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          uniform float uTime;
          varying float vY;
          void main() {
            float lines = step(0.85, fract(vY / 1.4));
            float sweep = smoothstep(2.0, 0.0, abs(fract(uTime * 0.12) * 40.0 - vY));
            vec3 c = vec3(0.0, 0.9, 1.0);
            gl_FragColor = vec4(c, 0.05 + 0.18 * lines + 0.6 * sweep);
            gl_FragColor.rgb = pow(max(gl_FragColor.rgb, 0.0), vec3(2.2));
            #include <colorspace_fragment>
          }`,
      }),
    [],
  )
  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.elapsedTime
  })
  useDispose(geometry, edges, material)
  return (
    <group>
      <mesh geometry={geometry} material={material} renderOrder={11} />
      <lineSegments geometry={edges} renderOrder={11}>
        <lineBasicMaterial color="#8ff8ff" transparent opacity={0.9} depthWrite={false} blending={THREE.AdditiveBlending} />
      </lineSegments>
    </group>
  )
}
