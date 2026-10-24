/* CHAOS.exe - the WebGL2 post-process pass (PLAN.md section 5, R5). The finished 2D frame (640x360) is uploaded as a
   texture, shaded at native resolution (cheap, and the pixel look survives) and shown on an overlay canvas that is scaled
   with nearest-neighbour filtering. One fragment shader does: per-biome colour grade, a night light map (hero light radius,
   hives, shrines...), rain sheen, lightning flash, heat haze, reflective puddles (water / blood / toxic / lava from the
   mask that atmos.js draws), whiteout for blizzards, low-HP vignette and the glitch biome's chromatic aberration.
   No WebGL2, Settings > Video > Effects Off, or a lost context: the plain 2D frame is shown untouched. */
(function (CH) {
  'use strict';
  const B = CH.Balance;
  const U = CH.U;
  const G = CH.G;
  const X = CH.X;
  const wrap = X.wrap;
  const W = B.view.w, H = B.view.h;
  const MAXL = 28;

  const PostFX = (CH.PostFX = { on: false, supported: false, level: 'high', haze: true });

  const VS = `#version 300 es
in vec2 aPos; out vec2 vUv;
void main(){ vUv = vec2(aPos.x*0.5+0.5, 0.5-aPos.y*0.5); gl_Position = vec4(aPos,0.0,1.0); }`;

  const FS = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 outColor;
uniform sampler2D uScene; uniform sampler2D uMask; uniform sampler2D uFloor; uniform sampler2D uAct;
uniform vec2 uRes; uniform float uTime;
uniform vec3 uTint; uniform float uSat; uniform float uContrast; uniform float uVig;
uniform float uDark; uniform vec3 uAmb;
uniform vec4 uL0[${MAXL}]; uniform vec3 uL1[${MAXL}]; uniform vec2 uL2[${MAXL}]; uniform int uLN;
uniform sampler2D uOcc; uniform float uOccOn;
uniform float uFlash; uniform float uRain; uniform float uHaze; uniform float uBliz; uniform float uGlitch;
uniform float uLow; uniform float uFog; uniform float uPud; uniform vec2 uHero;
uniform float uBloom; uniform vec3 uSky;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
// puddle surface: two drifting octaves of wind ripple (v slows them down: blood is thick)
float hgt(vec2 p, float t, float v){
  return noise(p*0.085 + vec2(t*0.55, t*0.31)*v) * 0.62 + noise(p*0.19 - vec2(t*0.43, -t*0.26)*v) * 0.38;
}
// raindrops: one ring per 14 px cell, each cell at its own moment, squashed for the top-down view
float rings(vec2 p, float t){
  vec2 c = floor(p / 14.0), f = p - c * 14.0;
  vec2 o = vec2(3.0 + 8.0 * hash(c + 3.7), 3.0 + 8.0 * hash(c + 9.1));
  float ph = fract(t * 0.85 + hash(c));
  float d = length((f - o) * vec2(1.0, 1.7));
  return (1.0 - ph) * (1.0 - smoothstep(0.0, 1.1, abs(d - ph * 6.5)));
}
// toxic goo: bubbles swell, then pop into a quick ring
float bubbles(vec2 p, float t){
  vec2 c = floor(p / 9.0), f = p - c * 9.0;
  if (hash(c + 7.7) < 0.45) return 0.0;
  vec2 o = vec2(2.5 + 4.0 * hash(c + 1.3), 2.5 + 4.0 * hash(c + 5.9));
  float ph = fract(t * 0.4 + hash(c + 2.2));
  float d = length((f - o) * vec2(1.0, 1.3));
  if (ph < 0.85) return 0.8 * (1.0 - smoothstep(0.0, 0.8, abs(d - ph / 0.85 * 2.0)));
  return (1.0 - (ph - 0.85) / 0.15) * (1.0 - smoothstep(0.0, 0.8, abs(d - 2.0 - (ph - 0.85) * 18.0)));
}
void main(){
  vec2 uv = vUv; vec2 px = uv * uRes;
  vec4 m = texture(uMask, uv);
  float pud = m.a;
  int kind = int(floor((m.r*255.0 - 10.0) / 60.0));
  // heat haze: lava bends the picture (the mask's green is lava heat there, a distance everywhere else)
  vec2 d = vec2(0.0);
  if (uHaze > 0.0) {
    float hz = (kind == 3 ? pud : 0.0) * uHaze;
    d += vec2(sin(uv.y*90.0 + uTime*3.5) * 0.0016, cos(uv.x*70.0 + uTime*2.6) * 0.0009) * hz * 2.2;
  }
  vec3 col;
  if (uGlitch > 0.0) {
    float j = (hash(vec2(floor(uTime*12.0), floor(uv.y*40.0))) - 0.5) * 0.004 * uGlitch;
    float ca = 0.0019 * uGlitch;
    col = vec3(texture(uScene, uv + d + vec2(j+ca,0.0)).r, texture(uScene, uv + d + vec2(j,0.0)).g, texture(uScene, uv + d + vec2(j-ca,0.0)).b);
    col *= 0.93 + 0.07 * sin(uv.y * uRes.y * 3.14159);
  } else col = texture(uScene, uv + d).rgb;
  // puddles: a moving surface (wind ripples, raindrop rings), the bed seen through it, what stands behind the puddle
  // mirrored about its far edge (the sky where nothing does), sharp glints; blood is thick, slow and glossy.
  // Entity pixels differ from the floor snapshot: puddles never shimmer over heroes, monsters or their shadows.
  bool ent = length(texture(uAct, uv).rgb - texture(uFloor, uv).rgb) > 0.03;
  vec3 emis = vec3(0.0);   // light of its own, added after the light map: lava, glowing goo, lights mirrored in puddles
  float pref = 0.0;        // how strongly this pixel mirrors the lights
  vec2 pn = vec2(0.0);
  float y0 = 0.0;
  if (uPud > 0.5 && pud > 0.04 && !ent) {
    float depth = clamp(m.b, 0.0, 1.0);
    float dTop = m.g * 255.0;
    float t = uTime;
    float visc = kind == 1 ? 0.2 : kind == 2 ? 0.45 : 1.0;
    float rain = kind == 0 ? uRain * 0.5 : kind == 1 ? uRain * 0.2 : 0.0; // rings bend the picture a little; they're drawn below
    float hL = hgt(px - vec2(1.0, 0.0), t, visc) + rings(px - vec2(1.0, 0.0), t) * rain;
    float hR = hgt(px + vec2(1.0, 0.0), t, visc) + rings(px + vec2(1.0, 0.0), t) * rain;
    float hU = hgt(px - vec2(0.0, 1.0), t, visc) + rings(px - vec2(0.0, 1.0), t) * rain;
    float hD = hgt(px + vec2(0.0, 1.0), t, visc) + rings(px + vec2(0.0, 1.0), t) * rain;
    pn = vec2(hR - hL, hD - hU) * (kind == 1 ? 0.7 : 1.0);
    y0 = px.y - dTop;
    vec3 pc;
    if (kind <= 2) {
      vec3 bed = texture(uFloor, uv + pn * 2.5 * depth / uRes).rgb;
      vec2 ruv = clamp(vec2(px.x + pn.x * 5.0, y0 - dTop - 1.0 + pn.y * 9.0) / uRes, vec2(0.0), vec2(1.0));
      vec3 rs = texture(uScene, ruv).rgb;
      bool rEnt = length(texture(uAct, ruv).rgb - texture(uFloor, ruv).rgb) > 0.03;
      vec3 sky = mix(uSky, uSky * vec3(0.62, 0.65, 0.72), uRain);
      sky = mix(sky, uAmb * 0.45, uDark) + vec3(uFlash * 0.7);
      vec3 refl = rEnt ? rs * 0.88 : sky;
      float edge = 1.0 - depth;
      if (kind == 0) {
        pc = mix(bed, refl * vec3(0.86, 0.94, 1.0), 0.4 + 0.2 * edge);
        pc = mix(pc, pc * vec3(0.72, 0.82, 0.96), depth * 0.35);
      } else if (kind == 1) {
        pc = mix(bed, refl * vec3(0.55, 0.1, 0.12), 0.14 + 0.1 * edge);
        pc *= mix(1.0, 0.72, depth);
      } else {
        pc = mix(bed, refl * vec3(0.5, 0.9, 0.4), 0.22);
        pc += vec3(0.5, 1.0, 0.35) * bubbles(px, t) * 0.5;
        emis += vec3(0.06, 0.26, 0.04) * (0.6 + 0.4 * noise(px * 0.05 + t * 0.3)) * pud * (0.4 + uDark);
      }
      // the sun (up and to the left, the eye above and in front): a soft sheen where the surface faces it, and a few
      // twinkling pixel sparkles, one possible per cell, a cross at their brightest; blood twinkles less and slower
      vec3 N = normalize(vec3(-pn * (kind == 1 ? 3.0 : 2.5), 1.0));
      float fa = max(dot(N, vec3(-0.207, -0.059, 0.976)), 0.0);
      float sun = (1.0 - uDark * 0.85) * (1.0 - uRain * 0.45);
      vec3 gc = kind == 1 ? vec3(1.0, 0.8, 0.8) : kind == 2 ? vec3(0.8, 1.0, 0.7) : vec3(1.0);
      pc += gc * smoothstep(0.985, 1.0, fa) * 0.16 * sun;
      float cs = kind == 1 ? 7.0 : 5.0;
      vec2 sc = floor(px / cs);
      vec2 lp = floor(px) - sc * cs - floor(vec2(hash(sc + 0.31), hash(sc + 0.77)) * cs);
      float tw = sin(t * (kind == 1 ? 1.3 : 2.6) + hash(sc + 1.9) * 6.283);
      float on = step(hash(sc + 4.2), kind == 1 ? 0.1 : 0.2) * step(0.75, tw) * step(0.94, fa);
      float dotp = (lp.x == 0.0 && lp.y == 0.0) ? 1.0 : 0.0;
      float crs = ((abs(lp.x) <= 1.0 && lp.y == 0.0) || (abs(lp.y) <= 1.0 && lp.x == 0.0)) && tw > 0.93 ? 0.6 : 0.0;
      pc += gc * on * max(dotp, crs) * 0.8 * sun;
      // raindrop rings catch the light
      pc += vec3(0.75, 0.85, 0.95) * rings(px, t) * 0.3 * (kind == 0 ? uRain : kind == 1 ? uRain * 0.5 : 0.0);
      // the meniscus: a thin bright line round the rim
      pc += vec3(0.11, 0.13, 0.15) * (1.0 - smoothstep(0.0, 0.07, depth)) * (kind == 1 ? 0.5 : 1.0);
      pref = pud * (kind == 0 ? 1.0 : 0.5);
    } else {
      pc = col;
      emis += vec3(1.0, 0.45, 0.1) * (0.22 + 0.16 * noise(px * 0.1 + vec2(t * 0.6, -t * 0.4))) * pud;
    }
    col = mix(col, pc, clamp(pud, 0.0, 1.0));
  }
  // wet sheen under rain
  if (uRain > 0.0) {
    float g = (col.r + col.g + col.b) / 3.0;
    col = mix(col, col * vec3(0.9, 0.95, 1.05), 0.35 * uRain) + vec3(0.0, 0.01, 0.025) * uRain;
    col += vec3(0.02,0.03,0.05) * pow(noise(uv*vec2(80.0,45.0) + vec2(0.0, -uTime*2.0)), 5.0) * uRain * 3.0;
  }
  // light map: ambient fades to a cold dark at night, lights punch holes into it
  vec3 light = mix(vec3(1.0), uAmb, uDark);
  vec3 glow = vec3(0.0);
  bool inOcc = uOccOn > 0.5 && texture(uOcc, uv).a > 0.5;
  for (int i = 0; i < ${MAXL}; i++) {
    if (i >= uLN) break;
    vec4 a = uL0[i]; vec2 fl = uL2[i];
    float dist = distance(px, a.xy);
    float f = 1.0 - smoothstep(0.0, a.z, dist);
    f = f * f * (1.0 + 0.06 * sin(uTime*7.0 + float(i)));
    // shadows: march from this pixel toward the light through the occluder map (walls and solid props)
    float sh = 1.0;
    if (fl.x > 0.5 && uOccOn > 0.5 && f > 0.002 && !inOcc) {
      float hits = 0.0;
      for (int k = 1; k <= 14; k++) hits += texture(uOcc, mix(px, a.xy, float(k) / 15.0) / uRes).a > 0.5 ? 1.0 : 0.0;
      sh = 1.0 - 0.88 * clamp(hits / 3.0, 0.0, 1.0);
    }
    float dk = max(uDark, fl.y);
    light += uL1[i] * f * a.w * dk * 1.35 * sh;
    glow += uL1[i] * f * f * a.w * 0.22 * dk * uBloom * sh;
    // a light behind a puddle shows in it as a long wavering streak, mirrored about the puddle's far edge
    if (pref > 0.0 && a.y < y0 + 20.0) {
      vec2 q = (px - vec2(a.x, 2.0 * y0 - a.y) - pn * vec2(6.0, 14.0)) * vec2(1.0, 0.4);
      emis += uL1[i] * a.w * exp(-dot(q, q) / (a.z * a.z * 0.0035)) * pref * dk * 1.4;
    }
  }
  col = col * light + glow + emis;
  // blizzard whiteout: you only see around your hero
  if (uBliz > 0.0) {
    float v = smoothstep(70.0, 210.0, distance(px, uHero));
    col = mix(col, vec3(0.88, 0.93, 0.97) * (0.8 + 0.2*noise(uv*vec2(14.0,8.0)+uTime*0.5)), v * 0.82 * uBliz);
  }
  if (uFog > 0.0) {
    float n = noise(uv*vec2(5.0,3.0) + vec2(uTime*0.05, uTime*0.03)) * 0.6 + noise(uv*vec2(11.0,6.0) - uTime*0.06) * 0.4;
    col = mix(col, vec3(0.62,0.64,0.7), n * 0.34 * uFog);
  }
  // lightning
  col = mix(col, vec3(1.0), uFlash * 0.5) + vec3(0.35,0.4,0.5) * uFlash * 0.25;
  // grade
  col = (col - 0.5) * uContrast + 0.5;
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(l), col, uSat) * uTint;
  // vignette and the red low-hp edge
  vec2 q = uv - 0.5;
  float vg = smoothstep(0.35, 0.95, length(q * vec2(1.0, 1.15)));
  col *= 1.0 - vg * uVig;
  col = mix(col, vec3(0.7, 0.04, 0.06), vg * uLow * 0.5);
  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

  /* per-biome grade: tint, saturation, contrast, vignette, haze, fog, and the sky (or ceiling) puddles mirror */
  const GRADE = {
    backyard: { tint: [1.03, 1.0, 0.95], sat: 1.12, con: 1.04, vig: 0.28, fog: 0, haze: 0, sky: [0.6, 0.72, 0.9] },
    gaslight: { tint: [0.98, 0.94, 1.06], sat: 0.72, con: 1.1, vig: 0.46, fog: 0, haze: 0, sky: [0.3, 0.28, 0.38] },
    deadwood: { tint: [0.95, 1.02, 0.92], sat: 0.8, con: 1.08, vig: 0.42, fog: 0, haze: 0, sky: [0.36, 0.42, 0.38] },
    office: { tint: [0.94, 0.98, 1.06], sat: 0.82, con: 1.02, vig: 0.3, fog: 0, haze: 0, sky: [0.22, 0.23, 0.27] },
    glitch: { tint: [1.0, 0.92, 1.1], sat: 1.25, con: 1.1, vig: 0.4, fog: 0, haze: 0, glitch: 1, sky: [0.42, 0.3, 0.6] },
    zombie: { tint: [0.9, 0.98, 0.92], sat: 0.72, con: 1.06, vig: 0.4, fog: 0, haze: 0, sky: [0.45, 0.5, 0.48] },
    wasteland: { tint: [1.08, 0.98, 0.84], sat: 0.92, con: 1.05, vig: 0.34, fog: 0, haze: 0.2, sky: [0.74, 0.67, 0.55] },
    volcano: { tint: [1.14, 0.92, 0.8], sat: 1.1, con: 1.1, vig: 0.42, fog: 0, haze: 0.9, sky: [0.5, 0.3, 0.24] },
    dungeon: { tint: [1.0, 0.92, 0.95], sat: 0.7, con: 1.1, vig: 0.5, fog: 0.15, haze: 0, sky: [0.18, 0.17, 0.2] },
    frozen: { tint: [0.9, 1.0, 1.1], sat: 0.88, con: 1.08, vig: 0.3, fog: 0, haze: 0, sky: [0.74, 0.82, 0.92] },
  };

  let gl = null, prog = null, vbo = null, texScene = null, texMask = null, texFloor = null, texOcc = null, texAct = null, loc = {}, fx = null;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  function tex() {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  PostFX.init = function () {
    if (gl || PostFX.failed) return PostFX.supported;
    try {
      fx = document.createElement('canvas');
      fx.id = 'fx';
      fx.width = W;
      fx.height = H;
      gl = fx.getContext('webgl2', { alpha: false, antialias: false, preserveDrawingBuffer: true });
      if (!gl) throw new Error('no webgl2');
      prog = gl.createProgram();
      gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
      gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      gl.useProgram(prog);
      vbo = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const a = gl.getAttribLocation(prog, 'aPos');
      gl.enableVertexAttribArray(a);
      gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
      for (const n of ['uScene', 'uMask', 'uFloor', 'uAct', 'uRes', 'uTime', 'uTint', 'uSat', 'uContrast', 'uVig', 'uDark', 'uAmb', 'uL0', 'uL1', 'uL2', 'uLN', 'uOcc', 'uOccOn', 'uFlash', 'uRain', 'uHaze', 'uBliz', 'uGlitch', 'uLow', 'uFog', 'uPud', 'uHero', 'uBloom', 'uSky']) loc[n] = gl.getUniformLocation(prog, n);
      texScene = tex();
      texMask = tex();
      texFloor = tex();
      texOcc = tex();
      texAct = tex();
      gl.uniform1i(loc.uScene, 0);
      gl.uniform1i(loc.uMask, 1);
      gl.uniform1i(loc.uFloor, 2);
      gl.uniform1i(loc.uOcc, 3);
      gl.uniform1i(loc.uAct, 4);
      gl.uniform2f(loc.uRes, W, H);
      fx.addEventListener('webglcontextlost', (e) => { e.preventDefault(); PostFX.disable(); PostFX.failed = true; });
      PostFX.supported = true;
    } catch (e) {
      PostFX.failed = true;
      PostFX.supported = false;
      gl = null;
      if (CH.errors && CH.errors.length < 20) CH.errors.push('postfx: ' + e.message);
    }
    return PostFX.supported;
  };

  PostFX.enable = function () {
    if (!PostFX.init()) return false;
    const stage = document.getElementById('stage');
    if (!fx.parentNode) {
      const game = document.getElementById('game');
      fx.style.cssText = game.style.cssText;
      stage.insertBefore(fx, game.nextSibling);
    }
    fx.style.display = '';
    document.getElementById('game').style.visibility = 'hidden';
    PostFX.on = true;
    return true;
  };
  PostFX.disable = function () {
    PostFX.on = false;
    if (fx) fx.style.display = 'none';
    const g = document.getElementById('game');
    if (g) g.style.visibility = '';
  };
  /* Settings > Video: Effects Off / Low / High, heat haze on / off */
  PostFX.apply = function () {
    const s = CH.Storage.settings;
    PostFX.level = s.fx || 'high';
    PostFX.haze = s.haze !== false;
    if (PostFX.level === 'off') PostFX.disable();
    else if (!PostFX.on) PostFX.enable();
  };

  /* ---------------------------------------------------------------- one frame */
  const L0 = new Float32Array(MAXL * 4), L1 = new Float32Array(MAXL * 3), L2 = new Float32Array(MAXL * 2);
  PostFX.present = function () {
    if (!PostFX.on || !gl) return;
    const A = CH.Atmos;
    const biome = G.level ? G.level.biome : G.arena ? G.arena.id : 'backyard';
    const gr = GRADE[G.level && G.level.isTown ? 'backyard' : biome] || GRADE.backyard;
    const low = PostFX.level === 'low';
    gl.useProgram(prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texScene);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, G.canvas);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, texMask);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, A.mask);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, texFloor);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, A.floor);
    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, texAct);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, A.actors);
    const occOn = !low && A.occUsed && A.occ;
    if (occOn) {
      gl.activeTexture(gl.TEXTURE3);
      gl.bindTexture(gl.TEXTURE_2D, texOcc);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, A.occ);
    }
    gl.activeTexture(gl.TEXTURE0);
    const mode = A.mode;
    const n = Math.min(MAXL, low ? 8 : A.lights.length, A.lights.length);
    for (let i = 0; i < n; i++) {
      const l = A.lights[i];
      L0[i * 4] = l[0]; L0[i * 4 + 1] = l[1]; L0[i * 4 + 2] = l[2]; L0[i * 4 + 3] = l[6];
      L1[i * 3] = l[3]; L1[i * 3 + 1] = l[4]; L1[i * 3 + 2] = l[5];
      const fg = l[7] || 0; // 1 = casts shadows, 2 = glows by day too
      L2[i * 2] = fg & 1 ? 1 : 0; L2[i * 2 + 1] = fg & 2 ? 0.2 : 0;
    }
    const hero = G.player || { x: 0, y: 0 };
    const cam = G.cam || { x: 0, y: 0 };
    const reduced = CH.Storage.settings.reduced;
    gl.uniform1f(loc.uTime, performance.now() / 1000);
    gl.uniform3f(loc.uTint, gr.tint[0], gr.tint[1], gr.tint[2]);
    gl.uniform1f(loc.uSat, gr.sat);
    gl.uniform1f(loc.uContrast, gr.con);
    gl.uniform1f(loc.uVig, gr.vig);
    gl.uniform1f(loc.uDark, (A.dark || 0) * (G.level && G.level.isTown ? 0.3 : 1) * (biome === 'dungeon' ? 1 : 1));
    gl.uniform3f(loc.uAmb, 0.2, 0.25, 0.48);
    gl.uniform4fv(loc.uL0, L0);
    gl.uniform3fv(loc.uL1, L1);
    gl.uniform2fv(loc.uL2, L2);
    gl.uniform1f(loc.uOccOn, occOn ? 1 : 0);
    gl.uniform1i(loc.uLN, n);
    gl.uniform1f(loc.uFlash, reduced || !CH.Storage.settings.flashing ? Math.min(0.12, A.flash || 0) : A.flash || 0);
    gl.uniform1f(loc.uRain, mode === 'rain' || mode === 'storm' || mode === 'bloodrain' ? 1 : 0);
    gl.uniform1f(loc.uHaze, PostFX.haze && !low && !reduced ? Math.max(gr.haze, mode === 'firestorm' ? 0.8 : 0) : 0);
    gl.uniform1f(loc.uBliz, mode === 'blizzard' ? 1 : 0);
    gl.uniform1f(loc.uGlitch, gr.glitch && !reduced ? 1 : 0);
    const alive = G.players.filter((p) => !p.dead);
    const lowHp = alive.length ? Math.min(...alive.map((p) => p.hp / p.maxHp)) : 1;
    gl.uniform1f(loc.uLow, lowHp < 0.3 ? (0.3 - lowHp) * 3 * (0.7 + 0.3 * Math.sin(G.wall * 6)) : 0);
    gl.uniform1f(loc.uFog, Math.max(gr.fog, mode === 'fog' ? 1 : 0) * (low ? 0.5 : 1));
    gl.uniform1f(loc.uPud, low ? 0 : 1);
    gl.uniform2f(loc.uHero, hero.x - cam.x, hero.y - cam.y);
    gl.uniform1f(loc.uBloom, low ? 0 : 1);
    gl.uniform3f(loc.uSky, gr.sky[0], gr.sky[1], gr.sky[2]); // what puddles mirror where nothing stands behind them
    gl.viewport(0, 0, W, H);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  wrap(G, 'render', function (orig) {
    const r = orig.call(G);
    if (PostFX.on) {
      try { PostFX.present(); } catch (e) { PostFX.disable(); PostFX.failed = true; if (CH.errors && CH.errors.length < 20) CH.errors.push('postfx: ' + e.message); }
    }
    return r;
  });

  /* start with the saved Video setting once the game is up (tests that need the plain frame set fx off) */
  PostFX.boot = function () {
    const s = CH.Storage.settings;
    const fxb = document.getElementById('set-fx'), hz = document.getElementById('set-haze');
    const label = () => {
      if (fxb) fxb.textContent = 'EFFECTS: ' + (s.fx || 'high').toUpperCase() + (PostFX.supported || s.fx === 'off' ? '' : ' (NO WEBGL)');
      if (hz) hz.textContent = 'HEAT HAZE: ' + (s.haze !== false ? 'ON' : 'OFF');
    };
    if (fxb) fxb.addEventListener('click', () => { s.fx = { high: 'low', low: 'off', off: 'high' }[s.fx || 'high']; CH.Storage.save(); PostFX.apply(); label(); CH.Audio.sfx('click'); });
    if (hz) hz.addEventListener('click', () => { s.haze = s.haze === false; CH.Storage.save(); PostFX.apply(); label(); CH.Audio.sfx('click'); });
    const prev = CH.UI.refreshSettings;
    CH.UI.refreshSettings = function () { prev.apply(CH.UI, arguments); label(); };
    PostFX.apply();
    label();
  };
})(window.CH);
