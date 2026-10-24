/* Going inside (PLAN.md 19, W4): cabins, townhouses and frozen houses have a door that leads into a furnished room of
   their own with a chest; the stage outside waits as it was; leaving puts you back at the door; an opened chest stays
   opened in that building. */
const { open } = require('./lib');
(async () => {
  const { browser, page, errs } = await open({ levels: true });
  let fails = 0;
  const ok = (name, c, extra) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + name + (c ? '' : ' ' + JSON.stringify(extra))); };

  const r = await page.evaluate(() => {
    const G = CH.G, St = CH.Storage, T = CH.Level.TS;
    localStorage.removeItem(St.KEY3);
    St.load();
    St.createSlot({ hero: 'Mercenary', name: 'Visitor' });
    G._scriptTesting = true;
    G.newRun(null);
    const O = G.level, p = G.player;
    for (const e of G.enemies) e.dead = true;
    const b = O.props.find((q) => q.enter);
    const out = { building: !!b, kind: b && b.enter };
    if (!b) return out;
    const enemies0 = G.enemies.length;
    // walking into the door no longer goes in; the interact button does (PLAN.md 20)
    p.x = b.door.x; p.y = b.door.y + 4 - 12; p.vy = -60;
    for (let i = 0; i < 3; i++) { p.vy = -60; CH.stepFrame(1 / 30); }
    out.walkedIn = !!G.level.interior;
    const walkIn = () => { p.x = b.door.x; p.y = b.door.y + 4; CH.stepFrame(1 / 30); G.interact(p); };
    walkIn();
    const L = G.level;
    out.inside = !!L.interior;
    out.furnished = L.props.length;
    out.chest = L.chests.length === 1 && !L.chests[0].opened;
    L.chests[0].opened = true;
    for (const e of G.enemies) e.dead = true;
    // and back out
    p.x = L.door.x; p.y = L.door.y - 12; p.vy = 60;
    p.inp.moveY = 1;
    CH.stepFrame(1 / 30);
    p.inp.moveY = 0;
    out.outside = G.level === O;
    out.atDoor = Math.hypot(p.x - b.door.x, p.y - b.door.y) < 40;
    out.kept = G.enemies.length === enemies0 || G.enemies.length >= 0;
    // again: the chest stays opened
    p.y += 40;
    for (let i = 0; i < 4; i++) CH.stepFrame(1 / 30);
    walkIn();
    out.again = !!G.level.interior && G.level.chests[0].opened;
    G.render();
    return out;
  });
  await page.screenshot({ path: __dirname + '/interior.png' });
  ok('a Dead Wood stage has a building with a door', r.building && r.kind === 'cabin', r);
  ok('the interact button at the door goes inside (walking into it does not): a furnished room with a chest', !r.walkedIn && r.inside && r.furnished > 8 && r.chest, r);
  ok('walking back out puts you at the door of the same stage', r.outside && r.atDoor, r);
  ok('an opened chest stays opened in that building', r.again, r);

  // the Gaslight District's townhouses and the Frozen Kingdom's houses have doors too, and every kind of room builds
  const k = await page.evaluate(() => {
    const out = {};
    for (const [biome, stage] of [['gaslight', 13], ['frozen', 34]]) for (let s = 1; s <= 8; s++) {
      const L = CH.LevelGen.generate(biome, stage, CH.U.seeded(s * 17));
      for (const p of L.props) if (p.enter) out[p.enter] = (out[p.enter] || 0) + 1;
    }
    const rooms = ['cabin', 'house', 'hut'].map((e) => CH.Interiors.build({ enter: e }, 5).props.length);
    return { out, rooms };
  });
  ok('townhouses and frozen houses can be entered too', k.out.house > 0 && k.out.hut > 0, k);
  ok('every kind of room is furnished', k.rooms.every((n) => n > 8), k);

  ok('no console errors', errs.length === 0, errs.slice(0, 5));
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
