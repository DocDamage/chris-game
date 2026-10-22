const { open } = require('./lib');
(async () => {
  const { browser, page, errs } = await open();
  const out = await page.evaluate(async () => {
    const G = CH.G, X = CH.X, S = CH.Storage;
    const res = {};
    const heroes = CH.Balance.heroes.map((h) => h.id);
    const cfg = (n) => ({ players: Array.from({ length: n }, (_, i) => ({ hero: heroes[i % heroes.length], src: { kind: 'script' } })) });
    for (const n of [3, 4]) {
      X.startRun({}, cfg(n));
      G._scriptTesting = true;
      G.startWave(2);
      const r = (res['n' + n] = { players: G.players.length, huds: CH.UI.huds.length, coopCount: CH.Balance.coop.count });
      for (const p of G.players) p.hp = p.maxHp = 1e6;
      G.players.forEach((p, i) => { p.x = 300 + i * 900; p.y = 400; });
      for (let i = 0; i < 20; i++) G.update(1 / 30);
      r.split = !!G.groups;
      r.views = G.buildViews ? G.buildViews().length : -1;
      G.players.forEach((p, i) => { p.x = 600 + i * 20; });
      for (let i = 0; i < 90; i++) G.update(1 / 30);
      r.merged = !G.groups;
      G.luQueue = G.players.slice();
      r.lu = G.luQueue.length;
    }
    // crawl
    X.startRun({}, cfg(3));
    G._scriptTesting = true; G.startWave(2);
    const p = G.players[1];
    p.hp = 0; G.killPlayer(p);
    r_state: {
      res.crawl = { dead: p.dead, alive: !G.allDead() };
      const x0 = p.x, pr0 = G.projectiles.length;
      p.inp.mx = 1; p.inp.fire1 = true;
      for (let i = 0; i < 30; i++) G.update(1 / 30);
      res.crawl.moved = Math.round(p.x - x0);
      res.crawl.shot = G.projectiles.some((q) => q.owner === 'p' && q.shooter === p) || G.projectiles.length > pr0;
    }
    // boss parts
    X.startRun({}, null); G._scriptTesting = true; G.startWave(2);
    G.spawnBoss('skull', 0);
    for (let i = 0; i < 40; i++) G.update(1 / 30);
    const b = G.enemies.find((e) => e.isBoss);
    res.boss = { has: !!b, parts: b && b.parts ? b.parts.length : 0 };
    if (b && b.parts) {
      G.players[0].hp = G.players[0].maxHp = 1e6;
      const pt = b.parts[0];
      for (let i = 0; i < 40 && !pt.dead; i++) {
        G.spawnProjectile({ owner: 'p', shooter: G.player, kind: 'junk', x: pt.x, y: pt.y, ang: 0, speed: 0, r: 3, dmg: b.maxHp * 0.05, life: 1, sprite: 'junk1' });
        G.update(1 / 30);
        G.players[0].hp = 1e6;
      }
      res.boss.broke = pt.dead;
    }
    // hero sprites
    res.sprites = ['Wrangler', 'Foreman', 'Gunslinger'].map((id) => CH.Sprites.has('hero.' + id)).join(',');
    res.art = CH.Art.on;
    return res;
  });
  console.log(JSON.stringify(out, null, 1));
  console.log('ERRS', errs.length, errs.slice(0, 5));
  await browser.close();
})();
