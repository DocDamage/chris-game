/* World (PLAN.md section 16, step 3): the one resolver, the arena edge, where each body touches props and walls, and
   the reach of a prop's top. */
const { open } = require('./lib');
(async () => {
  const { browser, page, errs } = await open({});
  let fails = 0;
  const ok = (name, c, extra) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + name + (c ? '' : ' ' + JSON.stringify(extra))); };

  const r = await page.evaluate(() => {
    const W = CH.World, out = {};
    const at = (x, y, o) => Object.assign({ x, y, r: 6 }, o);
    // a box from (100, 100) to (132, 132): feet 10 below the centre, radius 5
    let e = at(116, 84); // feet at y 94, 6 px above the top: clear
    out.clear = { moved: W.pushBox(e, 10, 5, 100, 100, 132, 132), y: e.y };
    e = at(116, 88); // feet at 98, 2 px above the top: pushed up to touch it
    out.above = { moved: W.pushBox(e, 10, 5, 100, 100, 132, 132), y: e.y };
    e = at(103, 120); // feet at 130, inside: 2 px from the bottom, 3 from the left: out through the bottom
    out.inside = { moved: W.pushBox(e, 10, 5, 100, 100, 132, 132), x: e.x, y: e.y };
    e = at(104, 112); // feet at 122, inside, nearest the left side
    W.pushBox(e, 10, 5, 100, 100, 132, 132);
    out.insideLeft = { x: e.x, y: e.y };
    // a round prop of radius 10 at (200, 200)
    e = at(214, 190); // feet at (214, 200): 14 from the centre, 15 needed
    out.circle = { moved: W.pushCircle(e, 10, 5, 200, 200, 10), x: +e.x.toFixed(3) };
    e = at(200, 190); // exactly on the centre: stays put
    out.centre = { moved: W.pushCircle(e, 10, 5, 200, 200, 10) };
    // the edge of a 400 x 300 arena (margin 24)
    const a = { w: 400, h: 300 };
    e = at(10, 290);
    W.keepIn(e, 6, a);
    out.keep = { x: e.x, y: e.y };
    e = at(-5, 150, { kx: -100, ky: 0 });
    W.bounceIn(e, a);
    out.bounce = { x: e.x, kx: e.kx, wallHit: e.wallHit };
    e = at(200, 150, { kx: 50, ky: 0 });
    W.bounceIn(e, a);
    out.inArena = { wallHit: e.wallHit, kx: e.kx };
    // reach: a box prop at the feet, a round one from the centre
    const box = { x: 100, y: 100, box: { hw: 10, hh: 6 } }, round = { x: 100, y: 100, cr: 10 };
    out.reach = {
      boxOn: W.reach(box, 100, 92, 10, 5, 7), // feet at 102, inside the box
      boxOff: W.reach(box, 100, 70, 10, 5, 7), // feet at 80, 14 above it
      roundOn: W.reach(round, 116, 100, 10, 5, 7), // 16 from the centre, reach 17
      roundOff: W.reach(round, 118, 100, 10, 5, 7),
    };
    // the per-mover numbers (kept as they were; PLAN.md 3b would even them out)
    const hero = { r: 5 }, orc = { r: 12, look: { foot: 15 } }, boss = { r: 30, isBoss: true, look: { foot: 20 } };
    out.feet = { heroProps: W.FEET.props.hero(hero), enemyProps: W.FEET.props.enemy(orc), heroWalls: W.FEET.walls.hero(hero), enemyWalls: W.FEET.walls.enemy(orc), bossWalls: W.FEET.walls.enemy(boss) };
    return out;
  });
  ok('feet clear of a box: not moved', !r.clear.moved && r.clear.y === 84, r.clear);
  ok('feet just above a box: pushed up until they touch it', r.above.moved && r.above.y === 85, r.above);
  ok('feet inside a box: out through the nearest side', r.inside.moved && r.inside.x === 103 && r.inside.y === 127 && r.insideLeft.x === 95 && r.insideLeft.y === 112, r);
  ok('a round prop pushes the feet out to its radius + theirs', r.circle.moved && r.circle.x === 215, r.circle);
  ok('feet exactly on a round prop\'s centre stay put', !r.centre.moved, r.centre);
  ok('the arena edge keeps a body margin + radius in', r.keep.x === 30 && r.keep.y === 270, r.keep);
  ok('a monster on the edge stops, flags wallHit and its knockback bounces back at 30%', r.bounce.x === 30 && r.bounce.kx === 30 && r.bounce.wallHit === true, r.bounce);
  ok('inside the arena nothing changes', r.inArena.wallHit === false && r.inArena.kx === 50, r.inArena);
  ok('reach: box props at the feet, round props from the centre', r.reach.boxOn && !r.reach.boxOff && r.reach.roundOn && !r.reach.roundOff, r.reach);
  ok('per-mover feet: heroes 10 / r, monsters min(14, foot*0.8) / min(r, 9), walls min(10, foot*0.8), bosses 14 / min(r, 20)',
    JSON.stringify(r.feet) === JSON.stringify({ heroProps: [10, 5], enemyProps: [12, 9], heroWalls: [10, 5], enemyWalls: [10, 12], bossWalls: [14, 20] }), r.feet);

  ok('no console errors', errs.length === 0, errs.slice(0, 5));
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
