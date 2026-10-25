/* Hand-made stages (PLAN.md 23). A stage saved by the stage editor (js/editor.js) is played instead of the generator's:
   data/stages.js holds them as window.CH_STAGES = { '13': {...}, belly: {...} }, one entry per world area (1-49) and
   'belly' for the inside of the Final Tower.
   A stage keeps everything a level is made of: its cells, heights, stairs, bridges and trodden paths, its floor paint,
   decals and inlays, every prop as placed (its piece, spot, collision, animation and light), and its spots: the
   entrance, the exit, waypoints, breaches, monster packs, chests, shrines, secrets and lore. A prop not cut from a pack
   (a townhouse built from pieces, a camp's smoke) travels as an image. The walls' faces, mounts and lights are worked
   out again from the cells (js/walls.js), as for a generated stage. */
(function (CH) {
  const ST = (CH.Stages = {});
  const TS = 32;
  ST.VERSION = 1;
  ST.data = window.CH_STAGES || (window.CH_STAGES = {});
  ST.off = false; // tests and the editor's "play the generated one" turn the hand-made stages off

  /* ------------------------------------------------------------------ grids as runs: 'value*count,...' */
  ST.rle = function (a) {
    if (!a) return null;
    const out = [];
    for (let i = 0; i < a.length;) {
      let j = i;
      while (j < a.length && a[j] === a[i]) j++;
      out.push(j - i > 1 ? a[i] + '*' + (j - i) : String(a[i]));
      i = j;
    }
    return out.join(',');
  };
  ST.unrle = function (s, n, Type) {
    const a = new (Type || Uint8Array)(n);
    if (!s) return a;
    let i = 0;
    for (const part of s.split(',')) {
      const k = part.indexOf('*');
      const v = +(k < 0 ? part : part.slice(0, k)), c = k < 0 ? 1 : +part.slice(k + 1);
      a.fill(v, i, i + c);
      i += c;
    }
    return a;
  };

  /* ------------------------------------------------------------------ what a prop keeps */
  // (its live state — falling, shaking, hp left, its id — starts afresh; the walls' own lights and an omen's altar are
  // the walls' and the run's, not the stage's)
  const KEEP = ['box', 'cat', 'kind', 'cr', 'cx', 'cy', 'solid', 'swayable', 'choppable', 'jumpable', 'elevation', 'destructible', 'resourceType', 'resourceAmt', 'maxHp', 'glow', 'lr', 'phase', 'fire', 'color', 'smoke', 'join', 'kits', 'enter', 'door', 'swept', 'flip', 'fps', 'additive', 'rise', 'keep', 'scale', 'sp', 'layer', 'alpha', 'npc', 'mount', 'exitDoor', 'role', 'ev', 'evd', 'roleGlow', 'roleBreak', 'roleTree'];
  const transient = (p) => p.dead || p.cat === 'walllight' || p.omen || p.hive || p.temp;
  const clone = (v) => (v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v);

  /* a frame as a data URL, with where it stands (for pieces not cut from a pack) */
  function imageOf(name) {
    const S = CH.Sprites;
    if (!S.has(name)) return null;
    const sp = S.get(name), f = sp.frames && sp.frames[0];
    if (!f) return null;
    try {
      const c = document.createElement('canvas');
      c.width = f.width; c.height = f.height;
      c.getContext('2d').drawImage(f, 0, 0);
      return { src: c.toDataURL('image/png'), ax: sp.ax, ay: sp.ay, n: 1 };
    } catch (e) { return null; }
  }
  /* is this prop's look rebuilt from its pack key */
  const fromKey = (p) => (p.sheet ? CH.Props.sprite(p.sheet, p.scale) === p.sprite : !!(p.sprite && p.sprite.startsWith('obj.')));

  /* the spots a stage keeps of its own (those its pieces make, a chest that is a piece, are made again from the pieces) */
  const own = (list) => (list || []).filter((q) => !q.fromProp);

  /* ------------------------------------------------------------------ what its pieces are (js/editor/roles.js) */
  /* a piece's role made into what the game uses: a chest, a shrine, a sign, a waypoint, a breach, a shop, a hazard; a door
     (prop.enter) and the exit door (the exit stands at its spot) the game uses as they are. Each is marked fromProp, so
     the editor and the next save leave it to the piece */
  ST.events = function (L) {
    for (const p of L.props) {
      if (!p.ev || p.dead) continue;
      const d = p.door || { x: p.x, y: p.y + 8 }, e = p.evd || {};
      if (p.ev === 'chest') L.chests.push({ x: d.x, y: d.y, opened: false, id: L.chests.length, room: -1, tier: e.tier || 1, skin: true, fromProp: true });
      else if (p.ev === 'shrine') L.shrines.push({ x: d.x, y: d.y, used: false, id: L.shrines.length, kind: e.kind || 'healing', skin: true, fromProp: true });
      else if (p.ev === 'sign') (L.lore = L.lore || []).push({ x: d.x, y: d.y, name: e.name || 'A sign', lines: e.lines && e.lines.length ? e.lines : ['…'], fromProp: true });
      else if (p.ev === 'waypoint') L.waypoints.push({ x: d.x, y: d.y, id: L.waypoints.length, active: false, fromProp: true });
      else if (p.ev === 'breach') L.spawners.push({ id: L.spawners.length, kind: e.kind || 'grave', name: e.name || 'OSSUARY', x: d.x, y: d.y, room: -1, level: 3, dead: false, fromProp: true });
      else if (p.ev === 'shop') L.shop = { x: d.x, y: d.y, fromProp: true };
      else if (p.ev === 'burns' || p.ev === 'poisons') {
        const sp = CH.Sprites.has(p.sprite) ? CH.Sprites.get(p.sprite) : { w: 32, h: 16 };
        const rx = Math.max(8, p.box ? p.box.hw : sp.w * 0.4), ry = Math.max(5, p.box ? p.box.hh + 2 : Math.min(sp.h, 30) * 0.4);
        (L.hazards = L.hazards || []).push({ x: p.x + (p.cx || 0), y: p.y + (p.cy || 0), rx, ry, kind: p.ev === 'burns' ? 'lava' : 'toxic', fromProp: true });
      }
    }
  };
  ST.unevents = function (L) { // (the editor: the pieces speak for themselves)
    for (const k of ['chests', 'shrines', 'lore', 'waypoints', 'spawners', 'hazards']) if (L[k]) L[k] = L[k].filter((q) => !q.fromProp);
    if (L.shop && L.shop.fromProp) L.shop = null;
  };

  /* ------------------------------------------------------------------ a level to a stage */
  ST.serialize = function (L, extra) {
    const out = {
      v: ST.VERSION, biome: L.biome, layout: L.layout || 'dungeon', name: L.name, tw: L.tw, th: L.th,
      cells: ST.rle(L.cells), top: L.top ? ST.rle(L.top) : null,
      stairs: L.stairs ? [...L.stairs] : [], ramps: L.ramps ? [...L.ramps] : [],
      bridges: clone(L.bridges || []), skyBridge: L.skyBridge ? ST.rle(L.skyBridge) : null,
      route: L.route ? ST.rle(L.route) : null, trail: L.trail ? ST.rle(L.trail) : null,
      paint: L.paint ? Object.fromEntries(L.paint) : null, // tile index -> floor swatch key (the editor's floor brush)
      grounds: clone(L.grounds || []), puddles: clone(L.puddles || []), inlays: clone(L.inlays || []),
      decals: (L.decals || []).filter((d) => d.key).map((d) => ({ k: d.key, x: d.x, y: d.y, s: d.s || 0, a: d.a, fx: d.fx ? 1 : 0, fy: d.fy ? 1 : 0 })),
      props: [], images: {},
      entrance: L.entrance ? clone(L.entrance) : null, exit: L.exit ? clone(Object.assign({}, L.exit, { open: false })) : null,
      waypoints: own(L.waypoints).map((w, i) => ({ x: w.x, y: w.y, id: i, active: i === 0 })),
      spawners: own(L.spawners).map((s, i) => ({ id: i, kind: s.kind, name: s.name, x: s.x, y: s.y, room: s.room, level: s.level || 3 })),
      packs: (L.packs || []).map((k) => ({ x: k.x, y: k.y, room: k.room, type: k.type, n: k.n, elite: !!k.elite, leader: !!k.leader, mixed: k.mixed, camp: clone(k.camp) })),
      chests: own(L.chests).map((c, i) => ({ x: c.x, y: c.y, id: i, room: c.room, tier: c.tier, secret: !!c.secret })),
      shrines: own(L.shrines).map((s, i) => ({ x: s.x, y: s.y, id: i, kind: s.kind })),
      secrets: clone((L.secrets || []).map((s) => Object.assign({}, s, { found: false }))),
      lore: clone(own(L.lore)), camps: clone(L.camps || []), gates: clone(L.gates || []),
      rooms: (L.rooms || []).map((r) => ({ x: r.x, y: r.y, w: r.w, h: r.h, cx: r.cx, cy: r.cy, r: r.r, deg: r.deg, id: r.id, tag: r.tag, purpose: r.purpose })),
      flags: { bossHall: !!L.bossHall, sky: !!L.sky, belly: L.biome === 'belly' },
      meta: Object.assign({ saved: new Date().toISOString() }, extra || {}),
    };
    for (const p of L.props) {
      if (transient(p)) continue;
      const q = ST.propData(p, out.images);
      if (L.tower === p) q.role = 'tower';
      if (L.maw === p) q.role = 'maw';
      out.props.push(q);
    }
    return out;
  };
  /* one prop as a stage keeps it (images: where a look not cut from a pack goes) */
  ST.propData = function (p, images) {
    const q = { x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 };
    if (p.sheet) q.k = p.sheet;
    if (!fromKey(p)) { // its look travels with the stage
      if (images && !images[p.sprite]) { const im = imageOf(p.sprite); if (im) images[p.sprite] = im; }
      q.img = p.sprite;
    } else if (!p.sheet) q.k = p.sprite; // a Valley Ruin object: its sprite is its key
    for (const f of KEEP) if (p[f] !== undefined && p[f] !== null && p[f] !== false) q[f] = clone(p[f]);
    if (p.hp !== undefined && p.maxHp === undefined) q.maxHp = p.hp;
    return q;
  };

  /* ------------------------------------------------------------------ a stage to a level */
  const loaded = {}; // sprite name -> registered from a stage's images
  function registerImages(images) {
    for (const [name, im] of Object.entries(images || {})) {
      if (CH.Sprites.has(name) || loaded[name]) continue;
      const img = new Image();
      img.src = im.src;
      CH.Sprites.fromFrames(name, [img], {}); // (a canvas copy: drawn once the image has decoded)
      const sp = CH.Sprites.get(name);
      const fix = () => { const g = sp.frames[0].getContext('2d'); sp.frames[0].width = img.width; sp.frames[0].height = img.height; g.drawImage(img, 0, 0); sp.w = img.width; sp.h = img.height; sp.ax = im.ax != null ? im.ax : img.width / 2; sp.ay = im.ay != null ? im.ay : img.height; };
      if (img.complete && img.width) fix(); else img.onload = fix;
      sp.ax = im.ax; sp.ay = im.ay;
      loaded[name] = true;
    }
  }
  // every stage's images are registered as the game loads, so they have decoded before a stage is played
  ST.preload = () => { for (const s of Object.values(ST.data)) if (s && s.images) registerImages(s.images); };

  /* a prop of a stage as the game wants it */
  ST.makeProp = function (L, q) {
    const PR = CH.Props;
    if (q.fire && CH.Fires) { // a campfire: the fires draw it (js/fires.js)
      const f = CH.Fires.place(L.props, q.x, q.y, q.color || 'amber', !!q.smoke);
      if (f) { f.sp = true; if (q.phase != null) f.phase = q.phase; }
      return f;
    }
    let name = q.img || null;
    if (!name && q.k) name = q.k.startsWith('obj.') ? q.k : PR.sprite(q.k, q.scale);
    if (!name || !CH.Sprites.has(name)) return null;
    const o = {};
    for (const f of KEEP) if (q[f] !== undefined) o[f] = clone(q[f]);
    o.hp = q.maxHp || 40;
    if (o.solid === undefined) o.solid = false;
    CH.Arenas.addProp(L.props, name, q.x, q.y, o);
    const p = L.props[L.props.length - 1];
    for (const f of KEEP) if (q[f] !== undefined) p[f] = clone(q[f]); // (addProp guesses some from the name: the stage's own win)
    if (q.k && !q.k.startsWith('obj.')) p.sheet = q.k;
    p.sp = true;
    if (q.role === 'tower') { L.tower = p; }
    if (q.role === 'maw') { L.maw = p; }
    return p;
  };

  ST.build = function (src, stageN) {
    const s = typeof src === 'object' ? src : ST.data[src];
    if (!s) return null;
    const Level = CH.Level;
    const L = new Level(s.tw, s.th, s.biome);
    const n = s.tw * s.th;
    L.cells = ST.unrle(s.cells, n);
    if (s.top) L.top = ST.unrle(s.top, n);
    L.stairs = new Set(s.stairs || []);
    L.ramps = new Set(s.ramps || []);
    L.bridges = clone(s.bridges || []);
    if (s.skyBridge) L.skyBridge = ST.unrle(s.skyBridge, n);
    if (s.route) L.route = ST.unrle(s.route, n);
    if (s.trail) L.trail = ST.unrle(s.trail, n);
    if (s.paint) L.paint = new Map(Object.entries(s.paint).map(([k, v]) => [+k, v]));
    L.layout = s.layout;
    if (s.name) L.name = s.name;
    L.grounds = clone(s.grounds || []);
    L.puddles = clone(s.puddles || []);
    L.inlays = clone(s.inlays || []);
    L.decals = [];
    for (const d of s.decals || []) {
      let img;
      if (d.s) { const nm = CH.Props.sprite(d.k, d.s); img = nm && CH.Sprites.has(nm) ? CH.Sprites.get(nm).frames[0] : undefined; }
      L.decals.push({ key: d.k, img, s: d.s, x: d.x, y: d.y, a: d.a == null ? 0.95 : d.a, fx: !!d.fx, fy: !!d.fy });
    }
    registerImages(s.images);
    L.props = [];
    for (const q of s.props || []) ST.makeProp(L, q);
    // (a stage saved without its entrance or exit gets one on its first and last open floor)
    const firstOpen = (from) => { for (let k = 0; k < n; k++) { const i = from ? k : n - 1 - k; if (L.cells[i] === 0) return { x: (i % s.tw) * 32 + 16, y: ((i / s.tw) | 0) * 32 + 16 }; } return { x: 64, y: 64 }; };
    L.entrance = (s.entrance && s.entrance.x != null && clone(s.entrance)) || firstOpen(true);
    L.exit = Object.assign({ open: false }, (s.exit && s.exit.x != null && clone(s.exit)) || firstOpen(false));
    L.waypoints = clone(s.waypoints || []);
    L.spawners = clone(s.spawners || []).map((q) => Object.assign(q, { dead: false }));
    L.packs = clone(s.packs || []).map((q) => Object.assign(q, { woke: false }));
    L.chests = clone(s.chests || []).map((q) => Object.assign(q, { opened: false }));
    L.shrines = clone(s.shrines || []).map((q) => Object.assign(q, { used: false }));
    L.secrets = clone(s.secrets || []);
    L.lore = clone(s.lore || []);
    L.camps = clone(s.camps || []);
    L.gates = clone(s.gates || []);
    L.rooms = clone(s.rooms || []);
    if (!L.rooms.length) L.rooms = ST.roomsOf(L);
    ST.events(L);
    const F = s.flags || {};
    if (F.bossHall) L.bossHall = true;
    if (F.sky) L.sky = true;
    L.handmade = true;
    L.explored.fill(F.bossHall ? 1 : 0);
    L.revealStart = F.bossHall ? () => L.explored.fill(1) : () => L.reveal(L.entrance.x, L.entrance.y, 9);
    if (stageN != null) L.stage = stageN;
    if (CH.Props.invalidate) CH.Props.invalidate();
    return L;
  };

  /* rooms for a stage drawn by hand: the open floor's widest spots, each a room round it (the run puts its vending
     machine, a quest's shrine and the packs' camps in rooms) */
  ST.roomsOf = function (L) {
    const tw = L.tw, th = L.th, d = new Int16Array(tw * th).fill(0), q = [];
    for (let i = 0; i < tw * th; i++) if (L.cells[i] !== 0) { d[i] = 0; q.push(i); } else d[i] = -1;
    for (let h = 0; h < q.length; h++) { // distance from the nearest wall
      const c = q[h], cx = c % tw, cy = (c / tw) | 0;
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + ox, ny = cy + oy;
        if (nx < 0 || ny < 0 || nx >= tw || ny >= th) continue;
        const ni = ny * tw + nx;
        if (d[ni] < 0) { d[ni] = d[c] + 1; q.push(ni); }
      }
    }
    const rooms = [], taken = new Uint8Array(tw * th);
    const order = [...Array(tw * th).keys()].filter((i) => L.cells[i] === 0 && d[i] >= 2).sort((a, b) => d[b] - d[a]);
    for (const i of order) {
      if (taken[i]) continue;
      const cx = i % tw, cy = (i / tw) | 0, r = Math.max(2, d[i]);
      for (let oy = -r - 2; oy <= r + 2; oy++) for (let ox = -r - 2; ox <= r + 2; ox++) { const x = cx + ox, y = cy + oy; if (x >= 0 && y >= 0 && x < tw && y < th) taken[y * tw + x] = 1; }
      rooms.push({ x: cx - r, y: cy - r, w: r * 2, h: r * 2, r, cx: cx * TS + TS / 2, cy: cy * TS + TS / 2, deg: 1, id: rooms.length, tag: '' });
      if (rooms.length >= 40) break;
    }
    if (!rooms.length) rooms.push({ x: 1, y: 1, w: tw - 2, h: th - 2, cx: L.w / 2, cy: L.h / 2, deg: 1, id: 0, tag: '' });
    const near = (p) => p && rooms.slice().sort((a, b) => Math.hypot(a.cx - p.x, a.cy - p.y) - Math.hypot(b.cx - p.x, b.cy - p.y))[0];
    const a = near(L.entrance), b = near(L.exit);
    if (a) a.tag = 'start';
    if (b && b !== a) b.tag = 'exit';
    return rooms;
  };

  /* the stage played for an area, when one was made by hand */
  ST.has = (id) => !ST.off && !!ST.data[String(id)];
  ST.test = null; // { id, data }: the editor's play test (the stage as it is in the editor, saved or not)
  ST.levelFor = (id, stageN) => {
    if (ST.test && ST.test.id === String(id)) return ST.build(ST.test.data, stageN);
    return ST.has(id) ? ST.build(String(id), stageN) : null;
  };

  ST.preload();
})(window.CH);
