/* Bringing in new art (PLAN.md 23): pictures or a .zip dropped on the drawer (or picked with "Bring in pictures…") are
   worked out by themselves, then shown for a look before they join the drawer:
     - a picture of one thing is one piece; a sheet is cut into its pieces where the empty gaps fall;
     - a sheet whose cells look alike is an animation, one per row; four (or eight) rows of one are its facings
       (down, left, right, up), each its own piece in the drawer. Names may say it, as in Doc's Doodads: [f8], %(8),
       _strip8 or 8f give the frames in a row, [d4] the facings. RPG Maker character sheets ($name: one character,
       else eight) are cut into each character's four facings, walking;
     - a picture with no see-through parts is a floor swatch (it can also be cut into 32 px tiles);
     - each piece's kind comes from its name (barrel, tree, torch, rug ...), it stands or lies flat by that kind, and a
       standing one gets its collision traced from its art.
   Everything can be changed in the look before it is brought in, and afterwards in the details panel. The pictures go
   into data/bundle_user.js (with the settings in data/asset_meta.js), so the game carries them from then on. */
(function (CH) {
  const ED = CH.Editor, $ = ED.$, IMP = (ED.importer = {});
  const FLATWORDS = /(decal|blood|stain|splat|rug|carpet|mat\b|crack|shadow|floor|tile|ground|puddle|scorch|rune|circle|pentagram|path|moss|leaves|grass_?patch)/i;
  const LIGHTWORDS = /(torch|lamp|lantern|candle|brazier|fire|flame|glow|crystal)/i;

  IMP.pick = function () {
    const inp = $('input', { type: 'file', multiple: true, accept: 'image/png,image/jpeg,image/webp,image/gif,.zip' });
    inp.onchange = () => IMP.files([...inp.files]);
    inp.click();
  };
  const mime = (n) => (/\.png$/i.test(n) ? 'image/png' : /\.jpe?g$/i.test(n) ? 'image/jpeg' : /\.webp$/i.test(n) ? 'image/webp' : /\.gif$/i.test(n) ? 'image/gif' : '');
  /* a .zip's pictures (stored or deflated entries) */
  async function unzip(buf) {
    const dv = new DataView(buf);
    let eocd = -1;
    for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('not a zip file');
    const n = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    const out = [];
    for (let k = 0; k < n; k++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lho = dv.getUint32(p + 42, true);
      const name = new TextDecoder().decode(new Uint8Array(buf, p + 46, nl));
      p += 46 + nl + el + cl;
      if (name.endsWith('/') || !mime(name) || /__MACOSX|\/\._/.test(name)) continue;
      const lnl = dv.getUint16(lho + 26, true), lel = dv.getUint16(lho + 28, true);
      const data = new Uint8Array(buf, lho + 30 + lnl + lel, csize);
      let bytes;
      if (method === 0) bytes = data;
      else if (method === 8) bytes = new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
      else continue;
      out.push({ name, blob: new Blob([bytes], { type: mime(name) }) });
    }
    return out;
  }
  const loadImg = (blob) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('not a picture')); im.src = URL.createObjectURL(blob); });

  IMP.files = async function (files) {
    const pics = [];
    for (const f of files) {
      try {
        if (/\.zip$/i.test(f.name)) { for (const e of await unzip(await f.arrayBuffer())) pics.push({ name: e.name, blob: e.blob }); }
        else if (mime(f.name) || /^image\//.test(f.type)) pics.push({ name: f.name, blob: f });
      } catch (e) { ED.toast(f.name + ': ' + e.message, false, 5000); }
    }
    if (!pics.length) { ED.toast('No pictures there (png, jpg, webp, gif or a .zip of them).'); return; }
    const srcs = [];
    for (const p of pics) { try { srcs.push({ name: p.name, img: await loadImg(p.blob) }); } catch (e) { /* (skipped) */ } }
    // a pack often ships one picture at several sizes (1x, 2x, 3x for different engines): the smallest is kept, the
    // others are left out (they can be ticked back in)
    const stem = (n) => n.split('/').pop().replace(/\.[a-z]+$/i, '').replace(/^[!$]+/, '').replace(/([_-]?(\d+x|\d))+$/i, '').toLowerCase();
    const dir = (n) => n.replace(/[^/]*$/, '');
    const groups = {};
    for (const s of srcs) (groups[stem(s.name)] = groups[stem(s.name)] || []).push(s);
    for (const g of Object.values(groups)) {
      g.sort((a, b) => a.img.width * a.img.height - b.img.width * b.img.height);
      for (const s of g) {
        const k = (t) => s.img.width / t.img.width;
        // a copy: the same picture in another folder at exactly two, three ... times the size
        if (g.some((t) => t !== s && dir(t.name) !== dir(s.name) && k(t) >= 2 && Number.isInteger(k(t)) && s.img.height === t.img.height * k(t))) s.skip = true;
      }
    }
    IMP.review(srcs.map((s) => Object.assign(s, { mode: null, items: null })));
  };

  /* ------------------------------------------------------------------ reading a picture */
  function canvasOf(img, x, y, w, h, scale) {
    const s = scale || 1;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * s)); c.height = Math.max(1, Math.round(h * s));
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = s < 1;
    g.drawImage(img, x, y, w, h, 0, 0, c.width, c.height);
    return c;
  }
  function alphaOf(img) {
    const c = canvasOf(img, 0, 0, img.width, img.height);
    const d = c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data;
    const a = new Uint8Array(c.width * c.height);
    let opaque = 0;
    for (let i = 0; i < a.length; i++) { a[i] = d[i * 4 + 3] > 16 ? 1 : 0; opaque += a[i]; }
    return { a, w: c.width, h: c.height, opaque: opaque / a.length, data: d };
  }
  /* the bands between fully empty columns (or rows) */
  function bands(A, axis) {
    const n = axis === 'x' ? A.w : A.h, m = axis === 'x' ? A.h : A.w, out = [];
    let start = -1;
    for (let i = 0; i <= n; i++) {
      let any = false;
      if (i < n) for (let j = 0; j < m && !any; j++) any = axis === 'x' ? A.a[j * A.w + i] : A.a[i * A.w + j];
      if (any && start < 0) start = i;
      if (!any && start >= 0) { out.push([start, i]); start = -1; }
    }
    return out;
  }
  /* the separate things on a sheet: connected opaque areas, close ones joined (a lamp and its glow) */
  function islands(A) {
    const seen = new Uint8Array(A.a.length), boxes = [];
    for (let i = 0; i < A.a.length; i++) {
      if (!A.a[i] || seen[i]) continue;
      let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, n = 0;
      const st = [i];
      seen[i] = 1;
      while (st.length) {
        const c = st.pop(), x = c % A.w, y = (c / A.w) | 0;
        n++;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
          const nx = x + ox, ny = y + oy;
          if (nx < 0 || ny < 0 || nx >= A.w || ny >= A.h) continue;
          const ni = ny * A.w + nx;
          if (A.a[ni] && !seen[ni]) { seen[ni] = 1; st.push(ni); }
        }
      }
      if (n >= 6) boxes.push({ x0, y0, x1, y1, n });
    }
    // join boxes that touch or nearly do (3 px)
    for (let again = true; again;) {
      again = false;
      for (let i = 0; i < boxes.length && !again; i++) for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j];
        if (a.x0 - 3 <= b.x1 && b.x0 - 3 <= a.x1 && a.y0 - 3 <= b.y1 && b.y0 - 3 <= a.y1) { a.x0 = Math.min(a.x0, b.x0); a.y0 = Math.min(a.y0, b.y0); a.x1 = Math.max(a.x1, b.x1); a.y1 = Math.max(a.y1, b.y1); a.n += b.n; boxes.splice(j, 1); again = true; break; }
      }
    }
    return boxes.sort((a, b) => (Math.abs(a.y0 - b.y0) < 8 ? a.x0 - b.x0 : a.y0 - b.y0));
  }
  /* how alike two cells are (0 the same, 1 nothing alike): their 12x12 shrunk pictures */
  function sig(c) { const s = canvasOf(c, 0, 0, c.width, c.height, 12 / Math.max(c.width, c.height)); return s.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, s.width, s.height).data; }
  function diff(a, b) {
    const n = Math.min(a.length, b.length);
    let d = 0;
    for (let i = 0; i < n; i += 4) d += Math.abs(a[i + 3] - b[i + 3]) / 255 * 0.6 + (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2])) / 765 * 0.4;
    return d / (n / 4) + Math.abs(a.length - b.length) / Math.max(a.length, b.length);
  }
  const slug = (s) => s.replace(/\.[a-z]+$/i, '').split('/').pop().replace(/\[.*?\]|%\(.*?\)/g, '').replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').toLowerCase() || 'piece';
  function hints(name) {
    const f = /\[f(\d+)\]|%\((\d+)\)|_strip(\d+)|[_-](\d+)f\b/i.exec(name);
    const d = /\[d(\d)\]/i.exec(name);
    return { frames: f ? +(f[1] || f[2] || f[3] || f[4]) : 0, dirs: d ? +d[1] : 0 };
  }
  const KINDS = () => Object.keys(CH.Props.KIND);
  /* the kind its name says (the longest kind name found in it), else 'piece' */
  function kindFromName(name) {
    const n = name.toLowerCase();
    let best = '';
    for (const k of KINDS()) if (k.length >= 3 && n.includes(k) && k.length > best.length) best = k;
    if (!best && /tree/.test(n)) best = 'tree';
    if (!best && /bush|shrub/.test(n)) best = 'shrub';
    if (!best && /stone|rock|boulder/.test(n)) best = 'rock';
    return best || (FLATWORDS.test(n) ? 'decal' : 'piece');
  }
  const DIRS = { 4: ['down', 'left', 'right', 'up'], 8: ['down', 'down-left', 'left', 'up-left', 'up', 'up-right', 'right', 'down-right'], 3: ['down', 'side', 'up'], 2: ['down', 'up'] };

  /* a picture's pieces: [{ name, kind, layer, frames: [canvas], fps, facing }] by a way of cutting it */
  IMP.cut = function (src, mode, scale) {
    const img = src.img, A = alphaOf(img), base = slug(src.name), h = hints(src.name), items = [];
    const kind0 = kindFromName(src.name);
    const one = (frames, name, extra) => items.push(Object.assign({ name, kind: kind0, layer: FLATWORDS.test(src.name) || kind0 === 'decal' ? 'floor' : 'stand', frames, fps: 8 }, extra || {}));
    if (!mode && rmLayout(src)) mode = 'rm'; // an RPG Maker character sheet (these packs ship them)
    if (!mode) { // what it looks like
      if (A.opaque > 0.97) mode = img.width >= 96 && img.height >= 96 && img.width % 32 === 0 && img.height % 32 === 0 && img.width * img.height > 256 * 256 ? 'tiles' : 'one';
      else if (h.frames || h.dirs) mode = 'anim';
      else {
        const cols = bands(A, 'x'), rows = bands(A, 'y');
        const isl = islands(A);
        if (isl.length <= 1) mode = 'one';
        else {
          // a regular grid whose cells look alike: an animation
          const cw = cols.length >= 2 ? img.width / cols.length : 0;
          const even = cols.length >= 2 && cols.every(([a, b]) => Math.abs(Math.floor(a / cw) - Math.floor((b - 1) / cw)) === 0);
          if (even) {
            const cells = []; for (let c = 0; c < cols.length; c++) cells.push(canvasOf(img, Math.round(c * cw), 0, Math.round(cw), Math.round(img.height / Math.max(1, rows.length))));
            const ss = cells.map(sig);
            let alike = 0; for (let i = 1; i < ss.length; i++) alike += diff(ss[0], ss[i]) < 0.22 ? 1 : 0;
            mode = alike >= (ss.length - 1) * 0.6 ? 'anim' : 'pieces';
          } else mode = 'pieces';
        }
      }
    }
    src.mode = mode;
    if (mode === 'one') { const b = islands(A); const bx = b.length ? b.reduce((q, r) => ({ x0: Math.min(q.x0, r.x0), y0: Math.min(q.y0, r.y0), x1: Math.max(q.x1, r.x1), y1: Math.max(q.y1, r.y1) })) : { x0: 0, y0: 0, x1: img.width - 1, y1: img.height - 1 }; one([canvasOf(img, bx.x0, bx.y0, bx.x1 - bx.x0 + 1, bx.y1 - bx.y0 + 1, scale)], base, A.opaque > 0.97 ? { kind: 'ground', layer: 'floor' } : {}); }
    else if (mode === 'tiles') { let i = 0; for (let y = 0; y + 32 <= img.height; y += 32) for (let x = 0; x + 32 <= img.width; x += 32) one([canvasOf(img, x, y, 32, 32, scale)], base + '_' + i++, { kind: 'ground', layer: 'floor' }); }
    else if (mode === 'pieces') islands(A).forEach((b, i) => one([canvasOf(img, b.x0, b.y0, b.x1 - b.x0 + 1, b.y1 - b.y0 + 1, scale)], base + '_' + i));
    else if (mode === 'anim') {
      // frames in a row: the name's count, else the empty gaps, else square frames
      const cols = bands(A, 'x');
      let n = h.frames || (cols.length >= 2 ? cols.length : Math.max(1, Math.round(img.width / img.height)));
      const fw = Math.floor(img.width / n);
      let rowsN = h.dirs || Math.max(1, Math.round(img.height / fw));
      if (img.height % rowsN) rowsN = Math.max(1, bands(A, 'y').length);
      const fh = Math.floor(img.height / rowsN);
      const names = DIRS[rowsN] && (h.dirs || rowsN === 4 || rowsN === 8) ? DIRS[rowsN] : null;
      for (let r = 0; r < rowsN; r++) {
        // every frame cut to the same box (the union of the row's opaque parts), so the animation does not jump
        const row = canvasOf(img, 0, r * fh, n * fw, fh), RA = alphaOf(row);
        let x0 = fw, y0 = fh, x1 = -1, y1 = -1;
        for (let k = 0; k < n; k++) for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) if (RA.a[y * RA.w + k * fw + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        if (x1 < 0) continue;
        const frames = [];
        for (let k = 0; k < n; k++) frames.push(canvasOf(img, k * fw + x0, r * fh + y0, x1 - x0 + 1, y1 - y0 + 1, scale));
        one(frames, base + (rowsN > 1 ? '_' + (names ? names[r] : r) : ''), { facing: names ? names[r] : null, fps: 8 });
      }
    }
    else if (mode === 'rm') {
      // RPG Maker characters: each 3 frames (a step, standing, the other step) by 4 facings (down, left, right, up); a
      // '$' sheet is one character, any other eight (4 across, 2 down). Each facing is an animation of its own, all of a
      // character's frames cut to one box so it does not jump between facings
      const L = rmLayout(src) || { cols: 4, rows: 2 };
      const cw = img.width / (L.cols * 3), ch = img.height / (L.rows * 4);
      const dirs = ['down', 'left', 'right', 'up'];
      for (let c = 0; c < L.cols * L.rows; c++) {
        const bx = (c % L.cols) * 3 * cw, by = Math.floor(c / L.cols) * 4 * ch;
        const block = canvasOf(img, bx, by, 3 * cw, 4 * ch), BA = alphaOf(block);
        let x0 = cw, y0 = ch, x1 = -1, y1 = -1;
        for (let r = 0; r < 4; r++) for (let k = 0; k < 3; k++) for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) if (BA.a[(r * ch + y) * BA.w + k * cw + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        if (x1 < 0) continue; // (an empty place on the sheet)
        for (let r = 0; r < 4; r++) {
          let any = false; // (a facing the sheet leaves empty is skipped)
          for (let y = 0; y < ch && !any; y++) for (let x = 0; x < 3 * cw && !any; x++) any = !!BA.a[(r * ch + y) * BA.w + x];
          if (!any) continue;
          const fr = [0, 1, 2].map((k) => canvasOf(img, bx + k * cw + x0, by + r * ch + y0, x1 - x0 + 1, y1 - y0 + 1, scale));
          one([fr[0], fr[1], fr[2], fr[1]], base + (L.cols * L.rows > 1 ? '_' + (c + 1) : '') + '_' + dirs[r], { facing: dirs[r], fps: 6 });
        }
      }
    }
    for (const it of items) if (LIGHTWORDS.test(it.name) && it.layer === 'stand') it.glow = '#ffb347';
    return items;
  };
  /* an RPG Maker character sheet: '$name' is one character (3 x 4 cells), any other with see-through parts, 12 x 8
     square cells whose three steps look alike, eight of them */
  function rmLayout(src) {
    const img = src.img, file = src.name.split('/').pop();
    if (/^!?\$/.test(file) && img.width % 3 === 0 && img.height % 4 === 0) return { cols: 1, rows: 1 };
    if (img.width % 12 || img.height % 8 || img.width / 12 !== img.height / 8 || img.width / 12 < 16) return null;
    const cw = img.width / 12, A = alphaOf(img);
    if (A.opaque > 0.95) return null;
    // the first character's facing-down steps look alike, and differ little from its standing frame
    const cells = [0, 1, 2].map((k) => canvasOf(img, k * cw, 0, cw, cw));
    const sg = cells.map(sig);
    if (diff(sg[0], sg[1]) > 0.25 || diff(sg[1], sg[2]) > 0.25) return null;
    // and the characters it holds fill their twelve cells (a sheet of loose pieces on a 12 x 8 grid leaves most empty)
    let chars = 0, full = 0;
    for (let c = 0; c < 8; c++) {
      let n = 0;
      for (let r = 0; r < 4; r++) for (let k = 0; k < 3; k++) {
        const x0 = ((c % 4) * 3 + k) * cw, y0 = (Math.floor(c / 4) * 4 + r) * cw;
        let any = false;
        for (let y = y0; y < y0 + cw && !any; y += 2) for (let x = x0; x < x0 + cw && !any; x += 2) any = !!A.a[y * A.w + x];
        if (any) n++;
      }
      if (n) chars++;
      if (n === 12) full++;
    }
    if (!chars || full < chars * 0.75) return null;
    return { cols: 4, rows: 2 };
  }

  /* ------------------------------------------------------------------ the look before bringing them in */
  IMP.review = function (srcs) {
    const scaleSel = $('select', { title: 'Art scale: the game\'s art is about 32 px a tile' }, [$('option', { value: 1, text: 'as drawn (1×)' }), $('option', { value: 0.5, text: 'half size (hi-res art)' }), $('option', { value: 0.25, text: 'quarter size' }), $('option', { value: 2, text: 'double size' })]);
    const pack = $('input', { type: 'text', value: 'My Assets', title: 'The drawer lists them under this pack' });
    const list = $('div', { class: 'ed-imp' });
    const draw = () => {
      list.textContent = '';
      for (const src of srcs) {
        src.items = IMP.cut(src, src.mode, +scaleSel.value);
        const modeSel = $('select', { title: 'How the picture is cut', onchange: (e) => { src.mode = e.target.value; draw(); } });
        for (const [v, l] of [['one', 'one piece'], ['pieces', 'its separate pieces'], ['anim', 'animation (rows)'], ['rm', 'RPG Maker characters (facings)'], ['tiles', '32 px floor tiles']]) modeSel.append($('option', { value: v, text: l }));
        modeSel.value = src.mode;
        const keep = $('input', { type: 'checkbox', checked: src.skip ? undefined : true, title: 'Bring this picture in', onchange: (e) => { src.skip = !e.target.checked; draw(); } });
        list.append($('div', { class: 'it', style: 'grid-column:1/-1;background:transparent;border:0;padding:2px 0' }, [keep, ' ', $('b', { text: src.name.split('/').pop() }), src.skip ? $('span', { class: 'k', text: ' (left out' + (/\//.test(src.name) ? ': a bigger copy of another picture' : '') + ')' }) : null, ' ', $('span', { class: 'k', text: src.img.width + '×' + src.img.height + ' px · cut as ' }), modeSel, $('span', { class: 'k', text: ' → ' + src.items.length + ' piece' + (src.items.length === 1 ? '' : 's') })]));
        if (src.skip) continue;
        for (const it of src.items.slice(0, 200)) {
          const c = $('canvas');
          const f = it.frames[0], s = Math.min(3, 130 / f.width, 90 / f.height);
          c.width = Math.max(1, Math.round(f.width * s)); c.height = Math.max(1, Math.round(f.height * s));
          const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
          let k = 0;
          const tick = () => { if (!c.isConnected) return; g.clearRect(0, 0, c.width, c.height); g.drawImage(it.frames[k++ % it.frames.length], 0, 0, c.width, c.height); if (it.frames.length > 1) setTimeout(tick, 1000 / (it.fps || 8)); };
          requestAnimationFrame(tick);
          const kind = $('select', { onchange: (e) => { it.kind = e.target.value; } });
          for (const kk of ['piece'].concat(KINDS().sort())) kind.append($('option', { value: kk, text: kk }));
          kind.value = KINDS().includes(it.kind) ? it.kind : 'piece';
          const layer = $('select', { onchange: (e) => { it.layer = e.target.value; } }, [$('option', { value: 'stand', text: 'stands (collision)' }), $('option', { value: 'floor', text: 'lies on the floor' })]);
          layer.value = it.layer;
          const name = $('input', { type: 'text', value: it.name, onchange: (e) => { it.name = e.target.value; } });
          const use = $('input', { type: 'checkbox', checked: it.skip ? undefined : true, title: 'Bring this piece in', onchange: (e) => { it.skip = !e.target.checked; box.style.opacity = it.skip ? 0.4 : 1; } });
          const box = $('div', { class: 'it' }, [$('label', { class: 'k' }, [use, ' bring in']), c, name, kind, layer, $('div', { class: 'k', text: f.width + '×' + f.height + (it.frames.length > 1 ? ' · ' + it.frames.length + ' frames' : '') + (it.facing ? ' · faces ' + it.facing : '') })]);
          if (it.frames.length > 1) box.append($('input', { type: 'number', value: it.fps, min: 1, max: 30, title: 'frames a second', onchange: (e) => { it.fps = +e.target.value || 8; } }));
          list.append(box);
        }
      }
    };
    scaleSel.onchange = draw;
    draw();
    ED.modal('Bring in ' + srcs.length + ' picture' + (srcs.length === 1 ? '' : 's'), [
      $('div', { class: 'row' }, [$('label', { text: 'Art scale' }), scaleSel, $('label', { text: 'Pack' }), pack]),
      $('p', { class: 'note', text: 'Each piece was cut, named and given a kind from its file name; standing ones get their collision traced from the art. Change anything here (or later in the details panel).' }),
      list,
    ], [$('button', { text: 'Cancel', onclick: ED.closeModal }), $('button', { class: 'primary', text: 'Bring them in', onclick: () => { ED.closeModal(); IMP.commit(srcs, pack.value || 'My Assets'); } })]);
  };

  /* ------------------------------------------------------------------ into the game */
  IMP.commit = async function (srcs, packName) {
    const U = (window.CH_USER_ASSETS = window.CH_USER_ASSETS || { img: {}, kits: {}, anims: {} });
    U.img = U.img || {}; U.kits = U.kits || {}; U.anims = U.anims || {};
    const M = (window.CH_ASSET_META = window.CH_ASSET_META || {});
    const IM = CH.Assets.images, meta = (CH.Assets.meta = CH.Assets.meta || {});
    meta.kits = meta.kits || {};
    meta.lands = meta.lands || {};
    meta.lands.anims = meta.lands.anims || {};
    let kn = 1;
    while (U.kits['us' + kn] || meta.kits['us' + kn]) kn++;
    const kid = 'us' + kn, kit = { pack: packName, n: 0, kinds: [], roles: [], names: [] };
    const added = [];
    const decode = async (key, canvas) => { const url = canvas.toDataURL('image/png'); U.img[key] = url; const im = new Image(); im.src = url; await im.decode().catch(() => {}); IM[key] = im; };
    for (const src of srcs) for (const it of src.skip ? [] : src.items || IMP.cut(src, src.mode, 1)) {
      if (it.skip) continue;
      const kind = it.kind; // ('piece': a kind of its own; its settings below say how it stands)
      let key;
      if (it.frames.length > 1) {
        let nm = 'us_' + slug(it.name), q = 1;
        while (U.anims[nm] || meta.lands.anims[nm]) nm = 'us_' + slug(it.name) + '_' + ++q;
        key = 'anim.' + nm;
        for (let i = 0; i < it.frames.length; i++) await decode(key + '.' + i, it.frames[i]);
        const a = { n: it.frames.length, kind, fps: it.fps || 8, fw: it.frames[0].width, fh: it.frames[0].height, pack: packName, name: it.name, facing: it.facing || undefined };
        U.anims[nm] = a; meta.lands.anims[nm] = a;
      } else {
        key = 'kit.' + kid + '.' + kit.n;
        await decode(key, it.frames[0]);
        kit.kinds.push(kind); kit.roles.push(it.layer === 'floor' ? 'decal' : 'prop'); kit.names.push(it.name);
        kit.n++;
      }
      M[key] = { kind, layer: it.layer, name: it.name };
      if (it.glow) { M[key].glow = it.glow; M[key].lr = 70; }
      added.push({ key, it });
    }
    if (kit.n) { U.kits[kid] = kit; meta.kits[kid] = kit; }
    CH.Props.rebuild();
    // a standing piece's collision, traced from its art now that it is a sprite
    for (const { key, it } of added) {
      if (it.layer !== 'stand') { M[key].box = null; continue; }
      const nm = CH.Props.sprite(key);
      if (nm) { const b = ED.traceBox(nm); M[key].box = { hw: b.hw, hh: b.hh, cx: b.cx || 0, cy: b.cy }; }
    }
    CH.Props.rebuild();
    CH.EdCatalog.reset();
    try {
      await ED.files.saveUser();
      await ED.files.saveMeta();
    } catch (e) { ED.toast('The pictures are in the drawer, but could not be saved into the game: ' + e.message, false, 7000); }
    if (ED.drawer) { ED.drawer.tab = 'mine'; ED.drawer.refresh(); }
    if (added[0]) { ED.picked = added[0].key; ED.pickedMany = [added[0].key]; ED.setTool('stamp'); }
    ED.toast('Brought in ' + added.length + ' piece' + (added.length === 1 ? '' : 's') + '.', false, 4000);
  };
})(window.CH);
