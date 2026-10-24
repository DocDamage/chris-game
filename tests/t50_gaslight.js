/* The Gaslight District (PLAN.md 18, K4): act II of every world. Cobbled streets and slab pavements for a floor, and
   rooms dressed from the Haunted Victorian City sheets: townhouses built from its wall, door, window and roof modules,
   lamplit streets with carriages, the night market, fenced cemeteries with mausoleums, occult corners with a pentagram
   and a throne, ruins; the skull arch at the exit. */
const { open } = require('./lib');
(async () => {
  const { browser, page, errs } = await open({ levels: true });
  let fails = 0;
  const ok = (name, c, extra) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + name + (c ? '' : ' ' + JSON.stringify(extra))); };

  let r = await page.evaluate(() => {
    const used = {}, per = [];
    const mark = (k) => { const m = /^kit\.(hv\d+)\./.exec(k || ''); if (m) used[m[1]] = (used[m[1]] || 0) + 1; };
    for (const seed of [2, 7, 18, 28, 45, 90]) {
      for (const stage of [4, 6]) {
        const L = CH.LevelGen.generate('gaslight', stage, CH.U.seeded(seed * 3 + stage));
        let houses = 0;
        for (const p of L.props) { mark(p.sheet); if (p.kits) { houses++; p.kits.forEach(mark); } }
        for (const d of L.decals || []) mark(d.key);
        per.push({ props: L.props.length, houses, gate: L.exit.gate });
      }
    }
    const L = CH.LevelGen.generate('gaslight', 4, CH.U.seeded(1));
    for (const k of Object.keys(L.style.mats)) for (const t of L.style.mats[k].base.concat(L.style.mats[k].acc)) if (CH.Assets.images['kit.' + t]) mark('kit.' + t);
    return { used, per };
  });
  const sheets = Array.from({ length: 20 }, (_, i) => 'hv' + (i + 1));
  const unused = sheets.filter((s) => !r.used[s]);
  ok('every Haunted Victorian City sheet is used', unused.length === 0, { unused, used: r.used });
  ok('stages are dressed densely, each with a townhouse, the skull arch at the exit', r.per.every((s) => s.props > 100 && s.houses >= 1 && s.gate === 'kit.hv_skull_arch'), r.per);

  r = await page.evaluate(() => {
    const G = CH.G, St = CH.Storage;
    localStorage.removeItem(St.KEY3);
    St.load();
    St.createSlot({ hero: 'Mercenary', name: 'Lamplighter' });
    G._scriptTesting = true;
    G.newRun(null);
    G.startWave(CH.WorldMap.first('gaslight'));
    const L = G.level, p = G.player;
    for (const e of G.enemies) e.dead = true;
    const house = L.props.find((q) => q.kits) || L.props[30];
    p.x = house.x; p.y = house.y + 60; G.snapCamera();
    for (let i = 0; i < 4; i++) CH.stepFrame(1 / 30);
    G.render();
    return { biome: L.biome, act: CH.Quests.ACTS[1], name: L.name };
  });
  ok('act II of a world is the Gaslight District', r.biome === 'gaslight' && r.act === 'II. The Gaslight District' && r.name === 'The Gaslight District', r);
  await page.screenshot({ path: __dirname + '/gl_stage.png' });

  ok('no console errors', errs.length === 0, errs.slice(0, 5));
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
