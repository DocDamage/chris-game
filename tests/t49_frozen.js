/* The Frozen Kingdom (PLAN.md 18, K3): act III of every world. Its snow swatches for a floor, and rooms dressed from its
   sheets (frozen hamlets, winter camps, crystal fields, statue avenues, a stretch of the ice castle, pines, cliffs,
   ruins, rune plates); frozen water is slippery; feet leave prints in the snow but not on the ice; the nearest
   snowflakes are the pack's own. */
const { open } = require('./lib');
(async () => {
  const { browser, page, errs } = await open({ levels: true });
  let fails = 0;
  const ok = (name, c, extra) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + name + (c ? '' : ' ' + JSON.stringify(extra))); };

  // 1. every sheet is used (the bridges' landings now; their decks wait for the height work, the flakes are weather)
  let r = await page.evaluate(() => {
    const used = {}, per = [];
    const mark = (k) => { const m = /^kit\.(fk\d+)\./.exec(k || ''); if (m) used[m[1]] = (used[m[1]] || 0) + 1; };
    for (const seed of [3, 14, 15, 92, 65, 35]) {
      const L = CH.LevelGen.generate('frozen', 7, CH.U.seeded(seed));
      for (const p of L.props) mark(p.sheet);
      for (const d of L.decals || []) mark(d.key);
      per.push({ props: L.props.length, ice: (L.ice || []).length, gate: L.exit.gate });
    }
    const L = CH.LevelGen.generate('frozen', 7, CH.U.seeded(1));
    for (const k of Object.keys(L.style.mats)) for (const t of L.style.mats[k].base.concat(L.style.mats[k].acc)) if (CH.Assets.images['kit.' + t]) mark('kit.' + t);
    return { used, per };
  });
  const sheets = Array.from({ length: 20 }, (_, i) => 'fk' + (i + 1)).filter((s) => s !== 'fk18');
  const unused = sheets.filter((s) => !r.used[s]);
  ok('every Frozen Kingdom sheet is used', unused.length === 0, { unused, used: r.used });
  ok('stages are dressed densely, with frozen water and the ice gate', r.per.every((s) => s.props > 100 && s.ice >= 3 && s.gate === 'kit.fk_ice_gate'), r.per);

  // 2. a world's act III is the Frozen Kingdom; prints in the snow, slides on the ice
  r = await page.evaluate(() => {
    const G = CH.G, St = CH.Storage;
    localStorage.removeItem(St.KEY3);
    St.load();
    St.createSlot({ hero: 'Mercenary', name: 'Yeti' });
    G._scriptTesting = true;
    G.newRun(null);
    G.startWave(7);
    const L = G.level, p = G.player;
    for (const e of G.enemies) e.dead = true;
    // walk on snow
    CH.Atmos.prints.length = 0;
    const s = L.nearestOpen(L.entrance.x + 60, L.entrance.y);
    p.x = s.x; p.y = s.y;
    for (let i = 0; i < 30; i++) { p.x += 3; CH.stepFrame(1 / 30); }
    const prints = CH.Atmos.prints.filter((q) => q.kind === 'snow').length;
    // stand on ice: acceleration drops
    const ice = L.ice[0];
    p.x = ice.x; p.y = ice.y - 12; p.vx = p.vy = 0;
    CH.stepFrame(1 / 30);
    return { biome: L.biome, act: CH.Quests.ACTS[2], prints, onIce: p.onIce, name: L.name };
  });
  ok('act III of a world is the Frozen Kingdom', r.biome === 'frozen' && r.act === 'III. The Frozen Kingdom' && r.name === 'The Frozen Kingdom', r);
  ok('feet leave prints in the snow', r.prints >= 4, r);
  ok('frozen water is ice underfoot', r.onIce === true, r);
  await page.evaluate(() => { const G = CH.G, p = G.player; G.snapCamera(); G.render(); });
  await page.screenshot({ path: __dirname + '/fk_stage.png' });

  ok('no console errors', errs.length === 0, errs.slice(0, 5));
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
