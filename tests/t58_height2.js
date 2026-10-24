/* Height, part 2 (PLAN.md 19, W5): big plateaus get an upper tier with its own stairs; some rims are climbed by a ramp;
   some rooms are split by a chasm with a bridge over its middle (the packs' bridge pieces). A hero on a tier may jump
   down off its rim but never up onto a higher one; everything a stage needs stays reachable. */
const { open } = require('./lib');
(async () => {
  const { browser, page, errs } = await open({ levels: true });
  let fails = 0;
  const ok = (name, c, extra) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + name + (c ? '' : ' ' + JSON.stringify(extra))); };

  let r = await page.evaluate(() => {
    const T = CH.Level.TS, out = { tier2: 0, ramps: 0, chasms: 0, bridgeArt: 0, cut: 0, levels: 0 };
    for (const biome of ['catacombs', 'dungeon', 'castle', 'volcano', 'frozen', 'deadwood']) for (let s = 1; s <= 5; s++) {
      const L = CH.LevelGen.generate(biome, 3 + s, CH.U.seeded(s * 211));
      out.levels++;
      out.tier2 += L.rooms.filter((rm) => rm.tier2).length;
      out.ramps += L.ramps.size ? 1 : 0;
      out.chasms += L.bridges.length;
      L.paintBridges(document.createElement('canvas').getContext('2d'), 0, 0, 99999);
      out.bridgeArt += L.bridges.filter((b) => b.key && CH.Assets.images[b.key]).length;
      L.flows.clear();
      const f = L.flowFor(L.entrance.x, L.entrance.y);
      const need = [L.exit].concat(L.spawners, L.chests.filter((c) => !c.secret), L.shrines, L.waypoints);
      out.cut += need.filter((q) => f.dist[L.idx(Math.floor(q.x / T), Math.floor(q.y / T))] < 0).length;
    }
    return out;
  });
  ok('upper tiers, ramps and chasms appear across stages', r.tier2 >= 3 && r.ramps >= 3 && r.chasms >= 3, r);
  ok('every bridge is a bridge piece of the packs', r.bridgeArt === r.chasms, r);
  ok('nothing a stage needs is cut off', r.cut === 0, r);

  // tiers: down off a rim from above, never up onto it
  r = await page.evaluate(() => {
    const G = CH.G, T = CH.Level.TS;
    G._scriptTesting = true;
    G.newRun(null);
    let L = null, rm = null;
    for (let s = 1; s < 80 && !rm; s++) { const q = CH.LevelGen.generate('dungeon', 5, CH.U.seeded(s * 37)); const m = q.rooms.find((x) => x.tier2); if (m) { L = q; rm = m; } }
    if (!rm) return { none: true };
    G.level = L; G.arena = L;
    G.enemies.length = 0;
    const [x0, y0, x1, y1] = rm.tier2;
    const p = G.player;
    let col = x0 + 1;
    while (col < x1 && (L.stairs.has(L.idx(col, y1)) || L.cell(col, y1) !== CH.Level.LEDGE)) col++;
    // on the outer tier below the inner rim, jumping north: it stops you
    p.x = col * T + 16; p.y = (y1 + 1) * T + 16 - 12; p.z = 0;
    CH.World.settleWalls(L);
    const t1 = p.top;
    p.z = 10;
    for (let i = 0; i < 30; i++) { p.y -= 2; CH.World.settleWalls(L); }
    const up = Math.floor((p.y + 12) / T) <= y1;
    // on the upper tier, jumping south off its rim: down to the outer tier
    p.x = col * T + 16; p.y = (y1 - 1) * T + 16 - 12; p.z = 0;
    CH.World.settleWalls(L);
    const t2 = p.top;
    p.z = 10;
    for (let i = 0; i < 30; i++) { p.y += 2; CH.World.settleWalls(L); }
    p.z = 0;
    CH.World.settleWalls(L);
    const down = Math.floor((p.y + 12) / T) > y1 && p.top === 1;
    return { t1, t2, up, down };
  });
  ok('the upper tier: no jumping up onto it, jumping down off it lands on the tier below', !r.none && r.t1 === 1 && r.t2 === 2 && !r.up && r.down, r);

  // a frame with a chasm and its bridge
  await page.evaluate(() => {
    const G = CH.G;
    let L = null;
    for (let s = 1; s < 60 && !L; s++) { const q = CH.LevelGen.generate('frozen', 5, CH.U.seeded(s * 53)); if (q.bridges.length) L = q; }
    if (!L) return;
    G.level = L; G.arena = L; L.explored.fill(1); L.fogDirty = true;
    const b = L.bridges[0];
    G.player.x = (b.x0 + 1) * 32; G.player.y = (b.y0 + 4) * 32; G.snapCamera();
    G.flashT = 0;
    CH.stepFrame(1 / 30);
    G.render();
  });
  await page.screenshot({ path: __dirname + '/bridge.png' });

  ok('no console errors', errs.length === 0, errs.slice(0, 5));
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
