/* CHAOS.exe - UI kit on top of the "Mini Pocket Status" pack (bundle 'ui', see tools/pack-ui.js).
   Colour rule (PLAN.md D5): Brown = default and player 1, Silver = player 2, Gold = player 3 and boss / legendary
   screens, White = player 4 and Settings. One pack pixel is 0.75 DOM units (the pack is drawn for 640x360, the DOM
   grid is 480x270), exposed to CSS as --p.
   Everything degrades: without the ui bundle UIK.on is false and the old wooden CSS stays in charge. */
(function (CH) {
  'use strict';
  const UIK = (CH.UIK = { on: false });

  UIK.COLORS = ['brown', 'silver', 'gold', 'white'];
  UIK.FOLDER = { brown: '1 - Brown', gold: '2 - Gold', silver: '3 - Silver', white: '4 - White' };
  /* player index -> colour; boss / legendary screens ask for 'gold', Settings for 'white' */
  UIK.colorFor = (i) => UIK.COLORS[(i || 0) % 4];

  const imgs = () => (CH.Assets && CH.Assets.images) || {};
  /* an Image element from a path relative to the bundle root, e.g. '1 - Brown/Content/Holders/19.png' */
  UIK.img = (rel) => imgs()['ui.' + rel] || null;
  UIK.has = (rel) => !!imgs()['ui.' + rel];
  UIK.url = (rel) => (UIK.img(rel) ? UIK.img(rel).src : '');
  /* colour-independent art lives in '0 - Sprites' */
  UIK.sprite = (rel) => UIK.img('0 - Sprites/' + rel);
  /* colour-dependent art: UIK.c('gold', 'Content/Holders/19.png') */
  UIK.c = (color, rel) => UIK.img(UIK.FOLDER[color] + '/' + rel);
  UIK.cUrl = (color, rel) => (UIK.c(color, rel) ? UIK.c(color, rel).src : '');

  /* ------------------------------------------------------------------ frame lists */
  const BOOK = 'Pixel Book/Sprites/';
  UIK.frames = (color, dir, n) => {
    const out = [];
    for (let i = 1; i <= n; i++) out.push(UIK.cUrl(color, BOOK + dir + '/' + i + '.png'));
    return out;
  };

  /* play a list of frame URLs on an <img>; returns a handle {stop()} */
  UIK.anim = (el, urls, fps, opts) => {
    opts = opts || {};
    // tests set window.__uikInstant so book animations finish immediately
    if (window.__uikInstant) {
      if (urls.length) el.src = urls[urls.length - 1];
      if (opts.onDone && !opts.loop) opts.onDone();
      return { stop() {} };
    }
    let i = 0;
    let stopped = false;
    const step = () => {
      if (stopped) return;
      if (i >= urls.length) {
        if (opts.loop) i = 0;
        else {
          if (opts.onDone) opts.onDone();
          return;
        }
      }
      el.src = urls[i++];
      setTimeout(step, 1000 / (fps || 12));
    };
    step();
    return { stop: () => { stopped = true; } };
  };

  /* ------------------------------------------------------------------ nine-slice panels
     Holders 19..27 are a 3x3 set of 32px tiles. We stitch them into one 96x96 image for CSS border-image.
     'dark' recolours the parchment fill so light text stays readable (HUD frames, menus). */
  const cache = {};
  const PAPER = [209, 194, 154];
  const DARK = { brown: [62, 42, 34], silver: [52, 56, 74], gold: [78, 58, 28], white: [60, 60, 68] };
  UIK.nine = (color, dark) => {
    const key = color + (dark ? ':d' : '');
    if (cache[key]) return cache[key];
    const tiles = [];
    for (let i = 19; i <= 27; i++) tiles.push(UIK.c(color, 'Content/Holders/' + i + '.png'));
    if (tiles.some((t) => !t)) return '';
    const cv = document.createElement('canvas');
    cv.width = cv.height = 96;
    const x = cv.getContext('2d');
    tiles.forEach((t, k) => x.drawImage(t, (k % 3) * 32, Math.floor(k / 3) * 32));
    if (dark) {
      const d = x.getImageData(0, 0, 96, 96);
      // recolour every pixel that is close to the parchment tone of THIS colour variant
      const base = nearest(d.data);
      const to = DARK[color] || DARK.brown;
      for (let i = 0; i < d.data.length; i += 4) {
        if (d.data[i + 3] && dist3(d.data, i, base) < 36) {
          const shade = (d.data[i] + d.data[i + 1] + d.data[i + 2]) / (base[0] + base[1] + base[2]);
          d.data[i] = Math.min(255, to[0] * shade);
          d.data[i + 1] = Math.min(255, to[1] * shade);
          d.data[i + 2] = Math.min(255, to[2] * shade);
        }
      }
      x.putImageData(d, 0, 0);
    }
    return (cache[key] = cv.toDataURL());
  };
  function dist3(a, i, b) {
    return Math.abs(a[i] - b[0]) + Math.abs(a[i + 1] - b[1]) + Math.abs(a[i + 2] - b[2]);
  }
  /* the most common opaque colour of the centre tile is the parchment */
  function nearest(data) {
    const counts = {};
    let best = PAPER, bc = 0;
    for (let y = 40; y < 56; y++) for (let x = 40; x < 56; x++) {
      const i = (y * 96 + x) * 4;
      if (!data[i + 3]) continue;
      const k = data[i] + ',' + data[i + 1] + ',' + data[i + 2];
      counts[k] = (counts[k] || 0) + 1;
      if (counts[k] > bc) { bc = counts[k]; best = [data[i], data[i + 1], data[i + 2]]; }
    }
    return best;
  }

  /* tint a sprite into a data URL (e.g. the red HP bar piece) */
  UIK.dataUrl = (rel) => UIK.url(rel);

  /* ------------------------------------------------------------------ CSS */
  UIK.install = function () {
    if (UIK.on) return true;
    if (!UIK.has('1 - Brown/Content/Holders/19.png')) return false;
    let css = ':root{--p:calc(var(--u,4px) * 0.75);}\n#stage{--p:calc(var(--u) * 0.75);}\n';
    for (const c of UIK.COLORS) {
      css += `.c-${c}{--paper:url(${UIK.nine(c, false)});--nine:url(${UIK.nine(c, true)});}\n`;
    }
    css += '#stage{--nine:url(' + UIK.nine('brown', true) + ');--paper:url(' + UIK.nine('brown', false) + ');}\n';
    const st = document.createElement('style');
    st.id = 'uik-style';
    st.textContent = css;
    document.head.appendChild(st);
    document.body.classList.add('uik');
    UIK.on = true;
    return true;
  };

  /* a nine-slice box: element gets the pack frame (dark = menus/HUD, paper = journal pages) */
  UIK.box = (el, color, paper) => {
    el.classList.add('nine', 'c-' + (color || 'brown'));
    if (paper) el.classList.add('paper');
    return el;
  };

  /* ------------------------------------------------------------------ canvas helpers (HUD) */
  UIK.draw = (ctx, rel, x, y, o) => {
    const im = UIK.img(rel);
    if (!im) return false;
    o = o || {};
    const w = o.w || im.width, h = o.h || im.height;
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
    if (o.sw !== undefined) ctx.drawImage(im, o.sx || 0, o.sy || 0, o.sw, o.sh, Math.round(x), Math.round(y), o.dw !== undefined ? o.dw : o.sw, o.dh !== undefined ? o.dh : o.sh);
    else ctx.drawImage(im, Math.round(x), Math.round(y), w, h);
    if (o.alpha !== undefined) ctx.globalAlpha = 1;
    return true;
  };
  UIK.drawC = (ctx, color, rel, x, y, o) => UIK.draw(ctx, UIK.FOLDER[color] + '/' + rel, x, y, o);

  /* nine-slice on a canvas: draws the 3x3 holder tiles stretched to w x h */
  UIK.drawPanel = (ctx, color, x, y, w, h, tile) => {
    tile = tile || 32;
    const t = [];
    for (let i = 19; i <= 27; i++) t.push(UIK.c(color, 'Content/Holders/' + i + '.png'));
    if (t.some((q) => !q)) return false;
    const cw = Math.min(tile / 2, Math.floor(w / 2)), ch = Math.min(tile / 2, Math.floor(h / 2));
    // the corners keep 12 px of each 32px tile (the rest is fill), edges and centre stretch
    const cs = 12;
    const sx = [0, cs, 32 - cs], sw = [cs, 32 - 2 * cs, cs];
    const dx = [x, x + cs, x + w - cs], dw = [cs, w - 2 * cs, cs];
    const dy = [y, y + cs, y + h - cs], dh = [cs, h - 2 * cs, cs];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) ctx.drawImage(t[r * 3 + c], sx[c], sx[r], sw[c], sw[r], Math.round(dx[c]), Math.round(dy[r]), dw[c], dh[r]);
    return cw > 0 && ch > 0;
  };
})(window.CH);
