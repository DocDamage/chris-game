/* Where props make walkers detour: every area's stage, floor cells whose walk from the entrance is much longer with the
   solid props than without them. Not a test. node tests/detour_scan.js [areas] */
const { open } = require('./lib');
(async () => {
  const areas = process.argv[2] ? process.argv[2].split(',').map(Number) : Array.from({ length: 49 }, (_, i) => i + 1);
  const { browser, page } = await open({ levels: true, quiet: true });
  await page.evaluate(() => {
    const St = CH.Storage;
    localStorage.removeItem(St.KEY3);
    St.load();
    St.createSlot({ hero: 'Mercenary', name: 'Scanner' });
    CH.G._scriptTesting = true;
    CH.G.newRun(null);
  });
  const rows = [];
  for (const n of areas) {
    const r = await page.evaluate((n) => {
      const G = CH.G;
      if (CH.Town && CH.Town.inTown) CH.Town.leave();
      G.startWave(n);
      if (CH.Town && CH.Town.inTown) CH.Town.leave();
      const L = G.level;
      if (!L || !L.flowFor) return null;
      const TS = 32, e = L.entrance;
      L.flows.clear();
      const a = L.flowFor(e.x, e.y).dist.slice();
      const solid = L.props.filter((p) => p.solid && !p.dead);
      for (const p of solid) p.solid = false;
      L.flows.clear();
      const b = L.flowFor(e.x, e.y).dist;
      for (const p of solid) p.solid = true;
      L.flows.clear();
      let bad = 0, worst = 0, wx = 0, wy = 0, cut = 0;
      for (let i = 0; i < a.length; i++) {
        if (b[i] < 0) continue;
        if (a[i] < 0) { cut++; continue; }
        const d = a[i] - b[i];
        if (d > 20) bad++;
        if (d > worst) { worst = d; wx = (i % L.tw) * TS; wy = ((i / L.tw) | 0) * TS; }
      }
      return { n, biome: L.biome, stage: L.stage, bad, worst, at: [wx, wy], cut };
    }, n);
    if (r) { rows.push(r); console.log(JSON.stringify(r)); }
  }
  await browser.close();
})();
