// Generated ambient sound for the five modes, made live with the Web Audio API: no audio files.
// The engine starts only after a click (browsers block sound before that), crossfades smoothly
// between modes, has a master volume and mute, and ducks the ambience while a guide is speaking.

const FADE = 1.6 // seconds for a crossfade between modes
const DUCKED = 0.12 // ambience level while narration plays

function noiseBuffer(ctx, seconds = 3) {
  const b = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate)
  const d = b.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  return b
}

const rand = (a, b) => a + Math.random() * (b - a)

// One mode's soundscape: continuous layers plus a scheduler for events
class Scape {
  constructor(engine) {
    this.engine = engine
    this.ctx = engine.ctx
    this.out = this.ctx.createGain()
    this.out.gain.value = 0
    this.out.connect(engine.ambient)
    this.nodes = []
    this.timers = []
    this.alive = true
  }
  keep(...n) {
    this.nodes.push(...n)
    return n[0]
  }
  noise(loop = true) {
    const s = this.ctx.createBufferSource()
    s.buffer = this.engine.noise
    s.loop = loop
    return s
  }
  // call fn now and again after a random wait, while the scape is alive
  every(minS, maxS, fn) {
    const tick = () => {
      if (!this.alive) return
      fn(this.ctx.currentTime + 0.05)
      this.timers.push(setTimeout(tick, rand(minS, maxS) * 1000))
    }
    this.timers.push(setTimeout(tick, rand(0, maxS) * 1000))
  }
  // a short enveloped tone into a panner
  tone({ t, freq, to, dur, type = 'sine', gain = 0.05, pan = 0, attack = 0.01, dest }) {
    const o = this.ctx.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(freq, t)
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur)
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(gain, t + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    const p = this.ctx.createStereoPanner()
    p.pan.value = pan
    o.connect(g).connect(p).connect(dest || this.out)
    o.start(t)
    o.stop(t + dur + 0.05)
  }
  fadeIn() {
    const g = this.out.gain
    const t = this.ctx.currentTime
    g.cancelScheduledValues(t)
    g.setValueAtTime(g.value, t)
    g.linearRampToValueAtTime(1, t + FADE)
  }
  stop() {
    this.alive = false
    this.timers.forEach(clearTimeout)
    const g = this.out.gain
    const t = this.ctx.currentTime
    g.cancelScheduledValues(t)
    g.setValueAtTime(g.value, t)
    g.linearRampToValueAtTime(0, t + FADE)
    setTimeout(() => {
      this.nodes.forEach((n) => {
        try {
          n.stop?.()
        } catch {
          /* already stopped */
        }
        n.disconnect?.()
      })
      this.out.disconnect()
    }, (FADE + 0.2) * 1000)
  }
}

// Density: a chaotic digital soundscape. A low electric drone, crunchy blips, stuttering bursts of
// static and fast arpeggios of data, all crowding each other.
function density(s) {
  const { ctx } = s
  // drone
  const lp = s.keep(ctx.createBiquadFilter())
  lp.type = 'lowpass'
  lp.frequency.value = 380
  const dg = s.keep(ctx.createGain())
  dg.gain.value = 0.09
  lp.connect(dg).connect(s.out)
  for (const f of [55, 55.6, 110.3]) {
    const o = s.keep(ctx.createOscillator())
    o.type = 'sawtooth'
    o.frequency.value = f
    o.connect(lp)
    o.start()
  }
  // crunch: a bit-crusher made of a stepped wave shaper
  const crush = s.keep(ctx.createWaveShaper())
  const curve = new Float32Array(256)
  for (let i = 0; i < 256; i++) curve[i] = Math.round(((i / 255) * 2 - 1) * 4) / 4
  crush.curve = curve
  crush.connect(s.out)
  s.every(0.04, 0.22, (t) => {
    s.tone({ t, freq: rand(180, 3200), to: Math.random() > 0.5 ? rand(150, 4000) : undefined, dur: rand(0.03, 0.09), type: 'square', gain: 0.035, pan: rand(-1, 1), dest: crush })
  })
  // stuttering static bursts
  s.every(0.6, 2.2, (t) => {
    const n = s.noise(false)
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = rand(600, 6000)
    bp.Q.value = 3
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    const steps = Math.floor(rand(4, 12))
    for (let k = 0; k < steps; k++) {
      g.gain.setValueAtTime(k % 2 ? 0 : 0.12, t + k * 0.035)
    }
    g.gain.setValueAtTime(0, t + steps * 0.035)
    const p = ctx.createStereoPanner()
    p.pan.value = rand(-0.8, 0.8)
    n.connect(bp).connect(g).connect(p).connect(s.out)
    n.start(t, rand(0, 2))
    n.stop(t + steps * 0.035 + 0.05)
  })
  // data arpeggios
  s.every(1.5, 4, (t) => {
    const base = rand(400, 900)
    for (let k = 0; k < 8; k++) s.tone({ t: t + k * 0.05, freq: base * [1, 1.5, 2, 3][k % 4], dur: 0.05, type: 'triangle', gain: 0.025, pan: rand(-0.5, 0.5) })
  })
}

