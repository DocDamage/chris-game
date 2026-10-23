/* CHAOS.exe - set pieces: stages dressed as places (PLAN.md section 15, requests 1, 9 and 12).
   Rooms used to get props scattered at random. Now every room has a role on the way from the entrance to the exit and
   is built as a scene from catalogue kinds that belong together (js/props.js):
     hero camp      the entrance: a campfire, bedrolls, supplies, a lamp
     enemy camp     around each breach: a palisade / barricade ring with two gaps, a fire, supply piles, banners,
                    cages and bones; the room's monsters loiter around it until a hero comes close
     ruin           a broken building outline (back wall, side walls, a front with a gap) with rubble inside
     yard           rows of crates, barrels and cases by a fence, a lamp
     graveyard      rows of grave markers, statues, candles, dead trees, a fence
     grove          trees, shrubs, rocks and a fallen log (outdoor biomes)
     street / wreck cars along a line, cones, barricades, lamps, bins (zombie city, wasteland)
     toxic          toxic pools, waste barrels, reactors and crystals (wasteland)
     shrine         an altar ringed by candles, braziers at the corners, statues (crypt, volcano, exit rooms)
     crypt / ward / storage / torture   dungeon interiors along the walls
     forge / lava   anvils, cauldrons, furnaces / lava rocks, geysers, fire traps (volcano)
   The route from the entrance to the exit is marked: a trodden path in the floor of outdoor stages, lights along it,
   a signpost where it leaves the start, braziers flanking the exit. A last pass keeps every breach, chest, shrine,
   waypoint and the exit reachable (solid scenery that would wall one off is removed). */
