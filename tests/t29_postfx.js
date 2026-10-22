/* Atmosphere + post-process: WebGL pass runs, weather per biome, night, lightning strikes, puddles, widget state. */
const { open } = require('./lib');
(async () => {
  const { browser, page, errs } = await open({ levels: true, fx: 'high' });
  const out = await page.evaluate(() => {
    const G = CH.G, X = CH.X, A = CH.Atmos, P = CH.PostFX, S = CH.Storage, r = {};
    const step = (n) => { for (let i = 0; i < n; i++) { if (G.state === 'levelup') while (G.state === 'levelup') G.pickUpgrade(0); CH.stepFrame(1 / 30); } };
    r.supported = P.supported; r.on = P.on;
    X.startRun({}, null); G._scriptTesting = true; for (const p of G.players) p.hp = p.maxHp = 1e7;
    step(20);
    r.canvas = !!document.getElementById('fx') && document.getElementById('game').style.visibility === 'hidden';
    r.lights = A.lights.length >= 1;
    r.puddles = G.level.puddles.length >= 3;
    // biome weather table
    r.weather = {};
    for (const [b, want] of [['frozen', ['snow', 'blizzard']], ['dungeon', ['fog', 'bloodrain', 'clear']], ['volcano', ['ash', 'firestorm', 'clear']], ['office', ['none']], ['glitch', ['glitch']]]) {
      const orig = G.pathArena; G.pathArena = () => b; G.startWave(6); step(2); G.pathArena = orig;
      r.weather[b] = want.includes(A.mode);
    }
    // night
    A.clock = 0.85; A.dark = 1; step(2); r.night = G.night === true;
    const dmgDay = (A.clock = 0.3, A.dark = 0, G.night = false, G.edmg(10));
    A.clock = 0.85; A.dark = 1; G.night = true; r.nightDmg = G.edmg(10) > dmgDay;
    r.widgetNight = A.widgetState() === 4;
    // blizzard slows
    A.setMode('clear'); step(1); const sp0 = G.player.stats.speedMult; A.setMode('blizzard'); step(1); r.blizzard = G.player.stats.speedMult < sp0;
    A.setMode('clear');
    // storm strike: telegraph then damage in the ring, thunder later
    A.setMode('storm');
    const p = G.player; p.hp = p.maxHp = 1e6; A.strikes.push({ x: p.x + 5, y: p.y, t: 0.2, r: 34 });
    const hp0 = p.hp; step(10); r.strike = A.strikes.length === 0 && p.hp < hp0 && A.thunderAt >= 0;
    r.flash = A.flash >= 0;
    r.widgetFlash = (A.flash = 1, A.k2 = 3, A.widgetState()) === 13;
    A.flash = 0; A.setMode('clear');
    // blood puddles grow with kills; lava hurts
    const n0 = A.dyn.length; const e = G.spawnEnemy('orc', p.x + 80, p.y, { spawnTime: 0 }); step(20); e.hp = 1; G.damageEnemy(e, 99, { src: 'player', shooter: p }); r.blood = A.dyn.length > n0;
    const L = G.level; L.puddles.push({ x: p.x, y: p.y + 8, rx: 40, ry: 24, kind: 'lava' }); const h1 = p.hp; step(40); r.lava = p.hp < h1;
    L.puddles.pop();
    // effects off falls back to the plain frame
    S.settings.fx = 'off'; P.apply(); r.off = !P.on && document.getElementById('game').style.visibility === '';
    S.settings.fx = 'high'; P.apply(); step(2); r.back = P.on;
    return r;
  });
  console.log(JSON.stringify(out));
  const ok = out.supported && out.on && out.canvas && out.lights && out.puddles && Object.values(out.weather).every(Boolean) && out.night && out.nightDmg && out.widgetNight && out.blizzard && out.strike && out.widgetFlash && out.blood && out.lava && out.off && out.back;
  console.log('errors', errs);
  console.log(ok && !errs.length ? 'ALL PASSED' : 'FAILED');
  await browser.close();
  process.exit(ok && !errs.length ? 0 : 1);
})();
