/* Victory -> Continue to Endless -> keep playing through wave 15 (tiered boss). */
const { open } = require('./lib');
(async () => {
  const { browser, page, errs } = await open({ viewport: { width: 1280, height: 720 } });
  const log = (...a) => console.log(...a);
  await page.evaluate(() => { CH.G.newRun(); window.__bot.god = true; window.__bot.human = { reaction: 14, jitter: 0.09, mistake: 0.1 }; const G = CH.G; G.wave = 10; G.queue.length = 0; G.enemies.length = 0; G.spawnBoss('bug', 0); G.waveState = 'combat'; });
  let snap;
  for (let i = 0; i < 80; i++) { snap = await page.evaluate(() => { window.__bot.step(300); return { s: CH.G.state, won: CH.G.won, ui: CH.UI.active }; }); if (snap.s === 'victory') break; }
  log('final boss defeated -> state:', JSON.stringify(snap));
  const stats = await page.evaluate(() => ({ wins: CH.Storage.stats.wins, runs: CH.Storage.stats.totalRuns, bosses: CH.Storage.stats.bossesDefeated, unlocked: CH.Storage.data.unlocked }));
  log('stats after win:', JSON.stringify(stats));
  await page.screenshot({ path: __dirname + '/e_victory.png' });
  await page.click('#btn-endless');
  await page.waitForTimeout(100);
  log('after Continue:', JSON.stringify(await page.evaluate(() => ({ s: CH.G.state, endless: CH.G.endless, ui: CH.UI.active, wave: CH.G.wave, ws: CH.G.waveState }))));
  const waves = [];
  for (let i = 0; i < 200 && waves.length < 8; i++) {
    const r = await page.evaluate(() => { window.__bot.step(300); const G = CH.G; return { s: G.state, wave: G.wave, arena: G.arena.id, boss: (G.enemies.find((e) => e.isBoss) || {}).kind || null, tier: (G.enemies.find((e) => e.isBoss) || {}).tier }; });
    if (!waves.length || waves[waves.length - 1].wave !== r.wave) waves.push(r);
    if (r.s !== 'playing') break;
    if (r.wave >= 16) break;
  }
  log('endless waves reached:', JSON.stringify(waves));
  const final = await page.evaluate(() => ({ s: CH.G.state, wave: CH.G.wave, victoryShownAgain: CH.G.state === 'victory' }));
  log('final:', JSON.stringify(final));
  // dying in endless records the extra progress without double counting the run
  await page.evaluate(() => { const p = CH.G.player; p.invuln = 0; p.rolling = false; p.rollGrace = 0; window.__bot.god = false; p.hp = 1; CH.G.hurtPlayer(30, null, {}); CH.G.hurtPlayer(30, null, {}); });
  await page.evaluate(() => window.__bot.step(60 * 4));
  log('after endless death:', JSON.stringify(await page.evaluate(() => ({ s: CH.G.state, stats: CH.Storage.stats }))));
  log('errors:', errs.length ? errs.join('\n') : 'none', JSON.stringify(await page.evaluate(() => CH.errors)));
  await browser.close();
})();
