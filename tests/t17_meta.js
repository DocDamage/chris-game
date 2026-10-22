const { open } = require('./lib');
(async () => {
  const { browser, page, errs } = await open();
  const out = await page.evaluate(async () => {
    const G = CH.G, X = CH.X, M = CH.Meta, S = CH.Storage;
    const res = {};
    const god = () => { for (const p of G.players) { p.hp = p.maxHp = 1e6; } };
    res.heroes = CH.Balance.heroes.map((h) => h.id).join(',');
    res.ach = M.ACH.length;
    // new heroes
    for (const id of ['Enchantress', 'Stranger', 'Specter']) {
      S.settings.hero = id;
      X.startRun({}, null); G._scriptTesting = true; G.startWave(2); god();
      const p = G.player; res[id] = { hero: p.hero.id };
      p.specialCd = 0;
      const t0 = X.turrets ? X.turrets.length : 0;
      p.hero.special && p.castEffect(G);
      for (let i = 0; i < 30; i++) G.update(1 / 30);
      res[id].turrets = (X.turrets || []).length - t0;
      res[id].props = id === 'Stranger' ? G.arena.props.filter((q) => /barricade_x/.test(q.id)).length : 0;
      res[id].dead = !!(p.deadeyeT > 0);
    }
    S.settings.hero = CH.Balance.heroes[0].id;
    // heat
    X.startRun({ heat: { brawn: 2, frail: 1, haste: 1, hurt: 1, horde: 1, famine: 1 } }, null);
    G._scriptTesting = true; G.startWave(3); god();
    res.heat = { total: M.heatTotal(), mul: M.scoreMul(), speed: X.extraEnemySpeed, dmg: X.enemyDmgMul };
    const e = G.spawnEnemy('orc', G.player.x + 90, G.player.y, {});
    res.heat.hpRatio = Math.round((e.maxHp / CH.Balance.enemies.orc.hp) * 100) / 100;
    // planning table + rr bonus
    S.data.meta.shp = { planning: 2, kennel: 3, vendor: 1, craft: 1, dummy: 1 };
    X.startRun({}, null);
    res.rr = JSON.stringify(G.player.rr);
    // crafting
    S.resources.wood = 50; S.resources.scrap = 50; S.resources.stone = 50;
    res.craft = M.craft('shield') && M.craft('medkit') && M.craft('nade');
    G._scriptTesting = true;
    X.startRun({}, null);
    res.crafted = { shield: G.player.shield, nades: G.player.nades, maxHp: G.player.maxHp, left: M.data().stock.shield || 0 };
    // vendor + relic
    res.buyRelic = M.buyRelic('ironheart') || (S.resources.scrap = 99, S.resources.stone = 99, M.buyRelic('ironheart'));
    M.toggleRelic('ironheart');
    X.startRun({}, null); res.relicHp = G.player.maxHp;
    // pets
    M.data().pet = 'slime'; S.data.loot = S.data.loot || {};
    S.data.meta.petsOwn = { slime: 1, wisp: 1, drone: 1, ember: 1 };
    for (const pet of ['slime', 'wisp', 'drone', 'ember']) {
      M.data().pet = pet; X.startRun({}, null); G._scriptTesting = true; G.startWave(3); god();
      for (let i = 0; i < 90; i++) G.update(1 / 30);
    }
    res.pets = M.pets.length;
    // run stats
    X.startRun({}, null); G._scriptTesting = true; G.startWave(3); god();
    for (let i = 0; i < 600; i++) { G.player.aim = 0; G.update(1 / 30); god(); }
    res.rs = { dmg: Math.round(X.rs.dmg), weapons: Object.keys(X.rs.dmgW).join(','), series: X.rs.series.length, html: M.summaryHTML().length };
    // finish + history + ghost + mastery
    const h0 = M.history().length;
    G.time = 20; G.finishRun(false);
    res.hist = M.history().length - h0;
    res.ghost = Object.keys(M.data().ghost).join(',');
    res.mastery = M.data().mastery[G.player.hero.id] > 0;
    // daily + board
    const d = M.dailySetup('2030-01-01'); const d2 = M.dailySetup('2030-01-01');
    res.dailySame = JSON.stringify(d) === JSON.stringify(d2);
    X.startRun(M.dailySetup('2030-01-02'), null); G._scriptTesting = true;
    res.dailyHero = G.player.hero.id + '/' + X.run.mode;
    G.startWave(2); god(); G.time = 10; G.finishRun(true);
    res.board = M.board('d:2030-01-02').length;
    // achievements
    res.achDone = M.achDone();
    // challenges
    X.startRun({ challenge: 'oneweapon' }, null); G.player.addWeapon('pizza'); res.oneWeapon = G.player.weapons.length;
    X.startRun({ challenge: 'nododge' }, null); G._scriptTesting = true; G.startWave(2); god();
    G.player.startRoll(G, { x: 1, y: 0 }, true); res.noDodge = !G.player.rolling;
    X.startRun({ challenge: 'events20' }, null); res.ev20 = CH.Events.nextGap(G, true);
    X.startRun({ challenge: 'bighead' }, null); G._scriptTesting = true; G.startWave(2); G.update(1 / 30); res.bigHead = !!G.mods.bigHead;
    // training
    X.startRun({ mode: 'training' }, null); G._scriptTesting = true;
    for (let i = 0; i < 400; i++) { G.player.aim = 0; G.update(1 / 30); god(); }
    res.train = { dummy: !!(M.train.dummy && !M.train.dummy.dead), weapons: G.player.weapons.length, state: G.state, wave: G.wave, hp: G.player.hp > 1000 };
    // trophies
    res.sets = M.setThemes().length + '/' + M.setsDone().length;
    // UI
    CH.UI.showMenu();
    document.getElementById('btn-extras').click();
    res.extrasOpen = CH.UI.active === 'extras';
    res.tabs = {};
    for (const t of ['play', 'hist', 'ach', 'hero', 'safe', 'sets', 'bestiary', 'opts']) {
      M.ui.tab = t; M.ui.render();
      res.tabs[t] = document.getElementById('xt-body').innerHTML.length;
    }
    M.ui.tab = 'play'; M.ui.render();
    document.querySelector('#xt-body [data-act=mode][data-v=short]').click();
    document.querySelector('#xt-body [data-act="heat+"][data-v=brawn]').click();
    res.ui = { mode: M.ui.mode, heat: M.ui.heat.brawn };
    document.querySelector('#xt-body [data-act=start]').click();
    res.started = G.state === 'playing' && X.run.mode === 'short' && X.run.heat.brawn === 1;
    G._scriptTesting = true;
    G.time = 10; G.finishRun(false); G.state = 'gameover'; CH.UI.show('gameover');
    document.getElementById('btn-sum-go').click();
    res.summary = CH.UI.active === 'summary' && document.getElementById('sum-body').innerHTML.length > 100;
    return res;
  });
  console.log(JSON.stringify(out, null, 1));
  console.log('errors:', errs.length ? errs : 'none');
  await browser.close();
})();
