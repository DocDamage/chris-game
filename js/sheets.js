/* CHAOS.exe - the sliced tileset sheets (tools/pack-sheets.js). Every piece of the Psychological Horror Dungeon,
   Volcanic Ruins, Wasteland Survivor and Zombie Apocalypse sheets is a real image 'sh.<sheet>.<n>'; the sheet's role
   decides how it is used:
     solid / hazard  blocking props in the rooms          deco   walk-through clutter
     light           props that glow (the light colour is read from the picture) and cast shadows
     decal           painted into the floor (cracks, blood, bones, hazard plates, lava pools, patches)
     gate            doors, gates and stairs that frame the entrance and the exit
   Levels get all of them from their biome's sheets; boss arenas and the town get a share too. */
(function (CH) {
  'use strict';
  const B = CH.Balance;
  const U = CH.U;
  const G = CH.G;
  const wrap = CH.X.wrap;
  const S = CH.Sprites;
  const TS = CH.Level.TS;

  const Sheets = (CH.Sheets = { alias: {}, info: {} });
  const hash = (a, b) => { let n = (a * 374761393 + b * 668265263) | 0; n = (n ^ (n >> 13)) * 1274126177; return ((n ^ (n >> 16)) >>> 0) / 4294967296; };

  /* ------------------------------------------------------------------ pools */
  const pools = {}; // biome -> role -> [key]
  let built = false;
  function build() {
    if (built) return;
    built = true;
    const M = CH.Assets.meta.sheets;
    if (!M) return;
    for (const id of Object.keys(M)) {
      const m = M[id];
      for (let i = 0; i < m.n; i++) {
        const [w, h] = m.sizes[i];
        const key = 'sh.' + id + '.' + i;
        // the corpse sheet also holds the standing zombies: only the lying bodies and bones are floor decals
        if (id === 'z_bodies' && h > w * 0.8) continue;
        // very large pieces are scenery, not props
        if (m.role !== 'decal' && (w > 120 || h > 130)) continue;
        for (const b of m.biomes) ((pools[b] = pools[b] || {})[m.role] = (pools[b][m.role] || [])).push(key);
      }
    }
  }
  Sheets.pool = (biome, role) => { build(); return ((pools[biome] || {})[role]) || []; };

  /* a sprite name for a piece (neutral alias: prop kinds are guessed from names) and the colour it glows with */
  Sheets.sprite = function (key) {
    if (Sheets.alias[key]) return Sheets.alias[key];
    const im = CH.Assets.images[key];
    const name = 'zz' + Object.keys(Sheets.alias).length;
    S.crop(name, key, 0, 0, im.width, im.height, 'feet');
    Sheets.alias[key] = name;
    // glow colour: the average of the brightest, most colourful pixels
    const c = document.createElement('canvas');
    c.width = im.width; c.height = im.height;
    const g = c.getContext('2d');
    g.drawImage(im, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    const px = [];
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) px.push([d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11, d[i], d[i + 1], d[i + 2]]);
    px.sort((a, b) => b[0] - a[0]);
    const top = px.slice(0, Math.max(1, Math.round(px.length * 0.12)));
    const avg = [0, 0, 0];
    for (const p of top) { avg[0] += p[1]; avg[1] += p[2]; avg[2] += p[3]; }
    const mx = Math.max(1, ...avg.map((v) => v / top.length));
    Sheets.info[key] = { w: im.width, h: im.height, glow: avg.map((v) => Math.min(1, v / top.length / mx)) };
    return name;
  };
  const pick = (list, r) => list[Math.floor(r * list.length) % list.length];

  /* ------------------------------------------------------------------ props */
  const place = (props, key, x, y, role) => {
    const name = Sheets.sprite(key);
    const inf = Sheets.info[key];
    const solid = role === 'solid' || role === 'hazard' || role === 'light';
    const cr = Math.max(7, Math.min(24, Math.round(inf.w * 0.34)));
    CH.Arenas.addProp(props, name, x, y, {
      solid, cr, cy: -3, jumpable: inf.h <= 52, elevation: 10,
      destructible: role === 'solid' && inf.h < 70, hp: 40, resourceType: U.pick(['wood', 'scrap', 'stone']), resourceAmt: 2,
    });
    const p = props[props.length - 1];
    p.sheet = key;
    if (role === 'light') { p.glow = inf.glow; p.lr = 70 + Math.min(40, inf.h); p.phase = hash(Math.round(x), Math.round(y)); }
    return p;
  };
  Sheets.place = place;

  /* ------------------------------------------------------------------ levels */
  const LG = CH.LevelGen;
  wrap(LG, 'generate', function (orig, biome, ...rest) {
    const L = orig.call(LG, biome, ...rest);
    build();
    if (!pools[biome]) return L;
    L.decals = [];
    const seed = Math.round(L.entrance.x * 11 + L.entrance.y * 5) + L.tw * 3;
    let n = 0;
    const r = () => hash(seed, n++);
    const reserved = [L.entrance, L.exit].concat(L.waypoints, L.spawners, L.chests, L.shrines);
    const free = (p, d, dd) => p && !reserved.some((q) => U.dist(p.x, p.y, q.x, q.y) < d) && !L.props.some((q) => U.dist(p.x, p.y, q.x, q.y) < dd);
    const at = (room, rmin, rmax, clear, d, dd) => {
      for (let t = 0; t < 6; t++) {
        const p = L.randomNear(room.cx, room.cy, rmin, rmax, clear, r);
        if (free(p, d, dd)) return p;
      }
      return null;
    };
    const P = (role) => pools[biome][role] || [];
    const corner = P('corner');
    const solid = P('solid').concat(P('hazard')), deco = P('deco'), light = P('light'), decal = P('decal'), gate = P('gate');
    const scenes = CH.SetPieces && CH.SetPieces.on; // js/setpieces.js dresses the rooms; only the gates are chosen here
    if (!scenes) for (const rm of L.rooms) {
      if (rm.tag === 'town') continue;
      const area = (rm.w || 8) * (rm.h || 8);
      const reach = Math.max(50, Math.min((rm.w || 10) * TS * 0.45, 200));
      if (corner.length && L.layout === 'dungeon' && rm.w) for (const [ox, oy, fx, fy] of [[0, 0, 0, 0], [1, 0, 1, 0], [0, 1, 0, 1], [1, 1, 1, 1]]) {
        if (r() < 0.7) L.decals.push({ key: pick(corner, r()), x: (rm.x + ox * rm.w) * TS + (fx ? -19 : 19), y: (rm.y + oy * rm.h) * TS + (fy ? -19 : 19), fx, fy, a: 1 });
      }
      // floor decals first (they lie under everything)
      if (decal.length) for (let i = 0, k = 2 + Math.floor(area / 60); i < k; i++) {
        const p = L.randomNear(rm.cx, rm.cy, 0, reach, 20, r);
        if (p) L.decals.push({ key: pick(decal, r()), x: Math.round(p.x), y: Math.round(p.y), a: 0.92 });
      }
      for (let i = 0, k = Math.floor(area / 80) + (r() < 0.5 ? 1 : 0); i < k && solid.length; i++) { const p = at(rm, 24, reach, 28, 72, 62); if (p) place(L.props, pick(solid, r()), p.x, p.y, 'solid'); }
      for (let i = 0, k = Math.floor(area / 55) + 1; i < k && deco.length; i++) { const p = at(rm, 16, reach, 14, 50, 30); if (p) place(L.props, pick(deco, r()), p.x, p.y, 'deco'); }
      if (light.length && rm.tag !== 'start' && r() < 0.5) { const p = at(rm, 30, reach, 26, 64, 60); if (p) place(L.props, pick(light, r()), p.x, p.y, 'light'); }
    }
    // doors, gates or stairs: a frame behind the entrance and the exit pad
    if (gate.length) {
      L.exit.gate = pick(gate, r());
      L.entrance.gate = pick(gate, r());
    }
    return L;
  });

  /* ------------------------------------------------------------------ boss and wave arenas, the town */
  const decorate = (props, w, h, biome, seedKey, margin, bg) => {
    build();
    const pl = pools[biome];
    if (!pl) return;
    let n = 0;
    const r = () => hash(seedKey, n++);
    const spot = (d) => {
      for (let t = 0; t < 12; t++) {
        const x = margin + r() * (w - margin * 2), y = margin + r() * (h - margin * 2);
        if (U.dist(x, y, w / 2, h / 2) < 110) continue;
        if (props.some((q) => U.dist(x, y, q.x, q.y) < d)) continue;
        return { x, y };
      }
      return null;
    };
    if (bg && pl.decal) {
      const g = bg.getContext('2d');
      for (let i = 0; i < 14; i++) {
        const im = CH.Assets.images[pick(pl.decal, r())];
        g.globalAlpha = 0.9;
        g.drawImage(im, Math.round(margin + r() * (w - margin * 2) - im.width / 2), Math.round(margin + r() * (h - margin * 2) - im.height / 2));
      }
      g.globalAlpha = 1;
    }
    for (const [role, count, d] of [['solid', 5, 70], ['hazard', 2, 80], ['deco', 7, 40], ['light', 3, 90]]) {
      const list = pl[role];
      if (!list || !list.length) continue;
      for (let i = 0; i < count; i++) { const p = spot(d); if (p) place(props, pick(list, r()), p.x, p.y, role); }
    }
  };
  wrap(CH.Arenas, 'build', function (orig, id) {
    const a = orig.call(CH.Arenas, id);
    decorate(a.props, a.w, a.h, a.id, a.id.length * 977 + a.w, B.arena.margin + 40, a.bg);
    return a;
  });
  if (CH.Town) {
    wrap(CH.Town, 'build', function (orig) {
      const L = orig.call(CH.Town);
      const spots = [[18, 22], [38, 22], [22, 31], [34, 31], [26, 20], [30, 24], [16, 28], [40, 28]];
      build();
      const pl = pools.zombie;
      if (pl) spots.forEach(([tx, ty], i) => {
        const x = tx * TS + 16, y = ty * TS + 16;
        if (L.solidAt(x, y) || L.props.some((q) => U.dist(x, y, q.x, q.y) < 56) || L.npcs.some((q) => U.dist(x, y, q.px, q.py) < 60)) return;
        const role = i % 3 === 0 ? 'light' : i % 3 === 1 ? 'deco' : 'solid';
        const list = pl[role];
        if (list && list.length) place(L.props, pick(list, hash(i, 31)), x, y, role);
      });
      return L;
    });
  }

})(window.CH);
