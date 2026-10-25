/* The stage editor (PLAN.md 23): every piece of every pack is in its drawer; placing keeps a piece's collision; undo;
   terrain; markers; a stage saved, built again and played as made (its collision holds); new pictures brought in are
   cut, animated and given collision by themselves; the play test and back. */
const { open } = require('./lib');
(async () => {
  const { browser, page, errs } = await open({ levels: true, manual: false, viewport: { width: 1500, height: 860 } });
  const fails = [];
  const ok = (name, cond, info) => { console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : ' ' + JSON.stringify(info))); if (!cond) fails.push(name); };
  const r = await page.evaluate(async () => {
    const ED = CH.Editor, CAT = CH.EdCatalog, out = {};
    const wait = (ms) => new Promise((res) => setTimeout(res, ms));
    // in by the main menu
    document.getElementById('btn-editor').click();
    await wait(300);
    out.dialog = ED.els.modal.classList.contains('show');
    ED.closeModal();
    // every piece the packs carry (as tests/audit_assets.js counts them) is in the drawer
    const M = CH.Assets.meta, keys = [];
    for (const id of Object.keys(M.kits || {})) for (let i = 0; i < (M.kits[id].n || 0); i++) if (CH.Assets.images['kit.' + id + '.' + i]) keys.push('kit.' + id + '.' + i);
    for (const id of Object.keys(M.sheets || {})) for (let i = 0; i < M.sheets[id].n; i++) keys.push('sh.' + id + '.' + i);
    for (const n of Object.keys((M.lands || {}).anims || {})) keys.push('anim.' + n);
    for (const [id, m] of Object.entries((M.lands || {}).sheets || {})) { if (!m.kinds) { if (CH.Assets.images['kit.' + id]) keys.push('kit.' + id); continue; } for (let i = 0; i < m.n; i++) if (CH.Assets.images['kit.' + id + '.' + i]) keys.push('kit.' + id + '.' + i); }
    for (const k of [...new Set(Object.values(CH.SetPieces.OBJ).flat())]) if (CH.Sprites.has(k)) keys.push(k);
    const have = new Set(CAT.all().map((e) => e.key));
    out.missing = keys.filter((k) => !have.has(k)).slice(0, 10);
    out.nCat = have.size;
    out.nKeys = new Set(keys).size;
    // a generated stage to fix
    ED.openArea('13', 'gen');
    const L = ED.L;
    out.opened = !!L && L.props.length > 50;
    const n0 = L.props.length;
    // a barrel placed as the game would: solid, its kind's box
    const barrel = CH.Props.pool('barrel', 'zwvhmg')[0];
    const spot = L.nearestOpen(L.entrance.x + 120, L.entrance.y);
    const it = ED.place(barrel, spot.x, spot.y);
    ED.addItems('place', [it]);
    out.placed = it && it.t === 'prop' && it.o.solid && !!it.o.box && L.props.length === n0 + 1;
    ED.undo();
    out.undone = L.props.length === n0;
    ED.redo();
    out.redone = L.props.length === n0 + 1 && L.props.includes(it.o);
    ED.moveItems('move', [it], 32, 0);
    out.moved = it.o.x === spot.x + 32;
    ED.undo();
    out.moveUndone = it.o.x === spot.x;
    // a piece the generator would lay flat stands when asked
    const rug = CH.Props.pool('rug', 'zwvhmagrc')[0] || CH.Props.pool('decal', 'zwvhm')[0];
    const flat = ED.place(rug, spot.x, spot.y + 60);
    const stood = ED.place(rug, spot.x + 60, spot.y + 60, { as: 'stand' });
    out.flatStand = flat && flat.t === 'decal' && stood && stood.t === 'prop';
    ED.addItems('two', [flat, stood]);
    // terrain: a wall painted onto the floor and the walls worked out again
    const tx = Math.floor(spot.x / 32), ty = Math.floor(spot.y / 32) + 3;
    const before = L.cell(tx, ty);
    ED.setCells('paint', new Map([[L.idx(tx, ty), before === 0 ? 1 : 0]]));
    out.painted = L.cell(tx, ty) !== before;
    ED.undo();
    out.paintUndone = L.cell(tx, ty) === before;
    // markers
    const np = L.packs.length;
    ED.setTool('mark');
    ED.sub.mark = 'pack';
    ED.TOOLS.mark.down({ wx: spot.x - 40, wy: spot.y, button: 0 });
    out.marker = L.packs.length === np + 1;
    // the collision handle: the barrel's box made wider by dragging its right handle
    ED.setTool('select');
    ED.select([it]);
    ED.boxEdit = true; // ("Drag it on the map" in the details panel)
    const hw0 = it.o.box.hw, bx = it.o.x + (it.o.cx || 0), by = it.o.y + (it.o.cy || 0);
    ED.TOOLS.select.down({ wx: bx + hw0, wy: by, button: 0 });
    ED.TOOLS.select.move({ wx: bx + hw0 + 6, wy: by, down: true });
    ED.TOOLS.select.up({ wx: bx + hw0 + 6, wy: by });
    out.handle = it.o.box.hw === hw0 + 6;
    // saved, and built again as the same stage
    const data = CH.Stages.serialize(L, { area: '13' });
    const B = CH.Stages.build(data, 13);
    const real = (P) => P.filter((p) => p.cat !== 'walllight').length;
    out.round = { props: [real(L.props), real(B.props)], decals: [L.decals.length, B.decals.length], packs: [L.packs.length, B.packs.length], cells: CH.Stages.rle(L.cells) === CH.Stages.rle(B.cells) };
    const bb = B.props.find((p) => p.sheet === barrel && Math.abs(p.x - it.o.x) < 1 && Math.abs(p.y - it.o.y) < 1);
    out.barrelKept = !!bb && bb.solid && bb.box.hw === it.o.box.hw;
    out.text = CH.Editor.files.stagesText().length;
    // played: the hand-made stage replaces the generator's, and a hero cannot walk through the barrel
    CH.Stages.data['13'] = data;
    CH.X.startRun({}, null);
    CH.G._scriptTesting = true;
    CH.G.startWave(13);
    const G = CH.G, P = G.level;
    out.played = !!P && P.handmade === true && real(P.props) === real(L.props);
    const pb = P.props.find((p) => p.sheet === barrel && Math.abs(p.x - it.o.x) < 1);
    if (pb) {
      const pl = G.player;
      pl.x = pb.x + (pb.cx || 0); pl.y = pb.y + (pb.cy || 0) - 12;
      for (let i = 0; i < 4; i++) CH.stepFrame(1 / 30);
      const fy = pl.y + 12;
      out.blocked = !(Math.abs(pl.x - (pb.x + (pb.cx || 0))) < pb.box.hw - 1 && Math.abs(fy - (pb.y + (pb.cy || 0))) < pb.box.hh - 1);
    }
    delete CH.Stages.data['13'];
    G.toMenu();
    // new pictures: an animation strip (two rows of four frames), one standing thing, a floor swatch
    const strip = document.createElement('canvas');
    strip.width = 4 * 24; strip.height = 2 * 24;
    const sg = strip.getContext('2d');
    for (let r2 = 0; r2 < 2; r2++) for (let k = 0; k < 4; k++) { sg.fillStyle = r2 ? '#3c8' : '#e53'; sg.beginPath(); sg.arc(k * 24 + 12, r2 * 24 + 12, 6 + k, 0, 7); sg.fill(); }
    const one = document.createElement('canvas');
    one.width = 20; one.height = 40;
    const og = one.getContext('2d'); og.fillStyle = '#964'; og.fillRect(4, 2, 12, 36);
    const tile = document.createElement('canvas');
    tile.width = 32; tile.height = 32;
    const tg = tile.getContext('2d'); tg.fillStyle = '#556'; tg.fillRect(0, 0, 32, 32);
    const im = async (c) => { const x = new Image(); x.src = c.toDataURL(); await x.decode(); return x; };
    const IMP = ED.importer;
    const srcs = [{ name: 'Glow_Orb_strip4.png', img: await im(strip) }, { name: 'old_barrel.png', img: await im(one) }, { name: 'slab_floor.png', img: await im(tile) }];
    const cuts = srcs.map((s) => (s.items = IMP.cut(s, null, 1)));
    out.cut = cuts.map((c, i) => srcs[i].mode + ':' + c.length + ':' + c.map((x) => x.frames.length + x.layer).join('/'));
    ED.files.saveUser = async () => true; // (no folder to write to in a test)
    ED.files.saveMeta = async () => true;
    await IMP.commit(srcs, 'My Assets');
    const mine = CAT.all().filter((e) => e.pack === 'My Assets');
    out.mine = mine.map((e) => e.key + ':' + e.type + ':' + e.kind);
    const anim = mine.find((e) => e.anim);
    const barrel2 = mine.find((e) => e.kind === 'barrel');
    const m2 = barrel2 && CH.Props.meta(barrel2.key);
    out.importBox = !!(m2 && m2.box && m2.box.hw > 2);
    ED.openArea('13', 'gen-empty');
    const sp2 = ED.L.nearestOpen(ED.L.entrance.x + 100, ED.L.entrance.y);
    const pa = anim && ED.place(anim.key, sp2.x, sp2.y);
    out.animPlaced = !!(pa && pa.t === 'prop' && pa.o.fps > 0 && CH.Sprites.get(pa.o.sprite).frames.length === 4);
    const pbar = barrel2 && ED.place(barrel2.key, sp2.x + 50, sp2.y);
    out.barrelImported = !!(pbar && pbar.t === 'prop' && pbar.o.solid && pbar.o.box && pbar.o.box.hw === m2.box.hw);
    out.cleared = ED.L.props.filter((p) => p.cat !== 'walllight' && p !== (pa && pa.o) && p !== (pbar && pbar.o)).length === 0;
    // every piece placed is recognised for what it is to the game, or the editor asks
    ED.setEventMode('always');
    ED.forget();
    ED.openArea('24', 'gen-empty');
    const L2 = ED.L, pool = (k) => CH.Props.pool(k, 'zwvhmagrcfusitb')[0];
    const spots = []; for (let i = 0; i < 14; i++) spots.push(L2.nearestOpen(L2.entrance.x + 40 + (i % 7) * 70, L2.entrance.y + (i < 7 ? -60 : 70)));
    const put = (k, i) => { const it2 = ED.place(k, spots[i].x, spots[i].y); ED.addItems('place', [it2]); return it2.o; };
    const door = put(pool('door'), 0), torch = put(pool('torch'), 1), sign = put(pool('signpost'), 2), trap = put(pool('firetrap'), 3);
    out.sure = [ED.roleOf(door), ED.roleOf(torch), !!torch.glow, ED.roleOf(sign), ED.roleOf(trap)].join(',');
    out.doorSpot = !!door.door && !L2.solidAt(door.door.x, door.door.y);
    const g1 = put(pool('grave'), 4);
    const card = ED.els.view.querySelector('.ed-ask');
    out.asked = !!card && /grave/i.test(card.textContent);
    if (card) card.querySelector('button.primary').click(); // "a breach", remembered for every grave
    const g2 = put(pool('grave'), 5);
    out.graves = ED.roleOf(g1) + ',' + ED.roleOf(g2) + ',' + !ED.els.view.querySelector('.ed-ask');
    const stall = put(pool('stall'), 6);
    const card2 = ED.els.view.querySelector('.ed-ask');
    if (card2) card2.querySelector('button.primary').click();
    const crate = put(pool('crate'), 7);
    ED.setRole([crate], 'chest');
    out.roles2 = ED.roleOf(stall) + ',' + ED.roleOf(crate);
    ED.undo();
    out.roleUndo = ED.roleOf(crate) === 'breakable';
    ED.redo();
    // saved, played: each role is real in the game
    const d2 = CH.Stages.serialize(L2, { area: '24' });
    const B2 = CH.Stages.build(d2, 24);
    out.made = { chest: B2.chests.filter((c) => c.fromProp).length, breach: B2.spawners.filter((c) => c.fromProp).length, sign: (B2.lore || []).filter((c) => c.fromProp).length, shop: !!B2.shop, hazard: (B2.hazards || []).length, door: B2.props.some((p) => p.enter) };
    out.noDouble = d2.chests.length === L2.chests.length && d2.spawners.length === L2.spawners.length; // (the stage's own; the pieces' are made from the pieces)
    CH.Stages.data['24'] = d2;
    CH.X.startRun({}, null);
    CH.G._scriptTesting = true;
    CH.G.startWave(24);
    const P2 = CH.G.level, pl = CH.G.player;
    for (let i = 0; i < 3; i++) CH.stepFrame(1 / 30);
    const verbAt = (q) => { pl.x = q.x; pl.y = q.y; const t = CH.Interact.find(pl); return t ? t.verb : null; };
    const pd = P2.props.find((p) => p.enter), pc = P2.chests.find((c) => c.fromProp), ps = (P2.lore || []).find((c) => c.fromProp);
    out.verbs = [pd && verbAt(pd.door || pd), pc && verbAt(pc), ps && verbAt(ps), P2.shop && CH.G.machine && CH.G.machine.hidden && verbAt(P2.shop)].join(',');
    out.breachLive = P2.hives.length === P2.spawners.length && P2.spawners.some((s) => s.fromProp);
    const hz = P2.hazards[0], hp0 = pl.hp;
    pl.x = hz.x; pl.y = hz.y - 8;
    for (let i = 0; i < 40; i++) { pl.x = hz.x; pl.y = hz.y - 8; CH.stepFrame(1 / 30); }
    out.burns = pl.hp < hp0;
    delete CH.Stages.data['24'];
    CH.G.toMenu();
    // a saved stage opened again: its pieces' chests and signs are the pieces', not doubled
    CH.Stages.data['24'] = d2;
    ED.open();
    ED.openArea('24', 'saved');
    out.reopen = ED.L.chests.every((c) => !c.fromProp) && ED.L.props.some((p) => p.ev === 'chest') && ED.marks().filter((m) => m.type === 'door').length >= 6;
    delete CH.Stages.data['24'];
    ED.forget();
    // the play test and back
    ED.openArea('13', 'gen-empty');
    ED.playtest();
    await wait(100);
    out.test = !!(CH.G.level && CH.G.level.handmade && CH.Stages.test);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F10', bubbles: true }));
    await wait(100);
    out.back = ED.on && !CH.Stages.test;
    out.check = ED.check();
    ED.dirty = false;
    ED.close(true);
    return out;
  });
  await page.screenshot({ path: __dirname + '/editor.png' });
  // height: a plateau painted on a blank stage, its rim, stairs, a second tier with a ramp, a chasm and its bridge
  const h = await page.evaluate(async () => {
    const ED = CH.Editor, T = 32, out = {};
    ED.open();
    ED.openArea('30', 'blank', { biome: 'dungeon', tw: 40, th: 30, open: true });
    const L = ED.L, at = (x, y) => ({ wx: x * T + 16, wy: y * T + 16 });
    const drag = (tool, a, b, o) => { ED.TOOLS[tool].down(Object.assign({ button: 0, shift: true }, at(...a), o)); ED.TOOLS[tool].up(Object.assign(at(...b), { down: false })); };
    const click = (tool, x, y, o) => { const m = Object.assign({ button: 0 }, at(x, y), o); ED.TOOLS[tool].down(m); ED.TOOLS[tool].up(m); };
    const cell = (x, y) => L.cell(x, y) + ':' + L.top[L.idx(x, y)];
    ED.setTool('height');
    ED.sub.height = '1';
    drag('height', [10, 8], [20, 16]);
    out.plateau = [cell(15, 12), cell(10, 12), cell(10, 8), cell(9, 12)].join(' '); // top, rim, corner, the ground beside it
    out.noStairs = /has no stairs/.test(ED.check());
    ED.sub.height = 'stairs';
    click('height', 15, 16);
    out.stairs = L.stairs.has(L.idx(15, 16)) && cell(15, 16) === '0:0';
    out.stairsOk = !/has no stairs|lead nowhere/.test(ED.check());
    ED.sub.height = '2';
    drag('height', [13, 10], [17, 14]);
    out.tier2 = [cell(15, 12), cell(13, 12)].join(' ');
    ED.sub.height = 'ramp';
    drag('height', [15, 14], [16, 14]);
    out.ramp = L.ramps.has(L.idx(15, 14)) && L.ramps.has(L.idx(16, 14)) && cell(15, 14) === '0:1';
    ED.undo();
    out.rampUndo = cell(15, 14) === '5:2' && !L.stairs.has(L.idx(15, 14));
    ED.redo();
    // up the stairs and the ramp: the top of the upper tier can be walked to from the entrance
    L.flows.clear();
    out.walkUp = L.flowFor(L.entrance.x, L.entrance.y).dist[L.idx(15, 12)] >= 0;
    // a chasm right across the stage cuts the exit off; a bridge over it joins it again
    ED.setTool('terrain');
    ED.sub.terrain = 'pit';
    drag('terrain', [25, 1], [26, 28]);
    out.cut = /Exit .* cannot be walked to/.test(ED.check());
    ED.setTool('height');
    ED.sub.height = 'bridge';
    drag('height', [25, 14], [26, 15]);
    out.bridge = L.bridges.length === 1 && cell(25, 14) === '0:0' && !/cannot be walked to/.test(ED.check());
    // saved and built again: every tier, rim, stair, ramp and bridge comes back
    const d = CH.Stages.serialize(L, { area: '30' }), B = CH.Stages.build(d, 30);
    out.round = B.cells.join() === L.cells.join() && B.top.join() === L.top.join() && [...B.stairs].sort().join() === [...L.stairs].sort().join() && B.ramps.size === 2 && B.bridges.length === 1;
    // in the game: a hero on the ground cannot jump up onto a rim, a hero on top may jump down off it; the top lifts the hero
    const climb = { hero: true, z: 5, top: 0, x: 9 * T + 28, y: 12 * T + 16, r: 8 }, down = { hero: true, z: 5, top: 1, x: 11 * T + 4, y: 12 * T + 16, r: 8 };
    out.climbBlocked = B.pushOut(climb) === true;
    out.jumpDown = B.pushOut(down) === false;
    // the stage made wider: the stairs and ramps keep their tiles
    ED.select([]);
    ED.inspect();
    const rb = [...ED.els.insp.querySelectorAll('button')].find((b) => b.textContent === 'Resize');
    if (rb) { const ins = rb.parentElement.querySelectorAll('input'); ins[0].value = 46; ins[1].value = 30; rb.click(); }
    out.resized = L.tw === 46 && L.stairs.has(L.idx(15, 16)) && L.ramps.has(L.idx(16, 14)) && L.cell(13, 12) === 5;
    ED.dirty = false;
    ED.close(true);
    return out;
  });
  ok('height: a painted tier gets its rim; it warns until stairs are put in the rim', h.plateau === '0:1 5:1 5:1 0:0' && h.noStairs && h.stairs && h.stairsOk, h);
  ok('height: a second tier on top, a ramp up to it (undo, redo); the top can be walked to', h.tier2 === '0:2 5:2' && h.ramp && h.rampUndo && h.walkUp, h);
  ok('height: a chasm cuts the exit off, a bridge joins it again', h.cut && h.bridge, h);
  ok('height: saved and built again the same; heroes cannot climb a rim but may jump down it', h.round && h.climbBlocked && h.jumpDown, h);
  ok('height: a resized stage keeps its stairs and ramps on their tiles', h.resized, h);
  ok('the main menu opens the editor at its stage picker', r.dialog, r);
  ok('every piece of every pack is in the drawer', !r.missing.length && r.nCat >= r.nKeys, { missing: r.missing, nCat: r.nCat, nKeys: r.nKeys });
  ok('a generated stage opens for editing', r.opened, r);
  ok('a placed barrel keeps its kind\'s collision; undo and redo', r.placed && r.undone && r.redone, r);
  ok('moving and undoing a move', r.moved && r.moveUndone, r);
  ok('a flat piece can be stood up', r.flatStand, r);
  ok('terrain paints a cell and undoes', r.painted && r.paintUndone, r);
  ok('a marker is placed', r.marker, r);
  ok('dragging the collision handle widens the box', r.handle, r);
  ok('a saved stage is built again the same', r.round.props[0] === r.round.props[1] && r.round.decals[0] === r.round.decals[1] && r.round.packs[0] === r.round.packs[1] && r.round.cells && r.barrelKept, r.round);
  ok('the game plays the hand-made stage and its collision holds', r.played && r.blocked, r);
  ok('new pictures are cut by themselves: an animation strip, one piece, a floor swatch', r.cut[0] === 'anim:2:4stand/4stand' && r.cut[1] === 'one:1:1stand' && r.cut[2] === 'one:1:1floor', r.cut);
  ok('brought-in pieces join the drawer with their kind, collision and animation', r.mine.length === 4 && r.importBox && r.animPlaced && r.barrelImported, r);
  ok('a generated stage opens cleared of its props', r.cleared, r);
  ok('the play test plays the stage being edited; F10 comes back', r.test && r.back, r);
  ok('pieces it is sure of get their role: a door goes inside, a torch glows, a signpost reads, a fire trap burns', /^inside:\w+,light,true,sign,burns$/.test(r.sure) && r.doorSpot, { sure: r.sure, doorSpot: r.doorSpot });
  ok('unsure, it asks (a grave): the answer is kept for every grave', r.asked && r.graves === 'breach,breach,true', { asked: r.asked, graves: r.graves });
  ok('a stall asked about becomes a shop; any piece can be made a chest; undo', r.roles2 === 'shop,chest' && r.roleUndo, { roles2: r.roles2, roleUndo: r.roleUndo });
  ok('saved and built, the roles are made real: chest, breach, sign, shop, hazard, door', r.made.chest === 1 && r.made.breach === 2 && r.made.sign === 1 && r.made.shop && r.made.hazard === 1 && r.made.door && r.noDouble, r.made);
  ok('in play: ENTER at the door, OPEN at the chest, READ at the sign, SHOP at the stall; the breach spawns; the trap burns', r.verbs === 'ENTER,OPEN,READ,SHOP' && r.breachLive && r.burns, { verbs: r.verbs, breach: r.breachLive, burns: r.burns });
  ok('a saved stage opened again keeps its roles without doubling them', r.reopen, r.reopen);
  ok('no console errors', !errs.length, errs.slice(0, 5));
  console.log(fails.length ? fails.length + ' FAILED' : 'ALL PASS');
  await browser.close();
  process.exit(fails.length ? 1 : 0);
})();
