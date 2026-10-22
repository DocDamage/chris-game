const { open } = require('./lib');
(async () => {
  const { browser, page, errs } = await open({ viewport: { width: 1920, height: 1080 } });
  const r = await page.evaluate(() => {
    const G = CH.G; G.newRun(); window.__bot.god = true; window.__bot.human = { reaction: 14, jitter: 0.09, mistake: 0.1 };
    G.wave = 9; G.queue.length = 0; G.waveState = 'combat'; G.waveT = 1e9;
    const types = ['chicken', 'potato', 'office', 'toaster', 'intern', 'pigeon', 'cart', 'influencer', 'trashcan', 'fridge'];
    const out = {};
    for (const [label, count] of [['40 enemies', 40], ['90 enemies', 90]]) {
      G.enemies.length = 0;
      for (let i = 0; i < count; i++) G.spawnEnemy(types[i % types.length], G.player.x + CH.U.rand(-300, 300), G.player.y + CH.U.rand(-200, 200), { spawnTime: 0 });
      window.__bot.step(120);
      let tu = 0, tr = 0, n = 300;
      for (let i = 0; i < n; i++) {
        window.__bot.think();
        let t0 = performance.now(); G.update(1 / 60); let t1 = performance.now(); G.render(); CH.UI.updateHUD(); let t2 = performance.now();
        tu += t1 - t0; tr += t2 - t1;
        CH.Input.endFrame();
        if (G.enemies.length < count * 0.7) for (let k = 0; k < 8; k++) G.spawnEnemy(types[k], G.player.x + CH.U.rand(-300, 300), G.player.y + CH.U.rand(-200, 200), { spawnTime: 0 });
      }
      out[label] = { update_ms: +(tu / n).toFixed(2), render_ms: +(tr / n).toFixed(2), enemies: G.enemies.length, particles: CH.FX.parts.length, proj: G.projectiles.length };
    }
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  console.log(errs.join('\n') || 'no console errors', JSON.stringify(await page.evaluate(() => CH.errors)));
  await browser.close();
})();