// Transportation: propulsion hum, vehicles whooshing past with a Doppler drop, and station chimes
function transport(s) {
  const { ctx } = s
  const lp = s.keep(ctx.createBiquadFilter())
  lp.type = 'lowpass'
  lp.frequency.value = 260
  const lfo = s.keep(ctx.createOscillator())
  lfo.frequency.value = 0.18
  const lfoGain = s.keep(ctx.createGain())
  lfoGain.gain.value = 120
  lfo.connect(lfoGain).connect(lp.frequency)
  lfo.start()
  const hg = s.keep(ctx.createGain())
  hg.gain.value = 0.08
  lp.connect(hg).connect(s.out)
  for (const f of [62, 124.5]) {
    const o = s.keep(ctx.createOscillator())
    o.type = 'sawtooth'
    o.frequency.value = f
    o.connect(lp)
    o.start()
  }
  // pass-bys: filtered noise sweeping up and down, moving across the stereo field, with a falling tone
  s.every(0.9, 3.2, (t) => {
    const dur = rand(0.9, 1.8)
    const dir = Math.random() > 0.5 ? 1 : -1
    const n = s.noise(false)
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = 1.4
    bp.frequency.setValueAtTime(350, t)
    bp.frequency.exponentialRampToValueAtTime(rand(1800, 3200), t + dur * 0.45)
    bp.frequency.exponentialRampToValueAtTime(300, t + dur)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.22, t + dur * 0.45)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    const p = ctx.createStereoPanner()
    p.pan.setValueAtTime(-dir, t)
    p.pan.linearRampToValueAtTime(dir, t + dur)
    n.connect(bp).connect(g).connect(p).connect(s.out)
    n.start(t, rand(0, 2))
    n.stop(t + dur + 0.05)
    const f = rand(500, 900)
    s.tone({ t, freq: f * 1.12, to: f * 0.82, dur, type: 'sawtooth', gain: 0.02, pan: 0, attack: dur * 0.45 })
  })
  // station chime, like an arrival announcement
  s.every(9, 16, (t) => {
    s.tone({ t, freq: 659.3, dur: 1.2, gain: 0.05 })
    s.tone({ t: t + 0.45, freq: 523.3, dur: 1.4, gain: 0.05 })
  })
}

