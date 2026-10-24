/* Actor (PLAN.md section 16, step 4): what heroes, monsters, bosses and sidekicks share, with each kind's own numbers. */
const { open } = require('./lib');
(async () => {
  const { browser, page, errs } = await open({});
  let fails = 0;
  const ok = (name, c, extra) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + name + (c ? '' : ' ' + JSON.stringify(extra))); };

  const r = await page.evaluate(() => {
    const A = CH.Actor, K = A.KIND, G = CH.G, X = CH.X, out = {};
    // a hit fading: flash x6, squash x7, the hurt pose by the second; nothing below zero is touched
    const m = { flash: 1, squash: 1, hurtT: 0.28 };
    A.fadeHit(m, 0.1);
    out.fade = [+m.flash.toFixed(3), +m.squash.toFixed(3), +m.hurtT.toFixed(3)];
    const z = { flash: 0, squash: -0.2, hurtT: 0 };
    A.fadeHit(z, 0.1);
    out.fadeIdle = [z.flash, z.squash, z.hurtT];
    // knockback dies away at each kind's rate; low gravity slows it
    const kb = (rate, mul) => { const a = { kx: 100, ky: -50 }; A.decayKnock(a, 0.05, rate, mul); return [+a.kx.toFixed(2), +a.ky.toFixed(2)]; };
    out.knock = { hero: kb(K.hero.knockDecay), monster: kb(K.monster.knockDecay), lowGrav: kb(K.monster.knockDecay, 0.35), sidekick: kb(K.sidekick.knockDecay), long: kb(K.hero.knockDecay * 100) };
    // a hit pushes straight away from its source
    const h = { x: 100, y: 100, kx: 0, ky: 0 };
    A.pushFrom(h, { x: 90, y: 100 }, K.hero.hitPush);
    out.push = [Math.round(h.kx), Math.round(h.ky)];
    // the blink: on for 0.05 s, off for 0.05 s, never when not invulnerable
    out.blink = [0.7, 0.66, 0.62, 0.0].map((t) => A.blink({ invuln: t }));
    // in the game: a hero hit by a monster is pushed away at 150 and its knockback dies away at 9 per second
    X.startRun({ mode: 'classic' }, null);
    G._scriptTesting = true;
    for (let i = 0; i < 20; i++) CH.stepFrame(1 / 60);
    const p = G.player;
    p.invuln = 0; p.rolling = false; p.rollGrace = 0; p.kx = p.ky = 0; p.hp = p.maxHp = 1e6;
    G.hurtPlayer(5, { x: p.x - 10, y: p.y }, {});
    out.heroHit = { kx: Math.round(p.kx), ky: Math.round(p.ky) };
    return out;
  });
  ok('a hit fades: flash x6 and squash x7 per second, the hurt pose by the second', JSON.stringify(r.fade) === JSON.stringify([0.4, 0.3, 0.18]), r.fade);
  ok('nothing at or below zero is faded further', JSON.stringify(r.fadeIdle) === JSON.stringify([0, -0.2, 0]), r.fadeIdle);
  ok('knockback dies away at 9 (heroes), 7 (monsters, 0.35 of that in low gravity), 8 (sidekicks) per second, never below zero',
    JSON.stringify(r.knock) === JSON.stringify({ hero: [55, -27.5], monster: [65, -32.5], lowGrav: [87.75, -43.88], sidekick: [60, -30], long: [0, 0] }), r.knock);
  ok('a hit pushes straight away from its source', JSON.stringify(r.push) === JSON.stringify([150, 0]), r.push);
  ok('invulnerable actors blink 10 times a second', JSON.stringify(r.blink) === JSON.stringify([true, false, true, false]), r.blink);
  ok('a hit hero is pushed away from the monster at 150', r.heroHit.kx === 150 && r.heroHit.ky === 0, r.heroHit);

  ok('no console errors', errs.length === 0, errs.slice(0, 5));
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
