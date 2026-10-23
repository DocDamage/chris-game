/* CHAOS.exe - the hideout (the Safehouse Town) laid out as a place (PLAN.md section 15, request 5).
   It used to be four grey blocks, random bushes and props on a street texture. Now it is a walled camp:
     north street   a row of ruined houses with the vendor's stall, the stash keeper's store room and the smithy in
                    front of them, each furnished with what that trade needs
     plaza          a trodden square with the well, a campfire with benches; the elder sits under the notice board
     west yard      the sidekick trainer's fenced training ground (posts, crates, a cage)
     east circle    the waypoint keeper's stone circle with braziers
     south gate     the portal pad between sandbags and lamps; the path leads from it to the plaza and every stall
     corners        a giant tree with a garden, a store yard, a small graveyard of heroes past
   People are solid and use the Valley Ruin villager sprite; every prop here has collision (js/props.js). */
(function (CH) {
  'use strict';
  const U = CH.U;
  const S = CH.Sprites;
  const TS = CH.Level.TS;
  const Level = CH.Level;
  const Town = CH.Town;
  if (!Town || !CH.SetPieces) return;
  const HO = (CH.Hideout = {});

  /* where everybody stands (tiles) */
  const SPOTS = { vendor: [14, 11], stash: [22, 11], smith: [35, 11], elder: [28, 16], trainer: [10, 23], waypoint: [46, 23] };
  const PLAZA = [28, 23];
  const GATE = [28, 34];

  HO.build = function () {
    const L = new Level(56, 40, 'backyard');
    L.isTown = true;
    L.hideout = true;
    L.name = 'The Safehouse Town';
    L.tag = 'Prices are fixed. Haggling is not.';
    L.style = Object.assign({}, L.style);
    L.carveRect(3, 3, 50, 34);
    L.rooms = [{ x: 3, y: 3, w: 50, h: 34, cx: PLAZA[0] * TS, cy: PLAZA[1] * TS, deg: 0, id: 0, tag: 'town' }];
    L.entrance = { x: GATE[0] * TS + 16, y: (GATE[1] - 3) * TS };
    L.exit = { x: GATE[0] * TS + 16, y: GATE[1] * TS + 8, open: true, room: 0, town: true };
    L.waypoints = [];
    L.spawners = [];
    L.chests = [];
    L.shrines = [];
    L.packs = [];
    L.decals = [];
    const base = Town.NPCS || [];
    L.npcs = base.map((n) => {
      const s = SPOTS[n.id] || [n.x, n.y];
      return Object.assign({}, n, { x: s[0], y: s[1], px: s[0] * TS + 16, py: s[1] * TS + 16 });
    });
    L.explored.fill(1);
    L.fogDirty = true;

    // the trodden ground: plaza disc, the main road from the gate, a lane to every stall
    L.trail = new Uint8Array(L.tw * L.th);
    const mark = (tx, ty) => { if (L.inb(tx, ty) && !L.solid(tx, ty)) L.trail[L.idx(tx, ty)] = 2; };
    // a cross of roads: gate - plaza - north street, trainer - plaza - waypoint, short stubs to each stall
    for (let y = -3; y <= 3; y++) for (let x = -4; x <= 4; x++) if ((x * x) / 20 + (y * y) / 12 <= 1) mark(PLAZA[0] + x, PLAZA[1] + y);
    for (let y = 13; y <= GATE[1]; y++) mark(GATE[0], y);
    for (let x = SPOTS.trainer[0] + 2; x <= SPOTS.waypoint[0] - 2; x++) mark(x, PLAZA[1]);
    for (let x = 12; x <= 44; x++) mark(x, 13); // the north street
    for (const id of ['vendor', 'stash', 'smith']) { const s = SPOTS[id]; for (let y = s[1] + 1; y <= 13; y++) mark(s[0], y); }
    for (let y = SPOTS.elder[1] + 1; y <= PLAZA[1]; y++) mark(SPOTS.elder[0], y);

    const D = CH.SetPieces.Dresser(L, 'backyard');
    D.fam = 'm';
    D.alt = 'z';
    const px = (t) => t * TS + 16;
    const k = (kind, fam) => D.key(kind, fam);
    // people and gameplay spots stay clear
    for (const n of L.npcs) D.reserve(n.px, n.py + 6, 26);
    D.reserve(L.exit.x, L.exit.y, 40);
    D.reserve(L.entrance.x, L.entrance.y, 34);
    for (let y = PLAZA[1]; y <= GATE[1]; y += 2) D.reserve(px(GATE[0]) + 16, px(y), 18); // the main road

    /* north street: a row of ruined houses behind the stalls */
    const houses = PR_pool('wall', 'w', [0, 2, 3, 4, 7, 9, 11, 12, 15, 16]);
    let hx = px(7);
    let hi = 0;
    while (hx < px(49) && houses.length) {
      const p = D.put(houses[hi++ % houses.length], hx, px(7) + 10, { force: true });
      hx += p && p.box ? p.box.hw * 2 + 2 : 50;
    }
    // the vendor: a market stall (tables, goods, a lantern, a banner)
    const [vx, vy] = SPOTS.vendor.map(px);
    D.put(k('table', 'z'), vx - 34, vy - 2);
    D.put(k('table', 'z'), vx + 34, vy - 2);
    D.pile(vx - 60, vy - 26, ['crate', 'case', 'crate'], 3);
    D.put(k('lantern', 'w'), vx + 58, vy - 24);
    D.put(k('banner'), vx - 14, vy - 34);
    // the stash keeper: shelves and strongboxes
    const [sx, sy] = SPOTS.stash.map(px);
    for (const dx of [-44, -14, 16, 46]) D.put(D.pick(PR_pool('shelf', 'z')), sx + dx, sy - 30);
    D.pile(sx + 52, sy + 2, ['case', 'case', 'crate'], 3);
    D.put(k('case', 'w'), sx - 50, sy + 2);
    // the smithy: anvil, grindstone, a forge, ore and barrels
    const [mx, my] = SPOTS.smith.map(px);
    D.put('sh.v_misc.24', mx - 30, my + 4); // anvil
    D.put('sh.v_misc.25', mx + 30, my + 4); // grindstone
    D.put('sh.v_decor.14', mx - 56, my - 26); // the forge
    D.put(k('brazier', 'v'), mx + 56, my - 24);
    for (const [i, key] of [[0, 'sh.v_misc.14'], [1, 'sh.v_misc.16'], [2, 'sh.v_misc.15']]) D.put(key, mx - 12 + i * 14, my - 24);
    D.pile(mx + 70, my + 10, ['barrel', 'barrel', 'crate'], 3);

    /* plaza: the well, the campfire and its benches, the elder's notice board and table */
    const [cx, cy] = PLAZA.map(px);
    D.put('sh.v_env.40', cx - 46, cy - 4, { force: true }); // well
    D.put('sh.h_statues.3', cx, cy - 34, { force: true }); // a statue of the first hero, in the middle of the square
    for (const [dx, dy] of [[-112, -54], [112, -54], [-112, 60], [112, 60]]) D.put('sh.z_street.4', cx + dx, cy + dy); // lamps at the corners
    D.put(k('bench', 'z'), cx - 60, cy + 40);
    D.pile(cx - 96, cy + 18, ['crate', 'barrel', 'sack'], 3); // market goods
    const fire = CH.Fires && CH.Fires.place(L.props, cx + 52, cy + 24, 'amber', true);
    if (fire) fire.sp = true;
    D.put(k('bench', 'z'), cx + 52, cy - 6);
    D.put(k('log'), cx + 88, cy + 26);
    D.put(k('log'), cx + 22, cy + 40);
    const [ex, ey] = SPOTS.elder.map(px);
    D.put('sh.z_furniture.8', ex, ey + 14, { force: true }); // rug
    D.put('sh.z_furniture.11', ex + 40, ey + 6); // the map table
    D.put('sh.z_furniture.2', ex + 72, ey + 4); // a chair
    D.put('sh.v_misc.51', ex - 40, ey - 6); // the notice board signpost
    D.put(k('candles', 'h'), ex - 26, ey + 18);
    for (const key of ['sh.h_occult.1', 'sh.h_occult.3']) D.near(key, ex + 40, ey - 12, 10);

    /* west: the trainer's yard, fenced, posts to hit, crates and a cage */
    const [tx, ty] = SPOTS.trainer.map(px);
    const fence = 'sh.v_env.33';
    for (let x = tx - 70; x <= tx + 70; x += 46) { D.put(fence, x, ty - 64); D.put(fence, x, ty + 66); }
    for (let y = ty - 30; y <= ty + 40; y += 34) D.put(fence, tx - 92, y);
    for (const [dx, dy] of [[-40, -20], [40, -20], [-40, 34], [44, 36]]) D.put(D.pick(['sh.v_misc.54', 'sh.v_misc.55']), tx + dx, ty + dy);
    D.put(k('cage', 'v'), tx - 60, ty + 36);
    const tf = CH.Fires && CH.Fires.place(L.props, tx + 20, ty + 8, 'amber', true); // a fire to warm the recruits
    if (tf) tf.sp = true;
    D.pile(tx + 64, ty - 36, ['crate', 'sack'], 2);

    /* east: the waypoint keeper's stone circle */
    const [wx, wy] = SPOTS.waypoint.map(px);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + 0.3; D.put(D.pick(['sh.h_struct.0', 'sh.h_struct.1', 'sh.h_struct.11', 'sh.v_env.21']), wx + Math.cos(a) * 66, wy + 8 + Math.sin(a) * 44); }
    for (const s of [-1, 1]) D.put(k('brazier', 'v'), wx + s * 30, wy - 26);
    const wf = CH.Fires && CH.Fires.place(L.props, wx, wy + 22, 'cyan', false); // the waypoint fire burns blue
    if (wf) wf.sp = true;
    D.put(k('obelisk', 'h'), wx, wy - 40);

    /* the gate: sandbags and lamps either side of the portal, barricades closing the gaps */
    const [gx, gy] = [px(GATE[0]) + 16, px(GATE[1])];
    for (const s of [-1, 1]) {
      D.put('sh.z_barricades.0', gx + s * 70, gy - 6, { force: true });
      D.put('sh.z_barricades.19', gx + s * 112, gy - 6, { force: true });
      D.put('sh.z_street.4', gx + s * 44, gy - 20, { force: true });
      D.put(k('spikes', 'w'), gx + s * 156, gy - 10);
    }
    // lamps along the road
    for (let y = GATE[1] - 4; y > PLAZA[1] + 4; y -= 4) D.put('sh.z_street.4', gx + (y % 8 ? 46 : -46), px(y));

    /* corners */
    const giant = S.has('obj.giantTree') ? 'obj.giantTree' : null;
    if (giant) { // the giant tree shades the garden in the south-west
      CH.Arenas.addProp(L.props, giant, px(9), px(33), { kind: 'tree', solid: true, box: { hw: 16, hh: 6 }, cy: -5, swayable: true });
      L.props[L.props.length - 1].sp = true;
    }
    for (let x = px(13); x <= px(21); x += 40) D.put(fence, x, px(28)); // the garden fence
    D.scatter('flower', px(17), px(31), 70, 8);
    D.scatter('shrub', px(17), px(32), 60, 4);
    D.put(k('mushroom'), px(15), px(33));
    // the store yard, south-east
    D.pile(px(40), px(31), ['crate', 'barrel', 'case', 'sack'], 4);
    D.pile(px(44), px(33), ['crate', 'barrel', 'crate'], 3);
    D.put(k('firebarrel', 'w'), px(47), px(31));
    // the graveyard of heroes past, north-east corner beside the houses
    for (let i = 0; i < 4; i++) D.put(k('grave', 'v'), px(43) + i * 30, px(17) + (i % 2) * 6);
    D.put(k('candles', 'h'), px(45), px(19));
    D.put(k('deadtree'), px(50), px(18));
    // the edges of the camp: trees and shrubs against the hedges
    for (const [x, y] of [[5, 6], [51, 6], [5, 15], [51, 14], [5, 26], [51, 27], [24, 35], [33, 35]]) D.put(k(D.r() < 0.5 ? 'tree' : 'shrub'), px(x), px(y));

    /* the people block too */
    for (const n of L.npcs) {
      CH.Arenas.addProp(L.props, 'missing', n.px, n.py + 8, { solid: true, box: { hw: 8, hh: 5 }, cy: 0, kind: 'npc' });
      const p = L.props[L.props.length - 1];
      p.invisible = true;
      p.npc = n.id;
    }
    CH.Props.invalidate();
    return L;
  };
  function PR_pool(kind, fam, only) {
    const all = CH.Props.pool(kind, fam);
    if (!only) return all;
    const sheet = all.length ? all[0].split('.')[1] : '';
    const pick = all.filter((k) => only.includes(+k.split('.')[2]));
    return pick.length ? pick : all.filter((k) => k.split('.')[1] === sheet);
  }

  const orig = Town.build;
  Town.build = function () {
    if (!CH.Assets.meta || !CH.Assets.meta.sheets) return orig.call(Town); // no art bundle: the plain town
    return HO.build();
  };
})(window.CH);
