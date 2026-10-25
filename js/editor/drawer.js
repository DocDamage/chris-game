/* The stage editor's drawer (PLAN.md 23): every piece of every pack, in the manner of Doc's Doodads' item bag. Tabs
   (all, props, floor, walls, animated, favourites, recently used, my imports), a pack and a kind filter, a search
   (words, kind:x pack:x sheet:x type:x, -word to leave out), thumbnail size, a card grid that only builds the cards in
   view, a hover card that plays a piece's animation. A click picks the piece for the stamp; Ctrl/Shift+click picks
   several (the scatter brush mixes them); right-click marks a favourite. Pictures dropped here are brought in
   (import.js). */
(function (CH) {
  const ED = CH.Editor, CAT = CH.EdCatalog, $ = ED.$;
  const DR = (ED.drawer = { tab: 'all', pack: '', kind: '', q: '', size: 72, list: [] });
  const LS = 'chaos.editor.drawer';
  const prefs = (() => { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch (e) { return {}; } })();
  prefs.fav = prefs.fav || {};
  prefs.recent = prefs.recent || [];
  DR.size = prefs.size || 72;
  const savePrefs = () => { try { localStorage.setItem(LS, JSON.stringify(prefs)); } catch (e) { /* (private window) */ } };
  const TABS = [['all', 'All'], ['prop', 'Props'], ['floor', 'Floor'], ['wall', 'Walls'], ['anim', 'Animated'], ['fav', '★'], ['recent', 'Recent'], ['mine', 'My imports']];
  let el, grid, spacer, countEl, packSel, kindSel, search, cards = new Map();

  DR.build = function (host) {
    el = host;
    search = $('input', { type: 'search', placeholder: 'Find… (tree, kind:barrel, pack:seabed, -dead)', oninput: () => { DR.q = search.value; DR.refresh(); } });
    const tabs = $('div', { class: 'tabs' });
    for (const [id, label] of TABS) tabs.append($('button', { 'data-tab': id, text: label, onclick: () => { DR.tab = id; DR.refresh(); } }));
    packSel = $('select', { onchange: () => { DR.pack = packSel.value; DR.refresh(); } });
    kindSel = $('select', { onchange: () => { DR.kind = kindSel.value; DR.refresh(); } });
    const size = $('input', { type: 'range', min: 40, max: 160, value: DR.size, title: 'Thumbnail size', oninput: (e) => { DR.size = +e.target.value; prefs.size = DR.size; savePrefs(); layout(); } });
    countEl = $('span', { class: 'count' });
    grid = $('div', { class: 'ed-grid', onscroll: () => layout() });
    spacer = $('div', { class: 'spacer' });
    grid.append(spacer);
    const ft = $('div', { class: 'ft' }, [
      $('button', { text: '＋ Bring in pictures…', title: 'Add your own art: pictures or a .zip; it is cut up, given collision and animation automatically', onclick: () => ED.importer && ED.importer.pick() }),
      $('span', { class: 'count', text: 'or drop them here' }),
    ]);
    el.append($('div', { class: 'hd' }, [
      $('div', { class: 'row' }, [search]),
      tabs,
      $('div', { class: 'row' }, [packSel, kindSel]),
      $('div', { class: 'row' }, [countEl, $('span', { style: 'flex:1' }), size]),
    ]), grid, ft, $('div', { class: 'drop', text: 'Drop pictures or a .zip to bring them in' }), $('div', { class: 'ed-split' }));
    // drag the edge to make the drawer wider (Doodads: 200-800 px)
    const split = el.querySelector('.ed-split');
    split.addEventListener('pointerdown', (e) => {
      split.setPointerCapture(e.pointerId);
      const mv = (ev) => { const w = Math.max(200, Math.min(800, ev.clientX)); ED.els.root.style.setProperty('--dw', w + 'px'); layout(); };
      split.addEventListener('pointermove', mv);
      split.addEventListener('pointerup', () => split.removeEventListener('pointermove', mv), { once: true });
    });
    for (const ev of ['dragenter', 'dragover']) el.addEventListener(ev, (e) => { e.preventDefault(); el.classList.add('dragover'); });
    el.addEventListener('dragleave', (e) => { if (!el.contains(e.relatedTarget)) el.classList.remove('dragover'); });
    el.addEventListener('drop', (e) => { e.preventDefault(); el.classList.remove('dragover'); if (ED.importer && e.dataTransfer.files.length) ED.importer.files([...e.dataTransfer.files]); });
    new ResizeObserver(() => layout()).observe(grid);
  };
  DR.focusSearch = () => { search.focus(); search.select(); };

  /* what the filters leave */
  DR.refresh = function () {
    if (!el) return;
    const all = CAT.all();
    // the pack and kind lists
    const packs = CAT.packs();
    if (packSel.options.length !== packs.length + 1) {
      packSel.textContent = '';
      packSel.append($('option', { value: '', text: 'Every pack (' + packs.length + ')' }));
      for (const p of packs) packSel.append($('option', { value: p, text: p + ' (' + all.filter((e) => e.pack === p).length + ')' }));
    }
    packSel.value = DR.pack;
    let list = all;
    if (DR.tab === 'fav') list = list.filter((e) => prefs.fav[e.key]);
    else if (DR.tab === 'recent') list = prefs.recent.map((k) => all.find((e) => e.key === k)).filter(Boolean);
    else if (DR.tab === 'mine') list = list.filter((e) => e.pack === 'My Assets');
    else if (DR.tab !== 'all') list = list.filter((e) => e.type === DR.tab);
    if (DR.pack) list = list.filter((e) => e.pack === DR.pack);
    const kinds = [...new Set(list.map((e) => e.kind).filter(Boolean))].sort();
    kindSel.textContent = '';
    kindSel.append($('option', { value: '', text: 'Every kind (' + kinds.length + ')' }));
    for (const k of kinds) kindSel.append($('option', { value: k, text: k }));
    if (!kinds.includes(DR.kind)) DR.kind = '';
    kindSel.value = DR.kind;
    if (DR.kind) list = list.filter((e) => e.kind === DR.kind);
    list = CAT.filter(list, DR.q);
    DR.list = list;
    for (const b of el.querySelectorAll('[data-tab]')) b.classList.toggle('on', b.dataset.tab === DR.tab);
    countEl.textContent = list.length + ' of ' + all.length + ' pieces';
    for (const c of cards.values()) c.remove();
    cards.clear();
    grid.scrollTop = 0;
    layout();
    if (!list.length) {
      const msg = DR.tab === 'fav' ? 'Right-click a piece to make it a favourite.' : DR.tab === 'recent' ? 'The pieces you place show here.' : DR.tab === 'mine' ? 'Pictures you bring in show here.' : 'Nothing matches.';
      spacer.append($('div', { class: 'count', style: 'padding:20px 6px', text: msg, 'data-empty': '1' }));
    }
  };

  /* only the cards in view exist (thousands of pieces stay smooth) */
  function layout() {
    if (!grid) return;
    for (const e of spacer.querySelectorAll('[data-empty]')) if (DR.list.length) e.remove();
    const W = grid.clientWidth - 12, sz = DR.size, gap = 5;
    const cols = Math.max(1, Math.floor((W + gap) / (sz + gap)));
    const cw = (W - gap * (cols - 1)) / cols, ch = cw + 14;
    const rows = Math.ceil(DR.list.length / cols);
    spacer.style.height = rows * (ch + gap) + 'px';
    const top = grid.scrollTop, bot = top + grid.clientHeight;
    const r0 = Math.max(0, Math.floor(top / (ch + gap)) - 2), r1 = Math.min(rows - 1, Math.ceil(bot / (ch + gap)) + 2);
    const keep = new Set();
    for (let r = r0; r <= r1; r++) for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (i >= DR.list.length) break;
      const e = DR.list[i];
      keep.add(e.key);
      let card = cards.get(e.key);
      if (!card) { card = makeCard(e); cards.set(e.key, card); spacer.append(card); }
      card.style.left = c * (cw + gap) + 'px';
      card.style.top = r * (ch + gap) + 'px';
      card.style.width = cw + 'px';
      card.style.height = ch + 'px';
      card.classList.toggle('sel', ED.picked === e.key || ED.pickedMany.includes(e.key));
    }
    for (const [k, c] of cards) if (!keep.has(k)) { c.remove(); cards.delete(k); }
  }
  DR.layout = layout;
  function thumb(cvs, key, w, h) {
    const im = CAT.image(key);
    const g = cvs.getContext('2d');
    cvs.width = w; cvs.height = h;
    g.imageSmoothingEnabled = false;
    if (!im) { g.fillStyle = '#433'; g.fillRect(0, 0, w, h); return; }
    const s = Math.min(w / im.width, h / im.height, 4);
    const dw = Math.max(1, Math.round(im.width * s)), dh = Math.max(1, Math.round(im.height * s));
    g.drawImage(im, Math.round((w - dw) / 2), Math.round((h - dh) / 2), dw, dh);
  }
  DR.thumb = thumb;
  function makeCard(e) {
    const cvs = $('canvas');
    const card = $('div', { class: 'ed-card', title: '' }, [cvs, $('div', { class: 'nm', text: e.name })]);
    if (prefs.fav[e.key]) card.append($('div', { class: 'fav', text: '★' }));
    if (e.anim) card.append($('div', { class: 'badge', text: '▶ ' + e.n }));
    requestAnimationFrame(() => thumb(cvs, e.key, Math.max(16, Math.round(DR.size * 1.5)), Math.max(16, Math.round(DR.size * 1.5))));
    card.addEventListener('click', (ev) => DR.choose(e.key, ev.ctrlKey || ev.metaKey || ev.shiftKey));
    card.addEventListener('contextmenu', (ev) => { ev.preventDefault(); DR.fav(e.key); });
    card.addEventListener('mouseenter', (ev) => hoverCard(e, ev));
    card.addEventListener('mouseleave', () => hoverCard(null));
    card.addEventListener('dblclick', () => { DR.choose(e.key); ED.setTool('stamp'); });
    return card;
  }
  /* pick a piece: the stamp places it; with Ctrl/Shift, several for the scatter brush */
  DR.choose = function (key, many) {
    if (many) {
      const i = ED.pickedMany.indexOf(key);
      if (i >= 0) ED.pickedMany.splice(i, 1); else ED.pickedMany.push(key);
      if (ED.picked && !ED.pickedMany.includes(ED.picked)) ED.pickedMany.unshift(ED.picked);
      ED.picked = key;
    } else { ED.picked = key; ED.pickedMany = [key]; }
    if (ED.tool !== 'stamp' && ED.tool !== 'scatter' && ED.tool !== 'tiles') ED.setTool(many ? 'scatter' : 'stamp');
    layout();
    ED.inspect();
  };
  DR.used = function (key) {
    prefs.recent = [key].concat(prefs.recent.filter((k) => k !== key)).slice(0, 80);
    prefs.count = prefs.count || {};
    prefs.count[key] = (prefs.count[key] || 0) + 1;
    savePrefs();
  };
  DR.fav = function (key) {
    if (prefs.fav[key]) delete prefs.fav[key]; else prefs.fav[key] = 1;
    savePrefs();
    const c = cards.get(key);
    if (c) { c.remove(); cards.delete(key); }
    layout();
  };
  DR.isFav = (key) => !!prefs.fav[key];
  /* the eyedropper: the piece under the mouse, picked in the drawer */
  DR.pickFromMap = function (it) {
    const key = it.o.sheet || it.o.key || (it.o.sprite && it.o.sprite.startsWith('obj.') ? it.o.sprite : null);
    if (!key) return;
    ED.picked = key; ED.pickedMany = [key];
    const e = CAT.get(key);
    if (e && !DR.list.includes(e)) { DR.tab = 'all'; DR.pack = ''; DR.kind = ''; DR.q = ''; search.value = ''; DR.refresh(); }
    const i = DR.list.indexOf(e);
    if (i >= 0) { const cols = Math.max(1, Math.floor((grid.clientWidth - 12 + 5) / (DR.size + 5))); grid.scrollTop = Math.floor(i / cols) * (DR.size + 19) - 40; }
    layout();
    ED.toast('Picked ' + (e ? e.name : key));
  };

  /* the hover card: a bigger look, its animation playing, what it is */
  let hov = null, hovT = 0;
  function hoverCard(e, ev) {
    const H = ED.els.hover;
    cancelAnimationFrame(hovT);
    if (!e) { H.style.display = 'none'; hov = null; return; }
    hov = e;
    H.textContent = '';
    const frames = CAT.frames(e.key), im = frames[0];
    const cvs = $('canvas');
    const s = im ? Math.min(4, 220 / Math.max(im.width, im.height)) : 1;
    cvs.width = im ? Math.round(im.width * s) : 64; cvs.height = im ? Math.round(im.height * s) : 64;
    const g = cvs.getContext('2d');
    g.imageSmoothingEnabled = false;
    const am = CH.Props.meta(e.key) || {};
    const fps = am.fps || e.fps || 8;
    const t0 = performance.now();
    const tick = () => {
      if (hov !== e) return;
      const f = frames[Math.floor(((performance.now() - t0) / 1000) * fps) % Math.max(1, frames.length)];
      g.clearRect(0, 0, cvs.width, cvs.height);
      if (f) g.drawImage(f, 0, 0, cvs.width, cvs.height);
      if (frames.length > 1) hovT = requestAnimationFrame(tick);
    };
    tick();
    H.append(cvs, $('div', { text: e.name }), $('div', { class: 'k', text: e.pack + (e.sheet ? ' · ' + e.sheet : '') }), $('div', { class: 'k', text: (e.kind || 'piece') + ' · ' + e.type + (im ? ' · ' + im.width + '×' + im.height + ' px' : '') + (frames.length > 1 ? ' · ' + frames.length + ' frames' : '') }));
    const used = (prefs.count && prefs.count[e.key]) || 0;
    if (used) H.append($('div', { class: 'k', text: 'placed ' + used + ' times' }));
    H.style.display = 'block';
    const r = ev.target.getBoundingClientRect();
    H.style.left = Math.min(window.innerWidth - 300, r.right + 8) + 'px';
    H.style.top = Math.max(8, Math.min(window.innerHeight - 320, r.top)) + 'px';
  }
})(window.CH);
