/* Real tile walls and campfires: walls come from the pack's wall sheets (no flat colour blocks), campfires are packed,
   placed in levels / arenas / town, sway with the weather's wind, light the scene and cast shadows through the shader. */
const { open } = require('./lib');
const path = require('path');
(async () => {
  const { browser, page, errs } = await open({ levels: true, fx: 'high' });
  let fails = 0;
  const ok = (name, c, extra) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + name + (c ? '' : ' ' + JSON.stringify(extra))); };
  const frames = (n) => page.evaluate((n) => { for (let i = 0; i < n; i++) { const cbs = window.__raf.splice(0); cbs.forEach((c) => c(performance.now() + i * 16)); } }, n);

  const keys = await page.evaluate(() => ['cyan', 'green', 'amber', 'orange', 'purple'].map((c) => !!CH.Assets.images['prop.camp.' + c] && !!CH.Assets.images['prop.campsmoke.' + c]));
  ok('all 5 colours packed (clean + smoke)', keys.every(Boolean), keys);

  for (const biome of ['backyard', 'office', 'glitch', 'zombie', 'wasteland', 'volcano', 'dungeon', 'frozen']) {
    const r = await page.evaluate((b) => {
      CH.X.startRun({ mode: 'classic' }, null);
      CH.G.pathArena = () => b;
      CH.Run.startLevel(1);
      const L = CH.G.level;
      const fires = L.props.filter((p) => p.fire);
      const near = fires.some((f) => Math.hypot(f.x - L.entrance.x, f.y - L.entrance.y) < 130);
      // the walls are painted from a sheet: the chunk holding the entrance must not be built from flat wall colour only
      const sheet = !!CH.Assets.images[L.style.sheet];
      return { n: fires.length, near, sheet, solid: fires.every((f) => f.solid && f.jumpable && !f.destructible) };
    }, biome);
    ok(biome + ': campfires placed (' + r.n + '), one by the entrance', r.n >= 1 && r.near, r);
    ok(biome + ': walls use a real tile sheet, fires are solid + jumpable', r.sheet && r.solid, r);
  }

  // the sliced sheets: every sheet of the four packs gives pieces, and each biome uses them
  const sh = await page.evaluate(() => { const M = CH.Assets.meta.sheets; return { ids: Object.keys(M).length, empty: Object.keys(M).filter((k) => !M[k].n), pieces: Object.keys(CH.Assets.images).filter((k) => k.startsWith('sh.')).length }; });
  ok('all ' + sh.ids + ' sheets sliced into pieces (' + sh.pieces + ')', sh.ids >= 45 && !sh.empty.length && sh.pieces > 1000, sh);
  for (const biome of ['dungeon', 'volcano', 'zombie', 'wasteland']) {
    const r = await page.evaluate((b) => {
      CH.X.startRun({ mode: 'classic' }, null); CH.G.pathArena = () => b; CH.Run.startLevel(1);
      const L = CH.G.level;
      return { decals: (L.decals || []).length, props: L.props.filter((p) => p.sheet).length, glow: L.props.filter((p) => p.glow).length, gate: !!L.exit.gate, wallSheet: L.style.sheet };
    }, biome);
    ok(biome + ': sheet decals, props, gate and its own wall set', r.decals > 5 && r.props > 5 && r.gate && /^wall./.test(r.wallSheet), r);
  }
  // wind follows the weather and bends the flame; lights carry the shadow flag; the occluder map is drawn
  const w = await page.evaluate(() => {
    const A = CH.Atmos, F = CH.Fires;
    A.setMode('clear'); for (let i = 0; i < 400; i++) F.update(0.1);
    const calm = F.wind;
    A.setMode('storm'); for (let i = 0; i < 400; i++) F.update(0.1);
    return { calm, storm: F.wind };
  });
  ok('storm wind is much stronger than a clear day', w.storm > w.calm * 3, w);

  await page.evaluate(() => { CH.X.startRun({ mode: 'classic' }, null); CH.G.pathArena = () => 'backyard'; CH.Run.startLevel(1); const f = CH.G.level.props.find((p) => p.fire); CH.G.player.x = f.x - 30; CH.G.player.y = f.y + 30; CH.Atmos.clock = 0.74; CH.Atmos.dark = 0.9; CH.Atmos.setMode('clear'); });
  await frames(30);
  const l = await page.evaluate(() => ({ lights: CH.Atmos.lights.filter((q) => q[7] & 1).length, occ: CH.Atmos.occUsed, fx: CH.PostFX.on }));
  ok('fires are shadow-casting lights and the occluder map is drawn', l.lights >= 1 && l.occ && l.fx, l);
  const lit = await page.evaluate(() => {
    const f = CH.G.level.props.find((p) => p.fire), cam = CH.G.cam, c = document.getElementById('fx');
    return { ok: !!c && c.style.display !== 'none' };
  });
  ok('shader pass is on', lit.ok, lit);
  await page.screenshot({ path: path.join(__dirname, 'fire_night.png') });

  // swaying: the same frame drawn at two different wind phases differs at the flame tip
  const sway = await page.evaluate(() => {
    const F = CH.Fires; const a = []; const old = CH.G.wall;
    for (const t of [0, 1.7, 3.1, 4.9]) { CH.G.wall = t; a.push(F.sway(100)); }
    CH.G.wall = old;
    return a;
  });
  ok('the sway varies over time (gusts)', Math.max(...sway) - Math.min(...sway) > 0.1, sway);

  // town and arenas
  const t = await page.evaluate(() => { const T = CH.Town.build(); return T.props.filter((p) => p.fire).length; });
  ok('the town has campfires', t >= 3, t);
  const ar = await page.evaluate(() => ['backyard', 'office', 'zombie', 'wasteland', 'volcano', 'dungeon'].map((id) => CH.Arenas.build(id).props.filter((p) => p.fire).length));
  ok('every boss / wave arena has braziers', ar.every((n) => n >= 2), ar);

  ok('no console errors', errs.length === 0, errs.slice(0, 5));
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
