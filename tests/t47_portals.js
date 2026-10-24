/* Portals as front-facing vortices (PLAN.md 18, K5): the town portal in a stage and at the hideout's pad, the open exit,
   lit waypoints and portal breaches all draw js/vortex.js (no sideways rings), each in its own colour. */
const { open } = require('./lib');
(async () => {
  const { browser, page, errs } = await open({ levels: true });
  let fails = 0;
  const ok = (name, c, extra) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + name + (c ? '' : ' ' + JSON.stringify(extra))); };

  const r = await page.evaluate(() => {
    const G = CH.G, V = CH.Vortex, seen = {};
    const orig = V.draw;
    V.draw = function (ctx, x, y, rr, t, pal, o) { const k = typeof pal === 'string' ? pal : pal && pal.arm; seen[k] = (seen[k] || 0) + 1; return orig.apply(V, arguments); };
    const frame = () => { for (let i = 0; i < 2; i++) CH.stepFrame(1 / 30); G.render(); };
    G._scriptTesting = true;
    G.newRun(null);
    const L = G.level;
    for (const e of G.enemies) e.dead = true;
    // a town portal beside the hero, a lit waypoint, the exit open, all on screen
    const p = G.player;
    CH.Town.openPortal(p);
    const w = L.waypoints[0]; w.active = true;
    L.exit.open = true;
    L.explored.fill(1);
    const look = (x, y) => { p.x = x; p.y = y + 40; G.snapCamera(); frame(); };
    look(L.portal.x, L.portal.y);
    look(w.x, w.y);
    look(L.exit.x, L.exit.y);
    // a portal breach (the glitch biome's hive)
    const gl = CH.LevelGen.generate('glitch', 5, CH.U.seeded(9));
    G.level = gl; G.arena = gl;
    G.enemies.length = 0;
    const hive = CH.Spawners.create(gl.spawners[0], 5);
    look(hive.x, hive.y);
    const breach = Object.keys(seen).filter((k) => !['town', 'exit', 'waypoint'].includes(k));
    V.draw = orig;
    // one big vortex to look at
    const c = document.createElement('canvas');
    c.width = 120; c.height = 90;
    const g = c.getContext('2d');
    g.fillStyle = '#1a1d16'; g.fillRect(0, 0, 120, 90);
    orig.call(V, g, 60, 80, 26, 1.3, 'town');
    return { seen, breach, png: c.toDataURL() };
  });
  ok('the town portal is a vortex', r.seen.town > 0, r.seen);
  ok('the open exit is a gold vortex', r.seen.exit > 0, r.seen);
  ok('a lit waypoint is a green vortex', r.seen.waypoint > 0, r.seen);
  ok('a portal breach is a vortex in its own colour', r.breach.length > 0, r.seen);
  require('fs').writeFileSync(__dirname + '/vortex.png', Buffer.from(r.png.split(',')[1], 'base64'));

  // the hideout's pad
  const h = await page.evaluate(() => {
    const G = CH.G, V = CH.Vortex;
    let n = 0;
    const orig = V.draw;
    V.draw = function () { n++; return orig.apply(V, arguments); };
    G.newRun(null);
    G.level = null;
    CH.Town.enter('test');
    const T = G.level;
    G.player.x = T.exit.x; G.player.y = T.exit.y - 60; G.snapCamera();
    CH.stepFrame(1 / 30); G.render();
    V.draw = orig;
    return n;
  });
  ok('the hideout\'s portal pad is a vortex', h > 0, h);

  ok('no console errors', errs.length === 0, errs.slice(0, 5));
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
