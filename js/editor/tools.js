/* The stage editor's tools (PLAN.md 23), each { label, ic, key, tip, sub, brush, down, move, up, draw }:
   select  pick, move (snapped, Alt free), box-pick, and drag a picked piece's collision box by its handles
   stamp   place the drawer's piece; drag to lay a row of it (a fence, a wall of shelves)
   scatter paint a mix of the drawer's picked pieces in a circle, spaced, flipped at random; right-drag thins
   erase   take away what is under the brush
   terrain paint the cells: floor, wall, pit, secret wall (the walls' faces, corners and mounts follow by themselves);
           Shift+drag fills a rectangle; right-drag paints wall
   tiles   paint floor tiles with the drawer's piece (a floor swatch), or clear them
   mark    the stage's spots: entrance, exit, waypoints, breaches, monster packs, chests, shrines, lore */
(function (CH) {
  const ED = CH.Editor, TS = ED.TS, T = ED.TOOLS;
  const S = () => CH.Sprites;

  /* ------------------------------------------------------------------ select */
  let drag = null;
  const HANDLE = 5;
  function boxHandles(p) {
    const bx = p.x + (p.cx || 0), by = p.y + (p.cy || 0);
    return [
      { id: 'r', x: bx + p.box.hw, y: by }, { id: 'l', x: bx - p.box.hw, y: by },
      { id: 'b', x: bx, y: by + p.box.hh }, { id: 't', x: bx, y: by - p.box.hh },
      { id: 'c', x: bx, y: by },
    ];
  }
  function handleAt(m) {
    if (!ED.boxEdit || ED.sel.length !== 1 || ED.sel[0].t !== 'prop' || !ED.sel[0].o.box) return null; // (only while its collision is being edited: else a drag moves the piece)
    const p = ED.sel[0].o, r = HANDLE / ED.cam.z + 1;
    return boxHandles(p).find((h) => (h.id !== 'c' || m.ctrl) && Math.abs(h.x - m.wx) <= r && Math.abs(h.y - m.wy) <= r) || null; // (the middle one moves the box only with Ctrl: a plain drag moves the piece)
  }
  T.select = {
    label: 'Select', ic: '➚', key: 'V', tip: 'Pick and move pieces and markers; drag on the floor to box-pick',
    hint: 'Click to pick, drag to move (Alt: no snap), drag on the floor to box-pick. Edit collision from the details panel.',
    down(m) {
      const h = handleAt(m);
      if (h) { const p = ED.sel[0].o; drag = { kind: 'box', h, p, box0: Object.assign({}, p.box), cx0: p.cx || 0, cy0: p.cy || 0, wx: m.wx, wy: m.wy }; return; }
      const hit = ED.pick(m.wx, m.wy);
      if (hit) {
        if (m.shift || m.ctrl) {
          if (ED.isSel(hit.o)) { ED.sel = ED.sel.filter((s) => s.o !== hit.o); ED.inspect(); return; }
          ED.select([hit], true);
        } else if (!ED.isSel(hit.o)) ED.select([hit]);
        const anchor = ED.isSel(hit.o) ? hit : ED.sel[0];
        drag = { kind: 'move', items: ED.sel.slice(), ax: anchor.o.x, ay: anchor.o.y, wx: m.wx, wy: m.wy, anchor, moved: false, dx: 0, dy: 0 };
        return;
      }
      drag = { kind: 'box-pick', x0: m.wx, y0: m.wy, x1: m.wx, y1: m.wy, add: m.shift || m.ctrl };
    },
    move(m) {
      if (!drag || !m.down) return;
      if (drag.kind === 'move') {
        if (!drag.moved && Math.hypot(m.wx - drag.wx, m.wy - drag.wy) * ED.cam.z < 4) return;
        drag.moved = true;
        const want = drag.anchor.t === 'mark' || m.alt ? { x: Math.round(drag.ax + m.wx - drag.wx), y: Math.round(drag.ay + m.wy - drag.wy) } : ED.snapPt(drag.ax + m.wx - drag.wx, drag.ay + m.wy - drag.wy, m.alt);
        const dx = want.x - drag.anchor.o.x, dy = want.y - drag.anchor.o.y;
        if (dx || dy) { for (const it of drag.items) ED.moveItem(it, dx, dy); drag.dx += dx; drag.dy += dy; }
      } else if (drag.kind === 'box-pick') { drag.x1 = m.wx; drag.y1 = m.wy; }
      else if (drag.kind === 'box') {
        const p = drag.p, b = drag.box0, dx = Math.round(m.wx - drag.wx), dy = Math.round(m.wy - drag.wy);
        p.box = Object.assign({}, b);
        if (drag.h.id === 'r') p.box.hw = Math.max(2, b.hw + dx);
        if (drag.h.id === 'l') p.box.hw = Math.max(2, b.hw - dx);
        if (drag.h.id === 'b') p.box.hh = Math.max(2, b.hh + dy);
        if (drag.h.id === 't') p.box.hh = Math.max(2, b.hh - dy);
        if (drag.h.id === 'c') { p.cx = drag.cx0 + dx; p.cy = drag.cy0 + dy; }
        ED.inspect();
      }
    },
    up(m) {
      if (!drag) return;
      const d = drag;
      drag = null;
      if (d.kind === 'move' && d.moved && (d.dx || d.dy)) {
        let first = true;
        ED.act('move ' + d.items.length, () => { if (!first) for (const it of d.items) ED.moveItem(it, d.dx, d.dy); first = false; }, () => { for (const it of d.items) ED.moveItem(it, -d.dx, -d.dy); });
      } else if (d.kind === 'box-pick') {
        if (Math.abs(d.x1 - d.x0) * ED.cam.z < 3 && Math.abs(d.y1 - d.y0) * ED.cam.z < 3) { if (!d.add) ED.select([]); return; }
        ED.select(ED.inRect(d.x0, d.y0, d.x1, d.y1), d.add);
      } else if (d.kind === 'box') {
        const p = d.p, now = { box: Object.assign({}, p.box), cx: p.cx || 0, cy: p.cy || 0 }, was = { box: d.box0, cx: d.cx0, cy: d.cy0 };
        ED.act('collision', () => Object.assign(p, ED.clone(now)), () => Object.assign(p, ED.clone(was)));
      }
    },
    draw(g, z) {
      if (drag && drag.kind === 'box-pick') {
        g.strokeStyle = '#6fd3ff'; g.lineWidth = 1 / z; g.setLineDash([3 / z, 3 / z]);
        g.strokeRect(Math.min(drag.x0, drag.x1), Math.min(drag.y0, drag.y1), Math.abs(drag.x1 - drag.x0), Math.abs(drag.y1 - drag.y0));
        g.setLineDash([]);
      }
      if (ED.boxEdit && ED.sel.length === 1 && ED.sel[0].t === 'prop' && ED.sel[0].o.box) {
        const r = HANDLE / z;
        g.fillStyle = '#ffb347';
        for (const h of boxHandles(ED.sel[0].o)) g.fillRect(h.x - r / 2, h.y - r / 2, r, r);
      }
    },
  };

  /* ------------------------------------------------------------------ stamp */
  let stroke = null;
  ED.stampFlip = false;
  const nameOf = (key, scale) => (key.startsWith('obj.') ? key : CH.Props.sprite(key, scale || (CH.Props.meta(key) || {}).scale));
  function ghost(g, key, x, y, flip, a) {
    const nm = nameOf(key);
    if (!nm || !S().has(nm)) return null;
    g.globalAlpha = a || 0.6;
    S().draw(g, nm, x, y, { flip });
    g.globalAlpha = 1;
    return nm;
  }
  T.stamp = {
    label: 'Stamp', ic: '✚', key: 'B', tip: 'Place the piece picked in the drawer',
    sub: [['auto', 'As its kind', 'Stands or lies flat as the game would place it'], ['stand', 'Standing', 'Always stands (sorted with the heroes)'], ['floor', 'On the floor', 'Always lies flat on the floor']],
    hint: 'Click to place, drag to lay a row. X flips. Alt: no snap. Esc or right-click: back to Select.',
    down(m) {
      if (m.button === 2) { ED.setTool('select'); return; }
      if (!ED.picked) { ED.toast('Pick a piece in the drawer first.'); return; }
      stroke = { items: [], last: null };
      put(m);
    },
    move(m) { if (stroke && m.down) put(m); },
    up() {
      if (!stroke) return;
      const items = stroke.items;
      stroke = null;
      if (items.length) { ED.addItems('place ' + items.length, items); ED.select(items); }
    },
    draw(g, z) {
      if (!ED.picked) return;
      const p = ED.snapPt(ED.mouse.wx, ED.mouse.wy, ED.mouse.alt);
      const nm = ghost(g, ED.picked, p.x, p.y, ED.stampFlip, 0.55);
      if (nm && ED.showBoxes) {
        const am = CH.Props.meta(ED.picked) || {};
        const info = CH.Props.info(ED.picked);
        const box = am.box !== undefined ? am.box : info ? CH.Props.boxFor(nm, info.kind) : ED.traceBox(nm);
        if (box) { g.strokeStyle = 'rgba(255,80,90,0.8)'; g.lineWidth = 1 / z; g.strokeRect(p.x + (box.cx || 0) - box.hw, p.y + (box.cy != null ? box.cy : -box.hh + 1) - box.hh, box.hw * 2, box.hh * 2); }
      }
    },
  };
  function put(m) {
    const p = ED.snapPt(m.wx, m.wy, m.alt);
    if (stroke.last) { // a row: the next one a piece's width on
      const nm = nameOf(ED.picked), sp = nm && S().has(nm) ? S().get(nm) : { w: 32, h: 32 };
      const dx = p.x - stroke.last.x, dy = p.y - stroke.last.y;
      if (Math.abs(dx) < Math.max(8, sp.w - 2) && Math.abs(dy) < Math.max(8, Math.min(sp.h, 32) - 2)) return;
    }
    const it = ED.place(ED.picked, p.x, p.y, { flip: ED.stampFlip, as: ED.sub.stamp });
    if (!it) { ED.toast('That piece cannot be placed.'); return; }
    stroke.items.push(it);
    stroke.last = p;
    if (ED.drawer) ED.drawer.used(ED.picked);
  }

  /* ------------------------------------------------------------------ scatter */
  let scat = null;
  T.scatter = {
    label: 'Scatter', ic: '⁘', key: 'S', tip: 'Paint a mix of the picked pieces (Ctrl+click several in the drawer)', brush: true,
    sub: [['sparse', 'Sparse'], ['normal', 'Normal'], ['dense', 'Dense']],
    hint: 'Drag to scatter the picked pieces, spaced and flipped at random. Right-drag thins them out. [ ] brush size.',
    down(m) {
      if (!ED.picked && m.button !== 2) { ED.toast('Pick one or more pieces in the drawer first (Ctrl+click for a mix).'); return; }
      scat = { items: [], removed: [], at: 0, erase: m.button === 2 };
      T.scatter.move(m);
    },
    move(m) {
      if (!scat || !m.down) return;
      const now = performance.now();
      if (now - scat.at < 50) return;
      scat.at = now;
      const R = ED.brush * 24 + 16;
      if (scat.erase) {
        for (const p of ED.L.props.slice()) if (p.sp && !p.invisible && Math.hypot(p.x - m.wx, p.y - m.wy) < R && Math.random() < 0.35) { const it = { t: 'prop', o: p }; scat.removed.push({ it, at: ED.detach(it) }); }
        return;
      }
      const keys = ED.pickedMany.length ? ED.pickedMany : [ED.picked];
      const tries = ED.sub.scatter === 'dense' ? 4 : ED.sub.scatter === 'sparse' ? 1 : 2;
      const gapK = ED.sub.scatter === 'dense' ? 0.55 : ED.sub.scatter === 'sparse' ? 1.5 : 0.9;
      for (let t = 0; t < tries; t++) {
        const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * R;
        const x = Math.round(m.wx + Math.cos(a) * d), y = Math.round(m.wy + Math.sin(a) * d * 0.8);
        if (ED.L.solidAt(x, y)) continue;
        const key = keys[Math.floor(Math.random() * keys.length)];
        const nm = nameOf(key), sp = nm && S().has(nm) ? S().get(nm) : { w: 24 };
        const gap = Math.max(8, sp.w * gapK);
        if (ED.L.props.some((p) => !p.invisible && Math.abs(p.x - x) < gap && Math.abs(p.y - y) < gap * 0.7)) continue;
        const it = ED.place(key, x, y, { flip: Math.random() < 0.5, as: 'auto' });
        if (it) { scat.items.push(it); if (ED.drawer) ED.drawer.used(key); }
      }
    },
    up() {
      if (!scat) return;
      const s = scat;
      scat = null;
      if (s.erase && s.removed.length) {
        let first = true;
        ED.act('thin ' + s.removed.length, () => { if (!first) for (const r of s.removed) ED.detach(r.it); first = false; }, () => { for (const r of s.removed.slice().reverse()) ED.attach(r.it, r.at); });
      } else if (s.items.length) ED.addItems('scatter ' + s.items.length, s.items);
    },
    draw(g, z) {
      const R = ED.brush * 24 + 16;
      g.strokeStyle = '#6fd3ff'; g.lineWidth = 1 / z;
      g.beginPath(); g.ellipse(ED.mouse.wx, ED.mouse.wy, R, R * 0.8, 0, 0, Math.PI * 2); g.stroke();
    },
  };

  /* ------------------------------------------------------------------ erase */
  let er = null;
  T.erase = {
    label: 'Erase', ic: '⌫', key: 'E', tip: 'Take away what is under the mouse', brush: true,
    sub: [['all', 'Anything'], ['stand', 'Standing only'], ['floor', 'Floor only']],
    hint: 'Click or drag over pieces to take them away. [ ] brush size.',
    down(m) { er = { removed: [] }; T.erase.move(m); },
    move(m) {
      if (!er || !m.down) return;
      const R = (ED.brush - 1) * 16;
      const mode = ED.sub.erase;
      for (let i = 0; i < 6; i++) {
        let hit = null;
        if (R <= 0) hit = ED.pick(m.wx, m.wy, { noFloor: mode === 'stand', noMarks: true });
        else {
          if (mode !== 'floor') { const p = ED.L.props.find((q) => !q.invisible && Math.hypot(q.x - m.wx, q.y - m.wy) < R + 6); if (p) hit = { t: 'prop', o: p }; }
          if (!hit && mode !== 'stand') { const d = ED.L.decals.find((q) => Math.hypot(q.x - m.wx, q.y - m.wy) < R + 6); if (d) hit = { t: 'decal', o: d }; }
        }
        if (!hit || (mode === 'floor' && hit.t === 'prop') || (mode === 'stand' && hit.t !== 'prop')) break;
        er.removed.push({ it: hit, at: ED.detach(hit) });
        if (R <= 0) break;
      }
    },
    up() {
      if (!er) return;
      const r = er;
      er = null;
      if (!r.removed.length) return;
      let first = true;
      ED.act('erase ' + r.removed.length, () => { if (!first) for (const q of r.removed) ED.detach(q.it); first = false; }, () => { for (const q of r.removed.slice().reverse()) ED.attach(q.it, q.at); });
      ED.sel = ED.sel.filter((s) => !r.removed.some((q) => q.it.o === s.o));
    },
    draw(g, z) {
      const R = (ED.brush - 1) * 16;
      if (R > 0) { g.strokeStyle = '#ff5d6c'; g.lineWidth = 1 / z; g.beginPath(); g.arc(ED.mouse.wx, ED.mouse.wy, R, 0, Math.PI * 2); g.stroke(); }
    },
  };

  /* ------------------------------------------------------------------ terrain */
  const CELL = { floor: 0, wall: 1, pit: 4, secret: 3 };
  let ter = null;
  function brushCells(m) {
    const tx = Math.floor(m.wx / TS), ty = Math.floor(m.wy / TS), r = ED.brush - 1, out = [];
    for (let y = ty - r; y <= ty + r; y++) for (let x = tx - r; x <= tx + r; x++) if (ED.L.inb(x, y)) out.push([x, y]);
    return out;
  }
  T.terrain = {
    label: 'Terrain', ic: '▦', key: 'T', tip: 'Paint floor, wall, pit or a secret wall; the walls dress themselves', brush: true,
    sub: [['floor', 'Floor'], ['wall', 'Wall'], ['pit', 'Pit', 'A drop the heroes cannot cross'], ['secret', 'Secret wall', 'A cracked wall the heroes can break through']],
    hint: 'Drag to paint (right-drag paints wall). Shift+drag fills a rectangle. [ ] brush size.',
    down(m) {
      strokeBefore.clear();
      ter = { v: m.button === 2 ? CELL.wall : CELL[ED.sub.terrain || 'floor'], changes: new Map(), rect: m.shift ? { x0: Math.floor(m.wx / TS), y0: Math.floor(m.wy / TS) } : null };
      if (!ter.rect) T.terrain.move(m);
    },
    move(m) {
      if (!ter || !m.down || ter.rect) return;
      const L = ED.L;
      let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
      for (const [x, y] of brushCells(m)) {
        if ((x === 0 || y === 0 || x === L.tw - 1 || y === L.th - 1) && ter.v !== CELL.wall) continue; // the edge stays rock
        const i = L.idx(x, y);
        if (L.cells[i] === ter.v) continue;
        if (!strokeBefore.has(i)) strokeBefore.set(i, L.cells[i]); // (the stroke paints as it goes: undo needs the cell from before it)
        ter.changes.set(i, ter.v);
        L.cells[i] = ter.v;
        x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      }
      if (x1 >= 0) ED.dirtyRect((x0 - 2) * TS, (y0 - 2) * TS, (x1 - x0 + 5) * TS, (y1 - y0 + 5) * TS);
    },
    up(m) {
      if (!ter) return;
      const t = ter, L = ED.L;
      ter = null;
      if (t.rect) {
        const x1 = Math.floor(m.wx / TS), y1 = Math.floor(m.wy / TS);
        for (let y = Math.max(0, Math.min(t.rect.y0, y1)); y <= Math.min(L.th - 1, Math.max(t.rect.y0, y1)); y++) for (let x = Math.max(0, Math.min(t.rect.x0, x1)); x <= Math.min(L.tw - 1, Math.max(t.rect.x0, x1)); x++) {
          if ((x === 0 || y === 0 || x === L.tw - 1 || y === L.th - 1) && t.v !== CELL.wall) continue;
          if (L.cells[L.idx(x, y)] !== t.v) t.changes.set(L.idx(x, y), t.v);
        }
      }
      if (t.changes.size) commitCells(t.changes);
    },
    draw(g, z) {
      g.lineWidth = 1.5 / z;
      g.strokeStyle = ED.tool === 'tiles' ? '#6fd3ff' : ED.sub.terrain === 'wall' ? '#c9b6ff' : ED.sub.terrain === 'pit' ? '#ff9a5d' : ED.sub.terrain === 'secret' ? '#ffd35d' : '#7be38a';
      if (ter && ter.rect) {
        const x1 = Math.floor(ED.mouse.wx / TS), y1 = Math.floor(ED.mouse.wy / TS);
        g.strokeRect(Math.min(ter.rect.x0, x1) * TS, Math.min(ter.rect.y0, y1) * TS, (Math.abs(x1 - ter.rect.x0) + 1) * TS, (Math.abs(y1 - ter.rect.y0) + 1) * TS);
        return;
      }
      const r = ED.brush - 1, tx = Math.floor(ED.mouse.wx / TS), ty = Math.floor(ED.mouse.wy / TS);
      g.strokeRect((tx - r) * TS, (ty - r) * TS, (r * 2 + 1) * TS, (r * 2 + 1) * TS);
    },
  };
  /* a stroke of cells as one undo step; the rims of raised ground round it are worked out again (js/editor/height.js) */
  const strokeBefore = new Map();
  function commitCells(changes) {
    const L = ED.L;
    for (const [i, v] of strokeBefore) L.cells[i] = v; // (back to before the stroke, so the step holds all of it)
    strokeBefore.clear();
    let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    for (const i of changes.keys()) { const x = i % L.tw, y = (i / L.tw) | 0; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    ED.groundAct('paint ' + changes.size + ' tiles', () => {
      for (const [i, v] of changes) L.cells[i] = v;
      ED.settleHeight(x0, y0, x1, y1);
    });
  }

  /* ------------------------------------------------------------------ floor tiles */
  let tl = null;
  T.tiles = {
    label: 'Floor tiles', ic: '▤', key: 'K', tip: 'Paint floor tiles with the piece picked in the drawer (a floor swatch)', brush: true,
    sub: [['paint', 'Paint'], ['clear', 'Clear']],
    hint: 'Drag to paint the picked piece onto floor tiles (big swatches tile across). [ ] brush size.',
    down(m) {
      if (ED.sub.tiles !== 'clear' && !ED.picked) { ED.toast('Pick a floor piece in the drawer first (the Floor tab).'); return; }
      if (ED.picked && !CH.Assets.images[ED.picked] && ED.sub.tiles !== 'clear') { ED.toast('That piece has no single picture to tile with.'); return; }
      tl = { before: new Map(), after: new Map() };
      T.tiles.move(m);
    },
    move(m) {
      if (!tl || !m.down) return;
      const L = ED.L;
      L.paint = L.paint || new Map();
      const key = ED.sub.tiles === 'clear' ? null : ED.picked;
      for (const [x, y] of brushCells(m)) {
        const i = L.idx(x, y);
        if (!tl.before.has(i)) tl.before.set(i, L.paint.get(i) || null);
        tl.after.set(i, key);
        if (key) L.paint.set(i, key); else L.paint.delete(i);
        ED.dirtyRect(x * TS, y * TS, TS, TS);
      }
    },
    up() {
      if (!tl) return;
      const t = tl, L = ED.L;
      tl = null;
      if (!t.after.size) return;
      if (ED.picked && ED.drawer && ED.sub.tiles !== 'clear') ED.drawer.used(ED.picked);
      const apply = (m) => { L.paint = L.paint || new Map(); for (const [i, k] of m) { if (k) L.paint.set(i, k); else L.paint.delete(i); ED.dirtyRect((i % L.tw) * TS, ((i / L.tw) | 0) * TS, TS, TS); } };
      let first = true;
      ED.act('floor tiles ' + t.after.size, () => { if (!first) apply(t.after); first = false; }, () => apply(t.before));
    },
    draw: (g, z) => T.terrain.draw(g, z),
  };

  /* ------------------------------------------------------------------ markers */
  T.mark = {
    label: 'Markers', ic: '⚑', key: 'M', tip: 'The stage\'s spots: entrance, exit, waypoints, breaches, packs, chests, shrines, lore',
    sub: Object.entries(ED.MARK).filter(([, m]) => !m.door).map(([id, m]) => [id, m.ic + ' ' + m.label, m.tip]), // (a door's way in comes with the door)
    hint: 'Click to place the marker (the entrance and the exit move). Right-click a marker to take it away.',
    down(m) {
      const L = ED.L, type = ED.sub.mark || 'pack', M = ED.MARK[type];
      if (m.button === 2) { const hit = ED.pick(m.wx, m.wy); if (hit && hit.t === 'mark') ED.removeItems('remove ' + ED.MARK[hit.type].label, [hit]); return; }
      const x = Math.round(m.wx), y = Math.round(m.wy);
      if (L.solidAt(x, y)) { ED.toast('A marker must stand on the floor.'); return; }
      if (M.single) {
        const o = L[M.single];
        if (o) { ED.moveItems('move ' + M.label, [{ t: 'mark', type, o }], x - o.x, y - o.y); ED.select([{ t: 'mark', type, o }]); return; }
        const it = { t: 'mark', type, o: Object.assign(ED.markNew(type, x, y), type === 'exit' ? { open: false } : {}) };
        L[M.single] = it.o;
        ED.addItems('place ' + M.label, [it]);
        ED.select([it]);
        return;
      }
      const o = ED.markNew(type, x, y);
      L[M.list].push(o);
      const it = { t: 'mark', type, o };
      ED.addItems('place ' + M.label, [it]);
      ED.select([it]);
    },
    draw(g, z) {
      const M = ED.MARK[ED.sub.mark || 'pack'];
      if (!M) return;
      g.globalAlpha = 0.6; g.fillStyle = M.color;
      g.beginPath(); g.arc(ED.mouse.wx, ED.mouse.wy, Math.max(9, 11 / z), 0, Math.PI * 2); g.fill();
      g.globalAlpha = 1;
    },
  };
})(window.CH);
