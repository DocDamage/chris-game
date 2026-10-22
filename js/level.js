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
    backyard: { floor: 'sheet', key: 'tile.grass', wall: '#2c5a22', top: '#3f7a30', edge: '#1a3a14', speck: ['#ffffff14', '#00000014'] },
    office: { floor: 'check', a: '#5d6b8a', b: '#667597', wall: '#2a3045', top: '#434c6b', edge: '#171b2a' },
    glitch: { floor: 'solid', a: '#1b1226', wall: '#0f0b1a', top: '#251a3c', edge: '#ff2bd6' },
    zombie: { floor: 'pattern', key: 'tile.zombie_street', wall: '#1c1e24', top: '#3a3e48', edge: '#0d0e12' },
    wasteland: { floor: 'pattern', key: 'tile.wl_ground', wall: '#4a2f1c', top: '#7a5230', edge: '#27180e', wallKey: 'tile.wl_metal' },
    volcano: { floor: 'pattern', key: 'tile.volcano_floor', wall: '#1a0e0c', top: '#3a1c14', edge: '#ff5a1a' },
    dungeon: { floor: 'pattern', key: 'tile.dungeon_floor', wall: '#0a090e', top: '#26222f', edge: '#050408', wallKey: 'tile.dungeon_wall' },
    frozen: { floor: 'solid', a: '#c9dcea', wall: '#5c7a96', top: '#9fc0d8', edge: '#2f4256' },
  };
  Level_style_default();
  function Level_style_default() { STYLE.default = STYLE.dungeon; }

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

    /* ---- collision: push a circle out of walls (called after every mover) ---- */
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
            const cx = U.clamp(e.x, rx0, rx0 + TS), cy = U.clamp(e.y, ry0, ry0 + TS);
            let dx = e.x - cx, dy = e.y - cy;
            const d2 = dx * dx + dy * dy;
            if (d2 >= r * r) continue;
            if (d2 < 0.0001) {
              // centre inside the tile: leave through the nearest open side
              const l = e.x - rx0, rr = rx0 + TS - e.x, t = e.y - ry0, b = ry0 + TS - e.y;
              const m = Math.min(l, rr, t, b);
              if (m === l) e.x = rx0 - r;
              else if (m === rr) e.x = rx0 + TS + r;
              else if (m === t) e.y = ry0 - r;
              else e.y = ry0 + TS + r;
            } else {
              const d = Math.sqrt(d2);
              e.x += (dx / d) * (r - d);
              e.y += (dy / d) * (r - d);
            }
            moved = true;
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
        if (!p.solid || p.dead || (p.cr || 10) < 9) continue;
        const px = p.x + (p.cx || 0), py = p.y + (p.cy || 0), rr = (p.cr || 10) + 11; // a walker's body plus a little room
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
      // walls: flat tops with a lit rim, plus a short dark face on every open tile below a wall
      const IM = CH.Assets.images;
      const wallPat = st.wallKey && IM[st.wallKey] ? g.createPattern(IM[st.wallKey], 'repeat') : null;
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
          const edgeS = !this.solid(gx, gy + 1), edgeN = !this.solid(gx, gy - 1), edgeW = !this.solid(gx - 1, gy), edgeE = !this.solid(gx + 1, gy);
          const deep = !edgeS && !edgeN && !edgeW && !edgeE && this.solid(gx - 1, gy - 1) && this.solid(gx + 1, gy + 1) && this.solid(gx + 1, gy - 1) && this.solid(gx - 1, gy + 1);
          if (deep) { g.fillStyle = st.wall; g.fillRect(px, py, TS, TS); continue; }
          if (wallPat) { g.save(); g.translate(0, 0); g.fillStyle = wallPat; g.fillRect(px, py, TS, TS); g.restore(); g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(px, py, TS, TS); }
          else { g.fillStyle = st.wall; g.fillRect(px, py, TS, TS); }
          g.fillStyle = st.top;
          g.fillRect(px + 1, py + 1, TS - 2, TS - 8);
          // lit rim on open sides
          g.fillStyle = 'rgba(255,255,255,0.14)';
          if (edgeN) g.fillRect(px, py, TS, 2);
          if (edgeW) g.fillRect(px, py, 2, TS);
          if (edgeS) { g.fillStyle = st.edge; g.fillRect(px, py + TS - 7, TS, 7); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(px, py + TS, TS, 4); }
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
    paintFloor(g, st, x0, y0, size) {
      const IM = CH.Assets.images;
      // a deterministic per-tile hash keeps the speckle stable when a chunk is rebuilt
      const h = (a, b) => { let n = (a * 374761393 + b * 668265263) | 0; n = (n ^ (n >> 13)) * 1274126177; return ((n ^ (n >> 16)) >>> 0) / 4294967296; };
      if (st.floor === 'sheet' && IM[st.key]) {
        const im = IM[st.key];
        for (let y = 0; y < size; y += 16) for (let x = 0; x < size; x += 16) g.drawImage(im, 16, 16, 16, 16, x, y, 16, 16);
        for (let y = 0; y < size; y += 16) for (let x = 0; x < size; x += 16) {
          const r = h((x0 + x) / 16, (y0 + y) / 16);
          if (r < 0.45) { g.fillStyle = r < 0.22 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'; g.fillRect(x + ((r * 977) | 0) % 14, y + ((r * 613) | 0) % 14, 2, 1); }
        }
      } else if (st.floor === 'pattern' && IM[st.key]) {
        const pat = g.createPattern(IM[st.key], 'repeat');
        g.save();
        g.translate(-(x0 % IM[st.key].width), -(y0 % IM[st.key].height));
        g.fillStyle = pat;
        g.fillRect(0, 0, size + IM[st.key].width, size + IM[st.key].height);
        g.restore();
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
