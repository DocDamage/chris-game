/* CHAOS.exe - composition: where things go in a room (PLAN.md 22). What the owner asked for, and Diablo's own rules:
   a room has a purpose and props belong to it; they stand against the architecture, not in the middle of the floor:
     the back wall   the room's row (shelves, coffins, racks, cases, crates), flush to the wall, in runs of one kit
     the side walls  the second row (barrels, sacks, benches, banners on posts)
     the corners     the clutter (piles of crates, bones, rubble, debris)
     the doorways    lights and statues flanking them, the doorway itself kept clear
     the middle      the fighting space, clear but for the room's one centrepiece (an altar, a well, a throne, a beast's
                     bones), which stands at the back with its satellites (candles flanking it, a rug before it)
   Rooms are read from their cells: every floor cell of a room with a wall north, west, east or south of it is a slot of
   that side, two walls make a corner, a cell whose neighbour outside the room is floor is a doorway (and its neighbours
   stay clear). Scenes take slots (js/setpieces.js D.scatter, alongWalls, D.pile); what a stage owes of its packs is
   laid into the slots its kind belongs to (CH.Compose.place), never on the open floor. */
(function (CH) {
  'use strict';
  const TS = CH.Level.TS;
  const C = (CH.Compose = {});

  /* where a kind of thing belongs */
  const WHERE = {
    wall: ['shelf', 'cage', 'coffin', 'case', 'crate', 'barrel', 'toxbarrel', 'sack', 'bench', 'table', 'chair', 'sofa', 'bed', 'stall', 'machine', 'reactor', 'grave', 'opengrave', 'cauldron', 'anvil', 'block', 'bin', 'dumpster', 'trash', 'pipestand', 'smallstatue', 'pot', 'fence', 'wire', 'barricade', 'sandbag', 'spikes', 'banner', 'signpost', 'sign', 'plaque', 'well', 'crypt', 'statue', 'castle', 'cliff', 'house', 'hut', 'wall', 'firebarrel', 'trap', 'spike', 'portal', 'throne', 'ruin', 'carv', 'car', 'cell', 'pustule'],
    corner: ['bones', 'bonepile', 'skeleton', 'corpse', 'debris', 'rubble', 'item', 'pack', 'tires', 'cone', 'streetbit', 'pallet', 'growth', 'rock', 'ashes', 'urchin', 'coral', 'mushroom', 'flower', 'tuft', 'anemone', 'weed', 'shambler', 'stump', 'log'],
    light: ['torch', 'brazier', 'lamp', 'lantern', 'candles', 'crystal', 'flood', 'pole', 'pillar', 'obelisk', 'campfire', 'geyser', 'firetrap', 'floater'],
    big: ['carcass', 'leviathan', 'kraken', 'lich', 'altar', 'tentacle', 'boulder', 'lavarock', 'worm', 'heart', 'dragon', 'landmark'],
    nature: ['tree', 'bigtree', 'deadtree', 'shrub', 'boulder', 'rock', 'stump', 'log', 'mushroom', 'flower', 'tuft', 'weed', 'growth', 'pond', 'lake'],
  };
  const SIDE = {};
  for (const [w, list] of Object.entries(WHERE)) for (const k of list) if (!SIDE[k]) SIDE[k] = w;
  C.WHERE = WHERE;
  C.sideOf = (kind) => SIDE[kind] || 'corner';

  /* the room a point stands in (scenes pass their room's centre or a point in it) */
  C.roomAt = function (L, x, y) {
    const tx = Math.floor(x / TS), ty = Math.floor(y / TS);
    let best = null, bd = 1e9;
    for (const rm of L.rooms) {
      const inside = rm.r ? Math.hypot((tx + 0.5) * TS - rm.cx, (ty + 0.5) * TS - rm.cy) <= (rm.r + 0.5) * TS : tx >= rm.x && tx < rm.x + rm.w && ty >= rm.y && ty < rm.y + rm.h;
      if (!inside) continue;
      const d = Math.hypot(x - rm.cx, y - rm.cy);
      if (d < bd) { bd = d; best = rm; }
    }
    return best;
  };
  const inRoom = (rm, tx, ty) => (rm.r ? Math.hypot((tx + 0.5) * TS - rm.cx, (ty + 0.5) * TS - rm.cy) <= (rm.r + 0.5) * TS : tx >= rm.x && tx < rm.x + rm.w && ty >= rm.y && ty < rm.y + rm.h);

  /* a room's slots, read once from its cells */
  C.geom = function (L, rm) {
    if (rm._geo) return rm._geo;
    const x0 = rm.r ? Math.floor(rm.cx / TS - rm.r - 1) : rm.x, y0 = rm.r ? Math.floor(rm.cy / TS - rm.r - 1) : rm.y;
    const x1 = rm.r ? Math.ceil(rm.cx / TS + rm.r + 1) : rm.x + rm.w - 1, y1 = rm.r ? Math.ceil(rm.cy / TS + rm.r + 1) : rm.y + rm.h - 1;
    const G = { north: [], south: [], west: [], east: [], corner: [], door: [], core: [], inner: [], clear: new Set() };
    const floor = (tx, ty) => L.inb(tx, ty) && !L.solid(tx, ty);
    // doorways: cells of the room with floor outside the room next to them; they and their neighbours stay clear
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      if (!inRoom(rm, tx, ty) || !floor(tx, ty)) continue;
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        if (!inRoom(rm, tx + dx, ty + dy) && floor(tx + dx, ty + dy)) {
          G.door.push({ tx, ty, dx, dy, x: (tx + 0.5) * TS, y: (ty + 0.5) * TS });
          for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) G.clear.add((ty + oy) * L.tw + tx + ox);
        }
      }
    }
    const onRoute = (tx, ty) => L.route && L.route[L.idx(tx, ty)];
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      if (!inRoom(rm, tx, ty) || !floor(tx, ty)) continue;
      const i = ty * L.tw + tx;
      if (G.clear.has(i)) continue;
      const n = !floor(tx, ty - 1), s = !floor(tx, ty + 1), w = !floor(tx - 1, ty), e = !floor(tx + 1, ty);
      const base = { tx, ty, used: false, route: !!onRoute(tx, ty) };
      if (n && (w || e)) G.corner.push(Object.assign({ side: 'corner', wall: 'n', x: tx * TS + (w ? 12 : 20), y: ty * TS + 22 }, base));
      else if (s && (w || e)) G.corner.push(Object.assign({ side: 'corner', wall: 's', x: tx * TS + (w ? 12 : 20), y: ty * TS + 30 }, base));
      else if (n) G.north.push(Object.assign({ side: 'north', x: tx * TS + 16, y: ty * TS + 22 }, base));
      else if (w) G.west.push(Object.assign({ side: 'west', x: tx * TS + 11, y: ty * TS + 26 }, base));
      else if (e) G.east.push(Object.assign({ side: 'east', x: tx * TS + 21, y: ty * TS + 26 }, base));
      else if (s) G.south.push(Object.assign({ side: 'south', x: tx * TS + 16, y: ty * TS + 30 }, base));
      else if (!floor(tx, ty - 2) || !floor(tx - 2, ty) || !floor(tx + 2, ty)) G.inner.push(Object.assign({ side: 'inner', x: tx * TS + 16, y: ty * TS + 24 }, base)); // the second row
      else {
        let deep = true;
        for (let oy = -2; oy <= 2 && deep; oy++) for (let ox = -2; ox <= 2; ox++) if (!floor(tx + ox, ty + oy)) { deep = false; break; }
        if (deep) G.core.push(Object.assign({ side: 'core', x: (tx + 0.5) * TS, y: (ty + 0.5) * TS }, base));
      }
    }
    G.north.sort((a, b) => a.y - b.y || a.x - b.x);
    G.spans = [];
    const left = G.door.slice();
    while (left.length) {
      const d0 = left.shift(), span = [d0];
      for (let grew = true; grew;) {
        grew = false;
        for (let i = left.length - 1; i >= 0; i--) {
          const d = left[i];
          if (d.dx === d0.dx && d.dy === d0.dy && span.some((q) => Math.abs(q.tx - d.tx) + Math.abs(q.ty - d.ty) === 1)) { span.push(d); left.splice(i, 1); grew = true; }
        }
      }
      if (span.length > 3) continue; // the room opens wide here: no doorway to mark
      const cx = span.reduce((a, q) => a + q.x, 0) / span.length, cy = span.reduce((a, q) => a + q.y, 0) / span.length;
      const half = (span.length / 2 + 1.1) * TS;
      G.spans.push({ dx: d0.dx, dy: d0.dy, x: cx, y: cy, half, lit: false });
    }
    rm._geo = G;
    return G;
  };
  /* the free slots of the given sides, nearest (x, y) first, at least `gap` px from anything placed through a slot */
  C.free = function (L, rm, sides, x, y, R, gap) {
    const G = C.geom(L, rm);
    const out = [];
    for (const s of sides) for (const q of G[s] || []) {
      if (q.used || q.route) continue;
      if (R && Math.hypot(q.x - x, q.y - y) > R) continue;
      out.push(q);
    }
    out.sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y));
    return out;
  };
  /* mark the slots round a placed piece as taken (its footprint and a margin) */
  C.take = function (L, rm, px, py, hw) {
    const G = C.geom(L, rm);
    for (const s of ['north', 'south', 'west', 'east', 'corner', 'core', 'inner']) for (const q of G[s]) if (Math.abs(q.x - px) < hw + 10 && Math.abs(q.y - py) < 26) q.used = true;
  };

  /* lay a piece into a slot of its kind in a room: true when it stood */
  C.place = function (D, L, rm, key, kind, opt) {
    opt = opt || {};
    const where = opt.side || C.sideOf(kind);
    const G = C.geom(L, rm);
    const sides = (where === 'wall' ? ['north', 'west', 'east'] : where === 'corner' ? ['corner', 'north', 'west', 'east'] : where === 'light' ? ['door', 'north'] : where === 'big' ? ['north'] : where === 'nature' ? ['north', 'west', 'east', 'south', 'corner'] : ['corner', 'north', 'west', 'east', 'south']).concat(opt.inner && (rm.r ? rm.r >= 7 : rm.w >= 10 && rm.h >= 9) ? ['inner'] : []); // a second row only where the room is big enough to keep its middle open
    // a big piece: the back wall's middle, the room's centrepiece (once a room)
    if (where === 'big') {
      if (rm._big) return false;
      const n = G.north.filter((q) => !q.used && !q.route);
      if (!n.length) return false;
      const mid = n.reduce((a, q) => a + q.x, 0) / n.length;
      n.sort((a, b) => Math.abs(a.x - mid) - Math.abs(b.x - mid));
      for (const q of n.slice(0, 4)) {
        const p = D.put(key, q.x, q.y + 26);
        if (p) { rm._big = true; C.take(L, rm, q.x, q.y + 26, p.box ? p.box.hw + 20 : 40); return true; }
      }
      return false;
    }
    // a light: beside a doorway, inside the room
    if (where === 'light' && G.spans.length) {
      for (const d of G.spans) {
        if (d.lit) continue;
        for (const s of [-1, 1]) {
          const x = d.x + s * (d.dy ? d.half : 0) - d.dx * TS * 1.2, y = d.y + s * (d.dx ? d.half : 0) - d.dy * TS * 1.2 + 10;
          const p = D.put(key, x, y);
          if (p) { d.lit = true; C.take(L, rm, x, y, 16); return true; }
        }
      }
    }
    // a kind keeps together: its first piece in a room picks a spot of the perimeter far from the other kinds' spots,
    // the rest cluster round it (a corner of pots, a run of coffins, a heap of bones), so the room reads as places
    const anchors = (rm._anchors = rm._anchors || {});
    const tag = opt.group || kindGroup(key, where);
    let at = anchors[tag];
    if (!at) {
      const cands = C.free(L, rm, sides, rm.cx, rm.cy, 0);
      const others = Object.values(anchors);
      let best = null, bd = -1;
      for (const q of cands) { const d = others.length ? Math.min(...others.map((o) => Math.hypot(o.x - q.x, o.y - q.y))) : (q.side === 'corner' ? 1e6 : 1e5) - Math.hypot(q.x - rm.cx, q.y - rm.cy); if (d > bd) { bd = d; best = q; } }
      if (!best) return false;
      at = anchors[tag] = { x: best.x, y: best.y };
    }
    const list = C.free(L, rm, sides, at.x, at.y, opt.R || 0);
    for (const q of list.slice(0, 24)) {
      const p = D.put(key, q.x, q.y, { flip: q.side === 'east' ? false : undefined });
      if (p) { C.take(L, rm, q.x, q.y, p.box ? p.box.hw : 10); q.used = true; return true; }
    }
    return false;
  };
  /* ------------------------------------------------------------------ recipes: a room composed (Diablo's theme rooms) */
  /* R = { feature: kind, flank: kind, rug: kind, ring: kind, back: [kinds], sides: [kinds], corners: [kinds], doors: kind,
     stains: [kinds], n: stains count }. In order: the centrepiece at the back middle, two flankers, a rug before it and a
     half ring of candles; the back wall's row in runs of one kit (the centrepiece's span left free); the side walls every
     other cell; a small pile in each corner; lights beside each doorway; a few stains near the walls. The middle stays
     open */
  C.recipe = function (D, A, R) {
    const L = D.L, rm = A.rm || C.roomAt(L, A.x, A.y);
    if (!rm) return false;
    const G = C.geom(L, rm);
    const north = G.north.filter((q) => !q.route);
    const top = north.length ? Math.min(...north.map((q) => q.ty)) : Math.floor(rm.cy / TS) - 2;
    const back = north.filter((q) => q.ty === top).sort((a, b) => a.x - b.x);
    const midX = back.length ? (back[0].x + back[back.length - 1].x) / 2 : rm.cx;
    let span = null;
    if (R.feature) {
      const key = D.key(R.feature);
      for (const dy of [58, 76, 40, 96]) {
        const fx = midX, fy = top * TS + dy;
        const p = key && D.put(key, fx, fy);
        if (!p) continue;
        const hw = p.box ? p.box.hw : 20;
        span = [fx - hw - 30, fx + hw + 30];
        if (R.flank) for (const s of [-1, 1]) D.put(D.key(R.flank), fx + s * (hw + 26), fy + 2);
        if (R.rug) D.put(D.key(R.rug), fx, fy + 30, { a: 1 });
        if (R.ring) for (let i = 0; i < 5; i++) { const a = Math.PI * (0.18 + i * 0.16); D.put(D.key(R.ring), fx + Math.cos(a) * (hw + 40), fy + 18 + Math.sin(a) * 26); }
        C.take(L, rm, fx, fy, hw + 50);
        break;
      }
    }
    // the back wall's row: runs of one kind and one kit, a gap between runs, the centrepiece's span free
    if (R.back && R.back.length) {
      let run = 0, kit = null, lastX = -1e9;
      for (const q of back) {
        if (q.used || (span && q.x > span[0] && q.x < span[1]) || q.x - lastX < (R.step || 30)) continue;
        if (run <= 0) { kit = D.kit(D.pick(R.back)); run = 2 + Math.floor(D.r() * 3); if (lastX > -1e9 && D.r() < 0.35) { lastX = q.x; continue; } }
        const p = D.put(kit(), q.x, q.y);
        if (p) { C.take(L, rm, q.x, q.y, p.box ? p.box.hw : 10); lastX = q.x + (p.box ? p.box.hw : 8); run--; }
      }
    }
    // the side walls: every other cell, runs of one kind
    if (R.sides && R.sides.length) for (const side of ['west', 'east']) {
      const col = G[side].filter((q) => !q.used && !q.route).sort((a, b) => a.y - b.y);
      let run = 0, kit = null, lastY = -1e9;
      for (const q of col) {
        if (q.used || q.y - lastY < 44) continue;
        if (run <= 0) { kit = D.kit(D.pick(R.sides)); run = 1 + Math.floor(D.r() * 3); }
        const p = D.put(kit(), q.x, q.y, { flip: side === 'east' });
        if (p) { C.take(L, rm, q.x, q.y, p.box ? p.box.hw : 10); lastY = q.y; run--; }
      }
    }
    // a small pile in each corner
    if (R.corners && R.corners.length) for (const q of G.corner.filter((c) => !c.used && !c.route)) {
      if (q.used) continue;
      let x = q.x, y = q.y;
      const n = 1 + Math.floor(D.r() * 3);
      for (let i = 0; i < n; i++) {
        const p = D.put(D.key(D.pick(R.corners)), x, y);
        if (p) { const w = p.box ? p.box.hw * 2 : 14; x += (q.x < rm.cx ? 1 : -1) * (w * 0.6 + 4); y += (q.wall === 'n' ? 1 : -1) * 6; }
      }
      C.take(L, rm, q.x, q.y, 40);
    }
    // lights by the doorways
    if (R.doors) for (const d of G.spans) {
      if (d.lit) continue;
      d.lit = true;
      const key = D.key(R.doors); // one pair matches
      for (const s of [-1, 1]) {
        const x = d.x + s * (d.dy ? d.half : 0) - d.dx * TS, y = d.y + s * (d.dx ? d.half : 0) - d.dy * TS + 10;
        D.put(key, x, y, { flip: s > 0 });
      }
    }
    // stains near the walls
    if (R.stains && R.stains.length) {
      const near = C.free(L, rm, ['corner', 'west', 'east', 'north', 'south'], rm.cx, rm.cy, 0);
      for (let i = 0; i < (R.n || 3) && near.length; i++) { const q = near[Math.floor(D.r() * near.length)]; D.put(D.key(D.pick(R.stains)), q.x + (q.side === 'west' ? 10 : q.side === 'east' ? -10 : 0), q.y + 10, { a: 0.9 }); }
    }
    return true;
  };

  /* the group a piece clusters with in a room: its kind (a pot with pots) */
  function kindGroup(key, where) { return (CH.Props.kindOf(key) || where) + ''; }
  C.kindGroup = kindGroup;
})(window.CH);
