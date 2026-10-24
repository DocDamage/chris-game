/* Monster special attacks run to the end (PLAN.md section 16): orcs, plants and spiders chose their special attack by
   the telegraph, which is cleared when the wind-up ends, so the orc's rage charge never charged and plants and
   spiders never reset their spit / web cooldowns. They now keep the attack's kind (e.atkKind). */
const { open } = require('./lib');
(async () => {
  const { browser, page, errs } = await open({});
  let fails = 0;
  const ok = (name, c, extra) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + name + (c ? '' : ' ' + JSON.stringify(extra))); };

  const r = await page.evaluate(() => {
    const G = CH.G, X = CH.X, out = {};
    X.startRun({ mode: 'classic' }, null);
    G._scriptTesting = true;
    for (let i = 0; i < 20; i++) CH.stepFrame(1 / 60);
    const p = G.player, hx = G.arena.w / 2, hy = G.arena.h / 2;
    if (G.arena.props) G.arena.props.length = 0; // open ground
    const park = () => { p.x = hx; p.y = hy; p.vx = p.vy = 0; p.invuln = 1e9; p.hp = p.maxHp = 1e7; };
    const fresh = (type, dx) => {
      for (const e of G.enemies) e.dead = true;
      G.enemies.length = 0;
      G.projectiles.length = 0;
      G.queue.length = 0;
      park();
      const e = G.spawnEnemy(type, hx + dx, hy, { spawnTime: 0 });
      e.state = 'chase';
      return e;
    };
    // an orc far off charges: it covers ground during its rage attack and the cooldown starts again
    let e = fresh('orc', 220);
    e.rageCd = 0;
    let charged = 0, reset = false, x0 = null;
    for (let s = 0; s < 360 && !e.dead; s++) {
      park();
      const before = e.x;
      CH.stepFrame(1 / 60);
      if (e.state === 'attack' && e.sub === 'act') charged += Math.abs(e.x - before);
      if (e.rageCd > 1) reset = true;
    }
    out.orc = { charged: Math.round(charged), reset };
    // a plant spits once per cooldown (2.2 - 3.2 s), a spider webs once per cooldown (3.2 - 5 s)
    // (a spider is held at range while it chases, or it closes in and pounces before its web is ready)
    const count = (type, dx, frames, hold) => {
      const e = fresh(type, dx);
      if (hold) { e.webCd = 0; e.pounceCd = 99; }
      const seen = new Set();
      for (let s = 0; s < frames && !e.dead; s++) {
        park();
        if (hold && e.state === 'chase') { e.x = hx + dx; e.y = hy; e.pounceCd = 99; }
        CH.stepFrame(1 / 60);
        for (const q of G.projectiles) if (q.owner === 'e') seen.add(q);
      }
      return seen.size;
    };
    out.plantShots = count('plant', 150, 420);
    out.spiderShots = count('spider', 150, 540, true);
    return out;
  });
  ok('an orc far off charges at the hero and its rage cooldown starts again', r.orc.charged > 60 && r.orc.reset, r.orc);
  ok('a plant spits at most 3 times in 7 s', r.plantShots >= 1 && r.plantShots <= 3, r);
  ok('a spider webs at most 3 times in 9 s', r.spiderShots >= 1 && r.spiderShots <= 3, r);

  ok('no console errors', errs.length === 0, errs.slice(0, 5));
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
