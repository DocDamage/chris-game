/* The flow field and small props (PLAN.md section 16): crates under 9 px used to be left out of the field, which sent
   walkers straight into them; the slower ones stuck and the test bot shuttled in front of them for minutes. Built on
   the stage where it was found: run seed 1144006020, office, stage 4. */
const { open } = require('./lib');
const { NAV } = require('./navbot');
(async () => {
  const { browser, page, errs } = await open({ levels: true });
  let fails = 0;
  const ok = (name, c, extra) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + name + (c ? '' : ' ' + JSON.stringify(extra))); };
  await page.evaluate(NAV);

  const r = await page.evaluate(() => {
    const G = CH.G, X = CH.X, out = {};
    G.pathArena = () => 'office';
    X.startRun({ mode: 'short', seed: 1144006020 }, null);
    G.runSeed = 1144006020;
    CH.Run.startLevel(4);
    G._scriptTesting = true;
    const L = G.level, TS = 32, p = G.player;
    const crate = (x, y, hw, hh) => G.arena.props.find((q) => q.solid && !q.dead && q.box && q.box.hw === hw && q.box.hh === hh && Math.abs(q.x + (q.cx || 0) - x) < 6 && Math.abs(q.y + (q.cy || 0) - y) < 6);
    if (!(crate(2095, 1753, 7, 4) && crate(2104, 1774, 6, 5))) {
      // the stage's dressing deals other pieces since PLAN.md 21: put the two crates of the bug back where they stood
      // (the map, its hives and its field are the same), with nothing else around them
      __clear({ props: { x: 2100, y: 1765, r: 90 } });
      for (const [x, y, hw, hh] of [[2095, 1753, 7, 4], [2104, 1774, 6, 5]]) {
        CH.Arenas.addProp(G.arena.props, 'crate', x, y + hh - 1, { solid: true, box: { hw, hh }, cy: -hh + 1, jumpable: true });
        G.arena.props[G.arena.props.length - 1].sp = true;
      }
      L.flows.clear();
      CH.Props.invalidate();
    }
    out.crates = !!crate(2095, 1753, 7, 4) && !!crate(2104, 1774, 6, 5);
    if (!out.crates) return out;
    // the field toward the hive's side of the map routes around the lower crate's tile
    const f = L.flowFor(2606, 1942);
    out.crateTile = f.dist[Math.floor(1774 / TS) * L.tw + Math.floor(2104 / TS)];
    // the test bot walks from where it used to shuttle to the hive it was after (first: the hero parked by its camp
    // below would shoot it down)
    for (const e of G.enemies) if (!e.isSpawner) e.dead = true;
    window.__bot.god = true;
    window.__bot.human = { reaction: 14, jitter: 0.09, mistake: 0.12 };
    p.x = 2093; p.y = 1765;
    const hive = (L.hives || []).find((q) => Math.abs(q.x - 2704) < 4 && Math.abs(q.y - 2431) < 4);
    let best = 1e9;
    for (let s = 0; s < 40 && hive; s++) {
      for (const e of G.enemies) if (!e.isSpawner && !e.dead) e.dead = true;
      window.__bot.step(60);
      best = Math.min(best, Math.hypot(hive.x - p.x, hive.y - p.y));
    }
    out.bot = hive ? Math.round(best) : 'no hive';
    // walkers that follow the field get past the crates (the hero waits on the far side)
    out.walkers = {};
    for (const [type, sx, sy] of [['goblin', 1990, 1800], ['slime', 2060, 1766], ['spider', 1990, 1800]]) {
      for (const e of G.enemies) if (!e.isSpawner) e.dead = true;
      const e = G.spawnEnemy(type, sx, sy, { spawnTime: 0 });
      let passed = null;
      for (let s = 0; s < 360 && passed === null && !e.dead; s++) {
        p.x = 2606; p.y = 1942; p.vx = p.vy = 0; p.invuln = 1e9; p.hp = p.maxHp = 1e7;
        CH.stepFrame(1 / 60);
        if (e.x > 2160) passed = +(s / 60).toFixed(1);
      }
      out.walkers[type] = passed;
    }
    return out;
  });
  ok('the stage is the one the bug was found on (two crates at (2095, 1753) and (2104, 1774))', r.crates, r);
  if (r.crates) {
    ok('the field routes around the lower crate\'s tile', r.crateTile === -1, r);
    ok('a goblin, a slime and a spider following the field get past the crates within 4.5 s (5.8 s before)', Object.values(r.walkers).every((t) => t !== null && t <= 4.5), r.walkers);
    ok('the test bot reaches its hive from where it used to shuttle', typeof r.bot === 'number' && r.bot < 150, r);
  }

  ok('no console errors', errs.length === 0, errs.slice(0, 5));
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
