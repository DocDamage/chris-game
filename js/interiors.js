/* CHAOS.exe - going inside (PLAN.md 19, W4). The cabins of the Dead Wood, the townhouses of the Gaslight District and the
   houses of the Frozen Kingdom have a door: walk into it and you are in a room of their own, furnished from the packs
   (a cabin: rough tables, barrels, a bed, bones; a townhouse: Victorian sofas, shelves, a fireplace, a clock; a frozen
   house: racks, crates, a stove), with a chest (opened once, kept with the area) and now and then someone waiting.
   Walk back to the door and you are outside where you went in; the stage outside is held as it was meanwhile.
   A building's room is built from the world seed, the area and the building's place, so it is the same each visit. */
(function (CH) {
  'use strict';
  const G = CH.G;
  const U = CH.U;
  const FX = CH.FX;
  const Audio = CH.Audio;
  const Level = CH.Level;
  const TS = Level.TS;

  const IN = (CH.Interiors = { outside: null, room: null });

  /* what a kind of building holds: furniture kinds along the walls and in the middle, and whose pieces */
  const KINDS = {
    cabin: { fam: 'c', alt: 'h', walls: ['shelf', 'barrel', 'crate', 'hang', 'table'], mid: ['table', 'chair', 'bench'], bed: 1, extra: ['bones', 'debris', 'candles'], foes: 0.35 },
    house: { fam: 'g', alt: 'h', walls: ['shelf', 'sofa', 'shelf', 'machine', 'hang'], mid: ['table', 'chair', 'sofa'], bed: 1, extra: ['item', 'candles', 'rug'], foes: 0.25 },
    hut: { fam: 'f', alt: 'a', walls: ['barrel', 'shelf', 'crate', 'table', 'sack'], mid: ['table', 'bench', 'cauldron'], bed: 0, extra: ['debris', 'item', 'candles'], foes: 0.3 },
    // a sealed vault behind a door in a dungeon's wall (PLAN.md 22): statues and braziers round a treasure, guarded
    vault: { fam: 'a', alt: 'h', walls: ['statue', 'pillar', 'case', 'statue', 'crate'], mid: ['altar', 'candles', 'candles'], bed: 0, extra: ['bones', 'item', 'debris'], foes: 0.85, tier: 3 },
  };

  /* the room: 15 x 10 tiles of floor, the door in the middle of the south wall; solid rock round it so the camera can
     keep the room in the middle of the screen */
  const OX = 6, OY = 2;
  IN.build = function (b, seed) {
    const K = KINDS[b.enter] || KINDS.cabin;
    const L = new Level(17 + OX * 2, 13 + OY * 2, 'catacombs');
    const X = (t) => (t + OX) * TS, Y = (t) => (t + OY) * TS; // room tiles to world px
    L.style = Object.assign({}, L.style, { mats: { dirt: { base: ['da1.18', 'da1.19', 'da1.45'], acc: ['da1.20', 'da1.46', 'da1.47'] }, moss: { base: ['da1.18'], acc: ['da1.21'] }, roots: { base: ['da1.45'], acc: ['da1.48'] }, rust: { base: ['da1.19'], acc: ['da1.22'] }, stone: { base: ['da1.46'], acc: ['da1.49'] }, swamp: { base: ['da1.45'], acc: ['da1.50'] } } });
    L.interior = true;
    L.name = b.enter === 'house' ? 'A Townhouse' : b.enter === 'hut' ? 'A Frozen House' : b.enter === 'vault' ? 'A Sealed Vault' : 'A Cabin';
    L.carveRect(1 + OX, 1 + OY, 15, 10);
    L.rooms = [{ x: 1 + OX, y: 1 + OY, w: 15, h: 10, cx: X(8.5), cy: Y(6), deg: 1, id: 0, tag: 'inside' }];
    L.entrance = { x: X(8.5), y: Y(10) };
    L.exit = { x: -9999, y: -9999, open: false, room: 0 };
    L.door = { x: X(8.5), y: Y(10.6) };
    L.waypoints = []; L.spawners = []; L.packs = []; L.shrines = []; L.secrets = []; L.puddles = []; L.decals = [];
    L.explored.fill(1);
    L.hives = [];
    L.hivesNeeded = 0;
    L.opened = true; // (not areaReady: js/areas.js keeps the stage outside, not this room)
    const r = U.seeded(seed >>> 0);
    L.chests = [{ x: X(r() < 0.5 ? 3 : 14), y: Y(3), opened: !!b.looted, id: 0, room: 0, tier: 2 + (K.tier || 0) + Math.round(G.tier ? G.tier() : 1), inside: true }];
    const D = CH.SetPieces.Dresser(L, 'catacombs');
    D.fam = K.fam;
    D.alt = K.alt;
    D.r = r;
    D.reserve(L.entrance.x, L.entrance.y, 40);
    D.reserve(L.chests[0].x, L.chests[0].y, 24);
    // along the back wall, the side walls, a table and chairs in the middle, a bed in a corner, the things lying about
    for (let x = X(2.5); x < X(14.5); x += 44) D.put(D.key(D.pick(K.walls)), x, Y(2.6));
    for (const sx of [1.8, 15.2]) for (let y = Y(4.5); y < Y(9); y += 50) if (r() < 0.7) D.put(D.key(D.pick(K.walls)), X(sx), y);
    D.put(D.key(K.mid[0]), X(8.5), Y(5.6));
    for (const sg of [-1, 1]) D.put(D.key(D.pick(K.mid.slice(1))), X(8.5) + sg * 40, Y(5.8));
    if (K.bed) D.put(D.key('bed', 'h') || D.key('bed'), X(r() < 0.5 ? 3.5 : 13.5), Y(8.5));
    D.put(D.key('lantern') || D.key('candles'), X(5), Y(6));
    D.scatter(D.pick(K.extra), X(8.5), Y(7), 120, 4);
    D.scatter('decal', X(8.5), Y(7), 140, 2);
    CH.Props.invalidate();
    // someone waiting, now and then
    L.waiting = r() < K.foes ? 2 + Math.floor(r() * 3) : 0;
    return L;
  };

  /* going in: the stage outside is held exactly as it was */
  IN.enter = function (b, p) {
    const O = G.level;
    if (!O || O.interior || IN.outside) return;
    const W = CH.Areas && CH.Areas.world();
    const idx = b.vi !== undefined ? 1000 + b.vi : O.props.indexOf(b); // a vault is a door in the wall, not a prop
    const seed = ((W ? W.seed : 1) + (O.stage || 0) * 7919 + idx * 131) >>> 0;
    const st = W && W.areas[O.stage];
    b.looted = !!(st && st.inside && st.inside.includes(idx));
    IN.outside = { weather: CH.Atmos ? CH.Atmos.mode : null, L: O, enemies: G.enemies.slice(), pickups: G.pickups.slice(), ground: CH.Items ? CH.Items.ground.slice() : [], pos: G.players.map((q) => ({ x: q.x, y: q.y })), b, idx };
    const L = IN.build(b, seed);
    L.stage = O.stage;
    G.level = L;
    G.arena = L;
    G.enemies = [];
    G.pickups = [];
    if (CH.Items) CH.Items.ground.length = 0;
    G.projectiles.length = 0;
    G.zones.length = 0;
    G.players.forEach((q, i) => { q.x = L.entrance.x + i * 18; q.y = L.entrance.y - 34; q.vx = q.vy = q.kx = q.ky = 0; });
    for (let i = 0; i < L.waiting; i++) {
      const mobs = CH.LevelGen.MOBS[O.biome] || ['slime'];
      const q = L.randomNear(L.rooms[0].cx, L.rooms[0].cy - 48, 0, 80, 14) || { x: L.rooms[0].cx, y: L.rooms[0].cy - 48 };
      const e = G.spawnEnemy(U.pick(mobs), q.x, q.y, { elite: i === 0 });
      if (e) e.spawnSilent = true;
    }
    if (CH.Atmos) CH.Atmos.setMode('none'); // no rain or fog under a roof
    G.snapCamera();
    Audio.sfx('door_open');
    G.banner(L.name.toUpperCase(), L.waiting ? 'You are not alone.' : 'Quiet. Too quiet.', 1.8);
  };
  IN.leave = function () {
    const o = IN.outside;
    if (!o) return;
    const L = G.level;
    // the chest, once opened, stays opened for this building
    const W = CH.Areas && CH.Areas.world();
    if (W && L && L.chests[0] && L.chests[0].opened) {
      const st = W.areas[o.L.stage] || (W.areas[o.L.stage] = { visits: 1 });
      st.inside = st.inside || [];
      if (!st.inside.includes(o.idx)) st.inside.push(o.idx);
    }
    G.level = o.L;
    G.arena = o.L;
    G.enemies = o.enemies.filter((e) => !e.dead);
    G.pickups = o.pickups;
    if (CH.Items) { CH.Items.ground.length = 0; for (const g of o.ground) CH.Items.ground.push(g); }
    G.projectiles.length = 0;
    const d = o.b.door || { x: o.b.x, y: o.b.y + 4 };
    G.players.forEach((q, i) => { q.x = d.x + i * 16; q.y = d.y + 20; q.vx = q.vy = 0; });
    IN.outside = null;
    if (CH.Atmos && o.weather) CH.Atmos.setMode(o.weather);
    G.snapCamera();
    Audio.sfx('door_close');
    if (CH.Character) CH.Character.save();
  };

  /* the doors: the interact button goes in (js/interact.js); walking back out of the room's door, or the button, comes out */
  G.on('step', function () {
    const L = G.level;
    if (!L || G.state !== 'playing') return;
    if (IN.outside && !L.interior) { IN.outside = null; return; } // left some other way (died, a town portal)
    if (L.interior && L.door && IN.outside) {
      for (const p of G.players) if (!p.dead && U.dist(p.x, p.y + 12, L.door.x, L.door.y) < 22 && (p.vy > 0 || p.inp && p.inp.moveY > 0)) { IN.leave(); return; }
    }
  });
  IN.NAME = { house: 'TOWNHOUSE', hut: 'FROZEN HOUSE', vault: 'SEALED VAULT' };
  IN.nameOf = (b) => IN.NAME[b.enter] || 'CABIN';
  /* the door inside, and a hint at the doors outside */
  CH.Hooks.world.push((ctx, cam) => {
    const L = G.level;
    if (!L) return;
    if (L.interior && L.door) {
      const x = Math.round(L.door.x - cam.x), y = Math.round(L.door.y - cam.y);
      ctx.fillStyle = 'rgba(254,231,97,0.18)';
      ctx.fillRect(x - 18, y - 6, 36, 12);
      CH.Font.draw(ctx, 'OUT', x, y - 4, '#b9b4c8', 1, true);
      return;
    }
    if (L.isTown || !L.props) return;
    const p = G.player;
    if (!p) return;
    // a warm light spills from under the doors you can open (the prompt itself is js/interact.js)
    for (const b of L.props) {
      if (!b.enter || b.dead) continue;
      const d = b.door || { x: b.x, y: b.y + 4 };
      const dd = U.dist(p.x, p.y, d.x, d.y);
      if (dd > 140) continue;
      const x = Math.round(d.x - cam.x), y = Math.round(d.y - cam.y);
      const gr = ctx.createRadialGradient(x, y, 1, x, y, 22);
      gr.addColorStop(0, 'rgba(255,214,120,' + (0.32 * (1 - dd / 140)) + ')');
      gr.addColorStop(1, 'rgba(255,214,120,0)');
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = gr;
      ctx.fillRect(x - 22, y - 12, 44, 24);
      ctx.globalCompositeOperation = 'source-over';
    }
  });
  G.on('newRun:before', function () { IN.outside = null; });
})(window.CH);
