/* The stage editor (PLAN.md 23): build, dress and fix every stage of the game by hand. Opened from the main menu
   (STAGE EDITOR), with index.html?editor, or with F10 while playing a stage.
   The workspace, in the manner of the owner's Doc's Doodads: the drawer of every piece on the left, the map in the
   middle, the details of what is picked on the right, the tools along the top.
   This file: the workspace itself (the stage being edited, the view, the input, undo, placing and removing). The
   drawer (drawer.js), the tools (tools.js), the details (inspector.js), saving (files.js) and bringing in new art
   (import.js) build on it. A stage is played as saved (js/stages.js). */
(function (CH) {
  const TS = 32;
  const ED = (CH.Editor = { on: false, L: null, area: null, tool: 'select', sub: {}, sel: [], cam: { x: 0, y: 0, z: 2 }, snap: 'tile', grid: true, showBoxes: true, showMarks: true, brush: 1, undoList: [], redoList: [], dirty: false, picked: null, pickedMany: [], hover: null, mouse: { x: 0, y: 0, wx: 0, wy: 0, down: false } });
  const $ = (tag, attrs, kids) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v === true ? '' : v);
    }
    for (const c of [].concat(kids || [])) if (c != null) e.append(c.nodeType ? c : document.createTextNode(c));
    return e;
  };
  ED.$ = $;
  ED.TS = TS;

  /* ------------------------------------------------------------------ the spots a stage needs (markers) */
  ED.MARK = {
    entrance: { label: 'Entrance', ic: '⇩', color: '#63c74d', single: 'entrance', tip: 'where the heroes arrive' },
    exit: { label: 'Exit', ic: '⇧', color: '#e43b44', single: 'exit', tip: 'opens once enough breaches are closed' },
    waypoint: { label: 'Waypoint', ic: '◆', color: '#3ccbe6', list: 'waypoints', tip: 'a fast-travel stone' },
    breach: { label: 'Breach', ic: '✸', color: '#d55fe0', list: 'spawners', tip: 'a monster hive the heroes close' },
    pack: { label: 'Monster pack', ic: '☠', color: '#f77622', list: 'packs', tip: 'a sleeping group of monsters' },
    chest: { label: 'Chest', ic: '▣', color: '#fee761', list: 'chests', tip: 'loot' },
    shrine: { label: 'Shrine', ic: '✚', color: '#ff8fb8', list: 'shrines', tip: 'a blessing' },
    lore: { label: 'Lore', ic: '✎', color: '#c0a7ff', list: 'lore', tip: 'words the heroes read' },
    door: { label: 'Event spot', ic: '⌂', color: '#fee761', door: true, tip: 'where a hero stands to use this piece (ENTER, OPEN, READ ...)' }, // (a piece's role spot: it comes with the piece, js/editor/roles.js)
  };
  ED.markNew = function (type, x, y) {
    const L = ED.L, LG = CH.LevelGen;
    const biome = L.biome;
    if (type === 'waypoint') return { x, y, id: L.waypoints.length, active: L.waypoints.length === 0 };
    if (type === 'breach') { const h = (LG.HIVES && (LG.HIVES[biome] || LG.HIVES.dungeon)) || { kind: 'grave', name: 'OSSUARY' }; return { id: L.spawners.length, kind: h.kind, name: h.name, x, y, room: -1, level: 3, dead: false }; }
    if (type === 'pack') { const mobs = (LG.MOBS && (LG.MOBS[biome] || LG.MOBS.dungeon)) || ['slime']; return { x, y, room: -1, type: mobs[0], n: 6, elite: false, leader: false, woke: false, mixed: mobs[1] || mobs[0] }; }
    if (type === 'chest') return { x, y, opened: false, id: L.chests.length, room: -1, tier: Math.max(1, Math.round((L.stage || 1) / 4)) };
    if (type === 'shrine') return { x, y, used: false, id: L.shrines.length, kind: 'healing' };
    if (type === 'lore') return { x, y, name: 'A carved stone', lines: ['Write what it says here.'] };
    return { x, y };
  };
  /* every marker of the stage as an item */
  ED.marks = function () {
    const L = ED.L, out = [];
    if (!L) return out;
    for (const [type, m] of Object.entries(ED.MARK)) {
      if (m.door) { for (const p of L.props) { if (p.dead || !ED.ROLE) continue; const role = ED.roleOf(p), d = ED.ROLE[role]; if (!d || !d.spot) continue; if (!p.door) p.door = ED.doorSpot(p); out.push({ t: 'mark', type, o: p.door, prop: p, role }); } continue; }
      if (m.single) { if (L[m.single]) out.push({ t: 'mark', type, o: L[m.single] }); continue; }
      for (const o of L[m.list] || []) out.push({ t: 'mark', type, o });
    }
    return out;
  };

  /* ------------------------------------------------------------------ the workspace */
  let root, view, cv, g, statusEl, hintEl, toastEl, topEl;
  ED.build = function () {
    if (root) return;
    root = $('div', { id: 'ed' });
    topEl = $('div', { class: 'ed-top' });
    const drawer = $('div', { class: 'ed-drawer' });
    view = $('div', { class: 'ed-view' });
    cv = $('canvas');
    hintEl = $('div', { class: 'ed-hint' });
    toastEl = $('div', { class: 'ed-toast' });
    view.append(cv, hintEl, toastEl);
    const insp = $('div', { class: 'ed-insp' });
    statusEl = $('div', { class: 'ed-status' });
    root.append(topEl, drawer, view, insp, statusEl, $('div', { class: 'ed-modal' }), $('div', { class: 'ed-hover' }));
    document.body.append(root);
    g = cv.getContext('2d');
    ED.els = { root, top: topEl, drawer, view, cv, insp, status: statusEl, modal: root.querySelector('.ed-modal'), hover: root.querySelector('.ed-hover') };
    buildTop();
    if (ED.drawer) ED.drawer.build(drawer);
    bindInput();
    new ResizeObserver(() => fit()).observe(view);
  };
  function fit() {
    const r = view.getBoundingClientRect();
    cv.width = Math.max(1, Math.round(r.width));
    cv.height = Math.max(1, Math.round(r.height));
  }

  /* the top bar: the stage, the tools, the view, undo, saving */
  ED.TOOLS = {}; // name -> { label, ic, key, tip, sub?: [[id, label]], down, move, up, draw, cursor }
  ED.TOOL_ORDER = ['select', 'stamp', 'scatter', 'erase', 'terrain', 'tiles', 'mark'];
  function buildTop() {
    const T = topEl;
    T.textContent = '';
    const stageGrp = $('div', { class: 'grp' }, [
      $('span', { class: 'title', text: 'STAGE EDITOR' }),
      $('button', { text: 'Open…', title: 'Open another stage (Ctrl+O)', onclick: () => ED.openDialog() }),
      ED.areaLabel = $('span', { style: 'min-width:150px;color:var(--dim)' }),
    ]);
    const tools = $('div', { class: 'grp' });
    for (const id of ED.TOOL_ORDER) {
      const t = ED.TOOLS[id];
      if (!t) continue;
      tools.append($('button', { class: 'tool', 'data-tool': id, title: t.tip + (t.key ? '  [' + t.key + ']' : ''), onclick: () => ED.setTool(id) }, [$('span', { class: 'ic', text: t.ic }), $('span', { class: 'nm', text: t.label })]));
    }
    const subs = $('div', { class: 'grp' });
    for (const id of ED.TOOL_ORDER) {
      const t = ED.TOOLS[id];
      if (!t || !t.sub) continue;
      const box = $('div', { class: 'sub', 'data-sub': id });
      for (const [sid, label, tip] of t.sub) box.append($('button', { 'data-v': sid, text: label, title: tip || '', onclick: () => { ED.sub[id] = sid; ED.refreshTop(); } }));
      subs.append(box);
    }
    subs.append(ED.brushEl = $('span', { style: 'color:var(--dim);margin-left:4px' }));
    const edit = $('div', { class: 'grp' }, [
      ED.undoBtn = $('button', { text: '↶', title: 'Undo (Ctrl+Z)', onclick: () => ED.undo() }),
      ED.redoBtn = $('button', { text: '↷', title: 'Redo (Ctrl+Y)', onclick: () => ED.redo() }),
    ]);
    const snapSel = $('select', { title: 'Snap to (hold Alt for free placement)', onchange: (e) => { ED.snap = e.target.value; } });
    for (const [v, l] of [['tile', 'Snap: tile'], ['half', 'Snap: half tile'], ['8', 'Snap: 8 px'], ['free', 'Free']]) snapSel.append($('option', { value: v, text: l }));
    ED.snapSel = snapSel;
    const viewGrp = $('div', { class: 'grp' }, [
      snapSel,
      ED.gridBtn = $('button', { text: '#', title: 'Grid (G)', onclick: () => { ED.grid = !ED.grid; ED.refreshTop(); } }),
      ED.boxBtn = $('button', { text: '▭', title: 'Show collision (C)', onclick: () => { ED.showBoxes = !ED.showBoxes; ED.refreshTop(); } }),
      ED.markBtn = $('button', { text: '⚑', title: 'Show markers', onclick: () => { ED.showMarks = !ED.showMarks; ED.refreshTop(); } }),
      $('button', { text: '⤢', title: 'Fit the whole stage (Home)', onclick: () => ED.fitAll() }),
      $('button', { text: '?', title: 'Keys (?)', onclick: () => ED.keysDialog() }),
    ]);
    const save = $('div', { class: 'grp' }, [
      ED.saveBtn = $('button', { class: 'primary', title: 'Save this stage into the game (Ctrl+S)', onclick: () => ED.files && ED.files.saveStage() }, [ED.dot = $('span', { class: 'ed-dot' }), 'Save']),
      $('button', { text: '▶ Play', title: 'Play this stage now (F5)', onclick: () => ED.playtest() }),
      $('button', { text: 'Exit', title: 'Back to the menu', onclick: () => ED.close() }),
    ]);
    T.append(stageGrp, tools, subs, edit, viewGrp, save);
    ED.refreshTop();
  }
  ED.refreshTop = function () {
    if (!topEl) return;
    for (const b of topEl.querySelectorAll('[data-tool]')) b.classList.toggle('on', b.dataset.tool === ED.tool);
    for (const box of topEl.querySelectorAll('[data-sub]')) {
      box.classList.toggle('show', box.dataset.sub === ED.tool);
      const cur = ED.sub[box.dataset.sub];
      for (const b of box.querySelectorAll('button')) b.classList.toggle('on', b.dataset.v === cur);
    }
    ED.gridBtn.classList.toggle('on', ED.grid);
    ED.boxBtn.classList.toggle('on', ED.showBoxes);
    ED.markBtn.classList.toggle('on', ED.showMarks);
    ED.undoBtn.disabled = !ED.undoList.length;
    ED.redoBtn.disabled = !ED.redoList.length;
    ED.undoBtn.title = ED.undoList.length ? 'Undo ' + ED.undoList[ED.undoList.length - 1].label + ' (Ctrl+Z)' : 'Undo (Ctrl+Z)';
    ED.redoBtn.title = ED.redoList.length ? 'Redo ' + ED.redoList[ED.redoList.length - 1].label + ' (Ctrl+Y)' : 'Redo (Ctrl+Y)';
    ED.dot.classList.toggle('dirty', ED.dirty);
    ED.dot.title = ED.dirty ? 'Changes not saved yet' : 'Saved';
    const t = ED.TOOLS[ED.tool];
    ED.brushEl.textContent = t && t.brush ? 'Brush ' + ED.brush + ' [ ]' : '';
    if (ED.areaLabel) ED.areaLabel.textContent = ED.L ? ED.areaName(ED.area) + (ED.L.handmade ? ' · hand-made' : '') : 'no stage open';
    if (ED.snapSel) ED.snapSel.value = ED.snap;
  };
  ED.setTool = function (id) {
    if (!ED.TOOLS[id]) return;
    ED.tool = id;
    const t = ED.TOOLS[id];
    if (t.sub && !ED.sub[id]) ED.sub[id] = t.sub[0][0];
    ED.refreshTop();
    ED.hint(t.hint || t.tip);
    ED.inspect();
  };
  ED.hint = function (text) { if (hintEl) { hintEl.textContent = text || ''; hintEl.style.display = text ? '' : 'none'; } };
  ED.toast = function (text, undoable, ms) {
    const d = $('div', {}, [text]);
    if (undoable) d.append($('button', { text: 'Undo', onclick: () => { ED.undo(); d.remove(); } }));
    toastEl.append(d);
    setTimeout(() => d.remove(), ms || 3500);
  };

  /* ------------------------------------------------------------------ areas */
  ED.areaIds = function () {
    const WM = CH.WorldMap, out = [];
    if (WM && WM.areas) for (let n = 1; n <= WM.LAST; n++) out.push(String(n));
    out.push('belly');
    return out;
  };
  ED.areaName = function (id) {
    const WM = CH.WorldMap;
    if (id === 'belly') return "Inside the Final Tower (the belly)";
    if (!WM || !WM.areas) return 'Stage ' + id;
    const n = +id, a = WM.area(n);
    return n + '. ' + WM.label(n) + (n === WM.LAST ? ' (the sky road)' : '') + ' · ' + a.biome;
  };
  /* the generator's stage for an area, as a new run would have it (seed 0 unless asked) */
  ED.generate = function (id, seed) {
    const G = CH.G, WM = CH.WorldMap, ST = CH.Stages;
    const n = id === 'belly' ? WM.LAST : +id;
    const keep = { wave: G.wave, on: WM.on, off: ST.off };
    ST.off = true;
    WM.on = () => true;
    G.wave = n;
    let L;
    try {
      L = id === 'belly' ? WM.hall('belly', n) : CH.Run.genLevel(n, CH.U.seeded(((seed || 0) + n * 7919) >>> 0));
    } finally { WM.on = keep.on; G.wave = keep.wave; ST.off = keep.off; }
    L.stage = n;
    return L;
  };
  /* a stage of nothing: walls round an open floor */
  ED.blank = function (biome, tw, th, open) {
    const L = new CH.Level(tw, th, biome);
    if (open) L.carveRect(1, 1, tw - 2, th - 2);
    L.entrance = { x: 3 * TS + 16, y: Math.floor(th / 2) * TS + 16 };
    L.exit = { x: (tw - 4) * TS + 16, y: Math.floor(th / 2) * TS + 16, open: false, room: -1 };
    L.waypoints = [{ x: 5 * TS, y: Math.floor(th / 2) * TS + 16, id: 0, active: true }];
    L.rooms = [];
    L.decals = []; L.inlays = []; L.grounds = []; L.lore = []; L.camps = [];
    L.layout = 'hand';
    L.handmade = true;
    return L;
  };

  /* ------------------------------------------------------------------ opening a stage */
  ED.load = function (id, L, how) {
    ED.area = String(id);
    L.decals = L.decals || []; L.inlays = L.inlays || []; L.lore = L.lore || []; L.waypoints = L.waypoints || []; L.spawners = L.spawners || []; L.packs = L.packs || []; L.chests = L.chests || []; L.shrines = L.shrines || []; L.puddles = L.puddles || [];
    if (L.stage == null) L.stage = id === 'belly' ? (CH.WorldMap ? CH.WorldMap.LAST : 49) : +id;
    L.explored.fill(1);
    L.editing = true;
    CH.Stages.unevents(L); // (the chests, signs ... its pieces make are the pieces' own: js/editor/roles.js)
    ED.L = L;
    ED.how = how;
    ED.sel = [];
    ED.undoList = [];
    ED.redoList = [];
    ED.dirty = how !== 'saved';
    ED.dresser = null;
    ED.fitAll();
    ED.refreshTop();
    ED.inspect();
    if (ED.drawer) ED.drawer.refresh();
    ED.hint('');
    ED.status();
  };
  ED.openArea = function (id, how, opts) {
    opts = opts || {};
    let L;
    if (how === 'saved') L = CH.Stages.build(String(id));
    else if (how === 'blank') L = ED.blank(opts.biome || 'dungeon', opts.tw || 64, opts.th || 44, opts.open !== false);
    else if (how === 'draft') L = CH.Stages.build(opts.draft);
    else {
      L = ED.generate(id, opts.seed);
      if (how === 'gen-empty') { // the stage's ground and walls, nothing standing on it
        L.props = L.props.filter((p) => p.cat === 'walllight');
        L.decals = []; L.inlays = []; L.puddles = []; L.grounds = []; L.trail = null; L.route = null; L.lore = [];
        if (L.tower) L.tower = null;
        L.chunks.clear();
      }
    }
    if (!L) { ED.toast('That stage could not be opened.'); return; }
    ED.load(id, L, how);
    if (how !== 'saved' && how !== 'draft') ED.toast(how === 'blank' ? 'A blank stage. Paint its floor with Terrain [T].' : 'Generated stage opened. Save it to make it the stage the game plays.', false, 5000);
  };

  /* ------------------------------------------------------------------ view */
  ED.toWorld = (sx, sy) => ({ x: sx / ED.cam.z + ED.cam.x, y: sy / ED.cam.z + ED.cam.y });
  ED.toScreen = (wx, wy) => ({ x: (wx - ED.cam.x) * ED.cam.z, y: (wy - ED.cam.y) * ED.cam.z });
  ED.fitAll = function () {
    if (!ED.L || !cv) return;
    fit();
    const z = Math.min(cv.width / ED.L.w, cv.height / ED.L.h) * 0.95;
    ED.cam.z = Math.max(0.1, z);
    ED.cam.x = ED.L.w / 2 - cv.width / 2 / ED.cam.z;
    ED.cam.y = ED.L.h / 2 - cv.height / 2 / ED.cam.z;
  };
  ED.zoomAt = function (sx, sy, f) {
    const w = ED.toWorld(sx, sy);
    ED.cam.z = Math.max(0.1, Math.min(8, ED.cam.z * f));
    ED.cam.x = w.x - sx / ED.cam.z;
    ED.cam.y = w.y - sy / ED.cam.z;
  };
  ED.snapPt = function (x, y, alt) {
    if (alt || ED.snap === 'free') return { x: Math.round(x), y: Math.round(y) };
    const s = ED.snap === 'tile' ? TS : ED.snap === 'half' ? TS / 2 : 8;
    if (ED.snap === 'tile') return { x: Math.floor(x / TS) * TS + TS / 2, y: Math.floor(y / TS) * TS + TS - 4 }; // a tile's middle, feet near its bottom
    return { x: Math.round(x / s) * s, y: Math.round(y / s) * s };
  };

  /* ------------------------------------------------------------------ undo: each step can be undone and done again */
  ED.act = function (label, redo, undo) {
    redo();
    ED.undoList.push({ label, redo, undo });
    if (ED.undoList.length > 300) ED.undoList.shift();
    ED.redoList = [];
    ED.changed();
  };
  ED.undo = function () {
    const a = ED.undoList.pop();
    if (!a) return;
    a.undo();
    ED.redoList.push(a);
    ED.changed();
    ED.toast('Undid: ' + a.label, false, 1500);
  };
  ED.redo = function () {
    const a = ED.redoList.pop();
    if (!a) return;
    a.redo();
    ED.undoList.push(a);
    ED.changed();
  };
  ED.changed = function () {
    ED.dirty = true;
    if (CH.Props.invalidate) CH.Props.invalidate();
    ED.L.flows.clear();
    ED.refreshTop();
    ED.inspect();
    if (ED.files) ED.files.draftSoon();
  };

  /* ------------------------------------------------------------------ the stage's pieces */
  /* the dresser that places pieces exactly as the generator does (their kind's collision, animation, light) */
  ED.D = function () {
    const L = ED.L;
    if (!ED.dresser || ED.dresser.L !== L) ED.dresser = CH.SetPieces.Dresser(L, L.biome);
    return ED.dresser;
  };
  /* the box of a piece read from its art: its foot's width, a few pixels deep (Doodads' "Trace from art") */
  ED.traceBox = function (name) {
    const S = CH.Sprites;
    if (!S.has(name)) return { hw: 8, hh: 4 };
    const sp = S.get(name), f = sp.frames[0];
    const c = document.createElement('canvas');
    c.width = f.width; c.height = f.height;
    const cg = c.getContext('2d', { willReadFrequently: true });
    cg.drawImage(f, 0, 0);
    const d = cg.getImageData(0, 0, c.width, c.height).data;
    let bottom = -1;
    for (let y = c.height - 1; y >= 0 && bottom < 0; y--) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 40) { bottom = y; break; }
    if (bottom < 0) return { hw: 6, hh: 3 };
    const band = Math.max(4, Math.round(c.height * 0.18));
    let x0 = c.width, x1 = -1;
    for (let y = Math.max(0, bottom - band); y <= bottom; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; }
    const hw = Math.max(3, Math.round((x1 - x0 + 1) * 0.42));
    const hh = Math.max(3, Math.min(14, Math.round(c.height * 0.1)));
    const cx = Math.round((x0 + x1 + 1) / 2 - sp.ax);
    const cy = Math.round(bottom + 1 - sp.ay) - hh + 1;
    return { hw, hh, cx, cy };
  };
  /* ------------------------------------------------------------------ doors and buildings: their events */
  /* a piece a hero could go in by: a door, an archway into a crypt, a house, a hut, a cabin (by its kind, or its name
     for the owner's own pictures) */
  const DOORISH = { door: 1, mawdoor: 1, house: 1, hut: 1, crypt: 1, cabin: 1 };
  ED.isDoorish = function (p) {
    const key = p.sheet || p.sprite || '';
    const am = CH.Props.meta(key) || {};
    const kind = am.kind || CH.Props.kindOf(key) || p.cat || '';
    return !!(DOORISH[kind] || p.cat === 'hut' || /door|house|hut|cabin|shop|tavern|building|gate/i.test(am.name || ''));
  };
  /* the rooms a door can lead into (js/interiors.js) and the one a biome's own buildings have */
  ED.ROOMS = [['cabin', 'a cabin'], ['house', 'a townhouse'], ['hut', 'a frozen house'], ['vault', 'a sealed vault']];
  ED.roomFor = (biome) => ({ deadwood: 'cabin', backyard: 'cabin', gaslight: 'house', zombie: 'house', frozen: 'hut', catacombs: 'vault', dungeon: 'vault', castle: 'vault', volcano: 'vault', belly: 'vault', sky: 'vault' }[biome] || 'cabin');
  /* where a hero stands to use it: just in front of its foot, on open floor */
  ED.doorSpot = function (p) {
    const L = ED.L, x = Math.round(p.x + (p.cx || 0));
    for (let dy = 6; dy <= 70; dy += 8) if (!L.solidAt(x, p.y + dy)) return { x, y: Math.round(p.y + dy) };
    return { x, y: Math.round(p.y + 6) };
  };
  /* place a piece at (x, y) as the game would; 'as' forces it to lie flat ('floor') or stand ('stand') */
  ED.place = function (key, x, y, o) {
    o = o || {};
    const L = ED.L, PR = CH.Props, S = CH.Sprites;
    if (key.startsWith('fire.')) { // a campfire: fire.<colour>[.smoke]
      const [, color, smoke] = key.split('.');
      const f = CH.Fires && CH.Fires.place(L.props, x, y, color, !!smoke);
      if (!f) return null;
      f.sp = true;
      f.sheet = undefined;
      f.fireKey = key;
      return { t: 'prop', o: f };
    }
    const am = PR.meta(key) || {};
    const as = o.as && o.as !== 'auto' ? o.as : am.layer || 'auto';
    const scale = o.scale || am.scale;
    let item = null;
    // a piece of a known kind goes in as the generator puts it (its kind's collision, breakability, animation, light)
    if (as !== 'floor' && PR.info(key) && !key.startsWith('obj.') || key.startsWith('obj.') && as !== 'floor') {
      const nd = L.decals.length, np = L.props.length;
      const r = ED.D().put(key, x, y, { force: true, flip: o.flip, scale });
      if (r && L.props.length > np) item = { t: 'prop', o: L.props[L.props.length - 1] };
      else if (r && L.decals.length > nd) {
        if (as === 'stand') L.decals.splice(L.decals.indexOf(r), 1); // (it would lie flat: it is to stand)
        else item = { t: 'decal', o: r };
      }
    }
    if (!item && as !== 'stand' && (as === 'floor' || CH.EdCatalog.typeOf(PR.kindOf(key)) === 'floor')) { // laid flat as it is, at its own size
      const name = key.startsWith('obj.') ? key : PR.sprite(key, scale);
      if (name && S.has(name)) {
        const fr = S.get(name).frames[0];
        L.decals.push({ key, img: fr, s: scale || 1, x: Math.round(x), y: Math.round(y - fr.height / 2), a: 1, fx: !!o.flip, fy: false });
        item = { t: 'decal', o: L.decals[L.decals.length - 1] };
      }
    }
    if (!item) { // anything else stands as it is: its own box, else one traced from its art
      const name = key.startsWith('obj.') ? key : PR.sprite(key, scale);
      if (!name || !S.has(name)) return null;
      const box = am.box !== undefined ? am.box : ED.traceBox(name);
      CH.Arenas.addProp(L.props, name, x, y, { solid: !!box, box: box ? { hw: box.hw, hh: box.hh } : null, cx: box && box.cx ? box.cx : 0, cy: box ? (box.cy != null ? box.cy : -box.hh + 1) : -3, cat: PR.kindOf(key) || 'piece', jumpable: false, elevation: 10 });
      const p = L.props[L.props.length - 1];
      if (!key.startsWith('obj.')) p.sheet = key;
      p.sp = true;
      if (o.flip) p.flip = true;
      if (scale && scale !== 1) p.scale = scale;
      const an = PR.animOf && PR.animOf(key);
      if (an || S.get(name).frames.length > 1) { p.fps = am.fps || (an && an.fps) || 8; p.phase = Math.random(); }
      if (am.glow) { p.glow = am.glow; p.lr = am.lr || 70; p.phase = Math.random(); }
      item = { t: 'prop', o: p };
    }
    if (item.t === 'decal') ED.dirtyItem(item);
    if (item.t === 'prop' && !o.noEvent && ED.autoEvent) ED.autoEvent(item.o); // what it is to the game: recognised, or asked (js/editor/roles.js)
    return item;
  };
  const ROLEKEYS = ['role', 'enter', 'exitDoor', 'ev', 'evd', 'glow', 'lr', 'roleGlow', 'destructible', 'roleBreak', 'choppable', 'swayable', 'roleTree'];
  /* take an item out of the stage, and put it back (the same object, where it was) */
  ED.listOf = function (it) {
    const L = ED.L;
    if (it.t === 'prop') return L.props;
    if (it.t === 'decal') return L.decals;
    if (it.t === 'inlay') return L.inlays;
    if (it.t === 'mark') { const m = ED.MARK[it.type]; return m.single ? null : L[m.list]; }
    return null;
  };
  ED.detach = function (it) {
    if (it.t === 'mark' && it.type === 'door') { const p = it.prop, was = Object.fromEntries(ROLEKEYS.map((k) => [k, ED.clone(p[k])])); ED.applyRole(p, 'scenery'); return { list: null, i: -1, was }; } // (taking its spot away makes the piece scenery again)
    const list = ED.listOf(it);
    if (it.t === 'mark' && !list) { const m = ED.MARK[it.type]; const at = ED.L[m.single]; ED.L[m.single] = null; return { list: null, i: -1, was: at }; }
    const i = list.indexOf(it.o);
    if (i >= 0) list.splice(i, 1);
    if (it.t !== 'prop' && it.t !== 'mark') ED.dirtyItem(it);
    return { list, i };
  };
  ED.attach = function (it, at) {
    if (it.t === 'mark' && it.type === 'door') { const p = it.prop; if (at && at.was) for (const k of ROLEKEYS) { if (at.was[k] === undefined) delete p[k]; else p[k] = ED.clone(at.was[k]); } p.door = it.o; return; }
    if (it.t === 'mark' && !ED.listOf(it)) { ED.L[ED.MARK[it.type].single] = it.o; return; }
    const list = ED.listOf(it);
    if (at && at.i >= 0 && at.i <= list.length) list.splice(at.i, 0, it.o); else list.push(it.o);
    if (it.t !== 'prop' && it.t !== 'mark') ED.dirtyItem(it);
  };
  ED.addItems = function (label, items) {
    if (!items.length) return;
    // (they are in the stage already: the step takes them out on undo and puts them back on redo)
    let first = true;
    ED.act(label, () => { if (!first) for (const it of items) ED.attach(it); first = false; }, () => { for (const it of items.slice().reverse()) ED.detach(it); ED.sel = ED.sel.filter((s) => !items.some((q) => q.o === s.o)); });
  };
  ED.removeItems = function (label, items) {
    if (!items.length) return;
    const ats = [];
    ED.act(label, () => { ats.length = 0; for (const it of items) ats.push(ED.detach(it)); ED.sel = ED.sel.filter((s) => !items.some((q) => q.o === s.o)); }, () => { for (let k = items.length - 1; k >= 0; k--) ED.attach(items[k], ats[k]); });
  };
  /* where an item stands, and moving it */
  ED.posOf = (it) => ({ x: it.o.x, y: it.o.y });
  ED.moveItem = function (it, dx, dy) {
    if (it.t === 'decal' || it.t === 'inlay') ED.dirtyItem(it);
    it.o.x += dx; it.o.y += dy;
    if (it.t === 'prop' && it.o.door && !ED.sel.some((s) => s.o === it.o.door)) { it.o.door.x += dx; it.o.door.y += dy; } // its way in goes with it
    if (it.t === 'prop' && it.o.exitDoor && ED.L.exit) { ED.L.exit.x = it.o.door ? it.o.door.x : it.o.x; ED.L.exit.y = it.o.door ? it.o.door.y : it.o.y; }
    if (it.t === 'mark' && it.type === 'door' && it.prop.exitDoor && ED.L.exit) { ED.L.exit.x = it.o.x; ED.L.exit.y = it.o.y; }
    if (it.t === 'decal' || it.t === 'inlay') ED.dirtyItem(it);
  };
  ED.moveItems = function (label, items, dx, dy) {
    if (!items.length || (!dx && !dy)) return;
    ED.act(label, () => { for (const it of items) ED.moveItem(it, dx, dy); }, () => { for (const it of items) ED.moveItem(it, -dx, -dy); });
  };
  /* change fields of items (one step): set(it) applies, the old values are kept */
  ED.edit = function (label, items, fields) {
    const before = items.map((it) => Object.fromEntries(Object.keys(fields).map((k) => [k, ED.clone(it.o[k])])));
    const apply = (vals) => items.forEach((it, i) => { const v = typeof vals === 'function' ? vals(it) : vals[i]; for (const [k, x] of Object.entries(v)) { if (x === undefined) delete it.o[k]; else it.o[k] = ED.clone(x); } if (it.t === 'decal') ED.dirtyItem(it); });
    ED.act(label, () => apply(() => fields), () => apply(before));
  };
  ED.clone = (v) => (v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v);

  /* the floor's chunks under a spot are painted again */
  ED.dirtyRect = function (x, y, w, h) {
    const L = ED.L, C = 8 * TS;
    for (let cy = Math.floor((y - 16) / C); cy <= Math.floor((y + h + 16) / C); cy++) for (let cx = Math.floor((x - 16) / C); cx <= Math.floor((x + w + 16) / C); cx++) L.chunks.delete(cx + ',' + cy);
  };
  ED.dirtyItem = function (it) {
    const im = it.o.img || CH.Assets.images[it.o.key] || CH.Assets.images['kit.' + it.o.key];
    const w = im ? im.width : 64, h = im ? im.height : 64;
    if (it.t === 'inlay') ED.dirtyRect(it.o.x, it.o.y, w, h);
    else ED.dirtyRect(it.o.x - w / 2, it.o.y - h / 2, w, h);
  };
  /* cells changed: the walls round them are worked out again (faces, mounts, lights, vaults) */
  ED.cellsChanged = function (tx0, ty0, tx1, ty1) {
    const L = ED.L;
    L._wplan = null;
    L.vaults = [];
    L.props = L.props.filter((p) => p.cat !== 'walllight');
    if (CH.Walls && CH.Walls.plan) CH.Walls.plan(L);
    ED.dirtyRect((tx0 - 2) * TS, (ty0 - 2) * TS, (tx1 - tx0 + 5) * TS, (ty1 - ty0 + 5) * TS);
    L.miniDirty = true;
    L.flows.clear();
  };
  ED.setCells = function (label, changes) { // changes: Map idx -> new value
    const L = ED.L, old = new Map();
    for (const i of changes.keys()) old.set(i, L.cells[i]);
    const apply = (m) => {
      let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
      for (const [i, v] of m) { L.cells[i] = v; const x = i % L.tw, y = (i / L.tw) | 0; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
      if (x1 >= 0) ED.cellsChanged(x0, y0, x1, y1);
    };
    ED.act(label, () => apply(changes), () => apply(old));
  };

  /* ------------------------------------------------------------------ what is under the mouse */
  const probe = document.createElement('canvas');
  probe.width = probe.height = 1;
  const pg = probe.getContext('2d', { willReadFrequently: true });
  function opaqueAt(img, x, y) {
    if (x < 0 || y < 0 || x >= img.width || y >= img.height) return false;
    pg.clearRect(0, 0, 1, 1);
    pg.drawImage(img, Math.floor(x), Math.floor(y), 1, 1, 0, 0, 1, 1);
    return pg.getImageData(0, 0, 1, 1).data[3] > 30;
  }
  ED.propRect = function (p) {
    const S = CH.Sprites;
    if (!p.sprite || !S.has(p.sprite)) return { x: p.x - 8, y: p.y - 16, w: 16, h: 16 };
    const sp = S.get(p.sprite);
    const x = p.flip ? p.x - (sp.w - sp.ax) : p.x - sp.ax;
    return { x, y: p.y - sp.ay, w: sp.w, h: sp.h };
  };
  ED.itemRect = function (it) {
    if (it.t === 'prop') return ED.propRect(it.o);
    if (it.t === 'mark') return { x: it.o.x - 11, y: it.o.y - 11, w: 22, h: 22 };
    const im = it.o.img || CH.Assets.images[it.o.key] || CH.Assets.images['kit.' + it.o.key];
    const w = im ? im.width : 16, h = im ? im.height : 16;
    if (it.t === 'inlay') return { x: it.o.x, y: it.o.y, w, h };
    return { x: it.o.x - w / 2, y: it.o.y - h / 2, w, h };
  };
  /* the topmost item at a world point: markers, then standing pieces (front first), then the floor's */
  ED.pick = function (wx, wy, o) {
    o = o || {};
    const L = ED.L;
    if (!L) return null;
    if (ED.showMarks && !o.noMarks) for (const it of ED.marks().reverse()) { if (Math.hypot(it.o.x - wx, it.o.y - wy) < 12 / Math.min(1, ED.cam.z) + 2) return it; }
    const props = L.props.filter((p) => !p.invisible).sort((a, b) => b.y - a.y);
    for (const p of props) {
      const r = ED.propRect(p);
      if (wx < r.x || wy < r.y || wx > r.x + r.w || wy > r.y + r.h) continue;
      const sp = CH.Sprites.get(p.sprite);
      const lx = p.flip ? r.w - (wx - r.x) : wx - r.x;
      if (!sp || opaqueAt(sp.frames[0], lx, wy - r.y) || r.w * r.h < 120) return { t: 'prop', o: p };
    }
    if (o.noFloor) return null;
    for (const d of L.decals.slice().reverse()) {
      const it = { t: 'decal', o: d }, r = ED.itemRect(it);
      if (wx < r.x || wy < r.y || wx > r.x + r.w || wy > r.y + r.h) continue;
      const im = d.img || CH.Assets.images[d.key];
      if (!im) continue;
      const lx = d.fx ? r.w - (wx - r.x) : wx - r.x;
      if (opaqueAt(im, lx, wy - r.y)) return it;
    }
    for (const q of (L.inlays || []).slice().reverse()) {
      const it = { t: 'inlay', o: q }, r = ED.itemRect(it);
      if (wx >= r.x && wy >= r.y && wx <= r.x + r.w && wy <= r.y + r.h) return it;
    }
    return null;
  };
  ED.inRect = function (x0, y0, x1, y1) {
    const L = ED.L, out = [];
    const ax = Math.min(x0, x1), bx = Math.max(x0, x1), ay = Math.min(y0, y1), by = Math.max(y0, y1);
    if (ED.showMarks) for (const it of ED.marks()) if (it.o.x >= ax && it.o.x <= bx && it.o.y >= ay && it.o.y <= by) out.push(it);
    for (const p of L.props) if (!p.invisible && p.x >= ax && p.x <= bx && p.y >= ay && p.y <= by) out.push({ t: 'prop', o: p }); // picked by the feet, as in Doodads
    for (const d of L.decals) if (d.x >= ax && d.x <= bx && d.y >= ay && d.y <= by) out.push({ t: 'decal', o: d });
    return out;
  };
  ED.isSel = (o) => ED.sel.some((s) => s.o === o);
  ED.select = function (items, add) {
    if (!add) ED.sel = [];
    if (!(ED.sel.length + items.length === 1 && items[0] && ED.sel[0] === undefined && items[0].o === ED.boxEditOf)) ED.boxEdit = false; // (editing collision ends with a new pick)
    ED.boxEditOf = items.length === 1 && items[0] ? items[0].o : null;
    for (const it of items) if (it && !ED.isSel(it.o)) ED.sel.push(it);
    ED.inspect();
  };

  /* ------------------------------------------------------------------ drawing */
  let raf = 0, last = 0;
  ED.t = 0;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!ED.on) return;
    ED.t = now / 1000;
    if (now - last < 15) return;
    last = now;
    draw();
  }
  ED.draw = () => draw();
  function draw() {
    const L = ED.L, z = ED.cam.z;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#050307';
    g.fillRect(0, 0, cv.width, cv.height);
    if (!L) return;
    g.imageSmoothingEnabled = z < 1;
    g.setTransform(z, 0, 0, z, -ED.cam.x * z, -ED.cam.y * z);
    const C = 8 * TS;
    const v0 = ED.toWorld(0, 0), v1 = ED.toWorld(cv.width, cv.height);
    let painted = 0;
    for (let cy = Math.max(0, Math.floor(v0.y / C) - 1); cy <= Math.min(Math.ceil(L.th / 8) - 1, Math.floor(v1.y / C)); cy++) {
      for (let cx = Math.max(0, Math.floor(v0.x / C)); cx <= Math.min(Math.ceil(L.tw / 8) - 1, Math.floor(v1.x / C)); cx++) {
        const key = cx + ',' + cy;
        if (!L.chunks.has(key) && painted++ > 6) continue; // a few new chunks a frame keeps panning smooth
        g.drawImage(L.chunk(cx, cy), cx * C, cy * C);
      }
    }
    // puddles, as outlines
    g.lineWidth = 1 / z;
    for (const q of L.puddles || []) { g.strokeStyle = q.kind === 'lava' ? '#ff6a2a' : q.kind === 'blood' ? '#c0303a' : q.kind === 'toxic' ? '#7cff5a' : '#6fd3ff'; g.beginPath(); g.ellipse(q.x, q.y, q.rx, q.ry, 0, 0, Math.PI * 2); g.stroke(); }
    // standing pieces, back to front
    const props = L.props.filter((p) => !p.invisible && p.sprite && (p.fire || CH.Sprites.has(p.sprite)) && p.x > v0.x - 200 && p.x < v1.x + 200 && p.y > v0.y - 60 && p.y < v1.y + 300).sort((a, b) => a.y - b.y);
    for (const p of props) {
      if (p.fire) { if (CH.Fires) CH.Fires.draw(g, p, p.x, p.y); continue; } // a campfire (js/fires.js)
      const sp = CH.Sprites.get(p.sprite), n = sp.frames.length;
      const fr = p.fps && n > 1 ? Math.floor(ED.t * p.fps + (p.phase || 0) * 17) % n : 0;
      if (p.additive) g.globalCompositeOperation = 'lighter';
      CH.Sprites.draw(g, p.sprite, p.x, p.y, { flip: !!p.flip, frame: fr });
      g.globalCompositeOperation = 'source-over';
    }
    if (ED.grid && z >= 0.6) {
      g.strokeStyle = 'rgba(255,255,255,0.07)';
      g.beginPath();
      for (let x = Math.max(0, Math.floor(v0.x / TS)) * TS; x <= Math.min(L.w, v1.x); x += TS) { g.moveTo(x, Math.max(0, v0.y)); g.lineTo(x, Math.min(L.h, v1.y)); }
      for (let y = Math.max(0, Math.floor(v0.y / TS)) * TS; y <= Math.min(L.h, v1.y); y += TS) { g.moveTo(Math.max(0, v0.x), y); g.lineTo(Math.min(L.w, v1.x), y); }
      g.stroke();
    }
    g.strokeStyle = '#ffffff33';
    g.strokeRect(0, 0, L.w, L.h);
    if (ED.showBoxes) for (const p of props) drawBox(p, ED.isSel(p) ? '#ffb347' : p.solid ? 'rgba(255,80,90,0.75)' : null);
    // what is picked
    for (const it of ED.sel) {
      const r = ED.itemRect(it);
      g.strokeStyle = '#ffb347';
      g.lineWidth = 1.5 / z;
      g.setLineDash([4 / z, 3 / z]);
      g.strokeRect(r.x, r.y, r.w, r.h);
      g.setLineDash([]);
    }
    if (ED.hover && !ED.isSel(ED.hover.o)) { const r = ED.itemRect(ED.hover); g.strokeStyle = 'rgba(111,211,255,0.8)'; g.lineWidth = 1 / z; g.strokeRect(r.x, r.y, r.w, r.h); }
    if (ED.showMarks) drawMarks();
    const t = ED.TOOLS[ED.tool];
    if (t && t.draw) t.draw(g, z);
    g.setTransform(1, 0, 0, 1, 0, 0);
  }
  function drawBox(p, color) {
    if (!p.box && !p.solid) return;
    const z = ED.cam.z;
    g.lineWidth = 1 / z;
    if (p.box) {
      const bx = p.x + (p.cx || 0), by = p.y + (p.cy || 0);
      if (!color) { if (!p.box) return; g.strokeStyle = 'rgba(111,211,255,0.45)'; } else g.strokeStyle = color;
      g.strokeRect(bx - p.box.hw, by - p.box.hh, p.box.hw * 2, p.box.hh * 2);
    } else if (p.solid) {
      g.strokeStyle = color || 'rgba(255,80,90,0.75)';
      g.beginPath(); g.arc(p.x + (p.cx || 0), p.y + (p.cy || -4), p.cr || 10, 0, Math.PI * 2); g.stroke();
    }
  }
  ED.drawBox = drawBox;
  function drawMarks() {
    const z = ED.cam.z, r = Math.max(9, 11 / z);
    g.font = Math.round(r * 1.2) + 'px "Segoe UI", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const it of ED.marks()) {
      const m = it.type === 'door' ? { color: ED.roleColor(it.role), ic: ED.ROLE[it.role].ic, label: ED.ROLE[it.role].label.replace(/^Goes inside: /, 'Inside: ') } : ED.MARK[it.type];
      g.fillStyle = '#000a';
      g.beginPath(); g.arc(it.o.x, it.o.y, r + 2 / z, 0, Math.PI * 2); g.fill();
      g.fillStyle = m.color;
      g.beginPath(); g.arc(it.o.x, it.o.y, r, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#111';
      g.fillText(m.ic, it.o.x, it.o.y + 1 / z);
      if (z >= 0.8) {
        const sub = it.type === 'pack' ? it.o.type + ' ×' + it.o.n + (it.o.elite ? ' elite' : '') : it.type === 'chest' ? 'tier ' + it.o.tier : it.type === 'shrine' ? it.o.kind : '';
        g.font = Math.round(9 / Math.min(z, 1.5)) + 'px "Segoe UI", sans-serif';
        g.fillStyle = '#000c'; g.fillText(m.label + (sub ? ': ' + sub : ''), it.o.x + 0.6, it.o.y - r - 6 / z + 0.6);
        g.fillStyle = m.color; g.fillText(m.label + (sub ? ': ' + sub : ''), it.o.x, it.o.y - r - 6 / z);
        g.font = Math.round(r * 1.2) + 'px "Segoe UI", sans-serif';
      }
    }
  }

  ED.status = function () {
    if (!statusEl || !ED.L) return;
    const m = ED.mouse, L = ED.L;
    const tx = Math.floor(m.wx / TS), ty = Math.floor(m.wy / TS);
    const cell = L.inb(tx, ty) ? ['floor', 'wall', '?', 'secret wall', 'pit', 'ledge'][L.cell(tx, ty)] || 'cell ' + L.cell(tx, ty) : 'outside';
    const h = ED.hover;
    statusEl.innerHTML = '';
    const add = (k, v) => statusEl.append(ED.$('span', {}, [k + ' ', ED.$('b', { text: v })]));
    add('at', Math.round(m.wx) + ', ' + Math.round(m.wy));
    add('tile', tx + ', ' + ty + ' (' + cell + ')');
    add('zoom', Math.round(ED.cam.z * 100) + '%');
    add('stage', L.tw + '×' + L.th + ' tiles · ' + L.props.filter((p) => !p.invisible).length + ' pieces · ' + L.decals.length + ' on the floor');
    if (h) add('under the mouse', h.t === 'mark' ? ED.MARK[h.type].label : (h.o.sheet || h.o.key || h.o.sprite || ''));
    if (ED.sel.length) add('picked', String(ED.sel.length));
  };

  /* ------------------------------------------------------------------ input */
  let pan = null, spaceDown = false;
  function bindInput() {
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = cv.getBoundingClientRect();
      if (e.ctrlKey || !e.shiftKey) ED.zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.15 : 1 / 1.15);
      else { ED.cam.x += e.deltaY / ED.cam.z; }
    }, { passive: false });
    cv.addEventListener('pointerdown', (e) => {
      cv.setPointerCapture(e.pointerId);
      const r = cv.getBoundingClientRect();
      const sx = e.clientX - r.left, sy = e.clientY - r.top;
      if (e.button === 1 || (e.button === 0 && spaceDown) || (e.button === 2 && ED.tool === 'select')) { pan = { sx, sy, cx: ED.cam.x, cy: ED.cam.y }; return; }
      if (!ED.L) return;
      const w = ED.toWorld(sx, sy);
      Object.assign(ED.mouse, { x: sx, y: sy, wx: w.x, wy: w.y, down: true, button: e.button, shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey, alt: e.altKey });
      if (e.altKey && e.button === 0 && ED.tool !== 'select') { const it = ED.pick(w.x, w.y, { noMarks: true }); if (it && ED.drawer) ED.drawer.pickFromMap(it); return; } // the eyedropper
      const t = ED.TOOLS[ED.tool];
      if (t && t.down) t.down(ED.mouse, e);
    });
    cv.addEventListener('pointermove', (e) => {
      const r = cv.getBoundingClientRect();
      const sx = e.clientX - r.left, sy = e.clientY - r.top;
      if (pan) { ED.cam.x = pan.cx - (sx - pan.sx) / ED.cam.z; ED.cam.y = pan.cy - (sy - pan.sy) / ED.cam.z; return; }
      if (!ED.L) return;
      const w = ED.toWorld(sx, sy);
      Object.assign(ED.mouse, { x: sx, y: sy, wx: w.x, wy: w.y, shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey, alt: e.altKey });
      const t = ED.TOOLS[ED.tool];
      if (t && t.move) t.move(ED.mouse, e);
      if (!ED.mouse.down) ED.hover = ED.tool === 'select' || ED.tool === 'erase' ? ED.pick(w.x, w.y) : null;
      ED.status();
    });
    const up = (e) => {
      if (pan) { pan = null; return; }
      if (!ED.mouse.down) return;
      ED.mouse.down = false;
      const t = ED.TOOLS[ED.tool];
      if (t && t.up) t.up(ED.mouse, e);
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('pointerleave', () => { ED.hover = null; });
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', (e) => { if (e.code === 'Space') spaceDown = false; }, true);
    window.addEventListener('beforeunload', (e) => { if (ED.on && ED.dirty) { e.preventDefault(); e.returnValue = ''; } });
  }
  const typing = (e) => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) && e.target.type !== 'checkbox' && e.target.type !== 'range';
  function onKey(e) {
    if (!ED.on) return;
    e.stopImmediatePropagation(); // (the game's own keys rest while the editor is open)
    if (e.key === 'Escape' && ED.els.modal.classList.contains('show')) { ED.closeModal(); e.preventDefault(); return; }
    if (typing(e)) { if (e.key === 'Escape') e.target.blur(); if (!(e.ctrlKey && (e.key === 's' || e.key === 'S'))) return; }
    const k = e.key, ctrl = e.ctrlKey || e.metaKey;
    const step = e.shiftKey ? 16 : ctrl ? TS : 1;
    if (ctrl && (k === 'z' || k === 'Z') && !e.shiftKey) { e.preventDefault(); ED.undo(); return; }
    if (ctrl && (k === 'y' || k === 'Y' || ((k === 'z' || k === 'Z') && e.shiftKey))) { e.preventDefault(); ED.redo(); return; }
    if (ctrl && (k === 's' || k === 'S')) { e.preventDefault(); if (ED.files) ED.files.saveStage(); return; }
    if (ctrl && (k === 'o' || k === 'O')) { e.preventDefault(); ED.openDialog(); return; }
    if (ctrl && (k === 'f' || k === 'F')) { e.preventDefault(); if (ED.drawer) ED.drawer.focusSearch(); return; }
    if (ED.els.modal.classList.contains('show')) return;
    if (ctrl && (k === 'c' || k === 'C')) { e.preventDefault(); ED.copy(); return; }
    if (ctrl && (k === 'v' || k === 'V')) { e.preventDefault(); ED.paste(e.shiftKey); return; }
    if (ctrl && (k === 'd' || k === 'D')) { e.preventDefault(); ED.copy(); ED.paste(false, 16); return; }
    if (ctrl && (k === 'a' || k === 'A')) { e.preventDefault(); ED.setTool('select'); ED.select(ED.L.props.filter((p) => !p.invisible).map((o) => ({ t: 'prop', o }))); return; }
    if (k === ' ') { spaceDown = true; e.preventDefault(); return; }
    if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); ED.removeItems('delete ' + ED.sel.length, ED.sel.slice()); return; }
    if (k.startsWith('Arrow') && ED.sel.length) {
      e.preventDefault();
      const dx = k === 'ArrowLeft' ? -step : k === 'ArrowRight' ? step : 0, dy = k === 'ArrowUp' ? -step : k === 'ArrowDown' ? step : 0;
      ED.moveItems('nudge', ED.sel.slice(), dx, dy);
      return;
    }
    if (k.startsWith('Arrow')) { e.preventDefault(); const s = 64 / ED.cam.z; ED.cam.x += k === 'ArrowLeft' ? -s : k === 'ArrowRight' ? s : 0; ED.cam.y += k === 'ArrowUp' ? -s : k === 'ArrowDown' ? s : 0; return; }
    if (k === '[') { ED.brush = Math.max(1, ED.brush - 1); ED.refreshTop(); return; }
    if (k === ']') { ED.brush = Math.min(12, ED.brush + 1); ED.refreshTop(); return; }
    if (k === 'Escape') { if (ED.sel.length) ED.select([]); else ED.setTool('select'); return; }
    if (k === 'Home') { ED.fitAll(); return; }
    if (k === 'F5') { e.preventDefault(); ED.playtest(); return; }
    if (ctrl || e.altKey) return;
    const low = k.toLowerCase();
    if (low === 'g') { ED.grid = !ED.grid; ED.refreshTop(); return; }
    if (low === 'c') { ED.showBoxes = !ED.showBoxes; ED.refreshTop(); return; }
    if (low === 'h') { root.classList.toggle('noinsp'); return; }
    if (low === 'x' && ED.sel.length) { ED.flipSel(); return; }
    if (k === '?') { ED.keysDialog(); return; }
    if (k === '+' || k === '=') { ED.zoomAt(cv.width / 2, cv.height / 2, 1.25); return; }
    if (k === '-') { ED.zoomAt(cv.width / 2, cv.height / 2, 0.8); return; }
    for (const [id, t] of Object.entries(ED.TOOLS)) if (t.key && t.key.toLowerCase() === low) { ED.setTool(id); return; }
  }
  ED.flipSel = function () {
    const items = ED.sel.filter((it) => it.t === 'prop' || it.t === 'decal');
    if (!items.length) return;
    ED.act('flip', () => items.forEach(flip1), () => items.forEach(flip1));
  };
  function flip1(it) { if (it.t === 'prop') it.o.flip = !it.o.flip; else { it.o.fx = !it.o.fx; ED.dirtyItem(it); } }

  /* ------------------------------------------------------------------ copy and paste */
  let clip = null;
  ED.copy = function () {
    if (!ED.sel.length) return;
    const cx = ED.sel.reduce((a, it) => a + it.o.x, 0) / ED.sel.length, cy = ED.sel.reduce((a, it) => a + it.o.y, 0) / ED.sel.length;
    clip = ED.sel.map((it) => ({ t: it.t, type: it.type, dx: it.o.x - cx, dy: it.o.y - cy, o: it.t === 'prop' ? CH.Stages.propData(it.o) : ED.clone(Object.assign({}, it.o, { img: undefined })), img: it.o.img }));
    ED.toast('Copied ' + clip.length);
  };
  ED.paste = function (inPlace, off) {
    if (!clip || !clip.length) return;
    const m = ED.mouse;
    const base = inPlace || off ? null : ED.snapPt(m.wx, m.wy, m.alt);
    const items = [];
    const cx0 = clip.reduce((a, c) => a + c.o.x, 0) / clip.length, cy0 = clip.reduce((a, c) => a + c.o.y, 0) / clip.length;
    for (const c of clip) {
      const x = base ? base.x + c.dx : c.o.x + (off || 0), y = base ? base.y + c.dy : c.o.y + (off || 0);
      if (c.t === 'prop') {
        const q = Object.assign({}, c.o, { x, y, exitDoor: undefined }); // (one stage has one exit: a copied exit door is a plain door)
        if (q.door) q.door = { x: q.door.x + x - c.o.x, y: q.door.y + y - c.o.y }; // its way in comes along
        const p = CH.Stages.makeProp(ED.L, q);
        if (p) { delete p.exitDoor; items.push({ t: 'prop', o: p }); }
      }
      else if (c.t === 'mark') { const m2 = ED.MARK[c.type]; if (m2.single) continue; const o = Object.assign(ED.clone(c.o), { x, y }); ED.L[m2.list].push(o); items.push({ t: 'mark', type: c.type, o }); }
      else { const o = Object.assign(ED.clone(c.o), { x, y, img: c.img }); ED.listOf({ t: c.t }).push(o); const it = { t: c.t, o }; ED.dirtyItem(it); items.push(it); }
    }
    void cx0; void cy0;
    ED.addItems('paste ' + items.length, items);
    ED.select(items);
  };

  /* ------------------------------------------------------------------ dialogs */
  ED.modal = function (title, body, buttons) {
    const M = ED.els.modal;
    M.textContent = '';
    const box = $('div', { class: 'box' }, [$('h2', { text: title })].concat(body));
    if (buttons) box.append($('div', { class: 'end' }, buttons));
    M.append(box);
    M.classList.add('show');
    M.onclick = (e) => { if (e.target === M && ED.L) ED.closeModal(); };
    return box;
  };
  ED.closeModal = () => ED.els.modal.classList.remove('show');
  /* which stage, and what to start from (the owner's choice per stage) */
  ED.openDialog = function (preset) {
    const ids = ED.areaIds();
    const sel = $('select', { style: 'min-width:340px' });
    for (const id of ids) sel.append($('option', { value: id, text: ED.areaName(id) + (CH.Stages.data[id] ? '  ✎ hand-made' : '') }));
    sel.value = preset || ED.area || (CH.G && CH.G.wave ? String(CH.G.wave) : '1');
    const choices = $('div', { class: 'choices' });
    const seed = $('input', { type: 'number', value: 0, title: 'Another seed gives another layout' });
    const biome = $('select');
    for (const b of Object.keys(CH.Level.STYLE).filter((b) => b !== 'default')) biome.append($('option', { value: b, text: b }));
    const tw = $('input', { type: 'number', value: 64, min: 16, max: 240 }), th = $('input', { type: 'number', value: 44, min: 12, max: 200 });
    const fill = $('select', {}, [$('option', { value: 'open', text: 'open floor inside walls' }), $('option', { value: 'rock', text: 'all wall (carve it out)' })]);
    const refresh = () => {
      choices.textContent = '';
      const id = sel.value;
      const area = CH.WorldMap && id !== 'belly' ? CH.WorldMap.area(+id) : null;
      if (area) biome.value = area.biome;
      if (id === 'belly') biome.value = 'belly';
      const go = (how, opts) => { ED.closeModal(); ED.openArea(id, how, opts); };
      const draft = ED.files && ED.files.draftOf(id);
      if (CH.Stages.data[id]) choices.append($('button', { class: 'primary', onclick: () => go('saved') }, [$('b', { text: 'Edit my stage' }), $('span', { text: 'The hand-made stage saved for this area (saved ' + ((CH.Stages.data[id].meta || {}).saved || '').slice(0, 16).replace('T', ' ') + ').' })]));
      if (draft) choices.append($('button', { onclick: () => go('draft', { draft: draft.stage }) }, [$('b', { text: 'Restore unsaved work' }), $('span', { text: 'Changes from ' + new Date(draft.at).toLocaleString() + ' that were never saved.' })]));
      choices.append($('button', { onclick: () => go('gen', { seed: +seed.value }) }, [$('b', { text: 'The generated stage' }), $('span', { text: 'The level the game makes for this area, with all its props, to move and fix.' })]));
      choices.append($('button', { onclick: () => go('gen-empty', { seed: +seed.value }) }, [$('b', { text: 'Generated, cleared' }), $('span', { text: 'Its rooms, floors and walls only: every prop, decal and puddle taken away.' })]));
      choices.append($('button', { onclick: () => go('blank', { biome: biome.value, tw: +tw.value, th: +th.value, open: fill.value === 'open' }) }, [$('b', { text: 'Blank stage' }), $('span', { text: 'Start from nothing: pick the look, the size and paint it yourself.' })]));
    };
    sel.onchange = refresh;
    refresh();
    const body = [
      $('div', { class: 'row' }, [$('label', { text: 'Stage' }), sel]),
      choices,
      $('div', { class: 'row' }, [$('label', { text: 'Generated layout seed' }), seed]),
      $('div', { class: 'row' }, [$('label', { text: 'Blank stage: look' }), biome, $('label', { text: 'size' }), tw, '×', th, fill]),
    ];
    if (CH.Stages.data[sel.value]) body.push($('div', { class: 'row' }, [$('button', { class: 'danger', text: 'Delete my stage for this area (the game generates it again)', onclick: () => { if (ED.files) ED.files.deleteStage(sel.value).then(refresh); } })]));
    ED.modal('Open a stage', body, ED.L ? [$('button', { text: 'Cancel', onclick: ED.closeModal })] : [$('button', { text: 'Back to the menu', onclick: () => ED.close() })]);
  };
  ED.keysDialog = function () {
    const rows = [
      ['V B S E T K M', 'tools: select, stamp, scatter, erase, terrain, floor tiles, markers'],
      ['Click / drag', 'pick / move; drag on empty floor draws a box (Shift adds)'],
      ['Alt + click', 'eyedropper: the piece under the mouse in the drawer'],
      ['Alt (held)', 'place and move freely (no snap)'],
      ['Space + drag, middle drag, right drag', 'move the view'],
      ['Wheel', 'zoom at the mouse; Shift+wheel scrolls sideways'],
      ['Home', 'the whole stage'],
      ['Arrows', 'nudge 1 px (Shift 16, Ctrl one tile); the view when nothing is picked'],
      ['X', 'flip what is picked'],
      ['Del', 'delete what is picked'],
      ['Ctrl+C / V / Shift+V / D', 'copy, paste at the mouse, paste in place, duplicate'],
      ['Ctrl+A', 'pick every piece'],
      ['Ctrl+Z / Ctrl+Y', 'undo / redo'],
      ['[ ]', 'brush size'],
      ['G / C / H', 'grid, collision boxes, the details panel'],
      ['Ctrl+F', 'search the drawer'],
      ['Ctrl+S', 'save the stage into the game'],
      ['Ctrl+O', 'open another stage'],
      ['F5', 'play this stage'],
      ['F10 (while playing)', 'back to the editor'],
    ];
    ED.modal('Keys', [$('table', {}, rows.map(([a, b]) => $('tr', {}, [$('td', {}, [$('kbd', { text: a })]), $('td', { text: b })])))], [$('button', { text: 'Close', onclick: ED.closeModal })]);
  };

  /* ------------------------------------------------------------------ opening, closing, playing */
  ED.open = function (id, how) {
    ED.build();
    ED.on = true;
    root.classList.add('show');
    if (CH.UI && CH.UI.hideAll) CH.UI.hideAll();
    if (CH.Audio && CH.Audio.setMusic) try { CH.Audio.setMusic(null); } catch (e) { /* (no music) */ }
    fit();
    if (!raf) raf = requestAnimationFrame(frame);
    if (id && how) ED.openArea(id, how);
    else if (!ED.L) ED.openDialog(id);
    else ED.refreshTop();
  };
  ED.close = function (force) {
    if (!force && ED.dirty && ED.L && !confirm('This stage has changes that are not saved. Leave the editor anyway? (They stay as unsaved work you can restore.)')) return;
    ED.on = false;
    if (root) root.classList.remove('show');
    ED.closeModal && root && ED.closeModal();
    if (CH.UI && CH.UI.showMenu && CH.G && CH.G.state === 'menu') CH.UI.showMenu();
  };
  /* play the stage as it is now (saved or not); F10 comes back */
  ED.playtest = function () {
    if (!ED.L) return;
    const data = CH.Stages.serialize(ED.L, { test: true });
    if (ED.files) ED.files.draftNow();
    CH.Stages.test = { id: ED.area, data };
    ED.on = false;
    root.classList.remove('show');
    const G = CH.G;
    const n = ED.area === 'belly' ? CH.WorldMap.LAST : +ED.area;
    const R = CH.Run;
    if (!ED.usesLevels) { ED.usesLevels = R.usesLevels; R.usesLevels = (m) => (CH.Stages.test && m === ED.testN) || ED.usesLevels(m); } // (the tested area is a stage even where a run would fight a boss)
    ED.testN = n;
    try {
      CH.X.startRun({}, null);
      G._scriptTesting = false;
      if (ED.area === 'belly') { G.startWave(n); if (G.level) { G.level.exit.open = true; CH.Sky.enterTower(); } }
      else G.startWave(n);
      if (G.banner) G.banner('PLAY TEST', 'F10: back to the editor', 3);
    } catch (e) {
      console.error(e);
      ED.on = true; root.classList.add('show');
      ED.toast('The stage could not be played: ' + e.message, false, 6000);
    }
  };
  ED.fromPlay = function () {
    const G = CH.G;
    CH.Stages.test = null;
    if (ED.usesLevels) { CH.Run.usesLevels = ED.usesLevels; ED.usesLevels = null; }
    if (G.toMenu) G.toMenu();
    if (CH.UI && CH.UI.hideAll) CH.UI.hideAll();
    ED.open();
    if (ED.L) ED.toast('Back from the play test.');
  };

  /* the way in: the main menu's STAGE EDITOR, index.html?editor, F10 out of a play test */
  ED.boot = function () {
    const b = document.getElementById('btn-editor');
    if (b) b.addEventListener('click', () => ED.open());
    if (/[?&]editor/.test(location.search)) {
      const go = () => { const l = document.getElementById('loading'); if (CH.Assets.ready && (!l || l.classList.contains('done'))) ED.open(); else setTimeout(go, 150); };
      go();
    }
    window.addEventListener('keydown', (e) => {
      if (!ED.on && e.key === 'F10' && CH.Stages.test && CH.G && CH.G.level) { e.preventDefault(); e.stopImmediatePropagation(); ED.fromPlay(); }
    }, true);
  };
  ED.boot();
})(window.CH);