// Forest: a sick forest. Wind and dry rustling leaves, only a few birds, dead wood creaking, and the
// low drone of the polluted town never far away.
function forest(s) {
  const { ctx } = s
  // the town's drone, far off
  const drone = s.keep(s.noise())
  const dlp = s.keep(ctx.createBiquadFilter())
  dlp.type = 'lowpass'
  dlp.frequency.value = 120
  const dg = s.keep(ctx.createGain())
  dg.gain.value = 0.09
  drone.connect(dlp).connect(dg).connect(s.out)
  drone.start()
  // creaking of dead trunks: a slow, rough, falling tone
  s.every(5, 11, (t) => {
    const f = rand(70, 130)
    const n = Math.floor(rand(2, 5))
    for (let k = 0; k < n; k++) s.tone({ t: t + k * rand(0.12, 0.25), freq: f * rand(0.9, 1.1), to: f * 0.7, dur: rand(0.2, 0.45), type: 'sawtooth', gain: 0.025, pan: rand(-0.7, 0.7), attack: 0.06 })
  })
  // wind: low noise, its level and colour drifting slowly
  const wind = s.keep(s.noise())
  const wlp = s.keep(ctx.createBiquadFilter())
  wlp.type = 'lowpass'
  wlp.frequency.value = 450
  const wg = s.keep(ctx.createGain())
  wg.gain.value = 0.12
  const lfo = s.keep(ctx.createOscillator())
  lfo.frequency.value = 0.07
  const lg = s.keep(ctx.createGain())
  lg.gain.value = 0.07
  lfo.connect(lg).connect(wg.gain)
  const lfo2 = s.keep(ctx.createOscillator())
  lfo2.frequency.value = 0.045
  const lg2 = s.keep(ctx.createGain())
  lg2.gain.value = 220
  lfo2.connect(lg2).connect(wlp.frequency)
  wind.connect(wlp).connect(wg).connect(s.out)
  wind.start()
  lfo.start()
  lfo2.start()
  // rustling leaves: soft high noise in short gusts
  s.every(0.25, 1.4, (t) => {
    const n = s.noise(false)
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = rand(2500, 5000)
    const g = ctx.createGain()
    const dur = rand(0.3, 1.1)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(rand(0.02, 0.06), t + dur * 0.3)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    const p = ctx.createStereoPanner()
    p.pan.value = rand(-1, 1)
    n.connect(hp).connect(g).connect(p).connect(s.out)
    n.start(t, rand(0, 2))
    n.stop(t + dur + 0.05)
  })
  // birdsong: a few different calls, and not many birds left
  s.every(4, 10, (t) => {
    const pan = rand(-0.9, 0.9)
    const kind = Math.floor(Math.random() * 3)
    if (kind === 0) {
      // chirps
      const n = Math.floor(rand(3, 7))
      const f = rand(2800, 4600)
      for (let k = 0; k < n; k++) s.tone({ t: t + k * rand(0.09, 0.14), freq: f * rand(0.92, 1.08), to: f * rand(1.15, 1.4), dur: 0.07, gain: 0.04, pan })
    } else if (kind === 1) {
      // a rapid trill
      for (let k = 0; k < 14; k++) s.tone({ t: t + k * 0.035, freq: k % 2 ? 4200 : 3600, dur: 0.03, gain: 0.03, pan })
    } else {
      // a fluting, blackbird-like phrase
      let tt = t
      for (const [a, b, d] of [[1800, 2300, 0.18], [2300, 1700, 0.22], [2000, 2600, 0.15], [2600, 2100, 0.3]]) {
        s.tone({ t: tt, freq: a, to: b, dur: d, gain: 0.045, pan, attack: 0.03 })
        tt += d * 0.9
      }
    }
  })
}

// Pollution: thick air. A heavy low rumble of traffic and industry, the roar of rooftop vents, the
// hiss of exhaust, and now and then an air-quality warning.
function pollution(s) {
  const { ctx } = s
  const rumble = s.keep(s.noise())
  const rlp = s.keep(ctx.createBiquadFilter())
  rlp.type = 'lowpass'
  rlp.frequency.value = 160
  const rg = s.keep(ctx.createGain())
  rg.gain.value = 0.22
  rumble.connect(rlp).connect(rg).connect(s.out)
  rumble.start()
  // vents: a droning hum that slowly beats
  const vg = s.keep(ctx.createGain())
  vg.gain.value = 0.035
  vg.connect(s.out)
  for (const f of [49, 50.5, 98]) {
    const o = s.keep(ctx.createOscillator())
    o.type = 'sawtooth'
    o.frequency.value = f
    const lp = s.keep(ctx.createBiquadFilter())
    lp.type = 'lowpass'
    lp.frequency.value = 300
    o.connect(lp).connect(vg)
    o.start()
  }
  // exhaust: bursts of hissing noise
  s.every(1.5, 4.5, (t) => {
    const n = s.noise(false)
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = rand(700, 1600)
    bp.Q.value = 0.7
    const g = ctx.createGain()
    const dur = rand(1, 2.5)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(rand(0.04, 0.09), t + dur * 0.3)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    const p = ctx.createStereoPanner()
    p.pan.value = rand(-0.8, 0.8)
    n.connect(bp).connect(g).connect(p).connect(s.out)
    n.start(t, rand(0, 2))
    n.stop(t + dur + 0.05)
  })
  // air-quality warning: two low beeps
  s.every(10, 18, (t) => {
    s.tone({ t, freq: 440, dur: 0.25, type: 'square', gain: 0.02 })
    s.tone({ t: t + 0.35, freq: 349.2, dur: 0.4, type: 'square', gain: 0.02 })
  })
}

