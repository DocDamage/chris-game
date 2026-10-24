/* The world map (PLAN.md 19, W3): nine biomes of five stages in four acts, each act ending in a boss hall of its last
   biome, 49 areas; difficulty follows a depth from 1 to 10 across them; no Corporate Hell or Glitch in the world. */
const { open } = require('./lib');
(async () => {
  const { browser, page, errs } = await open({ levels: true });
  let fails = 0;
  const ok = (name, c, extra) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + name + (c ? '' : ' ' + JSON.stringify(extra))); };

  let r = await page.evaluate(() => {
    const WM = CH.WorldMap;
    const seq = [];
    for (let n = 1; n <= WM.LAST; n++) { const a = WM.area(n); if (!a.boss && (!seq.length || seq[seq.length - 1][0] !== a.biome)) seq.push([a.biome, 0]); if (!a.boss) seq[seq.length - 1][1]++; }
    return { last: WM.LAST, bosses: WM.BOSSES, seq, d1: WM.depth(1), d49: WM.depth(49), office: WM.areas.some((a) => a && (a.biome === 'office' || a.biome === 'glitch')), hallBiomes: WM.BOSSES.map((n) => WM.area(n).biome) };
  });
  ok('49 areas, act bosses at 11, 27, 38 and 49', r.last === 49 && r.bosses.join() === '11,27,38,49', r);
  ok('nine biomes in order, five stages each', r.seq.map((s) => s[0]).join() === 'deadwood,catacombs,gaslight,zombie,dungeon,wasteland,frozen,volcano,castle' && r.seq.every((s) => s[1] === 5), r.seq);
  ok('no Corporate Hell or Glitch in the world', !r.office, r);
  ok('the depth climbs from 1 to 10', r.d1 === 1 && Math.abs(r.d49 - 10) < 1e-9, r);
  ok('each boss hall is its act\'s last biome', r.hallBiomes.join() === 'catacombs,dungeon,frozen,castle', r.hallBiomes);

  // a character's world
  r = await page.evaluate(() => {
    const G = CH.G, St = CH.Storage, WM = CH.WorldMap;
    localStorage.removeItem(St.KEY3);
    St.load();
    St.createSlot({ hero: 'Mercenary', name: 'Cartographer' });
    G._scriptTesting = true;
    G.newRun(null);
    const out = { a1: G.level.biome };
    G.startWave(6);
    out.a6 = G.level.biome;
    // monsters of the deepest area are as tough as the old stage 10's
    G.startWave(49 - 1);
    G.wave = 49;
    const deep = G.spawnEnemy('orc', G.player.x + 60, G.player.y, {});
    out.deepHp = deep.maxHp;
    return out;
  });
  const r2 = await page.evaluate(() => {
    const G = CH.G, St = CH.Storage;
    St.useSlot(-1);
    G.newRun(null);
    G.wave = 10;
    return G.spawnEnemy('orc', G.player.x + 60, G.player.y, {}).maxHp;
  });
  ok('area 1 is the Dead Wood, area 6 the Catacombs', r.a1 === 'deadwood' && r.a6 === 'catacombs', r);
  ok('the deepest area\'s monsters match the old stage 10', Math.abs(r.deepHp - r2) <= 1, { world: r.deepHp, old: r2 });

  // the act I boss in its hall
  r = await page.evaluate(() => {
    const G = CH.G, St = CH.Storage;
    St.useSlot(0);
    G.newRun(null);
    if (CH.Town.inTown) CH.Town.leave(); // a character who has been out wakes in the hideout
    G.startWave(11);
    const L = G.level;
    const hall = { hall: !!(L && L.bossHall), biome: L && L.biome, open0: L && L.exit.open };
    for (let i = 0; i < 60; i++) CH.stepFrame(1 / 30);
    const b = G.enemies.find((e) => e.isBoss && !e.dead);
    hall.boss = !!b;
    if (b) G.killEnemy(b);
    for (let i = 0; i < 6; i++) CH.stepFrame(1 / 30);
    hall.open = L.exit.open;
    hall.dread = St.isUnlocked('Dreadbloom');
    hall.hook = CH.Secrets.has('hook');
    G.bossDying = null; G.victoryPending = false;
    G.startWave(12);
    hall.town = CH.Town.inTown && CH.Town.pendingStage === 12;
    CH.Town.leave();
    hall.a12 = G.level.biome;
    return hall;
  });
  ok('the act I boss waits in a hall of the Catacombs', r.hall && r.biome === 'catacombs' && !r.open0 && r.boss, r);
  ok('beating it opens the way, unlocks Dreadbloom and gives the Grave Hook', r.open && r.dread && r.hook, r);
  ok('act II starts from the hideout in the Gaslight District', r.town && r.a12 === 'gaslight', r);
  await page.evaluate(() => { const G = CH.G; G.startWave(11); for (let i = 0; i < 50; i++) CH.stepFrame(1 / 30); G.render(); });
  await page.screenshot({ path: __dirname + '/bosshall.png' });

  ok('no console errors', errs.length === 0, errs.slice(0, 5));
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
