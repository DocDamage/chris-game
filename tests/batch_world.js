const { open } = require('./lib');
const { NAV } = require('./navbot');
// usage: node batch_world.js <difficulty> <runs> <profile> [minutes]
// The navigation bot takes a fresh character through the world (PLAN.md 18, K11): it plays each stage, walks back out
// of the hideout after an act boss or a death, and the report says how far it got, where it died and how long it took.
(async () => {
  const diff = process.argv[2] || 'normal', runs = +process.argv[3] || 2, prof = process.argv[4] || 'human', mins = +process.argv[5] || 40;
  const profiles = { perfect: null, human: { reaction: 14, jitter: 0.09, mistake: 0.12 }, sloppy: { reaction: 24, jitter: 0.16, mistake: 0.25 } };
  const { browser, page, errs } = await open({ levels: true, sidekicks: true, seed: false });
  await page.evaluate(NAV);
  const res = [];
  for (let r = 0; r < runs; r++) {
    await page.evaluate(([diff, h, r]) => {
      const St = CH.Storage;
      localStorage.removeItem(St.KEY3);
      St.load();
      St.settings.difficulty = diff;
      St.createSlot({ hero: 'Mercenary', name: 'Bot' + r });
      window.__bot.human = h;
      window.__bot.hits = { total: 0, byWave: {}, bySrc: {}, minHp: 1e9 };
      window.__deaths = {};
      window.__stageT = {};
      const prev = CH.Areas.onDeath;
      if (!prev.__wrapped) {
        CH.Areas.onDeath = function () { const w = CH.G.wave; window.__deaths[w] = (window.__deaths[w] || 0) + 1; return prev.apply(this, arguments); };
        CH.Areas.onDeath.__wrapped = true;
      }
      CH.G.newRun(null);
    }, [diff, profiles[prof], r]);
    let steps = 0, snap, info;
    while (steps < 60 * 60 * mins) {
      info = await page.evaluate(() => {
        const G = CH.G;
        if (G.level && G.level.isTown && G.state === 'playing') CH.Town.leave(); // out of the hideout: on with the adventure
        if (G.state === 'dialog') { const b = document.querySelector('#dlg-choices .btn'); if (b) b.click(); else CH.Dialogue.advance(); }
        window.__bot.step(600);
        const s = window.__bot.snapshot();
        window.__stageT[G.wave] = (window.__stageT[G.wave] || 0) + 10;
        return { s, deepest: CH.Storage.slot() ? CH.Storage.slot().world.deepest : 0 };
      });
      snap = info.s;
      steps += 600;
      if (snap.state === 'victory' || snap.state === 'gameover') break;
    }
    const extra = await page.evaluate(() => ({ deaths: window.__deaths, stageT: window.__stageT, level: CH.G.player.level, abilities: CH.Storage.slot() ? CH.Storage.slot().world.abilities : [] }));
    res.push({ end: snap.state, deepest: info.deepest, stage: snap.wave, minutes: Math.round(steps / 3600), lvl: extra.level, deaths: extra.deaths, abilities: extra.abilities, stageSecs: extra.stageT });
  }
  console.log(diff, prof);
  for (const x of res) console.log(JSON.stringify(x));
  console.log('worlds saved', res.filter((x) => x.end === 'victory').length + '/' + runs, 'errors:', errs.length ? errs.slice(0, 5).join('\n') : 'none', JSON.stringify(await page.evaluate(() => window.CH.errors)));
  await browser.close();
})();
