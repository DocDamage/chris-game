/* Sealed secrets and abilities (PLAN.md 18, K8): stages of every act have secret rooms, some behind a seal only a later
   ability opens; the act bosses give the Grave Hook, the Bone Breaker and Frost Step, Jesus the Lantern of Truth after
   the pilgrimage; a seal gives a hint without its ability and opens with it; the world keeps abilities and opened
   seals; the map marks seen seals; the waypoint keeper sends you back. */
const { open } = require('./lib');
(async () => {
  const { browser, page, errs } = await open({ levels: true });
  let fails = 0;
  const ok = (name, c, extra) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + name + (c ? '' : ' ' + JSON.stringify(extra))); };

  // 1. seals across the acts, always an ability you only get later
  let r = await page.evaluate(() => {
    const LATER = { 1: ['hook', 'bone', 'frost', 'lantern'], 2: ['bone', 'frost', 'lantern', 'sigil'], 3: ['frost', 'lantern', 'sigil'] };
    const out = { secrets: 0, gates: 0, wrong: 0, biomes: {} };
    for (const [biome, stage] of [['deadwood', 1], ['deadwood', 2], ['gaslight', 4], ['gaslight', 6], ['frozen', 7], ['frozen', 9]]) for (let s = 1; s <= 4; s++) {
      const L = CH.LevelGen.generate(biome, stage, CH.U.seeded(s * 101 + stage));
      out.secrets += L.secrets.length;
      out.biomes[biome] = (out.biomes[biome] || 0) + L.secrets.length;
      for (const g of L.gates) { out.gates++; if (!LATER[Math.ceil(stage / 3)].includes(g.need) || L.cell(g.crack.x, g.crack.y) !== CH.Level.SEALED) out.wrong++; }
    }
    return out;
  });
  ok('the new biomes have secret rooms', r.biomes.deadwood > 0 && r.biomes.gaslight > 0 && r.biomes.frozen > 0, r);
  ok('some are sealed, always by a later act\'s ability', r.gates >= 5 && r.wrong === 0, r);

  // 2. a seal: a hint without the ability, open with it; the map marks it
  r = await page.evaluate(() => {
    const G = CH.G, St = CH.Storage, T = CH.Level.TS;
    localStorage.removeItem(St.KEY3);
    St.load();
    St.createSlot({ hero: 'Mercenary', name: 'Delver' });
    G._scriptTesting = true;
    G.newRun(null);
    let L = null, s = null;
    for (let k = 1; k < 60 && !s; k++) { const q = CH.LevelGen.generate('deadwood', 2, CH.U.seeded(k * 7)); const g = q.gates.find((x) => x.need === 'bone'); if (g) { L = q; s = g; } }
    G.level = L; G.arena = L; L.stage = 2; L.areaReady = true;
    G.enemies.length = 0;
    const p = G.player;
    const free = [[0, 1], [0, -1], [1, 0], [-1, 0]].find(([dx, dy]) => L.cell(s.crack.x + dx, s.crack.y + dy) === CH.Level.FLOOR);
    p.x = (s.crack.x + free[0] + 0.5) * T; p.y = (s.crack.y + free[1] + 0.5) * T - 10;
    L.explored.fill(1);
    for (let i = 0; i < 4; i++) CH.stepFrame(1 / 30);
    const before = { sealed: L.cell(s.crack.x, s.crack.y) === CH.Level.SEALED, seen: !!s.seen };
    CH.Secrets.grant('bone');
    for (let i = 0; i < 4; i++) CH.stepFrame(1 / 30);
    const after = { open: L.cell(s.crack.x, s.crack.y) === CH.Level.FLOOR, found: s.found };
    CH.Character.save();
    const W = St.slot().world;
    return { before, after, abilities: W.abilities, saved: JSON.parse(localStorage.getItem(St.KEY3)).slots[0].world.abilities };
  });
  ok('without the ability the seal holds and gives a hint', r.before.sealed && r.before.seen, r);
  ok('with it, walking up opens the seal: a secret found', r.after.open && r.after.found, r);
  ok('the world keeps its abilities', r.abilities.includes('bone') && r.saved.includes('bone'), r);

  // 3. the act bosses and Jesus
  r = await page.evaluate(() => {
    const G = CH.G, St = CH.Storage, W = St.slot().world;
    G.startWave(11);
    const b = G.isBossWave(11);
    const e = G.enemies.find((q) => q.isBoss && q.kind === b.kind) || G.spawnEnemy(b.kind, G.player.x + 200, G.player.y, { boss: true });
    G.killEnemy(e);
    const hook = CH.Secrets.has('hook');
    // the Grave Hook makes jumps longer
    const p = G.player;
    p.jumping = false; p.stamina = 100;
    p.startJump(G);
    const vz = p.vz;
    // Jesus: the lantern after the pilgrimage
    G.bossDying = null; G.victoryPending = false;
    G.level = null; CH.Town.inTown = false; CH.Town.enter('test');
    const n = G.level.npcs.find((q) => q.id === 'jesus');
    W.deepest = 3;
    CH.Town.talkTo.jesus(n, p);
    for (let i = 0; i < 6 && !document.querySelector('#dlg-choices .btn'); i++) CH.Dialogue.advance();
    const early = Array.from(document.querySelectorAll('#dlg-choices .btn')).some((x) => /LANTERN/.test(x.textContent));
    for (let i = 0; i < 6 && G.state === 'dialog'; i++) { CH.Dialogue.advance(); const all = document.querySelectorAll('#dlg-choices .btn'); if (all.length) all[all.length - 1].click(); }
    W.deepest = 8;
    CH.Town.talkTo.jesus(n, p);
    for (let i = 0; i < 6 && !document.querySelector('#dlg-choices .btn'); i++) CH.Dialogue.advance();
    const b2 = Array.from(document.querySelectorAll('#dlg-choices .btn')).find((x) => /LANTERN/.test(x.textContent));
    if (b2) b2.click();
    for (let i = 0; i < 6 && G.state === 'dialog'; i++) { CH.Dialogue.advance(); const all = document.querySelectorAll('#dlg-choices .btn'); if (all.length) all[all.length - 1].click(); }
    return { hook, vz, early, lantern: CH.Secrets.has('lantern') };
  });
  ok('the act I boss gives the Grave Hook, and jumps go higher', r.hook && r.vz > 200, r);
  ok('Jesus gives the Lantern of Truth after the pilgrimage, not before', !r.early && r.lantern, r);

  ok('no console errors', errs.length === 0, errs.slice(0, 5));
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
