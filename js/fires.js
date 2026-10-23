/* CHAOS.exe - campfires (the Chromatic Campfires pack). Lit props placed through the levels, the town and the boss
   arenas: the sprite sways in the wind (the flame and smoke are drawn in 1px slices, sheared more the higher they are),
   embers drift off downwind, and every fire is a flickering light that casts shadows - walls and solid props are drawn
   into an occluder canvas and js/postfx.js marches rays from each pixel toward the nearest fires. The wind itself
   depends on the weather: a breath on a clear day, a gale in a storm or a blizzard. */
(function (CH) {
  'use strict';
  const B = CH.Balance;
  const U = CH.U;
  const G = CH.G;
  const A = CH.Atmos;
  const wrap = CH.X.wrap;
  const W = B.view.w, H = B.view.h;
  const TS = CH.Level.TS;

  const Fires = (CH.Fires = { wind: 0.35, embers: [] });

  /* ------------------------------------------------------------------ wind */
  const WIND = { clear: 0.35, rain: 0.7, storm: 1.5, wind: 1.6, blizzard: 1.9, snow: 0.45, ash: 0.8, firestorm: 1.5, fog: 0.2, bloodrain: 0.7, glitch: 0.5, none: 0.25 };
  Fires.update = function (dt) {
    const target = WIND[A.mode] !== undefined ? WIND[A.mode] : 0.35;
    Fires.wind += (target - Fires.wind) * Math.min(1, dt * 0.6);
  };
  /* horizontal lean at position x: a steady push with slow gusts and a quick flutter, in [-0.3, 2] */
  Fires.sway = function (x) {
    if (CH.Storage.settings.reduced) return Fires.wind * 0.3;
    const t = G.wall;
    const gust = 0.55 + 0.45 * Math.sin(t * 0.9 + x * 0.006) * Math.sin(t * 0.37 + 1.3);
    return Fires.wind * gust + 0.12 * Math.sin(t * 4.6 + x * 0.05) * (0.4 + Fires.wind * 0.3);
  };
  Fires.windMul = () => 0.6 + Fires.wind * 0.7;
  wrap(A, 'update', function (orig, dt) { Fires.update(dt); return orig.call(A, dt); });

  /* ------------------------------------------------------------------ props */
  const LIGHT = { amber: [1, 0.62, 0.25], orange: [1, 0.46, 0.18], cyan: [0.12, 0.55, 0.95], green: [0.45, 1, 0.38], purple: [0.68, 0.4, 1] };
  const BIOME = { backyard: 'amber', office: 'orange', glitch: 'cyan', zombie: 'green', wasteland: 'orange', volcano: 'orange', dungeon: 'purple', frozen: 'cyan' };
  const hash = (a, b) => { let n = (a * 374761393 + b * 668265263) | 0; n = (n ^ (n >> 13)) * 1274126177; return ((n ^ (n >> 16)) >>> 0) / 4294967296; };

  Fires.place = function (props, x, y, color, smoke) {
    const name = (smoke ? 'prop.campsmoke.' : 'prop.camp.') + color;
    if (!CH.Assets.images[name]) return null;
    CH.Arenas.addProp(props, name, x, y, { kind: 'fire', solid: true, cr: 9, cy: -4, jumpable: true, elevation: 9 });
    const p = props[props.length - 1];
    p.fire = true;
    p.color = color;
    p.smoke = !!smoke;
    p.phase = hash(Math.round(x), Math.round(y));
    return p;
  };
  const clearOf = (props, x, y, d) => !props.some((q) => U.dist(x, y, q.x, q.y) < d);

  /* levels: beside the entrance, beside each waypoint, and in roughly a third of the other rooms */
  const LG = CH.LevelGen;
  wrap(LG, 'generate', function (orig, biome, ...rest) {
    const L = orig.call(LG, biome, ...rest);
    if (CH.SetPieces && CH.SetPieces.on) return L; // the set pieces put fires where they make sense (camps, the start)
    const color = BIOME[biome] || 'amber';
    const seed = Math.round(L.entrance.x * 7 + L.entrance.y * 13) + L.tw;
    let n = 0;
    const at = (cx, cy, rmin, rmax, avoid) => {
      for (let t = 0; t < 8; t++) {
        const p = L.randomNear(cx, cy, rmin, rmax, 26, () => hash(seed, n++));
        if (p && clearOf(L.props, p.x, p.y, 62) && !avoid.some((q) => q && U.dist(p.x, p.y, q.x, q.y) < 64)) return p;
      }
      return null;
    };
    const put = (p) => { if (p) Fires.place(L.props, p.x, p.y, color, hash(seed, n++) < 0.65); };
    const reserved = [L.entrance, L.exit].concat(L.waypoints, L.spawners, L.chests, L.shrines);
    put(at(L.entrance.x, L.entrance.y, 56, 96, reserved) || at(L.entrance.x, L.entrance.y, 40, 150, reserved) || at(L.entrance.x, L.entrance.y, 30, 230, reserved));
    for (const w of L.waypoints) put(at(w.x, w.y, 50, 80, reserved));
    for (const r of L.rooms) {
      if (r.tag === 'start' || hash(seed, r.id * 31 + 5) > 0.34) continue;
      put(at(r.cx, r.cy, 24, Math.max(40, Math.min((r.w || 10) * TS * 0.3, 150)), reserved));
    }
    return L;
  });

  /* boss and wave arenas: four braziers around the fighting ground */
  wrap(CH.Arenas, 'build', function (orig, id) {
    const a = orig.call(CH.Arenas, id);
    const color = BIOME[a.id] || 'amber';
    const m = B.arena.margin + 50;
    let k = 0;
    for (const [fx, fy] of [[0.17, 0.2], [0.83, 0.2], [0.17, 0.8], [0.83, 0.8]]) {
      const x = U.clamp(a.w * fx, m, a.w - m), y = U.clamp(a.h * fy, m, a.h - m);
      for (const [ox, oy] of [[0, 0], [50, 0], [-50, 0], [0, 50], [0, -50], [90, 40], [-90, -40]]) {
        const px = U.clamp(x + ox, m, a.w - m), py = U.clamp(y + oy, m, a.h - m);
        if (clearOf(a.props, px, py, 54)) { Fires.place(a.props, px, py, color, k++ % 2 === 0); break; }
      }
    }
    return a;
  });

  /* the town: a ring of fires around the plaza */
  if (CH.Town) {
    wrap(CH.Town, 'build', function (orig) {
      const L = orig.call(CH.Town);
      for (const [tx, ty] of [[22, 16], [34, 16], [20, 27], [36, 27], [25, 29], [31, 29], [28, 14]]) {
        const x = tx * TS + 16, y = ty * TS + 16;
        if (L.solidAt(x, y) || !clearOf(L.props, x, y, 50) || L.npcs.some((n) => U.dist(x, y, n.px, n.py) < 56)) continue;
        Fires.place(L.props, x, y, 'amber', true);
      }
      return L;
    });
  }

  /* ------------------------------------------------------------------ drawing: the sprite sheared by the wind */
  Fires.draw = function (ctx, prop, x, y) {
    const im = CH.Assets.images[prop.sprite];
    if (!im) return;
    const t = G.wall;
    const frame = Math.floor(t * 9 + prop.phase * 4) & 3;
    const h = im.height;
    const lean = Fires.sway(prop.x);
    const dx = Math.round(x) - 24, dy = Math.round(y) - (h - 12);
    const top = prop.smoke ? 40 : 27; // rows above this bend, the stone ring and logs stay put
    ctx.drawImage(im, frame * 48, top, 48, h - top, dx, dy + top, 48, h - top);
    const amp = (prop.smoke ? 11 : 6) * lean;
    for (let sy = 0; sy < top; sy++) {
      const k = (top - sy) / top;
      ctx.drawImage(im, frame * 48, sy, 48, 1, dx + Math.round(amp * k * k), dy + sy, 48, 1);
    }
  };

  /* ember sparks lifting off every visible fire */
  Fires.tick = function (dt) {
    const E = Fires.embers;
    for (let i = E.length - 1; i >= 0; i--) {
      const e = E[i];
      e.life -= dt;
      if (e.life <= 0) { E.splice(i, 1); continue; }
      e.x += (e.vx + Fires.wind * 22) * dt;
      e.y += e.vy * dt;
      e.vx += Math.sin(G.wall * 6 + e.x) * 10 * dt;
    }
  };
  const colorOf = { amber: '#ffcf5a', orange: '#ff8a3c', cyan: '#8cf2ff', green: '#b6ff6a', purple: '#c9a0ff' };
  let lastT = 0;

  /* ------------------------------------------------------------------ light and shadow */
  const occ = document.createElement('canvas');
  occ.width = W;
  occ.height = H;
  const ox = occ.getContext('2d');
  A.occ = occ;
  A.occUsed = false;
  const prevBegin = A.beginFrame;
  A.beginFrame = function () {
    ox.setTransform(1, 0, 0, 1, 0, 0);
    ox.clearRect(0, 0, W, H);
    A.occUsed = false;
    return prevBegin.apply(A, arguments);
  };

  CH.Hooks.world.push((ctx, cam, v) => {
    const props = G.arena && G.arena.props;
    if (!props) return;
    const off = v.off || 0;
    const now = G.wall;
    const dt = Math.min(0.05, Math.max(0, now - lastT));
    const fires = [];
    for (const p of props) {
      if (!p.fire && !p.glow) continue;
      const sx = p.x - cam.x, sy = p.y - cam.y;
      if (sx < -170 || sx > W + 170 || sy < -170 || sy > H + 170) continue;
      fires.push(p);
    }
    if (!fires.length) return;
    // the 6 nearest fires cast shadows, the rest only light
    const ref = G.player || { x: cam.x + W / 2, y: cam.y + H / 2 };
    fires.sort((a, b) => U.dist2(a.x, a.y, ref.x, ref.y) - U.dist2(b.x, b.y, ref.x, ref.y));
    fires.forEach((p, i) => {
      if (p.glow) { // a lamp, brazier or barrel from the sheets: steadier than a campfire
        const fl = 1 + 0.05 * Math.sin(now * 9 + p.phase * 30) + 0.03 * Math.sin(now * 23 + p.phase * 7);
        if (A.lights.length < 28) A.lights.push([p.x - cam.x + off, p.y - cam.y - 16, p.lr * fl, p.glow[0], p.glow[1], p.glow[2], 0.62 * fl, i < 6 ? 3 : 2]);
        return;
      }
      const lean = Fires.sway(p.x);
      const flick = 1 + 0.07 * Math.sin(now * 13 + p.phase * 40) + 0.05 * Math.sin(now * 31 + p.phase * 9) + 0.03 * Math.sin(now * 7.3);
      const c = LIGHT[p.color] || LIGHT.amber;
      const sx = p.x - cam.x + off + lean * 3, sy = p.y - cam.y - 12;
      if (A.lights.length < 28) A.lights.push([sx, sy, 128 * flick, c[0], c[1], c[2], 0.72 * flick, i < 6 ? 3 : 2]);
      if (!CH.Storage.settings.reduced && Math.random() < 0.06 && Fires.embers.length < 80) {
        Fires.embers.push({ x: p.x + (Math.random() - 0.5) * 8, y: p.y - 14, vx: (Math.random() - 0.5) * 12, vy: -(16 + Math.random() * 20), life: 0.7 + Math.random() * 0.8, c: colorOf[p.color] });
      }
    });
    for (const e of Fires.embers) {
      const ex = Math.round(e.x - cam.x), ey = Math.round(e.y - cam.y);
      if (ex < -4 || ex > W + 4 || ey < -4 || ey > H + 4) continue;
      ctx.globalAlpha = Math.min(1, e.life * 1.6);
      ctx.fillStyle = e.c;
      ctx.fillRect(ex, ey, 1, 1);
    }
    ctx.globalAlpha = 1;
    if (lastT !== now) { Fires.tick(dt); lastT = now; }

    // occluders for this view: wall tiles and solid props (the fires themselves never shade their own surroundings)
    const L = G.level;
    ox.save();
    ox.setTransform(1, 0, 0, 1, off, 0);
    ox.beginPath();
    ox.rect(v.x - off, 0, v.w, H);
    ox.clip();
    ox.fillStyle = '#000';
    if (L && L.cells) {
      const tx0 = Math.max(0, Math.floor(cam.x / TS)), ty0 = Math.max(0, Math.floor(cam.y / TS));
      const tx1 = Math.min(L.tw - 1, Math.floor((cam.x + W) / TS)), ty1 = Math.min(L.th - 1, Math.floor((cam.y + H) / TS));
      for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) if (L.solid(tx, ty)) ox.fillRect(tx * TS - cam.x, ty * TS - cam.y, TS, TS);
    }
    for (const p of props) {
      if (p.fire || p.glow || p.dead || !p.solid) continue;
      const sx = p.x - cam.x, sy = p.y - cam.y;
      if (sx < -40 || sx > W + 40 || sy < -40 || sy > H + 60) continue;
      const hw = p.kind === 'tree' ? 6 : Math.max(6, p.cr), ht = p.kind === 'tree' ? 28 : p.cr + 12;
      ox.fillRect(Math.round(sx - hw), Math.round(sy - ht), Math.round(hw * 2), Math.round(ht + 2));
    }
    ox.restore();
    A.occUsed = true;
  });
})(window.CH);
