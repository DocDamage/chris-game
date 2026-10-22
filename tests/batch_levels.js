const { open } = require('./lib');
const { NAV } = require('./navbot');
// usage: node batch_levels.js <difficulty> <runs> <profile> [mode]   (levels + sidekicks, navigation bot)
(async () => {
  const diff = process.argv[2] || 'normal', runs = +process.argv[3] || 3, prof = process.argv[4] || 'human', mode = process.argv[5] || 'short';
  const profiles = { perfect: null, human: { reaction: 14, jitter: 0.09, mistake: 0.12 }, sloppy: { reaction: 24, jitter: 0.16, mistake: 0.25 } };
  const { browser, page, errs } = await open({ levels: true, sidekicks: true });
  await page.evaluate(NAV);
  const res = [];
  for (let r = 0; r < runs; r++) {
    await page.evaluate(([diff, h, mode]) => { CH.Storage.settings.difficulty = diff; window.__bot.human = h; window.__bot.hits = { total: 0, byWave: {}, bySrc: {}, minHp: 1e9 }; CH.X.startRun({ mode }, null); }, [diff, profiles[prof], mode]);
    let steps = 0, snap;
    while (steps < 60 * 60 * 30) {
      snap = await page.evaluate(() => { window.__bot.step(600); return window.__bot.snapshot(); });
      steps += 600;
      if (snap.state === 'gameover' || snap.state === 'victory') break;
    }
    const hits = await page.evaluate(() => window.__bot.hits);
    res.push({ end: snap.state, stage: snap.wave, t: Math.round(snap.t), lvl: snap.lvl, dmgTaken: Math.round(hits.total), kills: snap.kills });
  }
  console.log(diff, prof, mode);
  for (const x of res) console.log(JSON.stringify(x));
  console.log('wins', res.filter((x) => x.end === 'victory').length + '/' + runs, 'errors:', errs.length ? errs.join('\n') : 'none', JSON.stringify(await page.evaluate(() => window.CH.errors)));
  await browser.close();
})();
