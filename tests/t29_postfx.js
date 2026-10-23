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
    // tracks: walking out of blood leaves 18 prints, each fainter than the last and none inside the puddle; monsters
    // print paws, flyers nothing; water prints evaporate
    const rm = L.rooms.slice().sort((a, b) => b.w * b.h - a.w * a.h)[0], c0 = L.nearestOpen(rm.cx - 90, rm.cy);
    for (const e2 of G.enemies) e2.dead = true;
    G.enemies.length = 0; A.prints.length = 0; A.dyn.length = 0; A.setMode('clear'); A.clock = 0.3; A.dark = 0;
    p.x = c0.x; p.y = c0.y;
    const bp = { x: p.x, y: p.y + 12, rx: 20, ry: 12, kind: 'blood' };
    L.puddles.push(bp);
    step(2);
    for (let i = 0; i < 120; i++) { p.x += 1.5; CH.stepFrame(1 / 60); }
    // the hero's prints (a monster elsewhere on the map may print too)
    const pr = A.prints.filter((q) => !q.paw), inPud = (q) => ((q.x - bp.x) / bp.rx) ** 2 + ((q.y - bp.y) / bp.ry) ** 2 < 1;
    r.tracks = { n: pr.length, blood: pr.every((q) => q.kind === 'blood'), fading: pr.every((q, i) => i === 0 || q.str <= pr[i - 1].str), outside: !pr.some(inPud) };
    const mob = (type, dx) => { const e2 = G.spawnEnemy(type, bp.x + dx, bp.y - 4, { spawnTime: 0 }); e2.state = 'idle'; e2.update = function () {}; return e2; };
    const orc = mob('orc', 0), bird = mob('pigeon', 4);
    CH.stepFrame(1 / 60);
    A.prints.length = 0;
    for (let i = 0; i < 60; i++) { orc.x -= 1.5; bird.x -= 1.5; CH.stepFrame(1 / 60); }
    r.paws = A.prints.length > 3 && A.prints.every((q) => q.paw) && !!(bird.look && bird.look.fly);
    A.prints.push({ x: p.x, y: p.y, d: 0, s: 0, kind: 'water', str: 1, born: G.wall - 9, paw: false });
    A.pclean = 0; CH.stepFrame(1 / 60);
    r.evaporate = !A.prints.some((q) => q.kind === 'water');
    orc.dead = bird.dead = true; G.enemies.length = 0;
    L.puddles.pop();
    // the shader still shades a puddle under the rain's tint and the screen vignette (they once switched it off):
    // at the same spot, the shader lifts the blue channel more with the puddle there than the rain's grade does without
    // it (when it was switched off the two were equal)
    A.setMode('rain');
    const wp = { x: p.x - 70, y: p.y - 50, rx: 26, ry: 16, kind: 'water' };
    // the mean blue of a 14 x 8 patch in the middle of the puddle (single pixels jump with the raindrops)
    const blue = (src, x, y) => { const t = document.createElement('canvas'); t.width = 14; t.height = 8; const k = t.getContext('2d', { willReadFrequently: true }); k.drawImage(src, x - 7, y - 4, 14, 8, 0, 0, 14, 8); const d = k.getImageData(0, 0, 14, 8).data; let n = 0; for (let i = 2; i < d.length; i += 4) n += d[i]; return n / (d.length / 4); };
    const fxc = document.getElementById('fx');
    const lift = () => { const x = Math.round(wp.x - G.cam.x), y = Math.round(wp.y - G.cam.y); return Math.round(blue(fxc, x, y) - blue(G.canvas, x, y)); };
    L.puddles.push(wp);
    step(4);
    const withPuddle = lift();
    L.puddles.pop();
    step(4);
    r.rainShade = { puddle: withPuddle, grass: lift() };
    A.setMode('clear');
    // effects off falls back to the plain frame
    S.settings.fx = 'off'; P.apply(); r.off = !P.on && document.getElementById('game').style.visibility === '';
    S.settings.fx = 'high'; P.apply(); step(2); r.back = P.on;
    return r;
  });
  console.log(JSON.stringify(out));
  const ok = out.supported && out.on && out.canvas && out.lights && out.puddles && Object.values(out.weather).every(Boolean) && out.night && out.nightDmg && out.widgetNight && out.blizzard && out.strike && out.widgetFlash && out.blood && out.lava && out.off && out.back
    && out.tracks.n === 18 && out.tracks.blood && out.tracks.fading && out.tracks.outside && out.paws && out.evaporate
    && out.rainShade.puddle - out.rainShade.grass > 10;
  console.log('errors', errs);
  console.log(ok && !errs.length ? 'ALL PASSED' : 'FAILED');
  await browser.close();
  process.exit(ok && !errs.length ? 0 : 1);
})();
