/* Level stages: walls, fog, hives, packs, pathing around walls, exit, next stage, secrets. */
const { open } = require('./lib');
(async () => {
  const { browser, page, errs } = await open({ levels: true });
  const out = await page.evaluate(() => {
    const G = CH.G, X = CH.X, S = CH.Storage, R = CH.Run, r = {};
    const step = (n) => { for (let i = 0; i < n; i++) { if (G.state === 'levelup') { while (G.state === 'levelup') G.pickUpgrade(0); } CH.stepFrame(1 / 30); } };
    const god = () => { for (const p of G.players) p.hp = p.maxHp = 1e7; };
    S.settings.hero = 'Mercenary';
    X.startRun({}, null); G._scriptTesting = true; god();
    const L = G.level;
    r.isLevel = !!L && G.arena === L && L.isLevel;
    r.stage = G.wave;
    r.atEntrance = Math.hypot(G.player.x - L.entrance.x, G.player.y - L.entrance.y) < 4;
    r.hives = L.hives.length;
    r.hivesAlive = L.hives.filter((h) => !h.dead).length;
    r.sealed = L.exit.open === false;
    r.fogStart = L.exploredFraction() < 0.2;
    step(30);
    // walls: try to walk through rock
    const p = G.player;
    let wallDir = null;
    outer: for (const rm of L.rooms) for (let a = 0; a < 40; a++) {
      const c = L.randomNear(rm.cx, rm.cy, 0, 150, 14);
      if (!c) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (L.solidAt(c.x + dx * 50, c.y + dy * 50)) { p.x = c.x; p.y = c.y; wallDir = [dx, dy]; break outer; }
    }
    r.hasWall = !!wallDir;
    if (wallDir) {
      for (let i = 0; i < 40; i++) { p.x += wallDir[0] * 4; p.y += wallDir[1] * 4; L.pushOut(p, p.r || 8); } // keep walking into the rock
      r.pushedOut = !L.solidAt(p.x, p.y);
    }
    // enemies breed near a hive when a hero is close, and never inside rock
    const hive = L.hives[0];
    const q = L.nearestOpen(hive.x + 60, hive.y);
    p.x = q.x; p.y = q.y;
    step(30 * 14);
    r.bred = G.enemies.filter((e) => e.hive === hive.hive && !e.dead).length;
    r.noneInRock = G.enemies.every((e) => !L.solidAt(e.x, e.y));
    // pack wake
    const pk = L.packs[0];
    const tele = L.nearestOpen(pk.x + 200, pk.y);
    p.x = tele.x; p.y = tele.y;
    step(15);
    r.packWoke = pk.woke;
    // pathing: an enemy with a wall between it and the hero still arrives
    const far = L.rooms.map((rm) => ({ x: rm.cx, y: rm.cy })).find((c) => !L.los(c.x, c.y, G.player.x, G.player.y) && L.pathDist(c.x, c.y, G.player.x, G.player.y) < 1400);
    r.pathCase = !!far;
    if (far) {
      G.enemies = G.enemies.filter((q) => { if (q.isSpawner) return true; q.dead = true; return false; });
      const e = G.spawnEnemy('chicken', far.x, far.y, { spawnTime: 0.1 });
      const d0 = L.pathDist(e.x, e.y, p.x, p.y);
      step(30 * 12);
      const d1 = L.pathDist(e.x, e.y, p.x, p.y);
      r.pathCloser = d1 < d0 * 0.85;
      r.pathDbg = [Math.round(d0), Math.round(d1), e.state];
      e.dead = true;
    }
    // close the breaches: the seal breaks, the exit opens
    R.closeAllBreaches();
    step(5);
    r.closed = R.hivesClosed();
    r.exitOpen = L.exit.open === true;
    // walk to the exit: the stage completes and the next one starts
    const wave0 = G.wave;
    R.teleport(L.exit.x, L.exit.y);
    step(3);
    r.clearState = G.waveState;
    step(30 * 8);
    r.next = G.wave === wave0 + 1 && G.level && G.level !== L;
    r.nextFresh = G.level ? G.level.exploredFraction() < 0.25 : false;
    // secret room: crack a wall by shooting it
    const origPath = G.pathArena; G.pathArena = () => 'dungeon';
    let sec = null, tries = 0;
    while (!sec && tries++ < 8) {
      for (let k = 0; k < 6 && !sec; k++) { X.startRun({}, null); G._scriptTesting = true; god(); if (G.level.secrets.length) sec = G.level.secrets[0]; }
    }
    r.secretMade = !!sec;
    if (sec) {
      const L2 = G.level;
      r.sealedBefore = L2.pathDist(L2.entrance.x, L2.entrance.y, sec.cx, sec.cy) === Infinity;
      for (let i = 0; i < 4; i++) { const pr = { x: sec.crack.x * 32 + 16, y: sec.crack.y * 32 + 16, owner: 'p', dmg: 30, dead: false, vx: 0, vy: 0, r: 3, life: 1, hits: new Set(), hitT: new Map(), rot: 0, spin: 0, shooter: G.player, speed: 0, pierce: 0, kind: 'junk', color: '#fff', age: 0 }; G.projectiles.push(pr); step(1); }
      r.openedAfter = L2.pathDist(L2.entrance.x, L2.entrance.y, sec.cx, sec.cy) < Infinity;
    }
    G.pathArena = origPath;
    // boss stage after levels falls back to the old arena (stage 3 in the campaign)
    X.startRun({}, null); G._scriptTesting = true; god();
    G.startWave(3); step(5);
    r.bossArena = !G.level && !G.arena.isLevel;
    return r;
  });
  console.log(JSON.stringify(out));
  const ok = out.isLevel && out.stage === 1 && out.atEntrance && out.hives >= 3 && out.hivesAlive === out.hives && out.sealed && out.fogStart && out.hasWall && out.pushedOut &&
    out.bred >= 1 && out.noneInRock && out.packWoke && out.pathCase && out.pathCloser && out.closed === out.hives && out.exitOpen && out.clearState === 'clear' && out.next && out.nextFresh &&
    out.secretMade && out.sealedBefore && out.openedAfter && out.bossArena;
  console.log('errors', errs);
  console.log(ok && !errs.length ? 'ALL PASSED' : 'FAILED');
  await browser.close();
  process.exit(ok && !errs.length ? 0 : 1);
})();
