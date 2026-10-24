/* The Catacombs and the Crimson Castle (PLAN.md 19, W2): two dungeon biomes built from the packs of 2026-10-24. Their
   floors are the packs' tiles, their walls show the packs' faces and wall strips, and the rooms are dressed from every
   sheet: ossuaries, alchemists' dens, crypts and torture rooms in the Catacombs; halls, throne rooms, armouries, gardens
   and lava halls in the Castle. */
const { open } = require('./lib');
(async () => {
  const { browser, page, errs } = await open({ levels: true });
  let fails = 0;
  const ok = (name, c, extra) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + name + (c ? '' : ' ' + JSON.stringify(extra))); };

  for (const [biome, pre, n] of [['catacombs', 'da', 16], ['castle', 'gc', 28]]) {
    const r = await page.evaluate(([biome, pre]) => {
      const used = {}, per = [];
      const mark = (k) => { const m = new RegExp('^kit\\.(' + pre + '\\d+)\\.').exec(k || ''); if (m) used[m[1]] = (used[m[1]] || 0) + 1; };
      for (let s = 1; s <= 12; s++) {
        const L = CH.LevelGen.generate(biome, 3 + (s % 6), CH.U.seeded(s * 97));
        for (const p of L.props) mark(p.sheet);
        for (const d of L.decals || []) mark(d.key);
        mark(L.exit.gate); mark(L.entrance.gate); // the doors framing the ends
        // the floor and the walls of every chunk
        const T = CH.Level.TS;
        for (let cy = 0; cy * 8 < L.th; cy += 2) for (let cx = 0; cx * 8 < L.tw; cx += 2) L.chunk(cx, cy);
        const M = L.matsFor(L.style);
        for (const k of Object.keys(M)) for (const t of M[k].base.concat(M[k].acc)) mark('kit.' + t);
        for (const k of L._faces || []) mark(k);
        for (const k of L.wallKeys || []) mark(k); // the walls (js/walls.js, PLAN.md 21): the Dungeon Asset Pack's faces and corners, the castle's strips
        per.push({ props: L.props.length, gate: L.exit.gate, faces: (L._faces || []).length + [...(L.wallKeys || [])].filter((k) => k.startsWith('kit.da2.') || k.startsWith('kit.gc')).length });
      }
      return { used, per };
    }, [biome, pre]);
    const sheets = Array.from({ length: n }, (_, i) => pre + (i + 1));
    const unused = sheets.filter((s) => !r.used[s]);
    ok(biome + ': every sheet of its pack is used', unused.length === 0, { unused });
    ok(biome + ': dressed densely, wall faces, a gate at the exit', r.per.every((s) => s.props > 80 && s.faces > 0 && s.gate), r.per.slice(0, 3));
  }

  // a frame of each
  for (const biome of ['catacombs', 'castle']) {
    await page.evaluate((biome) => {
      const G = CH.G;
      G._scriptTesting = true;
      G.newRun(null);
      const L = CH.LevelGen.generate(biome, 5, CH.U.seeded(7));
      G.level = L; G.arena = L; L.explored.fill(1); L.fogDirty = true;
      G.enemies.length = 0;
      const rm = L.rooms.find((r) => r.tag !== 'start' && r.tag !== 'exit') || L.rooms[0];
      G.player.x = rm.cx; G.player.y = rm.cy + 40; G.snapCamera();
      G.flashT = 0;
      for (let i = 0; i < 3; i++) CH.stepFrame(1 / 30);
      G.render();
    }, biome);
    await page.screenshot({ path: __dirname + '/' + biome + '.png' });
  }

  ok('no console errors', errs.length === 0, errs.slice(0, 5));
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
