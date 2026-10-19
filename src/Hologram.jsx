// A holographic guide: a stylised, animated bust drawn in light. Not a portrait; the hair, collar and
// beard follow how each person is usually shown. It sways, blinks, flickers like a projection and
// moves its mouth while it speaks.

const INK = '#8ff8ff'
const FILL = 'rgba(0, 229, 255, 0.13)'

function Hair({ look }) {
  const p = { fill: FILL, stroke: INK, strokeWidth: 1.6 }
  switch (look) {
    case 'goethe':
    case 'carlaugust':
      // hair brushed back, rolled curls over the ears, tied at the back
      return (
        <g>
          <path d="M68 86 C 66 50 134 50 132 86 C 126 66 74 66 68 86 Z" {...p} />
          <ellipse cx="68" cy="98" rx="6" ry="9" {...p} />
          <ellipse cx="132" cy="98" rx="6" ry="9" {...p} />
          <path d="M126 70 C 146 82 146 112 138 128" {...p} fill="none" />
        </g>
      )
    case 'herder':
      // a wig with two rows of curls
      return (
        <g>
          <path d="M66 90 C 62 48 138 48 134 90 C 126 64 74 64 66 90 Z" {...p} />
          {[90, 104].map((y) => (
            <g key={y}>
              <ellipse cx="66" cy={y} rx="6" ry="6" {...p} />
              <ellipse cx="134" cy={y} rx="6" ry="6" {...p} />
            </g>
          ))}
        </g>
      )
    case 'schiller':
      // long hair falling to the shoulders
      return <path d="M70 84 C 64 46 136 46 130 84 C 138 108 140 132 132 146 L 124 110 C 120 74 80 74 76 110 L 68 146 C 60 132 62 108 70 84 Z" {...p} />
    case 'liszt':
      // long straight hair, worn to the collar
      return <path d="M68 82 C 64 44 136 44 132 82 L 136 140 L 126 140 L 124 90 C 118 70 82 70 76 90 L 74 140 L 64 140 Z" {...p} fill="rgba(200,250,255,0.22)" />
    case 'gropius':
    case 'ebert':
      // short, side-parted hair
      return <path d="M70 84 C 68 52 132 52 130 84 C 124 70 104 66 86 70 C 80 72 74 78 70 84 Z" {...p} />
    case 'vandevelde':
      // receding hairline, short at the sides
      return <path d="M70 92 C 68 76 72 66 80 62 M130 92 C 132 76 128 66 120 62" {...p} fill="none" />
    case 'cranach':
      // a flat beret
      return <path d="M60 74 C 70 46 130 46 140 74 C 120 66 80 66 60 74 Z" {...p} strokeWidth="2" />
    case 'annaamalia':
      // hair piled high
      return (
        <g>
          <ellipse cx="100" cy="50" rx="30" ry="22" {...p} />
          <path d="M68 92 C 64 62 136 62 132 92 C 124 72 76 72 68 92 Z" {...p} />
          <circle cx="76" cy="44" r="6" {...p} />
          <circle cx="124" cy="44" r="6" {...p} />
        </g>
      )
    default:
      return null
  }
}

function Beard({ look }) {
  const p = { fill: FILL, stroke: INK, strokeWidth: 1.4 }
  if (look === 'cranach') return <path d="M76 110 C 78 150 92 176 100 182 C 108 176 122 150 124 110 C 114 122 86 122 76 110 Z" {...p} />
  if (look === 'vandevelde') return <path d="M86 118 C 90 136 96 146 100 150 C 104 146 110 136 114 118 C 108 124 92 124 86 118 Z" {...p} />
  if (look === 'ebert') return <path d="M80 112 C 82 132 92 140 100 141 C 108 140 118 132 120 112 C 112 122 88 122 80 112 Z" {...p} />
  return null
}

function Moustache({ look }) {
  if (!['ebert', 'vandevelde', 'cranach'].includes(look)) return null
  return <path d="M86 108 C 92 103 98 105 100 107 C 102 105 108 103 114 108" fill="none" stroke={INK} strokeWidth="2" />
}

