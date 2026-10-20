// Pollution mode, imagined for 2077: smog hangs over the dense parts of town. Its thickness follows
// the building density of the kit, blurred over about 100 m (scenery.js), so the busiest blocks
// disappear in a brown-grey fog while the parks stay clearer. Exhaust rises from the roofs of the
// densest blocks. It is a picture, not a measurement of the air.
// Decoration only: no clicks, no effect on any calculation.

import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { makeRandom } from './scenery.js'

export const SMOG_RAMP = ['rgba(150, 140, 110, 0.1)', '#8f8462', '#6e6146', '#4a3f2c']
export const SMOG_FOG = '#2b261c' // the air of the whole scene in Pollution mode

const LAYERS = [3, 9, 16, 25, 36, 50, 68] // heights of the smog slices, in metres

function useDispose(...objects) {
  useEffect(() => () => objects.forEach((o) => o?.dispose()), objects) // eslint-disable-line react-hooks/exhaustive-deps
}

export default function Pollution({ scenery }) {
  return (
    <group>
      <SmogLayers scenery={scenery} />
      <SmogPuffs scenery={scenery} />
    </group>
  )
}

// Flat slices of smog stacked over the town: each reads the smog map, so together they look like a
// fog that is thick and high over dense blocks and thin and low elsewhere
function SmogLayers({ scenery }) {
  const { x0, y0, nx, ny, CELL } = scenery.grid
  const texture = useMemo(() => {
    const data = new Uint8Array(nx * ny * 4)
    scenery.smogGrid.forEach((v, k) => {
      data[k * 4] = Math.round(v * 255)
      data[k * 4 + 3] = 255
    })
    const t = new THREE.DataTexture(data, nx, ny, THREE.RGBAFormat)
    t.magFilter = THREE.LinearFilter
    t.minFilter = THREE.LinearFilter
    t.needsUpdate = true
    return t
  }, [scenery, nx, ny])
  const w = nx * CELL
  const h = ny * CELL
  const geometry = useMemo(() => new THREE.PlaneGeometry(w + 600, h + 600).rotateX(-Math.PI / 2), [w, h])
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        uniforms: {
          uTime: { value: 0 },
          uSmog: { value: texture },
          uOrigin: { value: new THREE.Vector2(x0, y0) },
          uSize: { value: new THREE.Vector2(w, h) },
        },
        vertexShader: /* glsl */ `
          varying vec2 vM;
          varying float vH;
          void main() {
            vec4 w = modelMatrix * vec4(position, 1.0);
            vM = vec2(w.x, -w.z);
            vH = w.y;
            gl_Position = projectionMatrix * viewMatrix * w;
          }`,
        fragmentShader: /* glsl */ `
          uniform float uTime;
          uniform sampler2D uSmog;
          uniform vec2 uOrigin, uSize;
          varying vec2 vM;
          varying float vH;
          void main() {
            vec2 uv = (vM - uOrigin) / uSize;
            float s = texture2D(uSmog, clamp(uv, 0.0, 1.0)).r;
            // outside the kit the smog fades out
            float edge = smoothstep(-0.08, 0.0, uv.x) * smoothstep(1.08, 1.0, uv.x) * smoothstep(-0.08, 0.0, uv.y) * smoothstep(1.08, 1.0, uv.y);
            s *= edge;
            // dense blocks: thick and high; sparse ones: a thin haze near the ground
            float top = 6.0 + 70.0 * s;
            float body = smoothstep(top, top * 0.4, vH);
            // slow drifting billows
            float n = sin(vM.x * 0.021 + uTime * 0.09 + vH * 0.05) * sin(vM.y * 0.018 - uTime * 0.07)
                    + 0.6 * sin((vM.x - vM.y) * 0.043 + uTime * 0.13 + vH * 0.11);
            float a = (0.04 + 0.30 * pow(s, 1.4)) * body * (0.65 + 0.35 * n);
            vec3 col = mix(vec3(0.45, 0.43, 0.38), vec3(0.42, 0.34, 0.18), s);
            gl_FragColor = vec4(col, clamp(a, 0.0, 0.5));
            gl_FragColor.rgb = pow(max(gl_FragColor.rgb, 0.0), vec3(2.2));
            #include <colorspace_fragment>
          }`,
      }),
    [texture, x0, y0, w, h],
  )
  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.elapsedTime
  })
  useDispose(geometry, material, texture)
  return (
    <group position={[x0 + w / 2, 0, -(y0 + h / 2)]}>
      {LAYERS.map((y, i) => (
        <mesh key={i} geometry={geometry} material={material} position={[0, y, 0]} renderOrder={11} />
      ))}
    </group>
  )
}

