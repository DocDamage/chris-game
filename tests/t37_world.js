/* World (PLAN.md section 16, step 3): the one resolver, the arena edge, one feet circle per body, things flung or shot
   against walls, shots against props and the reach of a prop's top. */
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
    // one feet circle per body, the same against props and walls
    const hero = { r: 5 }, golem = { r: 10 }, orc = { r: 12, look: { foot: 15 } }, imp = { r: 6, look: { foot: 6 } }, boss = { r: 30, isBoss: true, look: { foot: 20 } };
    out.feet = { hero: W.FEET.hero(hero), sidekick: W.FEET.sidekick(golem), orc: W.FEET.enemy(orc), imp: W.FEET.enemy(imp), boss: W.FEET.enemy(boss), pickup: W.FEET.pickup() };
    // a stand-in level: rock from x = 100 on
    const G = CH.G, keep = G.level;
    G.level = { solidAt: (x) => x >= 100 };
    // a flung coin stops on the axis that hit the wall and keeps the other
    let c = { x: 104, y: 60, vx: 300, vy: 50 };
    W.stopAt(c, 95, 50);
    out.coin = { x: c.x, y: c.y, vx: c.vx, vy: c.vy };
    // a bouncing shot turns back on the axis that hit; one that does not bounce is left for the caller to end
    let s = { x: 103, y: 50, vx: 60, vy: 20, wallBounce: 1 };
    out.bounced = W.bounceShot(G.level, s, 97, 48);
    out.shot = { x: s.x, y: s.y, vx: s.vx, vy: s.vy, wallBounce: s.wallBounce };
    s = { x: 103, y: 50, vx: 60, vy: 20, wallBounce: 0 };
    out.plain = W.bounceShot(G.level, s, 97, 48);
    G.level = { solidAt: (x, y) => x >= 100 || y >= 100 }; // a corner: both turn
    s = { x: 103, y: 103, vx: 60, vy: 60, wallBounce: 2 };
    W.bounceShot(G.level, s, 97, 97);
    out.corner = { vx: s.vx, vy: s.vy, wallBounce: s.wallBounce };
    G.level = keep;
    // shots against a prop's footprint
    const tall = { x: 300, y: 300, cr: 10 }, crate = { x: 300, y: 300, box: { hw: 8, hh: 6 } };
    out.shots = { roundHit: W.shotHits(tall, { x: 300, y: 290, r: 2 }), roundMiss: W.shotHits(tall, { x: 300, y: 280, r: 2 }), boxHit: W.shotHits(crate, { x: 300, y: 298, r: 2 }), boxMiss: W.shotHits(crate, { x: 320, y: 298, r: 2 }) };
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
  ok('one feet circle per body: radius at most 7 (bosses 12), monster feet min(12, foot * 0.8)',
    JSON.stringify(r.feet) === JSON.stringify({ hero: [10, 5], sidekick: [10, 7], orc: [12, 7], imp: [4.800000000000001, 6], boss: [14, 12], pickup: [0, 3] }), r.feet);
  ok('a flung coin stops at a wall on the axis that hit it', r.coin.x === 95 && r.coin.vx === 0 && r.coin.y === 60 && r.coin.vy === 50, r.coin);
  ok('a bouncing shot turns back on the axis that hit the wall', r.bounced && r.shot.vx === -60 && r.shot.vy === 20 && r.shot.x === 97 && r.shot.y === 48 && r.shot.wallBounce === 0, r.shot);
  ok('a shot that does not bounce is left to end', r.plain === false, r);
  ok('at a corner a bouncing shot turns back on both axes', r.corner.vx === -60 && r.corner.vy === -60 && r.corner.wallBounce === 1, r.corner);
  ok('shots meet round props a little above their base and box props a little below the shot', r.shots.roundHit && !r.shots.roundMiss && r.shots.boxHit && !r.shots.boxMiss, r.shots);

  ok('no console errors', errs.length === 0, errs.slice(0, 5));
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
