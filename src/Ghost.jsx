// The guide of the selected landmark, as a ghost: a pale, see-through hologram that rises out of the
// landmark's roof, floats above it and fades into a wisp at the bottom. It lives in the 3D map, so it
// stays on its building when you orbit and grows smaller when you zoom out. It takes no clicks.

import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import Hologram from './Hologram.jsx'

export default function Ghost({ landmark, voice }) {
  const [mouth, setMouth] = useState(0)
  const [speaking, setSpeaking] = useState(false)
  const last = useRef(0)
  // follow the voice, but only re-draw when the mouth has really moved
  useFrame(() => {
    const v = voice.current
    if (Math.abs(v.mouth - last.current) > 0.04) {
      last.current = v.mouth
      setMouth(v.mouth)
    }
    if (v.speaking !== speaking) setSpeaking(v.speaking)
  })
  const roof = Math.max(landmark.h, 2) + 1
  return (
    <Html position={[landmark.x, roof, -landmark.y]} distanceFactor={160} zIndexRange={[4, 0]} style={{ pointerEvents: 'none' }}>
      {/* the key starts the rise again when another landmark is chosen */}
      <div className="ghost" key={landmark.id}>
        <div className="ghost-rise">
          <div className="ghost-float">
            <Hologram look={landmark.guide.look} mouth={mouth} speaking={speaking} ghost />
          </div>
        </div>
      </div>
    </Html>
  )
}
