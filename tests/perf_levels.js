// Performance on the largest stage: 4 players + 4 sidekicks + ~95 enemies, Effects High (WebGL shader pass) and Off.
const { open } = require('./lib');
(async () => {
  const { browser, page, errs } = await open({ viewport: { width: 1920, height: 1080 }, levels: true, sidekicks: true, fx: 'high' });
  const r = await page.evaluate(() => {
    const G = CH.G, X = CH.X, S = CH.Storage;
    const heroes = ['Mercenary', 'Dreadbloom', 'Vexaria', 'Enchantress'];
    S.data.unlocked = CH.Balance.heroes.map((h) => h.id);
    X.startRun({}, { players: heroes.map((h) => ({ hero: h, src: { kind: 'auto' } })) });
    G._scriptTesting = true;
    for (const p of G.players) p.hp = p.maxHp = 1e7;
    G.pathArena = () => 'dungeon'; G.startWave(9); // a large dungeon stage
    const L = G.level;
    window.__bot.god = true; window.__bot.human = { reaction: 14, jitter: 0.09, mistake: 0.1 };
    const types = CH.LevelGen.MOBS.dungeon;
    const out = { level: L.tw + 'x' + L.th, players: G.players.length, sidekicks: CH.SK.list.length };
    for (const fx of ['high', 'off']) {
      CH.Storage.settings.fx = fx; CH.PostFX.apply();
      const fill = () => { while (G.enemies.filter((e) => !e.dead && !e.isSpawner).length < 95) { const q = L.randomNear(G.player.x, G.player.y, 120, 420, 14); if (!q) break; G.spawnEnemy(types[Math.floor(Math.random() * types.length)], q.x, q.y, { spawnTime: 0 }); } };
      fill(); window.__bot.step(120);
      let tu = 0, tr = 0, n = 240;
      for (let i = 0; i < n; i++) {
        window.__bot.think();
        const t0 = performance.now(); G.update(1 / 60); const t1 = performance.now(); G.render(); CH.UI.updateHUD(); const t2 = performance.now();
        tu += t1 - t0; tr += t2 - t1;
        CH.Input.endFrame();
        if (i % 20 === 0) fill();
        if (G.state === 'levelup') while (G.state === 'levelup') G.pickUpgrade(0);
      }
      out[fx] = { update_ms: +(tu / n).toFixed(2), render_ms: +(tr / n).toFixed(2), total_ms: +((tu + tr) / n).toFixed(2), enemies: G.enemies.length, sidekicks: CH.SK.list.length };
    }
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  console.log(errs.join('\n') || 'no console errors');
  await browser.close();
})();
