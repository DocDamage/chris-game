const { open } = require('./lib');
(async () => {
  const { browser, page, errs } = await open();
  const out = await page.evaluate(() => {
    const G = CH.G, B = CH.Balance, W = CH.Weapons, X = CH.X, Up = CH.Upgrades;
    const res = {};
    for (const id of ['stapler', 'leaf', 'keyboard', 'roomba', 'extinguisher', 'replyall']) {
      G.newRun();
      const p = G.player;
      p.addWeapon(id); p.selectWeapon && p.selectWeapon(p.weapons.indexOf(id));
      G.state = 'playing';
      G.spawnEnemy('slime', p.x + 60, p.y);
      const n0 = G.projectiles.length;
      let ok = true;
      for (let i = 0; i < 90; i++) {
        p.aim = 0; p.ws[id].cd = 0;
        try { W.tryFire(G, p, id); G.step(1 / 60); } catch (e) { ok = e.message; break; }
      }
      p.ws[id].level = 6; p.upgrades[X.EVO[id].up] = 1; Up.recalc(p);
      const c = Up.makeCards(G, p);
      const evo = c.find((q) => q.kind === 'evolve');
      if (evo) Up.applyCard(G, evo, p);
      for (let i = 0; i < 30; i++) { p.ws[id].cd = 0; try { W.tryFire(G, p, id); G.step(1 / 60); } catch (e) { ok = 'evo ' + e.message; break; } }
      res[id] = { ok, evo: !!evo, iconOk: !!W.iconSprite(id) };
    }
    return res;
  });
  console.log(JSON.stringify(out));
  console.log('errors:', errs.length ? errs.join('\n') : 'none', JSON.stringify(await page.evaluate(() => window.CH.errors)));
  await browser.close();
})();
