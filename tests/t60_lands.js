/* The second drop of 2026-10-24 (PLAN.md 21): the Dungeon Asset Pack's wall pieces in every direction in every walled
   biome, with doors, windows, signs and chains of the biomes' own packs mounted on them; every piece of a biome's packs
   shown across its five stages (each stage deals its own fifth of every pool, a sweep places what the scenes left);
   the Undead Land Objects and the Seabed as props of the Dead Wood, the Catacombs, the Gaslight District and the Crypt;
   the last area is the sky road over flying islands to the Final Tower, whose maw leads into the belly where the final
   boss waits. */
const { open } = require('./lib');
(async () => {
  const { browser, page, errs } = await open({ levels: true });
  let fails = 0;
  const ok = (name, c, extra) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + name + (c ? '' : ' ' + JSON.stringify(extra))); };

  await page.evaluate(() => {
    const G = CH.G, St = CH.Storage;
    localStorage.removeItem(St.KEY3);
    St.load();
    St.createSlot({ hero: 'Mercenary', name: 'Surveyor' });
    G._scriptTesting = true;
    G.newRun(null);
    window.__step = (n) => { for (let i = 0; i < (n || 1); i++) CH.stepFrame(1 / 30); };
    // which pack images a stage's chunks draw
    const IM = CH.Assets.images, rev = new Map();
    for (const k of Object.keys(IM)) rev.set(IM[k], k);
    const di = CanvasRenderingContext2D.prototype.drawImage;
    window.__drawn = null;
    CanvasRenderingContext2D.prototype.drawImage = function (im) { if (window.__drawn) { const k = rev.get(im); if (k) window.__drawn.add(k); } return di.apply(this, arguments); };
    window.__build = (n) => {
      if (CH.Town && CH.Town.inTown) CH.Town.leave();
      window.__drawn = new Set();
      G.startWave(n);
      if (CH.Town && CH.Town.inTown) CH.Town.leave();
      const L = G.level;
      for (let cy = 0; cy * 8 < L.th; cy++) for (let cx = 0; cx * 8 < L.tw; cx++) L.chunk(cx, cy);
      const used = window.__drawn;
      window.__drawn = null;
      for (const p of L.props) if (p.sheet) used.add(p.sheet);
      for (const d of L.decals) if (d.key) used.add(d.key);
      for (const k of L.wallKeys || []) used.add(k);
      return used;
    };
  });

  // the new packs are loaded
  let r = await page.evaluate(() => {
    const M = CH.Assets.meta.lands || {};
    const S = M.sheets || {};
    return { sheets: Object.keys(S), anims: Object.keys(M.anims || {}).length, tower: !!CH.Assets.images['kit.ft_tower'], ul: S.ul1 && S.ul1.n, sb: S.sb1 && S.sb1.n, kinds: ['lich', 'carcass', 'opengrave', 'leviathan', 'kraken', 'coral', 'anemone', 'heart', 'floater'].filter((k) => !CH.Props.pool(k, 'usitb').length) };
  });
  ok('the five new packs are cut and loaded (undead, seabed, islands, tower, belly)', ['ul1', 'sb1', 'sb3', 'fi1', 'fiG', 'ft1', 'ftG', 'mb1', 'mbG'].every((s) => r.sheets.includes(s)) && r.anims > 100 && r.tower && r.ul > 100 && r.sb > 100 && !r.kinds.length, r);

  // walls: every walled biome draws the Dungeon Asset Pack's wall pieces, faces and corners, and mounts its own pieces
  r = await page.evaluate(() => {
    const out = {};
    for (const [n, own] of [[7, 'kit.da'], [13, 'kit.hv'], [18, 'sh.z_'], [23, 'sh.h_'], [29, 'sh.w_'], [34, 'kit.fk'], [40, 'sh.v_'], [45, 'sh.v_chains'], [2, 'kit.cf']]) {
      const used = __build(n);
      const da2 = [...used].filter((k) => k.startsWith('kit.da2.'));
      const W = CH.Walls.keysOf(CH.G.level.biome);
      const mounts = [...(CH.G.level.wallKeys || [])].filter((k) => W.includes(k) && !k.startsWith('kit.da2.') && !k.startsWith('sh.v_obsidian') && !k.startsWith('sh.h_corner') && (k.startsWith(own) || own === 'kit.da'));
      out[n] = { biome: CH.G.level.biome, da2: da2.length, corners: da2.filter((k) => [9, 10, 22, 23, 31, 32, 33, 34, 41, 42, 43, 44, 52, 53, 54, 55].includes(+k.split('.').pop())).length, mounts: mounts.length };
    }
    return out;
  });
  ok('every walled biome is walled with the Dungeon Asset Pack: faces, corners and its own mounted doors / windows / signs / chains', Object.values(r).every((q) => q.da2 >= 4 && q.corners >= 2 && q.mounts >= 2), r);

  // a sealed vault behind a door in a dungeon wall: the prompt, the button, the treasure room, and out again
  r = await page.evaluate(() => {
    const G = CH.G;
    __build(7);
    const L = G.level, v = (L.vaults || [])[0];
    if (!v) return { vaults: 0 };
    const p = G.player;
    p.x = v.x; p.y = v.y + 8; p.invuln = 99;
    __clear();
    __step(2);
    const f = CH.Interact.focus.get(p);
    G.interact(p);
    __step(5);
    const inside = G.level.interior && G.level.name, chest = G.level.chests[0] && G.level.chests[0].tier;
    if (CH.Interiors.outside) CH.Interiors.leave();
    __step(2);
    return { vaults: L.vaults.length, focus: f && f.name, inside, chest, back: G.level === L };
  });
  ok('a dungeon has a sealed vault behind a wall door: ENTER it, a treasure room, and back out', r.vaults >= 1 && r.focus === 'SEALED VAULT' && r.inside === 'A Sealed Vault' && r.back, r);

  // coverage: the five Catacombs stages together show (nearly) every piece of the Dungeon Asset Pack
  r = await page.evaluate(() => {
    const seen = new Set();
    for (let n = 6; n <= 10; n++) for (const k of __build(n)) seen.add(k);
    const MK = CH.Assets.meta.kits;
    const SKIP = CH.SetPieces.NOSWEEP;
    let total = 0, got = 0;
    const miss = [];
    for (const id of Object.keys(MK)) {
      if (!id.startsWith('da')) continue;
      for (let i = 0; i < MK[id].n; i++) {
        const key = 'kit.' + id + '.' + i, kind = CH.Props.kindOf(key);
        if (!kind || kind === 'ground' || kind === 'door' || SKIP[kind]) continue; // floors, the exit doors, the hand-placed kinds
        total++;
        if (seen.has(key)) got++; else miss.push(key + ':' + kind);
      }
    }
    return { total, got, share: got / total, miss: miss.slice(0, 12) };
  });
  ok('the five Catacombs stages show at least 90% of the Dungeon Asset Pack\'s props', r.share >= 0.9, r);

  // the undead and the seabed dress their biomes; scenes of their own
  r = await page.evaluate(() => {
    const out = {};
    for (const n of [2, 8, 23]) {
      const used = [...__build(n)];
      out[n] = { ul: used.filter((k) => k.startsWith('kit.ul1.')).length, sb: used.filter((k) => k.startsWith('kit.sb') || k.startsWith('anim.sb_')).length, anim: CH.G.level.props.filter((p) => p.fps).length };
    }
    return out;
  });
  ok('Undead Land Objects dress the Dead Wood, the Catacombs and the Crypt', r[2].ul >= 8 && r[8].ul >= 8 && r[23].ul >= 8, r);
  ok('the Seabed is drowned in the Catacombs and the Crypt, its weeds and anemones animated', r[8].sb >= 10 && r[23].sb >= 10 && r[8].anim + r[23].anim >= 4, r);

  // the last area: the sky road, the tower, the maw, the belly
  r = await page.evaluate(() => {
    const G = CH.G;
    __build(49);
    const L = G.level;
    const isl = L.rooms.length, bridges = L.skyBridge ? L.skyBridge.filter((b) => b).length : 0;
    const p = G.player;
    p.x = L.exit.x; p.y = L.exit.y + 12; p.invuln = 99;
    __clear();
    __step(2);
    const f1 = CH.Interact.focus.get(p);
    const sealed = f1 && f1.verb;
    L.exit.open = true;
    for (const s of L.spawners) s.dead = true;
    __step(2);
    const f2 = CH.Interact.focus.get(p);
    const out = { biome: L.biome, isl, bridges, tower: !!L.tower, maw: !!L.maw, sealed, name: f2 && f2.name, verb: f2 && f2.verb, mawFps: L.maw && L.maw.fps };
    G.interact(p);
    __step(60);
    const B = G.level;
    out.inside = B.biome; out.hall = !!B.bossHall; out.boss = G.enemies.some((e) => e.isBoss && !e.dead);
    out.heart = B.props.some((q) => q.sheet === 'anim.mb_heart');
    return out;
  });
  ok('area 49 is the sky road: islands joined by bridges, the Final Tower at the end', r.biome === 'sky' && r.isl >= 6 && r.bridges > 100 && r.tower && r.maw, r);
  ok('the tower\'s maw is sealed until the breaches close, then opens its teeth: ENTER THE FINAL TOWER', r.sealed === 'SEALED' && r.verb === 'ENTER' && r.name === 'THE FINAL TOWER' && r.mawFps > 0, r);
  ok('inside is the belly: a boss hall of flesh with a beating heart, and the final boss walks in', r.inside === 'belly' && r.hall && r.boss && r.heart, r);
  r = await page.evaluate(() => {
    const G = CH.G;
    const b = G.enemies.find((e) => e.isBoss && !e.dead);
    if (b) G.killEnemy(b);
    __step(150);
    // the tower fights on: its two hearts wake (js/sky.js); stop them both
    for (const h of G.enemies.filter((q) => q.heart && !q.dead)) G.killEnemy(h);
    __step(30);
    const L = G.level, p = G.player;
    p.x = L.exit.x; p.y = L.exit.y + 12;
    __clear();
    __step(2);
    const f = CH.Interact.focus.get(p);
    return { open: L.exit.open, name: f && f.name };
  });
  ok('the final boss falls and THE WAY HOME opens in the belly', r.open && r.name === 'THE WAY HOME', r);

  ok('no console errors', errs.length === 0, errs.slice(0, 5));
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
