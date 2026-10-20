import { useCallback, useEffect, useRef, useState } from 'react'

// A landmark's guide speaks as a ghost rising from its building (Ghost.jsx); this file holds the
// narration and the subtitles at the bottom of the screen. The guide speaks through the browser's own
// speech synthesis, one sentence at a time, with the sentence as a subtitle. While it speaks, the
// ambient sound is ducked; a new narration always cancels the old one, so voices never overlap. When
// sound is muted (or the browser has no voice), the subtitles run on their own.

const FEMALE = /female|zira|susan|hazel|libby|sonia|samantha|jenny|aria|karen|moira|tessa|serena|victoria|fiona|emma|amy/i
const MALE = /\bmale\b|david|george|ryan|guy|mark|daniel|alex|thomas|james|oliver|arthur|fred|richard/i

function pickVoice(kind) {
  const voices = window.speechSynthesis?.getVoices() || []
  const english = voices.filter((v) => v.lang?.toLowerCase().startsWith('en'))
  // voices built into the computer are more reliable than online ones, which often fall silent
  const local = english.filter((v) => v.localService)
  const pool = local.length ? local : english.length ? english : voices
  const want = kind === 'female' ? FEMALE : MALE
  const notWant = kind === 'female' ? MALE : FEMALE
  const fits = (v) => want.test(v.name) && !notWant.test(v.name)
  return pool.find((v) => fits(v) && /en-gb/i.test(v.lang)) || pool.find(fits) || pool.find((v) => /en-gb/i.test(v.lang)) || pool[0] || null
}

// Some browsers load their voices a moment after the page; wait for them, but never long
function voicesReady(synth) {
  if (synth.getVoices().length) return Promise.resolve()
  return new Promise((resolve) => {
    const done = () => {
      synth.removeEventListener?.('voiceschanged', done)
      resolve()
    }
    synth.addEventListener?.('voiceschanged', done)
    setTimeout(done, 1200)
  })
}

// how long a sentence takes to say, roughly, in milliseconds
const sayTime = (text) => 900 + text.split(' ').length * 330

// voice: a ref the ghost reads every frame ({ mouth, speaking }), so the mouth moves without
// re-drawing the whole page
export function useNarration(landmark, engine, muted, volume, voice) {
  const [line, setLine] = useState(0)
  const [speaking, setSpeaking] = useState(false)
  const timers = useRef([])
  const run = useRef(0) // each narration has its own number, so stale callbacks are ignored
  const spike = useRef(0)
  const current = useRef(null) // the sentence being spoken: kept here, or the browser may drop it halfway

  const stop = useCallback(() => {
    run.current++
    timers.current.forEach(clearTimeout)
    timers.current = []
    current.current = null
    window.speechSynthesis?.cancel()
    setSpeaking(false)
    engine.duck(false)
  }, [engine])

  const narrate = useCallback(
    (from = 0) => {
      stop()
      if (!landmark) return
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
      const canSpeak = !muted && synth && typeof window.SpeechSynthesisUtterance === 'function'
      const later = (fn, ms) => timers.current.push(setTimeout(() => run.current === id && fn(), ms))

      // One sentence at a time: the next starts only when this one has ended. If the browser stays
      // silent or gets stuck, a safety timer moves on, so the guide never freezes mid-story.
      const say = (i) => {
        if (run.current !== id) return
        if (i >= lines.length) return done()
        setLine(i)
        const text = lines[i]
        if (!canSpeak) return later(() => say(i + 1), sayTime(text))
        let finished = false
        const next = () => {
          if (finished || run.current !== id) return
          finished = true
          later(() => say(i + 1), 250)
        }
        const v = pickVoice(landmark.guide.voice)
        const u = new window.SpeechSynthesisUtterance(text)
        if (v) u.voice = v
        u.lang = v?.lang || 'en-GB'
        u.rate = 0.95
        u.pitch = landmark.guide.voice === 'female' ? 1.1 : landmark.guide.look === 'ai' ? 1.2 : 0.88
        u.volume = volume
        u.onboundary = () => {
          spike.current = 1
        }
        u.onend = next
        u.onerror = next
        current.current = u
        synth.resume() // a browser that paused speech in the background would otherwise stay silent
        synth.speak(u)
        later(next, sayTime(text) * 2.2 + 2500)
      }
      // a short pause after cancelling the last voice: speaking straight away is sometimes ignored
      if (canSpeak) voicesReady(synth).then(() => later(() => say(from), 150))
      else say(from)
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
    voice.current.speaking = speaking
    if (!speaking) {
      voice.current.mouth = 0
      return
    }
    let raf
    const loop = (ms) => {
      const t = ms / 1000
      spike.current *= 0.85
      const talk = 0.25 + 0.55 * Math.abs(Math.sin(t * 13 + Math.sin(t * 2.7) * 2))
      voice.current.mouth = Math.min(1, talk * (0.7 + 0.3 * Math.sin(t * 5.3)) + spike.current * 0.4)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [speaking, voice])

  return { line, speaking, narrate, stop }
}

// Subtitles at the bottom of the screen, like in a film, with small controls
export default function GhostSubtitles({ landmark, narration, muted, onClose }) {
  const { line, speaking, narrate, stop } = narration
  // Esc sends the ghost away
  useEffect(() => {
    const key = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onClose])
  const g = landmark.guide
  return (
    <div className="subtitles" aria-live="polite">
      <div className="sub-who">
        <span className="sub-name">{g.name}</span> · {landmark.name}
        {landmark.kind === 'transport' ? ' · an imagined guide' : ` · ${g.years}`}
      </div>
      <p className="sub-line">{landmark.lines[line]}</p>
      <div className="sub-bar">
        <div className="lm-progress">
          {landmark.lines.map((_, i) => (
            <span key={i} className={i === line ? 'on' : i < line ? 'past' : ''} />
          ))}
        </div>
        <button onClick={() => narrate(0)} aria-label={speaking ? 'Restart' : 'Play'}>
          {speaking ? '↺' : '▶'}
        </button>
        <button onClick={stop} disabled={!speaking} aria-label="Stop">
          ■
        </button>
        <button onClick={onClose} aria-label="Send the ghost away">
          ✕
        </button>
      </div>
      <div className="sub-note">
        {muted ? 'Sound is muted: subtitles only. ' : ''}The ghost is a stylised hologram, not a portrait.
        {landmark.kind === 'transport' ? '' : ' The text summarises documented history.'}
      </div>
    </div>
  )
}
