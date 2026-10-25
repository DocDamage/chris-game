/* The stage editor's details panel (PLAN.md 23): what is picked, and its settings.
   A piece: where it stands, flipped, its size, whether it stands or lies flat, its collision (solid or walked
   through; presets None, Traced from art, Full, Bottom half, Trunk; the box's size and offset, also dragged by its
   handles on the map), whether a hero can jump it or break it, its animation speed, its light. "Use as this piece's
   default" keeps the settings for every later placing of that piece, here and by the game's own generator
   (data/asset_meta.js). Several picked: what they share. A marker: its own settings. Nothing picked: the stage
   (its name, look, size, a check that every spot can be walked to, and what the drawer's picked piece is). */
(function (CH) {
  const ED = CH.Editor, $ = ED.$, TS = ED.TS;
  let pending = 0;
  ED.inspect = function () {
    if (pending) return;
    pending = requestAnimationFrame(() => { pending = 0; render(); });
  };
  const num = (v, on, o) => $('input', Object.assign({ type: 'number', value: Math.round((v || 0) * 10) / 10, onchange: (e) => on(+e.target.value) }, o || {}));
  const chk = (v, on) => $('input', { type: 'checkbox', checked: v ? true : undefined, onchange: (e) => on(e.target.checked) });
  const field = (label, ...kids) => $('div', { class: 'f' }, [$('label', { text: label })].concat(kids));
  const head = (t) => $('h3', { text: t });
  const btn = (text, on, o) => $('button', Object.assign({ text, onclick: on }, o || {}));

  function render() {
    const P = ED.els && ED.els.insp;
    if (!P) return;
    P.textContent = '';
    if (!ED.L) return;
    const sel = ED.sel;
    if (!sel.length) return stagePanel(P);
    if (sel.length > 1) return manyPanel(P, sel);
    const it = sel[0];
    if (it.t === 'mark') return markPanel(P, it);
    if (it.t === 'prop') return propPanel(P, it);
    return flatPanel(P, it);
  }

  function thumbOf(name, maxW) {
    const c = $('canvas', { class: 'thumb' });
    if (!name || !CH.Sprites.has(name)) return c;
    const sp = CH.Sprites.get(name), f = sp.frames[0];
    const s = Math.min(3, (maxW || 250) / f.width, 160 / f.height);
    c.width = Math.max(1, Math.round(f.width * s)); c.height = Math.max(1, Math.round(f.height * s));
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(f, 0, 0, c.width, c.height);
    return c;
  }
  const keyOf = (p) => p.sheet || (p.sprite && p.sprite.startsWith('obj.') ? p.sprite : null);

  /* ------------------------------------------------------------------ a standing piece */
  function propPanel(P, it) {
    const p = it.o, key = keyOf(p), e = key && CH.EdCatalog.get(key);
    const items = [it];
    P.append(head('Piece'), thumbOf(p.sprite));
    P.append($('div', { class: 'note', text: e ? e.name + ' · ' + e.pack : key || p.sprite }));
    P.append(field('Position', num(p.x, (v) => ED.moveItems('move', items, v - p.x, 0)), num(p.y, (v) => ED.moveItems('move', items, 0, v - p.y))));
    P.append(field('Flipped', chk(p.flip, (v) => ED.edit('flip', items, { flip: v || undefined }))));
    if (key) P.append(field('Size', num(p.scale || 1, (v) => rescale(it, v), { step: 0.05, min: 0.1, max: 6 })));
    P.append(field('Lie flat', btn('Put it on the floor', () => toFloor(it), { title: 'A rug, a stain, a plate: drawn under everything, walked over' })));

    P.append(head('Collision'));
    P.append(field('Solid', chk(p.solid, (v) => ED.edit(v ? 'make solid' : 'walk-through', items, v ? { solid: true, box: p.box || ED.traceBox(p.sprite) } : { solid: false }))));
    const pre = $('div', { class: 'btns' });
    const setBox = (label, box) => ED.edit(label, items, box ? { solid: true, box: { hw: box.hw, hh: box.hh }, cx: box.cx || 0, cy: box.cy != null ? box.cy : -box.hh + 1 } : { solid: false, box: undefined });
    const sp = CH.Sprites.has(p.sprite) ? CH.Sprites.get(p.sprite) : { w: 32, h: 32, ax: 16, ay: 32 };
    pre.append(
      btn('None', () => setBox('no collision', null), { title: 'Walked through' }),
      btn('Traced from art', () => setBox('trace collision', ED.traceBox(p.sprite)), { title: 'Its foot, read from the picture' }),
      btn('Full', () => { const hw = Math.round(sp.w / 2) - 1, hh = Math.round(sp.h / 2) - 1; setBox('full collision', { hw, hh, cx: Math.round(sp.w / 2 - sp.ax), cy: Math.round(sp.h / 2 - sp.ay) }); }),
      btn('Bottom half', () => { const hw = Math.round(sp.w * 0.45), hh = Math.round(sp.h / 4); setBox('bottom-half collision', { hw, hh, cx: Math.round(sp.w / 2 - sp.ax), cy: Math.round(sp.h - sp.ay - hh) }); }),
      btn('Trunk', () => setBox('trunk collision', { hw: Math.max(3, Math.round(sp.w * 0.12)), hh: 4, cx: Math.round(sp.w / 2 - sp.ax), cy: -3 }), { title: 'A narrow base: a tree, a lamp post' }),
    );
    P.append(pre);
    if (p.box) {
      P.append(field('Half width', num(p.box.hw, (v) => ED.edit('collision', items, { box: Object.assign({}, p.box, { hw: Math.max(1, v) }) }))));
      P.append(field('Half depth', num(p.box.hh, (v) => ED.edit('collision', items, { box: Object.assign({}, p.box, { hh: Math.max(1, v) }) }))));
      P.append(field('Offset x, y', num(p.cx || 0, (v) => ED.edit('collision', items, { cx: v })), num(p.cy || 0, (v) => ED.edit('collision', items, { cy: v }))));
      P.append($('div', { class: 'btns' }, [btn(ED.boxEdit ? '✓ Done editing on the map' : '✎ Drag it on the map', () => { ED.boxEdit = !ED.boxEdit; ED.showBoxes = true; ED.refreshTop(); ED.inspect(); }, { class: ED.boxEdit ? 'on' : '', title: 'Orange handles on the map size the box (Ctrl+drag its middle moves it)' })]));
    }
    P.append(field('Can jump it', chk(p.jumpable, (v) => ED.edit('jumpable', items, { jumpable: v }))));
    P.append(field('Breakable', chk(p.destructible, (v) => ED.edit('breakable', items, { destructible: v, maxHp: p.maxHp || 40, hp: p.maxHp || 40 })), p.destructible ? num(p.maxHp || p.hp || 40, (v) => ED.edit('toughness', items, { maxHp: v, hp: v }), { title: 'hit points' }) : null));
    P.append(field('Sways', chk(p.swayable, (v) => ED.edit('sway', items, { swayable: v }))));

    const frames = CH.Sprites.has(p.sprite) ? CH.Sprites.get(p.sprite).frames.length : 1;
    if (frames > 1 || p.fps) {
      P.append(head('Animation'));
      P.append($('div', { class: 'note', text: frames + ' frames' }));
      P.append(field('Frames a second', num(p.fps || 0, (v) => ED.edit('animation speed', items, { fps: v || undefined }), { min: 0, max: 60 })));
    }
    P.append(head('Light'));
    P.append(field('Glows', chk(!!p.glow, (v) => ED.edit('light', items, v ? { glow: p.glow || '#ffb347', lr: p.lr || 70, phase: Math.random() } : { glow: undefined, lr: undefined }))));
    if (p.glow) {
      P.append(field('Colour', $('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(p.glow) ? p.glow : '#ffb347', onchange: (e) => ED.edit('light colour', items, { glow: e.target.value }) })));
      P.append(field('Reach', num(p.lr || 70, (v) => ED.edit('light reach', items, { lr: v }))));
    }
    eventPanel(P, p);

    if (key) {
      P.append(head('This piece everywhere'));
      P.append($('div', { class: 'note', text: 'Keep these settings for every ' + (e ? e.name : 'piece') + ' placed from now on, by you and by the game\'s own stages.' }));
      P.append($('div', { class: 'btns' }, [
        btn('Use as this piece\'s default', () => ED.files && ED.files.setDefault(key, { layer: 'stand', box: p.solid && p.box ? { hw: p.box.hw, hh: p.box.hh, cx: p.cx || 0, cy: p.cy || 0 } : null, fps: p.fps || undefined, glow: p.glow || undefined, lr: p.glow ? p.lr : undefined, scale: p.scale && p.scale !== 1 ? p.scale : undefined })),
        CH.Props.meta(key) ? btn('Forget its default', () => ED.files && ED.files.setDefault(key, null), { class: 'danger' }) : null,
      ]));
    }
    P.append($('div', { class: 'btns' }, [btn('Delete', () => ED.removeItems('delete', items), { class: 'danger' }), btn('Duplicate', () => { ED.copy(); ED.paste(false, 16); })]));
  }
  /* what the piece is to the game (js/editor/roles.js): its role, and that role's own settings */
  function eventPanel(P, p) {
    const items = [{ t: 'prop', o: p }], key = p.sheet || p.sprite, role = ED.roleOf(p), def = ED.ROLE[role] || ED.ROLE.scenery;
    P.append(head('What it is'));
    const sel = $('select', { onchange: (e) => ED.setRole([p], e.target.value) });
    for (const [r, d] of Object.entries(ED.ROLE)) sel.append($('option', { value: r, text: d.ic + ' ' + d.label }));
    sel.value = ED.ROLE[role] ? role : 'scenery';
    P.append(field('It is', sel), $('div', { class: 'note', text: def.tip + '.' }));
    const evd = p.evd || {};
    const setD = (label, v) => ED.edit(label, items, { evd: Object.assign({}, evd, v) });
    if (role === 'chest') P.append(field('Tier', num(evd.tier || 1, (v) => setD('chest tier', { tier: Math.max(1, Math.round(v)) }), { min: 1, max: 12 })));
    if (role === 'shrine') { const s2 = $('select', { onchange: (e) => setD('blessing', { kind: e.target.value }) }); for (const k of ['healing', 'speed', 'blood', 'elite']) s2.append($('option', { value: k, text: k })); s2.value = evd.kind || 'healing'; P.append(field('Blessing', s2)); }
    if (role === 'breach') { const s2 = $('select', { onchange: (e) => { const [k, n] = e.target.value.split('|'); setD('breach kind', { kind: k, name: n }); } }); for (const h of [...new Set(Object.values(CH.LevelGen.HIVES).map((h) => h.kind + '|' + h.name))]) s2.append($('option', { value: h, text: h.split('|')[1].toLowerCase() })); s2.value = (evd.kind || '') + '|' + (evd.name || ''); P.append(field('Kind', s2)); }
    if (role === 'sign') {
      P.append(field('Title', $('input', { type: 'text', value: evd.name || '', onchange: (e) => setD('sign title', { name: e.target.value }) })));
      P.append(field('Words', $('textarea', { rows: 4, style: 'flex:1', onchange: (e) => setD('sign words', { lines: e.target.value.split(String.fromCharCode(10)).filter(Boolean) }) }, [(evd.lines || []).join(String.fromCharCode(10))])));
    }
    if (def.spot) P.append($('div', { class: 'note', text: 'The ' + def.ic + ' badge on the map is where a hero stands to use it: drag it.' }));
    const g = ED.recognise(key, p);
    const kind = (CH.Props.meta(key) || {}).kind || CH.Props.kindOf(key) || 'piece';
    P.append($('div', { class: 'btns' }, [btn('Do this for every ' + (kind === 'piece' ? 'one of this piece' : kind), () => { ED.remember(kind === 'piece' ? key : kind, role === 'scenery' ? 'scenery' : role); ED.toast('Every ' + (kind === 'piece' ? 'one of these' : kind) + ' you place from now on: ' + def.label.toLowerCase() + '.'); }, { title: 'The editor took it for: ' + (ED.ROLE[g.role] || ED.ROLE.scenery).label + (g.why ? ' (' + g.why + ')' : ' (it asked)') })]));
  }
  /* a piece made again at another size (its box scaled with it) */
  function rescale(it, v) {
    const p = it.o, key = keyOf(p);
    if (!key || !(v > 0)) return;
    const name = key.startsWith('obj.') ? key : CH.Props.sprite(key, v);
    if (!name) return;
    const k = v / (p.scale || 1);
    const was = { sprite: p.sprite, scale: p.scale, box: ED.clone(p.box), cx: p.cx, cy: p.cy };
    const now = { sprite: name, scale: v === 1 ? undefined : v, box: p.box ? { hw: Math.round(p.box.hw * k), hh: Math.max(2, Math.round(p.box.hh * k)) } : p.box, cx: Math.round((p.cx || 0) * k), cy: Math.round((p.cy || 0) * k) };
    ED.act('resize', () => Object.assign(p, ED.clone(now)), () => Object.assign(p, ED.clone(was)));
  }
  /* a standing piece laid on the floor instead (and the other way): the new one is made, then the step swaps them */
  function swap(label, it, made) {
    if (!made) return;
    ED.detach(made);
    let at = null;
    ED.act(label, () => { at = ED.detach(it); ED.attach(made); ED.sel = [made]; }, () => { ED.detach(made); ED.attach(it, at); ED.sel = [it]; });
  }
  function toFloor(it) {
    const p = it.o, key = keyOf(p);
    if (!key) { ED.toast('This piece has no pack picture to lay flat.'); return; }
    swap('lay flat', it, ED.place(key, p.x, p.y, { as: 'floor', flip: p.flip, scale: p.scale }));
  }
  function toStand(it) {
    const d = it.o;
    swap('stand up', it, ED.place(d.key, d.x, d.y + (d.img ? d.img.height / 2 : 0), { as: 'stand', flip: d.fx, scale: d.s && d.s !== 1 ? d.s : undefined }));
  }

  /* ------------------------------------------------------------------ a piece on the floor */
  function flatPanel(P, it) {
    const d = it.o, items = [it];
    const e = CH.EdCatalog.get(d.key) || CH.EdCatalog.get('kit.' + d.key);
    P.append(head(it.t === 'inlay' ? 'Floor inlay' : 'On the floor'));
    const im = d.img || CH.Assets.images[d.key] || CH.Assets.images['kit.' + d.key];
    if (im) { const c = $('canvas', { class: 'thumb' }); const s = Math.min(3, 250 / im.width, 160 / im.height); c.width = Math.round(im.width * s); c.height = Math.round(im.height * s); const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(im, 0, 0, c.width, c.height); P.append(c); }
    P.append($('div', { class: 'note', text: e ? e.name + ' · ' + e.pack : d.key }));
    P.append(field('Position', num(d.x, (v) => ED.moveItems('move', items, v - d.x, 0)), num(d.y, (v) => ED.moveItems('move', items, 0, v - d.y))));
    if (it.t === 'decal') {
      P.append(field('Flipped', chk(d.fx, (v) => ED.edit('flip', items, { fx: v }))));
      P.append(field('Opacity', $('input', { type: 'range', min: 0.1, max: 1, step: 0.05, value: d.a == null ? 1 : d.a, onchange: (ev) => ED.edit('opacity', items, { a: +ev.target.value }) })));
      P.append($('div', { class: 'btns' }, [btn('Stand it up', () => toStand(it), { title: 'Make it a standing piece, sorted with the heroes' })]));
      if (d.key) P.append($('div', { class: 'btns' }, [btn('Lie flat by default', () => ED.files && ED.files.setDefault(d.key, Object.assign({}, CH.Props.meta(d.key) || {}, { layer: 'floor', box: null })), { title: 'This piece always goes on the floor from now on' })]));
    }
    P.append($('div', { class: 'btns' }, [btn('Delete', () => ED.removeItems('delete', items), { class: 'danger' })]));
  }

  /* ------------------------------------------------------------------ several picked */
  function manyPanel(P, sel) {
    const props = sel.filter((s) => s.t === 'prop');
    P.append(head(sel.length + ' picked'));
    const by = {};
    for (const s of sel) by[s.t === 'mark' ? ED.MARK[s.type].label : s.t === 'prop' ? 'standing' : 'on the floor'] = (by[s.t === 'mark' ? ED.MARK[s.type].label : s.t === 'prop' ? 'standing' : 'on the floor'] || 0) + 1;
    P.append($('div', { class: 'note', text: Object.entries(by).map(([k, n]) => n + ' ' + k).join(', ') }));
    P.append($('div', { class: 'btns' }, [
      btn('Flip', () => ED.flipSel()),
      props.length ? btn('All solid', () => ED.edit('make solid', props, { solid: true })) : null,
      props.length ? btn('All walk-through', () => ED.edit('walk-through', props, { solid: false })) : null,
      props.length ? btn('Collision from art', () => { const was = props.map((it) => ({ box: ED.clone(it.o.box), cx: it.o.cx, cy: it.o.cy, solid: it.o.solid })); const now = props.map((it) => { const b = ED.traceBox(it.o.sprite); return { box: { hw: b.hw, hh: b.hh }, cx: b.cx || 0, cy: b.cy, solid: true }; }); ED.act('trace collision', () => props.forEach((it, i) => Object.assign(it.o, ED.clone(now[i]))), () => props.forEach((it, i) => Object.assign(it.o, ED.clone(was[i])))); }) : null,
    ]));
    P.append(head('Line up'));
    const align = (label, f) => { const items = sel.slice(); const target = f(items); const moves = items.map((it) => target(it)); ED.act(label, () => items.forEach((it, i) => ED.moveItem(it, moves[i].dx, moves[i].dy)), () => items.forEach((it, i) => ED.moveItem(it, -moves[i].dx, -moves[i].dy))); };
    P.append($('div', { class: 'btns' }, [
      btn('Same row', () => align('line up', (items) => { const y = Math.round(items.reduce((a, it) => a + it.o.y, 0) / items.length); return (it) => ({ dx: 0, dy: y - it.o.y }); }), { title: 'Their feet on one line' }),
      btn('Same column', () => align('line up', (items) => { const x = Math.round(items.reduce((a, it) => a + it.o.x, 0) / items.length); return (it) => ({ dx: x - it.o.x, dy: 0 }); })),
      btn('Spread evenly', () => align('spread', (items) => { const s = items.slice().sort((a, b) => a.o.x - b.o.x); const x0 = s[0].o.x, x1 = s[s.length - 1].o.x; const at = new Map(s.map((it, i) => [it, Math.round(x0 + ((x1 - x0) * i) / Math.max(1, s.length - 1))])); return (it) => ({ dx: at.get(it) - it.o.x, dy: 0 }); }), { title: 'The same gap between each, left to right' }),
    ]));
    P.append($('div', { class: 'btns' }, [btn('Delete all', () => ED.removeItems('delete ' + sel.length, sel.slice()), { class: 'danger' })]));
  }

  /* ------------------------------------------------------------------ a marker */
  function markPanel(P, it) {
    const o = it.o, M = ED.MARK[it.type], items = [it], L = ED.L;
    P.append(head(M.label));
    P.append($('div', { class: 'note', text: M.tip }));
    P.append(field('Position', num(o.x, (v) => ED.moveItems('move', items, v - o.x, 0)), num(o.y, (v) => ED.moveItems('move', items, 0, v - o.y))));
    const sel = (opts, v, on) => { const s = $('select', { onchange: (e) => on(e.target.value) }); for (const x of opts) s.append($('option', { value: x, text: x })); s.value = v; return s; };
    if (it.type === 'pack') {
      const mobs = [...new Set(Object.values(CH.LevelGen.MOBS).flat())].sort();
      P.append(field('Monsters', sel(mobs, o.type, (v) => ED.edit('pack monsters', items, { type: v }))));
      P.append(field('Mixed with', sel(mobs, o.mixed || o.type, (v) => ED.edit('pack mix', items, { mixed: v }))));
      P.append(field('How many', num(o.n, (v) => ED.edit('pack size', items, { n: Math.max(1, Math.round(v)) }), { min: 1, max: 30 })));
      P.append(field('Elites', chk(o.elite, (v) => ED.edit('elite', items, { elite: v }))));
      P.append(field('Has a leader', chk(o.leader, (v) => ED.edit('leader', items, { leader: v }))));
    }
    if (it.type === 'chest') {
      P.append(field('Tier', num(o.tier, (v) => ED.edit('chest tier', items, { tier: Math.max(1, Math.round(v)) }), { min: 1, max: 12 })));
      P.append(field('Secret', chk(o.secret, (v) => ED.edit('secret chest', items, { secret: v }))));
    }
    if (it.type === 'shrine') P.append(field('Blessing', sel(['healing', 'speed', 'blood', 'elite'], o.kind, (v) => ED.edit('shrine', items, { kind: v }))));
    if (it.type === 'breach') {
      const kinds = [...new Set(Object.values(CH.LevelGen.HIVES).map((h) => h.kind + '|' + h.name))];
      P.append(field('Kind', sel(kinds, o.kind + '|' + o.name, (v) => { const [k, n] = v.split('|'); ED.edit('breach kind', items, { kind: k, name: n }); })));
    }
    if (it.type === 'lore') {
      P.append(field('Name', $('input', { type: 'text', value: o.name || '', onchange: (e) => ED.edit('lore name', items, { name: e.target.value }) })));
      P.append(field('Words', $('textarea', { rows: 4, style: 'flex:1', onchange: (e) => ED.edit('lore', items, { lines: e.target.value.split('\n').filter(Boolean) }) }, [(o.lines || []).join('\n')])));
    }
    if (it.type === 'door') {
      const p = it.prop, e = CH.EdCatalog.get(p.sheet || p.sprite);
      P.append($('div', { class: 'note', text: 'Where a hero stands to use ' + (e ? e.name : 'a piece') + '.' }));
      eventPanel(P, p);
      P.append($('div', { class: 'btns' }, [btn('Pick the piece', () => ED.select([{ t: 'prop', o: p }])), btn('Back in front of it', () => { const s = ED.doorSpot(p); ED.moveItems('move way in', items, s.x - o.x, s.y - o.y); })]));
    }
    if (it.type === 'exit' && L.sky) P.append($('div', { class: 'note', text: 'On the sky road the exit is the tower\'s door.' }));
    if (!M.single) P.append($('div', { class: 'btns' }, [btn('Delete', () => ED.removeItems('delete', items), { class: 'danger' })]));
  }

  /* ------------------------------------------------------------------ the stage */
  function stagePanel(P) {
    const L = ED.L;
    P.append(head('Stage'));
    P.append($('div', { class: 'note', text: ED.areaName(ED.area) }));
    P.append(field('Name', $('input', { type: 'text', value: L.name || '', onchange: (e) => { const was = L.name, now = e.target.value; ED.act('rename', () => { L.name = now; }, () => { L.name = was; }); } })));
    const look = $('select', { onchange: (e) => setLook(e.target.value) });
    for (const b of Object.keys(CH.Level.STYLE).filter((b) => b !== 'default')) look.append($('option', { value: b, text: b }));
    look.value = L.biome;
    P.append(field('Look', look));
    P.append(field('Size', $('span', { text: L.tw + ' × ' + L.th + ' tiles' })));
    const nw = num(L.tw, () => {}, { min: 16, max: 240 }), nh = num(L.th, () => {}, { min: 12, max: 200 });
    P.append(field('New size', nw, nh, btn('Resize', () => resize(+nw.value, +nh.value), { title: 'Grows or cuts from the right and the bottom' })));
    const dm = $('select', { onchange: (e) => { ED.setEventMode(e.target.value); } }, [$('option', { value: 'always', text: 'are recognised (asks when unsure)' }), $('option', { value: 'ask', text: 'are asked about' }), $('option', { value: 'never', text: 'stay scenery' })]);
    dm.value = ED.eventMode;
    P.append(field('Pieces placed', dm), $('div', { class: 'btns' }, [btn('Recognise every piece', () => ED.recogniseAll(), { title: 'Give the pieces already on the stage what goes with them: doors lead inside, torches glow, crates break, signs read …' }), btn('Forget my answers', () => { ED.forget(); ED.toast('The editor asks again about pieces it is unsure of.'); }, { title: 'What you told it for each kind (a grave is a breach ...)' })]));
    P.append(head('Check'));
    const out = $('div');
    P.append($('div', { class: 'btns' }, [btn('Check the stage', () => check(out), { title: 'Every spot can be walked to from the entrance' })]), out);
    check(out);
    P.append(head('Picked in the drawer'));
    if (ED.picked) {
      const e = CH.EdCatalog.get(ED.picked);
      const nm = ED.picked.startsWith('obj.') ? ED.picked : CH.Props.sprite(ED.picked);
      P.append(thumbOf(nm), $('div', { class: 'note', text: (e ? e.name + ' · ' + e.pack : ED.picked) + (ED.pickedMany.length > 1 ? ' (+' + (ED.pickedMany.length - 1) + ' more for the scatter brush)' : '') }));
      const am = CH.Props.meta(ED.picked);
      if (am) P.append($('div', { class: 'note', text: 'Has its own default settings.' }));
      P.append($('div', { class: 'btns' }, [btn(ED.drawer && ED.drawer.isFav(ED.picked) ? '★ Favourite' : '☆ Favourite', () => { ED.drawer.fav(ED.picked); ED.inspect(); }), btn(ED.stampFlip ? 'Placing flipped' : 'Placing unflipped', () => { ED.stampFlip = !ED.stampFlip; ED.inspect(); })]));
    } else P.append($('div', { class: 'note', text: 'Click a piece in the drawer to place it.' }));
  }
  function setLook(b) {
    const L = ED.L, was = L.biome;
    const apply = (v) => { L.biome = v; L.id = v; L.style = CH.Level.STYLE[v] || CH.Level.STYLE.default; L._mats = null; L._wplan = null; L.props = L.props.filter((p) => p.cat !== 'walllight'); L.theme = (CH.Arenas.THEMES && CH.Arenas.THEMES[v]) || L.theme; L.chunks.clear(); ED.dresser = null; if (CH.Walls && CH.Walls.plan) CH.Walls.plan(L); };
    ED.act('look: ' + b, () => apply(b), () => apply(was));
  }
  function resize(w, h) {
    const L = ED.L;
    if (!(w >= 16 && h >= 12)) return;
    const old = { tw: L.tw, th: L.th, cells: L.cells, top: L.top, explored: L.explored, route: L.route, trail: L.trail, skyBridge: L.skyBridge, stairs: L.stairs, ramps: L.ramps, paint: L.paint, bridges: L.bridges };
    const grow = (a, Type, fill) => { if (!a) return a; const b = new (Type || Uint8Array)(w * h); if (fill) b.fill(fill); for (let y = 0; y < Math.min(h, old.th); y++) for (let x = 0; x < Math.min(w, old.tw); x++) b[y * w + x] = a[y * old.tw + x]; return b; };
    // what is kept by tile number (stairs, ramps, painted tiles) is renumbered for the new width; what falls off is dropped
    const at = (i) => { const x = i % old.tw, y = (i / old.tw) | 0; return x < w && y < h ? y * w + x : -1; };
    const reSet = (s) => s && new Set([...s].map(at).filter((i) => i >= 0));
    const paint = old.paint && new Map([...old.paint].map(([i, k]) => [at(i), k]).filter(([i]) => i >= 0));
    const bridges = (old.bridges || []).filter((b) => b.x0 + b.w <= w && b.y0 + b.h <= h).map((b) => Object.assign({}, b, b.pit ? { pit: b.pit.map(at) } : {}));
    const now = { tw: w, th: h, cells: grow(old.cells, Uint8Array, 1), top: grow(old.top), explored: grow(old.explored, Uint8Array, 1), route: grow(old.route), trail: grow(old.trail), skyBridge: grow(old.skyBridge), stairs: reSet(old.stairs), ramps: reSet(old.ramps), paint, bridges };
    const apply = (v) => { Object.assign(L, v); L.w = L.tw * TS; L.h = L.th * TS; L.chunks.clear(); L._wplan = null; L.props = L.props.filter((p) => p.cat !== 'walllight'); L.mini = null; L.miniDirty = true; if (CH.Walls && CH.Walls.plan) CH.Walls.plan(L); };
    ED.act('resize stage', () => apply(now), () => apply(old));
    ED.fitAll();
  }
  /* every spot can be walked to from the entrance */
  function check(out) {
    const L = ED.L, issues = [];
    out.textContent = '';
    if (!L.entrance) issues.push('There is no entrance.');
    if (!L.exit) issues.push('There is no exit.');
    if (L.entrance && L.solidAt(L.entrance.x, L.entrance.y)) issues.push('The entrance is inside a wall.');
    if (L.entrance) {
      L.flows.clear();
      const f = L.flowFor(L.entrance.x, L.entrance.y);
      const reach = (p) => f.dist[L.idx(Math.floor(p.x / TS), Math.floor(p.y / TS))] >= 0;
      for (const it of ED.marks()) if (it.type !== 'entrance' && !(it.type === 'chest' && it.o.secret) && !reach(it.o)) issues.push(ED.MARK[it.type].label + ' at ' + Math.round(it.o.x) + ', ' + Math.round(it.o.y) + ' cannot be walked to.');
    }
    if (ED.heightIssues) for (const t of ED.heightIssues()) issues.push(t);
    if (!L.spawners.length) issues.push('No breaches: the exit opens at once.');
    const ul = $('ul');
    for (const t of issues.slice(0, 12)) ul.append($('li', { class: t.startsWith('No breaches') || / has no stairs | lead nowhere/.test(t) ? 'warn' : 'bad', text: t }));
    if (issues.length > 12) ul.append($('li', { text: '… and ' + (issues.length - 12) + ' more' }));
    out.append(issues.length ? ul : $('div', { class: 'note', text: '✓ Every spot can be walked to from the entrance.' }));
  }
  ED.check = () => { const d = document.createElement('div'); check(d); return d.textContent; };
})(window.CH);
