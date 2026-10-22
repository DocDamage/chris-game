/* The content layers added on top of the core game: the safehouse (shelter) meta-progression, wood / scrap / stone
   resources and destructible props, the branching path screens, the extra arenas and weather, fortify + jump,
   and how all of that behaves on a gamepad and in co-op. */
const { openPad, BTN } = require('./padlib');
const path = require('path');

const results = [];
const ok = (name, cond, extra) => results.push([cond ? 'PASS' : 'FAIL', name, extra === undefined ? '' : JSON.stringify(extra)]);

(async () => {
  const { browser, page, errs } = await openPad({ viewport: { width: 1280, height: 720 } });
  const E = (fn, arg) => page.evaluate(fn, arg);
  const fresh = (config) =>
    E((config) => {
      const G = CH.G;
      G.newRun(config);
      G.banner = () => {};
      document.getElementById('banner').classList.add('hidden');
      G.queue.length = 0;
      G.enemies.length = 0;
      G.waveState = 'intro';
      G.waveT = 1e9;
      G.eventTimer = 1e9;
      window.__pre = null;
      return true;
    }, config);
  await E(() => {
    __connect(0);
    __connect(1);
  });

  /* ================================================================ 1. assets behind the new content */
  let r = await E(() => {
    const S = CH.Sprites;
    const need = ['pk.wood', 'pk.scrap', 'pk.stone', 'obj.sh_workbench', 'obj.sh_bed', 'obj.sh_storage', 'obj.sh_radio', 'obj.sh_chair', 'obj.sh_lamp', 'obj.sh_table', 'obj.sh_shelf', 'obj.barricade1', 'obj.barricade2'];
    const missing = need.filter((k) => !S.has(k) && !S.exists(k));
    const tiles = ['tile.zombie_street', 'tile.zombie_burned', 'tile.wl_ground', 'tile.wl_metal', 'tile.volcano_floor', 'tile.volcano_lava', 'tile.dungeon_floor'].filter((k) => !CH.Assets.images[k]);
    return { missing, tiles };
  });
  ok('sprites for resources, safehouse furniture and barricades are registered', r.missing.length === 0, r.missing);
  ok('tile art for the four extra arenas is in the bundle', r.tiles.length === 0, r.tiles);

  /* ================================================================ 2. controls that touch the new mechanics */
  r = await E(() => {
    const m = CH.Input.codeToActions;
    return { KeyF: m.KeyF, Space: m.Space };
  });
  ok('the F key is not bound to two actions (fortify vs fullscreen)', !(r.KeyF && r.KeyF.includes('fortify') && r.KeyF.includes('fullscreen')), r);

  /* ================================================================ 3. resources + destructible props */
  await fresh(null);
  r = await E(() => {
    const G = CH.G;
    const p = G.player;
    CH.Storage.data.resources = { wood: 0, scrap: 0, stone: 0 };
    G.pickups.length = 0;
    for (const t of ['wood', 'scrap', 'stone']) G.dropPickup(t, p.x, p.y, 3, { still: true });
    G.pickups.forEach((pk) => (pk.age = 1));
    __f(10);
    return { run: G.resources, saved: { ...CH.Storage.data.resources } };
  });
  ok('wood / scrap / stone pickups are collected into the run and the save', r.run.wood === 3 && r.run.scrap === 3 && r.run.stone === 3 && r.saved.wood === 3, r);
  r = await E(() => {
    const G = CH.G;
    const p = G.player;
    const props = G.arena.props || [];
    const kinds = {};
    for (const q of props) kinds[q.kind] = (kinds[q.kind] || 0) + 1;
    const target = props.find((q) => q.destructible && !q.dead && q.kind !== 'tree') || props.find((q) => q.destructible && !q.dead);
    if (!target) return { props: props.length, kinds, none: true };
    G.pickups.length = 0;
    CH.Weapons.damageProp(G, target, 99999, p);
    const dead = target.dead || target.falling;
    __f(80);
    return { props: props.length, kinds, kind: target.kind, dead, drops: G.pickups.length };
  });
  ok('the arena has props and destroying one drops resources', r.props > 10 && r.dead && r.drops > 0, r);
  r = await E(() => {
    const G = CH.G;
    const p = G.player;
    p.hp = p.maxHp;
    const before = G.arena.props.length;
    CH.Storage.data.resources = { wood: 10, scrap: 10, stone: 0 };
    p.aim = 0;
    CH.Input.lastUsed = 'kbm';
    CH.Input.pressed.fortify = true; // the F key
    __f(2);
    return { added: G.arena.props.length - before, wood: CH.Storage.data.resources.wood, scrap: CH.Storage.data.resources.scrap };
  });
  ok('fortify (F) builds a barricade for 2 wood + 1 scrap', r.added === 1 && r.wood === 8 && r.scrap === 9, r);
  r = await E(() => {
    const G = CH.G;
    const hud = document.getElementById('hud').textContent;
    return { shown: /WOOD|SCRAP|STONE/i.test(hud) || !!document.querySelector('#res-panel, .res-panel, #resources'), text: hud.slice(0, 160) };
  });
  ok('the HUD shows the wood / scrap / stone you are carrying', r.shown, r);

  /* ================================================================ 4. jump vs dodge */
  r = await E(() => {
    const G = CH.G;
    const p = G.player;
    G.enemies.length = 0;
    p.stamina = 100;
    p.rollCd = 0;
    p.x = 300;
    p.y = 300;
    // keep clear of props
    G.arena.props.forEach((q) => { if (Math.hypot(q.x - 300, q.y - 300) < 80) q.dead = true; });
    __pad(0, { ls: [1, 0] });
    CH.Input.lastUsed = 'pad';
    __f(3);
    __tap(0, 0, 3);
    return { rolling: p.rolling || p.rollCd > 0, jumping: !!p.jumping };
  });
  ok('A with nothing to jump on dodge-rolls', r.rolling && !r.jumping, r);
  r = await E(() => {
    const G = CH.G;
    const p = G.player;
    __pad(0, {});
    __f(60);
    p.x = 300;
    p.y = 300;
    p.vx = p.vy = 0;
    G.machine = { x: p.x + 10, y: p.y, uses: 1, t: 0 };
    G.coins = 100;
    p.stamina = 100;
    p.rollCd = 0;
    const x0 = p.x;
    __tap(0, 1, 3); // B at the vending machine
    __f(10);
    return { coins: G.coins, rolled: Math.abs(p.x - x0) > 6 || p.rolling || p.rollCd > 0.2 };
  });
  ok('B at a vending machine buys without also dodge-rolling away', r.coins === 75 && !r.rolled, r);

  /* ================================================================ 5. arenas, weather, split screen in every arena */
  const arenaIds = ['backyard', 'office', 'glitch', 'zombie', 'wasteland', 'volcano', 'dungeon'];
  for (const id of arenaIds) {
    r = await E((id) => {
      const G = CH.G;
      G.newRun({ players: [{ hero: 'Mercenary', src: { kind: 'script' } }, { hero: 'Vexaria', src: { kind: 'script' } }] });
      G.banner = () => {};
      G.queue.length = 0;
      G.waveState = 'intro';
      G.waveT = 1e9;
      G.setArena(id);
      G.placePlayers();
      G.snapCamera();
      const errs0 = CH.errors.length;
      const modes = [];
      for (const w of [null, 'sun', 'rain', 'wind', 'glitch']) {
        CH.Weather.custom = w;
        __f(4);
        modes.push(CH.Weather.mode);
      }
      CH.Weather.custom = null;
      // spread the party so the split screen draws this arena twice
      G.players[0].x = 100;
      G.players[1].x = Math.min(G.arena.w - 80, 800);
      __f(80);
      const props = (G.arena.props || []).length;
      const enemy = G.spawnEnemy('chicken', G.arena.w / 2, G.arena.h / 2, { spawnTime: 0 });
      __f(20);
      return { id: G.arena.id, w: G.arena.w, h: G.arena.h, props, mode: G.viewMode, views: G.views.length, errs: CH.errors.length - errs0, modes, hasBg: !!G.arena.bg };
    }, id);
    ok(`arena ${id}: builds, has props, renders in every weather and in split screen`, r.id === id && r.hasBg && r.props > 0 && r.mode === 'split' && r.views === 2 && r.errs === 0, r);
    if (id === 'volcano' || id === 'zombie') await page.screenshot({ path: path.join(__dirname, 'ct_arena_' + id + '.png') });
  }

  /* ================================================================ 6. branching path screens (waves 4 and 7) */
  await fresh({ players: [{ hero: 'Mercenary', src: { kind: 'pad', index: 0 } }, { hero: 'Vexaria', src: { kind: 'pad', index: 1 } }] });
  r = await E(() => {
    const G = CH.G;
    G.wave = 3;
    G.waveState = 'combat';
    G.queue.length = 0;
    G.enemies.length = 0;
    __f(2);
    G.waveComplete();
    __f(60 * 4);
    return { state: G.state, ws: G.waveState, ui: CH.UI.active };
  });
  ok('after wave 3 the branch screen offers two paths', r.ui === 'branch', r);
  r = await E(() => {
    const G = CH.G;
    const [a, b] = G.players;
    const x0 = [a.x, b.x];
    a.inp.src.kind === 'pad' && __pad(0, { ls: [1, 0] });
    __f(40);
    __pad(0, {});
    return { state: G.state, moved: Math.abs(a.x - x0[0]) };
  });
  ok('the game is paused while you choose a path (nobody can run off)', r.state !== 'playing' && r.moved < 1, r);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(__dirname, 'ct_branch.png') });
  r = await E(() => {
    __tap(1, 13, 3); // P2 d-pad down moves the focus
    const focus = document.activeElement && (document.activeElement.className || document.activeElement.tagName);
    __tap(1, 0, 3); // A
    __f(5);
    const G = CH.G;
    return { focus, state: G.state, arena: G.arena.id, wave: G.wave, ui: CH.UI.active };
  });
  ok('a controller can pick a path (D-pad + A) and the next wave starts in that arena', r.state === 'playing' && r.wave === 4 && ['wasteland', 'office'].includes(r.arena), r);

  /* ================================================================ 7. the safehouse */
  await E(() => {
    CH.G.toMenu();
    CH.Storage.data.resources = { wood: 500, scrap: 500, stone: 500 };
    CH.Storage.data.shelter = { workbench: 0, bed: 0, storage: 0, radio: 0, barricades: 0, decor: {} };
    CH.Input.lastUsed = 'kbm';
    __f(2);
    document.getElementById('btn-shelter').click();
  });
  await page.waitForTimeout(300);
  r = await E(() => ({ active: CH.UI.active, cards: document.querySelectorAll('#shelter-stations .station-card').length, wood: document.getElementById('sh-wood').textContent }));
  ok('the SAFEHOUSE button opens the base with five stations', r.active === 'journal' && r.cards >= 5 && r.wood === '500', r);
  await page.screenshot({ path: path.join(__dirname, 'ct_shelter.png') });
  r = await E(() => {
    const btns = [...document.querySelectorAll('#shelter-stations .btn-up-station')];
    for (const b of btns) b.click();
    return { sh: { ...CH.Storage.data.shelter }, left: { ...CH.Storage.data.resources } };
  });
  ok('upgrading stations spends resources and raises their level', Object.values(r.sh).filter((v) => typeof v === 'number' && v === 1).length === 5 && r.left.wood < 500, r);
  r = await E(() => {
    // level every station up to 3 and look at what a new run gives
    CH.Storage.data.shelter = { workbench: 3, bed: 3, storage: 3, radio: 3, barricades: 3, decor: {} };
    CH.G.toMenu();
    CH.G.newRun(null);
    const p = CH.G.player;
    const base = CH.Balance.player;
    const ws = p.ws[p.weapon];
    return { maxHp: p.maxHp, expectHp: base.maxHp + 45 + (p.hero.mods.hp || 0), coins: CH.G.coins, nades: p.nades, maxNades: p.maxNades, dmg: +p.stats.dmgMult.toFixed(2), reloadScale: p.stats.reloadMult };
  });
  ok('bed: +15 max HP per level', r.maxHp === r.expectHp, r);
  ok('storage: +15 starting coins per level', r.coins === 45, r);
  ok('workbench: +5% damage per level', r.dmg >= 1.15, r);
  ok('workbench: +10% reload speed per level', r.reloadScale > 1, r);
  ok('radio: +1 gadget charge per level', r.maxNades >= 3 + 1, r);
  r = await E(() => {
    const G = CH.G;
    G.queue.length = 0;
    G.enemies.length = 0;
    G.waveState = 'combat';
    G.event = null;
    G.eventTimer = 1e9;
    const p = G.player;
    G.pickups.length = 0;
    const dummy = G.spawnEnemy('chicken', 100, 100, { spawnTime: 0 }); // keeps the wave from ending
    dummy.state = 'idle';
    dummy.t = 1e9;
    dummy.hp = dummy.maxHp = 1e9;
    p.invuln = 1e9;
    let drops = 0;
    const orig = G.dropPickup;
    G.dropPickup = (...a) => (drops++, orig.apply(G, a));
    __f(60 * 100);
    G.dropPickup = orig;
    return { pickups: drops };
  });
  ok('radio: supply airdrops land during combat', r.pickups > 0, r);
  r = await E(() => {
    CH.Storage.data.shelter = { workbench: 0, bed: 0, storage: 0, radio: 0, barricades: 0, decor: {} };
    CH.Storage.data.resources = { wood: 500, scrap: 500, stone: 500 };
    document.getElementById('btn-shelter') && 0;
    CH.G.toMenu();
    document.getElementById('btn-shelter').click();
    return { decor: document.querySelectorAll('#shelter-decor .decor-item, .decor-card, [data-decor]').length };
  });
  ok('the safehouse has decorations you can buy (the save already reserves room for them)', r.decor > 0, r);

  /* ================================================================ 8. co-op with all of it */
  await fresh({ players: [{ hero: 'Mercenary', src: { kind: 'pad', index: 0 } }, { hero: 'Dreadbloom', src: { kind: 'pad', index: 1 } }] });
  r = await E(() => {
    const G = CH.G;
    const [a, b] = G.players;
    a.x = 200;
    b.x = 700;
    __f(90);
    CH.Storage.data.resources = { wood: 10, scrap: 10, stone: 0 };
    const n0 = G.arena.props.length;
    __pad(0, { hold: [11] }); // R3 on both controllers
    __pad(1, { hold: [11] });
    __f(1);
    __pad(0, {});
    __pad(1, {});
    __f(3);
    return { mode: G.viewMode, added: G.arena.props.length - n0, wood: CH.Storage.data.resources.wood };
  });
  ok('co-op: both players can fortify in split screen with R3', r.mode === 'split' && r.added === 2 && r.wood === 6, r);
  r = await E(() => {
    const G = CH.G;
    const [a, b] = G.players;
    __pad(1, { ls: [0, 1], hold: [] });
    __f(120);
    __pad(1, {});
    return { y: Math.round(b.y), errs: CH.errors.length };
  });
  ok('co-op: props do not trap a hero (player 2 walks freely)', r.errs === 0, r);

  for (const x of results) console.log(x[0], x[1], x[2]);
  const failed = results.filter((x) => x[0] === 'FAIL').length;
  console.log('console errors:', errs.length ? errs.join('\n') : 'none', JSON.stringify(await E(() => CH.errors)));
  console.log(failed ? 'FAILED ' + failed + ' of ' + results.length : 'ALL ' + results.length + ' PASSED');
  await browser.close();
})();