// Architecture: a quiet, atmospheric futuristic city. A soft pad of slow chords, a distant city hum
// and occasional glassy pings with an echo.
function architecture(s) {
  const { ctx } = s
  const lp = s.keep(ctx.createBiquadFilter())
  lp.type = 'lowpass'
  lp.frequency.value = 900
  const pad = s.keep(ctx.createGain())
  pad.gain.value = 0.05
  lp.connect(pad).connect(s.out)
  const chords = [
    [110, 164.8, 220, 261.6],
    [98, 146.8, 196, 246.9],
    [87.3, 130.8, 174.6, 220],
    [103.8, 155.6, 207.7, 261.6],
  ]
  const oscs = chords[0].flatMap((f) =>
    [-4, 4].map((cents) => {
      const o = s.keep(ctx.createOscillator())
      o.type = 'triangle'
      o.frequency.value = f
      o.detune.value = cents
      o.connect(lp)
      o.start()
      return o
    }),
  )
  let c = 0
  s.every(7, 9, (t) => {
    c = (c + 1) % chords.length
    oscs.forEach((o, i) => {
      o.frequency.setValueAtTime(o.frequency.value, t)
      o.frequency.linearRampToValueAtTime(chords[c][i >> 1], t + 3)
    })
  })
  // distant hum
  const hum = s.keep(s.noise())
  const hlp = s.keep(ctx.createBiquadFilter())
  hlp.type = 'lowpass'
  hlp.frequency.value = 180
  const hg = s.keep(ctx.createGain())
  hg.gain.value = 0.05
  hum.connect(hlp).connect(hg).connect(s.out)
  hum.start()
  // echo for the pings
  const delay = s.keep(ctx.createDelay(1))
  delay.delayTime.value = 0.42
  const fb = s.keep(ctx.createGain())
  fb.gain.value = 0.45
  delay.connect(fb).connect(delay)
  delay.connect(s.out)
  s.every(2, 5, (t) => s.tone({ t, freq: [1046.5, 1318.5, 1568, 1975.5][Math.floor(Math.random() * 4)], dur: 1.2, gain: 0.025, pan: rand(-0.6, 0.6), dest: delay }))
}

const SCAPES = { density, transport, pollution, forest, architecture }

export class SoundEngine {
  constructor() {
    this.ctx = null
    this.scape = null
    this.mode = null
    this.volume = 0.7
    this.muted = false
    this.ducked = false
  }
  // must be called from a click or key press
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext
      if (!AC) return false
      this.ctx = new AC()
      this.master = this.ctx.createGain()
      this.master.gain.value = this.muted ? 0 : this.volume
      this.master.connect(this.ctx.destination)
      this.ambient = this.ctx.createGain()
      this.ambient.connect(this.master)
      this.noise = noiseBuffer(this.ctx)
    }
    if (this.ctx.state === 'suspended') this.ctx.resume()
    return true
  }
  setMode(mode) {
    if (mode === this.mode) return
    this.mode = mode
    if (!this.ctx) return
    if (this.scape) this.scape.stop()
    this.scape = null
    if (mode && SCAPES[mode]) {
      const s = new Scape(this)
      SCAPES[mode](s)
      s.fadeIn()
      this.scape = s
    }
  }
  ramp(param, value, time = 0.4) {
    const t = this.ctx.currentTime
    param.cancelScheduledValues(t)
    param.setValueAtTime(param.value, t)
    param.linearRampToValueAtTime(value, t + time)
  }
  setVolume(v) {
    this.volume = v
    if (this.ctx) this.ramp(this.master.gain, this.muted ? 0 : v, 0.15)
  }
  setMuted(m) {
    this.muted = m
    if (this.ctx) this.ramp(this.master.gain, m ? 0 : this.volume, 0.3)
  }
  // lower the ambience while a guide speaks, so the two never compete
  duck(on) {
    this.ducked = on
    if (this.ctx) this.ramp(this.ambient.gain, on ? DUCKED : 1, 0.6)
  }
  dispose() {
    this.setMode(null)
    this.ctx?.close()
  }
}
