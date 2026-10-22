const { open } = require('./lib');
// usage: node batch.js <difficulty> <runs> <profile>
(async () => {
  const diff = process.argv[2] || 'normal', runs = +process.argv[3] || 5, prof = process.argv[4] || 'human';
  const profiles = { perfect: null, human: { reaction: 14, jitter: 0.09, mistake: 0.12 }, sloppy: { reaction: 24, jitter: 0.16, mistake: 0.25 } };
  const { browser, page, errs } = await open();
  const res = [];
  for (let r = 0; r < runs; r++) {
    await page.evaluate(([diff, h]) => { CH.Storage.settings.difficulty = diff; window.__bot.human = h; window.__bot.hits = { total: 0, byWave: {}, bySrc: {}, minHp: 1e9 }; CH.G.newRun(); }, [diff, profiles[prof]]);
    let steps = 0, snap;
    while (steps < 60 * 60 * 25) {
      snap = await page.evaluate(() => { window.__bot.step(600); return window.__bot.snapshot(); });
      steps += 600;
      if (snap.state === 'gameover' || snap.state === 'victory') break;
    }
    const hits = await page.evaluate(() => window.__bot.hits);
    res.push({ end: snap.state, wave: snap.wave, t: Math.round(snap.t), lvl: snap.lvl, dmgTaken: Math.round(hits.total), kills: snap.kills });
    if (snap.state === 'gameover') {
      const top = Object.entries(hits.bySrc).sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => x[0] + ':' + Math.round(x[1])).join(' ');
      res[res.length - 1].killers = top;
    }
  }
  console.log(diff, prof);
  for (const x of res) console.log(JSON.stringify(x));
  console.log('wins', res.filter(x => x.end === 'victory').length + '/' + runs, 'errors:', errs.length ? errs.join('\n') : 'none', JSON.stringify(await page.evaluate(() => window.CH.errors)));
  await browser.close();
})();