(function (CH) {
  'use strict';
  const U = CH.U;
  const PR = CH.Props;
  const S = CH.Sprites;
  const TS = CH.Level.TS;
  const wrap = CH.X.wrap;
  const LG = CH.LevelGen;
  const SP = (CH.SetPieces = { on: true });

  const FAM = { backyard: 'm', frozen: 'm', zombie: 'z', wasteland: 'w', volcano: 'v', dungeon: 'h', office: 'h', glitch: 'h' };
  const ALT = { backyard: 'v', frozen: 'v', zombie: 'w', wasteland: 'z', volcano: 'm', dungeon: 'm', office: 'z', glitch: 'm' };
  /* scenes each biome draws from (the first entries are the most common) */
  const SCENES = {
    backyard: ['grove', 'ruin', 'yard', 'graveyard', 'grove', 'camp'],
    frozen: ['grove', 'ruin', 'graveyard', 'yard', 'camp'],
    zombie: ['street', 'wreck', 'yard', 'ruin', 'graveyard', 'camp'],
    wasteland: ['wreck', 'toxic', 'yard', 'ruin', 'camp'],
    volcano: ['forge', 'lava', 'shrine', 'ruin', 'camp'],
    dungeon: ['crypt', 'storage', 'torture', 'shrine', 'ward'],
    office: ['ward', 'storage', 'crypt', 'shrine'],
    glitch: ['crypt', 'shrine', 'storage', 'torture'],
  };
  /* the Valley Ruin props (outdoor biomes) as catalogue kinds */
  const OBJ = {
    tree: ['obj.tree1', 'obj.tree2', 'obj.tree3', 'obj.treeAutumn1', 'obj.treeAutumn2', 'obj.treeAutumn3'],
    darktree: ['obj.treeDark1', 'obj.treeDark2', 'obj.treeDark3'],
    deadtree: ['obj.deadTree1', 'obj.deadTree2', 'obj.deadTree3'],
    shrub: ['obj.bush1', 'obj.bush2', 'obj.bush3', 'obj.bush4', 'obj.bush5', 'obj.bush6', 'obj.grassTuft'],
    rock: ['obj.rocks1', 'obj.rocks2', 'obj.rockStack', 'obj.mossRocks1', 'obj.mossRocks2', 'obj.mossStack'],
    boulder: ['obj.bigRocks', 'obj.standingStone'],
    pillar: ['obj.pillar1', 'obj.pillar2', 'obj.pillar3', 'obj.pillar4', 'obj.pillar5'],
    statue: ['obj.statue'],
    pot: ['obj.jarBlue', 'obj.jarClay'],
    flower: ['obj.flowerPurple1', 'obj.flowerPurple2', 'obj.flowerBlue1', 'obj.flowerBlue2', 'obj.grassTuft'],
  };
  const LIGHT_KIND = { m: 'torch', v: 'brazier', z: 'lamp', w: 'lamp', h: 'brazier' };
  const FIRE = { backyard: 'amber', office: 'orange', glitch: 'cyan', zombie: 'green', wasteland: 'orange', volcano: 'orange', dungeon: 'purple', frozen: 'cyan' };
  const hash = (a, b) => { let n = (a * 374761393 + b * 668265263) | 0; n = (n ^ (n >> 13)) * 1274126177; return ((n ^ (n >> 16)) >>> 0) / 4294967296; };
  const MIRROR = { corpse: 1, bones: 1, skeleton: 1, debris: 1, patch: 1, ashes: 1, pool: 1 }; // decals with writing (blood "HELP", signs) are never mirrored
  const FLAT = { patch: 1, ashes: 1, decal: 1, scrawl: 1, plate: 1, corpse: 1, bones: 1, skeleton: 1, debris: 1, pool: 1, rug: 1, pallet: 1, pipe: 1 };

  /* ------------------------------------------------------------------ a dressing session for one level */
  function Dresser(L, biome) {
    const seed = Math.round(L.entrance.x * 13 + L.entrance.y * 7) + L.tw * 5 + L.th;
    let n = 0;
    const D = {
      L, biome, fam: FAM[biome] || 'h', alt: ALT[biome] || 'm',
      r: () => hash(seed, n++),
      reserved: [],
      placed: [],
    };
    D.pick = (list) => list[Math.floor(D.r() * list.length) % list.length];
    /* a catalogue key (or obj.* sprite) of a kind for this biome */
    D.key = (kind, famOverride) => {
      const f = famOverride || D.fam;
      if (f === 'm' && OBJ[kind] && D.r() < 0.6) {
        const ok = OBJ[kind].filter((k) => S.has(k));
        if (ok.length) return D.pick(ok);
      }
      let pool = PR.pool(kind, f);
      if (!pool.length) pool = PR.pool(kind, D.alt);
      if (!pool.length && OBJ[kind]) pool = OBJ[kind].filter((k) => S.has(k));
      if (!pool.length) pool = PR.pool(kind, 'zwvhm');
      return pool.length ? D.pick(pool) : null;
    };
    /* a picker that keeps to the sheet of its first piece: one building's walls, one camp's palisade match */
    D.kit = (kind) => {
      const first = D.key(kind);
      if (!first) return () => null;
      if (first.startsWith('obj.')) return () => D.key(kind);
      const sheet = first.split('.')[1];
      const pool = PR.pool(kind, 'zwvhm').filter((k) => k.split('.')[1] === sheet);
      return () => D.pick(pool);
    };
    D.reserve = (x, y, r) => D.reserved.push({ x, y, r });
    /* is a footprint free: floor under it, clear of reserved spots and other solid props */
    D.free = (x, y, hw, hh, solid) => {
      const m = 4;
      for (let ty = Math.floor((y - hh * 2 - m) / TS); ty <= Math.floor((y + m) / TS); ty++) for (let tx = Math.floor((x - hw - m) / TS); tx <= Math.floor((x + hw + m) / TS); tx++) if (L.solid(tx, ty)) return false;
      for (const q of D.reserved) if (U.dist(x, y, q.x, q.y) < q.r + Math.max(hw, hh)) return false;
      if (!solid) return true;
      for (const p of L.props) {
        if (p.dead || !p.solid) continue;
        const pw = p.box ? p.box.hw : p.cr || 10, ph = p.box ? p.box.hh * 2 : (p.cr || 10) * 1.2;
        // a hero's feet (about 10 px) must fit between two solid pieces: a narrower gap traps them, pushed from one into the other
        if (Math.abs(p.x - x) < pw + hw + 12 && Math.abs(p.y - y) < Math.max(ph, hh * 2) + 12) return false;
      }
      return true;
    };
    /* place one piece; returns the prop (solid or walk-through) or the decal, null when it does not fit */
    D.put = (key, x, y, o) => {
      if (!key) return null;
      o = o || {};
      x = Math.round(x);
      y = Math.round(y);
      // Valley Ruin props: sprites already at game scale, known kinds
      if (key.startsWith('obj.')) {
        if (!S.has(key)) return null;
        const kind = Object.keys(OBJ).find((k) => OBJ[k].includes(key)) || 'rock';
        const sp = S.get(key);
        const tree = kind === 'tree' || kind === 'darktree' || kind === 'deadtree';
        const box = kind === 'shrub' || kind === 'flower' ? null : { hw: Math.round(sp.w * (tree ? 0.14 : 0.38)), hh: tree ? 4 : Math.max(4, Math.round(sp.h * 0.14)) };
        if (!o.force && !D.free(x, y, box ? box.hw : 6, box ? box.hh : 3, !!box)) return null;
        CH.Arenas.addProp(L.props, key, x, y, box ? { solid: true, box, cy: -box.hh + 1, jumpable: !tree && sp.h < 40, elevation: 10, destructible: !tree, hp: 45, resourceType: 'stone' } : { solid: false });
        const p = L.props[L.props.length - 1];
        p.sp = true;
        D.placed.push(p);
        return p;
      }
      const info = PR.info(key);
      if (!info || info.skip) return null;
      const name = PR.sprite(key, o.scale);
      if (!name) return null;
      // flat pieces are painted into the floor
      if (FLAT[info.kind]) {
        const fr = S.get(name).frames[0];
        if (!o.force) for (const q of D.reserved) if (q.hard && U.dist(x, y, q.x, q.y) < q.r) return null;
        L.decals.push({ key, img: fr, x, y: y - Math.round(fr.height / 2), a: o.a || 0.95, fx: o.flip || (D.r() < 0.5 && MIRROR[info.kind] === 1), fy: false });
        return L.decals[L.decals.length - 1];
      }
      const box = PR.boxFor(name, info.kind);
      const solid = !!box;
      if (!o.force && !D.free(x, y, box ? box.hw : 5, box ? box.hh : 3, solid)) return null;
      const sp = S.get(name);
      CH.Arenas.addProp(L.props, name, x, y, {
        kind: info.tree ? 'tree' : undefined, solid, box, cy: box ? -box.hh + 1 : -3, cat: info.kind,
        jumpable: !!info.j && sp.h <= 46, elevation: Math.min(14, Math.round(sp.h * 0.35)),
        destructible: !!info.d, hp: info.hp || 40, resourceType: info.res || 'stone', resourceAmt: 2,
        swayable: !!info.sway,
      });
      const p = L.props[L.props.length - 1];
      p.sheet = key;
      p.sp = true;
      if (info.tree) { p.kind = 'tree'; p.choppable = true; p.swayable = true; }
      if (info.l && CH.Sheets) { // lights glow with their own colour and cast shadows (js/fires.js, js/postfx.js)
        CH.Sheets.sprite(key);
        const inf = CH.Sheets.info[key];
        if (inf) { p.glow = inf.glow; p.lr = 60 + Math.min(40, sp.h); p.phase = D.r(); }
      }
      if (info.fx) p.additive = true;
      if (o.flip) p.flip = true;
      D.placed.push(p);
      return p;
    };
    /* place near (x, y): tries a few spots in a ring */
    D.near = (key, x, y, rmax, o) => {
      for (let t = 0; t < 8; t++) {
        const a = D.r() * Math.PI * 2, d = (t / 8) * (rmax || 20);
        const p = D.put(key, x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8, o);
        if (p) return p;
      }
      return null;
    };
    D.fire = (x, y) => {
      if (CH.Fires && CH.Assets.images['prop.camp.' + (FIRE[biome] || 'amber')] && D.free(x, y, 10, 5, true)) {
        const p = CH.Fires.place(L.props, x, y, FIRE[biome] || 'amber', D.r() < 0.7);
        if (p) { p.sp = true; D.placed.push(p); return p; }
      }
      return D.put(D.key('campfire') || D.key('brazier'), x, y);
    };
    D.light = (x, y) => D.put(D.key(LIGHT_KIND[D.fam] || 'torch') || D.key('torch') || D.key('lamp'), x, y);
    /* a little heap of supplies: a few crates / barrels / sacks touching each other */
    D.pile = (x, y, kinds, nmax) => {
      const k = kinds || ['crate', 'barrel', 'sack', 'crate', 'case'];
      let cx = x, cy = y, got = 0;
      for (let i = 0; i < (nmax || 4); i++) {
        const p = D.put(D.key(D.pick(k)), cx, cy);
        if (p) {
          got++;
          const w = p.box ? p.box.hw * 2 : 14;
          cx += (D.r() < 0.5 ? 1 : -1) * (w * 0.5 + 6 + D.r() * 6);
          cy += (D.r() - 0.5) * 10;
        } else { cx = x + (D.r() - 0.5) * 30; cy = y + (D.r() - 0.5) * 20; }
      }
      // loose items and litter at its foot
      for (let i = 0; i < 2; i++) D.put(D.key(D.pick(['item', 'item', 'debris', 'pack'])), x + (D.r() - 0.5) * 50, y + 8 + D.r() * 12);
      return got;
    };
    D.scatter = (kind, x, y, R, nn) => { for (let i = 0; i < nn; i++) { const a = D.r() * 6.283, d = Math.sqrt(D.r()) * R; D.put(D.key(kind), x + Math.cos(a) * d, y + Math.sin(a) * d * 0.75); } };
    return D;
  }

  /* usable area of a room: centre and radii (px), keeping the band by its walls free for the corridors */
  function area(L, rm) {
    if (rm.r) return { x: rm.cx, y: rm.cy, rx: Math.max(40, (rm.r - 1.6) * TS), ry: Math.max(36, (rm.r - 1.8) * TS) };
    return { x: rm.cx, y: rm.cy, rx: Math.max(40, (rm.w / 2 - 1.6) * TS), ry: Math.max(36, (rm.h / 2 - 1.8) * TS) };
  }
  const inA = (A, x, y) => ((x - A.x) * (x - A.x)) / (A.rx * A.rx) + ((y - A.y) * (y - A.y)) / (A.ry * A.ry) <= 1;

  /* ------------------------------------------------------------------ scenes */
  const SCENE = {};
  /* the heroes' own camp by the entrance */
  SCENE.herocamp = (D, A, at) => {
    let x = at.x + 60, y = at.y + 20;
    for (let t = 0; t < 16; t++) { // a clear spot beside the entrance, off the trail
      const a = (t / 16) * 6.283 + 0.4, d = 64 + (t % 3) * 18;
      const qx = at.x + Math.cos(a) * d, qy = at.y + Math.sin(a) * d * 0.8;
      if (D.free(qx, qy, 34, 14, true) && !(D.L.route && D.L.route[D.L.idx(Math.floor(qx / TS), Math.floor(qy / TS))])) { x = qx; y = qy; break; }
    }
    D.fire(x, y);
    D.put(D.key('ashes'), x + 30, y + 14);
    for (let i = 0; i < 3; i++) { const a = -0.6 + i * 1.1; D.put(D.key('pack'), x + Math.cos(a) * 30, y + Math.sin(a) * 18 + 6); }
    D.pile(x + 56, y - 26, ['crate', 'case', 'barrel'], 3);
    D.near(D.key('signpost'), at.x - 34, at.y + 30, 20);
    D.light(at.x - 40, at.y - 10);
  };
  /* an enemy camp around a breach or a sleeping pack: a ring with two gaps, a fire, piles, banners, bones */
  SCENE.camp = (D, A, at, o) => {
    const cx = at.x, cy = at.y;
    const R = Math.min(A.rx, A.ry * 1.3, 120);
    const ring = D.fam === 'h' ? ['spikes', 'fence'] : D.fam === 'z' ? ['barricade', 'sandbag', 'fence', 'wire'] : D.fam === 'w' ? ['barricade', 'fence', 'spikes', 'sandbag'] : ['spikes', 'spikes', 'fence'];
    const ringKey = D.kit(D.pick(ring));
    const gap0 = D.r() * 6.283;
    const segs = Math.max(6, Math.round((R * 6.283) / 46));
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * 6.283;
      const g1 = Math.abs(U.angDiff(a, gap0)), g2 = Math.abs(U.angDiff(a, gap0 + Math.PI));
      if (g1 < 0.5 || g2 < 0.5) continue; // two ways in
      const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R * 0.72;
      if (!inA(A, x, y)) continue;
      D.put(ringKey(), x, y);
    }
    // banners at the gaps
    for (const a of [gap0, gap0 + Math.PI]) {
      for (const s of [-0.62, 0.62]) D.put(D.key('banner') || D.key('torch'), cx + Math.cos(a + s) * R, cy + Math.sin(a + s) * R * 0.72);
    }
    // the fire off-centre (the breach itself sits in the middle), piles at the sides, bones and corpses about
    const fa = gap0 + Math.PI / 2;
    if (!o || !o.noFire) D.fire(cx + Math.cos(fa) * R * 0.45, cy + Math.sin(fa) * R * 0.32);
    D.pile(cx + Math.cos(fa + Math.PI) * R * 0.5, cy + Math.sin(fa + Math.PI) * R * 0.35, null, 4);
    D.pile(cx + Math.cos(fa + 2.2) * R * 0.55, cy + Math.sin(fa + 2.2) * R * 0.4, ['sack', 'barrel', 'crate'], 3);
    for (let i = 0; i < 3; i++) D.put(D.key('pack'), cx + Math.cos(fa + 0.6 + i * 0.5) * R * 0.3, cy + Math.sin(fa + 0.6 + i * 0.5) * R * 0.24);
    D.near(D.key('cage') || D.key('anvil'), cx + Math.cos(fa - 1.6) * R * 0.55, cy + Math.sin(fa - 1.6) * R * 0.4, 16);
    D.scatter('bones', cx, cy, R * 0.8, 4);
    D.scatter('ashes', cx, cy, R * 0.6, 1);
    D.scatter(D.fam === 'h' ? 'scrawl' : D.fam === 'm' || D.fam === 'v' ? 'skeleton' : 'corpse', cx, cy, R * 0.8, 2);
    D.scatter('debris', cx, cy, R, 3);
    return { x: cx, y: cy, r: R };
  };
  /* a breach nest where camps do not fit the biome: growths, crystals, pools, corpses */
  SCENE.nest = (D, A, at) => {
    const cx = at.x, cy = at.y, R = Math.min(A.rx, 100);
    for (let i = 0; i < 7; i++) { const a = (i / 7) * 6.283 + D.r() * 0.4, d = R * (0.55 + D.r() * 0.35); D.put(D.key(D.pick(['growth', 'growth', 'crystal', 'rock'])), cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.72); }
    D.scatter('pool', cx, cy, R * 0.7, 2);
    D.scatter('corpse', cx, cy, R * 0.8, 3);
    D.scatter('bones', cx, cy, R, 4);
    return { x: cx, y: cy, r: R };
  };
  /* a ruined building: back wall, short side walls, a front wall with a door gap, rubble inside */
  SCENE.ruin = (D, A) => {
    const w = Math.min(A.rx * 1.4, 190), h = Math.min(A.ry * 1.2, 120);
    const x0 = A.x - w / 2, y0 = A.y - h / 2;
    const wall = D.kit('wall');
    const pillar = D.kit('pillar');
    let x = x0;
    while (x < x0 + w) { const p = D.put(wall(), x + 22, y0); x += p && p.box ? p.box.hw * 2 - 2 : 30; } // back wall
    for (let y = y0 + 34; y < y0 + h - 10; y += 34) { D.put(pillar() || wall(), x0, y); D.put(pillar() || wall(), x0 + w, y); } // sides
    const door = x0 + w * (0.3 + D.r() * 0.4);
    x = x0;
    while (x < x0 + w) { if (Math.abs(x + 20 - door) > 34) { const p = D.put(wall(), x + 20, y0 + h); x += p && p.box ? p.box.hw * 2 - 2 : 30; } else x += 30; }
    D.scatter('rubble', A.x, A.y + 6, Math.min(w, h) * 0.35, 3);
    D.scatter('debris', A.x, A.y, Math.min(w, h) * 0.45, 4);
    D.pile(A.x + (D.r() - 0.5) * w * 0.4, A.y - h * 0.15, ['crate', 'barrel', 'pot'], 2);
    D.put(D.key('shrub'), x0 + 14, y0 + h - 8);
  };
  /* a storage yard: rows of crates / barrels / cases along a fence */
  SCENE.yard = (D, A) => {
    const y0 = A.y - A.ry * 0.5;
    const fence = D.kit('fence');
    let x = A.x - A.rx * 0.7;
    while (x < A.x + A.rx * 0.7) { const p = D.put(fence(), x, y0); x += p && p.box ? p.box.hw * 2 : 40; }
    for (let row = 0; row < 2; row++) {
      const y = A.y - A.ry * 0.05 + row * 40;
      for (let x2 = A.x - A.rx * 0.55; x2 < A.x + A.rx * 0.55; x2 += 46 + D.r() * 14) if (D.r() < 0.75) D.pile(x2, y, ['crate', 'barrel', 'case', 'crate', 'sack'], 2);
    }
    D.put(D.key('pallet'), A.x + A.rx * 0.4, A.y + A.ry * 0.5);
    D.light(A.x - A.rx * 0.65, y0 + 20);
  };
  SCENE.graveyard = (D, A) => {
    const cols = Math.max(2, Math.min(5, Math.floor((A.rx * 1.4) / 42))), rows = Math.max(2, Math.min(3, Math.floor((A.ry * 1.2) / 40)));
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (D.r() < 0.18) continue;
      D.put(D.key('grave') || D.key('smallstatue'), A.x + (c - (cols - 1) / 2) * 42 + (D.r() - 0.5) * 6, A.y + (r - (rows - 1) / 2) * 40);
    }
    D.put(D.key('statue') || D.key('obelisk'), A.x - A.rx * 0.75, A.y - A.ry * 0.5);
    D.put(D.key('deadtree'), A.x + A.rx * 0.8, A.y - A.ry * 0.45);
    D.scatter('candles', A.x, A.y, A.rx * 0.5, 3);
    D.scatter('bones', A.x, A.y, A.rx * 0.7, 3);
  };
  SCENE.grove = (D, A) => {
    const nt = 4 + Math.floor(D.r() * 4);
    for (let i = 0; i < nt; i++) { const a = D.r() * 6.283, d = A.rx * (0.3 + D.r() * 0.6); D.put(D.key(D.biome === 'frozen' ? D.pick(['deadtree', 'darktree', 'tree']) : D.pick(['tree', 'tree', 'deadtree'])), A.x + Math.cos(a) * d, A.y + Math.sin(a) * d * 0.7); }
    D.scatter('shrub', A.x, A.y, A.rx * 0.85, 6);
    D.scatter('rock', A.x, A.y, A.rx * 0.7, 3);
    D.near(D.key('log') || D.key('stump'), A.x, A.y, 30);
    D.scatter('mushroom', A.x, A.y, A.rx * 0.5, 2);
  };
  /* a stretch of road: wrecked cars in a line, cones and barricades, lamps, bins */
  SCENE.street = (D, A) => {
    const y = A.y + (D.r() - 0.5) * A.ry * 0.4;
    let x = A.x - A.rx * 0.8;
    while (x < A.x + A.rx * 0.8) { const p = D.r() < 0.55 ? D.put(D.key('car'), x + 30, y) : null; x += p && p.box ? p.box.hw * 2 + 24 + D.r() * 30 : 50; }
    for (let i = 0; i < 3; i++) D.put(D.key('cone'), A.x + (D.r() - 0.5) * A.rx * 1.4, y + 30 + D.r() * 10);
    D.put(D.key('barricade'), A.x + (D.r() - 0.5) * A.rx, y - 34);
    for (const s of [-1, 1]) D.put(D.key('lamp'), A.x + s * A.rx * 0.6, y - 44);
    D.put(D.key('bin'), A.x - A.rx * 0.3, y - 40);
    D.put(D.key('streetbit'), A.x + A.rx * 0.25, y - 40);
    D.scatter('trash', A.x, A.y, A.rx * 0.7, 2);
    D.scatter('debris', A.x, y + 10, A.rx * 0.8, 4);
    D.scatter('decal', A.x, A.y, A.rx * 0.6, 2);
  };
  SCENE.wreck = (D, A) => {
    for (let i = 0; i < 3; i++) D.near(D.key(D.pick(['car', 'carv'])), A.x + (D.r() - 0.5) * A.rx, A.y + (D.r() - 0.5) * A.ry, 30);
    D.scatter('tires', A.x, A.y, A.rx * 0.7, 2);
    D.scatter('rubble', A.x, A.y, A.rx * 0.8, 2);
    D.near(D.key('firebarrel'), A.x, A.y + 20, 30);
    D.scatter('debris', A.x, A.y, A.rx, 4);
    D.scatter('trash', A.x, A.y, A.rx * 0.8, 2);
  };
  SCENE.toxic = (D, A) => {
    D.scatter('pool', A.x, A.y, A.rx * 0.5, 3);
    for (let i = 0; i < 3; i++) D.pile(A.x + (D.r() - 0.5) * A.rx * 1.2, A.y + (D.r() - 0.5) * A.ry, ['toxbarrel', 'toxbarrel', 'barrel'], 3);
    D.near(D.key('reactor'), A.x, A.y - A.ry * 0.4, 30);
    D.scatter('crystal', A.x, A.y, A.rx * 0.8, 3);
    D.scatter('plate', A.x, A.y, A.rx * 0.7, 2);
    D.scatter('pipestand', A.x, A.y, A.rx * 0.8, 2);
  };
  SCENE.shrine = (D, A) => {
    D.put(D.key('altar') || D.key('smallstatue'), A.x, A.y - 8);
    D.put(D.key('decal'), A.x, A.y + 18);
    for (let i = 0; i < 5; i++) { const a = Math.PI * (0.15 + i * 0.175); D.put(D.key('candles'), A.x + Math.cos(a) * 34, A.y + 22 + Math.sin(a) * 12); }
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) D.put(D.key('brazier') || D.key('torch'), A.x + sx * Math.min(A.rx * 0.7, 90), A.y + sy * Math.min(A.ry * 0.6, 60));
    for (const s of [-1, 1]) D.put(D.key('statue') || D.key('obelisk'), A.x + s * 56, A.y - 30);
  };
  /* dungeon rooms: things stand along the back wall and the sides, the middle stays open */
  function alongWalls(D, A, kinds, step) {
    const y = A.y - A.ry * 0.85;
    for (let x = A.x - A.rx * 0.85; x < A.x + A.rx * 0.85; x += step + D.r() * 12) D.put(D.key(D.pick(kinds)), x, y);
  }
  SCENE.crypt = (D, A) => {
    for (const s of [-1, 1]) for (let y = A.y - A.ry * 0.5; y <= A.y + A.ry * 0.6; y += 48) D.put(D.key('pillar') || D.key('statue'), A.x + s * A.rx * 0.55, y); // a colonnade
    alongWalls(D, A, ['statue', 'statue', 'hang', 'candles'], 40);
    D.put(D.key('altar'), A.x, A.y - A.ry * 0.4);
    D.scatter('bones', A.x, A.y, A.rx * 0.6, 4);
    D.scatter('candles', A.x, A.y, A.rx * 0.5, 3);
    D.scatter('scrawl', A.x, A.y, A.rx * 0.6, 1);
  };
  SCENE.ward = (D, A) => {
    for (let x = A.x - A.rx * 0.6; x <= A.x + A.rx * 0.6; x += 46) D.put(D.key('bed'), x, A.y - A.ry * 0.25);
    alongWalls(D, A, ['shelf', 'shelf', 'table', 'hang'], 44);
    D.put(D.key('table'), A.x, A.y + A.ry * 0.35);
    D.scatter('item', A.x, A.y + A.ry * 0.3, 30, 3);
    D.scatter('scrawl', A.x, A.y, A.rx * 0.7, 2);
    D.scatter('decal', A.x, A.y, A.rx * 0.7, 2);
  };
  SCENE.storage = (D, A) => {
    alongWalls(D, A, ['barrel', 'crate', 'shelf', 'sack'], 34);
    D.pile(A.x - A.rx * 0.5, A.y + A.ry * 0.3, null, 3);
    D.pile(A.x + A.rx * 0.5, A.y + A.ry * 0.2, null, 3);
    D.scatter('debris', A.x, A.y, A.rx * 0.7, 3);
  };
  SCENE.torture = (D, A) => {
    alongWalls(D, A, ['hang', 'hang', 'cage', 'machine'], 38);
    D.put(D.key('trap'), A.x - 30, A.y + 10);
    D.put(D.key('trap'), A.x + 34, A.y - 6);
    D.put(D.key('cage'), A.x + A.rx * 0.5, A.y + A.ry * 0.4);
    D.scatter('decal', A.x, A.y, A.rx * 0.6, 3);
    D.scatter('bones', A.x, A.y, A.rx * 0.7, 3);
  };
  SCENE.forge = (D, A) => {
    D.put(D.key('anvil'), A.x, A.y);
    D.put(D.key('machine'), A.x - 50, A.y - 30);
    D.put(D.key('cauldron'), A.x + 46, A.y - 20);
    D.pile(A.x + A.rx * 0.5, A.y + A.ry * 0.35, ['barrel', 'crate', 'sack'], 3);
    D.scatter('item', A.x, A.y + 20, 30, 3);
    for (const s of [-1, 1]) D.put(D.key('brazier'), A.x + s * A.rx * 0.65, A.y - A.ry * 0.5);
  };
  SCENE.lava = (D, A) => {
    D.scatter('lavarock', A.x, A.y, A.rx * 0.8, 4);
    D.scatter('decal', A.x, A.y, A.rx * 0.6, 3);
    D.near(D.key('geyser'), A.x, A.y, 40);
    D.near(D.key('firetrap'), A.x + A.rx * 0.4, A.y + A.ry * 0.3, 30);
    D.scatter('spike', A.x, A.y, A.rx * 0.8, 2);
  };

  /* ------------------------------------------------------------------ the route */
  function route(L) {
    const f = L.flowFor(L.exit.x, L.exit.y);
    const out = [];
    let tx = Math.floor(L.entrance.x / TS), ty = Math.floor(L.entrance.y / TS);
    for (let i = 0; i < 2000; i++) {
      out.push([tx, ty]);
      const d = f.dist[L.idx(tx, ty)];
      if (d <= 0) break;
      let best = null, bd = d;
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
        const nx = tx + ox, ny = ty + oy;
        if (!L.inb(nx, ny)) continue;
        const nd = f.dist[L.idx(nx, ny)];
        if (nd >= 0 && nd < bd) { bd = nd; best = [nx, ny]; }
      }
      if (!best) break;
      [tx, ty] = best;
    }
    return out;
  }

  /* ------------------------------------------------------------------ the whole level */
  SP.dress = function (L, biome) {
    const D = Dresser(L, biome);
    L.decals = L.decals || [];
    // keep the gameplay spots clear
    D.reserve(L.entrance.x, L.entrance.y, 46);
    D.reserve(L.exit.x, L.exit.y, 56);
    for (const w of L.waypoints) D.reserve(w.x, w.y, 34);
    for (const s of L.spawners) D.reserved.push({ x: s.x, y: s.y, r: 42, hard: true });
    for (const c of L.chests) D.reserve(c.x, c.y, 26);
    for (const s of L.shrines) D.reserve(s.x, s.y, 30);
    // the route first, so scenes leave it walkable
    const path = route(L);
    L.route = new Uint8Array(L.tw * L.th);
    for (const [tx, ty] of path) for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) if (L.inb(tx + ox, ty + oy) && !L.solid(tx + ox, ty + oy)) L.route[L.idx(tx + ox, ty + oy)] = 1;
    for (let i = 0; i < path.length; i += 3) { const [tx, ty] = path[i]; D.reserve((tx + 0.5) * TS, (ty + 0.5) * TS, 20); }
    // the trail painted into the floor: the route's own tiles, and their neighbours as a ragged edge
    L.trail = new Uint8Array(L.tw * L.th);
    for (const [tx, ty] of path) L.trail[L.idx(tx, ty)] = 2;
    for (const [tx, ty] of path) for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const i = L.idx(tx + ox, ty + oy); if (L.inb(tx + ox, ty + oy) && !L.trail[i]) L.trail[i] = 1; }
    L.chunks.clear();
    // rooms
    const scenes = SCENES[biome] || SCENES.dungeon;
    let si = Math.floor(D.r() * scenes.length);
    const camps = [];
    for (const rm of L.rooms) {
      if (rm.tag === 'town') continue;
      const A = area(L, rm);
      if (rm.tag === 'start') { SCENE.herocamp(D, A, L.entrance); continue; }
      const sp = L.spawners.find((s) => s.room === rm.id);
      const pk = L.packs.find((q) => q.room === rm.id);
      if (sp) {
        const nestBiome = biome === 'glitch' || biome === 'office';
        const c = (nestBiome ? SCENE.nest : SCENE.camp)(D, A, sp, { noFire: false });
        camps.push(c);
        if (pk) { pk.x = c.x + (D.r() - 0.5) * 40; pk.y = c.y + c.r * 0.35; pk.camp = c; }
        continue;
      }
      if (pk && D.r() < 0.5 && biome !== 'dungeon' && biome !== 'office' && biome !== 'glitch') {
        const c = SCENE.camp(D, A, { x: A.x, y: A.y }, {});
        pk.x = c.x; pk.y = c.y; pk.camp = c;
        camps.push(c);
        continue;
      }
      const name = rm.tag === 'exit' ? 'shrine' : scenes[si++ % scenes.length];
      const made = (SCENE[name] || SCENE.ruin)(D, A, { x: A.x, y: A.y }, {}); // an empty camp: a deserted one
      if (made && name === 'camp') camps.push(made);
      if (pk) pk.camp = { x: pk.x, y: pk.y, r: Math.min(A.rx, 90) };
    }
    // lights along the route, a signpost where it leaves the start, braziers flanking the exit
    for (let i = 8; i < path.length - 6; i += 9) {
      const [tx, ty] = path[i], [nx, ny] = path[Math.min(path.length - 1, i + 1)];
      const px = -(ny - ty), py = nx - tx; // perpendicular
      for (const s of [1, -1]) {
        const x = (tx + 0.5 + px * 2 * s) * TS, y = (ty + 0.5 + py * 2 * s) * TS;
        if (D.light(x, y)) break;
      }
    }
    if (path.length > 10) { const [tx, ty] = path[6]; D.near(D.key('signpost') || D.key('sign'), (tx + 1.8) * TS, (ty + 0.5) * TS, 24); }
    for (const s of [-1, 1]) D.put(D.key(LIGHT_KIND[D.fam] === 'lamp' ? 'lamp' : 'brazier') || D.key('torch'), L.exit.x + s * 46, L.exit.y - 10, { force: false });
    L.camps = camps;
    fields(D, L);
    edges(D, L);
    keepReachable(L);
    CH.Props.invalidate();
    return L;
  };

  /* the foot of the walls collects clutter (shrubs and stones outdoors, trash in the city, bones and chains in the
     crypt) and the floor gets stains and cracks, so corridors and open stretches stop looking bare. Solid clutter only
     goes where the passage is at least four tiles wide. */
  const EDGE = {
    m: ['shrub', 'shrub', 'shrub', 'rock', 'stump', 'mushroom', 'flower'],
    z: ['trash', 'debris', 'debris', 'bin', 'tires', 'shrub', 'plaque'],
    w: ['debris', 'debris', 'trash', 'tires', 'rubble', 'pipe', 'shrub'],
    v: ['rock', 'debris', 'bones', 'lavarock', 'spike'],
    h: ['bones', 'debris', 'hang', 'hang', 'pot', 'candles', 'scrawl'],
  };
  /* open ground between the rooms (outdoor maps are mostly that): a small clump every few tiles */
  const FIELD = {
    backyard: [['tree', 'tree', 'shrub', 'shrub'], ['tree', 'deadtree', 'shrub', 'flower'], ['rock', 'shrub', 'flower'], ['boulder', 'shrub', 'rock']],
    frozen: [['deadtree', 'rock', 'rock'], ['boulder', 'rock'], ['darktree', 'deadtree', 'rock']],
    zombie: [['car', 'debris', 'trash'], ['trash', 'bin', 'debris'], ['deadtree', 'shrub', 'debris'], ['barricade', 'cone', 'debris']],
    wasteland: [['rubble', 'debris', 'tires'], ['carv', 'debris'], ['toxbarrel', 'barrel', 'debris'], ['deadtree', 'shrub', 'debris']],
    volcano: [['lavarock', 'rock'], ['spike', 'lavarock', 'debris'], ['boulder', 'debris']],
    dungeon: [['pillar', 'debris'], ['rubble', 'debris', 'bones'], ['bones', 'debris']],
  };
  function fields(D, L) {
    const sets = FIELD[D.biome] || FIELD.dungeon;
    const inRoom = (x, y) => L.rooms.some((rm) => U.dist(x, y, rm.cx, rm.cy) < (rm.r ? rm.r * TS : Math.max(rm.w, rm.h) * TS * 0.55));
    const step = 7;
    for (let ty = 2; ty < L.th - 2; ty += step) for (let tx = 2; tx < L.tw - 2; tx += step) {
      const cx = tx + Math.floor(D.r() * step), cy = ty + Math.floor(D.r() * step);
      let open = true;
      for (let oy = -2; oy <= 2 && open; oy++) for (let ox = -2; ox <= 2; ox++) if (L.solid(cx + ox, cy + oy)) { open = false; break; }
      if (!open || (L.route && L.route[L.idx(cx, cy)])) continue;
      const px = cx * TS + 16, py = cy * TS + 16;
      if (inRoom(px, py) || D.r() > 0.55) continue;
      const set = D.pick(sets);
      for (let i = 0, k = 2 + Math.floor(D.r() * 3); i < k; i++) D.put(D.key(D.pick(set)), px + (D.r() - 0.5) * 64, py + (D.r() - 0.5) * 46);
    }
  }

  function edges(D, L) {
    const kinds = EDGE[D.fam] || EDGE.h;
    const wide = (tx, ty, dx, dy) => { for (let k = 1; k <= 4; k++) if (L.solid(tx + dx * k, ty + dy * k)) return false; return true; };
    for (let ty = 1; ty < L.th - 1; ty++) for (let tx = 1; tx < L.tw - 1; tx++) {
      if (L.solid(tx, ty) || (L.route && L.route[L.idx(tx, ty)])) continue;
      const north = L.solid(tx, ty - 1), west = L.solid(tx - 1, ty), east = L.solid(tx + 1, ty);
      if (!(north || west || east)) {
        if (D.r() < 0.018) D.put(D.key(D.fam === 'm' ? D.pick(['patch', 'shrub', 'flower', 'flower']) : 'decal'), tx * TS + 16, ty * TS + 20, { a: 0.85 }); // stains, cracks, patches
        continue;
      }
      if (D.r() > 0.16) continue;
      let kind = D.pick(kinds);
      if (kind === 'hang' && !north) kind = 'bones';
      const info = PR.KIND[kind];
      const solid = info && info.box;
      if (solid && !(north ? wide(tx, ty, 0, 1) : wide(tx, ty, west ? 1 : -1, 0))) continue;
      const x = tx * TS + 16 + (west ? -6 : east ? 6 : (D.r() - 0.5) * 12), y = ty * TS + (north ? 14 : 20);
      D.put(D.key(kind), x, y);
    }
  }

  /* solid scenery must not wall off anything the run needs: walk the flow field from the entrance and drop the
     set-piece props nearest to anything unreachable, until everything is */
  function keepReachable(L) {
    const targets = [L.exit].concat(L.spawners, L.packs, L.chests.filter((c) => !c.secret), L.shrines, L.waypoints);
    for (let pass = 0; pass < 40; pass++) {
      L.flows.clear();
      const f = L.flowFor(L.entrance.x, L.entrance.y);
      const bad = targets.find((t) => f.dist[L.idx(Math.floor(t.x / TS), Math.floor(t.y / TS))] < 0);
      if (!bad) break;
      let best = null, bd = 1e9;
      for (const p of L.props) {
        if (!p.sp || !p.solid || p.dead) continue;
        const d = U.dist(p.x, p.y, bad.x, bad.y);
        if (d < bd) { bd = d; best = p; }
      }
      if (!best) break;
      L.props.splice(L.props.indexOf(best), 1);
    }
    L.flows.clear();
  }

  /* levels: the scenes replace the random scatter of levelgen / fires / sheets (they check SP.on) */
  wrap(LG, 'generate', function (orig, biome, ...rest) {
    const L = orig.call(LG, biome, ...rest);
    if (SP.on && L.rooms && L.rooms.length && !L.isTown) SP.dress(L, biome);
    return L;
  });
  /* ------------------------------------------------------------------ camps are lived in */
  /* the monsters of a camp come out before a hero is close and amble about it (see Run.wake's loiter flag) */
  wrap(CH.Run, 'update', function (orig, dt) {
    const L = CH.G.level;
    if (L && L.packs && CH.Run.wake && !L.isTown) {
      for (const pk of L.packs) {
        if (pk.woke || !pk.camp) continue;
        for (const pl of CH.G.players) if (!pl.dead && U.dist(pl.x, pl.y, pk.x, pk.y) < 600) { CH.Run.wake(pk, true); break; }
      }
    }
    return orig.call(CH.Run, dt);
  });
  wrap(CH.Enemies.Enemy.prototype, 'update', function (orig, g, dt) {
    const lo = this.loiter;
    if (!lo || this.dead) return orig.call(this, g, dt);
    if (this.state === 'spawn' && this.spawnSilent) { this.state = 'idle'; this.t = 0.4; } // they were already here
    if (this.asleep === undefined) this.asleep = !!(S.has(this.look.sprite) && (S.get(this.look.sprite).anims || {}).sleep && Math.random() < 0.6); // spiders curl up
    let alert = this.hp < this.maxHp || (this.pack && this.pack.alert);
    if (!alert) for (const pl of g.players) if (!pl.dead && U.dist(pl.x, pl.y, this.x, this.y) < 210) alert = true;
    if (alert) { // the whole camp turns on the hero
      this.loiter = null;
      this.asleep = false;
      if (this.pack) this.pack.alert = true;
      if (this.look && this.look.atk && Math.random() < 0.5) CH.Audio.sfx(this.look.atk);
      return orig.call(this, g, dt);
    }
    if (g.warpT > 0) dt *= 0.42;
    this.age += dt;
    if (this.flash > 0) this.flash -= dt * 6;
    if (this.squash > 0) this.squash -= dt * 7;
    if (this.hurtT > 0) this.hurtT -= dt;
    this.dvx = this.dvy = 0;
    this.lt = (this.lt || 0) - dt;
    if (this.lt <= 0) { // a new errand: stand about, or walk to another spot of the camp
      this.lt = 1.2 + Math.random() * 2.8;
      if (Math.random() < 0.45) this.lg = null;
      else { const a = Math.random() * 6.283, d = Math.sqrt(Math.random()) * lo.r; this.lg = { x: lo.x + Math.cos(a) * d, y: lo.y + Math.sin(a) * d * 0.7 }; }
    }
    if (this.lg && !this.asleep) {
      const dx = this.lg.x - this.x, dy = this.lg.y - this.y, d = Math.hypot(dx, dy);
      if (d > 6) { const sp = (this.speed || 40) * 0.38; this.dvx = (dx / d) * sp; this.dvy = (dy / d) * sp; } else this.lg = null;
    }
    this.tgt = { x: lo.x, y: lo.y, isPlayer: false };
    this.integrate(g, dt);
  });

  SP.SCENE = SCENE;
  SP.Dresser = Dresser;
  SP.area = area;
})(window.CH);
