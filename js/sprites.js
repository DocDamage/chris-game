/* CHAOS.exe - procedural pixel art. Sprites are authored as ASCII maps or tiny shape programs,
   auto-outlined, and baked into canvases once. Nothing is loaded from disk. */
(function (CH) {
  'use strict';
  const U = CH.U;

  const OUTLINE = '#1b1226';
  const PAL = {
    k: '#1b1226', w: '#ffffff', W: '#e8e4f0', l: '#b9b4c8', m: '#7d7893', d: '#4a4560',
    r: '#e43b44', R: '#a22633', o: '#f77622', O: '#c4501a', y: '#feae34', Y: '#fee761',
    n: '#8b5a2b', N: '#5a3a1e', b: '#3b6fe0', B: '#2a3f9c', c: '#3ccbe6', C: '#1b8fb0',
    g: '#63c74d', G: '#3e8948', p: '#b55088', P: '#6b2d8b', s: '#f4c9a0', S: '#d99c74',
    t: '#ead4aa', T: '#c8a674', h: '#ff8fb8', e: '#1b1226',
  };

  /* ---------------- pixel grid helper ---------------- */
  class Grid {
    constructor(w, h) {
      this.w = w;
      this.h = h;
      this.p = new Array(w * h).fill(null);
    }
    px(x, y, c) {
      x = Math.round(x);
      y = Math.round(y);
      if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.p[y * this.w + x] = c === null ? null : PAL[c] || c;
    }
    get(x, y) {
      return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.p[y * this.w + x] : null;
    }
    rect(x, y, w, h, c) {
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c);
    }
    e(cx, cy, rx, ry, c) {
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const dx = (x + 0.5 - cx) / rx;
          const dy = (y + 0.5 - cy) / ry;
          if (dx * dx + dy * dy <= 1) this.px(x, y, c);
        }
      }
    }
    line(x0, y0, x1, y1, c) {
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
      for (let i = 0; i <= n; i++) this.px(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c);
    }
  }

  /* ---------------- baking ---------------- */
  function bake(grid, outline) {
    const pad = outline === false ? 0 : 1;
    const w = grid.w + pad * 2;
    const h = grid.h + pad * 2;
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const g = cv.getContext('2d');
    if (pad) {
      g.fillStyle = typeof outline === 'string' ? outline : OUTLINE;
      for (let y = 0; y < grid.h; y++) {
        for (let x = 0; x < grid.w; x++) {
          if (grid.p[y * grid.w + x]) continue;
          if (grid.get(x - 1, y) || grid.get(x + 1, y) || grid.get(x, y - 1) || grid.get(x, y + 1)) g.fillRect(x + pad, y + pad, 1, 1);
        }
      }
      // out-of-bounds neighbours of edge pixels
      for (let y = 0; y < grid.h; y++) {
        for (let x = -1; x <= grid.w; x++) {
          if ((x === -1 || x === grid.w) && grid.get(x === -1 ? 0 : grid.w - 1, y)) g.fillRect(x + pad, y + pad, 1, 1);
        }
      }
      for (let x = 0; x < grid.w; x++) {
        if (grid.get(x, 0)) g.fillRect(x + pad, 0, 1, 1);
        if (grid.get(x, grid.h - 1)) g.fillRect(x + pad, grid.h + pad, 1, 1);
      }
    }
    for (let y = 0; y < grid.h; y++) {
      for (let x = 0; x < grid.w; x++) {
        const c = grid.p[y * grid.w + x];
        if (c) {
          g.fillStyle = c;
          g.fillRect(x + pad, y + pad, 1, 1);
        }
      }
    }
    return cv;
  }

  function asciiToGrid(rows, pal) {
    const h = rows.length;
    let w = 0;
    for (const r of rows) w = Math.max(w, r.length);
    const gr = new Grid(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < rows[y].length; x++) {
        const ch = rows[y][x];
        if (ch === '.' || ch === ' ') continue;
        const col = (pal && pal[ch]) || PAL[ch];
        if (col) gr.px(x, y, col);
      }
    }
    return gr;
  }

  function silhouette(src, color) {
    const c = document.createElement('canvas');
    c.width = src.width;
    c.height = src.height;
    const g = c.getContext('2d');
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color;
    g.fillRect(0, 0, c.width, c.height);
    return c;
  }

  /* ---------------- registry ---------------- */
  const defs = {};
  const baked = {};

  const Sprites = (CH.Sprites = {
    PAL,
    Grid,
    defs,
    /* rows: [..] or {frames:[[..],[..]]}; opts: {pal, anchor, head, outline, variantFn} */
    ascii(name, frames, opts) {
      if (typeof frames[0] === 'string') frames = [frames];
      defs[name] = Object.assign({ kind: 'ascii', frames, anchor: 'feet' }, opts || {});
    },
    /* fn(grid, frameIndex) draws a frame */
    build(name, w, h, nframes, fn, opts) {
      defs[name] = Object.assign({ kind: 'build', w, h, n: nframes, fn, anchor: 'feet' }, opts || {});
    },
    get(name, variant) {
      const key = variant ? name + '|' + variant : name;
      let s = baked[key];
      if (s) return s;
      const d = defs[name];
      if (!d) {
        if (!Sprites._warned) Sprites._warned = {};
        if (!Sprites._warned[name]) {
          Sprites._warned[name] = true;
          console.warn('missing sprite', name);
        }
        return Sprites.get('missing');
      }
      const frames = [];
      if (d.kind === 'ascii') {
        const pal = d.variantFn && variant ? Object.assign({}, d.pal, d.variantFn(variant)) : d.pal;
        for (const rows of d.frames) frames.push(bake(asciiToGrid(rows, pal), d.outline));
      } else {
        for (let i = 0; i < d.n; i++) {
          const gr = new Grid(d.w, d.h);
          d.fn(gr, i);
          frames.push(bake(gr, d.outline));
        }
      }
      const pad = d.outline === false ? 0 : 1;
      const w = frames[0].width;
      const h = frames[0].height;
      s = baked[key] = {
        name,
        frames,
        w,
        h,
        ax: w / 2,
        ay: d.anchor === 'center' ? h / 2 : h - pad,
        head: (d.head || 0) + pad,
        sil: {},
      };
      return s;
    },
    sil(s, frame, color) {
      const k = frame + color;
      let c = s.sil[k];
      if (!c) c = s.sil[k] = silhouette(s.frames[frame], color);
      return c;
    },

    /* opts: frame, flip, sx, sy, rot, flash(0..1), alpha, tint, tintA, bigHead, gold, variant */
    draw(ctx, name, x, y, o) {
      o = o || {};
      const s = Sprites.get(name, o.variant);
      const fi = (o.frame || 0) % s.frames.length;
      const img = s.frames[fi];
      const sx = (o.sx || 1) * (o.flip ? -1 : 1);
      const sy = o.sy || 1;
      const simple = !o.rot && sx === 1 && sy === 1 && !o.bigHead;
      if (o.alpha !== undefined && o.alpha < 1) ctx.globalAlpha = Math.max(0, o.alpha);
      if (o.gold) {
        const gs = Sprites.sil(s, fi, o.gold);
        const ox = Math.round(x - s.ax * Math.abs(sx));
        const oy = Math.round(y - s.ay * sy);
        const w = img.width * Math.abs(sx);
        const h = img.height * sy;
        ctx.drawImage(gs, ox - 1, oy, w, h);
        ctx.drawImage(gs, ox + 1, oy, w, h);
        ctx.drawImage(gs, ox, oy - 1, w, h);
        ctx.drawImage(gs, ox, oy + 1, w, h);
      }
      if (simple) {
        const dx = Math.round(x - s.ax);
        const dy = Math.round(y - s.ay);
        ctx.drawImage(img, dx, dy);
        if (o.flash > 0) {
          ctx.globalAlpha = (o.alpha === undefined ? 1 : o.alpha) * Math.min(1, o.flash);
          ctx.drawImage(Sprites.sil(s, fi, '#ffffff'), dx, dy);
        }
        if (o.tint) {
          ctx.globalAlpha = (o.alpha === undefined ? 1 : o.alpha) * (o.tintA === undefined ? 0.4 : o.tintA);
          ctx.drawImage(Sprites.sil(s, fi, o.tint), dx, dy);
        }
      } else {
        ctx.save();
        const pv = o.pivot || 0;
        ctx.translate(Math.round(x), Math.round(y - pv * sy));
        if (o.rot) ctx.rotate(o.rot);
        ctx.scale(sx, sy);
        if (o.bigHead && s.head > 2) {
          const k = o.bigHead;
          const hh = s.head;
          const bodyTop = -s.ay + hh;
          ctx.drawImage(img, 0, hh, img.width, img.height - hh, -s.ax, bodyTop, img.width, img.height - hh);
          ctx.drawImage(img, 0, 0, img.width, hh, -s.ax * k, bodyTop - hh * k + 1, img.width * k, hh * k);
          if (o.flash > 0) {
            ctx.globalAlpha = Math.min(1, o.flash);
            const f = Sprites.sil(s, fi, '#ffffff');
            ctx.drawImage(f, 0, hh, img.width, img.height - hh, -s.ax, bodyTop, img.width, img.height - hh);
            ctx.drawImage(f, 0, 0, img.width, hh, -s.ax * k, bodyTop - hh * k + 1, img.width * k, hh * k);
          }
        } else {
          ctx.drawImage(img, -s.ax, -s.ay + pv);
          if (o.flash > 0) {
            ctx.globalAlpha = (o.alpha === undefined ? 1 : o.alpha) * Math.min(1, o.flash);
            ctx.drawImage(Sprites.sil(s, fi, '#ffffff'), -s.ax, -s.ay + pv);
          }
          if (o.tint) {
            ctx.globalAlpha = (o.alpha === undefined ? 1 : o.alpha) * (o.tintA === undefined ? 0.4 : o.tintA);
            ctx.drawImage(Sprites.sil(s, fi, o.tint), -s.ax, -s.ay + pv);
          }
        }
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    },

    /* horizontal slice glitch used by the final boss */
    drawGlitched(ctx, name, x, y, o, amount) {
      const s = Sprites.get(name);
      const fi = (o.frame || 0) % s.frames.length;
      const img = s.frames[fi];
      const dx = Math.round(x - s.ax);
      const dy = Math.round(y - s.ay);
      let sy = 0;
      while (sy < img.height) {
        const hgt = U.randInt(2, 6);
        const off = Math.random() < 0.35 ? U.randInt(-amount, amount) : 0;
        ctx.drawImage(img, 0, sy, img.width, Math.min(hgt, img.height - sy), dx + off, dy + sy, img.width, Math.min(hgt, img.height - sy));
        sy += hgt;
      }
    },

    /* small dataURL for DOM icons (HUD slots, upgrade cards) */
    icon(name, frame) {
      const s = Sprites.get(name);
      const f = s.frames[frame || 0];
      if (f.toDataURL) return f.toDataURL();
      // image-backed sprites (resource pickups, props): copy into a canvas first
      const c = document.createElement('canvas');
      c.width = f.width;
      c.height = f.height;
      c.getContext('2d').drawImage(f, 0, 0);
      return c.toDataURL();
    },
    size(name) {
      const s = Sprites.get(name);
      return { w: s.w, h: s.h };
    },
  });

  /* =====================================================================
     SHEET SPRITES (from the bundled art packs)
     A sheet sprite is a set of named animations baked from horizontal frame strips. All frames are
     cropped to one shared box so animation never jitters, and anchored on the idle pose's feet.
     ===================================================================== */
  function frameBounds(ctx, w, h) {
    const d = ctx.getImageData(0, 0, w, h).data;
    let x0 = w;
    let y0 = h;
    let x1 = -1;
    let y1 = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (d[(y * w + x) * 4 + 3] > 12) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    return x1 < 0 ? null : { x0, y0, x1, y1 };
  }

  /* spec: {strips:{anim:{key, fps, loop, fw, fh}}, fw, fh, feet:'idle', anchor:'feet'|'center', crop:true} */
  Sprites.sheet = function (name, spec) {
    const A = CH.Assets;
    const rects = [];
    const anims = {};
    for (const an of Object.keys(spec.strips)) {
      const st = spec.strips[an];
      const im = A.images[st.key];
      if (!im) continue;
      const fh = st.fh || spec.fh || im.height;
      const fw = st.fw || spec.fw || fh;
      const n = Math.max(1, Math.floor(im.width / fw));
      anims[an] = { s: rects.length, n, fps: st.fps || 10, loop: st.loop !== false };
      for (let i = 0; i < n; i++) rects.push({ im, sx: i * fw, fw, fh });
    }
    if (!rects.length) return false;
    const FW = rects[0].fw;
    const FH = rects[0].fh;
    const tmp = document.createElement('canvas');
    tmp.width = FW;
    tmp.height = FH;
    const tg = tmp.getContext('2d', { willReadFrequently: true });
    let ux0 = FW;
    let uy0 = FH;
    let ux1 = -1;
    let uy1 = -1;
    let feet = null;
    const feetAnim = anims[spec.feet || 'idle'] || anims[Object.keys(anims)[0]];
    rects.forEach((r, i) => {
      tg.clearRect(0, 0, FW, FH);
      tg.drawImage(r.im, r.sx, 0, r.fw, r.fh, 0, 0, FW, FH);
      const b = frameBounds(tg, FW, FH);
      if (!b) return;
      if (spec.crop !== false) {
        ux0 = Math.min(ux0, b.x0);
        uy0 = Math.min(uy0, b.y0);
        ux1 = Math.max(ux1, b.x1);
        uy1 = Math.max(uy1, b.y1);
      }
      if (i === feetAnim.s) feet = b;
    });
    if (spec.crop === false || ux1 < 0) {
      ux0 = 0;
      uy0 = 0;
      ux1 = FW - 1;
      uy1 = FH - 1;
    }
    const w = ux1 - ux0 + 1;
    const h = uy1 - uy0 + 1;
    const frames = rects.map((r) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      c.getContext('2d').drawImage(r.im, r.sx + ux0, uy0, w, h, 0, 0, w, h);
      return c;
    });
    const fb = feet || { x0: 0, y0: 0, x1: FW - 1, y1: FH - 1 };
    const ay = spec.anchor === 'center' ? (fb.y0 + fb.y1) / 2 - uy0 : fb.y1 - uy0 + 1;
    baked[name] = { name, frames, w, h, ax: spec.ax !== undefined ? spec.ax - ux0 : FW / 2 - ux0, ay, head: 0, sil: {}, anims, sheet: true, body: { w: fb.x1 - fb.x0 + 1, h: fb.y1 - fb.y0 + 1 } };
    defs[name] = { kind: 'sheet' };
    return true;
  };

  /* every frame of an animation as its own image (the VFX packs) */
  Sprites.fromFrames = function (name, imgs, o) {
    o = o || {};
    if (!imgs.length) return false;
    const w = imgs[0].width;
    const h = imgs[0].height;
    const frames = imgs.map((im) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      c.getContext('2d').drawImage(im, 0, 0);
      return c;
    });
    baked[name] = { name, frames, w, h, ax: w / 2, ay: o.anchor === 'feet' ? h : h / 2, head: 0, sil: {}, anims: { play: { s: 0, n: frames.length, fps: o.fps || 16, loop: false } }, sheet: true };
    defs[name] = { kind: 'sheet' };
    return true;
  };

  /* a single rectangle of an image as a one-frame sprite */
  Sprites.crop = function (name, imgKey, x, y, w, h, anchor) {
    const im = CH.Assets.images[imgKey];
    if (!im) return false;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    c.getContext('2d').drawImage(im, x, y, w, h, 0, 0, w, h);
    baked[name] = { name, frames: [c], w, h, ax: w / 2, ay: anchor === 'feet' ? h : h / 2, head: 0, sil: {}, anims: {}, sheet: true };
    defs[name] = { kind: 'sheet' };
    return true;
  };

  Sprites.fromImage = function (name, imgKey, anchor) {
    const im = CH.Assets.images[imgKey || name];
    if (!im) return false;
    const w = im.width || im.naturalWidth || 32;
    const h = im.height || im.naturalHeight || 32;
    baked[name] = { name, frames: [im], w, h, ax: w / 2, ay: anchor === 'feet' ? h : h / 2, head: 0, sil: {}, anims: {}, sheet: true };
    defs[name] = { kind: 'sheet' };
    return true;
  };

  Sprites.has = (name) => !!baked[name];
  /* a recoloured copy of an existing baked sprite (hue rotate + brightness/saturation), used for the extra heroes */
  Sprites.variant = function (name, src, filter) {
    const s = baked[src];
    if (!s) return false;
    const frames = s.frames.map((f) => {
      const c = document.createElement('canvas');
      c.width = f.width;
      c.height = f.height;
      const g = c.getContext('2d');
      g.filter = filter;
      g.drawImage(f, 0, 0);
      return c;
    });
    baked[name] = Object.assign({}, s, { name, frames });
    defs[name] = { kind: 'sheet' };
    return true;
  };
  Sprites.exists = (name) => !!(baked[name] || defs[name]);

  /* frame index for animation `anim` at time t (seconds since it started) */
  Sprites.frame = function (name, anim, t) {
    const s = baked[name];
    const a = s && s.anims[anim];
    if (!a) return 0;
    const f = Math.floor(t * a.fps);
    return a.s + (a.loop ? f % a.n : Math.min(a.n - 1, f));
  };
  /* progress 0..1 -> frame, for attacks stretched over a fixed duration */
  Sprites.frameAt = function (name, anim, k) {
    const s = baked[name];
    const a = s && s.anims[anim];
    if (!a) return 0;
    return a.s + Math.max(0, Math.min(a.n - 1, Math.floor(k * a.n)));
  };
  Sprites.animLen = function (name, anim) {
    const s = baked[name];
    const a = s && s.anims[anim];
    return a ? a.n / a.fps : 0;
  };

  Sprites.build('missing', 8, 8, 1, (g) => {
    g.rect(0, 0, 8, 8, '#ff00ff');
    g.rect(0, 0, 4, 4, '#000000');
    g.rect(4, 4, 4, 4, '#000000');
  });

  /* =====================================================================
     PLAYER (front-facing hero, recolourable via palette variants)
     ===================================================================== */
  const HEAD = [
    '....uuuuuu....',
    '...uuuuuuuu...',
    '..uuUuuuuuUu..',
    '..uuuuuuuuuu..',
    '..ussssssssu..',
    '..uswesswesu..',
    '..ussssssssu..',
    '...usskkssu...',
    '....SSSSSS....',
  ];
  const BODY = ['...aaaaaaaa...', '..aaaaaaaaaa..', '..aAaaaaaaAa..', '..saaaaaaaas..', '..sAAAAAAAAs..', '...qqqqqqqq...'];
  const LEGS = {
    idle: ['...qqq..qqq...', '...qqq..qqq...', '...zzz..zzz...'],
    w1: ['...qqq..qqq...', '...zzz..qqq...', '........zzz...'],
    w2: ['...qqq..qqq...', '...qqq..zzz...', '...zzz........'],
  };
  const playerPal = {
    a: '#3b6fe0', A: '#2a3f9c', q: '#4a4560', u: '#c9892e', U: '#8a5a1c', z: '#e8e4f0',
  };
  Sprites.ascii('player', [HEAD.concat(BODY, LEGS.idle), HEAD.concat(BODY, LEGS.w1), HEAD.concat(BODY, LEGS.w2)], {
    pal: playerPal,
    head: 9,
    variantFn: (id) => {
      const p = CH.Balance.palettes.find((x) => x.id === id);
      return p ? p.c : null;
    },
  });
  // death pose: lying flat
  Sprites.build('player_dead', 18, 12, 1, (g) => {
    g.rect(2, 2, 14, 8, '#3b6fe0');
    g.rect(2, 8, 14, 2, '#2a3f9c');
    g.e(4, 6, 4, 4, '#f4c9a0');
    g.rect(2, 2, 4, 2, '#c9892e');
    g.px(4, 5, 'k');
    g.px(6, 5, 'k');
    g.rect(14, 3, 3, 6, '#4a4560');
    g.rect(16, 3, 2, 6, '#e8e4f0');
  });

  /* =====================================================================
     ENEMIES
     ===================================================================== */
  // Angry Chicken (faces right)
  Sprites.ascii(
    'chicken',
    [
      [
        '..........rr....',
        '.........rrrr...',
        '.........wwwww..',
        '........wRkkwoo.',
        '........wwwwwooo',
        '........wwwwwoo.',
        '.....wwwwwwwwr..',
        '....wwwwwwwwwr..',
        '..wwwwwwwwwwww..',
        '.wwwwwwwwwwwww..',
        'wwwwlwwwwwwwl...',
        '.wwwwwllllwww...',
        '..wwwwwwwwww....',
        '...llwwwwwl.....',
        '.....o..o.......',
        '....oo.oo.......',
      ],
      [
        '..........rr....',
        '.........rrrr...',
        '.........wwwww..',
        '........wRkkwoo.',
        '........wwwwwooo',
        '........wwwwwoo.',
        '.....wwwwwwwwr..',
        '....wwwwwwwwwr..',
        '..wwwwwwwwwwww..',
        '.wwwwwwwwwwwww..',
        'wwwwlwwwwwwwl...',
        '.wwwwwllllwww...',
        '..wwwwwwwwww....',
        '...llwwwwwl.....',
        '......o..o......',
        '.....oo.oo......',
      ],
    ],
    { head: 7 }
  );

  // Flying Potato (wings flap)
  Sprites.build('potato', 18, 15, 2, (g, f) => {
    g.e(9, 8, 5.5, 5.5, 'n');
    g.e(10.5, 10, 4, 3.5, 'N');
    g.e(9, 7.5, 5, 4.8, 'n');
    g.e(7, 5.5, 2.5, 1.8, 'T');
    g.px(11, 10, 'N');
    g.px(6, 11, 'N');
    g.px(12, 6, 'N');
    // face
    g.rect(6, 7, 2, 2, 'w');
    g.rect(10, 7, 2, 2, 'w');
    g.px(7, 8, 'k');
    g.px(11, 8, 'k');
    g.line(5, 6, 7, 7, 'k');
    g.line(12, 7, 13, 6, 'k');
    g.line(7, 11, 11, 11, 'k');
    g.px(8, 12, 'w');
    g.px(10, 12, 'w');
    // wings
    if (f === 0) {
      g.e(2, 4, 2.6, 1.6, 'W');
      g.e(16, 4, 2.6, 1.6, 'W');
      g.line(3, 5, 5, 7, 'l');
      g.line(15, 5, 13, 7, 'l');
    } else {
      g.e(2, 10, 2.6, 1.6, 'W');
      g.e(16, 10, 2.6, 1.6, 'W');
      g.line(3, 9, 5, 8, 'l');
      g.line(15, 9, 13, 8, 'l');
    }
  }, { anchor: 'center' });

  // Evil Trash Can (lid up on frame 1 = slam wind-up)
  Sprites.build('trashcan', 20, 24, 2, (g, f) => {
    const lid = f === 1 ? -4 : 0;
    g.rect(3, 7, 14, 15, 'm');
    g.rect(14, 7, 3, 15, 'd');
    g.rect(5, 8, 1, 13, 'l');
    g.rect(3, 12, 14, 1, 'd');
    g.rect(3, 17, 14, 1, 'd');
    g.rect(4, 21, 4, 3, 'd');
    g.rect(12, 21, 4, 3, 'd');
    // face
    g.rect(5, 11, 4, 3, 'Y');
    g.rect(11, 11, 4, 3, 'Y');
    g.rect(7, 12, 2, 2, 'k');
    g.rect(11, 12, 2, 2, 'k');
    g.line(5, 10, 9, 12, 'k');
    g.line(15, 10, 11, 12, 'k');
    g.rect(5, 16, 10, 3, 'k');
    for (let x = 6; x < 15; x += 2) g.px(x, 16, 'w');
    for (let x = 7; x < 14; x += 2) g.px(x, 18, 'w');
    // lid + handle
    g.rect(2, 4 + lid, 16, 3, 'l');
    g.rect(2, 6 + lid, 16, 1, 'm');
    g.rect(8, 2 + lid, 4, 2, 'd');
    // trash poking out
    g.px(5, 3 + lid, 'g');
    g.px(6, 3 + lid, 'y');
    g.px(14, 3 + lid, 'r');
    if (f === 1) {
      g.rect(4, 5, 12, 2, 'k');
      g.px(6, 4, 'g');
      g.px(9, 5, 'y');
      g.px(12, 4, 'r');
    }
  });

  // Office worker (reuses hero template with a suit)
  Sprites.ascii(
    'office',
    [
      HEAD.slice(0, 5).concat(['..usrwessewru..'], HEAD.slice(6), ['...aaawwaaa...', '..aaaarraaaa..', '..saaaarraaas.', '..sAAAAraAAAs.', '...qqqqqqqq...'], LEGS.idle),
      HEAD.slice(0, 5).concat(['..usrwessewru..'], HEAD.slice(6), ['...aaawwaaa...', '..aaaarraaaa..', '..saaaarraaas.', '..sAAAAraAAAs.', '...qqqqqqqq...'], LEGS.w1),
      HEAD.slice(0, 5).concat(['..usrwessewru..'], HEAD.slice(6), ['...aaawwaaa...', '..aaaarraaaa..', '..saaaarraaas.', '..sAAAAraAAAs.', '...qqqqqqqq...'], LEGS.w2),
    ],
    { pal: { u: '#7d7893', U: '#4a4560', a: '#7d7893', A: '#4a4560', q: '#4a4560', z: '#1b1226', s: '#f0b090', S: '#c98060' }, head: 9 }
  );

  // Speedy Toaster
  Sprites.build('toaster', 18, 16, 2, (g, f) => {
    const up = f === 1 ? 1 : 0;
    g.rect(3, 1 - up + 1, 4, 4, 't');
    g.rect(3, 1 - up + 1, 4, 1, 'T');
    g.rect(11, 2 - up + 1, 4, 4, 't');
    g.rect(11, 2 - up + 1, 4, 1, 'T');
    g.rect(1, 5, 16, 8, 'l');
    g.rect(1, 5, 16, 1, 'W');
    g.rect(1, 11, 16, 2, 'm');
    g.rect(3, 4, 4, 1, 'k');
    g.rect(11, 4, 4, 1, 'k');
    g.rect(4, 7, 3, 3, 'w');
    g.rect(11, 7, 3, 3, 'w');
    g.px(6, 8, 'k');
    g.px(6, 9, 'k');
    g.px(11, 8, 'k');
    g.px(11, 9, 'k');
    g.line(4, 6, 7, 7, 'k');
    g.line(14, 6, 11, 7, 'k');
    g.rect(17, 7, 1, 3, 'r');
    g.rect(2, 13, 4, 2, 'd');
    g.rect(12, 13, 4, 2, 'd');
    if (f === 1) {
      g.px(0, 14, 'o');
      g.px(17, 14, 'o');
    }
  });

  // Goblin Influencer (green skin, shades, pink hair)
  const GOB_HEAD = [
    '....uuuuuu....',
    '...uuuuuuuu...',
    '..uuUuuuuuUu..',
    'ss.uuuuuuuu.ss',
    '.ssussssssuss.',
    '..ukkkkkkkku..',
    '..ussssssssu..',
    '...usskkssu...',
    '....SSSSSS....',
  ];
  const GOB_BODY = ['...aaaaaaaa...', '..aaYaaaaYaa..', '..aaaaaaaaaa..', '..saaaaaaaas..', '..sAAAAAAAAs..', '...qqqqqqqq...'];
  const gobPal = { u: '#ff4fa3', U: '#a22660', s: '#63c74d', S: '#3e8948', a: '#f4f0ff', A: '#b9b4c8', q: '#3b6fe0', z: '#ff4fa3', Y: '#fee761' };
  Sprites.ascii('influencer', [GOB_HEAD.concat(GOB_BODY, LEGS.idle), GOB_HEAD.concat(GOB_BODY, LEGS.w1), GOB_HEAD.concat(GOB_BODY, LEGS.w2)], { pal: gobPal, head: 9 });

  // Possessed Shopping Cart (faces right)
  Sprites.build('cart', 22, 18, 2, (g, f) => {
    g.rect(4, 4, 15, 8, 'l');
    g.rect(4, 4, 15, 1, 'W');
    g.rect(4, 11, 15, 1, 'm');
    for (let x = 6; x < 19; x += 3) g.rect(x, 5, 1, 6, 'm');
    g.rect(1, 2, 4, 1, 'd');
    g.rect(1, 2, 1, 6, 'd');
    g.line(4, 4, 6, 12, 'm');
    g.rect(5, 12, 12, 1, 'm');
    g.e(7, 15, 2.2, 2.2, 'd');
    g.e(16, 15, 2.2, 2.2, 'd');
    g.px(7, 15, 'l');
    g.px(16, 15, 'l');
    // possessed eyes
    g.rect(9, 6, 2, 2, 'r');
    g.rect(14, 6, 2, 2, 'r');
    g.line(8, 5, 11, 6, 'k');
    g.line(16, 5, 13, 6, 'k');
    // wisps
    g.px(10, 1 + f, 'P');
    g.px(14, 0 + f, 'p');
    g.px(12, 2 - f, 'P');
    g.px(17, 2 + f, 'p');
  });

  // Suspicious Pigeon (faces right, wings flap)
  Sprites.build('pigeon', 18, 15, 2, (g, f) => {
    g.rect(1, 8, 4, 2, 'd');
    g.e(9, 8, 6, 3.8, 'l');
    g.e(9, 10, 5, 2, 'm');
    g.e(13, 6, 3, 3, 'm');
    g.e(12, 7, 2, 2, 'p');
    g.px(12, 8, 'c');
    g.rect(16, 5, 2, 1, 'y');
    g.rect(15, 6, 2, 1, 'O');
    g.px(14, 4, 'r');
    g.line(13, 3, 15, 4, 'k');
    if (f === 0) {
      g.e(8, 4, 3.5, 2.2, 'm');
      g.e(8, 4.5, 2.5, 1.4, 'l');
    } else {
      g.e(7, 11, 3.5, 2, 'm');
      g.e(7, 11, 2.5, 1.2, 'l');
    }
    g.px(8, 13, 'o');
    g.px(10, 13, 'o');
    g.px(7, 14, 'o');
    g.px(11, 14, 'o');
  }, { anchor: 'center' });

  // Angry Refrigerator
  Sprites.build('fridge', 24, 30, 2, (g, f) => {
    g.rect(2, 2, 20, 25, 'W');
    g.rect(18, 2, 4, 25, 'l');
    g.rect(2, 2, 20, 2, 'w');
    g.rect(2, 12, 20, 1, 'm');
    g.rect(17, 5, 2, 5, 'm');
    g.rect(17, 15, 2, 7, 'm');
    g.rect(4, 5, 3, 3, 'r');
    g.rect(8, 6, 3, 3, 'y');
    g.rect(5, 8, 3, 2, 'g');
    // face on lower door
    const eye = f === 1 ? 'c' : 'w';
    g.rect(5, 15, 4, 3, eye);
    g.rect(11, 15, 4, 3, eye);
    g.rect(7, 16, 2, 2, 'k');
    g.rect(11, 16, 2, 2, 'k');
    g.line(4, 14, 9, 15, 'k');
    g.line(16, 14, 11, 15, 'k');
    g.rect(6, 21, 9, 3, 'k');
    for (let x = 7; x < 15; x += 2) g.px(x, 21, 'w');
    for (let x = 8; x < 14; x += 2) g.px(x, 23, 'w');
    g.rect(3, 27, 4, 3, 'd');
    g.rect(17, 27, 4, 3, 'd');
    // frost
    g.px(2, 3, 'c');
    g.px(3, 4, 'c');
    g.px(21, 3, 'c');
    g.px(20, 4, 'c');
    g.px(4, 26, 'c');
    if (f === 1) {
      g.rect(2, 12, 20, 1, 'c');
      g.px(5, 11, 'c');
      g.px(10, 11, 'c');
      g.px(15, 11, 'c');
    }
  });

  // Unpaid Intern
  Sprites.ascii(
    'intern',
    [
      ['...nnnnnn...', '..nnnnnnnn..', '..nssssssn..', '..sewsswes..', '..ssssssss..', '...sskkss...', '....SSSS....', '..wwwwwwww..', '.swwwyywwws.', '.swwwwwwwws.', '..wwwwwwww..', '..bbbbbbbb..', '..bbb..bbb..', '..bbb..bbb..', '..ddd..ddd..'],
      ['...nnnnnn...', '..nnnnnnnn..', '..nssssssn..', '..sewsswes..', '..ssssssss..', '...sskkss...', '....SSSS....', '..wwwwwwww..', '.swwwyywwws.', '.swwwwwwwws.', '..wwwwwwww..', '..bbbbbbbb..', '..bbb..bbb..', '..ddd..bbb..', '.......ddd..'],
      ['...nnnnnn...', '..nnnnnnnn..', '..nssssssn..', '..sewsswes..', '..ssssssss..', '...sskkss...', '....SSSS....', '..wwwwwwww..', '.swwwyywwws.', '.swwwwwwwws.', '..wwwwwwww..', '..bbbbbbbb..', '..bbb..bbb..', '..bbb..ddd..', '..ddd.......'],
    ],
    { head: 7 }
  );

  /* =====================================================================
     BOSSES
     ===================================================================== */
  Sprites.build('boss_ceo', 44, 48, 2, (g, f) => {
    // legs + shoes
    g.rect(12, 36, 7, 9, 'd');
    g.rect(24, 36, 7, 9, 'd');
    g.rect(10, 44, 10, 4, 'N');
    g.rect(23, 44, 10, 4, 'N');
    // body
    g.rect(8, 19, 28, 18, 'm');
    g.rect(30, 19, 6, 18, 'd');
    g.rect(8, 19, 3, 18, 'l');
    g.rect(17, 19, 10, 14, 'w');
    g.rect(21, 20, 3, 15, 'r');
    g.rect(20, 19, 5, 2, 'R');
    g.line(11, 19, 18, 30, 'd');
    g.line(33, 19, 26, 30, 'd');
    g.px(14, 28, 'y');
    g.px(15, 28, 'y');
    // arms
    g.rect(2, 20, 6, 15, 'm');
    g.rect(2, 20, 2, 15, 'l');
    g.rect(36, 20, 6, 15, 'm');
    g.rect(36, 20, 2, 15, 'd');
    g.e(5, 36, 3, 3, 's');
    g.e(39, 36, 3, 3, 's');
    if (f === 1) {
      g.rect(2, 12, 6, 8, 'm');
      g.e(5, 11, 3, 3, 's');
    }
    // briefcase
    g.rect(35, 36, 9, 8, 'N');
    g.rect(35, 36, 9, 1, 'T');
    g.rect(38, 34, 3, 2, 'T');
    g.rect(39, 39, 2, 2, 'y');
    // head
    g.e(22, 11, 10, 10, 's');
    g.e(22, 15, 8, 5, 'S');
    g.e(22, 11, 10, 9.4, 's');
    g.rect(13, 3, 18, 4, 'd');
    g.rect(12, 5, 20, 3, 'd');
    // horns
    g.rect(11, 1, 2, 5, 'r');
    g.rect(10, 0, 2, 2, 'r');
    g.rect(31, 1, 2, 5, 'r');
    g.rect(32, 0, 2, 2, 'r');
    // eyes
    g.rect(14, 9, 6, 4, 'w');
    g.rect(24, 9, 6, 4, 'w');
    g.rect(16, 10, 3, 3, 'r');
    g.rect(25, 10, 3, 3, 'r');
    g.line(12, 6, 20, 9, 'k');
    g.line(32, 6, 24, 9, 'k');
    g.line(12, 7, 20, 10, 'k');
    g.line(32, 7, 24, 10, 'k');
    // mouth
    if (f === 1) {
      g.rect(16, 15, 12, 5, 'k');
      g.rect(17, 15, 10, 1, 'w');
      g.rect(19, 18, 6, 2, 'r');
    } else {
      g.rect(15, 16, 14, 3, 'k');
      for (let x = 16; x < 28; x += 2) g.px(x, 16, 'w');
    }
  });

  Sprites.build('boss_chicken', 56, 52, 2, (g, f) => {
    const bob = f === 1 ? 1 : 0;
    // tail
    g.e(7, 20, 7, 5, 'R');
    g.e(5, 28, 6, 4, 'r');
    g.e(9, 34, 6, 4, 'o');
    // body
    g.e(24, 31, 19, 15, 'w');
    g.e(24, 38, 17, 8, 'W');
    g.e(22, 24, 12, 6, 'w');
    // wing
    g.e(20, 31, 11, 7, 'l');
    g.e(20, 30, 9, 5, 'W');
    for (let i = 0; i < 4; i++) g.line(12 + i * 3, 31, 14 + i * 3, 37, 'l');
    // legs
    g.rect(19, 42, 4, 9, 'o');
    g.rect(29, 42, 4, 9, 'o');
    g.rect(15, 50, 9, 2, 'O');
    g.rect(27, 50, 9, 2, 'O');
    // head
    g.e(40, 16 + bob, 10, 10, 'w');
    g.e(34, 24, 5, 8, 'w');
    // comb
    g.e(36, 5 + bob, 3, 3, 'r');
    g.e(41, 4 + bob, 3, 3.5, 'r');
    g.e(46, 7 + bob, 3, 3, 'r');
    // beak + wattle
    g.rect(48, 14 + bob, 8, 4, 'o');
    g.rect(48, 18 + bob, 7, 3, 'O');
    g.e(48, 24 + bob, 2.5, 4, 'r');
    // angry eye
    g.rect(41, 11 + bob, 5, 5, 'y');
    g.rect(43, 12 + bob, 3, 4, 'k');
    g.line(38, 7 + bob, 47, 12 + bob, 'k');
    g.line(38, 8 + bob, 47, 13 + bob, 'k');
    if (f === 1) {
      g.rect(48, 17 + bob, 7, 1, 'k');
    }
  });

  Sprites.build('boss_bug', 54, 54, 2, (g, f) => {
    // legs
    const leg = (x0, y0, x1, y1, x2, y2) => {
      g.line(x0, y0, x1, y1, 'c');
      g.line(x1, y1, x2, y2, 'c');
    };
    leg(14, 32, 4, 30, 2, 44);
    leg(16, 38, 6, 42, 5, 52);
    leg(40, 32, 50, 30, 52, 44);
    leg(38, 38, 48, 42, 49, 52);
    leg(18, 44, 12, 50, 12, 53);
    leg(36, 44, 42, 50, 42, 53);
    // body
    g.e(27, 34, 17, 14, 'P');
    g.e(27, 38, 13, 9, 'p');
    g.e(27, 30, 15, 9, 'P');
    for (let i = 0; i < 5; i++) g.line(14 + i * 6, 36, 16 + i * 6, 44, 'P');
    g.e(21, 28, 4, 2, 'b');
    // head / monitor face
    g.rect(14, 6, 26, 20, 'm');
    g.rect(15, 7, 24, 18, 'k');
    g.rect(16, 8, 22, 1, 'd');
    const eye = f === 1 ? 'r' : 'c';
    g.rect(18, 11, 7, 7, eye);
    g.rect(29, 11, 7, 7, eye);
    g.rect(21, 13, 3, 4, 'k');
    g.rect(32, 13, 3, 4, 'k');
    g.line(17, 9, 25, 12, 'r');
    g.line(37, 9, 29, 12, 'r');
    // zig-zag mouth
    for (let x = 18; x < 36; x += 3) {
      g.px(x, 21 + ((x / 3) % 2), 'r');
      g.px(x + 1, 22 - ((x / 3) % 2), 'r');
      g.px(x + 2, 21 + ((x / 3) % 2), 'r');
    }
    if (f === 1) g.rect(20, 20, 14, 4, 'r');
    // static noise
    for (let i = 0; i < 14; i++) g.px(16 + ((i * 7) % 22), 8 + ((i * 5) % 17), i % 2 ? 'w' : 'p');
    // antennae
    g.line(19, 5, 12, 0, 'c');
    g.line(35, 5, 42, 0, 'c');
    g.rect(11, 0, 2, 2, 'r');
    g.rect(41, 0, 2, 2, 'r');
    // glitch confetti
    g.rect(0, 14, 4, 2, 'c');
    g.rect(48, 20, 5, 2, 'p');
    g.rect(3, 22, 2, 4, 'p');
    g.rect(50, 8, 3, 3, 'c');
    g.rect(44, 26, 4, 2, 'w');
  });

  /* simple stand-ins for the sheet-based bosses, used only when the asset bundle is missing */
  Sprites.build('boss_frog', 30, 28, 2, (g, f) => {
    g.e(15, 17, 12, 9, 'g');
    g.e(15, 20, 8, 5, 'Y');
    g.e(9, 8, 4, 4, 'g');
    g.e(21, 8, 4, 4, 'g');
    g.rect(8, 7, 3, 3, 'w');
    g.rect(20, 7, 3, 3, 'w');
    g.px(9, 8, 'k');
    g.px(21, 8, 'k');
    g.rect(10, f ? 16 : 14, 10, 2, 'k');
  });
  Sprites.build('boss_bd', 40, 36, 2, (g, f) => {
    g.e(20, 22, 17, 13, 'm');
    g.e(20, 11, 8, 6, 'd');
    g.rect(14, 9, 3, 3, 'r');
    g.rect(23, 9, 3, 3, 'r');
    g.rect(3, f ? 16 : 20, 7, 9, 'l');
    g.rect(30, f ? 16 : 20, 7, 9, 'l');
  });
  Sprites.build('boss_gol', 38, 40, 2, (g, f) => {
    g.rect(8, 8, 22, 22, 'd');
    g.rect(14, 2, 10, 8, 'm');
    g.rect(17, 4, 4, 4, 'c');
    g.rect(2, 10, 6, 18, 'm');
    g.rect(30, 10, 6, 18, 'm');
    g.rect(10, 30, 7, 8, 'm');
    g.rect(21, 30, 7, 8, 'm');
    g.rect(16, f ? 14 : 16, 6, 3, 'c');
  });
  Sprites.build('boss_maw', 32, 48, 2, (g, f) => {
    g.e(16, 6, 14, 4, 'P');
    g.rect(10, 0, 12, 6, 'P');
    g.e(16, 15, 6, 6, 'W');
    g.rect(12, 13, 3, 3, 'r');
    g.rect(18, 13, 3, 3, 'r');
    g.rect(8, 22, 16, 16, 'B');
    g.rect(13, 38, 3, 10, 'W');
    g.rect(18, 38, 3, 10, 'W');
    g.rect(f ? 3 : 4, 20, 3, 18, 'n');
  });

  /* =====================================================================
     WEAPONS + PROJECTILES  (centre anchored)
     ===================================================================== */
  const A = (name, rows, opts) => Sprites.ascii(name, rows, Object.assign({ anchor: 'center' }, opts || {}));

  // 6 flavours of junk
  A('junk0', ['..nnn..', '..nnn..', '..nNn..', '.nnNnn.', 'nnnnnnn', 'nNNNNNn', '.ddddd.']); // boot
  A('junk1', ['.lllll.', 'lWWWWWl', 'lrrrrrl', 'lrWWrl.', 'lrrrrrl', 'lWWWWWl', '.lllll.'].map((r) => r.slice(0, 7))); // tin can
  A('junk2', ['....yy.', '...yYy.', '..yYy..', '.yYy...', '.yYy...', '..yy...', '...N...']); // banana
  A('junk3', ['..ccc..', '.cwwwc.', 'cw...wc', 'cw...wc', 'cw...wc', '.cwwwc.', '..ccc..']); // CD
  A('junk4', ['...dd..', '..dddd.', '.dd..dd', '.d....d', '.dd..dd', '..dddd.', '...dd..']); // tyre
  A('junk5', ['.ppppp.', '.pPPPp.', '.ppppp.', '..pPp..', '..ppp..', '.ppppp.', '.ppppp.']); // sock

  A('chicken_proj', [
    '.....rr...',
    '....rrr...',
    '..yyyyy...',
    'oyyyyyyyy.',
    'yyyykyyyyo',
    '.yyyyyyyoo',
    '..yyyyyy..',
    '...yy.yy..',
  ]);
  A('pizza', [
    '.........',
    '.tttttTt.',
    'tYYYYYYYT',
    '.tYrYYrT.',
    '.tYYYrYT.',
    '..tYrYT..',
    '...tYT...',
    '....T....',
  ]);
  A('chair', [
    '..dddddddd..',
    '.drrrrrrrrd.',
    '.drrRRRRrrd.',
    '.drrrrrrrrd.',
    '.drrrrrrrrd.',
    '..dddddddd..',
    '.....mm.....',
    '.....mm.....',
    '..mmmmmmmm..',
    '.mm..mm..mm.',
    '.dd..dd..dd.',
    '.ll..ll..ll.',
  ]);
  A('baguette', ['.TTTTTTTTTTTTTTTTTT.', 'TtYtYtYtYtYtYtYtYtT', 'tYtYtYtYtYtYtYtYtYT', '.TTTTTTTTTTTTTTTTTT.'], { pal: { Y: '#f4d38a' } });
  A('junk_launcher', ['..dddddd....', '.dmmmmmmd.n.', 'dmllllllmdnn', '.dmmmmmmd.n.', '..dddddd.rr.', '...dd.....r.']);
  A('chicken_cannon', ['..rr........', '.yyyyyy.....', 'yyykyyyyyyyo', '.yyyyyyyyyoo', '..yyyyyyyy..', '...yy..yy...']);
  A('pizza_box', ['.tttttttt.', 'tYYYYYYYYt', 'tYrYYYrYYt', 'tYYYrYYYYt', 'tYYYYYrYYt', '.tttttttt.']);
  A('baguette_icon', ['........TT', '......TTtT', '....TTtYT.', '..TTtYtT..', '.TtYtTT...', 'TtYtT.....', 'TTT.......']);
  A('chair_icon', [
    '...dddd...',
    '..dmmmmd..',
    '..dmmmmd..',
    '..dmmmmd..',
    '...dddd...',
    '....dd....',
    '..dddddd..',
    '.d..dd..d.',
    '.o..oo..o.',
  ]);
  A('problem_icon', ['..pppppp..', '.pPPPPPPp.', 'pPPwwwPPPp', 'pPPPPwPPPp', 'pPPPwwPPPp', 'pPPPPPPPPp', 'pPPPwPPPPp', '.pPPPPPPp.', '..pppppp..']);

  // problem generator outcomes
  A('prob_decoy', ['..yyy....', '.yYYYy...', '.yYkYy...', '..yyyyoo.', '.yyyyyy..', 'yyyyyyyy.', '.yyyyyy..', '..yyyy...']);
  A('prob_bomb', ['....y...', '...Y.r..', '..ddd...', '.dddddd.', 'dddwddd.', 'dddddddd', '.dddddd.', '..dddd..'].map((r) => r.slice(0, 8)));
  A('prob_ball', ['.rrrr.', 'rWWrrr', 'rWrrrr', 'rrrrrR', 'rrrrRR', '.RRRR.']);
  A('prob_ice', ['.cccccc.', 'cwwcccCc', 'cwcccccC', 'cccccccC', 'cccccCCC', 'ccccCCCC', '.CCCCCC.', '........']);
  A('prob_mega', ['....Y....', '....Y....', '..y.Y.y..', '...yYy...', 'YYYYwYYYY', '...yYy...', '..y.Y.y..', '....Y....', '....Y....']);

  // enemy projectiles
  A('paper', ['wwwwww', 'wlllWw', 'wwwwww', 'wllllw', 'wwwwww', '.WWWW.']);
  A('ice_shard', ['...c...', '..cwc..', '.ccwcc.', 'ccwwwcc', '.ccwcc.', '..cCc..', '...C...']);
  A('bullet_red', ['.rr.', 'rYYr', 'rYYr', '.rr.']);
  A('bullet_glitch', ['.cc.', 'cwwc', 'cwwc', '.cc.']);
  A('bullet_pink', ['.pp.', 'pwwp', 'pwwp', '.pp.']);
  A('egg', ['.ww.', 'wWWw', 'wWWw', '.ww.']);
  A('coffee', ['.lll.', 'lnnnl', 'lnnnl', '.lll.']);

  /* =====================================================================
     PICKUPS
     ===================================================================== */
  const coinW = [3, 2, 1, 2];
  Sprites.build('coin', 8, 8, 4, (g, f) => {
    const rx = coinW[f];
    g.e(4, 4, rx + 0.5, 3.5, 'y');
    g.e(4, 4, Math.max(0.5, rx - 0.5), 2.5, 'Y');
    if (rx > 1) g.px(4, 3, 'y');
  }, { anchor: 'center' });
  A('gem', ['...c...', '..cwc..', '.cwccc.', 'cwcccCc', '.cccCC.', '..cCC..', '...C...']);
  A('gem_big', ['....c....', '...cwc...', '..cwccc..', '.cwcccCc.', 'cwccccCCc', '.ccccCCc.', '..cccCC..', '...ccC...', '....C....']);
  A('hp', ['.wwwwww.', 'wggggggw', 'wggwwggw', 'wgwwwwgw', 'wgwwwwgw', 'wggwwggw', 'wggggggw', '.wwwwww.']);
  A('power', ['...pp...', '..pwwp..', '.pPwwPp.', 'ppwwwwpp', '.pPwwPp.', '..pwwp..', '...pp...', '........']);
  A('token', ['..yyyyyy..', '.yYYYYYYy.', 'yYkkYYkkYy', 'yYkkYYkkYy', 'yYYYkkYYYy', 'yYYkYYkYYy', '.yYYYYYYy.', '..yyyyyy..']);
  A('crate', ['kkkkkkkkkk', 'knnnnnnnnk', 'knNNNNNNnk', 'knNyyyyNnk', 'knNyYYyNnk', 'knNyyyyNnk', 'knNNNNNNnk', 'knnnnnnnnk', 'kkkkkkkkkk'].map((r) => r.replace(/k/g, 'N')));
  A('shadow', ['.kkkk.', 'kkkkkk', '.kkkk.'], { pal: { k: 'rgba(0,0,0,0.35)' }, outline: false });

  /* =====================================================================
     DECOR / PROPS (drawn into arena backgrounds and as animated sprites)
     ===================================================================== */
  Sprites.ascii('gnome', [
    ['....r....', '...rrr...', '..rrrrr..', '..rrrrr..', '.rrrrrrr.', '..sksks..', '.wwwswww.', '.wwwwwww.', '..wwwww..', '..bbbbb..', '.bbbbbbb.', '..bbbbb..', '..nn.nn..'],
    ['....r....', '...rrr...', '..rrrrr..', '..rrrrr..', '.rrrrrrr.', '..skkks..', '.wwwswww.', '.wwwwwww.', '..wwwww..', '..bbbbb..', '.bbbbbbb.', '..bbbbb..', '..nn.nn..'],
  ]);
  Sprites.build('vending', 18, 28, 2, (g, f) => {
    g.rect(1, 1, 16, 26, 'R');
    g.rect(13, 1, 4, 26, 'r');
    g.rect(2, 3, 11, 14, 'k');
    for (let y = 0; y < 3; y++) for (let x = 0; x < 4; x++) g.rect(3 + x * 3, 4 + y * 4, 2, 3, ['c', 'y', 'g', 'p', 'o', 'w'][(x + y * 2) % 6]);
    g.rect(14, 4, 2, 6, 'd');
    g.rect(14, 12, 2, 2, f ? 'r' : 'k');
    g.rect(3, 19, 10, 5, 'd');
    g.rect(4, 20, 8, 3, 'k');
    g.px(13, 3, f ? 'Y' : 'R');
    g.line(5, 5, 10, 14, f ? 'W' : 'm');
    g.rect(1, 26, 16, 2, 'd');
  });
  Sprites.build('desk', 30, 22, 2, (g, f) => {
    g.rect(0, 10, 30, 3, 'T');
    g.rect(0, 10, 30, 1, 't');
    g.rect(1, 13, 3, 8, 'n');
    g.rect(26, 13, 3, 8, 'n');
    g.rect(6, 13, 10, 7, 'N');
    g.rect(8, 15, 6, 1, 'T');
    // monitor
    g.rect(8, 1, 12, 8, 'd');
    g.rect(9, 2, 10, 6, f ? 'C' : 'c');
    g.rect(13, 9, 2, 1, 'd');
    g.line(10, 4, 16, 4, 'w');
    g.line(10, 6, 14, 6, 'w');
    g.rect(22, 7, 3, 3, 'w'); // mug
    g.px(25, 8, 'w');
    g.rect(2, 8, 4, 2, 'W'); // papers
    g.rect(9, 9, 9, 1, 'l'); // keyboard
  });
  Sprites.build('plant', 12, 18, 1, (g) => {
    g.rect(3, 11, 6, 6, 'O');
    g.rect(3, 11, 6, 1, 'o');
    g.e(6, 7, 5, 5, 'G');
    g.e(4, 5, 3, 3, 'g');
    g.e(8, 4, 3, 3, 'g');
    g.line(6, 11, 6, 6, 'N');
  });
  Sprites.build('cooler', 10, 20, 1, (g) => {
    g.rect(1, 8, 8, 11, 'W');
    g.rect(1, 8, 8, 1, 'w');
    g.rect(2, 1, 6, 8, 'C');
    g.rect(3, 0, 4, 2, 'c');
    g.rect(3, 12, 4, 2, 'm');
    g.px(4, 13, 'r');
    g.px(5, 13, 'c');
    g.rect(0, 18, 10, 2, 'd');
  });
  Sprites.build('couch', 32, 16, 1, (g) => {
    g.rect(2, 2, 28, 8, 'p');
    g.rect(0, 5, 5, 9, 'P');
    g.rect(27, 5, 5, 9, 'P');
    g.rect(4, 8, 24, 5, 'p');
    g.rect(4, 8, 12, 5, 'h');
    g.rect(16, 8, 12, 1, 'P');
    g.rect(15, 8, 1, 5, 'P');
    g.rect(3, 14, 3, 2, 'N');
    g.rect(26, 14, 3, 2, 'N');
    g.line(6, 4, 9, 6, 'h'); // tear
  });
  Sprites.build('grill', 16, 20, 2, (g, f) => {
    g.e(8, 6, 7, 6, 'd');
    g.rect(1, 6, 14, 3, 'd');
    g.rect(2, 7, 12, 1, 'm');
    g.rect(7, 9, 2, 9, 'm');
    g.line(7, 18, 3, 19, 'm');
    g.line(8, 18, 13, 19, 'm');
    g.e(5, 4, 2, 1.5, 'm');
    g.px(8, 1, 'l');
    g.px(7 + f, 0, 'm');
  });
  Sprites.build('bush', 20, 14, 1, (g) => {
    g.e(10, 8, 9, 5, 'G');
    g.e(6, 6, 5, 4, 'g');
    g.e(14, 6, 5, 4, 'g');
    g.e(10, 4, 4, 3, 'g');
    g.px(7, 5, 'r');
    g.px(13, 4, 'Y');
    g.px(10, 8, 'r');
  });
  Sprites.build('tire', 14, 14, 1, (g) => {
    g.e(7, 7, 6.5, 6.5, 'd');
    g.e(7, 7, 3, 3, 'k');
    g.px(7, 7, 'm');
    g.px(2, 4, 'm');
    g.px(11, 10, 'm');
  });
  Sprites.build('flower', 6, 8, 2, (g, f) => {
    g.line(3, 7, 3 + f, 3, 'G');
    g.rect(2 + f, 1, 3, 3, ['r', 'Y'][f]);
    g.px(3 + f, 2, 'o');
  });
  Sprites.build('fence', 12, 16, 1, (g) => {
    g.rect(1, 0, 10, 14, 't');
    g.rect(1, 0, 10, 2, 'T');
    g.rect(1, 3, 1, 11, 'T');
    g.px(5, 5, 'T');
    g.px(7, 9, 'T');
    g.rect(0, 5, 12, 2, 'T');
    g.rect(0, 10, 12, 2, 'T');
  });
  Sprites.build('cubicle', 34, 22, 1, (g) => {
    g.rect(0, 0, 34, 22, 'm');
    g.rect(0, 0, 34, 3, 'l');
    g.rect(0, 3, 34, 1, 'd');
    g.rect(2, 6, 12, 8, 'W');
    g.rect(3, 7, 10, 1, 'l');
    g.rect(5, 9, 6, 1, 'r');
    g.rect(18, 7, 10, 7, 'y');
    g.rect(20, 9, 6, 1, 'k');
    g.rect(0, 20, 34, 2, 'd');
  });
  Sprites.build('glitchblock', 12, 12, 3, (g, f) => {
    const cols = [['c', 'p'], ['p', 'w'], ['c', 'P']][f];
    g.rect(0, 0, 12, 12, cols[0]);
    g.rect(2, 2, 4, 4, 'k');
    g.rect(6, 6, 6, 3, cols[1]);
    g.rect(0, 8, 5, 2, 'k');
    g.rect(8, 1, 3, 2, 'w');
  }, { outline: false });

  /* =====================================================================
     UI ICON SPRITES (upgrade cards, event icons)
     ===================================================================== */
  const I = (name, rows) => Sprites.ascii(name, rows, { anchor: 'center', outline: '#1b1226' });
  I('ic_bonk', ['..dddd..', '.dmmmmd.', '.dmmmmd.', '..dmmd..', '...nn...', '...nn...', '...nn...', '...NN...']);
  I('ic_speed', ['....cc..', '...cwc..', '..cwc...', '.cccccc.', '..cwc...', '...cc...', '..cc....', '.c......']);
  I('ic_heart', ['.rr..rr.', 'rwrrrrrr', 'rrrrrrrr', 'rrrrrrrr', '.rrrrrr.', '..rrrr..', '...rr...', '........']);
  I('ic_stamina', ['...yy...', '..yYy...', '.yYy....', 'yyYyyyy.', '...yYy..', '..yYy...', '..yy....', '.y......']);
  I('ic_roll', ['..cccc..', '.cwwwwc.', 'cw....wc', 'c......c', 'c....cc.', '.c..cwc.', '..ccc...', '........']);
  I('ic_shotspeed', ['.....oo.', '....oYo.', 'rrrroo..', 'rYYro...', 'rrrr.o..', '.....o..', '........', '........']);
  I('ic_multi', ['.y....y.', '.yy..yy.', '..yyyy..', '.yyyyyy.', '..yyyy..', '.yy..yy.', '.y....y.', '........']);
  I('ic_boom', ['..o.o.o.', '.oYoYoY.', '.oYYYYo.', 'oYYrrYYo', '.oYYYYo.', '.oYoYoY.', '..o.o.o.', '........']);
  I('ic_coin', ['..yyyy..', '.yYYYYy.', 'yYYyyYYy', 'yYYyyYYy', 'yYYyyYYy', 'yYYyyYYy', '.yYYYYy.', '..yyyy..']);
  I('ic_crit', ['...Y....', '...Y....', '.YYYYY..', '..YYY...', '.YY.YY..', '.Y...Y..', '........', '........']);
  I('ic_snack', ['...gg...', '..g.....', '.rrrrr..', 'rrwrrrr.', 'rrrrrrr.', 'rrrrrrr.', '.rrrrr..', '........']);
  I('ic_idiot', ['..wwww..', '.wkwwkw.', '.wwwwww.', '.wwkkww.', '..wwww..', '..w..w..', '........', '........']);
  I('ic_skull', ['..dddd..', '.dmmmmd.', 'dmmmmmmd', 'dmkmmkmd', '.dmmmmd.', '..dmmd..', '..d..d..', '........']);
  I('ic_refund', ['.gggg...', 'g...gg..', 'g....g..', 'g...gg..', '.gggg...', '...ggg..', '..gggg..', '...gg...']);
  I('ic_reality', ['..p..p..', '.pPpppP.', 'ppPppPpp', '.pppppp.', 'ppPppPpp', '.pPpppP.', '..p..p..', '........']);
  I('ic_magnet', ['rr....bb', 'rr....bb', 'rr....bb', 'rrr..bbb', '.rrbbbb.', '..rbbb..', '........', '........']);
  I('ic_weapon', ['....mm..', '...mWm..', '..mWm...', '.nWm....', 'nNn.....', 'NN......', '........', '........']);
  I('ic_egg', ['..wwww..', '.wWWWWw.', 'wWWWWWWw', 'wWWWWWWw', 'wWWWWWWw', '.wWWWWw.', '..wwww..', '........']);
  I('ic_power', ['..pp....', '.pwwp...', 'ppwwpp..', '.pwwp...', '..pp....', '........', '........', '........']);
})(window.CH);
