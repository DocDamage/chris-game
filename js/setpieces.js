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
  const SP = (CH.SetPieces = { on: true, after: {}, STRICT: {}, SINGLE: {} });

  const FAM = { catacombs: 'a', castle: 'r', gaslight: 'g', deadwood: 'c', backyard: 'm', frozen: 'f', zombie: 'z', wasteland: 'w', volcano: 'v', dungeon: 'h', office: 'h', glitch: 'h' };
  /* every family a biome dresses with (PLAN.md 21): its own pack first, then the packs of the second drop that belong
     there: Undead Land Objects (u) in the Dead Wood, the Catacombs, the Gaslight District and the Crypt; the Seabed (s)
     drowned in the Catacombs and the Crypt and grown in the Belly; the Flying Islands (i) and the Final Tower (t) in the
     sky; the Belly (b) inside the tower */
  const FAMS = { catacombs: 'aus', castle: 'r', gaslight: 'gu', deadwood: 'cu', backyard: 'm', frozen: 'f', zombie: 'z', wasteland: 'w', volcano: 'v', dungeon: 'hus', office: 'h', glitch: 'h', sky: 'it', belly: 'bst' };
  const ALLF = 'zwvhmcfgarusitb';
  SP.FAMS = FAMS;
  const ALT = { catacombs: 'h', castle: 'a', gaslight: 'z', deadwood: 'm', backyard: 'v', frozen: 'm', zombie: 'w', wasteland: 'z', volcano: 'm', dungeon: 'm', office: 'z', glitch: 'm' };
  /* scenes each biome draws from (the first entries are the most common) */
  const SCENES = {
    backyard: ['grove', 'ruin', 'yard', 'graveyard', 'grove', 'camp'],
    catacombs: ['ossuary', 'crypt', 'alchemy', 'drowned', 'storage', 'ossuary', 'torture', 'shrine', 'boneyard', 'alchemy'],
    castle: ['hall', 'throne', 'armory', 'hall', 'garden', 'lavahall', 'storage', 'throne'],
    gaslight: ['townhouse', 'gstreet', 'cemetery', 'market', 'townhouse', 'occult', 'boneyard', 'ruin', 'graveyard', 'gstreet'],
    deadwood: ['grove', 'cabin', 'boneyard', 'graveyard', 'ritual', 'grove', 'well', 'gallows', 'cabin', 'boneyard', 'graveyard', 'camp'],
    frozen: ['grove', 'frozentown', 'crystals', 'ruin', 'wintercamp', 'statues', 'frozentown', 'grove', 'castle'],
    zombie: ['street', 'wreck', 'quarantine', 'yard', 'ruin', 'graveyard', 'camp'],
    wasteland: ['wreck', 'toxic', 'yard', 'ruin', 'camp'],
    volcano: ['forge', 'lava', 'shrine', 'ruin', 'camp'],
    dungeon: ['crypt', 'drowned', 'storage', 'torture', 'boneyard', 'shrine', 'ward', 'drowned'],
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
  const LIGHT_KIND = { a: 'lantern', r: 'brazier', g: 'lamp', f: 'brazier', c: 'lantern', m: 'torch', v: 'brazier', z: 'lamp', w: 'lamp', h: 'brazier' };
  const FIRE = { catacombs: 'purple', castle: 'orange', gaslight: 'purple', deadwood: 'green', backyard: 'amber', office: 'orange', glitch: 'cyan', zombie: 'green', wasteland: 'orange', volcano: 'orange', dungeon: 'purple', frozen: 'cyan' };
  const hash = (a, b) => { let n = (a * 374761393 + b * 668265263) | 0; n = (n ^ (n >> 13)) * 1274126177; return ((n ^ (n >> 16)) >>> 0) / 4294967296; };
  const MIRROR = { corpse: 1, bones: 1, skeleton: 1, debris: 1, patch: 1, ashes: 1, pool: 1 }; // decals with writing (blood "HELP", signs) are never mirrored
  const FLAT = { roof: 1, bridge: 1, shore: 1, chasm: 1, vein: 1, room: 1, lava: 1, patch: 1, ashes: 1, decal: 1, scrawl: 1, plate: 1, corpse: 1, bones: 1, skeleton: 1, debris: 1, pool: 1, rug: 1, pallet: 1, pipe: 1 };

  /* ------------------------------------------------------------------ a dressing session for one level */
  function Dresser(L, biome) {
    const seed = Math.round(L.entrance.x * 13 + L.entrance.y * 7) + L.tw * 5 + L.th;
    let n = 0;
    const D = {
      L, biome, fam: FAM[biome] || 'h', alt: ALT[biome] || 'm', fams: FAMS[biome] || FAM[biome] || 'h',
      r: () => hash(seed, n++),
      reserved: [],
      placed: [],
      decks: {},
    };
    D.pick = (list) => list[Math.floor(D.r() * list.length) % list.length];
    /* which of its biome's five stages this is (0-4): each stage deals its own fifth of every pool first, so the five
       stages of a biome show every piece of its packs between them (PLAN.md 21, request 3) */
    const WMp = CH.WorldMap, ar = WMp && WMp.on && WMp.on() && CH.G.wave ? WMp.area(CH.G.wave) : null;
    D.step = ar && ar.step ? ar.step - 1 : ((CH.G.wave || 1) - 1) % 5;
    const wseed = (CH.Areas && CH.Areas.world && CH.Areas.world() ? CH.Areas.world().seed : 0) | 0;
    const bseed = [...biome].reduce((a, c) => a * 31 + c.charCodeAt(0), wseed) | 0;
    /* a pool in the biome's own order (the same in all its stages), and where this stage starts in it */
    D.deckOf = (tag, pool) => {
      let dk = D.decks[tag];
      if (!dk || dk.len !== pool.length) {
        const order = pool.map((k, i) => [hash(bseed + i * 7, i * 131 + 17), k]).sort((a, b) => a[0] - b[0]).map((q) => q[1]);
        dk = D.decks[tag] = { len: pool.length, order, start: SP.SINGLE[biome] ? 0 : D.step * Math.ceil(pool.length / 5), i: 0 };
      }
      return dk;
    };
    D.deal = (tag, pool) => { const dk = D.deckOf(tag, pool); return dk.order[(dk.start + dk.i++) % dk.len]; };
    /* a catalogue key (or obj.* sprite) of a kind for this biome */
    D.key = (kind, famOverride) => {
      const f = famOverride || D.fam;
      if (f === 'm' && OBJ[kind] && D.r() < 0.6) {
        const ok = OBJ[kind].filter((k) => S.has(k));
        if (ok.length) return D.pick(ok);
      }
      let pool = PR.pool(kind, famOverride ? f : D.fams);
      if (!famOverride && D.fams.includes('o') && OBJ[kind]) pool = pool.concat(OBJ[kind].filter((k) => S.has(k)));
      if (pool.length && !famOverride) return D.deal(kind, pool);
      if (!pool.length) pool = PR.pool(kind, D.alt);
      if (!pool.length && SP.STRICT[biome]) return null; // the sky and the belly borrow nothing from the world below
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
      const pool = PR.pool(kind, ALLF).filter((k) => k.split('.')[1] === sheet);
      return () => D.pick(pool);
    };
    D.reserve = (x, y, r) => D.reserved.push({ x, y, r });
    /* a building's footprint (box at the feet x, y) keeps clear of every spot the stage needs */
    D.clearOf = (x, y, box) => ![L.entrance, L.exit].concat(L.packs, L.chests, L.shrines, L.spawners, L.waypoints).some((q) => q && Math.abs(q.x - x) < box.hw + 24 && q.y < y + 24 && q.y > y - box.hh * 2 - 24);
    /* is a footprint free: floor under it, clear of reserved spots and other solid props */
    D.free = (x, y, hw, hh, solid, join) => {
      const m = 4;
      for (let ty = Math.floor((y - hh * 2 - m) / TS); ty <= Math.floor((y + m) / TS); ty++) for (let tx = Math.floor((x - hw - m) / TS); tx <= Math.floor((x + hw + m) / TS); tx++) if (L.solid(tx, ty)) return false;
      for (const q of D.reserved) if (U.dist(x, y, q.x, q.y) < q.r + Math.max(hw, hh)) return false;
      if (!solid) return true;
      for (const p of L.props) {
        if (p.dead || !p.solid) continue;
        if (join && p.join === join) continue; // the pieces of one wall touch on purpose
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
        const soft = kind === 'shrub' || kind === 'flower'; // grass and flowers are walked through, a real bush is not (PLAN.md 20)
        const box = soft ? (sp.h >= 17 ? { hw: Math.max(4, Math.round(sp.w * 0.25)), hh: 3 } : null) : { hw: Math.round(sp.w * (tree ? 0.14 : 0.38)), hh: tree ? 4 : Math.max(4, Math.round(sp.h * 0.14)) };
        if (!o.force && !D.free(x, y, box ? box.hw : 6, box ? box.hh : 3, !!box)) return null;
        CH.Arenas.addProp(L.props, key, x, y, box ? { solid: true, box, cy: -box.hh + 1, jumpable: !tree && sp.h < 40, elevation: 10, destructible: !tree, hp: 45, resourceType: 'stone' } : { solid: false });
        const p = L.props[L.props.length - 1];
        p.sp = true;
        D.placed.push(p);
        return p;
      }
      const info = PR.info(key);
      if (!info || info.skip) return null;
      let name = PR.sprite(key, o.scale);
      if (!name) return null;
      // flat pieces are painted into the floor (a piece's own setting from the stage editor wins: data/asset_meta.js)
      const am = PR.meta(key) || {};
      if (am.layer ? am.layer === 'floor' : FLAT[info.kind]) {
        let fr = S.get(name).frames[0], sc = o.scale || 1;
        { // no giant splats (a big one is shrunk to a stain's size, forced or not), no square swatches pasted on the floor (PLAN.md 20, 21)
          const ds = PR.decalScale(key, info.kind, fr);
          if (!ds) return null; // (the sweep lays a filled square into the floor as an inlay instead)
          if (ds && ds < 1) { sc *= ds; name = PR.sprite(key, sc); if (!name) return null; fr = S.get(name).frames[0]; }
        }
        if (!o.force) for (const q of D.reserved) if (q.hard && U.dist(x, y, q.x, q.y) < q.r) return null;
        L.decals.push({ key, img: fr, s: sc, x, y: y - Math.round(fr.height / 2), a: o.a || 0.95, fx: o.flip || (D.r() < 0.5 && MIRROR[info.kind] === 1), fy: false }); // (s: its scale, so a saved stage can paint it again, js/stages.js)
        return L.decals[L.decals.length - 1];
      }
      const box = PR.boxOf(key, name, info.kind);
      const solid = !!box;
      if (!o.force && !D.free(x, y, box ? box.hw : 5, box ? box.hh : 3, solid, o.join)) return null;
      const sp = S.get(name);
      CH.Arenas.addProp(L.props, name, x, y, {
        kind: info.tree ? 'tree' : undefined, solid, box, cx: am.box && am.box.cx ? am.box.cx : 0, cy: box ? (am.box && am.box.cy != null ? am.box.cy : -box.hh + 1) : -3, cat: info.kind,
        jumpable: (!!info.j || (!!PR.TALL[info.kind] && sp.h <= 30)) && sp.h <= 46, elevation: Math.min(14, Math.round(sp.h * 0.35)),
        destructible: !!info.d, hp: info.hp || 40, resourceType: info.res || 'stone', resourceAmt: 2,
        swayable: !!info.sway,
      });
      const p = L.props[L.props.length - 1];
      p.sheet = key;
      p.sp = true;
      if (info.tree) { p.kind = 'tree'; p.choppable = true; p.swayable = true; }
      if (info.l && key.startsWith('anim.')) { p.glow = info.kind === 'heart' ? '#ff3a52' : '#9fe8ff'; p.lr = 60 + Math.min(40, sp.h); p.phase = D.r(); } // an animated light: the heart, the floaters
      else if (info.l && CH.Sheets) { // lights glow with their own colour and cast shadows (js/fires.js, js/postfx.js)
        CH.Sheets.sprite(key);
        const inf = CH.Sheets.info[key];
        if (inf) { p.glow = inf.glow; p.lr = 60 + Math.min(40, sp.h); p.phase = D.r(); }
      }
      if (info.fx) p.additive = true;
      if (info.rise) p.rise = true;
      const an = PR.animOf && PR.animOf(key);
      if (an) { p.fps = am.fps || an.fps; p.phase = D.r(); }
      if (am.glow) { p.glow = am.glow; p.lr = am.lr || 70; p.phase = D.r(); } // an animated piece: a weed sways, a heart beats (js/render.js)
      if (o.flip) p.flip = true;
      if (o.join) p.join = o.join;
      if (o.scale && o.scale !== 1) p.scale = o.scale;
      D.placed.push(p);
      return p;
    };
    /* a piece of a kind and a shape from one sheet: 'run' (a long fence or wall segment), 'post' (a single upright) */
    const shapeOf = (key) => { const nm = key.startsWith('obj.') ? key : PR.sprite(key); if (!nm || !S.has(nm)) return 0; const sp = S.get(nm); return sp.w / Math.max(1, sp.h); };
    D.shaped = (kind, shape, sheetOf) => {
      const first = sheetOf || D.key(kind);
      if (!first) return () => null;
      const sheet = first.split('.')[1];
      const pool = first.startsWith('obj.') ? [first] : PR.pool(kind, ALLF).filter((k) => k.split('.')[1] === sheet);
      const fit = pool.filter((k) => (shape === 'run' ? shapeOf(k) >= 1.45 : shape === 'post' ? shapeOf(k) <= 0.75 : true));
      const list = fit.length ? fit : pool;
      return () => D.pick(list);
    };
    /* a straight wall of touching pieces from x0 to x1 at feet y (one group: they may touch), skipping a gate gap */
    D.wall = (pick, x0, x1, y, gate) => {
      const join = 'w' + (D.joins = (D.joins || 0) + 1);
      let x = x0, n = 0;
      for (let guard = 0; x < x1 && guard < 40; guard++) {
        const key = pick();
        if (!key) break;
        const nm = key.startsWith('obj.') ? key : PR.sprite(key);
        const w = nm && S.has(nm) ? S.get(nm).w : 30;
        const mx = x + w / 2;
        if (gate && Math.abs(mx - gate.x) < gate.w / 2 + w / 2 - 4) { x = gate.x + gate.w / 2; continue; }
        if (D.put(key, mx, y, { join })) n++;
        x += w - 3;
      }
      return n;
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
      // a heap belongs in a corner or against a wall (PLAN.md 22): the nearest free one in the room
      const CO = CH.Compose, rm = CO && CO.roomAt(L, x, y);
      if (rm) { const q = CO.free(L, rm, ['corner', 'west', 'east', 'north'], x, y, 260)[0]; if (q) { x = q.x; y = q.y; } }
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
    /* a few things of a kind about (x, y) (PLAN.md 22): in the free wall and corner slots of the room nearest the point,
       or, where there are none in reach, evenly round it as a ring; never at random points of the open floor */
    D.scatter = (kind, x, y, R, nn) => {
      const CO = CH.Compose, rm = CO && CO.roomAt(L, x, y);
      let got = 0;
      if (rm) {
        const flat = !!FLAT[kind];
        const sides = flat ? ['corner', 'north', 'west', 'east', 'south'] : CO.sideOf(kind) === 'wall' ? ['north', 'west', 'east'] : ['corner', 'north', 'west', 'east'];
        // a kind keeps together in its own part of the room (CH.Compose anchors), spaced so it reads as a group
        const anchors = (rm._anchors = rm._anchors || {});
        const at = anchors[kind] || (anchors[kind] = (CO.free(L, rm, sides, x, y, R * 1.4)[0] || { x, y }));
        const placed = [];
        for (const q of CO.free(L, rm, sides, at.x, at.y, R * 1.4).slice(0, nn * 4)) {
          if (got >= nn) break;
          if (!flat && placed.some((o) => Math.hypot(o.x - q.x, o.y - q.y) < 22)) continue;
          placed.push(q);
          const p = D.put(D.key(kind), q.x + (flat ? (q.side === 'west' ? 8 : q.side === 'east' ? -8 : 0) : 0), q.y + (flat ? 6 : 0));
          if (p) { got++; if (!flat) CO.take(L, rm, q.x, q.y, p.box ? p.box.hw : 10); else q.used = true; }
        }
      }
      for (let i = 0; got < nn && i < nn * 2; i++) {
        const a = ((i + 0.5) / nn) * 6.283 + D.r() * 0.4, d = R * 0.8;
        if (D.put(D.key(kind), x + Math.cos(a) * d, y + Math.sin(a) * d * 0.7)) got++;
      }
    };
    return D;
  }

  /* usable area of a room: centre and radii (px), keeping the band by its walls free for the corridors */
  function area(L, rm) {
    if (rm.r) return { x: rm.cx, y: rm.cy, rx: Math.max(40, (rm.r - 1.6) * TS), ry: Math.max(36, (rm.r - 1.8) * TS), rm };
    return { x: rm.cx, y: rm.cy, rx: Math.max(40, (rm.w / 2 - 1.6) * TS), ry: Math.max(36, (rm.h / 2 - 1.8) * TS), rm };
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
  /* an enemy camp round a breach or a sleeping pack (PLAN.md 20, request 1): built as one place, facing south like the
     art. A patch of trodden earth; a stockade of one sheet's pieces (a straight back wall of long segments, side walls
     of posts, a front with a gate between two torches); the breach in the middle with the war banner behind it; tents
     in the back corners; a fire in front of the breach with seats round it; supplies in one front corner, a cage or a
     rack in the other; bones and the camp's victims outside the gate. Each biome has its own materials. */
  const CAMP = {
    c: { wall: ['fence'], post: ['fence', 'spike'], tent: ['hut'], seat: ['log', 'stump', 'bench'], totem: ['banner', 'spike', 'pole'], side: ['cage', 'signpost'], dead: 'corpse' },
    f: { wall: ['fence'], post: ['fence', 'spike'], tent: ['hut'], seat: ['log', 'bench', 'stump'], totem: ['banner', 'pole'], side: ['stall', 'table'], dead: 'bones' },
    g: { wall: ['fence'], post: ['fence', 'pole'], tent: ['stall'], seat: ['bench', 'crate'], totem: ['banner', 'lamp'], side: ['cage', 'table'], dead: 'corpse' },
    z: { wall: ['barricade', 'sandbag'], post: ['barricade', 'cone'], tent: ['carv', 'car'], seat: ['tires', 'crate'], totem: ['sign', 'pole'], side: ['dumpster', 'machine'], dead: 'corpse' },
    w: { wall: ['fence', 'barricade'], post: ['spikes', 'barricade'], tent: ['carv'], seat: ['tires', 'crate'], totem: ['sign', 'pole'], side: ['machine', 'reactor'], dead: 'corpse' },
    v: { wall: ['spikes', 'fence'], post: ['spike'], tent: ['anvil'], seat: ['rock', 'log'], totem: ['banner', 'obelisk'], side: ['cage', 'cauldron'], dead: 'skeleton' },
    a: { wall: ['barricade', 'fence'], post: ['spikes', 'pillar'], tent: ['table', 'shelf'], seat: ['crate', 'barrel'], totem: ['banner', 'statue'], side: ['cage', 'coffin'], dead: 'skeleton' },
    r: { wall: ['fence', 'barricade'], post: ['pillar', 'spikes'], tent: ['table', 'stall'], seat: ['bench', 'crate'], totem: ['banner', 'statue'], side: ['cage', 'anvil'], dead: 'skeleton' },
    h: { wall: ['spikes', 'fence'], post: ['spikes'], tent: ['bed', 'table'], seat: ['chair', 'crate'], totem: ['banner', 'statue'], side: ['cage', 'machine'], dead: 'scrawl' },
    m: { wall: ['fence', 'spikes'], post: ['spikes', 'fence'], tent: ['hut', 'stall'], seat: ['log', 'stump'], totem: ['banner', 'pole'], side: ['cage', 'anvil'], dead: 'skeleton' },
  };
  const firstKey = (D, kinds) => { for (const k of kinds) { const key = D.key(k); if (key) return key; } return null; };
  SCENE.camp = (D, A, at, o) => {
    const C = CAMP[D.fam] || CAMP.m;
    const cx = Math.round(at.x), cy = Math.round(at.y);
    const hw = Math.round(Math.min(A.rx * 0.9, 118)), back = Math.round(Math.min(A.ry * 0.78, 74)), front = Math.round(Math.min(A.ry * 0.82, 70));
    const yb = cy - back, yf = cy + front, gate = { x: cx, w: 58 };
    // the trodden ground of the camp, painted into the floor
    (D.L.grounds = D.L.grounds || []).push({ x: cx, y: cy + 6, rx: hw + 26, ry: Math.round((back + front) / 2) + 22, seed: cx * 7 + cy });
    // the stockade: back, sides of posts, the front either side of the gate
    const wallKey = firstKey(D, C.wall);
    const run = D.shaped(wallKey ? PR.kindOf(wallKey) : C.wall[0], 'run', wallKey);
    const post = D.shaped(firstKey(D, C.post) ? PR.kindOf(firstKey(D, C.post)) : C.post[0], 'post', wallKey && D.r() < 0.6 ? wallKey : null);
    D.wall(run, cx - hw, cx + hw, yb);
    const pj = 'p' + (D.joins = (D.joins || 0) + 1);
    for (const s of [-1, 1]) for (let y = yb + 14; y < yf - 6; y += 13) D.put(post(), cx + s * hw, y, { join: pj });
    D.wall(run, cx - hw, cx + hw, yf, gate);
    for (const s of [-1, 1]) D.put(D.key('torch') || D.key('lamp') || D.key('brazier'), cx + s * (gate.w / 2 + 6), yf + 4);
    // the war banner behind the breach, the tents in the back corners
    D.near(firstKey(D, C.totem), cx, yb + 20, 10);
    const tent = firstKey(D, C.tent);
    if (tent) for (const s of [-1, 1]) D.near(tent, cx + s * (hw - 34), yb + 30, 10);
    // the fire in front of the breach, seats round it
    const fy = cy + Math.min(46, front - 22);
    if (!o || !o.noFire) D.fire(cx, fy);
    D.put(D.key('ashes'), cx + 18, fy + 10);
    const seat = firstKey(D, C.seat);
    if (seat) for (const [dx, dy] of [[-30, 2], [30, 2], [0, 22]]) D.put(seat, cx + dx, fy + dy);
    // supplies in one front corner, the camp's cage or rack in the other
    const sL = D.r() < 0.5 ? -1 : 1;
    D.pile(cx + sL * (hw - 30), yf - 24, ['crate', 'barrel', 'sack', 'crate'], 4);
    D.near(firstKey(D, C.side) || D.key('cage') || D.key('anvil'), cx - sL * (hw - 30), yf - 26, 12);
    for (let i = 0; i < 2; i++) D.put(D.key('pack'), cx - sL * (hw - 50 - i * 14), yf - 12);
    // what is left of their victims, outside the gate and along the walls
    D.scatter('bones', cx, yf + 26, 40, 3);
    D.scatter(C.dead, cx, yf + 30, 50, 2);
    D.scatter('debris', cx, cy, hw * 0.8, 3);
    return { x: cx, y: cy, r: Math.min(hw, (back + front) / 2 + 10) };
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
    const trees = D.fam === 'f' ? ['tree', 'tree', 'deadtree'] : D.biome === 'frozen' ? ['deadtree', 'darktree', 'tree'] : D.fam === 'c' ? ['deadtree', 'deadtree', 'deadtree', 'stump'] : ['tree', 'tree', 'deadtree'];
    for (let i = 0; i < nt; i++) { const a = D.r() * 6.283, d = A.rx * (0.3 + D.r() * 0.6); D.put(D.key(D.pick(trees)), A.x + Math.cos(a) * d, A.y + Math.sin(a) * d * 0.7); }
    if (D.fam === 'c') { // the Dead Wood: roots, a vine arch, a flowering bush
      D.near(D.key('growth'), A.x + A.rx * 0.3, A.y - A.ry * 0.2, 30);
      D.near(D.key('arch'), A.x - A.rx * 0.4, A.y + A.ry * 0.2, 30);
      D.scatter('debris', A.x, A.y, A.rx * 0.7, 3);
    }
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
  /* the room's back wall lined with its row: the slots along the real wall line, left to right, in runs of two to four of
     one kind and one kit (shelves, then coffins, then a pot ...), a gap now and then (PLAN.md 22) */
  function alongWalls(D, A, kinds, step) {
    const CO = CH.Compose, rm = A.rm || (CO && CO.roomAt(D.L, A.x, A.y));
    if (!CO || !rm) { const y = A.y - A.ry * 0.85; for (let x = A.x - A.rx * 0.85; x < A.x + A.rx * 0.85; x += step + D.r() * 12) D.put(D.key(D.pick(kinds)), x, y); return; }
    const slots = CO.free(D.L, rm, ['north'], rm.cx, rm.cy, 0).sort((a, b) => a.ty - b.ty || a.x - b.x);
    if (!slots.length) return;
    const row = slots.filter((q) => q.ty === slots[0].ty).sort((a, b) => a.x - b.x); // the back wall's own line
    let lastX = -1e9, run = 0, kit = null;
    for (const q of row) {
      if (q.used || q.x - lastX < step) continue;
      if (run <= 0) { kit = D.kit(D.pick(kinds)); run = 2 + Math.floor(D.r() * 3); if (D.r() < 0.2) { lastX = q.x; continue; } } // a gap between runs
      const p = D.put(kit(), q.x, q.y);
      if (p) { CO.take(D.L, rm, q.x, q.y, p.box ? p.box.hw : 10); lastX = q.x + (p.box ? p.box.hw : 8); run--; }
    }
  }
  SCENE.crypt = (D, A) => CH.Compose && CH.Compose.recipe(D, A, { feature: 'altar', flank: 'statue', ring: 'candles', back: ['coffin', 'statue', 'grave'], sides: ['pillar', 'statue'], corners: ['bones', 'skeleton', 'debris'], doors: 'brazier', stains: ['scrawl', 'decal', 'bones'], n: 3 })
  SCENE.ward = (D, A) => CH.Compose && CH.Compose.recipe(D, A, { feature: 'table', flank: 'lamp', back: ['bed', 'bed', 'shelf'], sides: ['bed', 'chair', 'table'], corners: ['item', 'debris', 'pot'], doors: 'lantern', stains: ['scrawl', 'decal'], n: 3 })
  SCENE.storage = (D, A) => CH.Compose && CH.Compose.recipe(D, A, { back: ['shelf', 'crate', 'barrel'], sides: ['barrel', 'crate', 'sack', 'case'], corners: ['crate', 'sack', 'barrel', 'pot'], doors: 'lantern', stains: ['debris'], n: 3 })
  SCENE.torture = (D, A) => CH.Compose && CH.Compose.recipe(D, A, { feature: 'trap', flank: 'brazier', back: ['cage', 'hang', 'machine'], sides: ['cage', 'table'], corners: ['bones', 'skeleton', 'debris'], doors: 'torch', stains: ['decal', 'bones'], n: 4 })
  SCENE.forge = (D, A) => CH.Compose && CH.Compose.recipe(D, A, { feature: 'anvil', flank: 'brazier', back: ['cauldron', 'machine', 'block'], sides: ['barrel', 'crate'], corners: ['debris', 'rock', 'crate'], doors: 'torch', stains: ['ashes', 'debris'], n: 3 })
  SCENE.lava = (D, A) => CH.Compose && CH.Compose.recipe(D, A, { feature: 'geyser', flank: 'lavarock', back: ['lavarock', 'spike'], sides: ['lavarock', 'firetrap'], corners: ['rock', 'lavarock', 'debris'], stains: ['decal', 'ashes'], n: 4 })

  /* ------------------------------------------------------------------ the Dead Wood (PLAN.md 18, K2) */
  /* a forest cabin: Creepy Forest log panels with a door under a shingle roof, built into one picture (the panels and roofs
     face south only, so a cabin is its front and its roof), with a fence, a woodpile, a lantern and a barrel about it */
  const built = {};
  function cabinSprite(D) {
    const IM = CH.Assets.images;
    const has = (k) => !!IM[k];
    const walls = [0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17].map((i) => 'kit.cf5.' + i).filter(has);
    const doors = [34, 35, 36, 37, 39].map((i) => 'kit.cf5.' + i).filter(has);
    const roofs = [0, 1, 2, 3, 4, 7, 8, 9].map((i) => 'kit.cf6.' + i).filter(has);
    const eaves = [13, 14, 16, 18].map((i) => 'kit.cf6.' + i).filter(has);
    if (walls.length < 3 || !doors.length || !roofs.length) return null;
    const n = D.r() < 0.5 ? 3 : 4;
    const doorAt = 1 + Math.floor(D.r() * (n - 2));
    const pick = [];
    for (let i = 0; i < n; i++) pick.push(i === doorAt ? D.pick(doors) : D.pick(walls));
    const roof = D.pick(roofs), eave = eaves.length ? D.pick(eaves) : null;
    const id = pick.join() + roof + eave;
    if (built[id]) return built[id];
    const cw = 46, wallH = 46, roofH = 50;
    const c = document.createElement('canvas');
    c.width = cw * n + 8;
    c.height = wallH + roofH;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    // the roof: shingle panels tiled over its rectangle, darker toward the ridge
    const ri = IM[roof];
    g.save();
    g.beginPath();
    g.rect(0, 0, c.width, roofH + 6);
    g.clip();
    for (let y = roofH + 6 - ri.height; y > -ri.height; y -= ri.height - 6) for (let x = -((y / 7) | 0) % 12; x < c.width; x += ri.width - 4) g.drawImage(ri, x, y);
    g.globalCompositeOperation = 'source-atop';
    const gr = g.createLinearGradient(0, 0, 0, roofH);
    gr.addColorStop(0, 'rgba(0,0,0,0.35)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, c.width, roofH + 6);
    g.restore();
    // the front: the panels and the door, standing on the ground line
    for (let i = 0; i < n; i++) {
      const im = IM[pick[i]];
      const x = 4 + i * cw + Math.round((cw - im.width) / 2);
      g.drawImage(im, x, c.height - im.height);
    }
    // the eave beam where the roof meets the front
    if (eave) { const ei = IM[eave]; for (let x = 0; x < c.width; x += ei.width - 6) g.drawImage(ei, x, roofH - ei.height / 2 + 2); }
    const name = 'cabin' + Object.keys(built).length;
    S.fromFrames(name, [c], { anchor: 'feet' });
    built[id] = { name, w: c.width, h: c.height, keys: pick.concat([roof], eave ? [eave] : []), door: 4 + doorAt * cw + cw / 2 - c.width / 2 };
    return built[id];
  }
  SCENE.cabin = (D, A) => {
    const cab = cabinSprite(D);
    const box = cab && { hw: Math.round(cab.w * 0.47), hh: Math.round(cab.h * 0.42) };
    let x = 0, y = 0, room = false;
    // the first free spot of a few in the room (the route and the gameplay spots are reserved)
    if (cab) for (const [ox, oy] of [[0, -0.1], [-0.35, -0.3], [0.35, -0.3], [-0.35, 0.25], [0.35, 0.25], [0, 0.35], [0, -0.45]]) {
      x = Math.round(A.x + ox * A.rx);
      y = Math.round(A.y + oy * A.ry + box.hh);
      if (D.free(x, y, box.hw, box.hh, true) && D.clearOf(x, y, box)) { room = true; break; }
    }
    if (!room) return SCENE.grove(D, A);
    CH.Arenas.addProp(D.L.props, cab.name, x, y, { solid: true, box, cy: -box.hh + 1, cat: 'hut', jumpable: false, elevation: 30, destructible: false });
    const p = D.L.props[D.L.props.length - 1];
    p.sp = true;
    p.kits = cab.keys; // the pieces it is built of (t46_deadwood counts every sheet)
    p.enter = 'cabin'; // a way in (js/interiors.js)
    p.door = { x: x + cab.door, y: y + 2 };
    D.L.cabins = (D.L.cabins || 0) + 1;
    D.placed.push(p);
    // the yard: a fence to one side, the woodpile and a barrel at the other, a lantern by the door, a well in front
    const side = D.r() < 0.5 ? -1 : 1;
    const rotten = PR.pool('fence', 'c').filter((k) => k.startsWith('kit.cf4.')); // the Rotten Fence sheet
    for (let i = 0; i < 3; i++) D.put(rotten.length ? D.pick(rotten) : D.key('fence'), x + side * (cab.w / 2 + 18 + i * 34), y + 10);
    D.pile(x - side * (cab.w / 2 + 26), y - 6, ['log', 'log', 'barrel', 'stump'], 3);
    D.put(D.key('lantern'), x + cab.door + 26, y + 14);
    D.near(D.key('well'), x - side * 30, y + 70, 30);
    D.scatter('flower', x, y + 40, 50, 3);
    D.scatter('debris', x, y + 30, 70, 2);
  };
  /* a ritual site: a circle painted in blood, candles round it, an altar, hooded statues, banners and sigils */
  SCENE.ritual = (D, A) => {
    const circles = PR.pool('decal', 'c').filter((k) => /^kit.cf12.[0-8]$/.test(k));
    if (circles.length) D.put(D.pick(circles), A.x, A.y + 18, { scale: 1.6, a: 0.9 });
    for (let i = 0; i < 7; i++) { const a = (i / 7) * 6.283; D.put(D.key('candles'), A.x + Math.cos(a) * 46, A.y + 12 + Math.sin(a) * 30); }
    D.put(D.key('altar'), A.x, A.y - 34);
    for (const s of [-1, 1]) { D.put(D.key('smallstatue'), A.x + s * 64, A.y - 20); D.put(D.key('banner') || D.key('signpost'), A.x + s * 86, A.y - 44); }
    D.put(D.key('hang'), A.x + (D.r() < 0.5 ? -1 : 1) * 96, A.y + 22);
    if (D.r() < 0.4) D.near(D.key('portal'), A.x, A.y - 74, 20);
    D.scatter('decal', A.x, A.y, A.rx * 0.7, 3);
    D.scatter('item', A.x, A.y + 10, 40, 2);
    D.scatter('bones', A.x, A.y, A.rx * 0.6, 2);
  };
  /* a clearing round an old well: troughs, a pump, benches, a cart, a lamp, flowers */
  SCENE.well = (D, A) => {
    D.put(D.key('well'), A.x, A.y);
    D.near(D.key('pipestand'), A.x + 50, A.y - 10, 16);
    D.near(D.key('well'), A.x - 56, A.y + 14, 16); // a trough or a basin
    for (const s of [-1, 1]) D.near(D.key('bench'), A.x + s * 64, A.y + 46, 16);
    D.near(D.key('carv'), A.x + A.rx * 0.55, A.y - A.ry * 0.35, 30);
    D.put(D.key('lamp') || D.key('lantern'), A.x - 40, A.y - 40);
    D.pile(A.x - A.rx * 0.5, A.y - A.ry * 0.3, ['barrel', 'crate', 'barrel'], 2);
    D.scatter('flower', A.x, A.y, A.rx * 0.6, 4);
    D.scatter('plate', A.x, A.y, A.rx * 0.6, 1);
  };
  /* the hanging tree's cousin: gallows, cages, stocks, chain posts, skull pikes and a warning */
  SCENE.gallows = (D, A) => {
    D.put(D.key('pole'), A.x, A.y - 20);
    for (const s of [-1, 1]) D.near(D.key('cage'), A.x + s * 62, A.y - 6, 20);
    D.near(D.key('table'), A.x - 40, A.y + 50, 20); // the stocks
    D.near(D.key('spike'), A.x + 70, A.y + 40, 20);
    D.near(D.key('sign'), A.x - A.rx * 0.6, A.y - A.ry * 0.4, 24);
    D.near(D.key('trap'), A.x + 20, A.y + 70, 24);
    D.scatter('bones', A.x, A.y, A.rx * 0.6, 4);
    D.scatter('skeleton', A.x, A.y, A.rx * 0.6, 1);
    D.scatter('hang', A.x, A.y, A.rx * 0.7, 1);
  };
  /* an act boss's hall (PLAN.md 19, W3): columns along the long walls, braziers at the corners and by the far door,
     the biome's things against the walls; the middle stays open for the fight */
  SCENE.bosshall = (D, A) => {
    for (const s of [-1, 1]) for (let x = A.x - A.rx * 0.8; x <= A.x + A.rx * 0.8; x += 96) D.put(D.key('pillar') || D.key('statue'), x, A.y + s * A.ry * 0.82);
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) D.put(D.key('brazier') || D.key('torch'), A.x + sx * A.rx * 0.92, A.y + sy * A.ry * 0.7);
    for (const s of [-1, 1]) D.put(D.key('statue') || D.key('pillar'), A.x + s * 70, A.y - A.ry * 0.86);
    D.scatter('decal', A.x, A.y, A.rx * 0.7, 4);
    D.scatter('bones', A.x, A.y, A.rx * 0.8, 3);
  };

  /* ------------------------------------------------------------------ the Catacombs and the Crimson Castle (PLAN.md 19, W2) */
  /* an ossuary: skeletons and bone piles along the back wall, skull heaps, a cage, candles, old blood */
  SCENE.ossuary = (D, A) => CH.Compose && CH.Compose.recipe(D, A, { feature: 'statue', flank: 'candles', ring: 'bones', back: ['coffin', 'skeleton', 'bonepile'], sides: ['bonepile', 'pot', 'skeleton'], corners: ['bones', 'skeleton', 'pot'], doors: 'candles', stains: ['decal', 'bones'], n: 4 })
  /* an alchemist's den: tables of jars and books, shelves along the wall, pots, crystals, a circle on the floor */
  SCENE.alchemy = (D, A) => CH.Compose && CH.Compose.recipe(D, A, { feature: 'table', flank: 'candles', ring: 'item', back: ['shelf', 'shelf', 'table'], sides: ['pot', 'case', 'shelf'], corners: ['pot', 'sack', 'crystal'], doors: 'lantern', stains: ['decal', 'scrawl'], n: 3 })
  /* a castle hall: one of the pack's whole halls painted into the floor, rows of pillars, braziers at the corners */
  const fits = (D, kind, A, fam) => PR.pool(kind, fam || 'r').filter((k) => { const im = CH.Assets.images[k]; return im && im.width < A.rx * 1.7 && im.height < A.ry * 1.7; });
  SCENE.hall = (D, A) => {
    const rooms = fits(D, 'room', A);
    if (rooms.length) D.put(D.pick(rooms), A.x, A.y + Math.round(CH.Assets.images[rooms[0]].height / 2) - 10, { a: 1 });
    const rugs = fits(D, 'rug', A);
    if (rugs.length && D.r() < 0.6) D.put(D.pick(rugs), A.x, A.y + 30, { a: 1 });
    for (const s of [-1, 1]) for (let y = A.y - A.ry * 0.5; y <= A.y + A.ry * 0.5; y += 56) D.put(D.key('pillar'), A.x + s * A.rx * 0.62, y);
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) D.put(D.key('brazier'), A.x + sx * A.rx * 0.8, A.y + sy * A.ry * 0.7);
  };
  /* a throne room: a hall, a Gothic throne at the back between banners and candelabras, a red runner to it */
  SCENE.throne = (D, A) => {
    const rugs = fits(D, 'rug', A);
    if (rugs.length) D.put(D.pick(rugs), A.x, A.y + 20, { a: 1 });
    D.put(D.key('throne', 'g') || D.key('statue'), A.x, A.y - A.ry * 0.55);
    for (const s of [-1, 1]) { D.put(D.key('hang', 'a') || D.key('banner'), A.x + s * 50, A.y - A.ry * 0.7); D.put(D.key('brazier'), A.x + s * 70, A.y - A.ry * 0.4); D.put(D.key('pillar'), A.x + s * A.rx * 0.6, A.y); }
    D.scatter('plate', A.x, A.y, A.rx * 0.6, 2);
  };
  /* an armoury and store: stone blocks along the walls, crates, barrels, statues, torches */
  SCENE.armory = (D, A) => CH.Compose && CH.Compose.recipe(D, A, { feature: 'statue', flank: 'torch', back: ['block', 'statue'], sides: ['crate', 'block'], corners: ['crate', 'pot', 'sack'], doors: 'brazier', stains: ['plate'], n: 2 })
  /* the castle garden: hedges and potted plants, floor inlays, a fountain, statues */
  SCENE.garden = (D, A) => CH.Compose && CH.Compose.recipe(D, A, { feature: 'block', flank: 'statue', back: ['shrub'], sides: ['shrub', 'statue'], corners: ['shrub', 'pot'], doors: 'brazier', stains: ['plate'], n: 3 })
  /* a hall of lava channels: lava inlays, braziers, plates, a pillar or two */
  SCENE.lavahall = (D, A) => { const lava = fits(D, 'lava', A); if (lava.length) D.put(D.pick(lava), A.x, A.y + 10, { a: 1 }); return CH.Compose && CH.Compose.recipe(D, A, { back: ['brazier', 'pillar'], sides: ['pillar'], corners: ['lavarock', 'rock'], doors: 'brazier', stains: ['plate'], n: 2 }); }
  /* gates at the ends, and a last check that every piece of the packs gets a chance (one of each sheet's kinds) */
  /* a drowned room (Catacombs, Crypt; PLAN.md 21): a sea beast's bones half sunk in the floor, coral, weed and
     anemones grown over the stones, shells and sand washed into the corners */
  SCENE.drowned = (D, A) => CH.Compose && CH.Compose.recipe(D, A, { feature: D.r() < 0.5 ? 'leviathan' : 'kraken', flank: 'tentacle', back: ['coral', 'weed', 'anemone'], sides: ['coral', 'urchin', 'weed'], corners: ['rock', 'bonepile', 'debris', 'bubble'], stains: ['patch', 'tuft'], n: 5 })
  /* a boneyard (Dead Wood, Catacombs, Gaslight, Crypt): rows of dug-up graves and coffins, a beast's carcass, heaps of
     bones, web-strung trees and the pale plants that grow on the dead */
  SCENE.boneyard = (D, A) => {
    const rows = Math.max(1, Math.min(3, Math.floor(A.ry / 40)));
    for (let r = 0; r < rows; r++) {
      const y = A.y - A.ry * 0.55 + r * 46;
      for (let x = A.x - A.rx * 0.7; x < A.x + A.rx * 0.7; x += 34 + D.r() * 14) D.put(D.key(D.pick(['opengrave', 'opengrave', 'grave', 'coffin'])), x, y);
    }
    if (A.rx > 100) D.near(D.key('carcass'), A.x + (D.r() - 0.5) * A.rx * 0.6, A.y + A.ry * 0.4, 26);
    for (const s of [-1, 1]) D.near(D.key('deadtree'), A.x + s * A.rx * 0.85, A.y - A.ry * 0.7, 18);
    D.scatter('bonepile', A.x, A.y + A.ry * 0.3, A.rx * 0.8, 3);
    D.scatter('mushroom', A.x, A.y, A.rx, 3);
    D.scatter('shrub', A.x, A.y, A.rx, 3);
    D.scatter('bones', A.x, A.y, A.rx, 4);
    D.put(D.key('chasm'), A.x + (D.r() - 0.5) * A.rx, A.y + A.ry * 0.5);
  };
  /* a quarantine pen (the Outbreak City): a fence round a crowd of the infected, swaying, warning signs on its posts */
  SCENE.quarantine = (D, A) => {
    const hw = Math.min(A.rx * 0.6, 120), hh = Math.min(A.ry * 0.5, 70);
    const fence = D.shaped('fence', 'run');
    D.wall(fence, A.x - hw, A.x + hw, A.y - hh);
    D.wall(fence, A.x - hw, A.x + hw, A.y + hh, { x: A.x, w: 40 });
    for (const s of [-1, 1]) for (let y = A.y - hh + 26; y < A.y + hh; y += 28) D.put(D.key('fence'), A.x + s * hw, y);
    for (let i = 0; i < 6; i++) D.near(D.key('shambler'), A.x + (D.r() - 0.5) * hw * 1.4, A.y + (D.r() - 0.5) * hh, 16);
    for (const s of [-1, 1]) D.put(D.key('lamp') || D.key('flood'), A.x + s * (hw + 26), A.y + hh + 10);
    D.scatter('decal', A.x, A.y, hw, 3);
  };
  function dungeons(D, L) {
    const doors = PR.pool('door', D.fam === 'r' ? 'a' : 'a');
    if (doors.length) { L.exit.gate = D.pick(doors); L.entrance.gate = D.pick(doors); }
    for (const s of L.secrets) D.near(D.key(D.fam === 'r' ? 'statue' : 'skeleton'), (s.crack.x + 0.5) * TS + 26, (s.crack.y + 1.4) * TS, 20); // a watcher by the hollow wall
  }

  /* ------------------------------------------------------------------ the Gaslight District (PLAN.md 18, K4) */
  const HV = (sheet, kind) => PR.pool(kind, 'g').filter((k) => k.startsWith('kit.' + sheet + '.'));
  /* a townhouse: Victorian brick front segments with a door and windows, under a slate roof with a dormer and a chimney,
     built into one picture (the modules face south only) */
  function townhouseSprite(D) {
    const IM = CH.Assets.images;
    const has = (k) => !!IM[k];
    const walls = [2, 3, 4, 5, 6, 7, 8, 9, 16].map((i) => 'kit.hv3.' + i).filter(has);
    const doors = [1, 2, 3, 14, 15, 16, 17, 18, 19, 20].map((i) => 'kit.hv5.' + i).filter(has);
    const wins = HV('hv6', 'window');
    const slates = ['kit.hv4.2', 'kit.hv4.4'].filter(has);
    const dormers = [14, 15, 16, 17, 18].map((i) => 'kit.hv4.' + i).filter(has);
    const chimneys = [7, 11, 12, 13].map((i) => 'kit.hv4.' + i).filter(has);
    if (walls.length < 2 || !doors.length || !slates.length) return null;
    const n = 3;
    const doorAt = Math.floor(D.r() * n);
    const front = [], over = [];
    for (let i = 0; i < n; i++) { front.push(D.pick(walls)); over.push(i === doorAt ? D.pick(doors) : D.r() < 0.85 && wins.length ? D.pick(wins) : null); }
    const slate = D.pick(slates), dormer = dormers.length ? D.pick(dormers) : null, chim = chimneys.length ? D.pick(chimneys) : null;
    const id = front.join() + over.join() + slate + dormer + chim;
    if (built[id]) return built[id];
    const cw = 46, wallH = 46, roofH = 52;
    const c = document.createElement('canvas');
    c.width = cw * n + 6;
    c.height = wallH + roofH + 12;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    const top = 12;
    const si = IM[slate];
    g.save();
    g.beginPath();
    g.rect(0, top, c.width, roofH + 6);
    g.clip();
    for (let y = top + roofH + 6 - si.height; y > top - si.height; y -= si.height - 4) for (let x = -6; x < c.width; x += si.width - 4) g.drawImage(si, x, y);
    g.restore();
    if (chim) { const ci = IM[chim]; g.drawImage(ci, Math.round(c.width * 0.75 - ci.width / 2), Math.max(0, top + 10 - ci.height + 20)); }
    if (dormer) { const di = IM[dormer]; g.drawImage(di, Math.round(c.width * 0.35 - di.width / 2), top + roofH - di.height + 4); }
    for (let i = 0; i < n; i++) {
      const im = IM[front[i]];
      const x = 3 + i * cw + Math.round((cw - im.width) / 2);
      g.drawImage(im, x, c.height - im.height);
      const o = over[i] && IM[over[i]];
      if (o) g.drawImage(o, 3 + i * cw + Math.round((cw - o.width) / 2), c.height - o.height - (i === doorAt ? 0 : 8));
    }
    const name = 'townhouse' + Object.keys(built).length;
    S.fromFrames(name, [c], { anchor: 'feet' });
    built[id] = { name, w: c.width, h: c.height, keys: front.concat(over.filter(Boolean), [slate], dormer ? [dormer] : [], chim ? [chim] : []), door: 3 + doorAt * cw + cw / 2 - c.width / 2 };
    return built[id];
  }
  SCENE.townhouse = (D, A, at, o) => {
    const th = townhouseSprite(D);
    const box = th && { hw: Math.round(th.w * 0.45), hh: Math.round(th.h * 0.32) }; // the roof leans back over the street behind
    let x = 0, y = 0, room = false;
    const tries = [];
    for (let oy = -0.5; oy <= 0.45; oy += 0.19) for (const ox of [0, -0.3, 0.3, -0.55, 0.55]) tries.push([ox, oy]);
    if (th) for (const [ox, oy] of tries) {
      x = Math.round(A.x + ox * A.rx);
      y = Math.round(A.y + oy * A.ry + box.hh);
      if (D.free(x, y, box.hw, box.hh, !(o && o.clear)) && D.clearOf(x, y, box)) { room = true; break; }
    }
    if (room && o && o.clear) { // make room: the scenery standing on its footprint goes
      for (let i = D.L.props.length - 1; i >= 0; i--) { const q = D.L.props[i]; if (q.sp && !q.kits && Math.abs(q.x - x) < box.hw + 20 && q.y > y - box.hh * 2 - 20 && q.y < y + 20) D.L.props.splice(i, 1); }
    }
    if (!room) return o && o.only ? null : SCENE.gstreet(D, A);
    CH.Arenas.addProp(D.L.props, th.name, x, y, { solid: true, box, cy: -box.hh + 1, cat: 'house', jumpable: false, elevation: 30, destructible: false });
    const p = D.L.props[D.L.props.length - 1];
    p.sp = true;
    p.kits = th.keys;
    p.enter = 'house'; // a way in (js/interiors.js)
    p.door = { x: x + th.door, y: y + 2 };
    D.L.townhouses = (D.L.townhouses || 0) + 1;
    D.placed.push(p);
    // the street in front: an iron fence, lamps, a bench, a bin, a poster, a carriage at the kerb
    const fence = D.kit('fence');
    for (const s of [-1, 1]) D.put(fence(), x + s * (th.w / 2 + 22), y + 4);
    for (const s of [-1, 1]) D.put(D.key('lamp'), x + s * (th.w / 2 - 10), y + 22);
    D.near(D.key('bench'), x - 30, y + 46, 16);
    D.near(D.key('bin'), x + 40, y + 40, 16);
    D.near(D.key('hang'), x + th.w / 2 + 8, y - 10, 10);
    D.near(D.key('carv'), x + (D.r() < 0.5 ? -1 : 1) * A.rx * 0.6, y + 70, 30);
  };
  /* a lamplit street: carriages at the kerb, lamps, benches, bins, posters, a pipe or a grate */
  SCENE.gstreet = (D, A) => {
    const y = A.y + (D.r() - 0.5) * A.ry * 0.4;
    let x = A.x - A.rx * 0.8;
    while (x < A.x + A.rx * 0.8) {
      if (D.r() < 0.55) D.put(D.key('carv'), x, y - 20);
      else D.put(D.key(D.pick(['bench', 'bin', 'signpost', 'stall'])), x, y - 26);
      D.put(D.key('lamp'), x + 20, y + 30);
      x += 80 + D.r() * 30;
    }
    D.scatter('plate', A.x, A.y, A.rx * 0.6, 2);
    D.scatter('hang', A.x, A.y - 40, A.rx * 0.6, 2);
    D.scatter('debris', A.x, A.y, A.rx * 0.8, 3);
  };
  /* the night market: awning stalls in a row, tables of curios, crates, sacks, lanterns, signs, a cage */
  SCENE.market = (D, A) => {
    const stalls = HV('hv13', 'stall');
    let x = A.x - A.rx * 0.6;
    while (x < A.x + A.rx * 0.6) { const p = D.put(stalls.length ? D.pick(stalls) : D.key('stall'), x, A.y - 20); x += (p && p.box ? p.box.hw * 2 : 50) + 18; }
    for (let i = 0; i < 3; i++) D.near(D.key('table'), A.x - 60 + i * 60, A.y + 40, 16);
    D.pile(A.x + A.rx * 0.6, A.y + 50, ['crate', 'sack', 'barrel'], 3);
    for (const s of [-1, 1]) D.put(D.key('lantern') || D.key('lamp'), A.x + s * A.rx * 0.75, A.y - 10);
    D.near(D.key('sign'), A.x, A.y + 80, 20);
    D.near(D.key('cage'), A.x - A.rx * 0.6, A.y + 60, 20);
  };
  /* a cemetery: graves in rows inside an iron fence with a gate, a mausoleum, statues, a dead tree, candles */
  SCENE.cemetery = (D, A) => {
    const w = Math.min(A.rx * 1.5, 220), h = Math.min(A.ry * 1.3, 150);
    const fence = D.kit('fence');
    for (let x = A.x - w / 2; x <= A.x + w / 2; x += 40) { if (Math.abs(x - A.x) > 30) D.put(fence(), x, A.y + h / 2); D.put(fence(), x, A.y - h / 2); }
    D.put(D.key('door'), A.x, A.y + h / 2);
    D.put(D.key('crypt'), A.x, A.y - h / 2 + 30);
    for (let r = 0; r < 2; r++) for (let c = -2; c <= 2; c++) if (c && D.r() < 0.85) D.put(D.key('grave'), A.x + c * 38, A.y + r * 36);
    for (const s of [-1, 1]) D.put(D.key('statue'), A.x + s * (w / 2 - 20), A.y - h / 2 + 30);
    D.near(D.key('deadtree'), A.x + w / 2 - 30, A.y + 20, 20);
    D.scatter('candles', A.x, A.y, w * 0.4, 3);
    D.scatter('shrub', A.x, A.y, w * 0.5, 3);
  };
  /* an occult corner: a pentagram on the cobbles, candles round it, grimoires and skulls, cult banners, a throne */
  SCENE.occult = (D, A) => {
    const IM = CH.Assets.images;
    if (IM['kit.hv_pentagram']) D.put('kit.hv_pentagram', A.x, A.y + 30, { a: 0.95 });
    else D.put(D.key('decal'), A.x, A.y + 20);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.283; D.put(D.key('candles'), A.x + Math.cos(a) * 54, A.y + 20 + Math.sin(a) * 34); }
    D.put(D.key('throne'), A.x, A.y - 50);
    for (const s of [-1, 1]) D.put(D.key('banner'), A.x + s * 70, A.y - 46);
    D.scatter('item', A.x, A.y + 10, 60, 3);
    D.near(D.key('altar'), A.x + 80, A.y + 30, 20);
  };
  function gaslight(D, L) {
    const IM = CH.Assets.images;
    for (const s of L.secrets) D.near(D.key(D.r() < 0.5 ? 'hang' : 'sign'), (s.crack.x + 0.5) * TS + 24, (s.crack.y + 1.4) * TS, 20); // a poster by the hollow wall
    if (L.trail) for (let ty = 0; ty < L.th; ty += 4) for (let tx = 0; tx < L.tw; tx += 4) if (L.trail[L.idx(tx, ty)] === 2 && D.r() < 0.2) D.put(D.key('plate'), tx * TS + 16, ty * TS + 20, { a: 0.9 });
    if (IM['kit.hv_skull_arch']) L.exit.gate = 'kit.hv_skull_arch';
    // a Gothic throne and candelabras (Victorian 20) wait by the way out
    const gothic = (kind) => PR.pool(kind, 'g').filter((k) => k.startsWith('kit.hv20.'));
    const th = gothic('throne'), cand = gothic('candles');
    if (th.length) D.near(D.pick(th), L.exit.x + 90, L.exit.y - 40, 30);
    for (const sx of [-1, 1]) if (cand.length) D.near(D.pick(cand), L.exit.x + sx * 64, L.exit.y + 30, 16);
    if (IM['kit.hv5.5']) L.entrance.gate = 'kit.hv5.5';
  }

  /* ------------------------------------------------------------------ the Frozen Kingdom (PLAN.md 18, K3) */
  const FK = (sheet, kind) => PR.pool(kind, 'f').filter((k) => k.startsWith('kit.' + sheet + '.'));
  /* a frozen hamlet: two or three houses in a row with gaps, a market stall, lamps, bunting, barrels, a well, a fence */
  SCENE.frozentown = (D, A) => {
    const houses = FK('fk7', 'house').concat(FK('fk7', 'hut'), FK('fk6', 'hut'));
    let x = A.x - A.rx * 0.6;
    const y = A.y - A.ry * 0.15;
    for (let i = 0; i < 3 && x < A.x + A.rx * 0.6; i++) {
      const p = D.put(D.pick(houses), x, y);
      if (p && p.box) { p.enter = 'hut'; p.door = { x: p.x, y: p.y + 2 }; } // a way in (js/interiors.js)
      x += (p && p.box ? p.box.hw * 2 : 60) + 26;
    }
    D.near(D.key('stall'), A.x + A.rx * 0.3, A.y + A.ry * 0.45, 20);
    for (const s of [-1, 1]) D.put(D.key('lamp'), A.x + s * A.rx * 0.5, A.y + A.ry * 0.25);
    D.near(D.key('banner'), A.x, A.y + A.ry * 0.2, 16);
    D.pile(A.x - A.rx * 0.45, A.y + A.ry * 0.45, ['barrel', 'crate', 'sack'], 3);
    D.near(D.key('well'), A.x - A.rx * 0.05, A.y + A.ry * 0.55, 24);
    D.near(D.key('carv'), A.x + A.rx * 0.65, A.y + A.ry * 0.2, 24);
    const fences = FK('fk11', 'fence'); // the pack's own iron-and-snow fences
    for (let i = 0; i < 3; i++) D.put(fences.length ? D.pick(fences) : D.key('fence'), A.x - A.rx * 0.8 + i * 36, A.y + A.ry * 0.7);
  };
  /* a winter camp: the tent, a fire, drying racks, a weapon rack, shelves, crate tables, tubs */
  SCENE.wintercamp = (D, A) => {
    D.put('kit.fk17.0', A.x - 30, A.y - 20);
    D.fire(A.x + 34, A.y + 16);
    D.near('kit.fk17.2', A.x + 70, A.y - 26, 16);
    D.near('kit.fk17.3', A.x - 80, A.y + 20, 16);
    D.near('kit.fk17.4', A.x + 4, A.y - 54, 16);
    D.near(D.pick(FK('fk17', 'table')), A.x - 60, A.y + 50, 16);
    D.pile(A.x + 70, A.y + 48, ['barrel', 'barrel', 'crate'], 3);
    D.scatter('debris', A.x, A.y, A.rx * 0.6, 3);
  };
  /* a crystal field: clusters, rune plates in the snow, a crystal shrine */
  const RUNES = () => FK('fk14', 'decal');
  SCENE.crystals = (D, A) => {
    // a ring of rune medallions round the altar, the crystals growing outside it
    const runes = RUNES();
    for (let i = 0; i < 6 && runes.length; i++) { const a = (i / 6) * Math.PI * 2; D.put(runes[(D.step * 6 + i) % runes.length], A.x + Math.cos(a) * 52, A.y - 14 + Math.sin(a) * 34, { a: 1 }); }
    D.scatter('crystal', A.x, A.y, A.rx * 0.8, 7);
    D.scatter('plate', A.x, A.y, A.rx * 0.5, 3);
    D.near(D.key('altar') || D.key('crystal'), A.x, A.y - 20, 20);
    for (const s of [-1, 1]) D.put(D.key('lamp'), A.x + s * 56, A.y + 30);
  };
  /* an avenue of statues: knights and robed figures on plinths, obelisks, braziers, a frozen fountain */
  SCENE.statues = (D, A) => {
    const pillars = FK('fk15', 'pillar'); // ice pillars close the avenue
    const runes = RUNES(); // each figure on a rune medallion
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
      const x = A.x + s * 70, y = A.y - A.ry * 0.5 + i * 52;
      if (runes.length) D.put(runes[(D.step * 6 + i * 2 + (s > 0)) % runes.length], x, y + 4, { a: 1 });
      D.put(D.key(i === 1 ? 'obelisk' : 'statue'), x, y);
    }
    for (const s of [-1, 1]) if (pillars.length) D.put(D.pick(pillars), A.x + s * 110, A.y - A.ry * 0.5);
    D.put(D.key('well'), A.x, A.y - 10);
    for (const s of [-1, 1]) D.put(D.key('brazier'), A.x + s * 30, A.y + A.ry * 0.5);
    D.scatter('plate', A.x, A.y, 40, 1);
  };
  /* a stretch of the ice castle: crenellated walls and towers along the back, banners, a gatehouse in the middle */
  SCENE.castle = (D, A) => {
    const walls = FK('fk5', 'castle');
    const y = A.y - A.ry * 0.55;
    let x = A.x - A.rx * 0.8;
    const mid = A.x;
    let gate = false;
    while (x < A.x + A.rx * 0.8) {
      let key = D.pick(walls);
      if (!gate && x > mid - 50) { key = 'kit.fk5.24'; gate = true; }
      const p = D.put(key, x, y);
      x += p && p.box ? p.box.hw * 2 + 2 : 40;
    }
    for (const s of [-1, 1]) D.put(D.key('banner'), A.x + s * 60, A.y + 4);
    D.scatter('rubble', A.x, A.y + 20, A.rx * 0.6, 3);
    for (const s of [-1, 1]) D.put(D.key('torch'), A.x + s * 40, A.y + 30);
  };
  /* frozen water: slabs of dark ice in the open, slippery (js/player.js reads L.ice) */
  function frozen(D, L) {
    L.ice = [];
    const slabs = PR.pool('pool', 'f');
    if (!slabs.length) return;
    for (let i = 0; i < 40 && L.ice.length < 9; i++) {
      const rm = D.pick(L.rooms);
      if (!rm || rm.tag === 'start') continue;
      const A = area(L, rm);
      const x = A.x + (D.r() - 0.5) * A.rx * 1.4, y = A.y + (D.r() - 0.5) * A.ry * 1.2;
      const key = D.pick(slabs);
      const d = D.put(key, x, y, { a: 0.95 });
      if (d && d.img) L.ice.push({ x: d.x, y: d.y + d.img.height / 2, rx: d.img.width * 0.45, ry: d.img.height * 0.45 });
    }
    if (CH.Assets.images['kit.fk_ice_gate']) L.exit.gate = 'kit.fk_ice_gate';
    const stalls = PR.pool('stall', 'f').filter((k) => k.startsWith('kit.fk16.')); // a trader's stall (Frozen 16) not far from the start
    if (stalls.length) D.near(D.pick(stalls), L.entrance.x + 120, L.entrance.y - 44, 40);
    const pillars = PR.pool('pillar', 'f').filter((k) => k.startsWith('kit.fk15.')); // ice pillars flank the exit and the entrance
    for (const P of [L.exit, L.entrance]) for (const sx of [-1, 1]) if (pillars.length) D.near(D.pick(pillars), P.x + sx * 76, P.y - 6, 14);
    if (CH.Assets.images['kit.fk_portal']) D.near('kit.fk_portal', L.exit.x + 80, L.exit.y - 30, 20);
    for (const s of L.secrets) D.near(D.key('signpost') || D.key('grave'), (s.crack.x + 0.5) * TS + 30, (s.crack.y + 1.5) * TS, 20);
    // the icy path pieces (Frozen 2) worn into the trail
    const paths = PR.pool('patch', 'f').filter((k) => k.startsWith('kit.fk2.'));
    if (L.trail && paths.length) for (let ty = 0; ty < L.th; ty += 3) for (let tx = 0; tx < L.tw; tx += 3) if (L.trail[L.idx(tx, ty)] === 2 && D.r() < 0.3) D.put(D.pick(paths), tx * TS + 16, ty * TS + 20, { a: 0.9 });
  }

  /* ------------------------------------------------------------------ landmarks (PLAN.md 20, request 7) */
  /* every stage has one place worth walking to: a monument of its biome in the biggest quiet room, built before the
     rooms are dressed so it has the room to itself, with a lore stone in front of it that the interact button reads
     (js/interact.js). The Dead Wood's is its giant twisted tree. */
  const anyKey = (D, kind) => D.key(kind) || (() => { const pool = PR.pool(kind, 'acfgrzwvhm'); return pool.length ? D.pick(pool) : null; })();
  const LANDMARK = {
    a: { name: 'THE BONE THRONE', build(D, A) {
      D.put(anyKey(D, 'throne'), A.x, A.y - 30);
      for (const s of [-1, 1]) { D.put(anyKey(D, 'statue'), A.x + s * 52, A.y - 36); D.put(D.key('banner'), A.x + s * 30, A.y - 52); D.put(D.key('brazier') || D.key('torch'), A.x + s * 78, A.y + 6); }
      for (let i = 0; i < 7; i++) { const a = Math.PI * (0.1 + i * 0.133); D.put(D.key('candles'), A.x + Math.cos(a) * 54, A.y - 8 + Math.sin(a) * 26); }
      D.scatter('bones', A.x, A.y - 4, 60, 6);
      D.scatter('skeleton', A.x, A.y + 10, 70, 2);
    } },
    g: { name: 'THE FOUNTAIN SQUARE', build(D, A) {
      D.put(anyKey(D, 'well') || anyKey(D, 'statue'), A.x, A.y - 18);
      D.put(anyKey(D, 'statue'), A.x, A.y - 50);
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) D.put(D.key('lamp'), A.x + sx * 70, A.y - 18 + sy * 36);
      for (const s of [-1, 1]) D.put(D.key('bench'), A.x + s * 46, A.y + 22);
      D.scatter('patch', A.x, A.y, 60, 2);
    } },
    z: { name: 'THE PILE-UP', build(D, A) {
      for (let i = 0; i < 4; i++) D.near(anyKey(D, i % 2 ? 'carv' : 'car'), A.x - 70 + i * 46, A.y - 30 + (i % 2) * 22, 12);
      for (const s of [-1, 1]) { D.put(D.key('flood') || D.key('lamp'), A.x + s * 96, A.y - 40); D.put(D.key('barricade'), A.x + s * 60, A.y + 30); }
      D.scatter('cone', A.x, A.y + 20, 70, 4);
      D.scatter('debris', A.x, A.y, 90, 6);
      D.scatter('tires', A.x, A.y, 80, 2);
    } },
    h: { name: 'THE WARD', build(D, A) {
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) D.put(anyKey(D, 'bed'), A.x + s * 58, A.y - 46 + i * 34);
      D.put(anyKey(D, 'statue'), A.x, A.y - 40);
      for (const s of [-1, 1]) D.put(D.key('cage') || D.key('machine'), A.x + s * 96, A.y);
      D.scatter('candles', A.x, A.y - 10, 40, 3);
      D.scatter('scrawl', A.x, A.y + 10, 70, 3);
    } },
    w: { name: 'THE REACTOR', build(D, A) {
      D.put(anyKey(D, 'reactor'), A.x, A.y - 24);
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; D.put(i % 2 ? anyKey(D, 'crystal') : anyKey(D, 'toxbarrel'), A.x + Math.cos(a) * 70, A.y - 10 + Math.sin(a) * 40); }
      D.scatter('pipestand', A.x, A.y, 90, 3);
      D.scatter('plate', A.x, A.y + 10, 50, 2);
    } },
    f: { name: 'THE ICE SHRINE', build(D, A) {
      D.put(anyKey(D, 'statue'), A.x, A.y - 30);
      for (let i = 0; i < 6; i++) { const a = Math.PI * (1.1 + i * 0.16); D.put(anyKey(D, 'crystal'), A.x + Math.cos(a) * 64, A.y - 10 + Math.sin(a) * 34); }
      for (const s of [-1, 1]) D.put(D.key('brazier'), A.x + s * 40, A.y + 10);
      D.scatter('plate', A.x, A.y, 40, 2);
    } },
    v: { name: 'THE FORGE OF ASH', build(D, A) {
      D.put(anyKey(D, 'machine') || anyKey(D, 'altar'), A.x, A.y - 34);
      for (const s of [-1, 1]) { D.put(anyKey(D, 'anvil'), A.x + s * 40, A.y - 4); D.put(anyKey(D, 'cauldron'), A.x + s * 72, A.y - 30); D.put(D.key('brazier'), A.x + s * 90, A.y + 14); }
      for (let i = 0; i < 6; i++) { const a = Math.PI * (0.05 + i * 0.18); D.put(anyKey(D, 'lavarock'), A.x + Math.cos(a) * 100, A.y + 20 + Math.sin(a) * 30); }
      D.scatter('ashes', A.x, A.y, 60, 2);
    } },
    r: { name: 'THE HALL OF KINGS', build(D, A) {
      D.put(anyKey(D, 'throne'), A.x, A.y - 40);
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) D.put(D.key('pillar') || D.key('statue'), A.x + s * 70, A.y - 50 + i * 40);
      for (const s of [-1, 1]) D.put(D.key('brazier'), A.x + s * 30, A.y - 20);
      D.scatter('rug', A.x, A.y + 10, 10, 1);
    } },
    m: { name: 'THE OLD WATCH', build(D, A) {
      SCENE.ruin(D, A);
      D.put(D.key('statue') || D.key('obelisk'), A.x, A.y - 10);
    } },
  };
  LANDMARK.c = { name: 'THE GIANT TREE' }; // built by giantTree()
  const LORE = {
    a: ['Whoever sat here ruled the dead. The dead were not impressed. They never are.', 'A plaque reads: RESERVED. Below it, in fresher scratches: NOT FOR LONG.'],
    g: ['The fountain was a gift to the city from a grateful cult. Nobody asked what it was grateful for.', 'Toss a coin in for luck. Something in the water says thank you. In your voice.'],
    z: ['Everybody tried to leave the city at once. Traffic, it turns out, is the real apocalypse.', 'A note under a wiper: "Back in 5 min. Do not eat." The handwriting deteriorates.'],
    h: ['The patients were promised a cure. The cure was promised patients. Everyone was disappointed.', 'Chart, bed 3: "Insists reality has a bug. Recommend more bugs." Signed, illegibly, by a bug.'],
    w: ['The reactor still hums a lullaby. It is the only thing out here that ever sang.', 'WARNING stencilled over WARNING stencilled over a smiley face somebody kept repainting.'],
    f: ['The ice remembers a queen who froze her own heart to stop it breaking. It broke anyway, just colder.', 'Offerings at the shrine: three mittens, a fish, and a very apologetic letter to the cold.'],
    v: ['The smiths of ash forged a sword that could cut a promise. They did not trust each other after that.', 'Hammer marks on the anvil spell a word over and over. The word is MORE.'],
    r: ['The kings of the Crimson Castle were crowned in blood and buried in debt. The debt is still collecting.', 'An empty throne is a question. This one has been waiting a long time for a bad answer.'],
    c: ['The giant tree was planted by the first settlers. It ate the second settlers. The third ones built further away.', 'Carved in the bark, many times: TURN BACK. Under it, newer: OR DO NOT, I AM A TREE.'],
    m: ['The old watch tower kept the valley safe until the valley stopped wanting to be kept.', 'Somebody counted the days on the stones in here. They stopped at a number nobody wants to say out loud.'],
  };
  SP.LANDMARK = LANDMARK;
  /* the Crypt's other landmark, every other stage: the lich rising from its pit (Undead Land Objects, PLAN.md 21) */
  const LICH = { name: "THE LICH'S PIT", build(D, A) {
    D.put(D.key('lich'), A.x, A.y - 10, { force: true });
    D.put(D.key('chasm'), A.x - 70, A.y + 20);
    for (const s of [-1, 1]) { D.put(D.key('bonepile'), A.x + s * 84, A.y - 20); D.put(D.key('candles'), A.x + s * 56, A.y + 26); }
    D.scatter('bones', A.x, A.y, 90, 6);
    D.scatter('opengrave', A.x, A.y + 30, 110, 3);
  } };
  function landmark(D, L) {
    const fam = LANDMARK[D.fam] ? D.fam : 'm';
    const def = fam === 'h' && D.step % 2 === 1 && PR.pool('lich', 'u').length ? LICH : LANDMARK[fam];
    let at = null;
    if (fam === 'c') { // the Dead Wood: the giant tree is the landmark; the lore stone stands before it
      const tree = L.props.find((p) => p.sheet === 'kit.cf_giant_tree');
      if (tree) at = { x: tree.x + 36, y: tree.y + 26 };
    } else {
      const quiet = L.rooms.filter((rm) => rm.tag !== 'start' && rm.tag !== 'exit' && rm.tag !== 'hall' && rm.tag !== 'town' && !L.spawners.some((s) => s.room === rm.id));
      quiet.sort((a, b) => (b.r ? b.r * b.r * 3 : b.w * b.h) - (a.r ? a.r * a.r * 3 : a.w * a.h));
      const rm = quiet[0];
      if (!rm) return;
      const A = area(L, rm);
      if (A.rx < 80 || A.ry < 60) return;
      rm.landmark = true;
      def.build(D, A);
      at = { x: A.x, y: A.y + Math.min(A.ry * 0.6, 52) };
    }
    if (!at) return;
    const stone = D.put(anyKey(D, 'sign') || anyKey(D, 'plaque') || anyKey(D, 'signpost') || anyKey(D, 'grave'), at.x, at.y) || D.near(anyKey(D, 'signpost') || anyKey(D, 'grave'), at.x, at.y, 26);
    const x = stone ? stone.x : at.x, y = stone ? stone.y : at.y;
    const lines = LORE[fam] || LORE.m;
    L.lore = [{ x, y, name: def.name, lines: [lines[Math.floor(D.r() * lines.length) % lines.length]] }];
  }

  /* the giant twisted tree in the biggest quiet room (before the rooms are dressed); after them: warning signs by the
     secret walls, the trail's debris, and the gates at the ends */
  function giantTree(D, L) {
    const IM = CH.Assets.images;
    const quiet = L.rooms.filter((rm) => rm.tag !== 'start' && rm.tag !== 'exit' && !L.spawners.some((s) => s.room === rm.id));
    quiet.sort((a, b) => (b.r || b.w) - (a.r || a.w));
    let tree = !IM['kit.cf_giant_tree'];
    for (const rm of quiet) {
      if (tree) break;
      const A = area(L, rm);
      for (const [ox, oy] of [[0.45, -0.25], [-0.45, -0.25], [0, -0.5], [0.4, 0.3], [-0.4, 0.3], [0, 0]]) if (D.put('kit.cf_giant_tree', A.x + A.rx * ox, A.y + A.ry * oy)) { tree = true; break; }
    }
  }
  function deadwood(D, L) {
    const IM = CH.Assets.images;
    for (const s of L.secrets) {
      const cx = (s.crack.x + 0.5) * TS, cy = (s.crack.y + 0.5) * TS;
      for (const [ox, oy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) {
        if (L.solid(s.crack.x + ox, s.crack.y + oy)) continue;
        D.near(D.key(D.r() < 0.6 ? 'sign' : 'signpost'), cx + ox * 40 + oy * 20, cy + oy * 40 + 16, 18);
        break;
      }
    }
    if (L.trail) for (let ty = 0; ty < L.th; ty += 3) for (let tx = 0; tx < L.tw; tx += 3) if (L.trail[L.idx(tx, ty)] === 2 && D.r() < 0.28) D.put(D.key('patch'), tx * TS + 16, ty * TS + 20, { a: 0.9 });
    if (IM['kit.cf_skull_gate']) L.exit.gate = 'kit.cf_skull_gate';
    // one of the legendary pieces (Creepy Forest 20) waits by the way out: an altar, a throne-portal, a skull pillar
    const legend = Object.keys(PR.KCAT.cf20).reduce((a, k) => a.concat(PR.pool(k, 'c').filter((q) => q.startsWith('kit.cf20.'))), []);
    if (legend.length) D.near(D.pick(legend), L.exit.x - 96, L.exit.y - 36, 30);
    if (IM['kit.cf_crypt_arch']) L.entrance.gate = 'kit.cf_crypt_arch';
  }

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
    for (const s of L.secrets || []) D.reserve((s.crack.x + 0.5) * TS, (s.crack.y + 0.5) * TS, 44); // the way up to a hollow wall
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
    if (D.fam === 'c') giantTree(D, L); // the landmark first, while its room is empty
    if (!L.bossHall) landmark(D, L);
    const scenes = SCENES[biome] || SCENES.dungeon;
    let si = Math.floor(D.r() * scenes.length);
    const camps = [];
    for (const rm of L.rooms) {
      if (rm.tag === 'town') continue;
      const A = area(L, rm);
      if (rm.tag === 'start') { rm.purpose = 'herocamp'; SCENE.herocamp(D, A, L.entrance); continue; }
      if (rm.tag === 'hall') { rm.purpose = 'bosshall'; SCENE.bosshall(D, A); continue; } // an act boss's hall (js/worldmap.js)
      const sp = L.spawners.find((s) => s.room === rm.id);
      const pk = L.packs.find((q) => q.room === rm.id);
      if (rm.landmark) { if (pk) pk.camp = { x: pk.x, y: pk.y, r: 80 }; continue; } // the landmark has its room to itself
      if (sp) {
        const nestBiome = biome === 'glitch' || biome === 'office';
        rm.purpose = 'camp';
        const c = (nestBiome ? SCENE.nest : SCENE.camp)(D, A, sp, { noFire: false });
        camps.push(c);
        if (pk) { pk.x = c.x + (D.r() - 0.5) * 40; pk.y = c.y + c.r * 0.35; pk.camp = c; }
        continue;
      }
      const owed = (D.fam === 'c' && !L.cabins) || (D.fam === 'g' && !L.townhouses); // a stage still waiting for its cabin / townhouse
      if (pk && D.r() < 0.5 && !owed && biome !== 'dungeon' && biome !== 'office' && biome !== 'glitch') {
        rm.purpose = 'camp';
        const c = SCENE.camp(D, A, { x: A.x, y: A.y }, {});
        pk.x = c.x; pk.y = c.y; pk.camp = c;
        camps.push(c);
        continue;
      }
      const name = rm.tag === 'exit' ? 'shrine' : D.fam === 'c' && !L.cabins ? 'cabin' : D.fam === 'g' && !L.townhouses ? 'townhouse' : scenes[si++ % scenes.length]; // every Dead Wood stage has a cabin, every Gaslight one a townhouse
      rm.purpose = SCENE[name] ? name : 'ruin';
      const made = (SCENE[name] || SCENE.ruin)(D, A, { x: A.x, y: A.y }, {}); // an empty camp: a deserted one
      if (made && name === 'camp') camps.push(made);
      if (pk) pk.camp = { x: pk.x, y: pk.y, r: Math.min(A.rx, 90) };
    }
    // every Gaslight stage has its townhouse: when no room was free for it, the roomiest room that will hold one gets it
    if (D.fam === 'g' && !L.townhouses) {
      const big = L.rooms.filter((rm) => rm.tag !== 'start' && rm.tag !== 'exit' && rm.tag !== 'town').map((rm) => area(L, rm)).sort((a, b) => b.rx * b.ry - a.rx * a.ry);
      for (const A of big) { SCENE.townhouse(D, A, null, { only: true }); if (L.townhouses) break; }
      // every room a breach's camp or the landmark's: it stands on the open street between them, off the route
      for (let ty = 6; ty < L.th - 4 && !L.townhouses; ty += 5) for (let tx = 6; tx < L.tw - 6 && !L.townhouses; tx += 5) {
        if (L.solid(tx, ty) || (L.route && L.route[L.idx(tx, ty)])) continue;
        SCENE.townhouse(D, { x: (tx + 0.5) * TS, y: (ty + 0.5) * TS, rx: 24, ry: 24 }, null, { only: true });
      }
      for (const A of big) { if (L.townhouses) break; SCENE.townhouse(D, A, null, { only: true, clear: true }); }
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
    if (D.fam === 'c') deadwood(D, L);
    if (D.fam === 'f') frozen(D, L);
    if (D.fam === 'g') gaslight(D, L);
    if (D.fam === 'a' || D.fam === 'r') dungeons(D, L);
    if (SP.after && SP.after[biome]) SP.after[biome](D, L); // the sky road's tower, the belly's heart (js/sky.js)
    const t0 = performance.now();
    fields(D, L);
    edges(D, L);
    const t1 = performance.now();
    sweep(D, L);
    floorInlays(D, L);
    const t2 = performance.now();
    // a piece taken out for cutting a way (or the long way round) stands again in a room: every piece still shows
    // standing where it no longer cuts a way (checked), or, when no such spot is found, drawn small enough to step over
    const targets = [L.exit].concat(L.spawners, L.packs, L.chests.filter((c) => !c.secret), L.shrines, L.waypoints);
    const reachable = () => { L.flows.clear(); CH.Props.invalidate(); const f = L.flowFor(L.entrance.x, L.entrance.y); return targets.every((t) => f.dist[L.idx(Math.floor(t.x / TS), Math.floor(t.y / TS))] >= 0); };
    const gone = keepReachable(L);
    const fine = () => reachable() && detour(L, L.flowFor(L.entrance.x, L.entrance.y).dist, gone.fc) < 0; // and no new long way round
    L.moved = gone.map((p) => p.sheet || p.sprite); // (what was moved, for tests/detour_scan.js)
    for (const p of gone) {
      const key = p.sheet || (p.sprite && p.sprite.startsWith('obj.') ? p.sprite : null);
      if (!key || L.props.some((q) => (q.sheet || q.sprite) === key) || L.decals.some((d) => d.key === key)) continue;
      const rooms = L.rooms.filter((rm) => rm.tag !== 'start' && rm.tag !== 'exit');
      let placed = false;
      for (let t = 0; t < 20 && !placed; t++) {
        const A = area(L, rooms[Math.floor(D.r() * rooms.length)] || L.rooms[0]);
        const x = A.x + (D.r() - 0.5) * A.rx * 1.6, y = A.y + (D.r() - 0.5) * A.ry * 1.4;
        if (!openGround(L, Math.floor(x / TS), Math.floor(y / TS), 1, 1, 0, true)) continue; // a free spot, not wedged against another piece
        const q = D.put(key, x, y, { force: true });
        if (!q) continue;
        if (!q.solid || fine()) { q.swept = true; placed = true; } else L.props.splice(L.props.indexOf(q), 1);
      }
      if (!placed) { // small enough to step over: a token of it, so it still shows
        const sp = CH.Sprites.has(p.sprite) && CH.Sprites.get(p.sprite);
        const A = area(L, rooms[0] || L.rooms[0]);
        const q = sp && D.put(key, A.x + (D.r() - 0.5) * A.rx, A.y + (D.r() - 0.5) * A.ry, { force: true, scale: Math.min(1, 15 / Math.max(1, sp.h)) });
        if (q) { q.solid = false; q.box = null; q.swept = true; }
      }
    }
    // every Frozen Kingdom stage has a house to go into (js/interiors.js): when no hamlet was built (every room a camp), one
    // stands on open ground with a walkway round it, off the route
    if (D.fam === 'f' && !L.props.some((p) => p.enter === 'hut')) {
      const houses = FK('fk7', 'house').concat(FK('fk7', 'hut'), FK('fk6', 'hut'));
      for (let t = 0; t < 900; t++) {
        const tx = 5 + Math.floor(D.r() * (L.tw - 10)), ty = 5 + Math.floor(D.r() * (L.th - 10));
        if (!(t < 400 ? openGround(L, tx, ty, 3, 2, 2, true) : openGround(L, tx, ty, 2, 1, 1, true))) continue;
        const p = D.put(D.pick(houses), tx * TS + 16, ty * TS + 28);
        if (p && p.box) { p.enter = 'hut'; p.door = { x: p.x, y: p.y + 2 }; p.keep = true; break; }
        if (p) L.props.splice(L.props.indexOf(p), 1);
      }
    }
    L.flows.clear();
    CH.Props.invalidate();
    L.dressMs = { fields: Math.round(t1 - t0), sweep: Math.round(t2 - t1), keep: Math.round(performance.now() - t2) }; // where the time goes (t25)
    if (!L.bossHall) LG.puddles(L, D.r); // last: puddles keep off everything that stands (PLAN.md 20)
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
    c: ['shrub', 'mushroom', 'rock', 'stump', 'bones', 'debris', 'flower', 'grave'],
    f: ['rock', 'crystal', 'rubble', 'tree', 'debris', 'spike', 'pillar'],
    g: ['rubble', 'debris', 'pipe', 'shrub', 'bin', 'hang', 'plate', 'patch'],
    a: ['bones', 'bones', 'debris', 'pot', 'skeleton', 'decal', 'candles', 'hang'],
    r: ['pillar', 'block', 'plate', 'brazier', 'debris', 'pot', 'statue', 'shrub'],
  };
  /* open ground between the rooms (outdoor maps are mostly that): a small clump every few tiles */
  const FIELD = {
    backyard: [['tree', 'tree', 'shrub', 'shrub'], ['tree', 'deadtree', 'shrub', 'flower'], ['rock', 'shrub', 'flower'], ['boulder', 'shrub', 'rock']],
    gaslight: [['lamp', 'bench', 'bin'], ['shrub', 'deadtree', 'grave'], ['carv', 'debris'], ['rubble', 'debris', 'pipe'], ['statue', 'shrub'], ['stall', 'crate', 'barrel']],
    deadwood: [['deadtree', 'deadtree', 'shrub', 'mushroom'], ['deadtree', 'stump', 'log', 'rock'], ['grave', 'grave', 'deadtree', 'candles'], ['boulder', 'rock', 'shrub'], ['deadtree', 'bones', 'signpost'], ['growth', 'mushroom', 'arch']],
    frozen: [['tree', 'tree', 'rock'], ['deadtree', 'crystal', 'rock'], ['cliff', 'spike'], ['crystal', 'crystal', 'plate'], ['tree', 'deadtree', 'rubble'], ['pillar', 'rubble']],
    zombie: [['car', 'debris', 'trash'], ['trash', 'bin', 'debris'], ['deadtree', 'shrub', 'debris'], ['barricade', 'cone', 'debris']],
    wasteland: [['rubble', 'debris', 'tires'], ['carv', 'debris'], ['toxbarrel', 'barrel', 'debris'], ['deadtree', 'shrub', 'debris']],
    volcano: [['lavarock', 'rock'], ['spike', 'lavarock', 'debris'], ['boulder', 'debris']],
    dungeon: [['pillar', 'debris'], ['rubble', 'debris', 'bones'], ['bones', 'debris']],
  };
  /* a w x h tile patch (plus m round it) of open ground: no rock, no route and, asked (clear), no standing prop. (A grove
     that shuts a gap against a wall or a fence has its piece in the way moved by keepReachable's detour pass) */
  function openGround(L, cx, cy, w, h, m = 0, clear = false) {
    for (let oy = -h - m; oy <= h + m; oy++) for (let ox = -w - m; ox <= w + m; ox++) if (L.solid(cx + ox, cy + oy) || (L.route && L.route[L.idx(cx + ox, cy + oy)])) return false;
    if (!clear) return true;
    const x0 = (cx - w - m) * TS, x1 = (cx + w + m + 1) * TS, y0 = (cy - h - m) * TS, y1 = (cy + h + m + 1) * TS;
    return !L.props.some((p) => p.solid && !p.dead && p.x > x0 && p.x < x1 && p.y > y0 && p.y < y1);
  }

  /* the open ground between the rooms (PLAN.md 22): a few groves, each of one thing (a thicket of trees, a field of rocks,
     a ruined wall, a plot of graves), dense and far apart, so the ground reads as places with open land between them,
     not as an even sprinkle of odds and ends */

  function fields(D, L) {
    const sets = FIELD[D.biome] || FIELD.dungeon;
    if (!sets.length) return;
    const inRoom = (x, y) => L.rooms.some((rm) => U.dist(x, y, rm.cx, rm.cy) < (rm.r ? (rm.r + 2) * TS : Math.max(rm.w, rm.h) * TS * 0.6));
    const centres = [];
    const want = Math.max(3, Math.round((L.tw * L.th) / 1500));
    for (let t = 0; t < 600 && centres.length < want; t++) {
      const cx = 4 + Math.floor(D.r() * (L.tw - 8)), cy = 4 + Math.floor(D.r() * (L.th - 8));
      const open = openGround(L, cx, cy, 3, 3);
      const px = cx * TS + 16, py = cy * TS + 16;
      if (!open || inRoom(px, py) || centres.some((q) => U.dist(q.x, q.y, px, py) < 360)) continue;
      centres.push({ x: px, y: py });
    }
    for (const c of centres) {
      const set = D.pick(sets);
      const n = 7 + Math.floor(D.r() * 6);
      // a tight blob: a spiral out from the middle, the biggest piece of the set at its heart
      for (let i = 0; i < n; i++) {
        const a2 = i * 2.39996, d = 16 * Math.sqrt(i) * (0.9 + D.r() * 0.3);
        const x = c.x + Math.cos(a2) * d * 1.3, y = c.y + Math.sin(a2) * d;
        if (L.route && L.route[L.idx(Math.floor(x / TS), Math.floor(y / TS))]) continue;
        D.put(D.key(i === 0 ? set[0] : D.pick(set)), x, y);
      }
    }
  }

  function edges(D, L) {
    const kinds = EDGE[D.fam] || EDGE.h;
    const wide = (tx, ty, dx, dy) => { for (let k = 1; k <= 4; k++) if (L.solid(tx + dx * k, ty + dy * k)) return false; return true; };
    for (let ty = 1; ty < L.th - 1; ty++) for (let tx = 1; tx < L.tw - 1; tx++) {
      if (L.solid(tx, ty) || (L.route && L.route[L.idx(tx, ty)])) continue;
      const north = L.solid(tx, ty - 1), west = L.solid(tx - 1, ty), east = L.solid(tx + 1, ty);
      if (!(north || west || east)) {
        if (D.r() < 0.018) D.put(D.key(D.fam === 'm' ? D.pick(['patch', 'shrub', 'flower', 'flower']) : D.fam === 'c' ? D.pick(['shrub', 'mushroom', 'bones', 'decal']) : D.fam === 'f' ? 'patch' : 'decal'), tx * TS + 16, ty * TS + 20, { a: 0.85 }); // stains, cracks, patches (snow drifts in the Frozen Kingdom: its runes lie where they mean something)
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

  /* the sweep (PLAN.md 21, request 3): this stage's fifth of every pool of its families that the scenes did not use
     is placed now, each kind in a group of its own (a row of graves, a heap of crates, stains on a floor) in a room of
     its own, so every piece of the packs shows somewhere in the biome's five stages */
  /* the kinds the sweep leaves alone: walls and floors show them (faces, corners, doors, windows, hangings, ground),
     the sky and the belly place theirs by hand (js/sky.js), snow is drawn with the particles (js/atmos.js) */
  const NOSWEEP = { face: 1, ground: 1, skip: 1, particle: 1, cloud: 1, dragon: 1, ladder: 1, falls: 1, landmark: 1, door: 1, window: 1, corner: 1, mawdoor: 1, hang: 1, heart: 1, worm: 1, pond: 1, lake: 1, ripple: 1, tiles: 1, plaque: 1, torch: 1 };
  SP.NOSWEEP = NOSWEEP;
  const BONES = ['bones', 'bonepile', 'skeleton', 'corpse', 'chasm', 'carcass', 'decal', 'scrawl'];
  const GRAVE = ['grave', 'opengrave', 'coffin', 'crypt', 'statue', 'smallstatue', 'obelisk', 'candles', 'lich', 'deadtree', 'fence'].concat(BONES);
  const RITE = ['altar', 'candles', 'crystal', 'item', 'pot', 'shelf', 'table', 'cauldron', 'smallstatue', 'obelisk', 'portal', 'throne', 'plate', 'decal', 'scrawl', 'hang', 'banner'];
  const STORE = ['crate', 'barrel', 'sack', 'case', 'pack', 'item', 'pot', 'bin', 'trash', 'pallet', 'toxbarrel', 'debris', 'tires', 'dumpster', 'shelf', 'table', 'chair', 'anvil', 'stall', 'cage'];
  const GREEN = ['tree', 'darktree', 'pillar', 'pot', 'bigtree', 'deadtree', 'shrub', 'flower', 'mushroom', 'tuft', 'weed', 'rock', 'boulder', 'stump', 'log', 'growth', 'patch', 'pond', 'lake', 'shore'];
  const SEA = ['coral', 'urchin', 'anemone', 'weed', 'tentacle', 'kraken', 'leviathan', 'rock', 'boulder', 'debris', 'patch', 'bubble', 'tuft'].concat(BONES);
  const STREET = ['car', 'carv', 'cone', 'barricade', 'sandbag', 'tires', 'streetbit', 'sign', 'pole', 'lamp', 'bench', 'bin', 'trash', 'debris', 'plaque', 'fence', 'wire', 'shambler', 'dumpster', 'flood', 'signpost', 'decal', 'plate'];
  const VILLAGE = ['wall', 'barrel', 'crate', 'sack', 'log', 'stump', 'bench', 'well', 'fence', 'lamp', 'signpost', 'table', 'hut', 'house', 'stall', 'cauldron', 'campfire', 'pole', 'banner', 'roof', 'bridge', 'cage', 'patch', 'carv'];
  const STONE = ['pillar', 'statue', 'smallstatue', 'obelisk', 'block', 'banner', 'brazier', 'throne', 'plate', 'rug', 'room', 'wall', 'rubble', 'castle', 'cliff', 'spike'];
  const PURPOSE = {
    ossuary: BONES.concat(['coffin', 'cage', 'pot', 'candles', 'statue']), crypt: GRAVE, boneyard: GRAVE, graveyard: GRAVE, cemetery: GRAVE, gallows: GRAVE.concat(['cage', 'pole', 'signpost']),
    alchemy: RITE, occult: RITE, ritual: RITE, shrine: RITE, ward: ['bed', 'cage', 'chair', 'table', 'shelf', 'pot', 'item', 'decal', 'scrawl', 'corpse', 'machine', 'trap'],
    torture: ['cage', 'trap', 'table', 'chair', 'bed', 'hang', 'spikes', 'wire', 'machine'].concat(BONES), storage: STORE, yard: STORE, market: STORE.concat(['stall', 'lamp', 'banner']), armory: STORE.concat(['block', 'statue']),
    forge: ['anvil', 'cauldron', 'block', 'crate', 'barrel', 'firebarrel', 'brazier', 'lavarock', 'rock', 'debris'], lava: ['lavarock', 'geyser', 'firetrap', 'spike', 'lava', 'boulder', 'rock', 'debris', 'ashes'], lavahall: ['lavarock', 'geyser', 'firetrap', 'lava', 'spike'].concat(STONE),
    hall: STONE, throne: STONE, castle: STONE, statues: STONE.concat(['crystal']), crystals: ['crystal', 'rock', 'boulder', 'spike', 'rubble'], ruin: ['wall', 'rubble', 'pillar', 'debris', 'rock', 'statue', 'smallstatue', 'boulder'],
    garden: GREEN, grove: GREEN, drowned: SEA, toxic: ['toxbarrel', 'reactor', 'pipestand', 'pool', 'machine', 'crystal', 'pipe', 'barrel'],
    street: STREET, gstreet: STREET.concat(['carv']), wreck: STREET, quarantine: STREET,
    cabin: VILLAGE, townhouse: VILLAGE, frozentown: VILLAGE, wintercamp: VILLAGE, well: VILLAGE, camp: ['crate', 'barrel', 'sack', 'item', 'pack', 'bones', 'skeleton', 'cage', 'banner', 'spikes', 'fence'],
    isle_grove: GREEN.concat(['crystal', 'debris']), isle_ruin: ['ruin', 'statue', 'obelisk', 'boulder', 'rock', 'item', 'machine', 'reactor', 'debris', 'tuft'], isle_crystal: ['crystal', 'machine', 'reactor', 'rock', 'debris', 'item', 'tuft'],
    bosshall: ['pillar', 'statue', 'brazier', 'bones', 'decal', 'machine', 'cell', 'pustule', 'tentacle', 'spike', 'growth', 'vein', 'plate', 'statue', 'reactor', 'crystal', 'rock', 'debris'],
  };
  SP.PURPOSE = PURPOSE;
  function sweep(D, L, force) {
    if (!force && (L.bossHall || L.interior)) return;
    const CO = CH.Compose;
    const used = new Set();
    for (const p of L.props) if (p.sheet) used.add(p.sheet);
    for (const d of L.decals) if (d.key) used.add(d.key);
    const walls = new Set(CH.Walls ? CH.Walls.keysOf(D.biome) : []);
    const rooms = L.rooms.filter((rm) => !rm.landmark && rm.tag !== 'start' && rm.tag !== 'exit' && (force || rm.tag !== 'hall') && rm.tag !== 'town');
    if (!rooms.length || !CO) return;
    const kinds = PR.kinds(D.fams);
    if (D.fams.includes('o')) for (const k of Object.keys(OBJ)) if (!kinds.includes(k)) kinds.push(k);
    // what this stage owes: its fifth of every pool (all of it in a biome of one stage)
    const owed = [];
    for (const kind of kinds) {
      if (NOSWEEP[kind] || (PR.KIND[kind] && PR.KIND[kind].skip)) continue;
      let pool = PR.pool(kind, D.fams);
      if (D.fams.includes('o') && OBJ[kind]) pool = pool.concat(OBJ[kind].filter((k) => S.has(k)));
      pool = pool.filter((k) => !walls.has(k)); // a wall's own pieces go on its walls
      if (!pool.length) continue;
      const dk = D.deckOf(kind, pool), share = SP.SINGLE[D.biome] ? dk.len : Math.ceil(dk.len / 5);
      for (let i = 0; i < share; i++) { const k = dk.order[(dk.start + i) % dk.len]; if (!used.has(k) && !owed.some((q) => q[0] === k)) owed.push([k, kind]); }
    }
    // laid kind by kind, so a room gets a run of one kind (a row of coffins, a corner of bones), rooms in turn
    let ri = Math.floor(D.r() * rooms.length);
    const failed = [];
    for (const [k, kind] of owed) {
      let done = false;
      // a room takes a few of a kind, not a crowd of them (PLAN.md 22): three, five of the things that come in rows
      const cap = { coffin: 5, grave: 5, opengrave: 5, crate: 5, barrel: 5, shelf: 4, bed: 4, pillar: 6, tree: 6, deadtree: 6, shrub: 5 }[kind] || 3;
      const fit = rooms.filter((rm) => PURPOSE[rm.purpose] && PURPOSE[rm.purpose].includes(kind) && ((rm._kc && rm._kc[kind]) || 0) < cap);
      for (let t = 0; t < fit.length && !done; t++) {
        const rm = fit[(ri + t) % fit.length];
        if (FLAT[kind]) done = CO.place(D, L, rm, k, kind, { side: 'flat' });
        else done = CO.place(D, L, rm, k, kind);
        if (done) { used.add(k); const p = L.props[L.props.length - 1]; if (p && p.sheet === k) p.swept = true; rm._kc = rm._kc || {}; rm._kc[kind] = (rm._kc[kind] || 0) + 1; }
      }
      if (!done) failed.push([k, kind]);
      // the next kind starts in the next room
      if (!owed[owed.indexOf(owed.find((q) => q[0] === k)) + 1] || owed[owed.indexOf(owed.find((q) => q[0] === k)) + 1][1] !== kind) ri++;
    }
    // what found no slot of its own, kind by kind (PLAN.md 22): the second row of a room that takes it; long pieces (fences,
    // walls, barricades) a straight run across open ground; the rest a grove of its kind on open ground (a stand of trees,
    // a field of rocks, a ruin); never one piece alone in the open
    const LINE = { fence: 1, wall: 1, wire: 1, barricade: 1, sandbag: 1, castle: 1, cliff: 1, spikes: 1 };
    const groups = {};
    for (const [k, kind] of failed) (groups[kind] = groups[kind] || []).push(k);
    const groveAt = (w, h) => { // open ground off the route, clear of the rooms
      for (let t = 0; t < 500; t++) {
        const cx = 3 + Math.floor(D.r() * (L.tw - 6)), cy = 3 + Math.floor(D.r() * (L.th - 6));
        if (!openGround(L, cx, cy, w, h) || L.rooms.some((rm) => rm.landmark && U.dist(rm.cx, rm.cy, cx * TS, cy * TS) < 200)) continue;
        return { x: cx * TS + 16, y: cy * TS + 28 };
      }
      return null;
    };
    const missed = [];
    for (const kind of Object.keys(groups)) {
      let keys = groups[kind];
      // the second row of a room of its purpose
      const fit = rooms.filter((rm) => PURPOSE[rm.purpose] && PURPOSE[rm.purpose].includes(kind));
      keys = keys.filter((k) => { for (const rm of fit) if (CO.place(D, L, rm, k, kind, { inner: true })) { used.add(k); return false; } return true; });
      if (!keys.length) continue;
      if (LINE[kind]) { // a straight run across open ground, its pieces touching
        while (keys.length) {
          const at = groveAt(Math.min(8, keys.length * 2), 2);
          if (!at) break;
          const run = keys.splice(0, 6);
          let x = at.x - run.length * 18;
          const join = 'sw' + x;
          for (const k of run) { const nm = PR.sprite(k), w = nm && S.has(nm) ? S.get(nm).w : 30; const p = D.put(k, x + w / 2, at.y, { join }); if (p) { used.add(k); x += w - 3; } else missed.push(k); }
        }
        missed.push(...keys);
        continue;
      }
      while (keys.length) { // a grove of its kind
        const at = groveAt(3, 3);
        if (!at) break;
        const blob = keys.splice(0, 9);
        blob.forEach((k, i) => {
          for (let t = 0; t < 6; t++) {
            const a2 = (i + t * 0.37) * 2.39996, d = 21 * Math.sqrt(i + t * 0.5);
            const p = D.put(k, at.x + Math.cos(a2) * d * 1.3, at.y + Math.sin(a2) * d);
            if (p) { used.add(k); return; }
          }
          missed.push(k);
        });
      }
      missed.push(...keys);
    }
    for (const k of missed) {
      const kind = PR.kindOf(k) || (OBJ && Object.keys(OBJ).find((q) => OBJ[q].includes(k))) || 'debris';
      let done = false;
      for (let t = 0; t < rooms.length && !done; t++) done = CO.place(D, L, rooms[(ri + t) % rooms.length], k, kind, { side: 'corner', inner: true });
      // beside a piece of its kind already standing (a ruin by a ruin, a tree in a stand of trees), then on any open patch
      const kin = FLAT[kind] ? [] : L.props.filter((q) => !q.dead && (PR.kindOf(q.sheet || q.sprite) === kind || (OBJ[kind] && OBJ[kind].includes(q.sprite))));
      for (let t = 0; t < 40 && !done && kin.length; t++) { const q = kin[t % kin.length], a = D.r() * Math.PI * 2, d = 34 + D.r() * 40; done = !!D.put(k, q.x + Math.cos(a) * d, q.y + Math.sin(a) * d * 0.7); }
      for (let t = 0; t < 300 && !done && !FLAT[kind]; t++) {
        const tx = 2 + Math.floor(D.r() * (L.tw - 4)), ty = 2 + Math.floor(D.r() * (L.th - 4));
        if (openGround(L, tx, ty, 1, 1)) done = !!D.put(k, tx * TS + 16, ty * TS + 24);
      }
      if (done) { used.add(k); continue; }
      // a filled square cannot lie on a floor as a decal: it is laid into the floor as an inlay instead
      if (FLAT[kind] && /^(kit|sh)\./.test(k)) { (L.inlays = L.inlays || []).push(...inlaySpots(D, L, [k])); used.add(k); }
    }
    L.sweepMissed = failed.map(([k]) => k).filter((k) => !used.has(k)); // what found no place at all (t60 checks it is empty)
  }
  /* floor inlays (PLAN.md 22): this stage's fifth of every floor swatch of its biome (all of them where the biome has one
     stage) laid, feathered, on open ground, so the five stages show every swatch of their floor sheets */
  function inlaySpots(D, L, keys) {
    const out = [];
    for (const key of keys) {
      for (let t = 0; t < 600; t++) {
        const tx = 1 + Math.floor(D.r() * (L.tw - 2)), ty = 1 + Math.floor(D.r() * (L.th - 2));
        if (L.cell(tx, ty) !== 0 || L.cell(tx + 1, ty) !== 0 || L.cell(tx, ty + 1) !== 0) continue;
        const gap = t < 200 ? 96 : t < 400 ? 56 : 36; // apart if there is room, closer when the floor is full
        if ((L.inlays || []).concat(out).some((q) => Math.abs(q.x - tx * TS) < gap && Math.abs(q.y - ty * TS) < gap)) continue;
        out.push({ x: tx * TS + Math.floor(D.r() * 16), y: ty * TS + Math.floor(D.r() * 16), key: key.replace(/^kit\./, '') });
        break;
      }
    }
    return out;
  }
  function floorInlays(D, L) {
    const st = L.style;
    if (!st || st.floor !== 'kit') return;
    CH.Level.resolveMats(st);
    if (!st.mats || st.floor !== 'kit') return;
    const all = [];
    for (const m of Object.keys(st.mats)) if (m !== 'big' && st.mats[m].base) for (const k of st.mats[m].base.concat(st.mats[m].acc)) if (!all.includes(k)) all.push(k);
    if (!all.length) return;
    const dk = D.deckOf('floor', all), share = SP.SINGLE[D.biome] ? dk.len : Math.ceil(dk.len / 5);
    const owe = [];
    for (let i = 0; i < share; i++) owe.push(dk.order[(dk.start + i) % dk.len]);
    (L.inlays = L.inlays || []).push(...inlaySpots(D, L, owe));
  }
  /* solid scenery must not wall off anything the run needs: walk the flow field from the entrance and drop the
     set-piece props nearest to anything unreachable, until everything is */
  function keepReachable(L) {
    const targets = [L.exit].concat(L.spawners, L.packs, L.chests.filter((c) => !c.secret), L.shrines, L.waypoints);
    const removed = [];
    for (let pass = 0; pass < 40; pass++) {
      L.flows.clear();
      const f = L.flowFor(L.entrance.x, L.entrance.y);
      const bad = targets.find((t) => f.dist[L.idx(Math.floor(t.x / TS), Math.floor(t.y / TS))] < 0);
      if (!bad) break;
      // where the way is cut: walk from it toward the entrance by the walls alone; the props round the first tiles the
      // heroes can reach from the entrance are the ones in the way (the nearest to it may be far from the cut)
      const props = L.props;
      L.props = [];
      L.flows.clear();
      const fc = L.flowFor(L.entrance.x, L.entrance.y);
      L.props = props;
      let tx = Math.floor(bad.x / TS), ty = Math.floor(bad.y / TS), cut = { x: bad.x, y: bad.y };
      for (let i = 0; i < 3000 && fc.dist[L.idx(tx, ty)] > 0; i++) {
        if (f.dist[L.idx(tx, ty)] >= 0) break;
        cut = { x: (tx + 0.5) * TS, y: (ty + 0.5) * TS };
        let nb = null, nd = fc.dist[L.idx(tx, ty)];
        for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) { const d = L.inb(tx + ox, ty + oy) ? fc.dist[L.idx(tx + ox, ty + oy)] : -1; if (d >= 0 && d < nd) { nd = d; nb = [tx + ox, ty + oy]; } }
        if (!nb) break;
        [tx, ty] = nb;
      }
      let best = null, bd = 1e9;
      for (const p of L.props) {
        if (!p.sp || !p.solid || p.dead || p.keep) continue;
        const d = Math.min(U.dist(p.x, p.y, bad.x, bad.y), U.dist(p.x, p.y, cut.x, cut.y) - (p.box ? p.box.hw : 0)) + (p.kits ? 400 : 0) - (p.swept ? 300 : 0); // a built cabin or townhouse goes last, a swept piece first
        if (d < bd) { bd = d; best = p; }
      }
      if (!best) break;
      L.props.splice(L.props.indexOf(best), 1);
      removed.push(best);
    }
    // no long way round (PLAN.md 22): a doorway or a corridor that props have shut sends walkers the long way, or boxes a
    // hero into a pocket. From the worst-off tile, walking toward the entrance by the walls alone, the prop on the first
    // tile of that short way that it blocks goes; again until no tile is more than a few steps further than the walls make it
    const fc = wallsOnly(L), skip = new Set();
    for (let pass = 0; pass < 80; pass++) {
      L.flows.clear();
      const f = L.flowFor(L.entrance.x, L.entrance.y);
      const w = detour(L, f.dist, fc, skip);
      if (w < 0) break;
      let tx = w % L.tw, ty = (w / L.tw) | 0, hit = null;
      for (let i = 0; i < 3000 && fc[L.idx(tx, ty)] > 0; i++) {
        if (f.dist[L.idx(tx, ty)] < 0) { hit = { x: (tx + 0.5) * TS, y: (ty + 0.5) * TS }; break; }
        let nb = null, nd = fc[L.idx(tx, ty)];
        for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
          if (ox && oy && (L.solid(tx + ox, ty) || L.solid(tx, ty + oy))) continue; // no cutting a corner of rock (the walk cannot)
          const d = L.inb(tx + ox, ty + oy) ? fc[L.idx(tx + ox, ty + oy)] : -1;
          if (d >= 0 && d < nd) { nd = d; nb = [tx + ox, ty + oy]; }
        }
        if (!nb) break;
        [tx, ty] = nb;
      }
      let best = null, bd = 1e9;
      if (hit) for (const p of L.props) {
        if (!p.solid || p.dead || p.keep || p.kits) continue;
        const d = Math.max(Math.abs(p.x + (p.cx || 0) - hit.x) - (p.box ? p.box.hw : p.cr || 10), Math.abs(p.y + (p.cy || 0) - hit.y) - (p.box ? p.box.hh : p.cr || 10));
        if (d < bd) { bd = d; best = p; }
      }
      if (!best || bd > 16) { // what blocks it stays (a pond, the tower, a built house): leave that part be, look at the rest
        const wx = w % L.tw, wy = (w / L.tw) | 0;
        for (let oy = -8; oy <= 8; oy++) for (let ox = -8; ox <= 8; ox++) if (L.inb(wx + ox, wy + oy)) skip.add(L.idx(wx + ox, wy + oy));
        continue;
      }
      L.props.splice(L.props.indexOf(best), 1);
      removed.push(best);
    }
    L.flows.clear();
    removed.fc = fc;
    return removed;
  }
  /* each tile's walk from the entrance by the walls alone (no props) */
  function wallsOnly(L) {
    const props = L.props;
    L.props = [];
    L.flows.clear();
    const d = L.flowFor(L.entrance.x, L.entrance.y).dist.slice();
    L.props = props;
    L.flows.clear();
    return d;
  }
  /* the tile the props make the worst detour to (more than 12 steps longer than the walls alone make it), or -1 */
  function detour(L, a, fc, skip) {
    let worst = 12, wi = -1;
    for (let i = 0; i < a.length; i++) if (a[i] >= 0 && fc[i] >= 0 && a[i] - fc[i] > worst && !(skip && skip.has(i))) { worst = a[i] - fc[i]; wi = i; }
    return wi;
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
    CH.Actor.fadeHit(this, dt);
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
  // for the stages of js/sky.js: their scenes, landmarks and lore join these
  SP.FIELD = FIELD; SP.EDGE = EDGE; SP.OBJ = OBJ; SP.inlaySpots = inlaySpots; SP.floorInlays = floorInlays;
  SP.SCENE = SCENE; SP.SCENES = SCENES; SP.LANDMARK = LANDMARK; SP.LORE = LORE; SP.FAM = FAM; SP.ALT = ALT; SP.sweep = sweep;
})(window.CH);
