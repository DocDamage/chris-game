const { open } = require('./lib');
(async () => {
  const { browser, page, errs } = await open();
  const out = await page.evaluate(() => {
    const G = CH.G, X = CH.X, Ev = CH.Events;
    const res = {};
    const god = () => { for (const p of G.players) { p.hp = p.maxHp = 1e6; } };
    // modes
    X.startRun({ mode: 'short' }, null);
    res.short = [1, 2, 3, 4, 5].map((w) => (G.isBossWave(w) || {}).kind || '-').join(',');
    X.startRun({ mode: 'marathon' }, null);
    res.marathon = [3, 5, 8, 10, 12, 15].map((w) => (G.isBossWave(w) || {}).kind).join(',');
    X.startRun({ mode: 'rush' }, null);
    res.rush = [1, 2, 3, 4, 5, 6, 7, 8].map((w) => (G.isBossWave(w) || {}).kind).join(',');
    res.rushQueue = G.queue.length;
    X.startRun({}, null);
    G.chosenPath[4] = 'office';
    const b5a = G.isBossWave(5).kind; G.chosenPath[4] = 'wasteland'; const b5b = G.isBossWave(5).kind;
    res.bossChoice = b5a + '/' + b5b;
    res.previewIdx = G.isBossWave(5, 0).kind + '/' + G.isBossWave(5, 1).kind;
    // wave modifiers
    G._scriptTesting = true;
    res.mods = {};
    for (const id of Object.keys(X.WAVE_MODS)) {
      X.startRun({ forceMod: id }, null);
      G.startWave(4); god();
      res.mods[id] = { mod: X.F.mod && X.F.mod.id };
      for (let i = 0; i < 3200 && G.state === 'playing'; i++) { G.update(1 / 30); god(); if (X.F.mod && X.F.mod.done) break; if (G.waveState === 'clear') break; }
      res.mods[id].done = !!(X.F.mod && X.F.mod.done) || G.waveState === 'clear';
    }
    // affixes + mini
    X.startRun({}, null); G._scriptTesting = true; G.startWave(4); god();
    G.enemies.length = 0;
    for (let i = 0; i < 30; i++) G.spawnEnemy('orc', G.player.x + 80, G.player.y + 20, { elite: true });
    res.affixed = G.enemies.filter((e) => e.affix).length;
    const kinds = new Set(G.enemies.map((e) => e.affix));
    for (const e of G.enemies.slice()) { G.damageEnemy(e, 1e6, { shooter: G.player }); }
    for (let i = 0; i < 120; i++) G.update(1 / 30);
    res.affKinds = Array.from(kinds).join(',');
    X.F.miniPlan = true; G.waveState = 'combat'; X.F.combatT = 10; G.update(1 / 30);
    res.mini = !!(X.F.mini && X.F.mini.mname);
    // shop
    G._scriptTesting = false;
    G.state = 'playing'; god(); G.coins = 500; X.W.openShop();
    res.shopOpen = G.state === 'branch' && CH.UI.active === 'shop';
    const c0 = G.coins; X.W.buy(0); res.shopBuy = G.coins < c0;
    X.W.closeShop(); res.shopClosed = G.state === 'playing' || G.state === 'levelup';
    if (G.state === 'levelup') G.pickUpgrade(0);
    // orbs
    G.state = 'playing'; G.wave = 5; G.waveState = 'combat'; G.event = null; god();
    Ev.start(G);
    res.orbs = !!X.W.orbs;
    if (X.W.orbs) { G.player.x = X.W.orbs.list[0].x; G.player.y = X.W.orbs.list[0].y; G.update(1 / 30); }
    res.orbChosen = !X.W.orbs && !!G.event;
    // events
    res.events = {};
    for (const id of ['goldrush', 'powerhour', 'medic', 'everychicken', 'bullethell', 'gravflip']) {
      G.state = 'playing'; G.waveState = 'combat'; G.event = null; god(); G.wave = 6;
      Ev.start(G, Ev.byId[id]);
      for (let i = 0; i < 200; i++) { G.update(1 / 30); god(); }
      res.events[id] = !!G.event;
      Ev.end(G, false);
    }
    // boss parts, affixes, no-hit
    X.startRun({}, null); G._scriptTesting = true; G.startWave(3); god();
    G.enemies.length = 0; G.queue.length = 0;
    const bs = G.spawnBoss('skull', 2); X.W.bossHit = false;
    res.bossAff = (bs.affixes || []).join('+');
    for (let i = 0; i < 20; i++) G.update(1 / 30);
    for (let i = 0; i < 400 && (bs.state === 'spawn' || bs.immune); i++) { G.update(1 / 30); god(); }
    res.bossState = bs.state + ' hp ' + bs.hp + '/' + bs.maxHp;
    G.damageEnemy(bs, bs.maxHp * 0.4, { shooter: G.player });
    G.damageEnemy(bs, bs.maxHp * 0.3, { shooter: G.player });
    res.partsLeft = bs.partsLeft;
    // no hit trophy at tier 0
    G.enemies.length = 0;
    const b0 = G.spawnBoss('frog', 0); X.W.bossHit = false;
    for (let i = 0; i < 400 && (b0.state === 'spawn' || b0.immune); i++) { G.update(1 / 30); god(); }
    G.damageEnemy(b0, 1e7, { shooter: G.player });
    for (let i = 0; i < 300; i++) { G.update(1 / 30); god(); }
    res.noHit = !!(X.meta().noHit && X.meta().noHit.frog);
    res.state = G.state;
    return res;
  });
  console.log(JSON.stringify(out, null, 1));
  console.log('errors:', errs.length ? errs.join('\n') : 'none');
  await browser.close();
})();


