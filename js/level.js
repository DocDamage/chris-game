/* CHAOS.exe - the Level model (PLAN.md R3/R4/R5): a tile grid with walls, collision for circles, line of sight,
   flow-field pathing, fog of war, a chunked floor+wall renderer and a minimap.
   A Level also acts as an "arena" for the old code (it carries id, name, w, h, props, anim, theme), so everything that
   reads G.arena keeps working. Levels are made by js/levelgen.js and driven by js/run.js. */
(function (CH) {
  'use strict';
  const B = CH.Balance;
  const U = CH.U;

  const TS = 32; // tile size in world pixels
  const CHUNK = 8; // tiles per floor chunk side
  const FLOOR = 0, WALL = 1, CRACKED = 3;

  /* per-biome look: floor painter, wall colours, light level */
  const STYLE = {
    backyard: { floor: 'sheet', key: 'tile.grass', sheet: 'tile.hedge', wall: '#2c5a22', top: '#3f7a30', edge: '#1a3a14', speck: ['#ffffff14', '#00000014'] },
    office: { floor: 'pattern', key: 'tile.dungeon_floor', ftint: '#93a6dc', sheet: 'wall.office', a: '#5d6b8a', b: '#667597', wall: '#2a3045', top: '#434c6b', edge: '#171b2a' },
    glitch: { floor: 'pattern', key: 'tile.dungeon_floor', ftint: '#8a3ce0', sheet: 'wall.glitch', a: '#1b1226', wall: '#0f0b1a', top: '#251a3c', edge: '#ff2bd6' },
    zombie: { floor: 'pattern', sheet: 'wall.zombie', key: 'tile.zombie_street', wall: '#1c1e24', top: '#3a3e48', edge: '#0d0e12' },
    wasteland: { floor: 'pattern', sheet: 'wall.wasteland', key: 'tile.wl_ground', wall: '#4a2f1c', top: '#7a5230', edge: '#27180e', wallKey: 'tile.wl_metal' },
    volcano: { floor: 'pattern', sheet: 'wall.volcano', key: 'tile.volcano_floor', wall: '#1a0e0c', top: '#3a1c14', edge: '#ff5a1a' },
    dungeon: { floor: 'pattern', sheet: 'wall.dungeon', key: 'tile.dungeon_floor', wall: '#0a090e', top: '#26222f', edge: '#050408', wallKey: 'tile.dungeon_wall' },
    // the Gaslight District (PLAN.md 18, K4): cobbled streets (kit.hv1), slab pavements (kit.hv2), grates; city walls
    gaslight: {
      floor: 'kit', sheet: 'wall.zombie', ftint: null, tint: '#6a5e78', wall: '#14121a', top: '#2a2533', edge: '#09080d', trail: 'kit.hv2.0',
      mats: {
        dirt: { base: ['hv1.0', 'hv1.1', 'hv1.2'], acc: ['hv1.3', 'hv1.4', 'hv1.5', 'hv1.10', 'hv1.11', 'hv1.12', 'hv1.13'] },
        moss: { base: ['hv1.14', 'hv1.15'], acc: ['hv1.16', 'hv1.18', 'hv1.19', 'hv1.6', 'hv1.8'] },
        roots: { base: ['hv2.0', 'hv2.1', 'hv2.2'], acc: ['hv2.3', 'hv2.4', 'hv2.5', 'hv2.6', 'hv2.7', 'hv2.9', 'hv2.10', 'hv2.11', 'hv2.13', 'hv2.14', 'hv2.18'] },
        rust: { base: ['hv1.20', 'hv1.21'], acc: ['hv1.22', 'hv1.23', 'hv1.24', 'hv1.25'] },
        stone: { base: ['hv1.26', 'hv1.27'], acc: ['hv1.28', 'hv1.30', 'hv2.39', 'hv2.40', 'hv2.41', 'hv2.42'] },
        swamp: { base: ['hv2.44', 'hv2.45'], acc: ['hv1.40', 'hv1.41'] },
      },
    },
    // the Frozen Kingdom (PLAN.md 18, K3): its snow swatches (kit.fk1) in patches of powder, frost, cracked ice, cobbles,
    // crystals and dark ice; a cobbled road
    frozen: {
      floor: 'kit', key: 'tile.rock', sheet: 'tile.rock', tint: '#7f9bc8', a: '#c9dcea', wall: '#5c7a96', top: '#9fc0d8', edge: '#2f4256', trail: 'kit.fk1.5',
      mats: {
        dirt: { base: ['fk1.0'], acc: ['fk1.1', 'fk1.2', 'fk1.7'] },
        moss: { base: ['fk1.6'], acc: ['fk1.3', 'fk1.9'] },
        roots: { base: ['fk1.11'], acc: ['fk1.8', 'fk1.14'] },
        rust: { base: ['fk1.2'], acc: ['fk1.16', 'fk1.15', 'fk1.17'] },
        stone: { base: ['fk1.5'], acc: ['fk1.10'] },
        swamp: { base: ['fk1.13'], acc: ['fk1.14'] },
      },
    },
    // The Dead Wood (PLAN.md 18, K2): Creepy Forest ground swatches (kit.cf1 / kit.cf2) in patches of dirt, moss and roots,
    // bounded by the rock cliff darkened to a wet, mossy brown; a cobbled path
    deadwood: {
      floor: 'kit', sheet: 'tile.rock', tint: '#5d5a4a', wall: '#1d1f17', top: '#34352a', edge: '#0f100b', trail: 'kit.cf1.16',
      // per material: base swatches of one tone (most tiles) and accents (about one tile in six), so patches read as
      // patches and not as a checkerboard
      mats: {
        dirt: { base: ['cf1.7', 'cf1.32', 'cf1.33'], acc: ['cf1.4', 'cf1.8', 'cf1.9', 'cf1.14', 'cf1.15', 'cf1.31', 'cf2.0', 'cf2.1', 'cf2.2', 'cf2.3', 'cf2.14', 'cf2.31', 'cf2.32'] },
        moss: { base: ['cf2.7', 'cf2.15'], acc: ['cf2.4', 'cf2.8', 'cf2.9', 'cf2.10', 'cf2.11', 'cf2.12', 'cf2.13', 'cf2.16', 'cf2.21', 'cf2.23', 'cf2.24', 'cf2.34', 'cf1.5', 'cf1.6', 'cf1.12', 'cf1.13', 'cf1.29'] },
        roots: { base: ['cf1.22', 'cf1.23', 'cf1.30'], acc: ['cf1.24', 'cf1.25', 'cf1.26', 'cf1.27', 'cf1.28', 'cf1.34', 'cf1.35', 'cf2.26', 'cf2.28', 'cf2.29', 'cf2.30', 'cf2.33'] },
        rust: { base: ['cf1.0', 'cf1.1'], acc: ['cf1.2', 'cf1.3', 'cf2.6'] },
        stone: { base: ['cf1.16', 'cf1.17'], acc: ['cf1.10', 'cf1.18', 'cf2.20'] },
        swamp: { base: ['cf2.19'], acc: ['cf2.17', 'cf2.18', 'cf2.22', 'cf2.25', 'cf2.27'] },
      },
    },
  };
  Level_style_default();
  function Level_style_default() { STYLE.default = STYLE.dungeon; }

  /* the 43px ground textures carry a transparent rim; crop to the fully opaque core so they tile without seams */
  const seams = {};
  function seamless(key) {
    if (seams[key]) return seams[key];
    const im = CH.Assets.images[key];
    const c0 = document.createElement('canvas');
    c0.width = im.width; c0.height = im.height;
    const g0 = c0.getContext('2d');
    g0.drawImage(im, 0, 0);
    const d = g0.getImageData(0, 0, c0.width, c0.height).data;
    const solidAt = (x, y) => d[(y * c0.width + x) * 4 + 3] > 200;
    let x1 = 0, y1 = 0, x2 = c0.width - 1, y2 = c0.height - 1;
    const rowFull = (y) => { for (let x = x1; x <= x2; x++) if (!solidAt(x, y)) return false; return true; };
    const colFull = (x) => { for (let y = y1; y <= y2; y++) if (!solidAt(x, y)) return false; return true; };
    for (let n = 0; n < 12; n++) { let ch = false; if (!rowFull(y1)) { y1++; ch = true; } if (!rowFull(y2)) { y2--; ch = true; } if (!colFull(x1)) { x1++; ch = true; } if (!colFull(x2)) { x2--; ch = true; } if (!ch) break; }
    const c = document.createElement('canvas');
    c.width = Math.max(8, x2 - x1 + 1); c.height = Math.max(8, y2 - y1 + 1);
    c.getContext('2d').drawImage(c0, x1, y1, c.width, c.height, 0, 0, c.width, c.height);
    return (seams[key] = c);
  }
  const tinted = {};
  function wallSheet(st) { return tintOf(CH.Assets.images[st.sheet], st.sheet, st.tint); }
  function tintOf(im, name, tint) {
    if (!im) return null;
    if (!tint) return im;
    const k = name + tint;
    if (tinted[k]) return tinted[k];
    const c = document.createElement('canvas');
    c.width = im.width; c.height = im.height;
    const g = c.getContext('2d');
    g.drawImage(im, 0, 0);
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = tint;
    g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = 'destination-in';
    g.drawImage(im, 0, 0);
    return (tinted[k] = c);
  }
  const canvas = (w, h) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  };

  class Level {
    constructor(w, h, biome) {
      this.tw = w;
      this.th = h;
      this.w = w * TS; // world size (arena compatible)
      this.h = h * TS;
      this.id = biome;
      this.biome = biome;
      this.cells = new Uint8Array(w * h).fill(WALL);
      this.explored = new Uint8Array(w * h);
      this.rooms = [];
      this.props = [];
      this.anim = [];
      this.spawners = [];
      this.packs = [];
      this.shrines = [];
      this.chests = [];
      this.puddles = [];
      this.secrets = [];
      this.entrance = null;
      this.exit = null;
      this.waypoints = [];
      this.chunks = new Map();
      this.fogDirty = true;
      this.crackHp = new Map();
      this.isLevel = true;
      this.flows = new Map();
      this.style = STYLE[biome] || STYLE.default;
      this.theme = (CH.Arenas.THEMES && CH.Arenas.THEMES[biome]) || (CH.Arenas.THEMES && CH.Arenas.THEMES.dungeon) || {};
      this.name = this.theme.name || 'The Depths';
      this.tag = this.theme.tag || '';
      this.mini = null;
      this.miniDirty = true;
    }

    idx(tx, ty) { return ty * this.tw + tx; }
    inb(tx, ty) { return tx >= 0 && ty >= 0 && tx < this.tw && ty < this.th; }
    cell(tx, ty) { return this.inb(tx, ty) ? this.cells[ty * this.tw + tx] : WALL; }
    solid(tx, ty) { return this.cell(tx, ty) !== FLOOR; }
    solidAt(x, y) { return this.solid(Math.floor(x / TS), Math.floor(y / TS)); }
    set(tx, ty, v) {
      if (this.inb(tx, ty)) {
        this.cells[ty * this.tw + tx] = v;
        this.chunks.delete(Math.floor(tx / CHUNK) + ',' + Math.floor(ty / CHUNK));
        this.miniDirty = true;
        this.flows.clear();
      }
    }
    carveRect(x0, y0, w, h) {
      for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (x > 0 && y > 0 && x < this.tw - 1 && y < this.th - 1) this.cells[y * this.tw + x] = FLOOR;
    }
    carveCircle(cx, cy, r) {
      for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        if (x > 0 && y > 0 && x < this.tw - 1 && y < this.th - 1 && (x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r) this.cells[y * this.tw + x] = FLOOR;
      }
    }

    /* ---- collision: push a circle out of the wall tiles it overlaps (World.settleWalls, once per step) ---- */
    pushOut(e, r) {
      r = r || e.r || 8;
      let moved = false;
      for (let pass = 0; pass < 2; pass++) {
        const x0 = Math.floor((e.x - r) / TS), x1 = Math.floor((e.x + r) / TS);
        const y0 = Math.floor((e.y - r) / TS), y1 = Math.floor((e.y + r) / TS);
        for (let ty = y0; ty <= y1; ty++) {
          for (let tx = x0; tx <= x1; tx++) {
            if (!this.solid(tx, ty)) continue;
            const rx0 = tx * TS, ry0 = ty * TS;
            if (CH.World.pushBox(e, 0, r, rx0, ry0, rx0 + TS, ry0 + TS)) moved = true;
          }
        }
        if (!moved) break;
      }
      if (moved) {
        if (e.kx !== undefined) { e.kx *= 0.5; e.ky *= 0.5; }
        e.wallHit = true;
      }
      return moved;
    }

    /* the same, for bodies that touch the ground with their feet: the circle sits `off` pixels below the centre
       (World.FEET says where each kind of body's feet are and how big) */
    pushOutFeet(e, r, off) {
      e.y += off;
      const m = this.pushOut(e, r || 8);
      e.y -= off;
      return m;
    }

    /* ---- line of sight on the grid (Bresenham) ---- */
    los(x0, y0, x1, y1) {
      let tx = Math.floor(x0 / TS), ty = Math.floor(y0 / TS);
      const ex = Math.floor(x1 / TS), ey = Math.floor(y1 / TS);
      const dx = Math.abs(ex - tx), dy = -Math.abs(ey - ty);
      const sx = tx < ex ? 1 : -1, sy = ty < ey ? 1 : -1;
      let err = dx + dy;
      for (let n = 0; n < 400; n++) {
        if (this.solid(tx, ty)) return false;
        if (tx === ex && ty === ey) return true;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; tx += sx; }
        if (e2 <= dx) { err += dx; ty += sy; }
      }
      return true;
    }

    /* ---- flow field: BFS distances from a world point; dir() steps downhill ---- */
    flowFor(x, y) {
      const tx = Math.floor(x / TS), ty = Math.floor(y / TS);
      const key = tx + ',' + ty;
      let f = this.flows.get(key);
      if (f) return f;
      if (this.flows.size > 6) this.flows.clear();
      const dist = new Int16Array(this.tw * this.th).fill(-1);
      const q = new Int32Array(this.tw * this.th);
      let h = 0, t = 0;
      if (this.solid(tx, ty)) {
        // start inside a wall (knocked into it): use the nearest floor tile
        let found = false;
        for (let r = 1; r < 4 && !found; r++) for (let oy = -r; oy <= r && !found; oy++) for (let ox = -r; ox <= r && !found; ox++) if (!this.solid(tx + ox, ty + oy)) { q[t++] = this.idx(tx + ox, ty + oy); dist[q[t - 1]] = 0; found = true; }
      } else { q[t++] = this.idx(tx, ty); dist[q[0]] = 0; }
      const D8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
      // solid props block their tile for walkers (a monster should path around a crate, not push into it)
      const pb = new Uint8Array(this.tw * this.th);
      for (const p of this.props) {
        if (!p.solid || p.dead) continue;
        // a small prop (a crate, a stool) only blocks a tile whose middle a walker's feet (7 px) could not stand on;
        // ignoring them sent walkers straight into them, where the slower ones stuck
        const small = (p.cr || 10) < 9;
        if (p.box) { // a box footprint blocks the tiles it covers (plus a walker's half width)
          const bx = p.x + (p.cx || 0), by = p.y + (p.cy || 0), hw = p.box.hw + (small ? 7 : 6), hh = p.box.hh + (small ? 7 : 6), m = small ? 0 : TS * 0.25;
          for (let ty = Math.floor((by - hh) / TS); ty <= Math.floor((by + hh) / TS); ty++) for (let tx = Math.floor((bx - hw) / TS); tx <= Math.floor((bx + hw) / TS); tx++) {
            if (!this.inb(tx, ty)) continue;
            const cx = (tx + 0.5) * TS, cy = (ty + 0.5) * TS;
            if (Math.abs(cx - bx) < hw + m && Math.abs(cy - by) < hh + m) pb[ty * this.tw + tx] = 1;
          }
          continue;
        }
        const px = p.x + (p.cx || 0), py = p.y + (p.cy || 0), rr = (p.cr || 10) + (small ? 7 : 11); // a walker's body plus a little room
        for (let ty = Math.floor((py - rr) / TS); ty <= Math.floor((py + rr) / TS); ty++) for (let tx = Math.floor((px - rr) / TS); tx <= Math.floor((px + rr) / TS); tx++) {
          if (this.inb(tx, ty) && Math.hypot((tx + 0.5) * TS - px, (ty + 0.5) * TS - py) < rr) pb[ty * this.tw + tx] = 1;
        }
      }
      pb[q[0]] = 0;
      while (h < t) {
        const c = q[h++];
        const cx = c % this.tw, cy = (c / this.tw) | 0;
        const dc = dist[c];
        for (let k = 0; k < 8; k++) {
          const nx = cx + D8[k][0], ny = cy + D8[k][1];
          if (!this.inb(nx, ny) || this.cells[ny * this.tw + nx] !== FLOOR || pb[ny * this.tw + nx]) continue;
          if (k > 3 && (this.cells[cy * this.tw + nx] !== FLOOR || this.cells[ny * this.tw + cx] !== FLOOR)) continue; // no corner cutting
          const ni = ny * this.tw + nx;
          if (dist[ni] >= 0) continue;
          dist[ni] = dc + (k > 3 ? 1.4 : 1);
          q[t++] = ni;
        }
      }
      f = { dist, tx, ty };
      this.flows.set(key, f);
      return f;
    }
    /* unit vector from (x, y) toward the field's target, or null when it is unreachable from here */
    flowDir(f, x, y) {
      const tx = Math.floor(x / TS), ty = Math.floor(y / TS);
      let c = f.dist[this.idx(tx, ty)];
      if (c === 0) return { x: 0, y: 0 };
      let best = c < 0 ? 1e9 : c, bx = 0, by = 0;
      // standing on a tile the field does not cover (right next to a crate): step to the best covered neighbour
      if (c < 0) c = 1e9;
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        if (!ox && !oy) continue;
        const nx = tx + ox, ny = ty + oy;
        if (!this.inb(nx, ny)) continue;
        if (ox && oy && (this.cell(tx + ox, ty) !== FLOOR || this.cell(tx, ty + oy) !== FLOOR)) continue; // no cutting corners (the BFS forbids it too)
        const d = f.dist[this.idx(nx, ny)];
        if (d >= 0 && d < best) { best = d; bx = ox; by = oy; }
      }
      if (!bx && !by) return null;
      if (best >= 1e9) return null;
      // aim at the middle of the chosen tile, not its corner
      const px = (tx + bx + 0.5) * TS - x, py = (ty + by + 0.5) * TS - y;
      const l = Math.hypot(px, py) || 1;
      return { x: px / l, y: py / l };
    }
    pathDist(x0, y0, x1, y1) {
      const f = this.flowFor(x1, y1);
      const tx = Math.floor(x0 / TS), ty = Math.floor(y0 / TS);
      let d = f.dist[this.idx(tx, ty)];
      if (d < 0) { // inside a tile the field skips (a crate stands there): count from the best neighbour
        let m = -1;
        for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) if ((ox || oy) && this.inb(tx + ox, ty + oy)) { const q = f.dist[this.idx(tx + ox, ty + oy)]; if (q >= 0 && (m < 0 || q < m)) m = q; }
        d = m < 0 ? -1 : m + 1;
      }
      return d < 0 ? Infinity : d * TS;
    }

    /* ---- helpers for placing things ---- */
    isOpen(x, y, clear) {
      const r = clear || 12;
      return !this.solidAt(x - r, y - r) && !this.solidAt(x + r, y - r) && !this.solidAt(x - r, y + r) && !this.solidAt(x + r, y + r);
    }
    /* a free floor point near (x, y) between rmin and rmax pixels */
    randomNear(x, y, rmin, rmax, clear, rng) {
      const rnd = rng || Math.random;
      for (let i = 0; i < 60; i++) {
        const a = rnd() * U.TAU, d = rmin + rnd() * (rmax - rmin);
        const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
        if (this.isOpen(px, py, clear || 12)) return { x: px, y: py };
      }
      return null;
    }
    nearestOpen(x, y) {
      if (this.isOpen(x, y)) return { x, y };
      for (let r = 1; r < 12; r++) for (let oy = -r; oy <= r; oy++) for (let ox = -r; ox <= r; ox++) {
        const px = x + ox * TS, py = y + oy * TS;
        if (this.isOpen(px, py)) return { x: px, y: py };
      }
      return { x, y };
    }

    /* ---- fog of war ---- */
    reveal(x, y, r) {
      const tx = Math.floor(x / TS), ty = Math.floor(y / TS), R = Math.ceil(r);
      let changed = false;
      for (let oy = -R; oy <= R; oy++) for (let ox = -R; ox <= R; ox++) {
        if (ox * ox + oy * oy > r * r) continue;
        const nx = tx + ox, ny = ty + oy;
        if (!this.inb(nx, ny)) continue;
        const i = ny * this.tw + nx;
        if (!this.explored[i]) {
          // walls only show when something open next to them is in line of sight (rooms do not leak through rock)
          if (this.cells[i] !== FLOOR && !this.los(x, y, nx * TS + TS / 2, ny * TS + TS / 2) && !this.nearOpenLos(x, y, nx, ny)) continue;
          if (this.cells[i] === FLOOR && !this.los(x, y, nx * TS + TS / 2, ny * TS + TS / 2)) continue;
          this.explored[i] = 1;
          changed = true;
        }
      }
      if (changed) { this.fogDirty = true; this.miniDirty = true; }
      return changed;
    }
    nearOpenLos(x, y, tx, ty) {
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        if ((ox || oy) && this.cell(tx + ox, ty + oy) === FLOOR && this.explored[this.idx(tx + ox, ty + oy)]) return true;
      }
      return false;
    }
    revealAll() { this.explored.fill(1); this.fogDirty = true; this.miniDirty = true; }
    exploredFraction() {
      let n = 0, f = 0;
      for (let i = 0; i < this.cells.length; i++) if (this.cells[i] === FLOOR) { n++; if (this.explored[i]) f++; }
      return n ? f / n : 1;
    }

    /* ---- drawing ---- */
    chunk(cx, cy) {
      const key = cx + ',' + cy;
      let c = this.chunks.get(key);
      if (c) return c;
      const size = CHUNK * TS;
      c = canvas(size, size + 12); // +12: the south face of walls on the last row spills below
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      const st = this.style;
      const x0 = cx * size, y0 = cy * size;
      this.paintFloor(g, st, x0, y0, size);
      if (this.trail) this.paintTrail(g, x0, y0, size);
      if (this.decals) for (const d of this.decals) { // floor decals from the sliced sheets
        const im = d.img || CH.Assets.images[d.key]; // set pieces bring the piece already at catalogue scale
        if (!im) continue;
        const dx = Math.round(d.x - im.width / 2 - x0), dy = Math.round(d.y - im.height / 2 - y0);
        if (dx > size || dy > size + 12 || dx + im.width < 0 || dy + im.height < 0) continue;
        g.globalAlpha = d.a || 1;
        if (d.fx || d.fy) { g.save(); g.translate(dx + (d.fx ? im.width : 0), dy + (d.fy ? im.height : 0)); g.scale(d.fx ? -1 : 1, d.fy ? -1 : 1); g.drawImage(im, 0, 0); g.restore(); }
        else g.drawImage(im, dx, dy);
        g.globalAlpha = 1;
      }
      // walls: flat tops with a lit rim, plus a short dark face on every open tile below a wall
      const IM = CH.Assets.images;
      for (let ty = 0; ty < CHUNK; ty++) {
        for (let tx = 0; tx < CHUNK; tx++) {
          const gx = cx * CHUNK + tx, gy = cy * CHUNK + ty;
          const v = this.cell(gx, gy);
          const px = tx * TS, py = ty * TS;
          if (v === FLOOR) {
            if (this.solid(gx, gy - 1)) { // shadow under the wall above
              g.fillStyle = 'rgba(0,0,0,0.38)';
              g.fillRect(px, py, TS, 8);
              g.fillStyle = 'rgba(0,0,0,0.18)';
              g.fillRect(px, py + 8, TS, 5);
            }
            continue;
          }
          this.paintWall(g, st, gx, gy, px, py);
          if (v === CRACKED) {
            g.strokeStyle = '#000000aa';
            g.lineWidth = 1;
            g.beginPath();
            g.moveTo(px + 4, py + 4); g.lineTo(px + 14, py + 14); g.lineTo(px + 11, py + 24); g.moveTo(px + 14, py + 14); g.lineTo(px + 27, py + 18);
            g.stroke();
          }
        }
      }
      this.chunks.set(key, c);
      return c;
    }
    /* walls are autotiled from the packs' 9-slice wall sheets (hedge / snowy rock, tinted per biome): four 16px
       sub-tiles per cell, each picking its edge piece from which of its own neighbours are open floor */
    paintWall(g, st, gx, gy, px, py) {
      const sheet = wallSheet(st);
      if (!sheet) { g.fillStyle = st.wall; g.fillRect(px, py, TS, TS); return; }
      const open = (sx, sy) => !this.solid(sx >> 1, sy >> 1);
      for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
        const sx = gx * 2 + i, sy = gy * 2 + j;
        const n = open(sx, sy - 1), so = open(sx, sy + 1), w = open(sx - 1, sy), e = open(sx + 1, sy);
        let col = w ? 0 : e ? 2 : 1, row = n ? 0 : so ? 2 : 1;
        let u = col, vv = row;
        if (col === 1 && row === 1) { const r = ((sx * 73856093) ^ (sy * 19349663)) >>> 0; const f = [[1, 1], [5, 2], [6, 2], [7, 2]][r % 4]; u = f[0]; vv = f[1]; }
        g.drawImage(sheet, u * 16, vv * 16, 16, 16, px + i * 16, py + j * 16, 16, 16);
      }
    }
    paintFloor(g, st, x0, y0, size) {
      const IM = CH.Assets.images;
      // a deterministic per-tile hash keeps the speckle stable when a chunk is rebuilt
      const h = (a, b) => { let n = (a * 374761393 + b * 668265263) | 0; n = (n ^ (n >> 13)) * 1274126177; return ((n ^ (n >> 16)) >>> 0) / 4294967296; };
      if (st.floor === 'sheet' && IM[st.key]) {
        const im = tintOf(IM[st.key], st.key, st.ftint);
        for (let y = 0; y < size; y += 16) for (let x = 0; x < size; x += 16) g.drawImage(im, 16, 16, 16, 16, x, y, 16, 16);
        for (let y = 0; y < size; y += 16) for (let x = 0; x < size; x += 16) {
          const r = h((x0 + x) / 16, (y0 + y) / 16);
          if (r < 0.45) { g.fillStyle = r < 0.22 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'; g.fillRect(x + ((r * 977) | 0) % 14, y + ((r * 613) | 0) % 14, 2, 1); }
        }
      } else if (st.floor === 'pattern' && IM[st.key]) {
        const tex = tintOf(seamless(st.key), 'seam:' + st.key, st.ftint);
        const pat = g.createPattern(tex, 'repeat');
        g.save();
        g.translate(-(x0 % tex.width), -(y0 % tex.height));
        g.fillStyle = pat;
        g.fillRect(0, 0, size + tex.width, size + tex.height);
        g.restore();
      } else if (st.floor === 'kit' && st.mats) {
        // patches: two slow value-noise fields pick the material, a per-tile hash picks the swatch
        const pick = (m, r) => { if (!m) return null; const list = r < 0.17 ? m.acc : m.base; return IM['kit.' + list[Math.floor((r < 0.17 ? r / 0.17 : (r - 0.17) / 0.83) * list.length) % list.length]]; };
        const vn = (x, y, s, k) => { // smooth value noise, cell size s tiles
          const fx = x / s, fy = y / s, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
          const a = h(ix + k, iy), b = h(ix + 1 + k, iy), c = h(ix + k, iy + 1), d = h(ix + 1 + k, iy + 1);
          const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
          return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
        };
        const M = st.mats;
        for (let y = 0; y < size; y += TS) for (let x = 0; x < size; x += TS) {
          const tx = (x0 + x) / TS, ty = (y0 + y) / TS;
          const n1 = vn(tx, ty, 10, 11), n2 = vn(tx, ty, 8, 97), r = h(tx, ty);
          const mat = n2 > 0.78 ? 'rust' : n1 < 0.12 ? 'swamp' : n1 < 0.34 ? 'moss' : n1 > 0.72 ? 'roots' : n2 < 0.14 ? 'stone' : 'dirt';
          const im = pick(M[mat], r) || pick(M.dirt, r);
          if (im) g.drawImage(im, x, y, TS, TS);
          else { g.fillStyle = st.top; g.fillRect(x, y, TS, TS); }
        }
      } else if (st.floor === 'check') {
        for (let y = 0; y < size; y += 16) for (let x = 0; x < size; x += 16) { g.fillStyle = ((x0 + x) / 16 + (y0 + y) / 16) % 2 ? st.b : st.a; g.fillRect(x, y, 16, 16); }
      } else {
        g.fillStyle = st.a || '#1b1226';
        g.fillRect(0, 0, size, size);
        for (let i = 0; i < 90; i++) { g.fillStyle = h(x0 + i, y0 + i * 3) < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.12)'; g.fillRect(h(i, x0) * size, h(y0, i) * size, 2, 1); }
      }
      // faint tile grid so the 32px structure reads
      g.fillStyle = 'rgba(0,0,0,0.05)';
      for (let i = 0; i < size; i += TS) { g.fillRect(i, 0, 1, size); g.fillRect(0, i, size, 1); }
    }

    /* the way from the entrance to the exit, worn into the floor (js/setpieces.js marks it): a dirt track through
       grass, a road with a dashed line through the city, tyre tracks in the wasteland, a trodden strip indoors */
    paintTrail(g, x0, y0, size) {
      const IM = CH.Assets.images;
      const h = (a, b) => { let n = (a * 374761393 + b * 668265263) | 0; n = (n ^ (n >> 13)) * 1274126177; return ((n ^ (n >> 16)) >>> 0) / 4294967296; };
      const b = this.biome;
      const dirtIm = this.style.trail && IM[this.style.trail] ? IM[this.style.trail] : (b === 'backyard' || b === 'frozen') && IM['tile.dirt'] ? tintOf(IM['tile.dirt'], 'tile.dirt', b === 'frozen' ? '#b8c6d8' : null) : null;
      // a ribbon of overlapping discs, one per route tile, jittered by a tile hash so neighbouring chunks agree
      const tx0 = Math.floor(x0 / TS) - 1, ty0 = Math.floor(y0 / TS) - 1, n = size / TS + 2;
      const disc = [];
      for (let ty = ty0; ty < ty0 + n; ty++) for (let tx = tx0; tx < tx0 + n; tx++) {
        if (!this.inb(tx, ty) || this.trail[this.idx(tx, ty)] !== 2) continue;
        const x = tx * TS + 16 + (h(tx, ty) - 0.5) * 10 - x0, y = ty * TS + 16 + (h(ty, tx) - 0.5) * 10 - y0, r = 17 + h(tx + 7, ty) * 8;
        disc.push([x, y, r, tx, ty]);
        // a disc halfway to each following route tile fills the scallops between them
        for (const [ox, oy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
          const nx = tx + ox, ny = ty + oy;
          if (!this.inb(nx, ny) || this.trail[this.idx(nx, ny)] !== 2) continue;
          const x2 = nx * TS + 16 + (h(nx, ny) - 0.5) * 10 - x0, y2 = ny * TS + 16 + (h(ny, nx) - 0.5) * 10 - y0;
          disc.push([(x + x2) / 2, (y + y2) / 2, r * 0.92, -1, -1]);
        }
      }
      if (!disc.length) return;
      g.save();
      g.beginPath();
      for (const [x, y, r] of disc) { g.moveTo(x + r, y); g.arc(x, y, r, 0, Math.PI * 2); }
      g.clip();
      if (dirtIm) {
        g.fillStyle = g.createPattern(dirtIm, 'repeat');
        g.translate(-(x0 % 16), -(y0 % 16));
        g.fillRect(-16, -16, size + 32, size + 44);
        g.translate(x0 % 16, y0 % 16);
      } else {
        g.fillStyle = b === 'volcano' ? 'rgba(20,6,4,0.3)' : b === 'zombie' ? 'rgba(10,10,14,0.32)' : b === 'wasteland' ? 'rgba(40,26,14,0.22)' : 'rgba(0,0,0,0.16)';
        g.fillRect(0, 0, size, size + 12);
      }
      g.restore();
      // a soft rim, then the marks of use: pebbles, tyre tracks, the dashed line of a road
      g.fillStyle = dirtIm ? 'rgba(70,50,25,0.18)' : 'rgba(0,0,0,0.08)';
      for (const [x, y, r] of disc) for (let k = 0; k < 6; k++) { const a = h(x | 0, k) * 6.283; g.fillRect(Math.round(x + Math.cos(a) * r) - 1, Math.round(y + Math.sin(a) * r * 0.9), 3, 1); }
      for (const [x, y, , tx, ty] of disc) {
        if (tx < 0) continue;
        if (b === 'zombie' && (tx + ty) % 2 === 0) { g.fillStyle = 'rgba(232,196,60,0.5)'; g.fillRect(Math.round(x) - 4, Math.round(y) - 1, 8, 3); }
        else if (b === 'wasteland') { g.fillStyle = 'rgba(30,18,10,0.22)'; g.fillRect(Math.round(x) - 9, Math.round(y) - 16, 3, 32); g.fillRect(Math.round(x) + 6, Math.round(y) - 16, 3, 32); }
        else if (dirtIm && h(tx, ty) < 0.5) { g.fillStyle = 'rgba(60,40,20,0.3)'; g.fillRect(Math.round(x + (h(ty, tx) - 0.5) * 24), Math.round(y + (h(tx + 3, ty) - 0.5) * 20), 3, 2); }
      }
    }

    drawFloor(ctx, cam, W, H) {
      const size = CHUNK * TS;
      const cx0 = Math.max(0, Math.floor(cam.x / size)), cy0 = Math.max(0, Math.floor(cam.y / size));
      const cx1 = Math.min(Math.ceil(this.tw / CHUNK) - 1, Math.floor((cam.x + W) / size)), cy1 = Math.min(Math.ceil(this.th / CHUNK) - 1, Math.floor((cam.y + H) / size));
      ctx.fillStyle = this.style.wall;
      ctx.fillRect(0, 0, W, H);
      for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) ctx.drawImage(this.chunk(cx, cy), Math.round(cx * size - cam.x), Math.round(cy * size - cam.y));
    }

    /* fog drawn as a tile-resolution alpha map, stretched with smoothing for soft edges */
    drawFog(ctx, cam, W, H) {
      if (!this.fog) {
        this.fog = canvas(this.tw, this.th);
        this.fogCtx = this.fog.getContext('2d');
        this.fogDirty = true;
      }
      if (this.fogDirty) {
        const img = this.fogCtx.createImageData(this.tw, this.th);
        for (let i = 0; i < this.explored.length; i++) { img.data[i * 4 + 3] = this.explored[i] ? 0 : 255; img.data[i * 4] = 6; img.data[i * 4 + 1] = 4; img.data[i * 4 + 2] = 12; }
        this.fogCtx.putImageData(img, 0, 0);
        this.fogDirty = false;
      }
      const tx0 = Math.max(0, Math.floor(cam.x / TS) - 1), ty0 = Math.max(0, Math.floor(cam.y / TS) - 1);
      const tx1 = Math.min(this.tw, Math.ceil((cam.x + W) / TS) + 1), ty1 = Math.min(this.th, Math.ceil((cam.y + H) / TS) + 1);
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(this.fog, tx0, ty0, tx1 - tx0, ty1 - ty0, tx0 * TS - cam.x, ty0 * TS - cam.y, (tx1 - tx0) * TS, (ty1 - ty0) * TS);
      ctx.restore();
    }

    /* ---- minimap: one pixel per tile, a window around the hero ---- */
    buildMini() {
      if (!this.mini) {
        this.mini = canvas(this.tw, this.th);
        this.miniCtx = this.mini.getContext('2d');
      }
      const img = this.miniCtx.createImageData(this.tw, this.th);
      const st = this.style;
      const col = (hex) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
      const wallC = col((st.top || '#444444').slice(0, 7)), floorC = [150, 130, 100];
      for (let i = 0; i < this.cells.length; i++) {
        if (!this.explored[i]) continue;
        const c = this.cells[i] === FLOOR ? floorC : wallC;
        img.data[i * 4] = c[0]; img.data[i * 4 + 1] = c[1]; img.data[i * 4 + 2] = c[2]; img.data[i * 4 + 3] = this.cells[i] === FLOOR ? 235 : 255;
      }
      this.miniCtx.putImageData(img, 0, 0);
      this.miniDirty = false;
    }
    /* draws a size x size window centred on (wx, wy), scale = pixels per tile */
    drawMini(ctx, x, y, size, wx, wy, scale) {
      if (this.miniDirty || !this.mini) this.buildMini();
      const tilesW = size / scale;
      const cx = wx / TS, cy = wy / TS;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, size, size);
      ctx.clip();
      ctx.fillStyle = 'rgba(8,5,16,0.88)';
      ctx.fillRect(x, y, size, size);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.mini, cx - tilesW / 2, cy - tilesW / 2, tilesW, tilesW, x, y, size, size);
      const dot = (px, py, color, s) => {
        const mx = x + (px / TS - (cx - tilesW / 2)) * scale, my = y + (py / TS - (cy - tilesW / 2)) * scale;
        if (mx < x - 3 || my < y - 3 || mx > x + size + 3 || my > y + size + 3) return;
        ctx.fillStyle = '#000000';
        ctx.fillRect(Math.round(mx - s / 2) - 1, Math.round(my - s / 2) - 1, s + 2, s + 2);
        ctx.fillStyle = color;
        ctx.fillRect(Math.round(mx - s / 2), Math.round(my - s / 2), s, s);
      };
      const seen = (px, py) => this.explored[this.idx(Math.floor(px / TS), Math.floor(py / TS))];
      for (const w of this.waypoints) if (seen(w.x, w.y)) dot(w.x, w.y, '#63c74d', 4);
      if (this.exit && seen(this.exit.x, this.exit.y)) dot(this.exit.x, this.exit.y, this.exit.open ? '#fee761' : '#8a6a20', 5);
      for (const sp of this.spawners) if (!sp.dead && seen(sp.x, sp.y)) dot(sp.x, sp.y, '#e43b44', 4);
      for (const c of this.chests) if (!c.opened && seen(c.x, c.y)) dot(c.x, c.y, '#feae34', 3);
      for (const sh of this.shrines) if (!sh.used && seen(sh.x, sh.y)) dot(sh.x, sh.y, '#b55088', 3);
      for (const p of CH.G.players) if (!p.dead) dot(p.x, p.y, p.color || '#ffffff', 4);
      ctx.restore();
    }
  }

  /* breakable walls: a player shot or explosion chips a cracked wall, the third hit opens it */
  Level.prototype.crack = function (tx, ty, dmg) {
    if (this.cell(tx, ty) !== CRACKED) return false;
    const k = tx + ',' + ty;
    const hp = (this.crackHp.get(k) || 3) - (dmg > 20 ? 2 : 1);
    if (hp <= 0) {
      this.crackHp.delete(k);
      this.set(tx, ty, FLOOR);
      return true;
    }
    this.crackHp.set(k, hp);
    return false;
  };

  CH.Level = Level;
  Level.TS = TS;
  Level.FLOOR = FLOOR;
  Level.WALL = WALL;
  Level.CRACKED = CRACKED;
  Level.STYLE = STYLE;
})(window.CH);
