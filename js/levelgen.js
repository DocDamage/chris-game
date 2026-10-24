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

  const LAYOUT = { catacombs: 'dungeon', castle: 'dungeon', gaslight: 'outdoor', deadwood: 'outdoor', dungeon: 'dungeon', office: 'dungeon', glitch: 'dungeon', volcano: 'dungeon', backyard: 'outdoor', zombie: 'outdoor', wasteland: 'outdoor', frozen: 'outdoor' };
  /* size classes in tiles: roughly 1.4x, 2.5x and 3.6x the old 2880x1620 arena */
  LG.SIZES = { S: [96, 64], M: [128, 88], L: [160, 104] };
  LG.MOBS = {
    backyard: ['slime', 'plant', 'spider', 'chicken', 'goblin'],
    deadwood: ['spider', 'plant', 'slime', 'goblin', 'chicken'],
    gaslight: ['influencer', 'intern', 'trashcan', 'spider', 'goblin'],
    catacombs: ['spider', 'golem', 'office', 'influencer', 'plant'],
    castle: ['influencer', 'office', 'fridge', 'toaster', 'pigeon', 'cart'],
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
    backyard: { kind: 'hive', name: 'HIVE' }, deadwood: { kind: 'grave', name: 'OSSUARY' }, gaslight: { kind: 'portal', name: 'CULT RIFT' }, catacombs: { kind: 'grave', name: 'OSSUARY' }, castle: { kind: 'gate', name: 'BLOOD GATE' }, zombie: { kind: 'grave', name: 'OSSUARY' },
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

  /* ---------------------------------------------------------------- height (PLAN.md 18, K7) */
  /* up to two rooms get a raised plateau (a rim of LEDGE cells with stairs in its south side) and one gets a ring of pit
     round an island with a chest, to jump to. Each change is kept only if everything the stage needs stays reachable. */
  function height(L, R0, stage, rooms, start, exitRoom) {
    const T = Level.TS;
    // its own random stream, from the map so far: the rest of the generator draws exactly what it drew before K7
    let hc = stage * 83492791;
    for (let i = 0; i < L.cells.length; i += 7) hc = (hc * 31 + L.cells[i] + i) | 0;
    const R = mkRng(U.seeded(hc >>> 0));
    L.top = new Uint8Array(L.tw * L.th); // the height of a floor cell (0 ground, 1 plateau, 2 its upper tier); of a LEDGE: the tier it rims
    L.stairs = new Set();
    L.ramps = new Set(); // stairs drawn as a slope (PLAN.md 19, W5)
    L.bridges = []; // { x0, y0, w, h, key }: the planks over a chasm
    const spots = () => [L.entrance, L.exit].concat(L.waypoints, L.spawners, L.chests.filter((c) => !c.island), L.shrines, L.packs);
    let base = null; // the floor reachable before any change: no change may cut a piece of it off (a secret room is dug off any floor later)
    const reach = (skip) => { // by the cells alone (the outdoor layout's scattered props are not this step's business)
      L.flows.clear();
      const props = L.props;
      L.props = [];
      const f = L.flowFor(L.entrance.x, L.entrance.y);
      L.props = props;
      let ok = spots().every((s) => f.dist[L.idx(Math.floor(s.x / T), Math.floor(s.y / T))] >= 0);
      if (ok && base) for (let i = 0; i < base.length && ok; i++) if (base[i] && L.cells[i] === Level.FLOOR && f.dist[i] < 0 && !(skip && skip(i % L.tw, Math.floor(i / L.tw)))) ok = false;
      if (!base) { base = new Uint8Array(L.cells.length); for (let i = 0; i < base.length; i++) base[i] = f.dist[i] >= 0 ? 1 : 0; }
      L.flows.clear();
      return ok;
    };
    reach();
    const busy = (x0, y0, x1, y1) => spots().some((s) => { const tx = Math.floor(s.x / T), ty = Math.floor(s.y / T); return tx >= x0 - 1 && tx <= x1 + 1 && ty >= y0 - 1 && ty <= y1 + 1; });
    const rectOf = (rm) => {
      if (rm.r) { const hw = Math.floor(rm.r * 0.55), cx = Math.floor(rm.cx / T), cy = Math.floor(rm.cy / T); return [cx - hw, cy - Math.floor(hw * 0.8), cx + hw, cy + Math.floor(hw * 0.8)]; }
      return [rm.x + 2, rm.y + 2, rm.x + rm.w - 3, rm.y + rm.h - 3];
    };
    const free = rooms.filter((rm) => rm !== start && rm !== exitRoom && !L.spawners.some((s) => s.room === rm.id));
    const mix = (a, b) => { let n = (a * 374761393 + b * 668265263 + hc) | 0; n = (n ^ (n >> 13)) * 1274126177; return (n ^ (n >> 16)) >>> 0; };
    const order = free.slice().sort((a, b) => mix(a.id, 1) - mix(b.id, 1)); // a fixed shuffle: no draws, so nothing downstream depends on how many
    let plateaus = 0;
    for (const rm of order) {
      if (plateaus >= 2) break;
      const [x0, y0, x1, y1] = rectOf(rm);
      if (x1 - x0 < 5 || y1 - y0 < 4) continue;
      // the plateau holds the room's spots on top (the chest, a shrine) but none may sit on its rim
      const rim = [];
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if ((x === x0 || x === x1 || y === y0 || y === y1) && L.cell(x, y) === Level.FLOOR) rim.push([x, y]);
      if (spots().some((s) => rim.some(([x, y]) => x === Math.floor(s.x / T) && y === Math.floor(s.y / T)))) continue;
      const sx = x0 + 1 + (mix(x0, y1) % Math.max(1, x1 - x0 - 3));
      const ramp = mix(y0, x1) % 3 === 0 && x1 - x0 >= 7; // now and then a ramp, three wide
      const steps = ramp ? [[sx, y1], [sx + 1, y1], [sx + 2, y1]] : [[sx, y1], [sx + 1, y1]];
      for (const [x, y] of rim) if (!steps.some(([a, b]) => a === x && b === y)) L.cells[L.idx(x, y)] = Level.LEDGE;
      if (!reach()) { for (const [x, y] of rim) L.cells[L.idx(x, y)] = Level.FLOOR; continue; }
      for (let y = y0 + 1; y < y1; y++) for (let x = x0 + 1; x < x1; x++) if (L.cell(x, y) === Level.FLOOR) L.top[L.idx(x, y)] = 1;
      for (const [x, y] of rim) if (L.cell(x, y) === Level.LEDGE) L.top[L.idx(x, y)] = 1;
      for (const [x, y] of steps) { L.stairs.add(L.idx(x, y)); if (ramp) L.ramps.add(L.idx(x, y)); }
      rm.plateau = [x0, y0, x1, y1];
      plateaus++;
      // a big plateau gets an upper tier: another rim inside, its own stairs on the far side from the first
      const ix0 = x0 + 2, iy0 = y0 + 2, ix1 = x1 - 2, iy1 = y1 - 2;
      if (ix1 - ix0 >= 5 && iy1 - iy0 >= 4 && mix(x0, y0) % 3 !== 0) {
        const irim = [];
        for (let y = iy0; y <= iy1; y++) for (let x = ix0; x <= ix1; x++) if ((x === ix0 || x === ix1 || y === iy0 || y === iy1) && L.cell(x, y) === Level.FLOOR) irim.push([x, y]);
        const onRim = spots().some((s) => irim.some(([x, y]) => x === Math.floor(s.x / T) && y === Math.floor(s.y / T)));
        let isx = ix1 - 2 - (mix(ix0, iy1) % Math.max(1, ix1 - ix0 - 3));
        if (Math.abs(isx - sx) < 3) isx = sx < (ix0 + ix1) / 2 ? ix1 - 2 : ix0 + 1; // not straight up from the first flight
        const isteps = [[isx, iy1], [isx + 1, iy1]];
        if (!onRim && Math.abs(isx - sx) >= 2) {
          for (const [x, y] of irim) if (!isteps.some(([a, b]) => a === x && b === y)) { L.cells[L.idx(x, y)] = Level.LEDGE; L.top[L.idx(x, y)] = 2; }
          if (!reach()) { for (const [x, y] of irim) { L.cells[L.idx(x, y)] = Level.FLOOR; L.top[L.idx(x, y)] = 1; } }
          else {
            for (let y = iy0 + 1; y < iy1; y++) for (let x = ix0 + 1; x < ix1; x++) if (L.cell(x, y) === Level.FLOOR) L.top[L.idx(x, y)] = 2;
            for (const [x, y] of isteps) L.stairs.add(L.idx(x, y));
            rm.tier2 = [ix0, iy0, ix1, iy1];
          }
        }
      }
    }
    // the island: a one-tile ring of pit round a 3x3 patch, a chest in the middle
    for (const rm of order) {
      if (rm.plateau) continue;
      const cx = Math.floor(rm.cx / T), cy = Math.floor(rm.cy / T);
      const ring = [];
      let clear = true;
      for (let y = cy - 3; y <= cy + 3 && clear; y++) for (let x = cx - 3; x <= cx + 3; x++) {
        const d = Math.max(Math.abs(x - cx), Math.abs(y - cy));
        if (L.cell(x, y) !== Level.FLOOR) { if (d <= 2) clear = false; continue; }
        if (d === 2) ring.push([x, y]);
      }
      if (!clear || busy(cx - 3, cy - 3, cx + 3, cy + 3)) continue;
      for (const [x, y] of ring) L.cells[L.idx(x, y)] = Level.PIT;
      if (!reach((x, y) => Math.max(Math.abs(x - cx), Math.abs(y - cy)) < 2)) { for (const [x, y] of ring) L.cells[L.idx(x, y)] = Level.FLOOR; continue; } // (the patch inside is jumped to)
      L.chests.push({ x: cx * T + 16, y: cy * T + 18, opened: false, id: L.chests.length, room: rm.id, tier: stage + 2, secret: true, island: true });
      rm.island = true;
      for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 1; x <= cx + 1; x++) base[L.idx(x, y)] = 0; // reached by a jump from now on
      break;
    }
    // a chasm: a band of pit two tiles deep across a room from wall to wall, a bridge two tiles wide over its middle
    let chasms = 0;
    for (const rm of order) {
      if (chasms >= 1 || rm.plateau || rm.island || mix(stage, 4099) % 3 === 0) continue; // about two stages in three
      // a rectangle room, or the box round a round one (outdoor stages)
      const rx = rm.r ? Math.floor(rm.cx / T) - Math.floor(rm.r) : rm.x, rw = rm.r ? Math.floor(rm.r) * 2 + 1 : rm.w || 0, rh = rm.r ? rw : rm.h || 0, ry = rm.r ? Math.floor(rm.cy / T) - Math.floor(rm.r) : rm.y;
      if (rw < 10 || rh < 9) continue;
      const by = ry + Math.floor(rh / 2) - 1, bx = rx + Math.floor(rw / 2) - 1;
      const band = [];
      for (let y = by; y < by + 2; y++) for (let x = rx; x < rx + rw; x++) if (L.cell(x, y) === Level.FLOOR && (x < bx || x > bx + 1)) band.push([x, y]);
      if (busy(rx, by, rx + rw - 1, by + 1)) continue;
      for (const [x, y] of band) L.cells[L.idx(x, y)] = Level.PIT;
      if (!reach()) { for (const [x, y] of band) L.cells[L.idx(x, y)] = Level.FLOOR; continue; }
      L.bridges.push({ x0: bx, y0: by, w: 2, h: 2 });
      rm.chasm = true;
      chasms++;
    }
    L.flows.clear();
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
    else if (layout === 'sky' && CH.Sky) CH.Sky.gen(L, R); // flying islands and bridges (js/sky.js)
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

    if (layout !== 'sky') height(L, R, stage, rooms, start, exitRoom); // no cliffs on the islands: the void is their edge
    if (layout === 'dungeon' || opts.secrets || ['zombie', 'deadwood', 'gaslight', 'frozen'].includes(biome)) secretRooms(L, R, stage >= 2 ? R.int(1, 2) : 1);
    if (CH.Secrets) CH.Secrets.seal(L, R, stage); // some secrets wait behind an ability from a later act (PLAN.md 18, K8)
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
    // puddles come last, once the set pieces stand (js/setpieces.js calls LG.puddles at the end of its dressing)
    if (!(CH.SetPieces && CH.SetPieces.on)) LG.puddles(L, R.f);
    L.revealStart = () => L.reveal(L.entrance.x, L.entrance.y, 9);
    return L;
  };

  /* puddles of water / blood / toxic goo / lava (PLAN.md 20, request 2). One lies only on open floor: all of it on
     floor cells (no spilling up a wall, over a pit or a rim), clear of solid props, buildings, painted inlays and the
     stage's spots, and apart from every other puddle; now and then a small one or two beside it, as rain leaves them.
     Lava and goo keep off the trodden route. The Frozen Kingdom has its ice instead. */
  const PK = { catacombs: ['water', 'blood', 'water'], castle: ['blood', 'water', 'lava'], gaslight: ['water', 'water', 'blood'], deadwood: ['water', 'water', 'toxic'], backyard: ['water'], office: ['water'], glitch: ['toxic'], zombie: ['water', 'toxic', 'water'], wasteland: ['toxic', 'water'], volcano: ['lava', 'lava', 'water'], dungeon: ['water', 'blood'], frozen: [] };
  LG.puddles = function (L, rnd) {
    L.puddles = [];
    const pk = PK[L.biome] || ['water'];
    if (!pk.length || !L.rooms || !L.rooms.length) return L.puddles;
    const spots = [L.entrance, L.exit].concat(L.waypoints || [], L.spawners || [], L.chests || [], L.shrines || [], L.packs || []).filter(Boolean);
    const solids = (L.props || []).filter((p) => !p.dead && (p.solid || p.enter));
    const decals = (L.decals || []).filter((d) => d.img && d.img.width * d.img.height > 40 * 40); // inlays and rugs, not litter
    const fits = (x, y, rx, ry, kind) => {
      for (let yy = y - ry - 4; yy <= y + ry + 4; yy += 6) for (let xx = x - rx - 4; xx <= x + rx + 4; xx += 6) {
        if (((xx - x) / (rx + 4)) ** 2 + ((yy - y) / (ry + 4)) ** 2 > 1) continue;
        const tx = Math.floor(xx / TS), ty = Math.floor(yy / TS);
        if (L.cell(tx, ty) !== 0) return false;
        if (kind !== 'water' && kind !== 'blood' && L.route && L.route[L.idx(tx, ty)]) return false;
      }
      for (let k = 0; k < 24; k++) { const an = (k / 24) * Math.PI * 2; if (L.cell(Math.floor((x + Math.cos(an) * (rx + 2)) / TS), Math.floor((y + Math.sin(an) * (ry + 2)) / TS)) !== 0) return false; } // the rim itself (a wall corner can fall between the grid's points)
      for (const s of spots) if (Math.abs(s.x - x) < rx + 34 && Math.abs(s.y - y) < ry + 30) return false;
      for (const p of solids) {
        const hw = p.box ? p.box.hw : p.cr || 10, hh = p.box ? p.box.hh * 2 + 6 : (p.cr || 10) + 6;
        if (Math.abs(p.x - x) < rx + hw + 6 && p.y > y - ry - 8 && p.y - hh < y + ry + 6) return false;
      }
      for (const d of decals) if (Math.abs(d.x - x) < rx + d.img.width / 2 && Math.abs(d.y - y) < ry + d.img.height / 2) return false;
      for (const q of L.puddles) if (((q.x - x) / (q.rx + rx + 10)) ** 2 + ((q.y - y) / (q.ry + ry + 8)) ** 2 < 1) return false;
      return true;
    };
    const np = 5 + Math.floor(rnd() * 5);
    for (let i = 0, tries = 0; i < np && tries < np * 40; tries++) {
      let q;
      if (tries % 2) { // anywhere on open floor (outdoor maps are mostly the ground between rooms)
        const tx = 1 + Math.floor(rnd() * (L.tw - 2)), ty = 1 + Math.floor(rnd() * (L.th - 2));
        q = L.cell(tx, ty) === 0 && L.isOpen((tx + 0.5) * TS, (ty + 0.5) * TS, 30) ? { x: (tx + 0.5) * TS, y: (ty + 0.5) * TS } : null;
      } else {
        const rm = L.rooms[Math.floor(rnd() * L.rooms.length)];
        if (rm.tag === 'start' || rm.tag === 'town') continue;
        q = L.randomNear(rm.cx, rm.cy, 0, Math.max(60, Math.min((rm.w || 10) * TS * 0.42, 220)), 30, rnd);
      }
      if (!q) continue;
      const kind = pk[Math.floor(rnd() * pk.length)];
      const rx = Math.round(20 + rnd() * 26), ry = Math.round(rx * (0.48 + rnd() * 0.2));
      if (!fits(q.x, q.y, rx, ry, kind)) continue;
      L.puddles.push({ x: Math.round(q.x), y: Math.round(q.y), rx, ry, kind });
      i++;
      // a small one or two at its side, as rain leaves them
      if (kind === 'water' && rnd() < 0.55) for (let k = 0; k < 1 + Math.floor(rnd() * 2); k++) {
        const a = rnd() * Math.PI * 2, sr = Math.round(6 + rnd() * 7), sx = Math.round(q.x + Math.cos(a) * (rx + sr + 5)), sy = Math.round(q.y + Math.sin(a) * (ry + sr * 0.6 + 4));
        if (fits(sx, sy, sr, Math.round(sr * 0.6), kind)) L.puddles.push({ x: sx, y: sy, rx: sr, ry: Math.round(sr * 0.6), kind });
      }
    }
    return L.puddles;
  };
})(window.CH);
