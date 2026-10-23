const { open } = require('./lib');
(async () => {
  const { browser, page, errs } = await open({ viewport: { width: 1280, height: 720 } });
  await page.evaluate(() => { CH.G.newRun(); window.__bot.god = true; window.__bot.human = { reaction: 14, jitter: 0.09, mistake: 0.1 }; CH.G.wave = 4; CH.G.queue.length = 0; CH.G._scriptTesting = true; });
  const ids = await page.evaluate(() => CH.Events.list.map((e) => e.id));
  console.log('events:', ids.join(', '));
  for (const id of ids) {
    // fresh combat state with some enemies around
    await page.evaluate((id) => {
      const G = CH.G;
      G.enemies.length = 0; G.projectiles.length = 0; G.zones.length = 0; G.event = null;
      G.waveState = 'combat'; G.waveT = 1e9; G.spawnT = 1e9; G.queue.length = 0;
      for (let i = 0; i < 6; i++) G.spawnEnemy(['chicken', 'potato', 'office'][i % 3], G.player.x + 140 + i * 20, G.player.y + (i % 2 ? 60 : -60), { spawnTime: 0 });
      CH.Events.start(G, CH.Events.byId[id]);
    }, id);
    // run until effect is active, sample mods + a screenshot mid event
    const def = await page.evaluate((id) => ({ dur: CH.Events.byId[id].duration, warn: CH.Events.byId[id].warn || 0 }), id);
    await page.evaluate((n) => window.__bot.step(n), Math.round((def.warn + 4) * 60));
    const mid = await page.evaluate(() => { const G = CH.G; return { active: !!(G.event && G.event.active), mods: JSON.stringify(G.mods), zones: G.zones.length, ents: G.enemies.length, state: G.state }; });
    if (['disco', 'lava', 'bighead', 'tiny', 'chickenrain', 'reverse'].includes(id)) await page.screenshot({ path: `${__dirname}/ev_${id}.png` });
    // finish the event
    await page.evaluate((n) => window.__bot.step(n), Math.round((def.dur + 1) * 60));
    const end = await page.evaluate(() => { const G = CH.G; return { ev: !!G.event, mods: JSON.stringify(G.mods), state: G.state, hp: Math.round(G.player.hp) }; });
    const clean = JSON.parse(end.mods);
    const defaults = { enemySpeed: 1, enemyScale: 1, kbMul: 1, bigHead: false, reverse: false, lowGrav: false, explosiveDeaths: false, disco: false, scoreMul: 1 };
    const bad = Object.keys(defaults).filter((k) => clean[k] !== defaults[k]);
    console.log((mid.active && !end.ev && bad.length === 0 ? 'PASS' : 'FAIL'), id.padEnd(12), 'active-mid=' + mid.active, 'ended=' + !end.ev, 'mods-restored=' + (bad.length === 0 ? 'yes' : 'NO ' + bad), '| mid mods:', mid.mods.replace(/"discoBeat":\d,?/, ''));
  }
  // timer-driven scheduling: events fire 60-90s apart during combat
  const sched = await page.evaluate(() => {
    const G = CH.G; G.enemies.length = 0; G.event = null; G.waveState = 'combat'; G.waveT = 1e9; G.spawnT = 1e9;
    CH.Storage.settings.difficulty = 'normal'; G.diff = CH.Balance.difficulty.normal;
    const gaps = [];
    for (let i = 0; i < 6; i++) { G.eventTimer = CH.Events.nextGap(G, false); gaps.push(Math.round(G.eventTimer)); }
    G.diff = CH.Balance.difficulty.chaotic; const cg = []; for (let i = 0; i < 6; i++) cg.push(Math.round(CH.Events.nextGap(G, false)));
    return { normalGaps: gaps, chaoticGaps: cg };
  });
  console.log('gap samples', JSON.stringify(sched));
  console.log('console errors:', errs.length ? errs.join('\n') : 'none', JSON.stringify(await page.evaluate(() => CH.errors)));
  await browser.close();
})();

