/* The stage editor's Height tool (PLAN.md 23.2): raised ground, its rims, stairs, ramps and bridges.
   A tile's tier is L.top (0 the ground, 1-3 raised). A raised tile beside lower ground is a LEDGE of its tier: the rim a
   hero may jump down from but never climb. Stairs and ramps are rim tiles left open, keeping the tier below (L.stairs,
   L.ramps); walking off them onto the top lifts the hero (js/world.js). A bridge is floor laid over pit with planks drawn
   on it (L.bridges). Rims are worked out from the tiers, as walls dress themselves: paint the tiers, then click the rims
   where the stairs go. */
(function (CH) {
  const ED = CH.Editor, TS = ED.TS, T = ED.TOOLS, Level = CH.Level;
  const FLOOR = 0, PIT = Level.PIT, LEDGE = Level.LEDGE, MAXT = 3;
  const N8 = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
  const N4 = [[0, -1], [-1, 0], [1, 0], [0, 1]];

  /* a stage that never had height gets its layers (a rim with no tier rims tier 1, as the game reads it) */
  ED.heightReady = function (L) {
    if (!L.top) L.top = new Uint8Array(L.tw * L.th);
    if (!L.stairs) L.stairs = new Set();
    if (!L.ramps) L.ramps = new Set();
    if (!L.bridges) L.bridges = [];
    for (let i = 0; i < L.cells.length; i++) if (L.cells[i] === LEDGE && !L.top[i]) L.top[i] = 1;
  };
  const ground = (v) => v === FLOOR || v === LEDGE;
  const hOf = (L, i) => (L.stairs.has(i) ? L.top[i] + 1 : L.top[i]); // stairs count as the tier they climb to

  /* the rims of a box of tiles worked out again from their tiers */
  ED.settleHeight = function (x0, y0, x1, y1) {
    const L = ED.L;
    ED.heightReady(L);
    x0 = Math.max(0, x0 - 1); y0 = Math.max(0, y0 - 1); x1 = Math.min(L.tw - 1, x1 + 1); y1 = Math.min(L.th - 1, y1 + 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = L.idx(x, y);
      if (L.cells[i] !== FLOOR) { L.stairs.delete(i); L.ramps.delete(i); }
    }
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = L.idx(x, y), t = L.top[i];
      if (!ground(L.cells[i]) || L.stairs.has(i)) continue;
      let rim = false;
      if (t > 0) for (const [dx, dy] of N8) {
        const nx = x + dx, ny = y + dy;
        if (!L.inb(nx, ny)) continue;
        const j = L.idx(nx, ny);
        if (ground(L.cells[j]) && hOf(L, j) < t) { rim = true; break; }
      }
      L.cells[i] = rim ? LEDGE : FLOOR;
    }
  };

  /* a change to the ground (cells, tiers, stairs, ramps, bridges) as one undo step: what fn changed is kept as a diff */
  ED.groundAct = function (label, fn) {
    const L = ED.L;
    ED.heightReady(L);
    const c0 = L.cells.slice(), t0 = L.top.slice(), s0 = new Set(L.stairs), r0 = new Set(L.ramps), b0 = JSON.stringify(L.bridges);
    fn();
    const diff = [];
    for (let i = 0; i < c0.length; i++) if (c0[i] !== L.cells[i] || t0[i] !== L.top[i] || s0.has(i) !== L.stairs.has(i) || r0.has(i) !== L.ramps.has(i)) diff.push(i);
    const b1 = JSON.stringify(L.bridges);
    if (!diff.length && b0 === b1) return false;
    const before = diff.map((i) => [c0[i], t0[i], s0.has(i), r0.has(i)]), after = diff.map((i) => [L.cells[i], L.top[i], L.stairs.has(i), L.ramps.has(i)]);
    let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    const grow = (x, y) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
    for (const i of diff) grow(i % L.tw, (i / L.tw) | 0);
    for (const b of JSON.parse(b0).concat(JSON.parse(b1))) { grow(b.x0, b.y0); grow(b.x0 + b.w, b.y0 + b.h); }
    const put = (vals, bj) => {
      diff.forEach((i, k) => {
        const v = vals[k];
        L.cells[i] = v[0]; L.top[i] = v[1];
        if (v[2]) L.stairs.add(i); else L.stairs.delete(i);
        if (v[3]) L.ramps.add(i); else L.ramps.delete(i);
      });
      L.bridges = JSON.parse(bj);
      ED.cellsChanged(x0, y0, x1, y1);
    };
    ED.act(label, () => put(after, b1), () => put(before, b0));
    return true;
  };

  /* ------------------------------------------------------------------ the tool */
  if (!ED.sub.height) ED.sub.height = '1'; // (the tool opens on Tier 1)
  const sub = () => ED.sub.height || '1';
  let hd = null;
  function tileAt(m) { return [Math.floor(m.wx / TS), Math.floor(m.wy / TS)]; }
  function brushTiles(m) {
    const [tx, ty] = tileAt(m), r = ED.brush - 1, L = ED.L, out = [];
    for (let y = ty - r; y <= ty + r; y++) for (let x = tx - r; x <= tx + r; x++) if (x > 0 && y > 0 && x < L.tw - 1 && y < L.th - 1) out.push([x, y]);
    return out;
  }
  function rectTiles(a, b) {
    const L = ED.L, out = [];
    for (let y = Math.max(1, Math.min(a[1], b[1])); y <= Math.min(L.th - 2, Math.max(a[1], b[1])); y++) for (let x = Math.max(1, Math.min(a[0], b[0])); x <= Math.min(L.tw - 2, Math.max(a[0], b[0])); x++) out.push([x, y]);
    return out;
  }
  const boxOf = (tiles) => tiles.reduce((b, [x, y]) => [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)], [1e9, 1e9, -1, -1]);

  /* raise or lower the ground to a tier (stairs on it are taken away) */
  function paintTier(tiles, v) {
    const L = ED.L;
    for (const [x, y] of tiles) {
      const i = L.idx(x, y);
      if (!ground(L.cells[i])) continue;
      L.top[i] = v;
      L.stairs.delete(i); L.ramps.delete(i);
    }
  }
  /* stairs (or a ramp) on rim tiles; right-click takes them away */
  function paintStairs(tiles, ramp, remove) {
    const L = ED.L;
    let n = 0;
    for (const [x, y] of tiles) {
      const i = L.idx(x, y);
      if (remove) {
        if (L.stairs.has(i)) { L.top[i] += 1; L.stairs.delete(i); L.ramps.delete(i); n++; }
        continue;
      }
      if (L.stairs.has(i)) { if (ramp) L.ramps.add(i); else L.ramps.delete(i); n++; continue; }
      if (L.cells[i] !== LEDGE || !L.top[i]) continue;
      L.top[i] -= 1;
      L.cells[i] = FLOOR;
      L.stairs.add(i);
      if (ramp) L.ramps.add(i);
      n++;
    }
    return n;
  }
  /* a bridge over the pit in a rectangle: its pit becomes floor at the lower of the two banks' tiers, the planks drawn on it */
  function makeBridge(tiles) {
    const L = ED.L, [x0, y0, x1, y1] = boxOf(tiles), pit = [];
    for (const [x, y] of tiles) if (L.cell(x, y) === PIT) pit.push(L.idx(x, y));
    if (!pit.length) return 0;
    let bank = 99;
    for (const [x, y] of tiles) for (const [dx, dy] of N4) {
      const nx = x + dx, ny = y + dy;
      if (nx >= x0 && nx <= x1 && ny >= y0 && ny <= y1) continue;
      if (L.inb(nx, ny) && ground(L.cell(nx, ny))) bank = Math.min(bank, hOf(L, L.idx(nx, ny)));
    }
    if (bank === 99) bank = 0;
    for (const i of pit) { L.cells[i] = FLOOR; L.top[i] = bank; L.stairs.delete(i); L.ramps.delete(i); }
    L.bridges.push({ x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1, pit });
    return pit.length;
  }
  /* the bridge under a tile taken away: what was pit is pit again */
  function removeBridge(tx, ty) {
    const L = ED.L, k = L.bridges.findIndex((b) => tx >= b.x0 && tx < b.x0 + b.w && ty >= b.y0 && ty < b.y0 + b.h);
    if (k < 0) return false;
    const b = L.bridges[k];
    const pit = b.pit || [];
    if (!b.pit) for (let y = b.y0; y < b.y0 + b.h; y++) for (let x = b.x0; x < b.x0 + b.w; x++) pit.push(L.idx(x, y)); // (a generated bridge: its whole span)
    for (const i of pit) { L.cells[i] = PIT; L.top[i] = 0; }
    L.bridges.splice(k, 1);
    return true;
  }

  T.height = {
    label: 'Height', ic: '⛰', key: 'R', tip: 'Raise and lower the ground; put stairs, ramps and bridges on it', brush: true,
    sub: [['0', 'Ground', 'Lower to the ground'], ['1', 'Tier 1', 'Raise to the first tier'], ['2', 'Tier 2'], ['3', 'Tier 3'],
      ['stairs', 'Stairs', 'Click or drag along a rim to open it with stairs'], ['ramp', 'Ramp', 'Stairs drawn as a slope'],
      ['bridge', 'Bridge', 'Drag a rectangle over a pit or chasm']],
    hint: 'Paint a tier; its rim builds itself. Stairs or Ramp on a rim lets heroes up. Bridge: drag over a pit. Right-click undoes a piece. Shift+drag fills a rectangle.',
    down(m) {
      ED.heightReady(ED.L);
      const s = sub();
      hd = { s, start: tileAt(m), rect: s === 'bridge' || m.shift, right: m.button === 2, tiles: new Map() };
      if (s === 'bridge' && hd.right) { const [tx, ty] = hd.start; hd = null; if (!ED.groundAct('remove a bridge', () => removeBridge(tx, ty))) ED.toast('No bridge there.'); return; }
      if (!hd.rect) for (const [x, y] of brushTiles(m)) hd.tiles.set(x + ',' + y, [x, y]);
    },
    move(m) {
      if (!hd || !m.down || hd.rect) return;
      for (const [x, y] of brushTiles(m)) hd.tiles.set(x + ',' + y, [x, y]);
    },
    up(m) {
      if (!hd) return;
      const h = hd;
      hd = null;
      const tiles = h.rect ? rectTiles(h.start, tileAt(m)) : [...h.tiles.values()];
      if (!tiles.length) return;
      const [x0, y0, x1, y1] = boxOf(tiles);
      if (h.s === 'bridge') {
        if (!ED.groundAct('lay a bridge', () => { makeBridge(tiles); ED.settleHeight(x0, y0, x1, y1); })) ED.toast('A bridge goes over a pit or a chasm: drag across one.');
        return;
      }
      if (h.s === 'stairs' || h.s === 'ramp') {
        let n = 0;
        const done = ED.groundAct((h.right ? 'take away ' : 'lay ') + h.s, () => { n = paintStairs(tiles, h.s === 'ramp', h.right); ED.settleHeight(x0, y0, x1, y1); });
        if (!done && !n) ED.toast(h.right ? 'No stairs there.' : 'Stairs go on a rim: the edge of raised ground (paint a tier first).');
        return;
      }
      const v = h.right ? 0 : Math.min(MAXT, +h.s || 0);
      ED.groundAct(v ? 'raise to tier ' + v : 'lower to the ground', () => { paintTier(tiles, v); ED.settleHeight(x0, y0, x1, y1); });
    },
    draw(g, z) {
      const L = ED.L, s = sub();
      g.lineWidth = 1.5 / z;
      g.strokeStyle = s === 'bridge' ? '#c89a5a' : s === 'stairs' || s === 'ramp' ? '#7be38a' : TIER[Math.min(MAXT, +s || 0)];
      if (hd && hd.rect) {
        const [x1, y1] = tileAt(ED.mouse), [ax, ay] = hd.start;
        g.strokeRect(Math.min(ax, x1) * TS, Math.min(ay, y1) * TS, (Math.abs(x1 - ax) + 1) * TS, (Math.abs(y1 - ay) + 1) * TS);
        return;
      }
      if (hd) { g.fillStyle = 'rgba(255,255,255,0.12)'; for (const [x, y] of hd.tiles.values()) g.fillRect(x * TS, y * TS, TS, TS); }
      const r = s === 'bridge' ? 0 : ED.brush - 1, [tx, ty] = tileAt(ED.mouse);
      g.strokeRect((tx - r) * TS, (ty - r) * TS, (r * 2 + 1) * TS, (r * 2 + 1) * TS);
    },
  };

  /* what the map shows while the tool is out: each tier tinted, rims outlined, stairs arrowed, bridges framed */
  const TIER = ['#7be38a', '#6fd3ff', '#ffb347', '#ff6ad5'];
  ED.drawHeight = function (g, z, v0, v1) {
    const L = ED.L;
    if (!L || !L.top) return;
    const tx0 = Math.max(0, Math.floor(v0.x / TS)), ty0 = Math.max(0, Math.floor(v0.y / TS)), tx1 = Math.min(L.tw - 1, Math.floor(v1.x / TS)), ty1 = Math.min(L.th - 1, Math.floor(v1.y / TS));
    g.lineWidth = 1 / z;
    for (let y = ty0; y <= ty1; y++) for (let x = tx0; x <= tx1; x++) {
      const i = L.idx(x, y), v = L.cells[i];
      if (!ground(v)) continue;
      const stair = L.stairs.has(i), t = stair ? L.top[i] + 1 : L.top[i];
      if (!t) continue;
      const c = TIER[Math.min(MAXT, t)];
      g.globalAlpha = v === LEDGE ? 0.42 : 0.2;
      g.fillStyle = c;
      g.fillRect(x * TS, y * TS, TS, TS);
      g.globalAlpha = 1;
      if (stair) { // an arrow up the stairs, toward the higher side
        let ux = 0, uy = -1;
        for (const [dx, dy] of N4) if (L.inb(x + dx, y + dy) && ground(L.cell(x + dx, y + dy)) && hOf(L, L.idx(x + dx, y + dy)) >= t && !L.stairs.has(L.idx(x + dx, y + dy))) { ux = dx; uy = dy; break; }
        const cx = x * TS + 16, cy = y * TS + 16;
        g.strokeStyle = '#ffffff';
        g.lineWidth = 2 / z;
        g.beginPath();
        g.moveTo(cx - ux * 9, cy - uy * 9); g.lineTo(cx + ux * 9, cy + uy * 9);
        g.moveTo(cx + ux * 9 - uy * 5 - ux * 5, cy + uy * 9 + ux * 5 - uy * 5); g.lineTo(cx + ux * 9, cy + uy * 9); g.lineTo(cx + ux * 9 + uy * 5 - ux * 5, cy + uy * 9 - ux * 5 - uy * 5);
        g.stroke();
        g.lineWidth = 1 / z;
      } else if (z >= 0.8 && v !== LEDGE) {
        g.fillStyle = 'rgba(255,255,255,0.55)';
        g.font = 10 / Math.max(1, z / 2) + 'px sans-serif';
        if ((x + y) % 3 === 0) g.fillText(String(t), x * TS + 12, y * TS + 20);
      }
    }
    g.setLineDash([4 / z, 3 / z]);
    g.strokeStyle = '#c89a5a';
    for (const b of L.bridges || []) g.strokeRect(b.x0 * TS, b.y0 * TS, b.w * TS, b.h * TS);
    g.setLineDash([]);
  };
  ED.heightHere = heightHere;
  function heightHere(tx, ty) {
    const L = ED.L, i = L.idx(tx, ty), v = L.cells[i];
    if (L.stairs.has(i)) return (L.ramps.has(i) ? 'Ramp' : 'Stairs') + ' from tier ' + L.top[i] + ' up to ' + (L.top[i] + 1);
    if (L.bridges.some((b) => tx >= b.x0 && tx < b.x0 + b.w && ty >= b.y0 && ty < b.y0 + b.h)) return 'Bridge (tier ' + L.top[i] + ')';
    if (v === LEDGE) return 'Rim of tier ' + L.top[i] + ': heroes jump down from it, stairs let them up';
    if (v === FLOOR) return L.top[i] ? 'Tier ' + L.top[i] : 'Ground';
    return v === PIT ? 'Pit' : 'Wall';
  }

  /* what the stage check says about height: stairs that lead nowhere, raised ground with no way up */
  ED.heightIssues = function () {
    const L = ED.L, out = [];
    if (!L.top) return out;
    for (const i of L.stairs) {
      const x = i % L.tw, y = (i / L.tw) | 0, t = L.top[i];
      let up = false, down = false;
      for (const [dx, dy] of N4) {
        if (!L.inb(x + dx, y + dy)) continue;
        const j = L.idx(x + dx, y + dy);
        if (L.cells[j] !== FLOOR) continue;
        const h = hOf(L, j);
        if (h > t && !L.stairs.has(j)) up = true;
        if (h <= t) down = true;
      }
      if (!up || !down) out.push('Stairs at tile ' + x + ', ' + y + ' lead nowhere: put them in a rim, with low ground on one side and the top on the other.');
    }
    // raised ground: every patch of a tier needs stairs or a ramp, or it can only be jumped down from
    const seen = new Uint8Array(L.cells.length);
    for (let s = 0; s < L.cells.length; s++) {
      if (seen[s] || L.cells[s] !== FLOOR || !L.top[s] || L.stairs.has(s)) continue;
      const t = L.top[s], stack = [s];
      let n = 0, way = false;
      seen[s] = 1;
      while (stack.length) {
        const i = stack.pop(), x = i % L.tw, y = (i / L.tw) | 0;
        n++;
        for (const [dx, dy] of N4) {
          if (!L.inb(x + dx, y + dy)) continue;
          const j = L.idx(x + dx, y + dy);
          if (L.stairs.has(j) && L.top[j] + 1 === t) way = true;
          if (!seen[j] && L.cells[j] === FLOOR && L.top[j] === t && !L.stairs.has(j)) { seen[j] = 1; stack.push(j); }
        }
        if (L.bridges.some((b) => x >= b.x0 - 1 && x <= b.x0 + b.w && y >= b.y0 - 1 && y <= b.y0 + b.h)) way = true;
      }
      if (!way && n >= 2) out.push('Tier ' + t + ' ground at tile ' + (s % L.tw) + ', ' + ((s / L.tw) | 0) + ' has no stairs or ramp: heroes can only jump down from it.');
    }
    return out;
  };
})(window.CH);
