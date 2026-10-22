/* Jump key, feet-based collision (walls, props), prop hitboxes sized from their sprites, puddle shader leaves heroes alone. */
const { open } = require('./lib');
(async () => {
  const { browser, page, errs } = await open({ levels: true, fx: 'high' });
  const out = await page.evaluate(() => {
    const G = CH.G, X = CH.X, S = CH.Storage, r = {};
    const step = (n) => { for (let i = 0; i < n; i++) { if (G.state === 'levelup') while (G.state === 'levelup') G.pickUpgrade(0); CH.stepFrame(1 / 30); } };
    X.startRun({}, null); G._scriptTesting = false; const p = G.player; p.hp = p.maxHp = 1e7;
    const L = G.level;
    // 1. jump on its own key, in the open, away from any prop
    r.keys = S.settings.keys.jump + '/' + S.settings.keys.dodge;
    const q = L.nearestOpen(L.rooms[0].cx, L.rooms[0].cy); p.x = q.x; p.y = q.y; G.enemies.length = 0; L.props.length = 0; step(5);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: S.settings.keys.jump, key: 'b' }));
    step(1);
    r.jumped = p.jumping === true || p.z > 0;
    let peak = 0; for (let i = 0; i < 25; i++) { step(1); peak = Math.max(peak, p.z); }
    window.dispatchEvent(new KeyboardEvent('keyup', { code: S.settings.keys.jump }));
    r.peak = Math.round(peak); r.landed = p.z === 0 && !p.jumping;
    // an old save that bound jump to Space gets its own key
    r.migrated = CH.Storage.sanitize({ settings: { keys: { jump: 'Space', dodge: 'Space' } } }).settings.keys.jump === 'KeyB';
    // 2. walls: walk south into a wall; the feet stop at the wall edge (not the body centre)
    let found = null;
    outer: for (const rm of L.rooms) for (let a = 0; a < 60; a++) { const c = L.randomNear(rm.cx, rm.cy, 0, 160, 14); if (!c) continue; for (let d = 20; d < 120; d += 4) if (L.solidAt(c.x, c.y + d) && !L.solidAt(c.x, c.y + d - 4)) { found = { x: c.x, y: c.y, wall: Math.floor((c.y + d) / 32) * 32 }; break outer; } }
    r.wallFound = !!found;
    if (found) {
      p.x = found.x; p.y = found.y;
      for (let i = 0; i < 80; i++) { p.y += 3; L.pushOutFeet(p, p.r || 8, 10); }
      r.feetAtEdge = p.y + 10 <= found.wall + 1 && p.y + 10 >= found.wall - 9;
      r.notInWall = !L.solidAt(p.x, p.y + 10 + 2);
    }
    // 3. enemies too
    const e = G.spawnEnemy('orc', p.x, p.y - 40, { spawnTime: 0 });
    for (let i = 0; i < 60; i++) { e.y += 3; L.pushOutFeet(e, e.r, Math.min(10, (e.look.foot || 8) * 0.8)); }
    r.enemyStops = !L.solidAt(e.x, e.y + 6);
    // 4. prop hitboxes follow the sprite size
    X.startRun({}, null);
    const bad = []; let n = 0;
    for (const pr of G.level.props) { if (!pr.solid || pr.kind === 'tree') continue; const sp = CH.Sprites.get(pr.sprite); n++; if (sp && sp.w && pr.cr < Math.min(26, Math.round(sp.w * 0.36)) - 1) bad.push(pr.sprite + ':' + pr.cr + '<' + sp.w); }
    r.props = n; r.badProps = bad.slice(0, 4);
    // 5. walking into a prop: the feet stop at its hitbox
    const L2 = G.level; const p2 = G.player; const pr = L2.props.find((q) => q.solid && q.kind !== 'tree');
    if (pr) { p2.x = pr.x - 80; p2.y = pr.y + 10; for (let i = 0; i < 60; i++) { p2.x += 2.5; step(0); G.update(1 / 60); p2.x = Math.min(p2.x, pr.x + 50); } r.propBlocks = Math.hypot(p2.x - (pr.x + (pr.cx || 0)), p2.y + 10 - (pr.y + (pr.cy || 0))) >= (pr.cr || 10) + 4 || p2.x < pr.x; }
    // 6. the puddle shader skips entities: a hero in a puddle keeps its own pixels
    G.level.puddles.length = 0; const q2 = G.level.nearestOpen(G.level.rooms[0].cx, G.level.rooms[0].cy); p2.x = q2.x; p2.y = q2.y; G.level.puddles.push({ x: q2.x, y: q2.y + 10, rx: 50, ry: 30, kind: 'water' });
    step(3);
    r.floorCopy = !!CH.Atmos.floor;
    return r;
  });
  console.log(JSON.stringify(out));
  const ok = out.jumped && out.peak >= 8 && out.landed && out.migrated && out.wallFound && out.feetAtEdge && out.notInWall && out.enemyStops && out.badProps.length === 0 && (out.propBlocks !== false) && out.floorCopy;
  console.log('errors', errs);
  console.log(ok && !errs.length ? 'ALL PASSED' : 'FAILED');
  await browser.close();
  process.exit(ok && !errs.length ? 0 : 1);
})();
