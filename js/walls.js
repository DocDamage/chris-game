/* CHAOS.exe - walls built from the Dungeon Asset Pack's wall pieces, in every direction, in every walled stage
   (PLAN.md 21, request 2). A wall cell is drawn by what lies around it:
     floor south   a face: the pack's brick, stone and cobble faces in the stage's materials; a run of faces starts and
                   ends on the pack's corner pieces (mirrored for the east end), and now and then carries a banner, a
                   shield, a grated window, an arch, a broken stretch, or something of the biome's own packs mounted on
                   it: doors and windows (zombie city, Gaslight, crypt, Dead Wood, Frozen Kingdom), warning signs and
                   pipes (city, wasteland), hanging chains and cages (dungeons, castle, volcano), gates (volcano, wasteland)
     floor east / west   the stone rim of the wall seen from above: the corner piece's side band
     floor north   the rim along its top edge: the corner piece's top band
   Materials and mounts are chosen per stretch of wall from the cell's position, so a stage looks the same every time
   it is drawn. Faces are painted into the level's chunks (js/level.js), so they cost nothing per frame. */
(function (CH) {
  'use strict';
  const TS = CH.Level.TS;
  const W = (CH.Walls = {});
  const IM = () => CH.Assets.images;
  const DA = (l) => l.map((i) => 'kit.da2.' + i);
  const range = (pre, spec) => {
    const out = [];
    for (const part of spec.split(',')) { const [a, b] = part.split('-').map(Number); for (let i = a; i <= (b === undefined ? a : b); i++) out.push(pre + '.' + i); }
    return out;
  };
  /* the pack's materials: faces (one cell wide), long runs (sliced across cells) and the corner pieces of that stone */
  const MAT = {
    grey: { face: DA([0, 3, 7, 18, 45, 50, 51, 12, 19]), long: DA([35, 39, 40, 37]), corner: DA([9, 22, 31, 41, 52]) },
    mossy: { face: DA([1, 2, 4]), long: [], corner: DA([10, 23, 32, 42, 53]) },
    brown: { face: DA([5]), long: DA([36]), corner: DA([33, 43, 54]) },
    purple: { face: DA([6]), long: DA([38]), corner: DA([34, 44, 55]) },
    ember: { face: DA([8, 7]), long: [], corner: DA([9, 22, 31, 41, 52]) },
    obsidian: { face: range('sh.v_obsidian', '0-7'), long: [], corner: DA([9, 31, 41]) },
    crypt: { face: DA([7, 0, 8, 18]), long: DA([35, 40]), corner: range('sh.h_corner', '0-39') },
    strip: { face: [], long: 'strip:r', corner: DA([9, 22, 31, 41, 52]) },
  };
  W.MAT = MAT;
  const ACC = {
    banner: DA([13, 14, 15, 16, 24]), shield: DA([17, 20, 21]), window: DA([11]), arch: DA([25, 26, 27, 28, 29, 30]), broken: DA([46, 47, 48, 49]),
    special: range('kit.da3', '0-6,10-14,26-30'),
  };
  /* mounts: [how, keys]; how = door (stands on the floor line), window (in the middle), hang (from the top), sign */
  const M = (how, keys) => [how, keys];
  const CHAINS = M('hang', range('sh.v_chains', '0-25'));
  const CONF = {
    catacombs: { dark: true, mats: ['grey', 'mossy', 'brown', 'purple'], acc: ['banner', 'shield', 'window', 'arch', 'broken', 'special'], mounts: [CHAINS, M('door', range('kit.da4', '0-23')), M('door', range('sh.h_struct', '3,8,10,14')), M('window', range('sh.h_struct', '4-6,12,13')), M('hang', range('sh.h_fx', '0-5,7-11'))] },
    dungeon: { dark: true, mats: ['crypt', 'purple', 'ember'], acc: ['banner', 'window', 'arch', 'broken', 'special'], mounts: [M('door', range('sh.h_doors', '0-19')), M('door', range('sh.h_struct', '3,8,10,14')), M('window', range('sh.h_struct', '4-7,12,13')), CHAINS, M('hang', range('sh.h_fx', '0-5,7-11'))] },
    office: { dark: true, mats: ['crypt', 'grey'], acc: ['window', 'broken'], mounts: [M('door', range('sh.h_doors', '0-19'))] },
    glitch: { dark: true, mats: ['purple', 'crypt'], acc: ['arch', 'special'], mounts: [] },
    castle: { dark: true, mats: ['strip', 'ember', 'grey', 'strip'], acc: ['banner', 'shield', 'arch', 'window'], mounts: [CHAINS, M('door', range('sh.v_gates', '8-15,21,24-30'))] },
    volcano: { dark: true, mats: ['ember', 'obsidian', 'brown', 'ember'], acc: ['arch', 'broken', 'special'], mounts: [M('door', range('sh.v_gates', '0-30')), CHAINS, M('door', range('sh.v_stairs', '0-12'))] },
    gaslight: { mats: ['grey', 'brown', 'grey', 'purple'], acc: ['window', 'arch', 'banner', 'broken'], mounts: [M('window', range('kit.hv6', '1-45')), M('door', range('kit.hv5', '1-3,8-21')), M('door', range('kit.hv8', '26-40')), M('sign', range('kit.hv16', '1-18')), M('window', range('sh.h_struct', '4-6,12'))] },
    zombie: { mats: ['brown', 'grey', 'brown', 'mossy'], acc: ['window', 'broken'], mounts: [M('window', range('sh.z_windows', '0-26')), M('door', range('sh.z_doors', '0-9')), M('sign', range('sh.z_signs', '0-34')), M('door', range('sh.z_walls', '10,11'))] },
    wasteland: { mats: ['brown', 'grey', 'brown'], acc: ['broken', 'window'], mounts: [M('door', range('sh.w_gates', '0-17')), M('sign', range('sh.z_signs', '0-34')), M('sign', range('sh.w_signs', '0-7,9,13,15,18,20,21')), M('hang', range('sh.w_pipes', '0-8,11,12')), M('window', range('sh.z_windows', '9,10,13,17,22'))] },
    frozen: { mats: ['grey', 'mossy', 'grey'], tint: 'rgba(170,205,240,0.38)', snow: true, acc: ['window', 'arch', 'banner', 'shield'], mounts: [M('door', range('kit.fk11', '19-28')), M('door', range('kit.fk5', '24')), CHAINS] },
    deadwood: { dark: '9,13,8', mats: ['mossy', 'grey', 'mossy', 'brown'], acc: ['broken', 'arch', 'window'], mounts: [M('door', range('kit.cf7', '0-4,6,8,9')), M('window', range('kit.cf7', '5,7')), M('door', range('kit.cf5', '34-39')), M('sign', range('kit.cf14', '0-26')), M('hang', range('kit.cf16', '0-11'))] },
    backyard: { mats: ['mossy', 'grey'], acc: ['broken'], mounts: [] },
    belly: null, // flesh walls: drawn by js/sky.js
    sky: null, // the open sky: no walls
  };
  W.CONF = CONF;
  W.add = (biome, conf) => { CONF[biome] = conf; };

  const hash = (a, b) => { let n = (a * 374761393 + b * 668265263) | 0; n = (n ^ (n >> 13)) * 1274126177; return ((n ^ (n >> 16)) >>> 0) / 4294967296; };
  const pick = (list, r) => list[Math.floor(r * list.length) % list.length];
  const have = (k) => !!IM()[k];
  const live = (list) => list.filter(have);
  const cache = new Map();
  const memo = (k, f) => { if (!cache.has(k)) cache.set(k, f()); return cache.get(k); };
  /* tinted / mirrored copies */
  let rec = null; // the level being painted: every piece drawn on its walls goes into L.wallKeys
  function variant(key, flip, tint) {
    if (rec && key) rec.add(key);
    return memo(key + '|' + (flip ? 1 : 0) + '|' + (tint || ''), () => {
      const im = IM()[key];
      if (!im) return null;
      const c = document.createElement('canvas');
      c.width = im.width; c.height = im.height;
      const g = c.getContext('2d');
      if (flip) { g.translate(c.width, 0); g.scale(-1, 1); }
      g.drawImage(im, 0, 0);
      if (tint) { g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = tint; g.fillRect(0, 0, c.width, c.height); }
      return c;
    });
  }
  /* a corner piece's side band (the left stone column under its top band) and top band (right of the column) */
  const band = (key, which, flip, tint) => memo('band' + key + which + (flip ? 1 : 0) + (tint || ''), () => {
    const im = variant(key, flip, tint);
    if (!im) return null;
    const cw = Math.max(4, Math.round(im.width * 0.26)), th = Math.max(4, Math.round(im.height * 0.24));
    const c = document.createElement('canvas');
    const g = c.getContext('2d');
    if (which === 'side') { c.width = cw; c.height = im.height - th; g.drawImage(im, flip ? im.width - cw : 0, th, cw, c.height, 0, 0, cw, c.height); }
    else { c.width = im.width - cw; c.height = th; g.drawImage(im, flip ? 0 : cw, 0, c.width, th, 0, 0, c.width, th); }
    return c;
  });
  /* the material of the stretch of wall a cell belongs to (blocks of 7 x 5 cells) */
  function matOf(conf, gx, gy) {
    const r = hash(Math.floor(gx / 7) + 913, Math.floor(gy / 5) + 37);
    return MAT[pick(conf.mats, r)] || MAT.grey;
  }
  const strips = () => memo('strips', () => (CH.Props ? CH.Props.pool('wall', 'r').filter((k) => IM()[k] && IM()[k].width >= TS) : []));

  /* one wall cell (js/level.js chunk painting) */
  W.paint = function (L, g, st, gx, gy, px, py) {
    const conf = CONF[L.biome];
    if (!conf) return false;
    rec = L.wallKeys || (L.wallKeys = new Set());
    if (conf.sky) { CH.Sky.paintCell(L, g, gx, gy, px, py); return true; } // the open sky between the islands (js/sky.js)
    const open = (x, y) => !L.solid(x, y);
    const mat = matOf(conf, gx, gy);
    const tint = conf.tint;
    const cornerKey = live(mat.corner).length ? pick(live(mat.corner), hash(gx >> 3, gy)) : 'kit.da2.9';
    // indoors the wall mass is dark: worked stone along the rooms, black beyond (Diablo's dungeons)
    if (conf.dark) top(L, g, mat, gx, gy, px, py, tint, conf.dark === true ? '6,5,9' : conf.dark);
    // the rim seen from above, where the floor is east, west or north of the wall
    const e = open(gx + 1, gy), w = open(gx - 1, gy), n = open(gx, gy - 1), s = open(gx, gy + 1);
    if (n) { const b = band(cornerKey, 'top', false, tint); if (b) g.drawImage(b, 0, 0, b.width, b.height, px, py, TS, 7); }
    if (e && !s) { const b = band(cornerKey, 'side', true, tint); if (b) g.drawImage(b, 0, 0, b.width, b.height, px + TS - 7, py, 7, TS); }
    if (w && !s) { const b = band(cornerKey, 'side', false, tint); if (b) g.drawImage(b, 0, 0, b.width, b.height, px, py, 7, TS); }
    if (s) W.face(L, g, conf, mat, cornerKey, gx, gy, px, py);
    return true;
  };
  /* the top of an indoor wall: the stone of its material, darkened, next to a room; darkness (rgb) two cells in (the
     Dead Wood's is the black-green of the forest beyond its old walls) */
  function top(L, g, mat, gx, gy, px, py, tint, rgb) {
    let near = false;
    for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) if (!L.solid(gx + dx, gy + dy)) { near = true; break; }
    g.fillStyle = 'rgb(' + rgb + ')';
    g.fillRect(px, py, TS, TS);
    if (!near) return;
    const faces = live(mat.face);
    const im = faces.length && variant(pick(faces, hash(gx + 5, gy + 9)), hash(gx, gy) < 0.5, tint);
    if (im) {
      g.globalAlpha = 0.42;
      g.drawImage(im, 0, Math.round(im.height * 0.25), im.width, Math.round(im.height * 0.6), px, py, TS, TS);
      g.globalAlpha = 1;
    }
    // falling off into the dark away from the room
    const gr = g.createLinearGradient(px, py, px, py + TS);
    const below = !L.solid(gx, gy + 1) || !L.solid(gx, gy + 2), above = !L.solid(gx, gy - 1);
    gr.addColorStop(0, 'rgba(' + rgb + (above ? ',0)' : ',0.55)'));
    gr.addColorStop(1, 'rgba(' + rgb + (below ? ',0)' : ',0.55)'));
    g.fillStyle = gr;
    g.fillRect(px, py, TS, TS);
  }
  /* the overhang of a face cell into the cell above it (when the cell above lies in another chunk) */
  W.overhang = function (L, g, gx, gy, px, py) {
    const conf = CONF[L.biome];
    rec = L.wallKeys || (L.wallKeys = new Set());
    if (!conf || !L.solid(gx, gy) || L.solid(gx, gy + 1)) return;
    const mat = matOf(conf, gx, gy);
    const cornerKey = live(mat.corner).length ? pick(live(mat.corner), hash(gx >> 3, gy)) : 'kit.da2.9';
    g.save();
    g.beginPath(); g.rect(px, py - TS, TS, TS); g.clip();
    W.face(L, g, conf, mat, cornerKey, gx, gy, px, py);
    g.restore();
  };
  const isFace = (L, x, y) => L.solid(x, y) && !L.solid(x, y + 1);
  /* the level's wall plan, made once: which piece every run end and every decorated face gets. The pieces are dealt in
     order, each stage of a biome starting at its own fifth of every list, so the five stages show them all (PLAN.md 21) */
  function planOf(L, conf) {
    if (L._wplan) return L._wplan;
    const WM = CH.WorldMap, ar = WM && L.stage && WM.on && WM.on() ? WM.area(L.stage) : null;
    const step = ar && ar.step ? ar.step - 1 : ((L.stage || 1) - 1) % 5;
    const cnt = {};
    const deal = (name, list) => { if (!list.length) return null; const c = (cnt[name] = (cnt[name] || 0) + 1) - 1; return list[(step * Math.ceil(list.length / 5) + c) % list.length]; };
    const P = (L._wplan = { corner: new Map(), acc: new Map() });
    const mounts = (conf.mounts || []).map((m) => [m[0], live(m[1])]).filter((m) => m[1].length);
    const kinds = (conf.acc || []).filter((k) => live(ACC[k]).length);
    const slots = [];
    for (let j = 0; j < Math.max(mounts.length, kinds.length); j++) { if (mounts[j]) slots.push(['m', j, mounts[j]]); if (kinds[j]) slots.push(['a', kinds[j]]); }
    let si = 0;
    for (let gy = 0; gy < L.th; gy++) for (let gx = 0; gx < L.tw; gx++) {
      if (!isFace(L, gx, gy)) continue;
      const i = gy * L.tw + gx, mat = matOf(conf, gx, gy);
      if (!isFace(L, gx - 1, gy) || !isFace(L, gx + 1, gy)) { const c = live(mat.corner); if (c.length) P.corner.set(i, deal('c' + mat.corner[0], c)); continue; }
      const acc = (x) => hash(x * 5 + 3, gy * 11 + 7) < 0.3;
      if (!acc(gx) || acc(gx - 1)) continue;
      // the biome's mounted pieces and the pack's banners, shields, arches ... in turn
      if (!slots.length) continue;
      const sl = slots[(si++ + step) % slots.length];
      if (sl[0] === 'm') P.acc.set(i, { how: sl[2][0], key: deal('m' + sl[1], sl[2][1]) });
      else P.acc.set(i, { key: deal('a' + sl[1], live(ACC[sl[1]])) });
    }
    return P;
  }
  W.face = function (L, g, conf, mat, cornerKey, gx, gy, px, py) {
    const tint = conf.tint;
    const left = !isFace(L, gx - 1, gy), right = !isFace(L, gx + 1, gy);
    const r = hash(gx, gy);
    const H = TS + 10;
    // the face itself: a long run sliced across its cells, or a one-cell face
    let drawn = false;
    if (typeof mat.long === 'string' && mat.long.indexOf('key:') === 0) { // one long wall image sliced along the runs
      const im = variant(mat.long.slice(4), false, tint);
      if (im) {
        const sx = ((gx * TS) % Math.max(TS, im.width - TS)) | 0, hgt = Math.min(H, im.height);
        g.drawImage(im, sx, 0, TS, hgt, px, py + TS - hgt, TS, hgt);
        drawn = true;
      }
    } else if (mat.long === 'strip:r') {
      const F = strips();
      if (F.length) {
        const fk = F[Math.abs(Math.floor(gx / 6) * 31 + gy * 17) % F.length];
        if (rec) rec.add(fk);
        const im = IM()[fk];
        const sx = ((gx * TS) % Math.max(TS, im.width - TS)) | 0, hgt = Math.min(H - 2, im.height);
        g.drawImage(im, sx, 0, TS, hgt, px, py + TS - hgt, TS, hgt);
        drawn = true;
      }
    } else if (Array.isArray(mat.long) && mat.long.length && hash(Math.floor(gx / 3), gy + 5) < 0.3) {
      const im = variant(pick(live(mat.long), hash(Math.floor(gx / 3), gy)), false, tint);
      if (im) {
        const cell = Math.round(im.width * (H / im.height)); // the run drawn at face height, sliced into cells
        const k = ((gx % 3) + 3) % 3, sw = (im.width / Math.max(cell, TS)) * TS;
        g.drawImage(im, Math.min(im.width - sw, k * sw * 0.5), 0, sw, im.height, px, py + TS - H, TS, H);
        drawn = true;
      }
    }
    if (!drawn) {
      const faces = live(mat.face);
      const key = faces.length ? pick(faces, hash(gx * 3 + 1, gy * 7 + 2) * 0.6 + r * 0.4) : 'kit.da2.0';
      const im = variant(key, hash(gx, gy + 99) < 0.5, tint);
      if (im) g.drawImage(im, 0, 0, im.width, im.height, px, py + TS - H, TS, H);
    }
    const plan = planOf(L, conf), here = gy * L.tw + gx;
    // the run's ends turn the corner
    if (left || right) {
      const im = variant(plan.corner.get(here) || cornerKey, right && !left, tint);
      if (im) g.drawImage(im, 0, 0, im.width, im.height, px, py + TS - H, TS, H);
      if (conf.snow) snowCap(g, px, py + TS - H);
      return;
    }
    // now and then a banner, a window, an arch or a mounted piece of the biome's packs (never two side by side), as the
    // wall plan dealt them
    const a = plan.acc.get(here);
    if (a && a.how) mount(g, a.how, a.key, px, py, tint);
    else if (a) { const im = variant(a.key, false, tint); if (im) g.drawImage(im, 0, 0, im.width, im.height, px, py + TS - H, TS, H); }
    if (conf.snow) snowCap(g, px, py + TS - H);
  };
  /* a mounted piece, scaled to sit on the face */
  function mount(g, how, key, px, py, tint) {
    const im = variant(key, false, tint);
    if (!im) return;
    const box = how === 'door' ? [TS - 2, TS + 4] : how === 'window' ? [TS - 8, 24] : how === 'sign' ? [TS - 10, 18] : [TS - 10, TS + 2];
    const s = Math.min(box[0] / im.width, box[1] / im.height, how === 'hang' ? 0.9 : 2);
    const w = Math.max(2, Math.round(im.width * s)), h = Math.max(2, Math.round(im.height * s));
    const x = px + Math.round((TS - w) / 2);
    const y = how === 'door' ? py + TS - h : how === 'hang' ? py + TS - (TS + 8) : py + TS - 10 - Math.round(TS / 2) - Math.round(h / 2) + 4;
    g.drawImage(im, 0, 0, im.width, im.height, x, y, w, h);
  }
  /* frozen walls carry snow on their top edge */
  function snowCap(g, x, y) {
    g.fillStyle = 'rgba(236,244,255,0.85)';
    g.fillRect(x, y + 1, TS, 3);
    g.fillStyle = 'rgba(236,244,255,0.55)';
    for (let i = 0; i < 4; i++) g.fillRect(x + ((i * 9 + 3) % TS), y + 4, 4, 2);
  }
  /* every piece the walls of a biome can show (the asset audit and t60 use it) */
  W.keysOf = function (biome) {
    const conf = CONF[biome];
    if (!conf) return [];
    const out = new Set();
    for (const m of conf.mats) { const q = MAT[m]; if (!q) continue; q.face.forEach((k) => out.add(k)); if (Array.isArray(q.long)) q.long.forEach((k) => out.add(k)); else if (q.long.indexOf('key:') === 0) out.add(q.long.slice(4)); q.corner.forEach((k) => out.add(k)); }
    for (const a of conf.acc || []) ACC[a].forEach((k) => out.add(k));
    for (const m of conf.mounts || []) m[1].forEach((k) => out.add(k));
    return [...out].filter(have);
  };
})(window.CH);
