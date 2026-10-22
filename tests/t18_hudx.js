const { open } = require('./lib');
(async () => {
  const { browser, page, errs } = await open();
  const out = await page.evaluate(() => {
    const G = CH.G, X = CH.X, M = CH.Meta;
    const res = {};
    const god = () => { for (const p of G.players) { p.hp = p.maxHp = 1e6; } };
    const o = X.opts();
    o.dpsMeter = true; o.minimap = true; o.offscreen = true; o.lowHp = true; o.colorblind = false;
    X.startRun({}, null); G._scriptTesting = true; G.startWave(3); god();
    for (let i = 0; i < 200; i++) G.update(1 / 30);
    G.player.hp = 5; G.player.maxHp = 100;
    for (let i = 0; i < 90; i++) { G.update(1 / 30); G.player.hp = 5; }
    res.dps = X.hx.dps;
    res.colors = [X.telegraphColor({ r: 30 }), X.telegraphColor({ r: 90 }), X.telegraphColor({ lava: true })].join(',');
    o.colorblind = true;
    res.cb = [X.telegraphColor({ r: 30 }), X.telegraphColor({ r: 90 })].join(',');
    o.colorblind = false;
    o.dmgNums = false; const n0 = CH.FX.texts ? CH.FX.texts.length : 0; CH.FX.text(10, 10, '55', '#fff', 1); res.numOff = (CH.FX.texts ? CH.FX.texts.length : 0) === n0;
    o.dmgNums = true;
    res.pauseBuild = (CH.UI.showPause(), document.getElementById('hx-build').innerHTML.length > 10);
    CH.UI.hideAll();
    // auto aim/fire
    o.autoFire = true; o.autoAim = true;
    X.startRun({}, null); G._scriptTesting = true; G.startWave(3); god();
    for (let i = 0; i < 120; i++) G.update(1 / 30);
    o.autoFire = false; o.autoAim = false;
    // tutorial
    X.startRun({ mode: 'tutorial' }, null); G._scriptTesting = true; G.startWave(1); god();
    res.tut0 = !!X.hx.tut;
    const p = G.player;
    for (let i = 0; i < 40; i++) G.update(1 / 30);
    X.hx.tut.did = { move: 1, fire: 1, dodge: 1, nade: 1, special: 1, barricade: 1, interact: 1 };
    G.update(1 / 30);
    res.tutDone = X.hx.tut.done;
    return res;
  });
  console.log(JSON.stringify(out, null, 1));
  console.log('errors:', errs.length ? errs : 'none');
  await browser.close();
})();
