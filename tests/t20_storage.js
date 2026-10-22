/* Storage v2: versioned saves, migration of a v1 save, loot survives a reload. */
const { open } = require('./lib');
(async () => {
  const { browser, page, errs } = await open();
  const out = await page.evaluate(() => {
    const S = CH.Storage, r = {};
    const v1 = { settings: { hero: 'Mercenary', master: 0.3 }, stats: { highestWave: 7, totalKills: 123 }, resources: { wood: 5 }, loot: { 12: 3, 400: 9 }, seen: { 12: true }, unlocked: ['Mercenary', 'Vexaria'], meta: { x: 1 } };
    const d = S.sanitize(JSON.parse(JSON.stringify(v1)));
    r.version = d.version;
    r.kept = d.settings.master === 0.3 && d.stats.highestWave === 7 && d.stats.totalKills === 123 && d.resources.wood === 5 && d.meta.x === 1;
    r.unlocked = d.unlocked.join(',');
    r.loot = d.loot[12] === 3 && d.loot[400] === undefined;
    r.garbage = S.sanitize('nope').version === S.VERSION && S.sanitize(null).version === S.VERSION;
    r.future = S.sanitize({ version: 99 }).version === S.VERSION;
    S.data.loot = {}; S.addLoot(5, 2); S.load();
    r.reload = S.data.loot[5] === 2;
    S.reset();
    return r;
  });
  console.log(JSON.stringify(out));
  const ok = out.version === 2 && out.kept && out.loot && out.garbage && out.future && out.reload && out.unlocked === 'Mercenary,Vexaria' && !errs.length;
  console.log('errors', errs);
  console.log(ok ? 'ALL PASSED' : 'FAILED');
  await browser.close();
  process.exit(ok ? 0 : 1);
})();
