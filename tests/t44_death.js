/* Death of a character (PLAN.md 18, K0c): a character who dies wakes in the hideout with half their gold left at the
   corpse, which they can walk back to; a new death before that leaves the old gold for good; a hardcore character is
   gone (the slot is deleted) and gets the game over screen without RETRY. Without a character: the old game over. */
const { open } = require('./lib');
(async () => {
  const { browser, page, errs } = await open({ levels: true });
  let fails = 0;
  const ok = (name, c, extra) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + name + (c ? '' : ' ' + JSON.stringify(extra))); };
  const die = () => page.evaluate(() => {
    const G = CH.G;
    for (const p of G.players) { p.invuln = 0; p.hp = 1; G.killPlayer(p); }
    for (let i = 0; i < 90 && G.state === 'playing' && G.allDead(); i++) CH.stepFrame(1 / 30);
  });

  // 1. die in area 2 with 200 gold: wake in the hideout, 100 gold at the corpse
  await page.evaluate(() => {
    const G = CH.G, St = CH.Storage;
    localStorage.removeItem(St.KEY3);
    St.load();
    St.createSlot({ hero: 'Mercenary', name: 'Softie' });
    G._scriptTesting = true;
    G.newRun(null);
    G.startWave(2);
    G.coins = 200;
    window.__at = { x: G.player.x, y: G.player.y };
  });
  await die();
  let r = await page.evaluate(() => {
    const G = CH.G, W = CH.Storage.slot().world;
    return { state: G.state, town: !!(G.level && G.level.isTown), alive: G.players.every((p) => !p.dead && p.hp === p.maxHp), coins: G.coins, corpse: W.corpse, at: W.at, slot: !!CH.Storage.slot() };
  });
  ok('a character who dies wakes in the hideout, alive and whole', r.state === 'playing' && r.town && r.alive && r.slot, r);
  ok('half the gold lies at the corpse in the area of death', r.coins === 100 && r.corpse && r.corpse.gold === 100 && r.corpse.area === 2 && r.at === 2, r);

  // 2. the portal leads back; walking over the corpse gives the gold back
  r = await page.evaluate(() => {
    CH.Storage.load(); // the corpse is in the save
    const G = CH.G, W = CH.Storage.slot().world;
    const kept = W.corpse && W.corpse.gold;
    CH.Town.leave();
    const back = { stage: G.wave, town: !!G.level.isTown };
    const c = W.corpse;
    G.player.x = c.x; G.player.y = c.y;
    for (let i = 0; i < 3; i++) CH.stepFrame(1 / 30);
    return { kept, back, coins: G.coins, corpse: W.corpse };
  });
  ok('back in the area, the corpse gives the gold back', r.kept === 100 && r.back.stage === 2 && !r.back.town && r.coins >= 200 && r.corpse === null, r);

  // 3. dying twice: only the last corpse counts
  await page.evaluate(() => { CH.G.coins = 80; });
  await die();
  await page.evaluate(() => { CH.Town.leave(); CH.G.coins = 30; });
  await die();
  r = await page.evaluate(() => ({ corpse: CH.Storage.slot().world.corpse, coins: CH.G.coins }));
  ok('a second death leaves only the newest corpse', r.corpse && r.corpse.gold === 15 && r.coins === 15, r);

  // 4. hardcore: gone for good
  await page.evaluate(() => {
    const G = CH.G, St = CH.Storage;
    G.toMenu();
    St.createSlot({ hero: 'Mercenary', name: 'Brave', hardcore: true });
    G.newRun(null);
  });
  await die();
  r = await page.evaluate(() => {
    const St = CH.Storage;
    return { state: CH.G.state, names: St.slots().map((s) => s.name), active: St.activeIndex(), title: document.getElementById('go-title').textContent, retry: getComputedStyle(document.getElementById('btn-retry')).display, saved: JSON.parse(localStorage.getItem(St.KEY3)).slots.map((s) => s.name) };
  });
  ok('a hardcore character who dies is deleted', r.state === 'gameover' && r.names.join() === 'Softie' && r.saved.join() === 'Softie' && r.active === -1, r);
  ok('the game over screen mourns them and offers no retry', /BRAVE/.test(r.title) && r.retry === 'none', r);

  // 5. without a character: the old game over
  await page.evaluate(() => { CH.G.toMenu(); CH.G.newRun(null); });
  await die();
  r = await page.evaluate(() => ({ state: CH.G.state, title: document.getElementById('go-title').textContent, retry: getComputedStyle(document.getElementById('btn-retry')).display }));
  ok('without a character death is the old game over', r.state === 'gameover' && r.title === 'GAME OVER' && r.retry !== 'none', r);

  ok('no console errors', errs.length === 0, errs.slice(0, 5));
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
