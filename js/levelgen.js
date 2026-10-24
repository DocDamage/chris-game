/* CHAOS.exe - seeded level generator (PLAN.md section 9). Two layouts:
     dungeon  BSP rooms joined by wide corridors, loops, dead ends, secret rooms behind cracked walls
     outdoor  cellular-automata cliffs and ruins with clearings joined by paths
   then it places the entrance, the exit (castle sign, farthest room), waypoints (house sign), hive spots, sleeping
   monster packs, shrines, chests and decor. Everything is driven by one rng function, so daily runs are identical
   for everyone: LevelGen.generate(biome, stage, rng). */
(function (CH) {
  'use strict';
  const U = CH.U;
  const Level = CH.Level;
  const TS = Level.TS;
  const LG = (CH.LevelGen = {});

  const LAYOUT = { deadwood: 'outdoor', dungeon: 'dungeon', office: 'dungeon', glitch: 'dungeon', volcano: 'dungeon', backyard: 'outdoor', zombie: 'outdoor', wasteland: 'outdoor', frozen: 'outdoor' };
  /* size classes in tiles: roughly 1.4x, 2.5x and 3.6x the old 2880x1620 arena */
  LG.SIZES = { S: [96, 64], M: [128, 88], L: [160, 104] };
  LG.MOBS = {
    backyard: ['slime', 'plant', 'spider', 'chicken', 'goblin'],
    deadwood: ['spider', 'plant', 'slime', 'goblin', 'chicken'],
    office: ['intern', 'office', 'influencer', 'toaster', 'trashcan'],
    glitch: ['potato', 'influencer', 'pigeon', 'office', 'cart'],
    zombie: ['intern', 'trashcan', 'slime', 'plant', 'goblin'],
    wasteland: ['orc', 'goblin', 'cart', 'trashcan', 'chicken'],
    volcano: ['fridge', 'toaster', 'slime', 'orc', 'golem'],
    dungeon: ['spider', 'plant', 'office', 'influencer', 'golem'],
    frozen: ['slime', 'golem', 'spider', 'orc', 'goblin'],
  };
  /* hive kinds per biome (PLAN.md section 8) */
  LG.HIVES = {
    glitch: { kind: 'portal', name: 'GLITCH PORTAL' }, office: { kind: 'portal', name: 'GLITCH PORTAL' },
    backyard: { kind: 'hive', name: 'HIVE' }, deadwood: { kind: 'grave', name: 'OSSUARY' }, zombie: { kind: 'grave', name: 'OSSUARY' },
    dungeon: { kind: 'grave', name: 'OSSUARY' }, volcano: { kind: 'gate', name: 'HELL GATE' },
    wasteland: { kind: 'camp', name: 'WAR CAMP' }, frozen: { kind: 'rift', name: 'FROST RIFT' },
  };
  const DECOR = {
    dungeon: ['obj.dungeon_column', 'obj.dungeon_crate', 'obj.dungeon_barrel', 'obj.occult_altar', 'obj.statue'],
    office: ['obj.dungeon_crate', 'obj.dungeon_barrel', 'obj.statue', 'desk', 'couch'],
    glitch: ['obj.statue', 'obj.dungeon_crate', 'obj.dungeon_column'],
    volcano: ['obj.volcano_rock', 'obj.volcano_spikes', 'obj.volcano_pillar1', 'obj.volcano_pillar2'],
    backyard: ['obj.rocks1', 'obj.rocks2', 'obj.mossRocks1', 'obj.bigRocks', 'obj.pillar1', 'obj.standingStone', 'obj.bush1', 'obj.bush2', 'obj.deadTree1'],
    zombie: ['obj.roadblock', 'obj.street_lamp', 'obj.car1', 'obj.rubble', 'obj.barricade1'],
    wasteland: ['obj.barricade1', 'obj.barricade2', 'obj.chain_fence1', 'obj.toxic_barrel', 'obj.rubble', 'obj.carWreck'],
    frozen: ['obj.rocks1', 'obj.bigRocks', 'obj.pillar2', 'obj.standingStone'],
  };

  const mkRng = (rng) => ({
    f: rng,
    int: (a, b) => a + Math.floor(rng() * (b - a + 1)),
    pick: (arr) => arr[Math.floor(rng() * arr.length)],
  });

  /* ---------------------------------------------------------------- dungeon layout */
  function genDungeon(L, R) {
    const minLeaf = 14;
    const rooms = [];
    const split = (x, y, w, h, depth) => {
      const canV = w >= minLeaf * 2 + 2; // split with a vertical line
      const canH = h >= minLeaf * 2 + 2;
      if (depth >= 6 || (!canV && !canH) || (depth > 2 && R.f() < 0.12)) {
        const rw = R.int(Math.min(9, w - 4), w - 4), rh = R.int(Math.min(8, h - 4), h - 4);
        const rx = x + R.int(2, Math.max(2, w - rw - 2)), ry = y + R.int(2, Math.max(2, h - rh - 2));
        const room = { x: rx, y: ry, w: rw, h: rh, cx: (rx + rw / 2) * TS, cy: (ry + rh / 2) * TS, deg: 0, id: rooms.length, tag: '' };
        L.carveRect(rx, ry, rw, rh);
        rooms.push(room);
        return { room };
      }
      let vert = canV && canH ? (w / h > 1.25 ? true : h / w > 1.25 ? false : R.f() < 0.5) : canV;
      if (vert) {
        const s = R.int(Math.floor(w * 0.38), Math.floor(w * 0.62));
        return { a: split(x, y, s, h, depth + 1), b: split(x + s, y, w - s, h, depth + 1) };
      }
      const s = R.int(Math.floor(h * 0.38), Math.floor(h * 0.62));
      return { a: split(x, y, w, s, depth + 1), b: split(x, y + s, w, h - s, depth + 1) };
    };
    const tree = split(1, 1, L.tw - 2, L.th - 2, 0);
    const rep = (n) => (n.room ? n.room : R.f() < 0.5 ? rep(n.a) : rep(n.b));
    const corridor = (a, b) => {
      const ax = Math.floor(a.cx / TS), ay = Math.floor(a.cy / TS), bx = Math.floor(b.cx / TS), by = Math.floor(b.cy / TS);
      const horizFirst = R.f() < 0.5;
      if (horizFirst) { L.carveRect(Math.min(ax, bx) - 1, ay - 1, Math.abs(bx - ax) + 3, 3); L.carveRect(bx - 1, Math.min(ay, by) - 1, 3, Math.abs(by - ay) + 3); }
      else { L.carveRect(ax - 1, Math.min(ay, by) - 1, 3, Math.abs(by - ay) + 3); L.carveRect(Math.min(ax, bx) - 1, by - 1, Math.abs(bx - ax) + 3, 3); }
      a.deg++;
      b.deg++;
    };
    const join = (n) => {
      if (n.room) return;
      join(n.a);
      join(n.b);
      corridor(rep(n.a), rep(n.b));
    };
    join(tree);
    // loops: a few extra links between nearby rooms
    for (let i = 0; i < Math.floor(rooms.length / 4); i++) {
      const a = R.pick(rooms);
      let best = null, bd = 1e9;
      for (const b of rooms) if (b !== a) { const d = U.dist(a.cx, a.cy, b.cx, b.cy); if (d < bd && d > 200 && R.f() < 0.6) { bd = d; best = b; } }
      if (best && bd < 1100) corridor(a, best);
    }
    L.rooms = rooms;
  }

  /* ---------------------------------------------------------------- outdoor layout */
  function genOutdoor(L, R) {
    const w = L.tw, h = L.th;
    // noise, then smoothing: cliffs and ruins form blobs
    const g = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const edge = x < 3 || y < 3 || x >= w - 3 || y >= h - 3;
      g[y * w + x] = edge || R.f() < 0.5 ? 1 : 0;
    }
    const cnt = (arr, x, y) => { let n = 0; for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) if ((ox || oy) && (x + ox < 0 || y + oy < 0 || x + ox >= w || y + oy >= h || arr[(y + oy) * w + x + ox])) n++; return n; };
    let cur = g;
    for (let it = 0; it < 5; it++) {
      const nx = new Uint8Array(w * h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const n = cnt(cur, x, y); nx[y * w + x] = n >= 5 || (it < 2 && n <= 1 && R.f() < 0.1) ? 1 : n <= 3 ? 0 : cur[y * w + x]; }
      cur = nx;
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) L.cells[y * w + x] = cur[y * w + x] ? Level.WALL : Level.FLOOR;
    // clearings: spaced out, then joined in a chain by wide paths
    const clear = [];
    const want = R.int(9, 13);
    for (let tries = 0; tries < 400 && clear.length < want; tries++) {
      const r = R.int(5, 8);
      const cx = R.int(r + 5, w - r - 5), cy = R.int(r + 5, h - r - 5);
      if (clear.every((c) => U.dist(cx, cy, c.cx, c.cy) > c.r + r + 8)) clear.push({ cx, cy, r });
    }
    for (const c of clear) L.carveCircle(c.cx, c.cy, c.r);
    const order = clear.slice();
    // nearest-neighbour chain so the paths do not criss-cross wildly
    const chain = [order.shift()];
    while (order.length) {
      const last = chain[chain.length - 1];
      order.sort((a, b) => U.dist(last.cx, last.cy, a.cx, a.cy) - U.dist(last.cx, last.cy, b.cx, b.cy));
      chain.push(order.shift());
    }
    const path = (a, b) => {
      let x = a.cx, y = a.cy;
      while (Math.abs(x - b.cx) > 1 || Math.abs(y - b.cy) > 1) {
        if (Math.abs(x - b.cx) > Math.abs(y - b.cy) ? R.f() < 0.85 : R.f() < 0.15) x += Math.sign(b.cx - x); else y += Math.sign(b.cy - y);
        L.carveCircle(x, y, 2.2);
      }
    };
    for (let i = 1; i < chain.length; i++) path(chain[i - 1], chain[i]);
    for (let i = 0; i < 3; i++) { const a = R.pick(clear), b = R.pick(clear); if (a !== b) path(a, b); } // loops
    L.rooms = clear.map((c, i) => ({ x: c.cx - c.r, y: c.cy - c.r, w: c.r * 2, h: c.r * 2, cx: c.cx * TS + TS / 2, cy: c.cy * TS + TS / 2, deg: 0, id: i, r: c.r, tag: '' }));
    // drop floor that is not connected to the first clearing
    const f = L.flowFor(L.rooms[0].cx, L.rooms[0].cy);
    for (let i = 0; i < L.cells.length; i++) if (L.cells[i] === Level.FLOOR && f.dist[i] < 0) L.cells[i] = Level.WALL;
    L.flows.clear();
  }

  /* ---------------------------------------------------------------- secret rooms (behind cracked walls) */
  function secretRooms(L, R, n) {
    const out = [];
    for (let tries = 0; tries < 900 && out.length < n; tries++) {
      const room = R.pick(L.rooms);
      // a wall face of a room (or clearing): walk from its centre in a random direction until the first rock
      const side = R.int(0, 3);
      const dx = side === 0 ? -1 : side === 1 ? 1 : 0, dy = side === 2 ? -1 : side === 3 ? 1 : 0;
      let sx = Math.floor(room.cx / TS), sy = Math.floor(room.cy / TS), n = 0;
      while (!L.solid(sx, sy) && n++ < 40) { sx += dx; sy += dy; }
      if (n >= 40 || L.cell(sx, sy) !== Level.WALL) continue;
      // the secret room: 7x6 tiles, 4 tiles behind the cracked cell
      const rw = 7, rh = 6;
      const rx = dx > 0 ? sx + 5 : dx < 0 ? sx - 4 - rw : sx - 3, ry = dy > 0 ? sy + 5 : dy < 0 ? sy - 4 - rh : sy - 3;
      if (rx < 3 || ry < 3 || rx + rw > L.tw - 3 || ry + rh > L.th - 3) continue;
      let clearRock = true;
      for (let y = ry - 2; y < ry + rh + 2 && clearRock; y++) for (let x = rx - 2; x < rx + rw + 2; x++) if (L.cell(x, y) === Level.FLOOR) { clearRock = false; break; }
      if (!clearRock) continue;
      // the tunnel from the cracked cell to the room must run through solid rock with rock on both sides (no accidental door)
      let tunnelOk = true;
      const ex = dx !== 0 ? rx + (dx > 0 ? 0 : rw - 1) : sx, ey = dy !== 0 ? ry + (dy > 0 ? 0 : rh - 1) : sy;
      for (let tx2 = Math.min(sx, ex); tx2 <= Math.max(sx, ex) && tunnelOk; tx2++) for (let ty2 = Math.min(sy, ey); ty2 <= Math.max(sy, ey); ty2++) {
        if ((tx2 !== sx || ty2 !== sy) && (L.solid(tx2, ty2) === false)) { tunnelOk = false; break; }
        for (const [ox, oy] of dx !== 0 ? [[0, -1], [0, 1]] : [[-1, 0], [1, 0]]) if ((tx2 !== sx || ty2 !== sy) && L.cell(tx2 + ox, ty2 + oy) === Level.FLOOR) tunnelOk = false;
      }
      if (!tunnelOk) continue;
      L.carveRect(rx, ry, rw, rh);
      // a 1-wide tunnel from the room back to the cracked cell
      const tx = dx !== 0 ? sx : sx, ty = dy !== 0 ? sy : sy;
      if (dx !== 0) L.carveRect(Math.min(sx, rx + (dx > 0 ? 0 : rw - 1)), sy, Math.abs(rx + (dx > 0 ? 0 : rw - 1) - sx) + 1, 1);
      else L.carveRect(sx, Math.min(sy, ry + (dy > 0 ? 0 : rh - 1)), 1, Math.abs(ry + (dy > 0 ? 0 : rh - 1) - sy) + 1);
      L.set(tx, ty, Level.CRACKED);
      const sr = { x: rx, y: ry, w: rw, h: rh, cx: (rx + rw / 2) * TS, cy: (ry + rh / 2) * TS, crack: { x: tx, y: ty }, found: false, kind: out.length === 0 ? 'dojo' : 'stash' };
      out.push(sr);
    }
    L.secrets = out;
  }

  /* ---------------------------------------------------------------- the whole level */
  /** @param {string} biome @param {number} stage 1-based depth @param {() => number} rng
   *  @param {{size?: string, layout?: string}} [opts] */
  LG.generate = function (biome, stage, rng, opts) {
    opts = opts || {};
    const R = mkRng(rng || Math.random);
    const sz = LG.SIZES[opts.size || (stage <= 2 ? 'M' : stage % 3 === 0 ? 'L' : 'M')] || LG.SIZES.M;
    const L = new Level(sz[0], sz[1], biome);
    const layout = opts.layout || LAYOUT[biome] || 'dungeon';
    if (layout === 'outdoor') genOutdoor(L, R);
    else genDungeon(L, R);
    L.layout = layout;
    const rooms = L.rooms;

    // entrance: the room nearest a corner of the map, exit: the farthest by walking distance
    rooms.sort((a, b) => a.cx + a.cy - (b.cx + b.cy));
    const start = rooms[0];
    const f = L.flowFor(start.cx, start.cy);
    const distOf = (r) => { const d = f.dist[L.idx(Math.floor(r.cx / TS), Math.floor(r.cy / TS))]; return d < 0 ? 0 : d; };
    for (const r of rooms) r.dist = distOf(r);
    const far = rooms.slice().sort((a, b) => b.dist - a.dist);
    const exitRoom = far[0];
    const maxD = Math.max(1, exitRoom.dist);
    L.entrance = L.nearestOpen(start.cx, start.cy);
    L.exit = Object.assign(L.nearestOpen(exitRoom.cx, exitRoom.cy), { open: false, room: exitRoom.id });
    exitRoom.tag = 'exit';
    start.tag = 'start';
    const mid = rooms.filter((r) => r !== start && r !== exitRoom).sort((a, b) => Math.abs(a.dist / maxD - 0.5) - Math.abs(b.dist / maxD - 0.5))[0] || start;
    mid.tag = mid.tag || 'waypoint';
    const wpStart = L.nearestOpen(start.cx + 64, start.cy);
    L.waypoints = [{ x: wpStart.x, y: wpStart.y, id: 0, active: true }, Object.assign(L.nearestOpen(mid.cx, mid.cy - 40), { id: 1, active: false })];

    // hives: spread by walking distance, never in the start room
    const spots = rooms.filter((r) => r !== start);
    const nHive = U.clamp(3 + Math.floor(stage / 2), 3, 6);
    const chosen = [];
    const first = spots.slice().sort((a, b) => b.dist - a.dist)[Math.min(2, spots.length - 1)] || spots[0];
    if (first) chosen.push(first);
    while (chosen.length < Math.min(nHive, spots.length)) {
      let best = null, bd = -1;
      for (const r of spots) {
        if (chosen.includes(r)) continue;
        const d = Math.min(...chosen.map((c) => U.dist(r.cx, r.cy, c.cx, c.cy)));
        if (d > bd) { bd = d; best = r; }
      }
      if (!best) break;
      chosen.push(best);
    }
    const hiveKind = LG.HIVES[biome] || LG.HIVES.dungeon;
    L.spawners = chosen.map((r, i) => {
      const p = L.randomNear(r.cx, r.cy, 0, Math.min(60, (r.w || 8) * TS * 0.2), 22, R.f) || L.nearestOpen(r.cx, r.cy);
      r.tag = r.tag || 'hive';
      return { id: i, kind: hiveKind.kind, name: hiveKind.name, x: p.x, y: p.y, room: r.id, level: 3, dead: false };
    });

    // sleeping packs in every other room, a champion leader now and then
    const mobs = LG.MOBS[biome] || LG.MOBS.dungeon;
    for (const r of rooms) {
      if (r === start) continue;
      const hive = chosen.includes(r);
      if (R.f() > (hive ? 0.9 : 0.62)) continue;
      const n = U.clamp(R.int(4, 6) + Math.floor(stage / 2), 4, 11);
      const type = R.pick(mobs);
      const p = L.randomNear(r.cx, r.cy, 20, Math.max(40, Math.min((r.w || 10) * TS * 0.3, 140)), 24, R.f) || L.nearestOpen(r.cx, r.cy);
      L.packs.push({ x: p.x, y: p.y, room: r.id, type, n, elite: R.f() < 0.18 + stage * 0.012, leader: R.f() < 0.22, woke: false, mixed: R.pick(mobs) });
    }

    // chests in dead ends (or odd rooms), shrines in two mid rooms
    const dead = rooms.filter((r) => r !== start && r !== exitRoom && r.deg <= 1);
    const chestRooms = dead.concat(rooms.filter((r) => r !== start && r !== exitRoom && R.f() < 0.25)).slice(0, 5);
    L.chests = chestRooms.map((r, i) => { const p = L.randomNear(r.cx, r.cy, 0, 40, 18, R.f) || L.nearestOpen(r.cx, r.cy); return { x: p.x, y: p.y, opened: false, id: i, room: r.id, tier: stage + (r.deg <= 1 ? 1 : 0) }; });
    const shrineRooms = rooms.filter((r) => r !== start && r !== exitRoom).sort(() => R.f() - 0.5).slice(0, R.int(1, 2));
    L.shrines = shrineRooms.map((r, i) => { const p = L.randomNear(r.cx, r.cy, 40, 90, 18, R.f) || L.nearestOpen(r.cx, r.cy); return { x: p.x, y: p.y, used: false, id: i, kind: R.pick(['blood', 'elite', 'healing', 'speed']) }; });

    if (layout === 'dungeon' || opts.secrets || biome === 'zombie') secretRooms(L, R, stage >= 2 ? R.int(1, 2) : 1);
    if (biome === 'zombie' && L.secrets[0]) L.secrets[0].kind = 'garage'; // the locked garage of the Outbreak City (needs the key a named unique carries)
    // each secret room holds a chest
    for (const s of L.secrets) L.chests.push({ x: s.cx, y: s.cy, opened: false, id: L.chests.length, room: -1, tier: stage + 2, secret: true });

    // decor: solid props inside rooms, away from walls and the places we just made
    const reserved = [L.entrance, L.exit].concat(L.waypoints, L.spawners, L.chests, L.shrines);
    const names = (DECOR[biome] || DECOR.dungeon).filter((n) => CH.Sprites.has(n) || n.indexOf('obj.') !== 0);
    const decor = names.filter((n) => CH.Sprites.has(n));
    if (decor.length && !(CH.SetPieces && CH.SetPieces.on)) { // set pieces dress the rooms instead (js/setpieces.js)
      for (const r of rooms) {
        const area = (r.w || 8) * (r.h || 8);
        const n = Math.floor(area / 38) + R.int(0, 2);
        for (let i = 0; i < n; i++) {
          const p = L.randomNear(r.cx, r.cy, 20, Math.max(50, Math.min((r.w || 10) * TS * 0.45, 200)), 26, R.f);
          if (!p || reserved.some((q) => U.dist(p.x, p.y, q.x, q.y) < 70)) continue;
          if (L.props.some((q) => U.dist(p.x, p.y, q.x, q.y) < 58)) continue; // no wedges: two props never stand close enough to trap a hero between them
          CH.Arenas.addProp(L.props, R.pick(decor), p.x, p.y, { solid: true, cr: 11, destructible: R.f() < 0.35, hp: 30, jumpable: true, resourceType: R.pick(['wood', 'scrap', 'stone']), resourceAmt: 2 });
        }
      }
    }
    // puddles of water / blood / toxic goo / lava (the shader makes them reflect); never on top of anything we placed
    const PK = { deadwood: ['water', 'water', 'toxic'], backyard: ['water'], office: ['water'], glitch: ['toxic'], zombie: ['water', 'toxic'], wasteland: ['toxic', 'water'], volcano: ['lava', 'lava', 'water'], dungeon: ['water', 'blood'], frozen: ['water'] };
    const pk = PK[biome] || ['water'];
    const np = R.int(5, 9);
    for (let i = 0, tries = 0; i < np && tries < np * 6; tries++) {
      const rm = R.pick(rooms);
      const q = L.randomNear(rm.cx, rm.cy, 10, Math.max(60, Math.min((rm.w || 10) * TS * 0.4, 220)), 36, R.f);
      if (!q || reserved.some((o) => U.dist(q.x, q.y, o.x, o.y) < 80)) continue;
      const rx = R.int(22, 56);
      L.puddles.push({ x: q.x, y: q.y, rx, ry: Math.round(rx * (0.5 + R.f() * 0.25)), kind: R.pick(pk) });
      i++;
    }
    L.revealStart = () => L.reveal(L.entrance.x, L.entrance.y, 9);
    return L;
  };
})(window.CH);
