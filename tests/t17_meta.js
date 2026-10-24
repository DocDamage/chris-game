/* Meta progression without runs (PLAN.md 18, K0d): the new heroes, crafting, relics, pets, play stats, mastery,
   achievements and the Extras tabs; the run setups (Heat, daily, challenges, training, history, ghosts, the summary) are
   gone. */
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
    res.rs = { dmg: Math.round(X.rs.dmg), weapons: Object.keys(X.rs.dmgW).join(','), series: X.rs.series.length };
    // the end of play feeds mastery
    G.time = 20; G.finishRun(false);
    res.mastery = M.data().mastery[G.player.hero.id] > 0;
    // achievements
    res.achDone = M.achDone();
    // the run setups are gone
    res.gone = [M.PACTS, M.CHALLENGES, M.dailySetup, M.train, M.summaryHTML, M.history, M.board, X.MODES].every((v) => v === undefined);
    // trophies
    res.sets = M.setThemes().length + '/' + M.setsDone().length;
    // UI
    CH.UI.showMenu();
    document.getElementById('btn-extras').click();
    res.extrasOpen = CH.Journal.open;
    res.tabs = {};
    for (const t of ['ach', 'hero', 'safe', 'sets', 'bestiary', 'opts']) {
      M.ui.tab = t; M.ui.render();
      res.tabs[t] = document.getElementById('xt-body').innerHTML.length;
    }
    res.tabBtns = document.querySelectorAll('#xt-tabs [data-act=tab]').length;
    // the companion is picked in SAFEHOUSE+ (the kennel is built above)
    M.ui.tab = 'safe'; M.ui.render();
    const wisp = document.querySelector('#xt-body [data-act=pet][data-v=wisp]');
    if (wisp) wisp.click();
    res.pet = M.data().pet;
    res.noSummary = !document.getElementById('btn-sum-go') && !document.getElementById('screen-summary');
    return res;
  });
  console.log(JSON.stringify(out, null, 1));
  console.log('errors:', errs.length ? errs : 'none');
  const ok = out.heroes.split(',').length === 6 && out.ach >= 20 && out.craft && out.crafted.shield > 0 && out.buyRelic && out.relicHp > 0 && out.pets >= 1 && out.rs.dmg > 0 && out.rs.series > 0 && out.mastery && out.gone &&
    Object.values(out.tabs).every((n) => n > 100) && out.tabBtns === 6 && out.pet === 'wisp' && out.noSummary && !errs.length;
  console.log(ok ? 'ALL PASSED' : 'FAILED');
  await browser.close();
  process.exitCode = ok ? 0 : 1;
})();
