import * as THREE from 'three'

// Night facades for Weimar 2077: the historic town, technologically evolved.
// The walls keep their real footprint and height; the shader only paints on them:
//   - plaster in the building's use colour (the muted palette reads like Weimar's lime-washed facades),
//     lit from below by the street neon and fading upwards
//   - a cornice line at every floor and tall, framed windows in a regular historic rhythm
//   - shopfronts on the ground floor with a neon strip above them, a neon line under the eave
//   - tiled pitched roofs with a lit ridge
//   - now and then a vertical holo-sign on a facade
// When the density signal is on, the building density around each building drives the activity:
// more lit windows, more signs, brighter neon and glitching scan lines in dense blocks, darker and
// quieter facades where buildings stand apart. A reached building takes its reach shade instead.
//
// Per vertex: facade = (along wall, wall length, floor height, part 0 wall / 1 flat roof / 2 slope)
//             bld    = (eave height, random number, building density)

export function makeFacadeMaterial() {
  return new THREE.ShaderMaterial({
    vertexColors: true,
    uniforms: {
      uTime: { value: 0 },
      uDensityOn: { value: 0 },
      uDim: { value: 0 }, // Forest mode: the town steps back
      uDetail: { value: 0 }, // Architecture mode: cornices, frames and warm light stand out
      uFogColor: { value: new THREE.Color('#0a0c18') },
      uFogNear: { value: 2600 },
      uFogFar: { value: 7000 },
    },
    vertexShader: /* glsl */ `
      attribute vec4 facade;
      attribute vec3 bld;
      varying vec3 vColor;
      varying vec4 vFacade;
      varying vec3 vBld;
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying float vDepth;
      void main() {
        vColor = color;
        vFacade = facade;
        vBld = bld;
        vWorld = position;
        vNormal = normal;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uDensityOn, uDim, uDetail;
      uniform vec3 uFogColor;
      uniform float uFogNear, uFogFar;
      varying vec3 vColor;
      varying vec4 vFacade;
      varying vec3 vBld;
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying float vDepth;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

      // The muted use colour pushed towards a saturated neon of the same hue
      vec3 neon(vec3 c) {
        float m = max(max(c.r, c.g), c.b);
        vec3 s = c / max(m, 0.001);
        s = s * s * s;
        return mix(c, s, 0.7) * 1.35;
      }

      void main() {
        vec3 c = vColor;
        vec3 n = normalize(vNormal);
        float seed = vBld.y;
        // activity: from the building density when the density signal is on, otherwise a calm middle
        float act = mix(0.45, vBld.z, uDensityOn);
        float moon = 0.65 + 0.35 * max(dot(n, normalize(vec3(-0.35, 0.85, 0.4))), 0.0);
        vec3 col;
        float part = vFacade.w;

        if (part > 1.5) {
          // Pitched roof: tiles in rows, a darker version of the use colour
          float rows = step(0.82, fract(vWorld.y / 0.38));
          float cols = step(0.9, fract((vWorld.x + vWorld.z) / 0.45 + floor(vWorld.y / 0.38) * 0.5));
          vec3 tile = mix(c, vec3(0.42, 0.2, 0.17), 0.45);
          col = tile * (0.26 + 0.14 * moon) * (1.0 - 0.35 * max(rows, cols));
          // dormer-like lit skylights, more of them where it is busy
          vec2 cell = floor(vec2(vWorld.x + vWorld.z, vWorld.y) / vec2(3.5, 1.2));
          float sky = step(1.0 - 0.12 * act, hash(cell + seed * 7.0)) * step(0.4, fract(vWorld.y / 1.2)) * step(0.5, fract((vWorld.x + vWorld.z) / 3.5));
          col = mix(col, vec3(1.0, 0.78, 0.45) * 0.9, sky * 0.8);
        } else if (part > 0.5) {
          // Flat roof or the top of a pitched roof: use colour, faint panel lines, a lit edge glow
          col = c * (0.3 + 0.16 * moon);
          vec2 g = abs(fract(vWorld.xz / 5.0) - 0.5);
          col += neon(c) * step(0.47, max(g.x, g.y)) * (0.08 + 0.12 * act);
        } else {
          float eave = vBld.x;
          float y = vWorld.y;
          float u = vFacade.x;
          float L = vFacade.y;
          float fh = vFacade.z;

          // Plaster in the use colour, lit from the street below and fading upwards
          float uplight = 0.22 + 0.55 * exp(-y / 7.0);
          col = c * (0.13 + 0.32 * uplight) * moon;
          col += vec3(0.0, 0.12, 0.16) * exp(-y / 4.0) * (0.5 + act); // cyan bounce from the street

          float fl = floor(y / fh);
          float fy = fract(y / fh);

          // cornice / string course at every floor line
          col *= 1.0 + (0.35 + 0.9 * uDetail) * smoothstep(0.06, 0.0, fy) * step(1.0, fl);
          col += vec3(1.0, 0.72, 0.4) * 0.1 * uDetail * exp(-y / 9.0); // warm facade lighting

          // tall historic windows, framed, every 2.8 m
          float bay = 2.8;
          float cn = floor(u / bay);
          float fx = fract(u / bay);
          bool upper = fl >= 1.0 && y < eave - 0.6 && u > 0.9 && u < L - 0.9;
          if (upper && fx > 0.3 && fx < 0.7 && fy > 0.22 && fy < 0.86) {
            bool frame = fx < 0.34 || fx > 0.66 || fy < 0.27 || fy > 0.81 || abs(fx - 0.5) < 0.015;
            float r = hash(vec2(cn + seed * 131.0, fl + seed * 17.0));
            float lit = step(1.0 - mix(0.3, 0.9, act), r);
            float flick = step(0.965, r) * step(0.5, hash(vec2(floor(uTime * 7.0), r * 91.0)));
            lit *= 1.0 - flick;
            vec3 warm = vec3(1.0, 0.74, 0.4);
            vec3 cool = vec3(0.4, 0.92, 1.0);
            vec3 wc = r > 0.9 ? cool : (r > 0.8 ? neon(c) : warm);
            vec3 dark = vec3(0.02, 0.03, 0.06) + c * 0.05;
            col = frame ? c * 0.3 : mix(dark, wc * (0.75 + 0.35 * hash(vec2(cn, fl))), lit);
          }

          // ground floor: shopfronts with a neon strip above
          float gf = min(fh, 4.2);
          if (y < gf * 0.8 && y > 0.4 && u > 0.6 && u < L - 0.6 && fx > 0.08 && fx < 0.92 && eave > 4.0) {
            float r = hash(vec2(cn + seed * 53.0, 3.0));
            float lit = step(1.0 - mix(0.4, 0.95, act), r);
            vec3 shop = r > 0.7 ? vec3(1.0, 0.85, 0.55) : vec3(0.55, 0.95, 1.0);
            col = mix(vec3(0.03, 0.04, 0.07), shop * 0.85, lit);
          }
          float strip = smoothstep(0.22, 0.0, abs(y - gf * 0.88)) * step(4.0, eave);
          vec3 stripCol = hash(vec2(seed, 1.0)) > 0.75 ? vec3(0.99, 0.93, 0.04) : neon(c);
          col += stripCol * strip * (0.6 + 0.6 * act);

          // neon under the eave and on the corners
          col += neon(c) * smoothstep(0.45, 0.0, eave - y) * (0.6 + 0.5 * act);
          col += neon(c) * smoothstep(0.25, 0.0, min(u, L - u)) * 0.35;

          // vertical holo-sign on some facades, more in busy blocks
          if (hash(vec2(seed, 9.0)) > 1.0 - (0.08 + 0.3 * act) && eave > 8.0 && L > 6.0) {
            float sx = abs(u - 1.6);
            if (sx < 0.35 && y > gf && y < eave - 1.5) {
              float blink = step(0.25, hash(vec2(floor(uTime * 3.0 + seed * 10.0), seed)));
              float glyph = step(0.45, hash(vec2(floor(y / 0.7), seed * 3.0)));
              vec3 sc = hash(vec2(seed, 4.0)) > 0.5 ? vec3(1.0, 0.16, 0.42) : vec3(0.0, 0.9, 1.0);
              col = mix(col, sc * (0.6 + 0.6 * glyph), 0.85 * blink);
            }
          }

          // signal overload: glitching scan lines on facades in dense blocks
          float over = smoothstep(0.55, 0.95, vBld.z) * uDensityOn;
          float band = step(0.965, hash(vec2(floor(y * 1.5), floor(uTime * 10.0) + seed)));
          col += vec3(0.0, 0.85, 1.0) * band * over * 0.6;
        }

        col *= 1.0 - 0.45 * uDim;
        float f = smoothstep(uFogNear, uFogFar, vDepth);
        gl_FragColor = vec4(mix(col, uFogColor, f), 1.0);
            gl_FragColor.rgb = pow(max(gl_FragColor.rgb, 0.0), vec3(2.2));
            #include <colorspace_fragment>
      }`,
  })
}
