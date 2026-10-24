/* The Dead Wood (PLAN.md 18, K2): stages 1-2 are the Creepy Forest. The floor is its ground swatches, the walls the
   darkened rock cliff, and the rooms are dressed from every one of its twenty sheets: dead trees and roots, cabins built
   from the log panels and shingle roofs, graveyards and crypts, ritual circles, lanterns, warning signs by the secret
   walls, bones, cages and gallows, wells, furniture, horror decorations, the legendary props, the giant twisted tree,
   the skull gate at the exit. */
const { open } = require('./lib');
(async () => {
  const { browser, page, errs } = await open({ levels: true });
  let fails = 0;
  const ok = (name, c, extra) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + name + (c ? '' : ' ' + JSON.stringify(extra))); };

  // 1. a character's first stage is the Dead Wood
  let r = await page.evaluate(() => {
    const G = CH.G, St = CH.Storage;
    localStorage.removeItem(St.KEY3);
    St.load();
    St.createSlot({ hero: 'Mercenary', name: 'Woodsman' });
    G._scriptTesting = true;
    G.newRun(null);
    const L = G.level;
    for (let i = 0; i < 10; i++) CH.stepFrame(1 / 30);
    return { biome: L.biome, name: L.name, act: CH.Quests.ACTS[0], floor: L.style.floor, music: CH.Audio.musicInfo ? CH.Audio.musicInfo().filter((t) => t.target === 1).map((t) => t.name)[0] : null };
  });
  ok('stage 1 is The Dead Wood (act I)', r.biome === 'deadwood' && r.name === 'The Dead Wood' && r.act === 'I. The Dead Wood' && r.floor === 'kit', r);

  // 2. every sheet of the pack is used across a few stages
  r = await page.evaluate(() => {
    const used = {}, per = [];
    const mark = (k) => { const m = /^kit\.(cf\d+)\./.exec(k || ''); if (m) used[m[1]] = (used[m[1]] || 0) + 1; };
    for (const seed of [11, 22, 33, 44, 55, 66]) {
      for (const stage of [1, 2]) {
        const L = CH.LevelGen.generate('deadwood', stage, CH.U.seeded(seed * 7 + stage));
        let cabins = 0, tree = 0;
        for (const p of L.props) { mark(p.sheet); if (p.kits) { cabins++; p.kits.forEach(mark); } if (p.sheet === 'kit.cf_giant_tree') tree++; }
        for (const d of L.decals || []) mark(d.key);
        per.push({ props: L.props.length, decals: (L.decals || []).length, cabins, tree, gate: L.exit.gate, entrance: L.entrance.gate });
      }
    }
    // the floor: the ground swatches of cf1 and cf2 (every material resolves to images)
    const st = CH.Level ? null : null;
    const L = CH.LevelGen.generate('deadwood', 1, CH.U.seeded(5));
    const mats = L.style.mats;
    let missing = 0;
    for (const k of Object.keys(mats)) for (const t of mats[k].base.concat(mats[k].acc)) { if (!CH.Assets.images['kit.' + t]) missing++; else mark('kit.' + t); }
    return { used, per, missing, floorTiles: Object.keys(mats).reduce((n, k) => n + mats[k].base.length + mats[k].acc.length, 0) };
  });
  const sheets = Array.from({ length: 20 }, (_, i) => 'cf' + (i + 1));
  const unused = sheets.filter((s) => !r.used[s]);
  ok('every Creepy Forest sheet is used (floor, props, decals, cabins)', unused.length === 0, { unused, used: r.used });
  ok('the floor swatches all exist', r.missing === 0 && r.floorTiles >= 60, { missing: r.missing, n: r.floorTiles });
  ok('stages are dressed densely', r.per.every((s) => s.props > 120), r.per.map((s) => s.props));
  ok('cabins are built from the log panels and roofs', r.per.filter((s) => s.cabins > 0).length >= 4, r.per.map((s) => s.cabins));
  ok('the giant twisted tree stands in most stages', r.per.filter((s) => s.tree === 1).length >= 8, r.per.map((s) => s.tree));
  ok('the skull gate frames the exit, the crypt arch the entrance', r.per.every((s) => s.gate === 'kit.cf_skull_gate' && s.entrance === 'kit.cf_crypt_arch'), r.per[0]);

  // 3. it renders: a frame of the real stage, a screenshot to look at
  r = await page.evaluate(() => {
    const G = CH.G;
    const L = G.level;
    // walk the camera to a cabin, a graveyard or the giant tree
    const show = L.props.find((p) => p.kits) || L.props.find((p) => p.sheet === 'kit.cf_giant_tree') || L.props[40];
    G.player.x = show.x; G.player.y = show.y + 70;
    for (const e of G.enemies) e.dead = true;
    G.snapCamera();
    for (let i = 0; i < 6; i++) CH.stepFrame(1 / 30);
    G.render();
    return { at: [Math.round(show.x), Math.round(show.y)], what: show.kits ? 'cabin' : show.sheet };
  });
  await page.screenshot({ path: __dirname + '/dw_stage.png' });
  ok('a Dead Wood frame renders', !!r.at, r);

  ok('no console errors', errs.length === 0, errs.slice(0, 5));
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
