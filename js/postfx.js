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
uniform sampler2D uScene; uniform sampler2D uMask; uniform sampler2D uFloor;
uniform vec2 uRes; uniform float uTime;
uniform vec3 uTint; uniform float uSat; uniform float uContrast; uniform float uVig;
uniform float uDark; uniform vec3 uAmb;
uniform vec4 uL0[${MAXL}]; uniform vec3 uL1[${MAXL}]; uniform int uLN;
uniform float uFlash; uniform float uRain; uniform float uHaze; uniform float uBliz; uniform float uGlitch;
uniform float uLow; uniform float uFog; uniform float uPud; uniform vec2 uHero;
uniform float uBloom;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
void main(){
  vec2 uv = vUv; vec2 px = uv * uRes;
  vec4 m = texture(uMask, uv);
  float pud = m.a;
  int kind = int(floor((m.r*255.0 - 10.0) / 60.0));
  // heat haze: lava and the weather's own shimmer bend the picture
  vec2 d = vec2(0.0);
  if (uHaze > 0.0) {
    float hz = max(m.g, 0.0) * uHaze;
    d += vec2(sin(uv.y*90.0 + uTime*3.5) * 0.0016, cos(uv.x*70.0 + uTime*2.6) * 0.0009) * hz * 2.2;
  }
  vec3 col;
  if (uGlitch > 0.0) {
    float j = (hash(vec2(floor(uTime*12.0), floor(uv.y*40.0))) - 0.5) * 0.004 * uGlitch;
    float ca = 0.0019 * uGlitch;
    col = vec3(texture(uScene, uv + d + vec2(j+ca,0.0)).r, texture(uScene, uv + d + vec2(j,0.0)).g, texture(uScene, uv + d + vec2(j-ca,0.0)).b);
    col *= 0.93 + 0.07 * sin(uv.y * uRes.y * 3.14159);
  } else col = texture(uScene, uv + d).rgb;
  // puddles: ripples, a mirrored copy of what stands above them, a glint
  // entity pixels differ from the floor snapshot: puddles never shimmer over heroes, monsters or their shadows
  bool ent = length(texture(uScene, uv).rgb - texture(uFloor, uv).rgb) > 0.03;
  if (uPud > 0.5 && pud > 0.04 && !ent) {
    vec2 rip = vec2(sin(uv.y*160.0 + uTime*3.0), cos(uv.x*130.0 + uTime*2.4)) * 0.0022 * pud;
    float rainRip = uRain > 0.0 ? sin(length(fract(uv*vec2(26.0,15.0))-0.5)*32.0 - uTime*9.0) * 0.5 + 0.5 : 0.0;
    vec3 refl = texture(uScene, vec2(uv.x + rip.x, uv.y - 0.05 + rip.y)).rgb;
    float k = float(kind);
    vec3 tint = k < 0.5 ? vec3(0.62,0.78,1.0) : k < 1.5 ? vec3(0.55,0.08,0.1) : k < 2.5 ? vec3(0.45,1.0,0.35) : vec3(1.0,0.55,0.15);
    float str = k < 0.5 ? 0.62 : k < 1.5 ? 0.3 : k < 2.5 ? 0.4 : 0.0;
    col = mix(col, refl * tint, pud * str);
    float glint = pow(noise(uv*vec2(60.0,36.0) + uTime*0.6), 6.0);
    col += tint * glint * 0.35 * pud * (k < 3.5 ? 1.0 : 0.0);
    col += tint * rainRip * 0.08 * pud * uRain;
    if (k > 2.5) col += vec3(1.0,0.45,0.1) * (0.18 + 0.12*noise(uv*vec2(30.0,18.0) + uTime*0.7)) * pud;
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
  for (int i = 0; i < ${MAXL}; i++) {
    if (i >= uLN) break;
    vec4 a = uL0[i];
    float dist = distance(px, a.xy);
    float f = 1.0 - smoothstep(0.0, a.z, dist);
    f = f * f * (1.0 + 0.06 * sin(uTime*7.0 + float(i)));
    light += uL1[i] * f * a.w * uDark * 1.35;
    glow += uL1[i] * f * f * a.w * 0.22 * uDark * uBloom;
  }
  col = col * light + glow;
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

  /* per-biome grade: tint, saturation, contrast, vignette, haze, fog */
  const GRADE = {
    backyard: { tint: [1.03, 1.0, 0.95], sat: 1.12, con: 1.04, vig: 0.28, fog: 0, haze: 0 },
    office: { tint: [0.94, 0.98, 1.06], sat: 0.82, con: 1.02, vig: 0.3, fog: 0, haze: 0 },
    glitch: { tint: [1.0, 0.92, 1.1], sat: 1.25, con: 1.1, vig: 0.4, fog: 0, haze: 0, glitch: 1 },
    zombie: { tint: [0.9, 0.98, 0.92], sat: 0.72, con: 1.06, vig: 0.4, fog: 0, haze: 0 },
    wasteland: { tint: [1.08, 0.98, 0.84], sat: 0.92, con: 1.05, vig: 0.34, fog: 0, haze: 0.2 },
    volcano: { tint: [1.14, 0.92, 0.8], sat: 1.1, con: 1.1, vig: 0.42, fog: 0, haze: 0.9 },
    dungeon: { tint: [1.0, 0.92, 0.95], sat: 0.7, con: 1.1, vig: 0.5, fog: 0.15, haze: 0 },
    frozen: { tint: [0.9, 1.0, 1.1], sat: 0.88, con: 1.08, vig: 0.3, fog: 0, haze: 0 },
  };

  let gl = null, prog = null, vbo = null, texScene = null, texMask = null, texFloor = null, loc = {}, fx = null;

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
      for (const n of ['uScene', 'uMask', 'uFloor', 'uRes', 'uTime', 'uTint', 'uSat', 'uContrast', 'uVig', 'uDark', 'uAmb', 'uL0', 'uL1', 'uLN', 'uFlash', 'uRain', 'uHaze', 'uBliz', 'uGlitch', 'uLow', 'uFog', 'uPud', 'uHero', 'uBloom']) loc[n] = gl.getUniformLocation(prog, n);
      texScene = tex();
      texMask = tex();
      texFloor = tex();
      gl.uniform1i(loc.uScene, 0);
      gl.uniform1i(loc.uMask, 1);
      gl.uniform1i(loc.uFloor, 2);
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
  const L0 = new Float32Array(MAXL * 4), L1 = new Float32Array(MAXL * 3);
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
    gl.activeTexture(gl.TEXTURE0);
    const mode = A.mode;
    const n = Math.min(MAXL, low ? 8 : A.lights.length, A.lights.length);
    for (let i = 0; i < n; i++) {
      const l = A.lights[i];
      L0[i * 4] = l[0]; L0[i * 4 + 1] = l[1]; L0[i * 4 + 2] = l[2]; L0[i * 4 + 3] = l[6];
      L1[i * 3] = l[3]; L1[i * 3 + 1] = l[4]; L1[i * 3 + 2] = l[5];
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
