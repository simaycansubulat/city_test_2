import { useCallback, useEffect, useRef, useState } from 'react'
import Hologram from './Hologram.jsx'

// The information panel of a landmark, with its holographic guide. The guide speaks through the
// browser's own speech synthesis, one sentence at a time, with the sentence as a caption. While it
// speaks, the ambient sound is ducked; a new narration always cancels the old one, so voices never
// overlap. When sound is muted (or the browser has no voice), the captions run on their own.

const FEMALE = /female|zira|susan|hazel|libby|sonia|samantha|jenny|aria|karen|moira|tessa|serena|victoria|fiona|emma|amy/i
const MALE = /\bmale\b|david|george|ryan|guy|mark|daniel|alex|thomas|james|oliver|arthur|fred|richard/i

function pickVoice(kind) {
  const voices = window.speechSynthesis?.getVoices() || []
  const english = voices.filter((v) => v.lang?.toLowerCase().startsWith('en'))
  const pool = english.length ? english : voices
  const want = kind === 'female' ? FEMALE : MALE
  const notWant = kind === 'female' ? MALE : FEMALE
  const fits = (v) => want.test(v.name) && !notWant.test(v.name)
  return pool.find((v) => fits(v) && /en-gb/i.test(v.lang)) || pool.find(fits) || pool.find((v) => /en-gb/i.test(v.lang)) || pool[0] || null
}

export default function LandmarkPanel({ landmark, engine, muted, volume, onClose }) {
  const [line, setLine] = useState(0)
  const [speaking, setSpeaking] = useState(false)
  const [mouth, setMouth] = useState(0)
  const timers = useRef([])
  const run = useRef(0) // each narration has its own number, so stale callbacks are ignored
  const spike = useRef(0)

  const stop = useCallback(() => {
    run.current++
    timers.current.forEach(clearTimeout)
    timers.current = []
    window.speechSynthesis?.cancel()
    setSpeaking(false)
    engine.duck(false)
  }, [engine])

  const narrate = useCallback(
    (from = 0) => {
      stop()
      const id = ++run.current
      const lines = landmark.lines
      const done = () => {
        if (run.current !== id) return
        setSpeaking(false)
        engine.duck(false)
      }
      setLine(from)
      setSpeaking(true)
      engine.duck(true)
      const synth = window.speechSynthesis
      if (!muted && synth && typeof window.SpeechSynthesisUtterance === 'function') {
        const voice = pickVoice(landmark.guide.voice)
        lines.slice(from).forEach((text, k) => {
          const i = from + k
          const u = new window.SpeechSynthesisUtterance(text)
          if (voice) u.voice = voice
          u.lang = voice?.lang || 'en-GB'
          u.rate = 0.95
          u.pitch = landmark.guide.voice === 'female' ? 1.1 : landmark.guide.look === 'ai' ? 1.2 : 0.88
          u.volume = volume
          u.onstart = () => run.current === id && setLine(i)
          u.onboundary = () => {
            spike.current = 1
          }
          u.onend = () => i === lines.length - 1 && done()
          u.onerror = () => i === lines.length - 1 && done()
          synth.speak(u)
        })
      } else {
        // captions only: show each sentence for about as long as it would take to say it
        let t = 0
        lines.slice(from).forEach((text, k) => {
          timers.current.push(setTimeout(() => run.current === id && setLine(from + k), t))
          t += 900 + text.split(' ').length * 330
        })
        timers.current.push(setTimeout(done, t))
      }
    },
    [landmark, engine, muted, volume, stop],
  )

  // speak as soon as a landmark is opened; stop when it closes or changes
  useEffect(() => {
    narrate(0)
    return stop
  }, [landmark]) // eslint-disable-line react-hooks/exhaustive-deps

  // muting mid-sentence: carry on from the current sentence in the new way
  const lineRef = useRef(line)
  lineRef.current = line
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    if (speaking) narrate(lineRef.current)
  }, [muted]) // eslint-disable-line react-hooks/exhaustive-deps

  // the mouth follows the voice: a talking rhythm, with a jump at every word the browser reports
  useEffect(() => {
    if (!speaking) {
      setMouth(0)
      return
    }
    let raf
    const loop = (ms) => {
      const t = ms / 1000
      spike.current *= 0.85
      const talk = 0.25 + 0.55 * Math.abs(Math.sin(t * 13 + Math.sin(t * 2.7) * 2))
      setMouth(Math.min(1, talk * (0.7 + 0.3 * Math.sin(t * 5.3)) + spike.current * 0.4))
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [speaking])

  const g = landmark.guide
  return (
    <aside className="landmark" aria-live="polite">
      <header>
        <div>
          <div className="lm-kind">{landmark.kind === 'transport' ? 'Transport' : 'Landmark'} · {landmark.place}</div>
          <h2 className="lm-name">{landmark.name}</h2>
        </div>
        <button className="icon" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </header>
      <div className="lm-body">
        <div className="lm-holo">
          <Hologram look={g.look} mouth={mouth} speaking={speaking} />
        </div>
        <div className="lm-guide">
          <strong>{g.name}</strong>
          <span>{g.years}</span>
          <span>{g.role}</span>
        </div>
      </div>
      <p className="caption">{landmark.lines[line]}</p>
      <div className="lm-progress">
        {landmark.lines.map((_, i) => (
          <span key={i} className={i === line ? 'on' : i < line ? 'past' : ''} />
        ))}
      </div>
      <div className="lm-controls">
        <button onClick={() => narrate(0)}>{speaking ? '↺ Restart' : '▶ Play'}</button>
        <button onClick={stop} disabled={!speaking}>
          ■ Stop
        </button>
        <span className="lm-note">{muted ? 'Sound is muted: captions only.' : "Voice: your browser's speech synthesis."}</span>
      </div>
      <p className="lm-small">
        {landmark.kind === 'transport'
          ? 'An imagined guide for the 2077 view.'
          : 'The guide is a stylised hologram, not a portrait. The text summarises documented history.'}
      </p>
    </aside>
  )
}
