/* The character's world (PLAN.md 18, K0b): areas are the same on every visit and keep what you changed there (breaches,
   chests, secrets, waypoints); monsters come back thinner; a character who has been out before loads in the hideout,
   whose portal leads back to the last area; beaten bosses are walked past; act bosses unlock heroes; without a
   character play runs as before. */
const { open } = require('./lib');
(async () => {
  const { browser, page, errs } = await open({ levels: true });
  let fails = 0;
  const ok = (name, c, extra) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + name + (c ? '' : ' ' + JSON.stringify(extra))); };

  // 1. a new character starts in the first area of their own world
  let r = await page.evaluate(() => {
    const G = CH.G, St = CH.Storage;
    localStorage.removeItem(St.KEY3);
    St.load();
    St.createSlot({ hero: 'Mercenary', name: 'Wanderer' });
    G._scriptTesting = true;
    G.newRun(null);
    const W = St.slot().world, L = G.level;
    window.__sig = (L) => { let h = 0; for (let i = 0; i < L.cells.length; i++) h = (h * 31 + (L.cells[i] === CH.Level.CRACKED ? CH.Level.FLOOR : L.cells[i])) | 0; return h; };
    window.__first = { sig: __sig(L), packs: L.packs.length, name: L.name, biome: L.biome };
    return { level: !!L && !L.isTown, stage: G.wave, seed: W.seed, runSeed: G.runSeed, at: W.at, deepest: W.deepest };
  });
  ok('a new character starts in area 1, built from their own world seed', r.level && r.stage === 1 && r.seed > 0 && r.runSeed === r.seed && r.at === 1 && r.deepest === 1, r);

  // 2. change the area: a chest, a breach, a secret room, the second waypoint
  r = await page.evaluate(() => {
    const G = CH.G, L = G.level;
    L.chests[0].opened = true;
    const hive = L.spawners[0].enemy;
    G.killEnemy(hive);
    if (L.secrets[0]) { L.secrets[0].found = true; L.set(L.secrets[0].crack.x, L.secrets[0].crack.y, CH.Level.FLOOR); }
    if (L.waypoints[1]) L.waypoints[1].active = true;
    G.pause();
    G.resume();
    const a = CH.Storage.slot().world.areas[1];
    return { closed: a.closed, chests: a.chests, secrets: a.secrets, wps: a.wps, visits: a.visits, secretRoom: !!L.secrets[0], saved: JSON.parse(localStorage.getItem(CH.Storage.KEY3)).slots[0].world.areas[1].chests };
  });
  ok('the area writes what changed into the save', r.closed.join() === '0' && r.chests.join() === '0' && (!r.secretRoom || r.secrets.join() === '0') && r.wps.includes(1) && r.visits === 1 && r.saved.join() === '0', r);

  // 3. quit and load: the hideout; its portal leads back to the same area, as it was left
  r = await page.evaluate(() => {
    const G = CH.G, St = CH.Storage;
    G.toMenu();
    St.load();
    G.newRun(null);
    const hideout = { town: !!(G.level && G.level.isTown), inTown: CH.Town.inTown };
    CH.Town.leave();
    const L = G.level;
    return { hideout, stage: G.wave, town: !!L.isTown, same: __sig(L) === __first.sig && L.name === __first.name, chest: L.chests[0].opened, chest1: L.chests[1] ? L.chests[1].opened : false, breach: L.spawners[0].dead && !G.enemies.some((e) => e.isSpawner && e.hive === L.spawners[0]), hives: L.hives.length, spawners: L.spawners.length, secret: !L.secrets[0] || (L.secrets[0].found && L.cell(L.secrets[0].crack.x, L.secrets[0].crack.y) === CH.Level.FLOOR), wp: !L.waypoints[1] || L.waypoints[1].active, packs: L.packs.length, packs0: __first.packs, visits: St.slot().world.areas[1].visits };
  });
  ok('a character who has been out loads in the hideout', r.hideout.town && r.hideout.inTown, r);
  ok('the hideout portal leads back to the same area', r.stage === 1 && !r.town && r.same, r);
  ok('the area keeps the open chest, the closed breach, the found secret and the lit waypoint', r.chest && !r.chest1 && r.breach && r.hives === r.spawners - 1 && r.secret && r.wp, r);
  ok('the monsters came back thinner', r.packs < r.packs0 && r.visits === 2, r);

  // 4. a beaten boss is walked past; an act boss unlocks the next hero for the whole account
  r = await page.evaluate(() => {
    const G = CH.G, St = CH.Storage, W = St.slot().world;
    St.stats.acts = 0;
    St.data.unlocked = ['Mercenary'];
    G.startWave(3);
    const arena = { wave: G.wave, level: !!G.level };
    const b = G.isBossWave(3);
    const e = G.enemies.find((q) => q.isBoss && q.kind === b.kind) || G.spawnEnemy(b.kind, G.player.x + 200, G.player.y, { boss: true });
    G.killEnemy(e);
    const after = { boss: !!(W.areas[3] && W.areas[3].boss), acts: St.stats.acts, dread: St.isUnlocked('Dreadbloom'), vex: St.isUnlocked('Vexaria') };
    G.bossDying = null;
    G.victoryPending = false;
    G.startWave(4); // the exit: after an act boss the next area starts from the hideout
    const town = { inTown: CH.Town.inTown, pending: CH.Town.pendingStage };
    CH.Town.leave();
    const next = G.wave;
    G.startWave(3); // back to the boss area (a waypoint, a fork)
    return { arena, after, town, next, skipped: G.wave, level: !!G.level, deepest: W.deepest };
  });
  ok('the act I boss fight happens in area 3', r.arena.wave === 3 && !r.arena.level, r);
  ok('beating it marks the area and unlocks Dreadbloom (not Vexaria yet)', r.after.boss && r.after.acts === 1 && r.after.dread && !r.after.vex, r);
  ok('after the act boss the next area starts from the hideout', r.town.inTown && r.town.pending === 4 && r.next === 4, r);
  ok('going back to a beaten boss walks on to the next area', r.skipped === 4 && r.level && r.deepest === 4, r);

  // 4b. the forks are the world's, no path screen; the final boss saves the world and the character plays on
  r = await page.evaluate(() => {
    const G = CH.G, St = CH.Storage, W = St.slot().world;
    const forks = { a: W.path[4], b: W.path[7], chosen: G.chosenPath[4], arena: G.pathArena(5) };
    G.startWave(10);
    const b = G.isBossWave(10);
    const e = G.enemies.find((q) => q.isBoss && q.kind === b.kind) || G.spawnEnemy(b.kind, G.player.x + 200, G.player.y, { boss: true });
    G.killEnemy(e);
    for (let i = 0; i < 80 && G.state !== 'victory'; i++) CH.stepFrame(1 / 30);
    const vic = { state: G.state, title: document.getElementById('vic-title').textContent, hideout: getComputedStyle(document.getElementById('btn-vic-hideout')).display, again: getComputedStyle(document.getElementById('btn-again')).display };
    document.getElementById('btn-vic-hideout').click();
    return { forks, vic, after: { state: G.state, town: !!(G.level && G.level.isTown), at: W.at, slot: !!St.slot() } };
  });
  ok('the forks are fixed by the world (act II the Gaslight District, act III the Frozen Kingdom: PLAN.md 18, K3-K4)', r.forks.a === 'gaslight' && r.forks.b === 'frozen' && r.forks.chosen === r.forks.a && r.forks.arena === r.forks.a, r.forks);
  ok('the final boss saves the world: the character goes back to the hideout', r.vic.state === 'victory' && /WORLD IS SAVED/.test(r.vic.title) && r.vic.hideout !== 'none' && r.vic.again === 'none', r.vic);
  ok('BACK TO THE HIDEOUT plays on in the hideout, the portal leads to area 1', r.after.state === 'playing' && r.after.town && r.after.at === 1 && r.after.slot, r.after);

  // 5. without a character: no world, stage 1 as before
  r = await page.evaluate(() => {
    const G = CH.G, St = CH.Storage;
    G.toMenu();
    St.useSlot(-1);
    G.newRun(null);
    return { stage: G.wave, town: !!(G.level && G.level.isTown), world: !!CH.Areas.world() };
  });
  ok('without a character play starts at stage 1, no hideout, no world', r.stage === 1 && !r.town && !r.world, r);

  ok('no console errors', errs.length === 0, errs.slice(0, 5));
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
