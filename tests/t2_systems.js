const { open } = require('./lib');
(async () => {
  const { browser, page, errs } = await open();
  const out = (t, o) => console.log(t.padEnd(14), typeof o === 'string' ? o : JSON.stringify(o));

  // ------------------------------------------------ WEAPONS
  console.log('=== WEAPONS: one shot at a stationary dummy, count damage calls (no unintended multi-hit)');
  for (const id of ['junk', 'chicken', 'pizza', 'baguette', 'chair', 'problem']) {
    const r = await page.evaluate((id) => {
      const CH = window.CH, G = CH.G;
      G.newRun();
      G.queue.length = 0; G.enemies.length = 0;
      const p = G.player;
      p.weapons = [id]; p.weapon = id; p.ws = { [id]: CH.Weapons.newState(id) };
      p.stats.critChance = 0;
      const dist = id === 'baguette' ? 25 : 90;
      p.x = 400; p.y = 300;
      const e = G.spawnEnemy('trashcan', p.x + dist, p.y, { spawnTime: 0 }); e.x = p.x + dist; e.y = p.y;
      e.maxHp = e.hp = 1e6; e.speed = 0; e.state = 'idle'; e.t = 1e9; e.atkCd = 1e9;
      G.waveState = 'combat'; G.waveT = 1e9; G.spawnT = 1e9;
      const calls = [];
      const orig = G.damageEnemy;
      G.damageEnemy = function (en, d, o) { const r = orig.call(G, en, d, o); calls.push(Math.round(r)); return r; };
      const I = CH.Input;
      // fire exactly one shot: press for 1 frame
      const shots = [];
      let results = {};
      for (let trial = 0; trial < 8; trial++) {
        calls.length = 0;
        p.ws[id].cd = 0; p.ws[id].ammo = CH.Balance.weapons[id].ammo;
        G.mods.explosiveDeaths = false;
        I.mouse.x = e.x - G.cam.x; I.mouse.y = e.y - G.cam.y; I.mouse.inside = true;
        I.mouse.down = true;
        G.update(1 / 60);
        I.mouse.down = false;
        for (let i = 0; i < 120; i++) { G.update(1 / 60); I.endFrame(); }
        shots.push(calls.slice());
      }
      return { shots, hpLost: 1e6 - e.hp, proj: G.projectiles.length, err: CH.errors };
    }, id);
    const counts = r.shots.map(s => s.length);
    out(id, { callsPerShot: counts.join(','), sample: r.shots.slice(0, 4).map(s => s.join('+')).join(' | '), totalDmg: r.hpLost, leftoverProj: r.proj });
  }

  // ------------------------------------------------ ENEMIES
  console.log('\n=== ENEMIES: each alone vs a standing, very tanky player for 14s');
  for (const type of ['chicken', 'potato', 'trashcan', 'office', 'toaster', 'influencer', 'cart', 'pigeon', 'fridge', 'intern']) {
    const r = await page.evaluate((type) => {
      const CH = window.CH, G = CH.G;
      G.newRun();
      G.queue.length = 0; G.enemies.length = 0;
      const p = G.player;
      p.maxHp = p.hp = 1e6;
      p.x = 480; p.y = 270;
      G.waveState = 'combat'; G.waveT = 1e9; G.spawnT = 1e9; G.wave = 6;
      const e = G.spawnEnemy(type, 480 + 170, 270, { spawnTime: 0.1 });
      CH.Input.mouse.down = false;
      const states = new Set();
      const hurt = {};
      const orig = G.hurtPlayer;
      G.hurtPlayer = function (d, s, o) { p.invuln = 0; const r = orig.call(G, d, s, o); if (r > 0) { const k = (s && (s.type || s.kind)) || 'zone'; hurt[k] = (hurt[k] || 0) + 1; } p.hp = 1e6; return r; };
      let zones = 0, projs = 0, tele = new Set();
      for (let i = 0; i < 14 * 60; i++) {
        G.update(1 / 60); CH.Input.endFrame();
        if (i % 5 === 0) G.render();
        states.add(e.state);
        if (e.tele) tele.add(e.tele.kind);
        zones = Math.max(zones, G.zones.length);
        projs = Math.max(projs, G.projectiles.length);
        if (e.dead) break;
      }
      return { states: [...states].join('/'), hurt, zones, maxProj: projs, tele: [...tele].join('/'), alive: !e.dead, errors: CH.errors.length };
    }, type);
    out(type, r);
  }

  console.log('\nconsole errors:', errs.length ? errs.join('\n') : 'none');
  console.log('game errors:', JSON.stringify(await page.evaluate(() => window.CH.errors)));
  await browser.close();
})();