function Collar({ look }) {
  const p = { fill: FILL, stroke: INK, strokeWidth: 1.4 }
  switch (look) {
    case 'goethe':
    case 'schiller':
      // cravat, open coat
      return (
        <g>
          <path d="M86 146 L 100 172 L 114 146 L 108 162 L 100 158 L 92 162 Z" {...p} />
          <path d="M72 168 L 90 150 L 100 200 M128 168 L 110 150 L 100 200" {...p} fill="none" />
        </g>
      )
    case 'herder':
      // clergy bands
      return (
        <g>
          <rect x="91" y="148" width="8" height="22" {...p} />
          <rect x="101" y="148" width="8" height="22" {...p} />
        </g>
      )
    case 'carlaugust':
      // high uniform collar, epaulettes and a star
      return (
        <g>
          <path d="M84 146 L 116 146 L 112 160 L 88 160 Z" {...p} />
          <rect x="44" y="174" width="26" height="8" rx="3" {...p} />
          <rect x="130" y="174" width="26" height="8" rx="3" {...p} />
          <path d="M80 196 l 4 8 9 1 -7 6 2 9 -8 -5 -8 5 2 -9 -7 -6 9 -1 Z" {...p} />
        </g>
      )
    case 'liszt':
      // clerical collar of an abbé
      return <rect x="88" y="146" width="24" height="6" {...p} fill="rgba(200,250,255,0.4)" />
    case 'gropius':
      // bow tie
      return <path d="M88 150 L 100 156 L 88 162 Z M112 150 L 100 156 L 112 162 Z" {...p} />
    case 'ebert':
    case 'vandevelde':
      // shirt collar and tie
      return <path d="M90 146 L 100 158 L 110 146 M100 158 L 96 190 L 100 198 L 104 190 Z" {...p} />
    case 'cranach':
      // fur collar
      return <path d="M44 196 C 60 170 80 168 100 186 C 120 168 140 170 156 196" fill="none" stroke={INK} strokeWidth="5" strokeDasharray="2 3" />
    case 'annaamalia':
      // low neckline with lace
      return <path d="M70 168 C 84 196 116 196 130 168" fill="none" stroke={INK} strokeWidth="2" strokeDasharray="3 2" />
    default:
      return null
  }
}

export default function Hologram({ look = 'ai', mouth = 0, speaking = false }) {
  const ai = look === 'ai'
  const mouthOpen = 1 + mouth * 7
  return (
    <svg className={`hologram${speaking ? ' speaking' : ''}`} viewBox="0 0 200 290" role="img" aria-label="holographic guide">
      <defs>
        <filter id="holo-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="holo-cone" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#00e5ff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#00e5ff" stopOpacity="0" />
        </linearGradient>
        <pattern id="holo-scan" width="4" height="4" patternUnits="userSpaceOnUse">
          <rect width="4" height="1.3" fill="rgba(0,229,255,0.35)" />
          <animateTransform attributeName="patternTransform" type="translate" from="0 0" to="0 4" dur="0.6s" repeatCount="indefinite" />
        </pattern>
      </defs>

      {/* the projector and its cone of light */}
      <polygon points="40,276 160,276 182,40 18,40" fill="url(#holo-cone)" opacity="0.35" />
      <ellipse cx="100" cy="276" rx="62" ry="9" fill="none" stroke={INK} strokeWidth="2" opacity="0.8" />
      <ellipse cx="100" cy="276" rx="40" ry="5" fill="rgba(0,229,255,0.4)" />

      <g className="holo-body" filter="url(#holo-glow)">
        {/* shoulders */}
        <path d="M28 244 C 32 190 62 160 100 158 C 138 160 168 190 172 244 Z" fill={FILL} stroke={INK} strokeWidth="1.6" />
        {/* neck */}
        <path d="M88 128 L 88 150 M112 128 L 112 150" stroke={INK} strokeWidth="1.6" />
        <Collar look={look} />
        {/* head */}
        {ai ? (
          <g>
            <path d="M68 96 C 68 52 132 52 132 96 C 132 128 118 140 100 140 C 82 140 68 128 68 96 Z" fill={FILL} stroke={INK} strokeWidth="1.8" />
            <rect x="72" y="84" width="56" height="14" rx="7" fill="rgba(252,238,10,0.35)" stroke="#fcee0a" strokeWidth="1.4" />
            <circle cx="100" cy="46" r="5" fill="none" stroke="#fcee0a" strokeWidth="1.4" />
            <line x1="100" y1="51" x2="100" y2="58" stroke={INK} strokeWidth="1.4" />
          </g>
        ) : (
          <ellipse cx="100" cy="96" rx="31" ry="40" fill={FILL} stroke={INK} strokeWidth="1.8" />
        )}
        <Hair look={look} />
        {!ai && (
          <g>
            {/* brows, eyes (they blink), nose */}
            <path d="M80 82 Q 88 78 95 82 M105 82 Q 112 78 120 82" fill="none" stroke={INK} strokeWidth="1.4" />
            <g className="holo-eyes">
              <ellipse cx="88" cy="90" rx="4.5" ry="3" fill={INK} />
              <ellipse cx="112" cy="90" rx="4.5" ry="3" fill={INK} />
            </g>
            <path d="M100 92 L 96 106 L 102 107" fill="none" stroke={INK} strokeWidth="1.3" />
          </g>
        )}
        <Beard look={look} />
        <Moustache look={look} />
        {/* the mouth opens with the voice */}
        <ellipse cx="100" cy={ai ? 120 : 116} rx={ai ? 12 : 7.5} ry={mouthOpen} fill="rgba(0,10,20,0.7)" stroke={INK} strokeWidth="1.4" />
        {/* scan lines over the whole figure */}
        <path d="M28 244 C 32 190 62 160 100 158 C 138 160 168 190 172 244 Z M69 96 a 31 40 0 1 0 62 0 a 31 40 0 1 0 -62 0" fill="url(#holo-scan)" />
      </g>
    </svg>
  )
}
