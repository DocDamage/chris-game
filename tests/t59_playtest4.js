/* The fourth playtest (PLAN.md 20): monsters arrive through a front-facing portal; one interaction system (prompts,
   chests that open with a pay-out, gear picked up with the button, shrines and the exit used on purpose); a boss hall's
   door waits for the heroes after the kill, and the final boss's door leads to the victory. */
const { open } = require('./lib');
(async () => {
  const { browser, page, errs } = await open({ levels: true });
  let fails = 0;
  const ok = (name, c, extra) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + name + (c ? '' : ' ' + JSON.stringify(extra))); };

  await page.evaluate(() => {
    const G = CH.G, St = CH.Storage;
    localStorage.removeItem(St.KEY3);
    St.load();
    St.createSlot({ hero: 'Mercenary', name: 'Playtester' });
    G._scriptTesting = true;
    G.newRun(null);
    window.__step = (n) => { for (let i = 0; i < (n || 1); i++) CH.stepFrame(1 / 30); };
  });

  // 3: the arrival portal faces the camera (no sideways pack effect), opens, holds and closes
  let r = await page.evaluate(() => {
    const G = CH.G, p = G.player;
    __clear();
    const e = G.spawnEnemy('slime', p.x + 90, p.y, { spawnTime: 0.4 });
    const side = CH.FX.parts.some((q) => q.kind === 'vfx' && q.name === 'vfx.p7.12');
    const out = { portal: !!e.portal, side, pal: e.portal && e.portal.pal.rim };
    let drawn = 0;
    const orig = CH.Vortex.draw;
    CH.Vortex.draw = function () { drawn++; return orig.apply(this, arguments); };
    G.render(); out.d0 = drawn;
    __step(6); G.render(); out.d1 = drawn;
    __step(30); G.render(); out.closed = !e.portal; out.d2 = drawn;
    CH.Vortex.draw = orig;
    return out;
  });
  ok('a monster arrives through a front-facing vortex, not the sideways pack effect', r.portal && !r.side && r.d0 >= 1 && r.d1 > r.d0, r);
  ok('the portal closes behind it', r.closed, r);

  // 8: the chest: a prompt, the button, a moment of rattling, then the pay-out
  r = await page.evaluate(() => {
    const G = CH.G, p = G.player, L = G.level;
    __clear();
    const c = L.chests.find((q) => !q.opened && !q.island);
    L.explored.fill(1);
    p.x = c.x; p.y = c.y + 20;
    __step(2);
    const f = CH.Interact.focus.get(p);
    const now = CH.Interact.find(p);
    const out = { focus: f && f.verb + ' ' + f.name, key: !!(f && now && now.x === f.x && now.y === f.y && f.act) };
    const coins = G.coins, items = CH.Items.ground.length, pick = G.pickups.length;
    G.interact(p);
    out.opened = c.opened;
    out.paidAtOnce = G.coins !== coins;
    __step(12);
    out.paid = G.coins > coins && G.pickups.length > pick;
    out.gearOrNot = CH.Items.ground.length - items;
    G.render();
    return out;
  });
  ok('standing at a chest focuses it: "OPEN CHEST"', r.focus === 'OPEN CHEST' && r.key, r);
  ok('the button opens it; the loot comes out a moment later', r.opened && !r.paidAtOnce && r.paid, r);

  // 8: gear waits on the ground until picked up with the button; its name shows
  r = await page.evaluate(() => {
    const G = CH.G, p = G.player, I = CH.Items;
    __clear();
    I.ground.length = 0;
    const bag0 = I.bag().length;
    I.drop(p.x + 6, p.y + 2, I.roll(3, { rarity: 'rare', luck: 0 }));
    __step(40); // it lands at the hero's feet
    const out = { stillThere: I.ground.length === 1, bag: I.bag().length === bag0 };
    const f = CH.Interact.focus.get(p);
    out.focus = f && f.verb;
    G.interact(p);
    out.picked = I.ground.length === 0 && I.bag().length === bag0 + 1;
    return out;
  });
  ok('gear is not grabbed by walking over it', r.stillThere && r.bag, r);
  ok('the button picks it up ("PICK UP")', r.focus === 'PICK UP' && r.picked, r);

  // shrines wait for the button
  r = await page.evaluate(() => {
    const G = CH.G, p = G.player, L = G.level;
    __clear();
    L.shrines.push({ x: p.x + 4, y: p.y, used: false, id: 77, kind: 'healing' });
    const s = L.shrines[L.shrines.length - 1];
    __step(3);
    const out = { touched: s.used };
    G.interact(p);
    out.used = s.used;
    L.shrines.pop();
    return out;
  });
  ok('a shrine is not used by touching it; the button prays', !r.touched && r.used, r);

  // 4: the exit is a door used with the button
  r = await page.evaluate(() => {
    const G = CH.G, p = G.player, L = G.level;
    __clear();
    L.exit.open = true; L.opened = true;
    p.x = L.exit.x; p.y = L.exit.y;
    __step(4);
    const out = { stayed: G.level === L && G.waveState !== 'clear' };
    const f = CH.Interact.focus.get(p);
    out.focus = f && f.verb + ' ' + f.name;
    G.interact(p);
    out.left = G.waveState === 'clear';
    return out;
  });
  ok('standing on the open exit does not end the stage', r.stayed, r);
  ok('the button at the exit goes on ("ENTER" the next area)', r.left && /^ENTER /.test(r.focus || ''), r);

  // 4: a boss hall: the kill opens the door, the stage waits for the heroes
  r = await page.evaluate(() => {
    const G = CH.G;
    G.bossDying = null; G.victoryPending = false;
    if (CH.Town.inTown) CH.Town.leave();
    G.startWave(11);
    if (CH.Town.inTown) CH.Town.leave();
    const L = G.level, p = G.player;
    __step(60);
    const b = G.enemies.find((e) => e.isBoss && !e.dead);
    const out = { hall: !!L.bossHall, boss: !!b };
    if (!b) return out;
    // fight next to the door: the old exit fired when a hero touched it
    p.x = L.exit.x; p.y = L.exit.y; p.invuln = 99;
    G.killEnemy(b);
    __step(150);
    // the tower fights on: its two hearts wake (js/sky.js); stop them both
    for (const h of G.enemies.filter((q) => q.heart && !q.dead)) G.killEnemy(h);
    __step(30);
    out.open = L.exit.open;
    out.still = G.level === L && G.waveState !== 'clear' && G.state === 'playing';
    G.interact(p);
    out.left = G.waveState === 'clear';
    return out;
  });
  ok('killing a boss opens its hall\'s door', r.hall && r.boss && r.open, r);
  ok('the stage waits: no auto end beside the door', r.still, r);
  ok('the button takes the heroes through it', r.left, r);

  // the final boss: its door leads to the victory
  r = await page.evaluate(() => {
    const G = CH.G;
    G.bossDying = null; G.victoryPending = false;
    if (CH.Town.inTown) CH.Town.leave();
    G.startWave(49);
    if (CH.Town.inTown) CH.Town.leave();
    // the last area is the sky road (PLAN.md 21): the tower's maw leads into the belly, where the final boss waits
    G.level.exit.open = true;
    CH.Sky.enterTower();
    const L = G.level, p = G.player;
    __step(60);
    const b = G.enemies.find((e) => e.isBoss && !e.dead);
    const out = { hall: !!L.bossHall, boss: !!b };
    if (!b) return out;
    p.invuln = 99;
    G.killEnemy(b);
    __step(150);
    out.hearts = G.enemies.filter((q) => q.heart && !q.dead).length; // the tower fights on (js/sky.js)
    out.notYet = !L.exit.open;
    for (const h of G.enemies.filter((q) => q.heart && !q.dead)) G.killEnemy(h);
    __step(30);
    out.noVictoryYet = G.state === 'playing' && L.exit.open;
    p.x = L.exit.x; p.y = L.exit.y;
    __step(2);
    const f = CH.Interact.focus.get(p);
    out.focus = f && f.name;
    G.interact(p);
    out.victory = G.state === 'victory';
    return out;
  });
  ok('the final boss falls: no victory screen until the heroes walk through its door', r.hall && r.noVictoryYet, r);
  ok('"THE WAY HOME" leads to the victory', r.focus === 'THE WAY HOME' && r.victory, r);

  // 2: puddles lie on open floor, apart; kill blood never lands in another puddle
  r = await page.evaluate(() => {
    const T = CH.Level.TS, out = { stages: 0, puddles: 0, overlap: 0, offFloor: 0, onSolid: 0 };
    for (const [biome, s] of [['deadwood', 2], ['catacombs', 4], ['gaslight', 5], ['zombie', 6], ['castle', 9], ['volcano', 8]]) {
      const L = CH.LevelGen.generate(biome, s, CH.U.seeded(s * 31 + biome.length));
      out.stages++;
      const P = L.puddles;
      out.puddles += P.length;
      for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) { const a = P[i], b = P[j]; if (((a.x - b.x) / (a.rx + b.rx)) ** 2 + ((a.y - b.y) / (a.ry + b.ry)) ** 2 < 1) out.overlap++; }
      for (const p of P) {
        for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; if (L.cell(Math.floor((p.x + Math.cos(a) * p.rx) / T), Math.floor((p.y + Math.sin(a) * p.ry) / T)) !== 0) { out.offFloor++; break; } }
        if (L.props.some((q) => q.solid && !q.dead && q.box && Math.abs(q.x - p.x) < p.rx * 0.6 && Math.abs(q.y - p.y) < p.ry * 0.6)) out.onSolid++;
      }
    }
    // kill blood in the level's water is lost in it
    const G = CH.G, L = G.level, A = CH.Atmos;
    L.puddles.push({ x: G.player.x + 200, y: G.player.y, rx: 30, ry: 16, kind: 'water' });
    const n0 = A.dyn.length;
    A.addBlood(G.player.x + 200, G.player.y + 2, 8);
    out.bloodInWater = A.dyn.length !== n0;
    A.addBlood(G.player.x + 200 + 34, G.player.y, 8); // beside it: a stain, but it does not spread into the water
    const b = A.dyn[A.dyn.length - 1];
    for (let i = 0; i < 12; i++) A.addBlood(b.x, b.y, 12);
    out.bloodClash = A.clashes(b);
    L.puddles.pop();
    return out;
  });
  ok('puddles stand apart, on floor only and off solid pieces', r.puddles >= r.stages * 3 && !r.overlap && !r.offFloor && !r.onSolid, r);
  ok('kill blood never lands in or grows into another puddle', !r.bloodInWater && !r.bloodClash, r);

  // 6: tall bushes, mushrooms, lanterns and candelabras block; 7: camps are stockades; every stage has a landmark
  r = await page.evaluate(() => {
    const out = { tallLoose: 0, tallSolid: 0, camps: 0, walled: 0, landmarks: 0, stages: 0, giantDecal: 0 };
    for (const [biome, s] of [['deadwood', 2], ['gaslight', 4], ['catacombs', 5], ['castle', 8], ['volcano', 7], ['zombie', 6], ['wasteland', 6], ['frozen', 7], ['dungeon', 5]]) {
      const L = CH.LevelGen.generate(biome, s, CH.U.seeded(s * 7 + 3));
      out.stages++;
      for (const p of L.props) {
        if (!CH.Props.TALL[p.cat] || !CH.Sprites.has(p.sprite)) continue;
        if (CH.Sprites.get(p.sprite).h >= 17) { if (p.solid) out.tallSolid++; else out.tallLoose++; }
      }
      for (const c of L.camps || []) { out.camps++; const wall = L.props.filter((p) => p.join && Math.hypot(p.x - c.x, p.y - c.y) < 160); if (wall.length >= 6) out.walled++; }
      if (L.lore && L.lore.length) out.landmarks++;
      for (const d of L.decals || []) if (d.img && Math.max(d.img.width, d.img.height) > 56 && /decal|scrawl/.test(CH.Props.kindOf(d.key) || '')) out.giantDecal++;
    }
    return out;
  });
  ok('standing bushes, mushrooms, lanterns and candelabras are solid', r.tallSolid > 20 && r.tallLoose === 0, r);
  ok('enemy camps are walled stockades', r.camps >= 6 && r.walled >= r.camps * 0.8, r);
  ok('every stage has a landmark with lore', r.landmarks === r.stages, r);
  ok('no giant stains or splats on the floors', r.giantDecal === 0, r);

  // the lore stone: READ gives a little experience once per area
  r = await page.evaluate(() => {
    const G = CH.G;
    G.bossDying = null; G.victoryPending = false;
    if (G.state === 'victory' && CH.Areas.afterVictory) CH.Areas.afterVictory();
    if (CH.Town.inTown) CH.Town.leave();
    G.startWave(7);
    if (CH.Town.inTown) CH.Town.leave();
    const L = G.level, p = G.player, s = L.lore && L.lore[0];
    if (!s) return { lore: false };
    __clear();
    L.explored.fill(1);
    p.x = s.x; p.y = s.y + 14;
    __step(2);
    const f = CH.Interact.focus.get(p);
    const xp0 = p.xp + p.level * 1e6;
    G.interact(p);
    const out = { lore: true, focus: f && f.verb, gained: p.xp + p.level * 1e6 > xp0, dialog: G.state === 'dialog' };
    if (CH.Dialogue.skip) for (let i = 0; i < 4 && G.state === 'dialog'; i++) CH.Dialogue.skip();
    const xp1 = p.xp + p.level * 1e6;
    s.read = false;
    if (G.state === 'playing') G.interact(p);
    out.once = p.xp + p.level * 1e6 === xp1;
    return out;
  });
  ok('a landmark\'s lore stone is READ with the button and pays once', r.lore && r.focus === 'READ' && r.gained && r.once, r);

  ok('no console errors', errs.length === 0, errs.slice(0, 5));
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
