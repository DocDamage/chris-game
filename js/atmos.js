/* CHAOS.exe - atmosphere (PLAN.md section 5), the 2D side: the stage clock (dawn / day / noon / dusk / night), weather per
   biome (sun, rain, storm with telegraphed lightning strikes, snow, blizzard, ash, fog, blood rain), light sources for
   the night, puddles of water / blood / toxic goo / lava (drawn into a mask that the post-process shader turns into
   reflections) and the Day & Night widget of the UI pack. js/postfx.js turns all of this into the final image;
   without WebGL everything still works through the plain 2D renderer.
   Night: enemies hit 10% harder and drops are 15% richer. Blizzard: -10% move speed. Lava burns, toxic goo stings. */
(function (CH) {
  'use strict';
  const B = CH.Balance;
  const U = CH.U;
  const FX = CH.FX;
  const G = CH.G;
  const X = CH.X;
  const Audio = CH.Audio;
  const Up = CH.Upgrades;
  const wrap = X.wrap;

  const A = (CH.Atmos = { clock: 0.25, mode: 'clear', dark: 0, flash: 0, strikes: [], lights: [], dyn: [], particles: [], DAY_LEN: 420, thunderAt: 0, k: 1 });
  const W = B.view.w, H = B.view.h;

  /* ------------------------------------------------------------------ clock */
  const sstep = (a, b, x) => { const t = U.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  A.darkness = (t) => sstep(0.58, 0.78, t) * (1 - sstep(0.9, 1.0, t));
  A.phase = (t) => (t < 0.12 ? 'dawn' : t < 0.4 ? 'day' : t < 0.52 ? 'noon' : t < 0.7 ? 'day' : t < 0.78 ? 'dusk' : t < 0.92 ? 'night' : 'dawn');
  A.update = function (dt) {
    A.clock = (A.clock + dt / A.DAY_LEN) % 1;
    const target = A.darkness(A.clock);
    A.dark += (target - A.dark) * Math.min(1, dt * 0.8);
    G.night = A.dark > 0.55;
    A.k += dt;
    // lightning flash decays; the shader and the widget read it
    if (A.flash > 0) A.flash = Math.max(0, A.flash - dt * 3.2);
    // thunder arrives after the flash, later when the strike was far away
    if (A.thunderAt && G.wall >= A.thunderAt) { A.thunderAt = 0; Audio.sfx('thunder'); G.shake(2, 0.25); }
    storm(dt);
    particles(dt);
    puddlesTick(dt);
    tracks(dt);
  };

  /* ------------------------------------------------------------------ weather */
  const TABLE = {
    backyard: ['clear', 'clear', 'rain', 'storm', 'wind'], deadwood: ['fog', 'fog', 'rain', 'storm', 'clear'], gaslight: ['rain', 'rain', 'fog', 'storm', 'clear', 'bloodrain'], catacombs: ['none', 'fog'], castle: ['none', 'none', 'fog'], office: ['none'], glitch: ['glitch'], zombie: ['rain', 'storm', 'fog'],
    wasteland: ['wind', 'ash', 'storm'], volcano: ['ash', 'firestorm', 'clear'], dungeon: ['fog', 'bloodrain', 'clear'], frozen: ['snow', 'blizzard'],
  };
  const OLD = { clear: 'sun', rain: 'rain', storm: 'rain', bloodrain: 'rain', wind: 'wind', glitch: 'glitch', none: 'none', fog: 'none', snow: 'none', blizzard: 'none', ash: 'none', firestorm: 'none' };
  A.setMode = function (m) {
    if (A.mode === m) return;
    A.mode = m;
    A.particles.length = 0;
    if (CH.Weather) CH.Weather.custom = OLD[m] || 'none';
    if (m === 'storm' && CH.Weather) CH.Weather.nextLightning = 6;
    if (CH.Weather && CH.Weather.setMode) CH.Weather.setMode(OLD[m] || 'none');
    for (const p of G.players) Up.recalc(p); // the blizzard slows everyone
  };
  A.forStage = function (biome, stage, rng) {
    const list = TABLE[biome] || ['clear'];
    A.setMode(list[Math.floor((rng || Math.random)() * list.length)]);
    // each stage starts at another time of day, so a run sweeps dawn -> night
    A.clock = (0.08 + (stage - 1) * 0.23 + ((G.runSeed || 0) % 100) / 400) % 1;
    A.dark = A.darkness(A.clock);
    A.strikes.length = 0;
    A.flash = 0;
    A.dyn.length = 0;
    A.prints.length = 0;
    for (const p of G.players) p._wet = null;
  };
  X.statHooks.push((p, s) => { if (A.mode === 'blizzard') s.speedMult *= 0.9; });

  /* telegraphed lightning: a ring for 0.9 s, then a bolt that hurts everyone inside */
  function storm(dt) {
    const stormy = A.mode === 'storm' || A.mode === 'firestorm';
    if (stormy && G.state === 'playing' && !(G.level && G.level.isTown)) {
      A.nextStrike = (A.nextStrike === undefined ? 5 : A.nextStrike) - dt;
      if (A.nextStrike <= 0) {
        A.nextStrike = U.rand(7, 14);
        const p = G.randomAlivePlayer ? G.randomAlivePlayer() : G.player;
        if (p) {
          const x = p.x + U.rand(-150, 150), y = p.y + U.rand(-110, 110);
          A.strikes.push({ x, y, t: 0.9, r: 34 });
        }
      }
    }
    for (let i = A.strikes.length - 1; i >= 0; i--) {
      const s = A.strikes[i];
      s.t -= dt;
      if (s.t > 0) continue;
      A.strikes.splice(i, 1);
      A.flash = 1;
      if (CH.Weather) { CH.Weather.lightningAlpha = 0.55; CH.Weather.lightningT = 0.25; }
      A.k2 = 1 + Math.floor(Math.random() * 5);
      FX.burst(s.x, s.y, { n: 30, colors: ['#ffffff', '#cfe8ff', '#fee761'], speed: 150, life: 0.5 });
      FX.ring(s.x, s.y, 6, s.r * 1.6, '#ffffff', 0.4);
      G.shake(5, 0.3);
      for (const e of G.enemies) if (!e.dead && !e.isSpawner && U.dist(e.x, e.y, s.x, s.y) < s.r + e.r) X.hitEnemy(e, e.isBoss ? 40 : 80, G.player, 'bolt');
      for (const p of G.players) if (!p.dead && U.dist(p.x, p.y, s.x, s.y) < s.r + p.r) G.hurtPlayer(G.edmg(14), { x: s.x, y: s.y, fx: 'bolt' }, { p });
      // thunder: the farther from the heroes, the longer after the flash
      const near = G.player ? U.dist(G.player.x, G.player.y, s.x, s.y) : 100;
      A.thunderAt = G.wall + 0.15 + near / 700;
    }
  }

  /* snow, ash, fog wisps and blood rain are drawn by us (the old Weather module owns rain, wind, sun and glitch) */
  function particles(dt) {
    const m = A.mode;
    const want = m === 'snow' ? 90 : m === 'blizzard' ? 230 : m === 'ash' ? 60 : m === 'firestorm' ? 90 : m === 'bloodrain' ? 110 : 0;
    while (A.particles.length < want) A.particles.push({ x: Math.random() * (W + 60) - 30, y: Math.random() * H, z: Math.random(), ph: Math.random() * 6 });
    if (A.particles.length > want) A.particles.length = want;
    const wind = m === 'blizzard' ? 170 : m === 'firestorm' ? 90 : m === 'snow' ? 24 : 18;
    for (const p of A.particles) {
      if (m === 'ash' || m === 'firestorm') { p.y -= (14 + 22 * p.z) * dt; p.x += (wind * 0.4 + Math.sin(A.k * 1.3 + p.ph) * 10) * dt; if (p.y < -6) { p.y = H + 6; p.x = Math.random() * (W + 60) - 30; } }
      else if (m === 'bloodrain') { p.y += (300 + 120 * p.z) * dt; p.x += 40 * dt; if (p.y > H + 8) { p.y = -10; p.x = Math.random() * (W + 60) - 30; } }
      else { p.y += (m === 'blizzard' ? 80 + 70 * p.z : 22 + 26 * p.z) * dt; p.x += (wind + Math.sin(A.k * 1.7 + p.ph) * 12) * dt * (0.4 + p.z); if (p.y > H + 4) { p.y = -4; p.x = Math.random() * (W + 80) - 40; } if (p.x > W + 20) p.x = -20; }
    }
  }

  /* ------------------------------------------------------------------ puddles */
  /* water / blood / toxic / lava: { x, y, rx, ry, kind }. Levels carry their own; blood from kills is dynamic.
     Each puddle has its own wobbly outline (from `seed`) and two cached pixel images: the ground layer (all the 2D
     renderer shows) and its patch of the shader's mask: R kind, G distance down from the puddle's far edge (lava: heat),
     B depth (0 at the rim, 1 in the middle), A coverage x gloss. Kill blood spreads as it lands and dries matte brown. */
  const KINDS = { water: 0, blood: 1, toxic: 2, lava: 3 };
  A.KINDS = KINDS;
  A.puddles = () => (G.level && G.level.puddles ? G.level.puddles.concat(A.dyn) : A.dyn);
  const hash = (a, b) => { let h = Math.imul((a | 0) ^ 0x27d4eb2d, 0x165667b1) ^ Math.imul(b | 0, 0x9e3779b1); h ^= h >>> 15; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; return (h >>> 0) / 4294967296; };
  const seedOf = (p) => (p.seed === undefined ? (p.seed = Math.floor(hash(Math.round(p.x), Math.round(p.y)) * 1e9)) : p.seed);
  A.addBlood = function (x, y, size) {
    const L = G.level;
    if (L && L.isLevel && L.solidAt(x, y)) return; // not on a wall
    // never a puddle on a puddle: blood that lands in the level's water, goo or lava is lost in it
    if (L && L.puddles) for (const q of L.puddles) if (inside(q, x, y, 10)) return;
    let best = null, bd = 46 * 46;
    for (const p of A.dyn) { const d = U.dist2(p.x, p.y, x, y); if (p.kind === 'blood' && d < bd) { bd = d; best = p; } }
    if (best) {
      const was = [best.rx, best.ry, best.x, best.y];
      best.rx = Math.min(44, best.rx + size * 0.35); best.ry = Math.min(30, best.ry + size * 0.25); best.x += (x - best.x) * 0.2; best.y += (y - best.y) * 0.2;
      if (clashes(best)) [best.rx, best.ry, best.x, best.y] = was; // it would spill into the level's own puddle: it stops growing
      best.born = Math.max(best.born || 0, G.wall - 14);
      return;
    }
    const p = { x, y, rx: 6 + size * 0.6, ry: 4 + size * 0.4, kind: 'blood', born: G.wall };
    if (clashes(p)) return;
    if (A.dyn.length >= 40) A.dyn.shift();
    seedOf(p);
    A.dyn.push(p);
  };
  /* does puddle p overlap one of the level's own (or another kill puddle than itself)? */
  const clashes = (p) => {
    const over = (q) => q !== p && Math.abs(q.x - p.x) < q.rx + p.rx - 2 && Math.abs(q.y - p.y) < q.ry + p.ry - 2 && ((q.x - p.x) / (q.rx + p.rx)) ** 2 + ((q.y - p.y) / (q.ry + p.ry)) ** 2 < 0.8;
    return ((G.level && G.level.puddles) || []).some(over);
  };
  A.clashes = clashes;

  const DRY = 60; // kill blood starts drying after 15 s and is matte brown a minute later
  const dryOf = (p) => (p.kind === 'blood' && p.born !== undefined ? U.clamp((G.wall - p.born - 15) / DRY, 0, 1) : 0);
  const spreadOf = (p) => { if (p.kind !== 'blood' || p.born === undefined) return 1; const t = U.clamp((G.wall - p.born) / 0.45, 0, 1); return 0.35 + 0.65 * (1 - (1 - t) * (1 - t)); };
  const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t];
  /* the ground colour of one pixel: d = depth (<0 outside the rim), u / v = position in radii, n = per-pixel noise,
     f = the floor's own colour there (PLAN.md 20: a puddle is wet ground, so its colour comes from the ground under it;
     null: the old fixed colours) */
  const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  function groundPx(kind, d, u, v, n, dry, s, x, y, f) {
    const lit = d > 0.08 && d < (kind === 'blood' ? 0.2 : 0.28) && v < -0.38 && u > -0.65 && u < 0.12; // the far rim catches the light
    if (f && kind !== 'lava') return onGround(kind, d, n, dry, lit, f);
    if (kind === 'water') {
      if (d <= 0) return d > -0.14 && n > 0.2 + (-d / 0.14) * 0.6 ? [0, 0, 0, 0.2] : null; // wet ground round the rim
      if (d < 0.1) return [40, 62, 88, 0.62];
      if (lit) return [165, 208, 236, 0.46];
      if (d > 0.22 && n > 0.994) return [205, 232, 250, 0.55];
      return mixc([30, 52, 84, 0.5], [12, 26, 52, 0.7], Math.min(1, d * 1.6));
    }
    if (kind === 'blood') {
      if (d <= 0) return d > -0.4 && n > 0.9 + (-d / 0.4) * 0.09 ? mixc([122, 6, 18, 0.92], [64, 20, 12, 0.85], dry) : null; // spatter
      let c = d < 0.09 ? [150, 12, 24, 0.94] : mixc([112, 4, 16, 0.92], [50, 0, 8, 0.97], Math.min(1, d * 1.5));
      c = mixc(c, d < 0.09 ? [84, 28, 18, 0.88] : mixc([66, 20, 13, 0.88], [42, 12, 8, 0.92], Math.min(1, d * 1.5)), dry);
      if (lit && dry < 0.75) return mixc(c, [228, 98, 108, 0.75], 1 - dry);
      if (d > 0.3 && n > 0.996 && dry < 0.3) return [190, 50, 60, 0.85];
      return c;
    }
    if (kind === 'toxic') {
      if (d <= 0) return d > -0.1 && n > 0.35 ? [30, 42, 8, 0.38] : null; // the goo eats the ground
      if (d < 0.1) return [72, 152, 46, 0.86];
      if (lit) return [182, 255, 122, 0.56];
      if (d > 0.25 && n > 0.975) return [150, 240, 100, 0.75];
      return mixc([40, 110, 35, 0.78], [22, 70, 26, 0.86], Math.min(1, d * 1.5));
    }
    // lava: a dark crust at the rim and in drifting plates, white-hot spots in the middle
    if (d <= 0) return d > -0.1 && n > 0.3 ? [40, 16, 10, 0.5] : null;
    if (d < 0.14) return [62, 22, 12, 0.97];
    if (d < 0.75 && hash(s + Math.floor(x / 4) * 3, Math.floor(y / 3) * 5) > 0.74) return [74, 26, 12, 0.95];
    if (d > 0.55 && n > 0.9) return [255, 222, 120, 0.95];
    return mixc([200, 62, 0, 0.95], [255, 150, 40, 0.97], Math.min(1, d * 1.4));
  }
  /* a puddle made of the ground it lies on: water darkens and cools the ground and lets it show through; blood soaks
     it red (brown when dry); goo stains it green. A wet, darker band runs round the rim, ragged by the noise. */
  const TINT = { water: [16, 26, 40], blood: [118, 6, 16], toxic: [44, 128, 36] };
  function onGround(kind, d, n, dry, lit, f) {
    if (d <= 0) { // the rim: wet ground (water), spatter (blood), eaten ground (goo)
      if (kind === 'water') return d > -0.16 && n > 0.15 + (-d / 0.16) * 0.7 ? [f[0] * 0.74, f[1] * 0.76, f[2] * 0.8, 1] : null;
      if (kind === 'blood') return d > -0.35 && n > 0.92 + (-d / 0.35) * 0.075 ? lerp3(lerp3(f, [120, 8, 18], 0.75), [62, 22, 14], dry).concat(0.95) : null;
      return d > -0.12 && n > 0.35 ? [f[0] * 0.55, f[1] * 0.62, f[2] * 0.4, 1] : null;
    }
    const k = Math.min(1, d * 1.7); // 0 at the rim .. 1 in the middle
    if (kind === 'water') {
      if (lit) return lerp3(f, [176, 208, 228], 0.5).concat(1);
      if (d > 0.24 && n > 0.993) return [210, 232, 248, 1];
      const g = 0.62 - 0.26 * k; // the ground shows through, darker where it is deep
      return [f[0] * g + TINT.water[0] * (0.6 + 0.6 * k), f[1] * g + TINT.water[1] * (0.6 + 0.6 * k), f[2] * g + TINT.water[2] * (0.7 + 0.8 * k), 1];
    }
    if (kind === 'blood') {
      let c = lerp3(lerp3(f, TINT.blood, 0.62 + 0.3 * k), [40, 0, 6], k * 0.45);
      c = lerp3(c, lerp3(f, [70, 24, 14], 0.8 - 0.1 * k), dry);
      if (lit && dry < 0.75) c = lerp3(c, [226, 104, 112], 0.6 * (1 - dry));
      if (d > 0.3 && n > 0.996 && dry < 0.3) c = [196, 60, 66];
      return c.concat(1);
    }
    // goo
    if (lit) return [176, 250, 120, 1];
    if (d > 0.25 && n > 0.975) return [150, 236, 100, 1];
    return lerp3(lerp3(f, TINT.toxic, 0.7), [20, 64, 22], k * 0.5).concat(1);
  }
  /* the floor under a puddle's box, from the level's cached chunks (walls included, so the puddle can stop at them) */
  function floorUnder(L, x0, y0, w, h) {
    if (!L || !L.chunk || !L.isLevel) return null;
    const size = 8 * 32;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true });
    for (let cy = Math.floor(y0 / size); cy <= Math.floor((y0 + h) / size); cy++) for (let cx = Math.floor(x0 / size); cx <= Math.floor((x0 + w) / size); cx++) {
      if (cx < 0 || cy < 0) continue;
      g.drawImage(L.chunk(cx, cy), cx * size - x0, cy * size - y0);
    }
    return g.getImageData(0, 0, w, h).data;
  }
  A.floorUnder = floorUnder;
  const ART = new WeakMap();
  function puddleArt(p) {
    const q = p.born !== undefined ? 2 : 1; // growing kill blood is rebuilt every 2 px, not on every kill
    const dry = Math.round(dryOf(p) * 4) / 4, rx = Math.max(3, Math.round(p.rx / q) * q), ry = Math.max(2, Math.round(p.ry / q) * q);
    const key = p.kind + ' ' + rx + ' ' + ry + ' ' + dry;
    let c = ART.get(p);
    if (c && c.key === key) return c;
    const s = seedOf(p), blood = p.kind === 'blood';
    const amp = blood ? [0.1, 0.09, 0.07, 0.05] : [0.08, 0.06, 0.04, 0.02], fr = [2, 3, 5, blood ? 9 : 7], ph = fr.map((_, i) => hash(s, i + 1) * U.TAU);
    const rim = (th) => { let r = 0.92; for (let i = 0; i < 4; i++) r += amp[i] * Math.sin(fr[i] * th + ph[i]); return r; };
    const ox = Math.ceil(rx * 1.45) + 3, oy = Math.ceil(ry * 1.45) + 3, w = ox * 2, h = oy * 2;
    const dep = new Float32Array(w * h), top = new Int16Array(w).fill(-1);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const u = (x + 0.5 - ox) / rx, v = (y + 0.5 - oy) / ry;
      const d = 1 - Math.hypot(u, v) / rim(Math.atan2(v, u));
      dep[y * w + x] = d;
      if (d > 0 && top[x] < 0) top[x] = y;
    }
    const ground = document.createElement('canvas'), mask = document.createElement('canvas');
    ground.width = mask.width = w;
    ground.height = mask.height = h;
    const gc = ground.getContext('2d'), mc = mask.getContext('2d'), gi = gc.createImageData(w, h), mi = mc.createImageData(w, h);
    const k = KINDS[p.kind] || 0, gloss = blood ? 1 - 0.85 * dry : 1;
    // a puddle lies on floor only (it stops at walls, pits and rims), in the colours of that floor
    const L = G.level, wx0 = Math.round(p.x) - ox, wy0 = Math.round(p.y) - oy;
    const fl = p.kind !== 'lava' ? floorUnder(L, wx0, wy0, w, h) : null;
    const onFloor = (x, y) => !L || !L.isLevel || L.cell(Math.floor((wx0 + x) / 32), Math.floor((wy0 + y) / 32)) === 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, o = i * 4;
      if (!onFloor(x, y)) { dep[i] = -1; continue; }
      const d = dep[i];
      const col = groundPx(p.kind, d, (x + 0.5 - ox) / rx, (y + 0.5 - oy) / ry, hash(s + x * 7, y * 13 + 1), dry, s, x, y, fl ? [fl[o], fl[o + 1], fl[o + 2]] : null);
      if (col) { gi.data[o] = col[0]; gi.data[o + 1] = col[1]; gi.data[o + 2] = col[2]; gi.data[o + 3] = Math.round(col[3] * 255); }
      if (d > 0) {
        mi.data[o] = k * 60 + 20;
        mi.data[o + 1] = p.kind === 'lava' ? 255 : Math.min(255, y - top[x]);
        mi.data[o + 2] = Math.min(255, Math.round(d * 1.6 * 255));
        mi.data[o + 3] = Math.round(255 * gloss * (d < 0.04 ? 0.6 : 1));
      }
    }
    gc.putImageData(gi, 0, 0);
    mc.putImageData(mi, 0, 0);
    c = { key, ground, mask, ox, oy };
    ART.set(p, c);
    return c;
  }
  /* draws one puddle's ground or mask image, centred, grown by its spread */
  function drawPuddle(ctx, p, x, y, which) {
    const a = puddleArt(p), k = spreadOf(p), img = a[which];
    if (k >= 1) ctx.drawImage(img, Math.round(x - a.ox), Math.round(y - a.oy));
    else ctx.drawImage(img, Math.round(x - a.ox * k), Math.round(y - a.oy * k), Math.round(img.width * k), Math.round(img.height * k));
  }

  /* ------------------------------------------------------------------ tracks */
  /* feet that walked through blood, water or goo print it for a while: shoes for heroes and sidekicks, paws for
     monsters (not flyers), fainter with every step as the feet dry. Prints are floor, so the shader leaves them be. */
  const TRACK = { blood: { n: 18, life: 50 }, water: { n: 9, life: 8 }, toxic: { n: 12, life: 24 }, snow: { n: 1e9, life: 26 } };
  const PCOL = { blood: [104, 4, 14, 235], dried: [66, 20, 12, 220], water: [8, 12, 22, 105], toxic: [72, 152, 44, 220], snow: [70, 96, 150, 120], mask: [80, 0, 128, 255] };
  const MAXP = 360;
  A.prints = [];
  const PRINT = new Map();
  function printArt(kind, dir, side, paw) {
    const key = kind + dir + side + (paw ? 'p' : 's');
    let c = PRINT.get(key);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = c.height = 9;
    const cx = c.getContext('2d'), id = cx.createImageData(9, 9), col = PCOL[kind];
    const phi = (dir / 16) * U.TAU, cs = Math.cos(phi), sn = Math.sin(phi);
    const ell = (lx, ly, ex, ey, ax, ay) => ((lx - ex) / ax) ** 2 + ((ly - ey) / ay) ** 2 <= 1;
    for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) {
      const px = x - 4, py = y - 4, lx = px * cs + py * sn, ly = -px * sn + py * cs; // into the print's frame, toes up
      const sx = lx + (side ? 0.3 : -0.3);
      const on = paw
        ? ell(sx, ly, 0, 0.9, 1.8, 1.5) || ell(sx, ly, -1.7, -1.3, 0.95, 0.95) || ell(sx, ly, 0, -2.1, 0.95, 0.95) || ell(sx, ly, 1.7, -1.3, 0.95, 0.95)
        : ell(sx, ly, 0, -1.1, 1.7, 2.3) || ell(sx, ly, 0, 2.1, 1.4, 1.1);
      if (!on) continue;
      const o = (y * 9 + x) * 4;
      id.data[o] = col[0]; id.data[o + 1] = col[1]; id.data[o + 2] = col[2]; id.data[o + 3] = col[3];
    }
    cx.putImageData(id, 0, 0);
    PRINT.set(key, c);
    return c;
  }
  const printAlpha = (q) => { const life = TRACK[q.kind].life, age = G.wall - q.born; return q.str * (1 - sstep(life * 0.55, life, age)); };
  /* snow (the Frozen Kingdom, PLAN.md 18 K3): every foot leaves a dent, except on the ice */
  const snowy = () => !!(G.level && G.level.biome === 'frozen' && !G.level.isTown);
  const onIce = (x, y) => { const L = G.level; if (!L || !L.ice) return false; for (const q of L.ice) { const dx = (x - q.x) / q.rx, dy = (y - q.y) / q.ry; if (dx * dx + dy * dy < 1) return true; } return false; };
  function walk(a, fx, fy, paw, air, list) {
    if (air) { a._tx = undefined; return; }
    if (!a._wet && snowy() && !onIce(fx, fy)) a._wet = { kind: 'snow', n: 1e9, max: 1e9 };
    if (a._wet && a._wet.kind === 'snow' && onIce(fx, fy)) a._wet = null;
    let pd = null;
    for (const p of list) if (inside(p, fx, fy, 0)) { pd = p; break; }
    if (pd) { // standing in it: the feet soak it up, no prints inside the puddle
      const T = TRACK[pd.kind];
      a._wet = T ? { kind: pd.kind, n: T.n, max: T.n } : null;
      a._tx = fx; a._ty = fy; a._ta = 0;
      return;
    }
    if (!a._wet) return;
    if (a._tx === undefined) { a._tx = fx; a._ty = fy; a._ta = 0; return; }
    const dx = fx - a._tx, dy = fy - a._ty, d = Math.hypot(dx, dy);
    a._tx = fx; a._ty = fy;
    if (d > 40) return; // a teleport: no trail across the gap
    if (d < 0.01) return;
    const ux = dx / d, uy = dy / d, stride = paw ? 6 : 8, dir = (((Math.round(((Math.atan2(dy, dx) + Math.PI / 2) / U.TAU) * 16)) % 16) + 16) % 16;
    let acc = a._ta + d;
    while (acc >= stride && a._wet) {
      const back = acc - stride, w = a._wet, side = (a._side = !a._side) ? 1 : 0, off = side ? 1.6 : -1.6;
      if (A.prints.length >= MAXP) A.prints.shift();
      A.prints.push({ x: fx - ux * back - uy * off, y: fy - uy * back + ux * off * 0.7, d: dir, s: side, kind: w.kind, str: Math.pow(w.n / w.max, 0.6), born: G.wall, paw });
      if (--w.n <= 0) a._wet = null;
      acc -= stride;
    }
    a._ta = acc;
  }
  function tracks(dt) {
    if ((A.pclean = (A.pclean || 0) - dt) <= 0) { A.pclean = 2; A.prints = A.prints.filter((q) => G.wall - q.born < TRACK[q.kind].life); }
    const list = A.puddles();
    for (const p of G.players) p.onIce = onIce(p.x, p.y + 12);
    if (!list.length && !snowy()) return;
    for (const p of G.players) if (!p.dead) walk(p, p.x, p.y + 12, false, p.z > 4, list);
    if (CH.SK) for (const s of CH.SK.list) if (s.state !== 'down') walk(s, s.x, s.y + 8, false, false, list);
    for (const e of G.enemies) {
      if (e.dead || e.isSpawner || e.state === 'spawn') continue;
      walk(e, e.x, e.y + Math.min(14, ((e.look && e.look.foot) || 6) * (e.scale || 1)), true, !!(e.look && e.look.fly), list);
    }
  }
  G.on('kill', function (e) {
    if (!e.training && !e.isSpawner) A.addBlood(e.x, e.y + 4, e.isBoss ? 18 : e.r || 6);
  });
  const inside = (p, x, y, r) => { const dx = (x - p.x) / (p.rx + r * 0.6), dy = (y - p.y) / (p.ry + r * 0.4); return dx * dx + dy * dy < 1; };
  function puddlesTick(dt) {
    if (G.state !== 'playing') return;
    A.pt = (A.pt || 0) - dt;
    if (A.pt > 0) return;
    A.pt = 0.4;
    const list = A.puddles();
    for (const p of list) {
      if (p.kind === 'water' || p.kind === 'blood') {
        // walking through water: ripples (and it puts out anything burning)
        for (const pl of G.players) if (!pl.dead && p.kind === 'water' && inside(p, pl.x, pl.y + 8, 6) && (pl.vx || pl.vy)) FX.ring(pl.x, pl.y + 10, 2, 12, '#9fd8ef', 0.4);
        continue;
      }
      for (const pl of G.players) {
        if (pl.dead || !inside(p, pl.x, pl.y + 8, pl.r || 6) || pl.z > 4) continue;
        if (p.kind === 'lava') G.hurtPlayer(G.edmg(6), { x: p.x, y: p.y, fx: 'fire' }, { p: pl });
        else { G.hurtPlayer(G.edmg(2), { x: p.x, y: p.y, fx: 'toxic' }, { p: pl, slow: { t: 1.2, mul: 0.8 } }); }
      }
      // a camp's loiterers live with its puddles: a hit would count as the hero's and wake the camp (js/setpieces.js)
      for (const e of G.enemies) if (!e.dead && !e.isBoss && !e.isSpawner && !e.loiter && inside(p, e.x, e.y + 6, e.r)) X.hitEnemy(e, p.kind === 'lava' ? 9 : 3, G.player, p.kind === 'lava' ? 'fire' : 'toxic');
    }
  }

  /* ------------------------------------------------------------------ the 2D side of the post-process: lights and mask */
  const mask = document.createElement('canvas');
  mask.width = W;
  mask.height = H;
  const mx = mask.getContext('2d');
  A.mask = mask;
  A.maskUsed = false;
  A.beginFrame = function () {
    mx.setTransform(1, 0, 0, 1, 0, 0);
    mx.clearRect(0, 0, W, H);
    A.lights.length = 0;
    A.maskUsed = false;
  };
  const KC = [[0.3, 0.3, 0.3], [0.5, 0.0, 0.03], [0.1, 0.6, 0.1], [1.0, 0.45, 0.1]];
  CH.Hooks.world.push((ctx, cam, v) => {
    const off = v.off || 0;
    // lights, in canvas coordinates
    const add = (x, y, r, c, i) => {
      const sx = x - cam.x + off, sy = y - cam.y;
      if (sx < -r || sx > W + r || sy < -r || sy > H + r || A.lights.length >= 28) return;
      A.lights.push([sx, sy, r, c[0], c[1], c[2], i === undefined ? 1 : i]);
    };
    for (const p of G.players) if (!p.dead) { add(p.x, p.y - 6, 130, [1, 0.88, 0.62], 1); if (p.fireT > 0) add(p.x, p.y - 6, 70, [1, 0.8, 0.4], 0.9); }
    if (CH.SK) for (const s of CH.SK.list) if (s.state !== 'down') add(s.x, s.y - 4, 62, [0.8, 0.85, 1], 0.7);
    const L = G.level;
    if (L) {
      if (L.exit) add(L.exit.x, L.exit.y, L.exit.open ? 95 : 40, L.exit.open ? [1, 0.9, 0.4] : [0.5, 0.4, 0.2], 0.9);
      for (const w of L.waypoints || []) add(w.x, w.y, 50, w.active ? [0.4, 1, 0.5] : [0.3, 0.5, 0.3], 0.8);
      for (const c of L.chests || []) if (!c.opened) add(c.x, c.y, 26, [1, 0.8, 0.3], 0.8);
      for (const s of L.shrines || []) if (!s.used) add(s.x, s.y, 52, [0.9, 0.3, 0.8], 0.9);
      if (L.portal) add(L.portal.x, L.portal.y, 80, [0.3, 0.8, 1], 1);
      if (L.isTown) for (const n of L.npcs) add(n.px, n.py, 70, [1, 0.8, 0.5], 0.9);
      const glow = { hive: [1, 0.7, 0.2], portal: [1, 0.2, 0.85], grave: [0.4, 1, 0.4], gate: [1, 0.55, 0.1], camp: [1, 0.3, 0.2], rift: [0.3, 0.8, 1] };
      for (const e of G.enemies) if (e.isSpawner && !e.dead) add(e.x, e.y - 6, 78, glow[e.kind] || [1, 0.6, 0.3], 1);
    }
    for (const pr of G.projectiles) if (!pr.dead && pr.owner === 'p') add(pr.x, pr.y, 34, [1, 0.8, 0.5], 0.7);
    for (const s of A.strikes) add(s.x, s.y, 60, [0.8, 0.9, 1], 0.6 + (0.9 - s.t));
    // puddle mask for this view (clipped to the view's slice)
    const list = A.puddles();
    if (!list.length) return;
    mx.save();
    mx.setTransform(1, 0, 0, 1, off, 0);
    mx.beginPath();
    mx.rect(v.x - off, 0, v.w, H);
    mx.clip();
    for (const p of list) {
      const x = p.x - cam.x, y = p.y - cam.y;
      if (x < -p.rx * 1.5 || x > W + p.rx * 1.5 || y < -p.ry * 1.5 || y > H + p.ry * 1.5) continue;
      drawPuddle(mx, p, x, y, 'mask');
      A.maskUsed = true;
    }
    // fresh blood prints are still wet: a little shine for their first seconds
    for (const q of A.prints) {
      if (q.kind !== 'blood' || G.wall - q.born > 8) continue;
      const x = Math.round(q.x - cam.x), y = Math.round(q.y - cam.y);
      if (x < -6 || x > W + 6 || y < -6 || y > H + 6) continue;
      mx.globalAlpha = q.str * 0.8 * (1 - (G.wall - q.born) / 8);
      mx.drawImage(printArt('mask', q.d, q.s, q.paw), x - 4, y - 4);
    }
    mx.globalAlpha = 1;
    mx.restore();
  });
  /* the ground layer of puddles, drawn right after the floor so entities stand on top; the shader adds the shimmer */
  /* two copies of each view, taken by js/render.js: the floor (after animated tiles and the rain sheen) and the same
     frame once the characters are on it, before the full-screen tints, rays and vignette. Where they differ something
     stands there, so puddles never shimmer over heroes, monsters or shadows; comparing against the final frame
     instead made every overlay count as a character and switched the puddles off. */
  const snapCv = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  A.floor = snapCv();
  A.actors = snapCv();
  A.snap = function (which, ctx, v) {
    if (!CH.PostFX || !CH.PostFX.on || !(A.puddles().length || A.prints.length)) return;
    const c = (which === 'floor' ? A.floor : A.actors).getContext('2d'), x = Math.max(0, Math.round(v.x)), w = Math.min(W - x, Math.round(v.w));
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(x, 0, w, H);
    c.drawImage(ctx.canvas, x, 0, w, H, x, 0, w, H);
  };
  const origBg = CH.Arenas.drawBg;
  CH.Arenas.drawBg = function (ctx, arena, cam) {
    origBg(ctx, arena, cam);
    const list = A.puddles();
    for (const p of list) {
      const x = p.x - cam.x, y = p.y - cam.y;
      if (x < -p.rx * 1.5 || x > W + p.rx * 1.5 || y < -p.ry * 1.5 || y > H + p.ry * 1.5) continue;
      drawPuddle(ctx, p, x, y, 'ground');
    }
    for (const q of A.prints) {
      const x = Math.round(q.x - cam.x), y = Math.round(q.y - cam.y);
      if (x < -6 || x > W + 6 || y < -6 || y > H + 6) continue;
      const a = printAlpha(q);
      if (a <= 0.02) continue;
      ctx.globalAlpha = a;
      ctx.drawImage(printArt(q.kind === 'blood' && G.wall - q.born > 20 ? 'dried' : q.kind, q.d, q.s, q.paw), x - 4, y - 4);
    }
    ctx.globalAlpha = 1;
  };
  wrap(G, 'render', function (orig) {
    A.beginFrame();
    return orig.call(G);
  });

  /* ------------------------------------------------------------------ weather drawn in 2D (screen space, per view) */
  CH.Hooks.screen.push((ctx, cam, v) => {
    const m = A.mode;
    if (CH.Storage.settings.reduced) return;
    // telegraphs of lightning strikes belong to the world: drawn here in screen space using the view camera
    for (const s of A.strikes) {
      const x = s.x - cam.x, y = s.y - cam.y;
      if (x < v.x - 40 || x > v.x + v.w + 40) continue;
      const k = 1 - s.t / 0.9;
      ctx.globalAlpha = 0.3 + 0.5 * k;
      FX.circleOutline(ctx, Math.round(x), Math.round(y), Math.round(s.r * (1.2 - 0.2 * k)), '#cfe8ff');
      ctx.globalAlpha = 1;
    }
    if (!A.particles.length) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(v.x, 0, v.w, H);
    ctx.clip();
    for (const p of A.particles) {
      const x = Math.round(v.x + (p.x % v.w + v.w) % v.w), y = Math.round(p.y);
      if (m === 'snow' || m === 'blizzard') {
        const fl = p.z > 0.85 && CH.Assets.images['kit.fk18.' + (Math.floor(p.ph * 7) % 7 + 3)]; // the nearest flakes: the pack's own (Frozen 18)
        if (fl) { ctx.globalAlpha = 0.85; ctx.drawImage(fl, Math.round(x - fl.width / 2), Math.round(y - fl.height / 2)); ctx.globalAlpha = 1; }
        else { ctx.fillStyle = 'rgba(255,255,255,' + (0.5 + 0.4 * p.z) + ')'; const s = p.z > 0.6 ? 2 : 1; ctx.fillRect(x, y, s, s); if (m === 'blizzard') ctx.fillRect(x - 3, y, 3, 1); }
      }
      else if (m === 'ash') { ctx.fillStyle = 'rgba(' + (p.z > 0.8 ? '255,120,40' : '90,80,80') + ',' + (0.5 + 0.3 * p.z) + ')'; ctx.fillRect(x, y, 1 + (p.z > 0.5 ? 1 : 0), 1); }
      else if (m === 'firestorm') { ctx.fillStyle = p.z > 0.5 ? 'rgba(255,140,40,0.85)' : 'rgba(255,220,120,0.8)'; ctx.fillRect(x, y, 1 + (p.z > 0.7 ? 1 : 0), 1); }
      else if (m === 'bloodrain') { ctx.fillStyle = 'rgba(150,10,25,' + (0.4 + 0.4 * p.z) + ')'; ctx.fillRect(x, y, 1, 3 + (p.z > 0.6 ? 2 : 0)); }
    }
    if (m === 'fog' || m === 'blizzard') {
      ctx.globalAlpha = m === 'blizzard' ? 0.15 : 0.14; // drifting banks, thin enough to see the stage through (PLAN.md 20)
      ctx.fillStyle = m === 'blizzard' ? '#eef4fa' : '#a0a8b8';
      for (let i = 0; i < 5; i++) { const fx = ((A.k * (6 + i * 3) + i * 150) % (v.w + 260)) - 130; ctx.beginPath(); ctx.ellipse(v.x + fx, 60 + i * 62 + Math.sin(A.k * 0.4 + i) * 10, 150, 28, 0, 0, U.TAU); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  });

  /* ------------------------------------------------------------------ the Day & Night widget (HUD) */
  const NAMES = ['1 Dawn', '2 Day', '3 Noon', '4 Night', '5 Lightning 1', '6 Lightning 2', '7 Lightning 3', '8 Lightning 4', '9 Lightning 5', '10 Raining', '11 Rain + Light 1', '12 Rain + Light 2', '13 Rain + Light 3', '14 Rain + Light 4', '15 Rain + Light 5'];
  A.widgetState = () => {
    const rainy = A.mode === 'rain' || A.mode === 'storm' || A.mode === 'bloodrain';
    const k = Math.max(1, Math.min(5, A.k2 || 1));
    if (A.flash > 0.2) return rainy ? 10 + k : 4 + k; // index into NAMES (1-based folder numbers): rain + light, or lightning
    if (rainy) return 10;
    const ph = A.phase(A.clock);
    return ph === 'dawn' || ph === 'dusk' ? 1 : ph === 'night' ? 4 : ph === 'noon' ? 3 : 2;
  };
  CH.Hooks.screen.push((ctx, cam, v) => {
    if (G.state === 'menu' || !CH.UIK || !CH.UIK.on) return;
    if (v !== G.views[0] && G.views.length > 1) return; // one widget, on the first view
    const st = A.widgetState();
    // 10 frames loop at 8 fps; the strike flash plays on frame 6 of the lightning states, the pack's white flash frame
    let f = Math.floor(A.k * 8) % 10 + 1;
    if (A.flash > 0.2 && st !== 1 && st !== 2 && st !== 3 && st !== 4 && st !== 10) f = A.flash > 0.7 ? 6 : f;
    // in the right-hand column under the minimap (PLAN.md 20): the top centre is the omen's and the banners'
    const x = Math.round(v.x + v.w - 86), y = 150;
    ctx.globalAlpha = 0.95;
    CH.UIK.draw(ctx, '0 - Sprites/Day & Night Cycle/' + NAMES[st - 1] + '/' + f + '.png', x, y, { w: 96, h: 80, sw: 96, sh: 80, sx: 0, sy: 0, dw: 64, dh: 53 });
    ctx.globalAlpha = 1;
  });

  /* night: enemies hit 10% harder, loot is 15% richer */
  const eDmg = G.edmg;
  G.edmg = (base) => eDmg(base) * (G.night ? 1.1 : 1);
  wrap(G, 'dropLoot', function (orig, e, who) {
    if (G.night && Math.random() < 0.15) orig.call(G, e, who);
    return orig.call(G, e, who);
  });

  G.on('step', function (dt) {
    if (G.state === 'playing') A.update(dt);
  });
  /* every stage (and boss arena) gets its own weather and hour */
  G.on('startWave', function (ev) {
    const n = ev.n;
    const biome = G.level ? G.level.biome : G.arena ? G.arena.id : 'backyard';
    if (!(G.level && G.level.isTown)) A.forStage(biome, n, U.seeded(((G.runSeed || 0) + n * 131) >>> 0));
  });
  G.on('newRun:before', function () { A.dyn.length = 0; A.prints.length = 0; A.strikes.length = 0; A.flash = 0; });
})(window.CH);
