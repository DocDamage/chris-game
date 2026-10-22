const { open } = require('./lib');
(async () => {
  const { browser, page, errs } = await open();
  const out = await page.evaluate(() => {
    const G = CH.G, X = CH.X, W = CH.Weapons, B = CH.Balance;
    const res = {};
    G.newRun(); const p = G.player; G.state = 'playing';
    // perfect dodge
    G.spawnProjectile({ owner: 'e', kind: 'x', x: p.x, y: p.y, ang: 0, speed: 0, r: 4, dmg: 1, life: 2 });
    p.rolling = true; p.rollT = 0.3; p.invuln = 1;
    G.step(1 / 60);
    res.perfectDodge = p._pd === true && p.pdCrit === 3;
    // slow-mo drives update
    const t0 = G.time; G.update(1 / 60); res.slowTimeScaled = (G.time - t0) < 1 / 60 * 0.6;
    // status
    p.rolling = false; p.invuln = 0; p.rollGrace = 0;
    G.hurtPlayer(1, { x: p.x + 5, y: p.y, sprite: 'vfx.p5.23', kind: 'ice' }, { p }); G.hurtPlayer(1, { x: p.x + 5, y: p.y, fx: 'toxic' }, { p: Object.assign(p, { invuln: 0 }) });
    res.rooted = p.rootT > 0; res.poisoned = p.poisonT > 0;
    p.hp = 10; res.healBlocked = G.healPlayer(20, p) === 0;
    X.cleanse(p); res.cleansed = p.poisonT === 0 && p.rootT === 0;
    // reactions
    G.enemies.length = 0;
    const e = G.spawnEnemy('orc', p.x + 50, p.y); const en = G.enemies[0]; en.hp = 9999; en.maxHp = 9999; en.state = 'chase';
    G.damageEnemy(en, 5, { elem: 'ice', shooter: p });
    const h0 = en.hp; G.damageEnemy(en, 20, { elem: 'earth', shooter: p });
    res.shatter = (h0 - en.hp) > 25;
    // env kill
    const e2 = G.spawnEnemy('slime', p.x + 80, p.y); const en2 = G.enemies[G.enemies.length - 1]; en2.state = 'chase';
    const k0 = X.envKills; G.damageEnemy(en2, 9999, {}); res.envKill = X.envKills === k0 + 1;
    // active reload
    p.addWeapon('chair'); p.selectWeapon('chair');
    p.ws.chair.ammo = 0; W.startReload(p, 'chair');
    p.ws.chair.reload = p.ar.total * 0.5; // mid-window
    W.startReload(p, 'chair'); res.activeReload = p.ws.chair.reload < 0.01 && p.arT > 0;
    // run some frames of play
    for (let i = 0; i < 300; i++) G.update(1 / 60);
    res.alive = G.state;
    return res;
  });
  console.log(JSON.stringify(out, null, 1));
  console.log('errors:', errs.length ? errs.join('\n') : 'none', JSON.stringify(await page.evaluate(() => window.CH.errors)));
  await browser.close();
})();

