/* CHAOS.exe - the way to the final boss (PLAN.md 21, request 1). The last area is no longer a hall of the castle:
     The Sky Road   flying islands (Flying Islands pack) over a dusk void, joined by plank bridges; breaches and packs as
                    in any stage; trees, ruins, crystals and animated statues on the islands, rocks and flowers floating
                    in the void, dragons passing far above. On the last island stands the Final Tower (Final Tower pack),
                    a maw for its door: it opens when the breaches are closed.
     The Belly      inside the tower: a boss hall of living flesh (Inside the Monster's Belly pack): gut floors, flesh
                    walls with teeth and eyes, a beating heart, cell creatures, tentacles, a worm in the floor, the
                    tower's machines; the final boss walks in, and its fall opens THE WAY HOME.
   The islands are a layout of their own (CH.Sky.gen, called by js/levelgen.js); the void, the islands' undersides and
   the bridges are painted into the level's chunks (js/walls.js asks CH.Sky.paintCell for every wall cell). */
(function (CH) {
  'use strict';
  const G = CH.G;
  const U = CH.U;
  const Level = CH.Level;
  const TS = Level.TS;
  const LG = CH.LevelGen;
  const SP = CH.SetPieces;
  const PR = CH.Props;
  const SKY = (CH.Sky = {});

  /* ------------------------------------------------------------------ looks */
  Level.STYLE.sky = {
    floor: 'kit', sheet: 'tile.rock', tint: '#6a7a8a', wall: '#140c26', top: '#e8e4d8', edge: '#0a0612',
    mats: {
      dirt: { base: ['fiG.0'], acc: ['fiG.0'] }, moss: { base: ['fiG.0'], acc: ['fiG.2'] }, roots: { base: ['fiG.0'], acc: ['fiG.0'] },
      rust: { base: ['fiG.0'], acc: ['fiG.2', 'fiG.1'] }, stone: { base: ['fiG.2'], acc: ['fiG.2', 'fiG.3'] }, swamp: { base: ['fiG.0'], acc: ['fiG.0'] }, // (fiG.1 and fiG.3, the island tops with holes, only as an inlay or two)
    },
  };
  Level.STYLE.belly = {
    floor: 'kit', sheet: 'tile.rock', tint: '#5a2030', wall: '#1a060c', top: '#3a0f1a', edge: '#0c0306',
    mats: {
      // mostly the gut's pebbled flesh; the raw red flesh in patches, the acid-green in a few pools
      dirt: { base: ['mbG.0', 'mbG.1', 'mbG.2'], acc: ['mbG.3', 'mbG.4'] }, moss: { base: ['mbG.3', 'mbG.4', 'mbG.5'], acc: ['mbG.12'] },
      roots: { base: ['mbG.12', 'mbG.13', 'mbG.14'], acc: ['mbG.6'] }, rust: { base: ['mbG.7', 'mbG.8'], acc: ['mbG.15'] },
      stone: { base: ['mbG.15', 'mbG.16', 'mbG.17'], acc: ['mbG.0'] }, swamp: { base: ['mbG.9', 'mbG.10', 'mbG.11'], acc: ['mbG.1'] },
    },
  };
  const TH = CH.Arenas.THEMES;
  TH.sky = Object.assign({}, TH.castle, { id: 'sky', name: 'The Sky Road', tag: 'Nothing holds these stones up but spite.', clear: '#140c26', weather: 'none' });
  TH.belly = Object.assign({}, TH.castle, { id: 'belly', name: 'The Final Tower', tag: 'The tower is alive. It is hungry.', clear: '#1a060c', weather: 'none' });
  LG.MOBS.sky = (LG.MOBS.castle || []).slice();
  LG.MOBS.belly = (LG.MOBS.castle || []).slice();
  LG.HIVES.sky = { kind: 'portal', name: 'SKY RIFT' };
  LG.HIVES.belly = LG.HIVES.castle;
  if (CH.Walls) {
    CH.Walls.add('sky', { sky: true, mats: [], acc: [], mounts: [] });
    // the belly's walls: its flesh wall sliced along the runs, teeth, eyes and sphincter doors set in it
    CH.Walls.MAT.flesh = { face: [], long: 'key:kit.mb1.17', corner: ['kit.da2.34', 'kit.da2.44', 'kit.da2.55'] };
    CH.Walls.add('belly', { dark: '22,5,10', tint: 'rgba(120,10,30,0.28)', mats: ['flesh'], acc: [], mounts: [['door', ['kit.mb1.37', 'kit.mb1.39']], ['window', ['kit.mb1.38']], ['hang', ['kit.mb1.36']]] });
  }

  /* ------------------------------------------------------------------ the islands */
  const hash = (a, b) => { let n = (a * 374761393 + b * 668265263) | 0; n = (n ^ (n >> 13)) * 1274126177; return ((n ^ (n >> 16)) >>> 0) / 4294967296; };
  /* round islands of 8-11 tiles, spread over the map; bridges three tiles wide, an elbow each, join them (a tree
     plus two loops) */
  SKY.gen = function (L, R) {
    const isl = [];
    for (let t = 0; t < 900 && isl.length < 11; t++) {
      const r = R.int(7, 10), cx = R.int(r + 3, L.tw - r - 4), cy = R.int(r + 3, L.th - r - 4);
      if (isl.every((o) => Math.hypot(o.tx - cx, o.ty - cy) > o.r + r + 7)) isl.push({ tx: cx, ty: cy, r });
    }
    L.skyBridge = new Uint8Array(L.tw * L.th);
    for (const o of isl) for (let y = -o.r; y <= o.r; y++) for (let x = -o.r; x <= o.r; x++) {
      const e = (x * x) / (o.r * o.r) + (y * y) / (o.r * o.r * 0.8);
      const edge = hash(o.tx + x, o.ty + y) * 0.12; // a ragged rim
      if (e <= 1 - edge) L.carveRect(o.tx + x, o.ty + y, 1, 1);
    }
    L.rooms = isl.map((o, i) => ({ x: o.tx - o.r, y: o.ty - o.r, w: o.r * 2, h: o.r * 2, r: o.r - 1, cx: (o.tx + 0.5) * TS, cy: (o.ty + 0.5) * TS, deg: 0, id: i, tag: '' }));
    const bridge = (a, b) => {
      const ax = a.tx, ay = a.ty, bx = b.tx, by = b.ty;
      const cells = [];
      for (let x = Math.min(ax, bx); x <= Math.max(ax, bx); x++) for (let d = -1; d <= 1; d++) cells.push([x, ay + d, 1]);
      for (let y = Math.min(ay, by); y <= Math.max(ay, by); y++) for (let d = -1; d <= 1; d++) cells.push([bx + d, y, 2]);
      for (const [x, y, dir] of cells) {
        if (!L.inb(x, y)) continue;
        const i = L.idx(x, y);
        if (L.solid(x, y)) { L.carveRect(x, y, 1, 1); L.skyBridge[i] = dir; }
        else if (L.skyBridge[i] && L.skyBridge[i] !== dir) L.skyBridge[i] = 3; // the elbow: a landing
      }
      L.rooms[isl.indexOf(a)].deg++;
      L.rooms[isl.indexOf(b)].deg++;
    };
    // a tree by distance (Prim), then two short loops
    const inT = [isl[0]], out = isl.slice(1);
    while (out.length) {
      let best = null, bd = 1e9;
      for (const a of inT) for (const b of out) { const d = Math.hypot(a.tx - b.tx, a.ty - b.ty); if (d < bd) { bd = d; best = [a, b]; } }
      bridge(best[0], best[1]);
      inT.push(best[1]);
      out.splice(out.indexOf(best[1]), 1);
    }
    for (let k = 0; k < 2; k++) { const a = R.pick(isl), b = isl.filter((o) => o !== a).sort((p, q) => Math.hypot(p.tx - a.tx, p.ty - a.ty) - Math.hypot(q.tx - a.tx, q.ty - a.ty))[1]; if (b) bridge(a, b); }
    L.sky = true;
  };

  /* ------------------------------------------------------------------ painting */
  const IM = () => CH.Assets.images;
  const keysOf = (id, kind) => { const m = CH.Assets.meta.lands && CH.Assets.meta.lands.sheets[id]; return m ? m.kinds.map((k, i) => (k === kind ? 'kit.' + id + '.' + i : null)).filter((k) => k && IM()[k]) : []; };
  let CLIFFS = null, CLOUDS = null;
  const skyCol = (L, gy) => {
    const t = Math.max(0, Math.min(1, gy / Math.max(1, L.th)));
    const a = [20, 12, 38], b = [58, 22, 52];
    return 'rgb(' + a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',') + ')';
  };
  /* a cell of the void: the dusk sky, a star or two, clouds far below, and the undersides of the islands above */
  SKY.paintCell = function (L, g, gx, gy, px, py) {
    if (!CLIFFS) { CLIFFS = keysOf('fiG', 'cliff'); CLOUDS = keysOf('fi1', 'cloud'); }
    g.fillStyle = skyCol(L, gy);
    g.fillRect(px, py, TS, TS);
    for (let i = 0; i < 2; i++) if (hash(gx * 7 + i, gy * 3) < 0.18) { g.fillStyle = 'rgba(255,240,255,' + (0.25 + hash(gx, gy + i) * 0.5) + ')'; g.fillRect(px + Math.floor(hash(gx + i, gy) * 30), py + Math.floor(hash(gy, gx + i) * 30), 1, 1); }
    g.save();
    g.beginPath(); g.rect(px, py, TS, TS); g.clip();
    // clouds: one now and then in each block of 6 x 4 cells, drawn faint and dusk-tinted
    for (let by = Math.floor(gy / 4) - 2; by <= Math.floor(gy / 4); by++) for (let bx = Math.floor(gx / 6) - 2; bx <= Math.floor(gx / 6); bx++) {
      if (hash(bx * 13 + 5, by * 17 + 3) > 0.34 || !CLOUDS.length) continue;
      const im = IM()[CLOUDS[(((bx * 7 + by * 3) % CLOUDS.length) + CLOUDS.length) % CLOUDS.length]]; // in turn: every cloud of the pack drifts somewhere
      const cx = bx * 6 * TS + hash(bx + 1, by) * 4 * TS, cy = by * 4 * TS + hash(bx, by + 1) * 2 * TS;
      g.globalAlpha = 0.35;
      g.drawImage(im, cx - gx * TS + px, cy - gy * TS + py);
      g.globalAlpha = 1;
    }
    // the rock hanging under an island's rim (one or two cells below it)
    for (let k = 1; k <= 2; k++) {
      if (L.solid(gx, gy - k)) continue;
      if (L.skyBridge && L.skyBridge[L.idx(gx, gy - k)]) break; // a bridge has no rock under it
      if (!CLIFFS.length) break;
      const im = IM()[CLIFFS[Math.floor(hash(gx >> 2, gy - k) * CLIFFS.length) % CLIFFS.length]];
      const sx = ((gx * TS) % Math.max(1, im.width - TS)) | 0;
      g.drawImage(im, sx, 0, Math.min(TS, im.width), im.height, px, py - (k - 1) * TS - 4, TS, im.height);
      break;
    }
    // a pale rim where an island's side meets the void
    if (!L.solid(gx - 1, gy) && !(L.skyBridge && L.skyBridge[L.idx(gx - 1, gy)])) { g.fillStyle = 'rgba(232,228,216,0.55)'; g.fillRect(px, py, 2, TS); }
    if (!L.solid(gx + 1, gy) && !(L.skyBridge && L.skyBridge[L.idx(gx + 1, gy)])) { g.fillStyle = 'rgba(232,228,216,0.55)'; g.fillRect(px + TS - 2, py, 2, TS); }
    g.restore();
  };
  /* the bridges: the void under them, planks across their way, ropes along both sides */
  /* round rims (PLAN.md 22): an island's floor is cut on the 32 px grid; every outer corner of it is rounded off into
     the sky, with a pale lip along the curve, so the islands read as round */
  function roundRims(L, g, x0, y0, size) {
    const B = L.skyBridge, R = 15;
    const t0x = Math.floor(x0 / TS), t0y = Math.floor(y0 / TS), n = size / TS;
    const land = (x, y) => L.inb(x, y) && !L.solid(x, y) && !(B && B[L.idx(x, y)]);
    for (let ty = 0; ty < n; ty++) for (let tx = 0; tx < n; tx++) {
      const gx = t0x + tx, gy = t0y + ty;
      if (!land(gx, gy)) continue;
      for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        if (land(gx + dx, gy) || land(gx, gy + dy) || (B && (B[L.idx(gx + dx, gy)] || B[L.idx(gx, gy + dy)]))) continue;
        const cx = tx * TS + (dx < 0 ? R : TS - R), cy = ty * TS + (dy < 0 ? R : TS - R); // the arc's centre
        const kx = tx * TS + (dx < 0 ? 0 : TS), ky = ty * TS + (dy < 0 ? 0 : TS); // the corner itself
        g.save();
        g.beginPath();
        g.moveTo(kx, ky);
        g.lineTo(kx, cy);
        g.arc(cx, cy, R, dx < 0 ? Math.PI : 0, dy < 0 ? -Math.PI / 2 : Math.PI / 2, (dx < 0) === (dy < 0) ? false : true);
        g.lineTo(kx, ky);
        g.closePath();
        g.fillStyle = skyCol(L, gy);
        g.fill();
        g.strokeStyle = 'rgba(232,228,216,0.6)';
        g.lineWidth = 2;
        g.beginPath();
        g.arc(cx, cy, R - 1, dx < 0 ? Math.PI : 0, dy < 0 ? -Math.PI / 2 : Math.PI / 2, (dx < 0) === (dy < 0) ? false : true);
        g.stroke();
        g.restore();
      }
    }
  }
  SKY.paintBridges = function (L, g, x0, y0, size) {
    const B = L.skyBridge;
    if (!B) return;
    roundRims(L, g, x0, y0, size);
    const t0x = Math.floor(x0 / TS), t0y = Math.floor(y0 / TS), n = size / TS;
    for (let ty = 0; ty < n; ty++) for (let tx = 0; tx < n; tx++) {
      const gx = t0x + tx, gy = t0y + ty;
      if (!L.inb(gx, gy)) continue;
      const d = B[L.idx(gx, gy)];
      if (!d) continue;
      const px = tx * TS, py = ty * TS;
      g.fillStyle = skyCol(L, gy);
      g.fillRect(px, py, TS, TS);
      const on = (x, y) => L.inb(x, y) && !L.solid(x, y);
      const horiz = d === 1 || (d === 3 && (on(gx - 1, gy) || on(gx + 1, gy)));
      const rail = (x, y, w, h) => { g.fillStyle = '#3a2614'; g.fillRect(px + x, py + y, w, h); g.fillStyle = '#c8a46a'; g.fillRect(px + x, py + y, Math.max(1, w - 1), Math.max(1, h - 1)); };
      for (let i = 0; i < TS; i += 6) { // planks
        const shade = 0.82 + hash(gx * 5 + i, gy) * 0.3;
        g.fillStyle = 'rgb(' + Math.round(122 * shade) + ',' + Math.round(84 * shade) + ',' + Math.round(48 * shade) + ')';
        if (horiz) g.fillRect(px + i, py + 2, 5, TS - 4); else g.fillRect(px + 2, py + i, TS - 4, 5);
      }
      const edgeN = !on(gx, gy - 1) || !B[L.idx(gx, gy - 1)] && L.solid(gx, gy - 1), edgeS = !on(gx, gy + 1), edgeW = !on(gx - 1, gy), edgeE = !on(gx + 1, gy);
      if (horiz) { if (edgeN) rail(0, 0, TS, 3); if (edgeS) rail(0, TS - 3, TS, 3); }
      else { if (edgeW) rail(0, 0, 3, TS); if (edgeE) rail(TS - 3, 0, 3, TS); }
    }
  };

  /* ------------------------------------------------------------------ dressing */
  const SCENE = SP.SCENE;
  SP.SCENES.sky = ['isle_grove', 'isle_ruin', 'isle_grove', 'isle_crystal', 'isle_ruin'];
  SCENE.isle_grove = (D, A) => {
    for (let i = 0; i < 4; i++) { const a = D.r() * 6.283; D.near(D.key('tree'), A.x + Math.cos(a) * A.rx * 0.6, A.y + Math.sin(a) * A.ry * 0.55, 24); }
    D.scatter('shrub', A.x, A.y, A.rx * 0.8, 5);
    D.scatter('flower', A.x, A.y, A.rx * 0.8, 4);
    D.scatter('tuft', A.x, A.y, A.rx, 8);
    D.scatter('rock', A.x, A.y, A.rx * 0.8, 3);
    D.scatter('debris', A.x, A.y, A.rx, 4);
  };
  SCENE.isle_ruin = (D, A) => {
    D.near(D.key('ruin'), A.x, A.y - A.ry * 0.3, 30);
    for (const s of [-1, 1]) D.near(D.key(D.pick(['statue', 'obelisk'])), A.x + s * A.rx * 0.55, A.y, 20);
    D.scatter('boulder', A.x, A.y, A.rx * 0.8, 2);
    D.scatter('item', A.x, A.y + A.ry * 0.3, A.rx * 0.5, 1);
    D.scatter('tuft', A.x, A.y, A.rx, 6);
  };
  SCENE.isle_crystal = (D, A) => {
    D.near(D.key('crystal'), A.x, A.y - 10, 20);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.283; D.near(D.key('crystal'), A.x + Math.cos(a) * A.rx * 0.5, A.y + Math.sin(a) * A.ry * 0.45, 16); }
    D.scatter('machine', A.x, A.y + A.ry * 0.4, A.rx * 0.5, 2);
    D.scatter('debris', A.x, A.y, A.rx, 5);
  };
  SP.LANDMARK.i = { name: "THE DRAGON'S REST", build(D, A) {
    // the two dragons of the pack rest here between their flights over the road
    const dr = keysOf('fi1', 'dragon');
    dr.forEach((k, i) => {
      const nm = PR.sprite(k);
      if (!nm) return;
      CH.Arenas.addProp(D.L.props, nm, A.x + (i ? 70 : -60), A.y - 40 + i * 50, { solid: true, box: { hw: 46, hh: 12 }, cy: -11, jumpable: false });
      const p = D.L.props[D.L.props.length - 1];
      p.sheet = k; p.sp = true; p.cat = 'dragon'; p.flip = i === 1; p.keep = true; // they rest here: the way goes round them
    });
    D.put(D.key('statue'), A.x, A.y - 30);
    for (const s of [-1, 1]) { D.put(D.key('ruin'), A.x + s * 80, A.y - 34); D.put(D.key('obelisk'), A.x + s * 44, A.y + 4); }
    for (let i = 0; i < 6; i++) { const a = Math.PI * (0.15 + i * 0.14); D.put(D.key('crystal'), A.x + Math.cos(a) * 70, A.y + 18 + Math.sin(a) * 26); }
    D.scatter('flower', A.x, A.y, 70, 5);
  } };
  SP.LORE.i = ['The islands were the old kingdom\'s gardens. Someone tore them out of the ground and hung them on the wind.', 'The dragons do not attack. They wait. They have seen heroes walk this road before.', 'At the end of the road the tower breathes. Its door has teeth.'];
  SP.LANDMARK.b = { name: 'THE HEART OF THE TOWER', build() {} };
  SP.FAMS.sky = 'ito'; // + the Valley Ruin's objects (o): its bright trees, rocks and flowers suit the islands
  SP.FAM.sky = 'i'; SP.FAM.belly = 'b'; SP.ALT.sky = 't'; SP.ALT.belly = 't';
  SP.FAMS.belly = 'b'; // the belly's own pack; its tentacles and the tower's machines are added by hand below
  SP.STRICT.sky = SP.STRICT.belly = true;
  SP.SINGLE.sky = SP.SINGLE.belly = true; // one stage each: every piece of their packs shows there
  SP.FIELD.sky = [['tuft', 'tuft', 'flower'], ['shrub', 'tuft', 'rock'], ['debris', 'tuft'], ['crystal', 'tuft']];
  SP.FIELD.belly = [];
  SP.EDGE.i = ['tuft', 'tuft', 'rock', 'flower', 'debris'];
  SP.EDGE.b = ['bones', 'spike', 'debris', 'growth'];
  SP.after = SP.after || {};
  /* the tower on the last island, its maw at the exit; rocks, flowers and clouds floating in the void */
  SP.after.sky = function (D, L) {
    const ex = L.exit;
    ex.tower = true;
    const T = PR.sprite('kit.ft_tower');
    if (T) {
      CH.Arenas.addProp(L.props, T, ex.x, ex.y - 22, { solid: true, box: { hw: 92, hh: 22 }, cy: -21, jumpable: false });
      const p = L.props[L.props.length - 1];
      p.sheet = 'kit.ft_tower'; p.sp = true; p.cat = 'tower'; p.keep = true;
      L.tower = p;
      // nothing else may stand in front of it
      for (let i = L.props.length - 2; i >= 0; i--) { const q = L.props[i]; if (q.sp && Math.abs(q.x - ex.x) < 130 && q.y > ex.y - 90 && q.y < ex.y + 46) L.props.splice(i, 1); }
    }
    // the tower's plaza: its own floor plates laid before the maw
    const plates = keysOf('ftG', 'ground');
    (L.grounds = L.grounds || []).push({ x: ex.x, y: ex.y - 4, rx: 200, ry: 92, seed: ex.x * 7 + ex.y, tiles: plates.slice(0, 16).concat(keysOf('ft1', 'ground')) }); // + the sheet's loose floor tile
    const maw = PR.sprite('anim.mb_door0');
    if (maw) {
      CH.Arenas.addProp(L.props, maw, ex.x, ex.y - 14, { solid: false });
      const m = L.props[L.props.length - 1];
      m.sheet = 'anim.mb_door0'; m.sp = true; m.phase = 0; m.fps = 0;
      L.maw = m;
    }
    // waterfalls pouring off a few islands' southern rims into the void
    const falls = PR.sprite('anim.fi_falls');
    let nf = 0;
    for (let t = 0; t < 600 && falls && nf < 5; t++) {
      const rm = L.rooms[Math.floor(D.r() * L.rooms.length)];
      const gx = Math.floor(rm.cx / TS) + Math.round((D.r() - 0.5) * rm.r), gy = Math.floor(rm.cy / TS);
      let y = gy;
      while (L.inb(gx, y + 1) && !L.solid(gx, y + 1)) y++;
      if (!L.inb(gx, y + 3) || (L.skyBridge && (L.skyBridge[L.idx(gx, y)] || L.skyBridge[L.idx(gx, y + 1)])) || L.props.some((q) => q.cat === 'falls' && Math.abs(q.x - (gx + 0.5) * TS) < 260)) continue;
      CH.Arenas.addProp(L.props, falls, (gx + 0.5) * TS, (y + 1) * TS + 136, { solid: false }); // its top at the rim
      const p = L.props[L.props.length - 1];
      p.sheet = 'anim.fi_falls'; p.sp = true; p.fps = 6; p.phase = D.r(); p.cat = 'falls';
      nf++;
    }
    // rope ladders hanging from the islands' rims into the void
    const ladders = keysOf('fi2', 'ladder');
    let nl = 0;
    ladders.push(...keysOf('fi4', 'ladder'));
    for (let t = 0; t < 4000 && nl < ladders.length; t++) {
      const gx = 2 + Math.floor(D.r() * (L.tw - 4)), gy = 2 + Math.floor(D.r() * (L.th - 6));
      if (L.solid(gx, gy) || !L.solid(gx, gy + 1) || !L.solid(gx, gy + 2) || (L.skyBridge && L.skyBridge[L.idx(gx, gy)])) continue;
      if (L.props.some((q) => (q.cat === 'falls' || q.cat === 'ladder') && Math.abs(q.x - (gx + 0.5) * TS) < 56 && Math.abs(q.y - (gy + 2) * TS) < 80)) continue;
      const nm = PR.sprite(ladders[nl]);
      if (!nm) { nl++; continue; }
      const h = CH.Sprites.get(nm).h;
      CH.Arenas.addProp(L.props, nm, (gx + 0.5) * TS, (gy + 1) * TS + h - 6, { solid: false });
      const p = L.props[L.props.length - 1];
      p.sheet = ladders[nl]; p.sp = true; p.cat = 'ladder';
      nl++;
    }
    // ponds and lakes on the islands, their water lapping (Water_coasts), ripples and glints on them
    const water = Object.keys((CH.Assets.meta.lands || {}).anims || {}).filter((n) => /^fi_water/.test(n)).map((n) => 'anim.' + n);
    const ripples = Object.keys((CH.Assets.meta.lands || {}).anims || {}).filter((n) => /^fi_ripple/.test(n)).map((n) => 'anim.' + n);
    let ri = 0;
    const isles = L.rooms.filter((rm) => rm.tag !== 'start' && rm.tag !== 'exit' && !rm.landmark);
    water.forEach((key, i) => {
      for (let t = 0; t < 30; t++) {
        const rm = isles[(i + t) % isles.length];
        if (!rm) return;
        const A = { x: rm.cx, y: rm.cy, rx: (rm.r - 2) * TS, ry: (rm.r - 2) * TS };
        let p = D.put(key, A.x + (D.r() - 0.5) * A.rx, A.y + (D.r() - 0.5) * A.ry * 0.8);
        if (!p && t >= 20) { // a lake needs room: in a quarter of the island off the bridges' lines (they meet at its middle), its scenery makes way
          for (const sc of [0.75, 0.6, 0.5]) for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { // drawn a little smaller to fit
            const nm0 = PR.sprite(key, sc), sp0 = nm0 && CH.Sprites.get(nm0);
            if (!sp0 || p) break;
            const off = Math.max(0, (rm.r - 3) * TS * 0.55); // out toward the rim, away from the breach and pack in the middle
            const x = A.x + sx * Math.max(sp0.w / 2 + 40, off), y = A.y + sy * Math.max(sp0.h / 2 + 44, off * 0.8) + sp0.h / 2;
            if (!D.free(x, y, sp0.w / 2, sp0.h / 2, false) || !D.clearOf(x, y, { hw: sp0.w / 2, hh: sp0.h / 2 })) continue;
            for (let j = L.props.length - 1; j >= 0; j--) { const q = L.props[j]; if (q.sp && q !== L.tower && Math.abs(q.x - x) < sp0.w / 2 + 16 && q.y > y - sp0.h - 10 && q.y < y + 16) L.props.splice(j, 1); }
            p = D.put(key, x, y, { force: true, scale: sc });
            if (p) p.keep = true;
          }
        }
        if (!p) continue;
        if (!p.sprite) break; // a shore lies flat in the grass (a decal): no ripples on it
        p.cat = 'water';
        p.keep = true; // a pond stays where it lies (keepReachable takes other things out first)
        // a ripple or two on it
        const nm = CH.Sprites.get(p.sprite);
        for (let k = 0; k < 2 && ripples.length; k++) {
          const rk = ripples[ri++ % ripples.length], rn = PR.sprite(rk);
          if (!rn) continue;
          CH.Arenas.addProp(L.props, rn, p.x + (D.r() - 0.5) * nm.w * 0.4, p.y - nm.h * (0.3 + D.r() * 0.3), { solid: false });
          const q = L.props[L.props.length - 1];
          q.sheet = rk; q.sp = true; q.fps = 4; q.phase = D.r(); q.additive = true; q.cat = 'ripple';
        }
        break;
      }
    });
    // ripples left over glint on the ponds again
    while (ri < ripples.length) {
      const pond = L.props.filter((q) => q.cat === 'water');
      if (!pond.length) break;
      const p = pond[ri % pond.length], rk = ripples[ri++], rn = PR.sprite(rk);
      if (!rn) continue;
      CH.Arenas.addProp(L.props, rn, p.x + (D.r() - 0.5) * 30, p.y - 10, { solid: false });
      const q = L.props[L.props.length - 1];
      q.sheet = rk; q.sp = true; q.fps = 4; q.phase = D.r(); q.additive = true; q.cat = 'ripple';
    }
    // the void: floaters near the islands' edges
    const fl = PR.pool('floater', 'i').concat(PR.pool('cloud', 'i').filter((k) => k.startsWith('anim.')));
    let placed = 0;
    for (let t = 0; t < 2000 && placed < Math.max(46, fl.length) && fl.length; t++) {
      const gx = 2 + Math.floor(D.r() * (L.tw - 4)), gy = 2 + Math.floor(D.r() * (L.th - 4));
      if (!L.solid(gx, gy) || (L.skyBridge && L.skyBridge[L.idx(gx, gy)])) continue;
      let near = false;
      for (let d = 2; d <= 4 && !near; d++) for (const [ox, oy] of [[d, 0], [-d, 0], [0, d], [0, -d]]) if (L.inb(gx + ox, gy + oy) && !L.solid(gx + ox, gy + oy)) { near = true; break; }
      if (!near) continue;
      const key = fl[placed % fl.length];
      const nm = PR.sprite(key);
      if (!nm) continue;
      CH.Arenas.addProp(L.props, nm, (gx + 0.5) * TS, (gy + 0.8) * TS, { solid: false });
      const p = L.props[L.props.length - 1];
      const an = PR.animOf(key);
      p.sheet = key; p.sp = true; p.fps = an ? an.fps : 0; p.phase = D.r(); p.cat = 'floater';
      placed++;
    }
  };
  /* the belly: the heart against the far wall, cell creatures, tentacles and pustules over the floor, the worm, the
     tower's machines along the walls; then the sweep, so every piece of the pack shows */
  SP.after.belly = function (D, L) {
    const A = { x: L.rooms[0].cx, y: L.rooms[0].cy, rx: (L.rooms[0].w / 2 - 2) * TS, ry: (L.rooms[0].h / 2 - 2) * TS };
    for (const s of [-1, 1]) { const h = D.put('anim.mb_heart', A.x + s * A.rx * 0.62, A.y - A.ry * 0.62, { force: true }); if (h) h.keep = true; }
    for (const k of PR.pool('cell', 'b')) D.near(k, A.x + (D.r() - 0.5) * A.rx * 1.6, A.y + (D.r() - 0.5) * A.ry * 1.2, 40);
    for (const k of PR.pool('tentacle', 'b')) D.near(k, A.x + (D.r() - 0.5) * A.rx * 1.8, A.y + (D.r() - 0.5) * A.ry * 1.4, 40);
    for (const k of PR.pool('worm', 'b')) if (!D.near(k, A.x + (D.r() - 0.5) * A.rx * 1.4, A.y + A.ry * (0.2 + D.r() * 0.5), 40)) D.put(k, A.x + (D.r() - 0.5) * A.rx, A.y + A.ry * 0.5, { force: true });
    for (const k of PR.pool('pustule', 'b')) D.near(k, A.x + (D.r() - 0.5) * A.rx * 1.8, A.y + (D.r() - 0.5) * A.ry * 1.6, 40);
    // the tower's machines line the side walls; the sea's horrors grew in here too
    const mach = PR.pool('machine', 't');
    for (let i = 0; i < 10 && mach.length; i++) D.near(mach[(i * 7) % mach.length], A.x + (i % 2 ? -1 : 1) * A.rx * 0.88, A.y - A.ry * 0.7 + (i >> 1) * A.ry * 0.35, 20);
    for (const k of ['tentacle', 'urchin', 'anemone', 'anemone']) D.near(PR.pool(k, 's')[Math.floor(D.r() * 4)], A.x + (D.r() - 0.5) * A.rx * 1.6, A.y + (D.r() - 0.5) * A.ry * 1.4, 30);
    // the tower shows through the flesh: its floor plates in patches, the rest of them each
    const plates = keysOf('ftG', 'ground');
    (L.grounds = L.grounds || []).push({ x: A.x - A.rx * 0.6, y: A.y + A.ry * 0.55, rx: 120, ry: 64, seed: 11, tiles: plates.slice(16, 31) }, { x: A.x + A.rx * 0.6, y: A.y + A.ry * 0.55, rx: 120, ry: 64, seed: 23, tiles: plates.slice(31) });
    D.scatter('plate', A.x, A.y, A.rx * 0.9, 6);
    D.scatter('vein', A.x, A.y, A.rx, 6);
    D.scatter('bones', A.x, A.y, A.rx, 8);
    D.scatter('spike', A.x, A.y, A.rx, 6);
    // the maws that are its doors, along the far wall
    const maws = Object.keys((CH.Assets.meta.lands || {}).anims || {}).filter((n) => /^mb_door/.test(n) && n !== 'mb_door0').map((n) => 'anim.' + n);
    maws.forEach((key, i) => {
      const nm = PR.sprite(key);
      if (!nm) return;
      const x = A.x - A.rx + ((i + 0.5) / maws.length) * A.rx * 2, y = (L.rooms[0].y + 1) * TS + 4;
      CH.Arenas.addProp(L.props, nm, x, y, { solid: false });
      const p = L.props[L.props.length - 1];
      p.sheet = key; p.sp = true; p.fps = 2; p.phase = D.r(); p.cat = 'maw';
    });
    // the tower's and the belly's autotile blocks: set into the floor (pits, vein mats, flesh fields)
    const tiles = keysOf('ft1', 'tiles').concat(keysOf('mb1', 'tiles'));
    (L.inlays = L.inlays || []).push(...SP.inlaySpots(D, L, tiles));
    SP.sweep(D, L, true);
  };

  /* ------------------------------------------------------------------ the way in */
  SKY.approach = (dep, rng) => LG.generate('sky', dep, rng, { layout: 'sky', size: 'M' });
  SKY.enterTower = function () {
    const O = G.level;
    if (!O || !O.exit || !O.exit.open) return;
    const WM = CH.WorldMap;
    const L = (CH.Stages && CH.Stages.levelFor('belly', O.stage)) || WM.hall('belly', O.stage); // the belly as made in the editor, if it was
    L.stage = O.stage;
    L.threat = 0; L.threatT = 0; L.revealT = 0; L.opened = false; L.fx = 0;
    L.hives = []; L.hivesNeeded = 0;
    G.level = L;
    G.arena = L;
    G.enemies = [];
    G.pickups = [];
    if (CH.Items) CH.Items.ground.length = 0;
    G.projectiles.length = 0;
    G.zones.length = 0;
    G.players.forEach((q, i) => { q.x = L.entrance.x + i * 18; q.y = L.entrance.y - 10; q.vx = q.vy = q.kx = q.ky = 0; });
    if (CH.Atmos) CH.Atmos.setMode('none');
    G.snapCamera();
    if (CH.Audio) CH.Audio.sfx('door_open');
    G.banner('THE FINAL TOWER', 'It is alive. And it is hungry.', 2.4);
    const b = G.isBossWave(L.stage);
    if (b) G.after(1.4, () => { if (G.level === L && !G.enemies.some((e) => e.isBoss && !e.dead)) { const e = G.spawnBoss(b.kind, b.tier); if (e) e.hallBoss = true; } });
    G.emit && G.emit('enterTower', L);
  };

  /* ------------------------------------------------------------------ the tower's hearts (PLAN.md 22) */
  /* the final boss falls and the tower itself fights on: the two hearts on the far wall wake. Each beats where it hangs,
     a ring of blood-shots with every beat (faster as it fails), and every few beats cell creatures crawl out of the flesh.
     When both hearts stop, THE WAY HOME opens. */
  const Enemy = CH.Enemies.Enemy;
  const upd = Enemy.prototype.update;
  Enemy.prototype.update = function (g, dt) {
    const r = upd.call(this, g, dt);
    if (!this.heart || this.dead) return r;
    this.x = this.hx; this.y = this.hy; this.vx = this.vy = this.kx = this.ky = 0; // it hangs where it grew
    const hurt = 1 - this.hp / this.maxHp;
    this.beatT = (this.beatT || 0) + dt;
    const every = 1.7 - hurt * 0.8;
    if (this.beatT >= every && this.state !== 'spawn') {
      this.beatT = 0;
      this.beats = (this.beats || 0) + 1;
      const n = 10 + Math.round(hurt * 8), off = (this.beats % 2) * (Math.PI / n);
      for (let i = 0; i < n; i++) g.spawnProjectile({ owner: 'e', kind: 'bullet', x: this.x, y: this.y - 30, ang: off + (i / n) * U.TAU, speed: 80 + hurt * 40, r: 4, dmg: g.edmg(7), life: 3, sprite: 'fx.mageIce', animFps: 0, scale: 0.6, color: '#d8243c', fx: 'blood' });
      if (CH.FX && CH.FX.ring) CH.FX.ring(this.x, this.y - 30, 6, 70, '#ff3a52', 0.6);
      G.shake && G.shake(2, 0.15);
      if (this.beats % 4 === 0 && g.enemies.filter((q) => q.fromHeart && !q.dead).length < 8) {
        for (let i = 0; i < 2; i++) { const q = g.spawnEnemy('slime', this.x + U.rand(-60, 60), this.y + U.rand(10, 50), { spawnTime: 0.4 }); if (q) q.fromHeart = true; }
      }
    }
    return r;
  };
  const draw0 = CH.Enemies.draw;
  CH.Enemies.draw = function (ctx, e, cam) {
    if (!e.heart) return draw0.apply(this, arguments);
    const nm = PR.sprite('anim.mb_heart', 1.8);
    if (!nm) return draw0.apply(this, arguments);
    const sp = CH.Sprites.get(nm), hurt = 1 - e.hp / e.maxHp;
    const beat = e.beatT !== undefined ? Math.max(0, 1 - e.beatT * 4) : 0;
    ctx.save();
    ctx.translate(Math.round(e.x - cam.x), Math.round(e.y - cam.y));
    const s = 1 + beat * 0.08;
    ctx.scale(s, s);
    CH.Sprites.draw(ctx, nm, 0, 0, { frame: Math.floor(G.wall * (8 + hurt * 10)) % sp.frames.length });
    if (e.flash > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, e.flash * 4); CH.Sprites.draw(ctx, nm, 0, 0, { frame: 0 }); }
    ctx.restore();
  };
  SKY.wakeHearts = function (L) {
    if (L.heartPhase) return;
    L.heartPhase = true;
    const hearts = L.props.filter((p) => p.sheet === 'anim.mb_heart');
    const boss = CH.G.enemies.find((e) => e.isBoss);
    for (const h of hearts) {
      L.props.splice(L.props.indexOf(h), 1);
      const e = G.spawnEnemy('golem', h.x, h.y, { spawnTime: 0.8, hpMul: 4 });
      if (!e) continue;
      e.heart = true; e.hx = h.x; e.hy = h.y; e.speed = 0; e.mass = 999; e.baseR = 26;
      e.def = Object.assign({}, e.def, { name: "THE TOWER'S HEART", kbRes: 1, xp: (e.def.xp || 1) * 12, coin: (e.def.coin || 1) * 12 });
      e.name = "THE TOWER'S HEART";
    }
    CH.Props.invalidate();
    G.banner("THE TOWER'S HEART", 'It is still beating. Stop both hearts.', 2.6);
    G.shake(6, 0.8);
    if (CH.Audio) CH.Audio.sfx('boss_intro');
  };
  G.on('kill', function (e) {
    const L = G.level;
    if (!L || L.biome !== 'belly') return;
    if (e.isBoss && !L.heartPhase) { SKY.wakeHearts(L); return; }
    if (e.heart && !G.enemies.some((q) => q.heart && !q.dead && q !== e)) {
      // the last heart stops: the tower dies around the heroes, and the way home opens
      L.heartsDone = true;
      for (const q of G.enemies) if (q.fromHeart && !q.dead) q.dead = true; // its cell creatures die with it
      L.opened = true;
      L.exit.open = true;
      L.reveal(L.exit.x, L.exit.y, 4);
      G.shake(8, 1.2);
      G.banner('THE WORLD IS SAVED', 'The tower is dead. Take your loot, then walk through the far door', 3.2);
    }
  });

  /* the maw opens its teeth when the way is open */
  G.on('step', function () {
    const L = G.level;
    if (L && L.maw) L.maw.fps = L.exit && L.exit.open ? 3 : 0;
  });

  /* ------------------------------------------------------------------ dragons */
  /* now and then a dragon crosses the sky far above the road */
  let drag = null, nextDrag = 6;
  CH.Hooks.world.push((ctx, cam, v) => {
    const L = G.level;
    if (!L || L.biome !== 'sky') { drag = null; return; }
    const W = (v && v.w) || 480, H = (v && v.h) || 270;
    if (!drag && G.wall > nextDrag) {
      const ks = keysOf('fi1', 'dragon');
      if (ks.length) drag = { key: ks[Math.floor(Math.random() * ks.length)], x: -260, y: 20 + Math.random() * (H * 0.5), vx: 38 + Math.random() * 30, t0: G.wall, flip: Math.random() < 0.5 };
      nextDrag = G.wall + 18 + Math.random() * 20;
    }
    if (!drag) return;
    const im = IM()[drag.key];
    const t = G.wall - drag.t0, x = drag.flip ? W + 260 - t * drag.vx : -260 + t * drag.vx;
    if (!im || x > W + 280 || x < -300) { drag = null; return; }
    const y = drag.y + Math.sin(t * 1.3) * 6;
    ctx.save();
    ctx.globalAlpha = 0.85;
    // its shadow on the islands far below, then the dragon
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath(); ctx.ellipse(x + im.width / 2, y + im.height + 70, im.width * 0.35, 10, 0, 0, Math.PI * 2); ctx.fill();
    if (drag.flip) { ctx.translate(x + im.width, y); ctx.scale(-1, 1); ctx.drawImage(im, 0, 0); }
    else ctx.drawImage(im, x, y);
    ctx.restore();
  });
})(window.CH);
