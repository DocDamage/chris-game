const { open } = require('./lib');
(async () => {
  const god = process.argv[2] === 'god';
  const diff = process.argv[3] || 'normal';
  const { browser, page, errs } = await open();
  await page.evaluate((diff) => { CH.Storage.settings.difficulty = diff; CH.G.newRun(); }, diff);
  await page.evaluate((god) => { window.__bot.god = god; }, god);
  if (process.argv[4] === 'human') await page.evaluate(() => { window.__bot.human = { reaction: 14, jitter: 0.09, mistake: 0.12 }; });
  let lastWave = 0, steps = 0;
  const t0 = Date.now();
  while (steps < 60 * 60 * 40) {
    const r = await page.evaluate(() => { const b = window.__bot; b.step(300); return b.snapshot(); });
    steps += 300;
    if (r.wave !== lastWave) { lastWave = r.wave; console.log('WAVE', r.wave, 'start', JSON.stringify(r)); }
    if (r.state === 'gameover' || r.state === 'victory') { console.log('END', JSON.stringify(r)); break; }
  }
  console.log('sim minutes:', (steps / 3600).toFixed(1), 'real s:', ((Date.now() - t0) / 1000).toFixed(1));
  console.log('errors:', errs.length ? errs.join('\n') : 'none', JSON.stringify(await page.evaluate(() => window.CH.errors)));
  console.log('hits', JSON.stringify(await page.evaluate(() => window.__bot.hits))); console.log('bot stats', JSON.stringify(await page.evaluate(() => window.__bot.stats)));
  await browser.close();
})();
