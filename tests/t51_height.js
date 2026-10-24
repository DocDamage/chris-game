/* Height and light platforming (PLAN.md 18, K7): stages get raised plateaus (a rim you climb by its stairs and may jump
   down from) and a ring of pit round a treasure island (jump across; fall in and it hurts and puts you back on the
   edge). Shots and eyes cross a pit; walkers go round it. Everything a stage needs stays reachable. */
const { open } = require('./lib');
(async () => {
  const { browser, page, errs } = await open({ levels: true });
  let fails = 0;
  const ok = (name, c, extra) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + name + (c ? '' : ' ' + JSON.stringify(extra))); };

  // 1. how often stages get them, and they never cut anything off
  let r = await page.evaluate(() => {
    const out = [];
    for (const biome of ['deadwood', 'gaslight', 'frozen', 'dungeon']) for (const seed of [1, 2, 3, 4]) {
      const L = CH.LevelGen.generate(biome, 2 + seed, CH.U.seeded(seed * 17));
      const plateaus = L.rooms.filter((rm) => rm.plateau).length;
      const island = L.chests.some((c) => c.island);
      L.flows.clear();
      const f = L.flowFor(L.entrance.x, L.entrance.y);
      const T = CH.Level.TS;
      const need = [L.exit].concat(L.spawners, L.chests.filter((c) => !c.secret), L.shrines, L.waypoints);
      const cut = need.filter((s) => f.dist[L.idx(Math.floor(s.x / T), Math.floor(s.y / T))] < 0).length;
      out.push({ biome, plateaus, island, cut, stairs: L.stairs.size });
    }
    return out;
  });
  ok('plateaus in most stages, each with stairs', r.filter((s) => s.plateaus > 0).length >= 10 && r.every((s) => s.stairs >= 2 * s.plateaus), r);
  ok('a pit island in most stages', r.filter((s) => s.island).length >= 10, r);
  ok('nothing a stage needs is cut off', r.every((s) => s.cut === 0), r);

  // 2. the island: walking stops at the pit, a jump crosses it, landing in it hurts and puts you on the edge
  r = await page.evaluate(() => {
    const G = CH.G, T = CH.Level.TS;
    G._scriptTesting = true;
    let L = null;
    for (let s = 1; s < 30 && !L; s++) { const q = CH.LevelGen.generate('deadwood', 2, CH.U.seeded(s * 31)); if (q.chests.some((c) => c.island)) L = q; }
    G.newRun(null);
    G.level = L; G.arena = L;
    G.enemies.length = 0;
    const p = G.player, c = L.chests.find((q) => q.island);
    const step = (n) => { for (let i = 0; i < n; i++) { CH.stepFrame(1 / 60); } };
    const hold = (dx, dy, n, jump) => { for (let i = 0; i < n; i++) { p.inp.moveX = dx; p.inp.moveY = dy; if (jump && i === 0) p.startJump(G); CH.stepFrame(1 / 60); } };
    // stand west of the ring, walk east: the pit stops you
    p.x = c.x - 3 * T - 6; p.y = c.y - 6; p.vx = p.vy = 0; p.z = 0;
    const walkIn = () => { for (let i = 0; i < 40; i++) { p.vx = 110; p.vy = 0; p.x += 110 / 60; CH.World.settleWalls(L); } return p.x; };
    const stopped = walkIn();
    const blocked = stopped < c.x - 2 * T + 4;
    // jump: in the air the pit is no wall
    p.x = c.x - 2 * T - 10; p.y = c.y - 6; p.z = 10; p.jumping = true; p.vz = 0;
    for (let i = 0; i < 12; i++) { p.x += 3; CH.World.settleWalls(L); }
    const crossed = p.x > c.x - 2 * T + 20;
    // land in the pit: a fall
    p.z = 0; p.jumping = false; p.fallT = 0;
    const hp0 = p.hp;
    p.x = c.x - 2 * T; p.y = c.y - 6; // the middle of the ring tile west of the island
    CH.World.settleWalls(L);
    const tx = Math.floor(p.x / T), ty = Math.floor((p.y + 12) / T);
    return { blocked, crossed, hurt: p.hp < hp0, out: L.cell(tx, ty) !== CH.Level.PIT, shotsCross: !L.blocks(Math.floor((c.x - 2 * T + 16) / T), Math.floor(c.y / T)) };
  });
  ok('walking stops at the pit', r.blocked, r);
  ok('a jump crosses it', r.crossed, r);
  ok('landing in it hurts and puts you on the edge', r.hurt && r.out, r);
  ok('shots and eyes cross a pit', r.shotsCross, r);

  // 3. a plateau: the rim stops you from below, the stairs take you up, a jump takes you down off the rim
  r = await page.evaluate(() => {
    const G = CH.G, T = CH.Level.TS;
    let L = null, rm = null;
    for (let s = 1; s < 30 && !L; s++) { const q = CH.LevelGen.generate('deadwood', 2, CH.U.seeded(s * 13)); const m = q.rooms.find((x) => x.plateau); if (m) { L = q; rm = m; } }
    G.level = L; G.arena = L;
    const [x0, y0, x1, y1] = rm.plateau;
    const p = G.player;
    // below the south rim, away from the stairs, pushing north: blocked
    let col = x0 + 1;
    while (L.stairs.has(L.idx(col, y1)) || L.cell(col, y1) !== CH.Level.LEDGE) col++;
    p.x = col * T + 16; p.y = (y1 + 1) * T + 14 - 12; p.z = 0; p.top = false;
    for (let i = 0; i < 30; i++) { p.y -= 2; CH.World.settleWalls(L); }
    const below = Math.floor((p.y + 12) / T) > y1;
    // on top, jumping south over the rim: down you go
    p.x = col * T + 16; p.y = (y1 - 1) * T + 16 - 12; p.z = 0;
    CH.World.settleWalls(L);
    const onTop = p.top;
    p.z = 10;
    for (let i = 0; i < 30; i++) { p.y += 2; CH.World.settleWalls(L); }
    p.z = 0;
    CH.World.settleWalls(L);
    const down = Math.floor((p.y + 12) / T) > y1;
    const stairs = L.stairs.size > 0 && Array.from(L.stairs).every((i) => L.cells[i] === CH.Level.FLOOR);
    return { below, onTop, down, stairs };
  });
  ok('the rim stops a hero below it', r.below, r);
  ok('a hero on top can jump down off the rim', r.onTop && r.down, r);
  ok('the stairs are open floor', r.stairs, r);

  // 4. a frame with all of it
  await page.evaluate(() => {
    const G = CH.G, L = G.level, rm = L.rooms.find((x) => x.plateau);
    G.player.x = rm.cx; G.player.y = rm.cy + 80; G.snapCamera(); G.render();
  });
  await page.screenshot({ path: __dirname + '/height.png' });

  ok('no console errors', errs.length === 0, errs.slice(0, 5));
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
