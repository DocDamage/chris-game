/* Level generator: connected, seeded, everything placed is reachable, secrets are sealed until cracked. */
const { open } = require('./lib');
(async () => {
  const { browser, page, errs } = await open();
  const out = await page.evaluate(() => {
    const LG = CH.LevelGen, U = CH.U, r = { biomes: {}, slow: 0, bad: [] };
    CH.Props.warm(true); // the game makes every piece's sprite in idle time after load (js/props.js); here, now
    const hash = (L) => { let h = 0; for (let i = 0; i < L.cells.length; i++) h = (h * 31 + L.cells[i]) | 0; return h; };
    for (const biome of ['dungeon', 'office', 'glitch', 'volcano', 'backyard', 'zombie', 'wasteland', 'frozen']) {
      const b = (r.biomes[biome] = { levels: 0, floorPct: [], unreach: 0, maxMs: 0, secrets: 0, sealed: 0, det: true, spawners: 0, packs: 0 });
      for (let stage = 1; stage <= 6; stage++) {
        const seed = stage * 977 + biome.length;
        const t0 = performance.now();
        const L = LG.generate(biome, stage, U.seeded(seed));
        const ms = performance.now() - t0;
        b.maxMs = Math.max(b.maxMs, Math.round(ms));
        b.levels++;
        const floor = L.cells.reduce((n, c) => n + (c === 0 ? 1 : 0), 0) / L.cells.length;
        b.floorPct.push(Math.round(floor * 100));
        if (hash(LG.generate(biome, stage, U.seeded(seed))) !== hash(L)) b.det = false;
        const reach = (p) => L.pathDist(L.entrance.x, L.entrance.y, p.x, p.y) < Infinity;
        const pts = [L.exit].concat(L.waypoints, L.spawners, L.packs, L.shrines, L.chests.filter((c) => !c.secret));
        for (const p of pts) if (!reach(p)) { b.unreach++; r.bad.push(biome + ' stage ' + stage); }
        b.spawners += L.spawners.length; b.packs += L.packs.length;
        for (const s of L.secrets) {
          b.secrets++;
          const sealed = !reach({ x: s.cx, y: s.cy });
          if (sealed) b.sealed++;
          L.set(s.crack.x, s.crack.y, 0); // crack it open
          if (!reach({ x: s.cx, y: s.cy })) r.bad.push(biome + ' secret unreachable after crack');
        }
      }
    }
    return r;
  });
  console.log(JSON.stringify(out));
  const ok = Object.values(out.biomes).every((b) => b.levels === 6 && b.unreach === 0 && b.det && b.maxMs < 400 && b.floorPct.every((p) => p > 8 && p < 70) && b.spawners >= 18 && b.sealed === b.secrets) && out.bad.length === 0;
  console.log('errors', errs);
  console.log(ok && !errs.length ? 'ALL PASSED' : 'FAILED');
  await browser.close();
  process.exit(ok && !errs.length ? 0 : 1);
})();
