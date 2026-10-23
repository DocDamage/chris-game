/* Third playtest (PLAN.md section 15): enemy art and size, ground contact, crowds, the heroes' own weapons, prop
   collision, stage set pieces, the hideout, the skill tree, the main menu and the VFX / SFX packs. */
const { open } = require('./lib');
(async () => {
  const { browser, page, errs } = await open({ levels: true });
  let fails = 0;
  const ok = (name, c, extra) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + name + (c ? '' : ' ' + JSON.stringify(extra))); };

  // 1. art: every VFX pack is packed, the new weapon sounds exist, enemies have their fixed strips
  let r = await page.evaluate(() => {
    const keys = Object.keys(CH.Assets.images);
    const packs = [1, 2, 3, 4, 5, 6, 7].map((n) => keys.filter((k) => k.startsWith('vfx.p' + n + '.')).length);
    const S = CH.Sprites;
    const spider = S.get('spider');
    const sp = spider.anims;
    // the spider walk strip had 32px cuts of 56px frames: every walk frame must hold a whole spider (wide body)
    const goblin = S.get('goblin');
    return {
      packs,
      sfx: ['sword_heavy', 'saber', 'knife', 'punch', 'bow_draw', 'pistol', 'hit_flesh', 'clang'].filter((n) => (CH.Assets.sfx[n] || []).length > 0).length,
      spiderW: spider.w, spiderSleep: !!sp.sleep, spiderWalk: sp.walk.n,
      goblinAttack: goblin.anims.attack.n, goblinDirs: !!goblin.anims.walk_d && !!goblin.anims.walk_u,
      orcDirs: !!S.get('orc').anims.walk_d, golemDirs: !!S.get('golem').anims.walk_u,
    };
  });
  ok('all seven VFX packs are packed', r.packs.every((n) => n > 50), r.packs);
  ok('spider frames are whole (56px), it has a sleep pose', r.spiderW > 40 && r.spiderSleep && r.spiderWalk >= 4, r);
  ok('goblin attack has its 5 real frames; top-down packs have down / up rows', r.goblinAttack === 5 && r.goblinDirs && r.orcDirs && r.golemDirs, r);
  ok('the new weapon sounds are bundled', r.sfx === 8, r);

  // 2. enemies are bigger, stand on the ground (no baked shadow, no floating frames)
  r = await page.evaluate(() => {
    const S = CH.Sprites, L = CH.Enemies.look;
    const out = { small: [], float: [] };
    for (const t of Object.keys(L)) {
      const s = S.has(L[t].sprite) ? S.get(L[t].sprite) : null;
      if (!s || !s.body) continue;
      if (!L[t].fly && s.body.h < 18) out.small.push(t + ':' + s.body.h);
      // the lowest solid row of every idle / walk frame sits on the anchor (after the ground snap)
      for (const an of ['idle', 'walk']) {
        const a = s.anims[an];
        if (!a || L[t].fly) continue;
        for (let i = a.s; i < a.s + a.n; i++) {
          const c = s.frames[i], d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
          let b = -1;
          for (let y = c.height - 1; y >= 0 && b < 0; y--) { let n = 0; for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 128) n++; if (n >= 2) b = y + 1; }
          const off = b + (s.fdy ? s.fdy[i] : 0) - s.ay;
          if (Math.abs(off) > 1.5) { out.float.push(t + '.' + an + i + ':' + off.toFixed(1)); break; }
        }
      }
    }
    return out;
  });
  ok('ground enemies are at least 18px tall', r.small.length === 0, r.small);
  ok('idle / walk frames stand on the feet line', r.float.length === 0, r.float.slice(0, 6));

  // 3. crowds keep apart; heroes are solid to them
  r = await page.evaluate(() => {
    CH.X.startRun({ mode: 'classic' }, null); CH.G.pathArena = () => 'backyard'; CH.Run.startLevel(1);
    const G = CH.G, p = G.player, L = G.level;
    G.enemies.length = 0; L.packs.length = 0; for (const s of L.spawners) s.dead = true;
    const c = L.nearestOpen(L.rooms[1].cx, L.rooms[1].cy);
    p.x = c.x + 200; p.y = c.y; p.invuln = 999;
    for (let i = 0; i < 14; i++) G.spawnEnemy('slime', c.x + (i % 4) * 2, c.y + Math.floor(i / 4) * 2, { spawnTime: 0 });
    for (let i = 0; i < 120; i++) { for (const e of G.enemies) e.atkCd = 9; G.update(1 / 60); }
    let close = 0;
    const es = G.enemies.filter((e) => !e.dead);
    for (let i = 0; i < es.length; i++) for (let j = i + 1; j < es.length; j++) if (Math.hypot(es[i].x - es[j].x, es[i].y - es[j].y) < 6) close++;
    const onHero = es.filter((e) => Math.hypot(e.x - p.x, e.y - p.y) < 8).length;
    return { n: es.length, close, onHero };
  });
  ok('a swarm spreads out instead of stacking on one spot', r.n >= 10 && r.close <= 2, r);
  ok('nobody stands inside the hero', r.onHero === 0, r);

  // 4. every hero fights with their own weapon; swords reach far and hit what they reach
  r = await page.evaluate(() => {
    const out = {};
    for (const h of CH.Balance.heroes) {
      CH.Storage.settings.hero = h.id;
      CH.X.startRun({ mode: 'classic' }, null); CH.G.pathArena = () => 'backyard'; CH.Run.startLevel(1);
      const G = CH.G, p = G.player, L = G.level;
      G.enemies.length = 0; L.packs.length = 0; L.props.length = 0; for (const s of L.spawners) s.dead = true;
      const d = CH.HeroAtk.sigOf(p);
      const c = L.nearestOpen(L.rooms[1].cx, L.rooms[1].cy);
      p.x = c.x; p.y = c.y;
      const dist = d.kind === 'melee' ? d.reach - 8 : d.kind === 'pulse' ? d.reach - 6 : 140;
      const e = G.spawnEnemy('orc', p.x + dist, p.y, { spawnTime: 0, hpMul: 50 });
      e.speed = 0; e.atkCd = 99;
      p.aim = 0;
      const hp0 = e.hp;
      CH.Weapons.tryFire(G, p, p.weapon);
      const atk = !!p.atk;
      for (let i = 0; i < 70; i++) { e.atkCd = 99; G.update(1 / 60); }
      out[h.id] = { weapon: p.weapon, kind: d.kind, atk, hit: e.hp < hp0, slot2: p.weapon2, dur: d.dur };
    }
    return out;
  });
  const heroes = Object.keys(r);
  ok('six heroes, each with their own main weapon and the Junk Launcher second', heroes.length === 6 && heroes.every((h) => r[h].weapon !== 'junk' && r[h].slot2 === 'junk'), r);
  ok('every own weapon starts an animated attack and hits a target at its reach', heroes.every((h) => r[h].atk && r[h].hit), r);
  r = await page.evaluate(() => Object.values(CH.HeroAtk.SIG).filter((d) => d.kind === 'melee').map((d) => d.reach));
  ok('sword reach is long (Diablo-like)', r.every((x) => x >= 56), r);

  // 5. props: catalogued, solid with a box footprint, nothing walks through them
  r = await page.evaluate(() => {
    const out = {};
    for (const b of ['zombie', 'wasteland', 'dungeon', 'volcano', 'backyard']) {
      CH.X.startRun({ mode: 'classic' }, null); CH.G.pathArena = () => b; CH.Run.startLevel(2);
      const L = CH.G.level, p = CH.G.player;
      const boxes = L.props.filter((q) => q.box && q.solid && !q.dead && !q.invisible);
      let through = 0;
      for (const q of boxes.slice(0, 40)) {
        // a hero pushed into the middle of the footprint ends up outside it
        p.x = q.x + (q.cx || 0); p.y = q.y + (q.cy || 0) - 10; p.z = 0; p.onProp = null;
        CH.Props.collide(p, 10, p.r || 5);
        if (CH.Props.touches(q, p.x, p.y + 10, 0)) through++;
      }
      const sheet = L.props.filter((q) => q.sheet);
      out[b] = { boxes: boxes.length, through, sheetSolid: sheet.filter((q) => q.solid).length, sheet: sheet.length, camps: (L.camps || []).length, trail: !!L.trail, decals: (L.decals || []).length };
    }
    return out;
  });
  ok('stages are dressed from the catalogue with solid box props', Object.values(r).every((b) => b.boxes >= 30 && b.sheetSolid >= 20), r);
  ok('no box prop can be stood inside', Object.values(r).every((b) => b.through === 0), r);
  ok('every stage has camps or nests around its breaches and a trail from entrance to exit', Object.values(r).every((b) => b.camps >= 2 && b.trail), r);

  // 6. camps are lived in: their monsters come out and loiter before a hero arrives
  r = await page.evaluate(() => {
    CH.X.startRun({ mode: 'classic' }, null); CH.G.pathArena = () => 'wasteland'; CH.Run.startLevel(1);
    const G = CH.G, L = G.level, p = G.player;
    const pk = L.packs.find((q) => q.camp);
    if (!pk) return { none: true };
    p.x = pk.x - 420; p.y = pk.y; p.invuln = 999;
    const a = L.nearestOpen(p.x, p.y); p.x = a.x; p.y = a.y;
    for (let i = 0; i < 30; i++) G.update(1 / 60);
    const lo = G.enemies.filter((e) => e.loiter && !e.dead);
    const d = Math.hypot(p.x - pk.x, p.y - pk.y);
    return { woke: pk.woke, loiter: lo.length, d: Math.round(d) };
  });
  ok('camp monsters loiter around their camp before you get there', r.none || (r.woke && r.loiter >= 2) || r.d > 600, r);

  // 7. the hideout: a laid-out place, people block, stalls furnished
  r = await page.evaluate(() => {
    CH.X.startRun({ mode: 'classic' }, null); CH.Run.startLevel(1); CH.Town.enter('portal');
    const L = CH.G.level;
    const npcProps = L.props.filter((q) => q.npc);
    const near = (n, d) => L.props.filter((q) => !q.npc && q.solid && Math.hypot(q.x - n.px, q.y - n.py) < d).length;
    const stalls = {};
    for (const n of L.npcs) stalls[n.id] = near(n, 110);
    return { hideout: !!L.hideout, npcs: L.npcs.length, npcProps: npcProps.length, stalls, fires: L.props.filter((q) => q.fire).length, trail: !!L.trail, giant: L.props.some((q) => q.sprite === 'obj.giantTree') };
  });
  ok('the hideout is built as a place (stalls by every townsperson, fires, roads, the giant tree)', r.hideout && r.npcs === 6 && Object.values(r.stalls).every((n) => n >= 2) && r.fires >= 3 && r.trail && r.giant, r);
  ok('townspeople are solid', r.npcProps === 6, r);

  // 8. the skill tree replaces the cards
  r = await page.evaluate(() => {
    CH.Storage.settings.hero = 'Vexaria';
    CH.X.startRun({ mode: 'classic' }, null); CH.Run.startLevel(1);
    const G = CH.G, p = G.player;
    CH.Upgrades.addXp(G, 400, p);
    for (let i = 0; i < 20; i++) G.update(1 / 60);
    const st = { state: G.state, sp: p.sp, level: p.level };
    const trees = CH.Skills.trees(p).map((t) => t.nodes.length);
    const locked = CH.Skills.canLearn(p, CH.Skills.trees(p)[0].nodes.find((n) => n.tier === 4));
    const reach0 = CH.HeroAtk.reach(p, { d: CH.HeroAtk.sigOf(p) });
    CH.Skills.learn(p, 'reach'); CH.Skills.learn(p, 'mastery'); CH.Skills.learn(p, 'bonk');
    const reach1 = CH.HeroAtk.reach(p, { d: CH.HeroAtk.sigOf(p) });
    return { st, trees, locked, reach0, reach1, wl: p.ws[p.weapon].level, bonk: p.upgrades.bonk, spLeft: p.sp };
  });
  ok('levelling gives skill points, never a card screen', r.st.state === 'playing' && r.st.sp === r.st.level - 1, r);
  ok('three trees with tiers gated by level', r.trees.length === 3 && r.trees.every((n) => n >= 10) && /LEVEL/.test(r.locked), r);
  ok('skills change the game: reach, weapon level, damage', r.reach1 > r.reach0 && r.wl === 2 && r.bonk === 1, r);

  // 9. the main menu: five buttons, a quiet row of links
  r = await page.evaluate(() => {
    CH.G.toMenu && CH.G.toMenu();
    const vis = (sel) => Array.from(document.querySelectorAll(sel)).filter((b) => b.offsetParent).map((b) => b.id);
    return { main: vis('#screen-main .menu-col .btn'), more: vis('#screen-main .menu-more .btn'), strip: getComputedStyle(document.getElementById('controls-strip')).display };
  });
  ok('main menu: PLAY, HERO, CO-OP, JOURNAL, SETTINGS', JSON.stringify(r.main) === JSON.stringify(['btn-play', 'btn-heroes', 'btn-coop', 'btn-journal', 'btn-settings']), r);
  ok('the rest is a link row, no key strip', r.more.length === 5 && r.strip === 'none', r);

  ok('no console errors', errs.length === 0, errs.slice(0, 5));
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