// Soft billboards of smog drifting over the densest cells, and exhaust plumes rising from the roofs
// of the densest blocks
function SmogPuffs({ scenery }) {
  const geometry = useMemo(() => {
    const random = makeRandom(1952)
    const centre = []
    const size = []
    const seed = []
    const rise = []
    const { x0, y0, nx, CELL } = scenery.grid
    scenery.smogGrid.forEach((s, k) => {
      const n = Math.round(Math.pow(s, 1.5) * 6)
      const cx = x0 + ((k % nx) + 0.5) * CELL
      const cy = y0 + (Math.floor(k / nx) + 0.5) * CELL
      for (let i = 0; i < n; i++) {
        centre.push(cx + (random() - 0.5) * CELL, 10 + random() * 50 * s, -(cy + (random() - 0.5) * CELL))
        size.push(40 + random() * 60 * s)
        seed.push(random())
        rise.push(0)
      }
    })
    // exhaust from the roofs of the 60 tallest buildings in dense blocks
    const roofs = [...scenery.roofs].filter((r) => r.density > 0.6).sort((a, b) => b.h - a.h).slice(0, 60)
    for (const r of roofs) {
      for (let i = 0; i < 3; i++) {
        centre.push(r.x, r.h + 1, -r.y)
        size.push(10 + random() * 8)
        seed.push(random())
        rise.push(1)
      }
    }
    const plane = new THREE.PlaneGeometry(1, 1)
    const g = new THREE.InstancedBufferGeometry()
    g.index = plane.index
    g.setAttribute('position', plane.getAttribute('position'))
    g.setAttribute('uv', plane.getAttribute('uv'))
    g.setAttribute('aCentre', new THREE.InstancedBufferAttribute(new Float32Array(centre), 3))
    g.setAttribute('aSize', new THREE.InstancedBufferAttribute(new Float32Array(size), 1))
    g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(new Float32Array(seed), 1))
    g.setAttribute('aRise', new THREE.InstancedBufferAttribute(new Float32Array(rise), 1))
    g.instanceCount = seed.length
    return g
  }, [scenery])
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { uTime: { value: 0 } },
        vertexShader: /* glsl */ `
          uniform float uTime;
          attribute vec3 aCentre;
          attribute float aSize, aSeed, aRise;
          varying vec2 vUv;
          varying float vA;
          varying float vSeed;
          void main() {
            vUv = uv;
            vSeed = aSeed;
            vec3 c = aCentre;
            float size = aSize;
            if (aRise > 0.5) {
              // a plume: rise about 60 m, grow and fade, then start again
              float t = fract(uTime * 0.08 + aSeed);
              c.y += t * 60.0;
              c.x += t * 25.0 + sin(uTime * 0.5 + aSeed * 9.0) * 3.0;
              size *= 0.6 + 2.4 * t;
              vA = 0.55 * smoothstep(0.0, 0.1, t) * (1.0 - t);
            } else {
              c.x += sin(uTime * 0.05 + aSeed * 40.0) * 20.0;
              c.z += cos(uTime * 0.04 + aSeed * 30.0) * 20.0;
              vA = 0.22;
            }
            vec4 mv = modelViewMatrix * vec4(c, 1.0);
            mv.xy += position.xy * size;
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          varying vec2 vUv;
          varying float vA;
          varying float vSeed;
          void main() {
            vec2 p = vUv - 0.5;
            float d = length(p) * 2.0;
            float lumpy = 0.85 + 0.15 * sin(atan(p.y, p.x) * 5.0 + vSeed * 20.0);
            float a = vA * smoothstep(1.0 * lumpy, 0.2, d);
            if (a < 0.003) discard;
            vec3 col = mix(vec3(0.40, 0.36, 0.28), vec3(0.30, 0.28, 0.25), vSeed);
            gl_FragColor = vec4(col, a);
            gl_FragColor.rgb = pow(max(gl_FragColor.rgb, 0.0), vec3(2.2));
            #include <colorspace_fragment>
          }`,
      }),
    [],
  )
  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.elapsedTime
  })
  useDispose(geometry, material)
  return <mesh geometry={geometry} material={material} frustumCulled={false} renderOrder={12} />
}
