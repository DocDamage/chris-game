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
  };

  /* ------------------------------------------------------------------ weather */
  const TABLE = {
    backyard: ['clear', 'clear', 'rain', 'storm', 'wind'], office: ['none'], glitch: ['glitch'], zombie: ['rain', 'storm', 'fog'],
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
  /* water / blood / toxic / lava: { x, y, rx, ry, kind }. Levels carry their own; blood from kills is dynamic. */
  const KINDS = { water: 0, blood: 1, toxic: 2, lava: 3 };
  A.KINDS = KINDS;
  A.puddles = () => (G.level && G.level.puddles ? G.level.puddles.concat(A.dyn) : A.dyn);
  A.addBlood = function (x, y, size) {
    let best = null, bd = 46 * 46;
    for (const p of A.dyn) { const d = U.dist2(p.x, p.y, x, y); if (p.kind === 'blood' && d < bd) { bd = d; best = p; } }
    if (best) { best.rx = Math.min(44, best.rx + size * 0.35); best.ry = Math.min(30, best.ry + size * 0.25); best.x += (x - best.x) * 0.2; best.y += (y - best.y) * 0.2; return; }
    if (A.dyn.length >= 40) A.dyn.shift();
    A.dyn.push({ x, y, rx: 6 + size * 0.6, ry: 4 + size * 0.4, kind: 'blood', born: G.wall });
  };
  wrap(G, 'killEnemy', function (orig, e) {
    const was = e.dead;
    orig.call(G, e);
    if (!was && !e.training && !e.isSpawner) A.addBlood(e.x, e.y + 4, e.isBoss ? 18 : e.r || 6);
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
      for (const e of G.enemies) if (!e.dead && !e.isBoss && !e.isSpawner && inside(p, e.x, e.y + 6, e.r)) X.hitEnemy(e, p.kind === 'lava' ? 9 : 3, G.player, p.kind === 'lava' ? 'fire' : 'toxic');
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
      if (x < -p.rx - 4 || x > W + p.rx + 4 || y < -p.ry - 4 || y > H + p.ry + 4) continue;
      const k = KINDS[p.kind] || 0;
      // red channel: kind, green: heat haze, alpha: coverage with a soft rim
      const g = mx.createRadialGradient(x, y, Math.min(p.rx, p.ry) * 0.35, x, y, Math.max(p.rx, p.ry));
      const col = 'rgba(' + (k * 60 + 20) + ',' + (p.kind === 'lava' ? 255 : 0) + ',0,';
      g.addColorStop(0, col + '1)');
      g.addColorStop(0.75, col + '0.9)');
      g.addColorStop(1, col + '0)');
      mx.fillStyle = g;
      mx.save();
      mx.translate(x, y);
      mx.scale(1, p.ry / p.rx);
      mx.translate(-x, -y);
      mx.beginPath();
      mx.arc(x, y, p.rx, 0, U.TAU);
      mx.fill();
      mx.restore();
      A.maskUsed = true;
    }
    mx.restore();
  });
  /* the ground layer of puddles, drawn right after the floor so entities stand on top; the shader adds the shimmer */
  const GROUND = { water: ['rgba(20,40,70,0.55)', 'rgba(140,190,230,0.35)'], blood: ['rgba(90,0,12,0.78)', 'rgba(150,20,30,0.5)'], toxic: ['rgba(30,90,30,0.7)', 'rgba(150,255,90,0.45)'], lava: ['rgba(120,30,0,0.95)', 'rgba(255,170,40,0.8)'] };
  /* a copy of the frame right after the floor: the shader compares against it so that puddle shimmer only touches the
     floor, never the hero or the monsters standing in the puddle */
  const floorCv = document.createElement('canvas');
  floorCv.width = W;
  floorCv.height = H;
  const fctx = floorCv.getContext('2d');
  A.floor = floorCv;
  const origBg = CH.Arenas.drawBg;
  CH.Arenas.drawBg = function (ctx, arena, cam) {
    origBg(ctx, arena, cam);
    const list = A.puddles();
    for (const p of list) {
      const x = Math.round(p.x - cam.x), y = Math.round(p.y - cam.y);
      if (x < -p.rx - 4 || x > W + p.rx + 4 || y < -p.ry - 4 || y > H + p.ry + 4) continue;
      const c = GROUND[p.kind] || GROUND.water;
      ctx.fillStyle = c[0];
      ctx.beginPath();
      ctx.ellipse(x, y, p.rx, p.ry, 0, 0, U.TAU);
      ctx.fill();
      ctx.fillStyle = c[1];
      const wob = p.kind === 'lava' ? Math.sin(A.k * 2 + p.x) * 2 : 0;
      ctx.beginPath();
      ctx.ellipse(x - p.rx * 0.18, y - p.ry * 0.2, p.rx * (0.55 + wob * 0.02), p.ry * 0.45, 0, 0, U.TAU);
      ctx.fill();
    }
    if (list.length && CH.PostFX && CH.PostFX.on) { fctx.setTransform(1, 0, 0, 1, 0, 0); fctx.drawImage(G.canvas, 0, 0); }
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
      if (m === 'snow' || m === 'blizzard') { ctx.fillStyle = 'rgba(255,255,255,' + (0.5 + 0.4 * p.z) + ')'; const s = p.z > 0.6 ? 2 : 1; ctx.fillRect(x, y, s, s); if (m === 'blizzard') ctx.fillRect(x - 3, y, 3, 1); }
      else if (m === 'ash') { ctx.fillStyle = 'rgba(' + (p.z > 0.8 ? '255,120,40' : '90,80,80') + ',' + (0.5 + 0.3 * p.z) + ')'; ctx.fillRect(x, y, 1 + (p.z > 0.5 ? 1 : 0), 1); }
      else if (m === 'firestorm') { ctx.fillStyle = p.z > 0.5 ? 'rgba(255,140,40,0.85)' : 'rgba(255,220,120,0.8)'; ctx.fillRect(x, y, 1 + (p.z > 0.7 ? 1 : 0), 1); }
      else if (m === 'bloodrain') { ctx.fillStyle = 'rgba(150,10,25,' + (0.4 + 0.4 * p.z) + ')'; ctx.fillRect(x, y, 1, 3 + (p.z > 0.6 ? 2 : 0)); }
    }
    if (m === 'fog' || m === 'blizzard') {
      ctx.globalAlpha = m === 'blizzard' ? 0.28 : 0.2;
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
    const x = Math.round(v.x + v.w / 2 - 32), y = 22;
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

  wrap(G, 'step', function (orig, dt) {
    orig.call(G, dt);
    if (G.state === 'playing') A.update(dt);
  });
  /* every stage (and boss arena) gets its own weather and hour */
  wrap(G, 'startWave', function (orig, n) {
    const r = orig.call(G, n);
    const biome = G.level ? G.level.biome : G.arena ? G.arena.id : 'backyard';
    if (!(G.level && G.level.isTown)) A.forStage(biome, n, U.seeded(((G.runSeed || 0) + n * 131) >>> 0));
    return r;
  });
  wrap(G, 'newRun', function (orig, c) { A.dyn.length = 0; A.strikes.length = 0; A.flash = 0; return orig.call(G, c); });
})(window.CH);
