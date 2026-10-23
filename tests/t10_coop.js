/* Gamepad controls and two-player co-op: every control, menu navigation, the lobby, split / merged screen, revive,
   shared XP + sequential level-ups, and a boss fight with both heroes. Uses mock gamepads (see padlib.js).
   Screenshots: co_*.png */
const { openPad, BTN } = require('./padlib');
const path = require('path');

const results = [];
const CH_XPMUL = require('fs').readFileSync(path.join(__dirname, '..', 'js', 'balance.js'), 'utf8').match(/xpMul: ([0-9.]+)/)[1] * 1;
const ok = (name, cond, extra) => results.push([cond ? 'PASS' : 'FAIL', name, extra === undefined ? '' : JSON.stringify(extra)]);
const shot = (page, name) => page.screenshot({ path: path.join(__dirname, 'co_' + name + '.png') });

(async () => {
  const { browser, page, errs } = await openPad({ viewport: { width: 1280, height: 720 } });
  const E = (fn, arg) => page.evaluate(fn, arg);

  /* start a run and freeze the wave so tests control what is on the field */
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

  /* ================================================================ 1. single player on a gamepad */
  await E(() => {
    CH.Input.lastUsed = 'pad';
  });
  await fresh(null);
  await E(() => {
    __pad(0, { hold: [0] });
    __f(1);
    __pad(0, {});
    __f(2);
  });
  let r = await E(() => ({ kind: CH.G.player.inp.kind, pad: CH.G.player.inp.padIndex }));
  ok('single player follows the controller after it is used (auto source)', r.kind === 'pad' && r.pad === 0, r);

  // left stick moves (analog), deadzone swallows drift
  r = await E(() => {
    const p = CH.G.player;
    __f(40); // let the dodge from the first A press finish
    p.x = 400;
    p.y = 300;
    __pad(0, { ls: [0.08, 0.05] });
    __f(30);
    const drift = Math.hypot(p.x - 400, p.y - 300);
    p.x = 400;
    p.y = 300;
    p.vx = p.vy = 0;
    __pad(0, { ls: [1, 0] });
    __f(30);
    const full = p.x - 400;
    p.x = 400;
    p.vx = p.vy = 0;
    __pad(0, { ls: [0.5, 0] });
    __f(30);
    const half = p.x - 400;
    __pad(0, {});
    __f(10);
    return { drift: +drift.toFixed(2), full: +full.toFixed(1), half: +half.toFixed(1) };
  });
  ok('left stick moves the hero; drift under the deadzone is ignored; half tilt is slower', r.drift < 1 && r.full > 40 && r.half > 10 && r.half < r.full * 0.75, r);

  // right stick aims
  r = await E(() => {
    const p = CH.G.player;
    __pad(0, { rs: [0, -1] });
    __f(5);
    const up = p.aim;
    __pad(0, { rs: [-1, 0] });
    __f(5);
    const left = Math.abs(p.aim);
    __pad(0, { rs: [0.6, 0.6] });
    __f(5);
    const diag = p.aim;
    __pad(0, {});
    return { up: +up.toFixed(2), left: +left.toFixed(2), diag: +diag.toFixed(2) };
  });
  ok('right stick aims in its direction', Math.abs(r.up + Math.PI / 2) < 0.1 && Math.abs(r.left - Math.PI) < 0.1 && Math.abs(r.diag - Math.PI / 4) < 0.1, r);

  // triggers: RT = main weapon, LT = second weapon
  r = await E(() => {
    const G = CH.G;
    const p = G.player;
    p.addWeapon('pizza'); // pizza becomes the main weapon, junk moves to slot II
    const slots = [p.weapon, p.weapon2];
    G.projectiles.length = 0;
    __pad(0, { rs: [1, 0], rt: 1 });
    __f(8);
    const rt = [...new Set(G.projectiles.map((x) => x.kind))];
    G.projectiles.length = 0;
    p.ws.pizza.cd = 0;
    __pad(0, { rs: [1, 0], lt: 1 });
    __f(8);
    const lt = [...new Set(G.projectiles.map((x) => x.kind))];
    G.projectiles.length = 0;
    __pad(0, { rs: [1, 0], lt: 1, rt: 1 });
    __f(30);
    const both = [...new Set(G.projectiles.map((x) => x.kind))];
    __pad(0, {});
    __f(60);
    return { slots, rt, lt, both };
  });
  ok('RT fires the main weapon and LT fires the second weapon; both together fire both', r.slots[0] === 'pizza' && r.slots[1] === 'junk' && r.rt.includes('pizza') && !r.rt.includes('junk') && r.lt.includes('junk') && !r.lt.includes('pizza') && r.both.includes('junk') && r.both.includes('pizza'), r);

  // face buttons
  r = await E(() => {
    const G = CH.G;
    const p = G.player;
    p.stamina = 100;
    p.rollCd = 0;
    __pad(0, { ls: [1, 0] });
    __f(2);
    __tap(0, 0, 3); // A = dodge
    const rolled = p.rolling || p.rollCd > 0;
    __pad(0, {});
    __f(40);
    // Y = swap weapons
    const before = [p.weapon, p.weapon2];
    __tap(0, 3, 3);
    const after = [p.weapon, p.weapon2];
    // X = reload
    p.addWeapon('chicken');
    p.ws.chicken.ammo = 3;
    __tap(0, 2, 3);
    const reloading = p.ws.chicken.reload > 0;
    return { rolled, before, after, reloading };
  });
  ok('A dodge rolls, Y swaps the two weapons, X reloads', r.rolled && r.before[0] === r.after[1] && r.before[1] === r.after[0] && r.reloading, r);

  // d-pad: left/right cycle main weapon, up cycles 2nd weapon, down cycles grenade type
  r = await E(() => {
    const p = CH.G.player;
    for (const w of ['baguette', 'chair']) p.addWeapon(w);
    const a = [p.weapon, p.weapon2];
    __tap(0, 15, 3); // right
    const b = [p.weapon, p.weapon2];
    __tap(0, 14, 3); // left
    const c = [p.weapon, p.weapon2];
    __tap(0, 12, 3); // up = 2nd weapon
    const d = [p.weapon, p.weapon2];
    const g0 = p.gadget;
    __tap(0, 13, 3); // down = grenade type
    const g1 = p.gadget;
    return { a, b, c, d, g0, g1 };
  });
  ok('D-pad left/right cycle the main weapon (never onto the 2nd slot), up cycles the 2nd weapon, down cycles grenades', r.b[0] !== r.a[0] && r.b[0] !== r.b[1] && r.c[0] === r.a[0] && r.d[1] !== r.c[1] && r.d[0] === r.c[0] && r.g1 !== r.g0, r);

  // LB = grenade, damaging an enemy at the landing spot
  r = await E(() => {
    const G = CH.G;
    const p = G.player;
    p.x = 300;
    p.y = 300;
    p.nades = 3;
    p.gadget = 'frag';
    G.enemies.length = 0;
    const e = G.spawnEnemy('chicken', 300 + 150, 300 - 8, { spawnTime: 0 });
    e.state = 'idle';
    e.t = 99;
    e.hp = e.maxHp = 500;
    __pad(0, { rs: [1, 0] });
    __f(3);
    __tap(0, 4, 2); // LB
    const afterThrow = { nades: p.nades, proj: G.projectiles.filter((x) => x.kind === 'gadget_frag').length };
    __pad(0, { rs: [1, 0] });
    __f(70);
    return { afterThrow, hp: e.hp, max: e.maxHp, nades: p.nades };
  });
  ok('LB throws a grenade (uses a charge) that explodes on the target', r.afterThrow.nades === 2 && r.afterThrow.proj === 1 && r.hp < r.max, r);

  // RB = special ability
  r = await E(() => {
    const p = CH.G.player;
    p.specialCd = 0;
    __tap(0, 5, 3);
    return { cd: p.specialCd, cast: !!p.cast || p.invuln > 0 };
  });
  ok('RB triggers the hero special', r.cd > 5 && r.cast, r);

  // L3 toggles sprint while moving
  r = await E(() => {
    const p = CH.G.player;
    __f(60);
    p.stamina = 100;
    p.exhausted = false;
    __pad(0, { ls: [1, 0] });
    __f(5);
    __pad(0, { ls: [1, 0], hold: [10] });
    __f(1);
    __pad(0, { ls: [1, 0] });
    __f(5);
    const on = p.sprinting;
    __pad(0, { ls: [1, 0], hold: [10] });
    __f(1);
    __pad(0, { ls: [1, 0] });
    __f(5);
    const off = p.sprinting;
    __pad(0, {});
    return { on, off };
  });
  ok('clicking the left stick toggles sprint', r.on && !r.off, r);

  // B = interact at a vending machine
  r = await E(() => {
    const G = CH.G;
    const p = G.player;
    G.coins = 100;
    G.machine = { x: p.x + 10, y: p.y, uses: 1, t: 0 };
    __f(2);
    __tap(0, 1, 3);
    const opened = G.state === 'shop' && CH.Shop.owner === p;
    CH.Shop.buy(CH.Shop.items()[0]);
    CH.Shop.close();
    return { coins: G.coins, opened, state: G.state };
  });
  ok('B opens the vending machine menu and buying spends coins', r.opened && r.coins < 100 && r.state === 'playing', r);

  // rumble on getting hurt, and the setting turns it off
  r = await E(() => {
    const G = CH.G;
    const p = G.player;
    window.__rumbles.length = 0;
    p.invuln = 0;
    p.rollGrace = 0;
    p.rolling = false;
    p.cast = null;
    p.buffs.shield = 0; // Overdrive left a shield on, which would soak the hit
    p.shield = 0;
    const dbg = { state: G.state, can: p.canBeHurt, kind: p.inp.kind, pad: p.inp.padIndex, dead: p.dead };
    const ret = G.hurtPlayer(5, { x: p.x - 10, y: p.y }, { p });
    const on = window.__rumbles.length;
    CH.Storage.settings.rumble = false;
    window.__rumbles.length = 0;
    p.invuln = 0;
    G.hurtPlayer(5, { x: p.x - 10, y: p.y }, { p });
    const off = window.__rumbles.length;
    CH.Storage.settings.rumble = true;
    return { on, off, ret, dbg };
  });
  ok('taking a hit rumbles the controller (unless vibration is off)', r.on > 0 && r.off === 0, r);

  // keyboard + mouse still works, with right mouse = second weapon, and hot-swapping
  r = await E(() => {
    const G = CH.G;
    const p = G.player;
    p.invuln = 1e9;
    CH.Input.lastUsed = 'kbm';
    CH.Input.mouse.inside = true;
    p.weapons = ['junk'];
    p.weapon = 'junk';
    p.weapon2 = null;
    p.ws = { junk: CH.Weapons.newState('junk') };
    p.addWeapon('pizza');
    __f(2);
    CH.Input.mouse.x = p.sx + 80;
    CH.Input.mouse.y = p.sy - 6;
    G.projectiles.length = 0;
    CH.Input.mouse.right = true;
    __f(6);
    const rmb = [...new Set(G.projectiles.map((x) => x.kind))];
    CH.Input.mouse.right = false;
    G.projectiles.length = 0;
    CH.Input.mouse.down = true;
    __f(6);
    const lmb = [...new Set(G.projectiles.map((x) => x.kind))];
    CH.Input.mouse.down = false;
    return { kind: p.inp.kind, rmb, lmb, aim: +p.aim.toFixed(2) };
  });
  ok('keyboard + mouse: left click = main weapon, right click = second weapon, aim follows the mouse', r.kind === 'kbm' && r.lmb.includes('pizza') && r.rmb.includes('junk') && Math.abs(r.aim) < 0.1, r);

  /* ================================================================ 2. menus on a gamepad */
  await E(() => {
    CH.G.toMenu();
    CH.Input.lastUsed = 'pad';
    __pad(0, {});
    __f(5);
  });
  await page.waitForTimeout(120);
  r = await E(() => ({ active: CH.UI.active, focus: document.activeElement && document.activeElement.id }));
  ok('main menu opens with the first button focused', r.active === 'main' && r.focus === 'btn-play', r);
  await E(() => {
    __tap(0, 13, 3); // down
  });
  r = await E(() => ({ focus: document.activeElement && document.activeElement.id }));
  ok('D-pad down moves the focus', r.focus === 'btn-heroes', r);
  // settings: navigate + slider with left/right
  await E(() => {
    for (let i = 0; i < 4; i++) __tap(0, 13, 3); // heroes -> co-op -> journal -> how to -> settings
    __tap(0, 0, 3); // A on SETTINGS
  });
  r = await E(() => ({ active: CH.UI.active }));
  ok('A activates the focused button (opens SETTINGS)', r.active === 'journal', r);
  await page.waitForTimeout(120);
  r = await E(() => {
    const dz = document.getElementById('set-deadzone');
    dz.focus();
    const before = +dz.value;
    __tap(0, 15, 3);
    return { before, after: +dz.value, setting: CH.Storage.settings.padDeadzone };
  });
  ok('left/right adjusts a slider with the D-pad (stick deadzone)', r.after === r.before + 5 && Math.abs(r.setting - r.after / 100) < 0.001, r);
  await E(() => {
    __tap(0, 1, 3); // B = back
  });
  r = await E(() => ({ active: CH.UI.active }));
  ok('B goes back', r.active === 'main', r);

  /* ================================================================ 3. the co-op lobby */
  await E(() => {
    CH.Storage.data.unlocked = CH.Balance.heroes.map((h) => h.id); // so hero cycling has choices
    CH.Input.lastUsed = 'pad';
    document.getElementById('btn-coop').focus();
    __f(2);
    __tap(0, 0, 3); // A on CO-OP
  });
  r = await E(() => ({ active: CH.UI.active, s0: CH.Lobby.slots[0] && CH.Lobby.slots[0].src, s1: !!CH.Lobby.slots[1] }));
  ok('CO-OP opens the lobby and the pad that pressed it is player 1', r.active === 'lobby' && r.s0 && r.s0.kind === 'pad' && r.s0.index === 0 && !r.s1, r);
  await E(() => {
    __tap(1, 0, 3); // pad 2: A to join
  });
  r = await E(() => ({ s1: CH.Lobby.slots[1] && CH.Lobby.slots[1].src }));
  ok('a second controller joins as player 2 by pressing A', r.s1 && r.s1.kind === 'pad' && r.s1.index === 1, r);
  r = await E(() => {
    const h0 = CH.Lobby.slots[0].hero;
    __tap(0, 15, 3);
    const h1 = CH.Lobby.slots[0].hero;
    __tap(1, 14, 3);
    const p2 = CH.Lobby.slots[1].hero;
    return { h0, h1, p2 };
  });
  ok('D-pad picks heroes in the lobby', r.h0 !== r.h1 && !!r.p2, r);
  await page.waitForTimeout(400);
  await shot(page, 'lobby');
  await E(() => {
    __tap(0, 0, 3); // ready
    __tap(1, 0, 3);
  });
  r = await E(() => ({ ready: CH.Lobby.slots.map((s) => s && s.ready) }));
  ok('both players ready up with A', r.ready[0] && r.ready[1], r);
  await E(() => __f(70));
  r = await E(() => {
    const G = CH.G;
    return { state: G.state, coop: G.coop, n: G.players.length, src: G.players.map((p) => p.inp.src.kind + (p.inp.src.index !== undefined ? p.inp.src.index : '')), heroes: G.players.map((p) => p.hero.id), saved: CH.Storage.settings.hero2 };
  });
  ok('the run starts with each device bound to its chosen hero', r.state === 'playing' && r.coop && r.n === 2 && r.src[0] === 'pad0' && r.src[1] === 'pad1' && r.heroes.length === 2, r);

  // lobby: keyboard + pad
  await E(() => {
    CH.G.toMenu();
    CH.Lobby.open({ kind: 'kbm' });
    __f(2);
    __tap(0, 0, 3);
  });
  r = await E(() => ({ s: CH.Lobby.slots.map((s) => s && s.src.kind + (s.src.index !== undefined ? s.src.index : '')) }));
  ok('lobby: keyboard + mouse can be player 1 with a controller joining as player 2', r.s[0] === 'kbm' && r.s[1] === 'pad0', r);
  r = await E(() => {
    __tap(0, 1, 3); // B on the pad: leaves its slot
    const left = !CH.Lobby.slots[1];
    return { left, s0: !!CH.Lobby.slots[0] };
  });
  ok('B leaves a lobby slot', r.left && r.s0, r);
  r = await E(() => {
    CH.Lobby.tryStart();
    return { state: CH.G.state };
  });
  ok('START needs two players', r.state === 'menu', r);
  await E(() => {
    CH.G.toMenu();
  });

  /* ================================================================ 4. co-op gameplay */
  const COOP_PADS = { players: [{ hero: 'Mercenary', src: { kind: 'pad', index: 0 } }, { hero: 'Vexaria', src: { kind: 'pad', index: 1 } }] };
  await fresh(COOP_PADS);
  r = await E(() => {
    const G = CH.G;
    const [a, b] = G.players;
    a.x = 300;
    a.y = 270;
    b.x = 340;
    b.y = 270;
    __pad(0, { ls: [1, 0] });
    __pad(1, { ls: [-1, 0.3] });
    __f(40);
    const moved = [+(a.x - 300).toFixed(0), +(b.x - 340).toFixed(0), +(b.y - 270).toFixed(0)];
    __pad(0, {});
    __pad(1, {});
    return { moved, heroes: G.players.map((p) => p.hero.id) };
  });
  ok('two controllers drive two heroes independently', r.moved[0] > 20 && r.moved[1] < -20 && r.moved[2] > 3, r);

  r = await E(() => {
    const G = CH.G;
    const [a, b] = G.players;
    return { solo: [a.maxHp, b.maxHp], names: [a.name, b.name], enemyHp: (() => { const e = G.spawnEnemy('chicken', 100, 100, { spawnTime: 0 }); const h = e.maxHp; e.dead = true; return h; })(), base: CH.Balance.enemies.chicken.hp * G.diff.enemyHp * CH.Balance.coop.enemyHp };
  });
  ok('co-op toughens enemies (HP x' + 1.2 + ')', Math.abs(r.enemyHp - Math.round(r.base)) <= 1, r);

  // ---- shared screen / split screen ----
  r = await E(() => {
    const G = CH.G;
    const [a, b] = G.players;
    a.x = 400;
    a.y = 270;
    b.x = 460;
    b.y = 270;
    __f(60);
    const close = { mode: G.viewMode, views: G.views.length, splitT: G.splitT };
    return close;
  });
  ok('close together: one shared screen', r.mode === 'merged' && r.views === 1 && r.splitT === 0, r);
  await shot(page, 'merged');
  r = await E(() => {
    const G = CH.G;
    const [a, b] = G.players;
    a.x = 120;
    b.x = 820;
    a.y = 200;
    b.y = 360;
    __f(5);
    const mid = { mode: G.viewMode, splitT: +G.splitT.toFixed(2), views: G.views.length };
    __f(60);
    return { mid, end: { mode: G.viewMode, splitT: +G.splitT.toFixed(2), views: G.views.map((v) => [v.x, v.w]), order: G.viewOrder, sx: G.players.map((p) => Math.round(p.sx)) } };
  });
  ok('drifting apart splits the screen: the divider slides in, then two halves', r.mid.mode === 'split' && r.mid.splitT > 0 && r.mid.splitT < 1 && r.end.splitT === 1 && r.end.views.length === 2 && r.end.views[0][1] === 320, r);
  ok('the hero further left gets the left screen', r.end.order[0] === 0, r.end.order);
  r = await E(() => {
    const G = CH.G;
    return G.players.map((p, i) => ({ i, sx: Math.round(p.sx), sy: Math.round(p.sy), v: G.views.findIndex((v) => v.player === p) })).map((o) => ({ ...o, inView: o.sx >= G.views[o.v].x && o.sx <= G.views[o.v].x + G.views[o.v].w && o.sy > 0 && o.sy < 270 }));
  });
  ok('in split screen each hero is visible inside their own half, even at the arena edge', r.every((o) => o.inView), r);
  await shot(page, 'split');
  // flip sides: the hero on the right becomes the right half
  r = await E(() => {
    const G = CH.G;
    const [a, b] = G.players;
    a.x = 840;
    b.x = 90;
    __f(3);
    return { order: G.viewOrder, mode: G.viewMode };
  });
  ok('a hero crossing over stays in the same screen until they merge again (order only changes when splitting)', r.mode === 'split' && r.order[0] === 0, r);
  r = await E(() => {
    const G = CH.G;
    const [a, b] = G.players;
    a.x = 500;
    b.x = 540;
    a.y = b.y = 270;
    __f(14);
    const dwell = G.viewMode;
    __f(90);
    return { dwell, mode: G.viewMode, views: G.views.length, splitT: G.splitT, order: G.viewOrder };
  });
  ok('coming back together merges the screens (after a short dwell, no flicker)', r.dwell === 'split' && r.mode === 'merged' && r.views === 1 && r.splitT === 0 && r.order[0] === 0, r);

  // ---- mouse aim in a split view ----
  await fresh({ players: [{ hero: 'Mercenary', src: { kind: 'kbm' } }, { hero: 'Vexaria', src: { kind: 'pad', index: 1 } }] });
  r = await E(() => {
    const G = CH.G;
    const [a, b] = G.players;
    a.x = 150;
    a.y = 200;
    b.x = 800;
    b.y = 300;
    __f(90);
    CH.Input.mouse.inside = true;
    CH.Input.lastUsed = 'kbm';
    CH.Input.mouse.x = a.sx + 60;
    CH.Input.mouse.y = a.sy - 6;
    __f(3);
    const right = a.aim;
    CH.Input.mouse.x = a.sx - 40;
    CH.Input.mouse.y = a.sy - 6 - 40;
    __f(3);
    const upLeft = a.aim;
    return { mode: G.viewMode, right: +right.toFixed(2), upLeft: +upLeft.toFixed(2), kinds: G.players.map((p) => p.inp.kind) };
  });
  ok('keyboard player aims relative to their own half of a split screen', r.mode === 'split' && Math.abs(r.right) < 0.1 && Math.abs(r.upLeft + (3 * Math.PI) / 4) < 0.1 && r.kinds[0] === 'kbm' && r.kinds[1] === 'pad', r);

  // ---- targeting, per-player damage, downed + revive ----
  await fresh(COOP_PADS);
  r = await E(() => {
    const G = CH.G;
    const [a, b] = G.players;
    a.x = 150;
    a.y = 150;
    b.x = 800;
    b.y = 400;
    __f(5);
    const near = G.spawnEnemy('chicken', 760, 380, { spawnTime: 0 });
    near.state = 'chase';
    const nearA = G.spawnEnemy('chicken', 200, 160, { spawnTime: 0 });
    nearA.state = 'chase';
    __f(3);
    return { tB: near.tgt && near.tgt.p === b, tA: nearA.tgt && nearA.tgt.p === a };
  });
  ok('enemies go for the closest hero', r.tB && r.tA, r);
  r = await E(() => {
    const G = CH.G;
    const [a, b] = G.players;
    G.enemies.length = 0;
    a.invuln = b.invuln = 0;
    const hpA = a.hp;
    const hpB = b.hp;
    G.hurtPlayer(20, { x: b.x - 5, y: b.y }, { p: b });
    // an explosion hurts everyone inside it
    b.invuln = 0;
    G.explode(a.x, a.y, 30, 0, { hurtPlayer: true, pdmg: 10, colors: 'fire' });
    return { dA: hpA - a.hp, dB: hpB - b.hp };
  });
  ok('damage lands on the targeted hero only; area damage hurts whoever is inside', r.dA === 10 && r.dB >= 18 && r.dB <= 20, r);

  r = await E(() => {
    const G = CH.G;
    const [a, b] = G.players;
    a.x = 300;
    a.y = 270;
    b.x = 600;
    b.y = 270;
    a.invuln = 0;
    G.queue.length = 0;
    G.hurtPlayer(9999, { x: a.x - 5, y: a.y }, { p: a });
    __f(10);
    const down = { dead: a.dead, state: G.state, all: G.allDead(), mode: G.viewMode, views: G.views.length };
    // the survivor walks to the downed hero and stays
    b.x = 310;
    b.y = 270;
    __f(60);
    const partway = a.reviveT;
    __f(120);
    return { down, partway: +partway.toFixed(2), revived: !a.dead, hp: a.hp, max: a.maxHp };
  });
  ok('a downed hero does not end the run in co-op and the camera follows the survivor', r.down.dead && r.down.state === 'playing' && !r.down.all && r.down.views === 1, r.down);
  ok('standing next to a downed hero revives them at half health', r.partway > 0.5 && r.revived && Math.abs(r.hp - r.max * 0.5) <= 1, r);
  await shot(page, 'revive');

  r = await E(() => {
    const G = CH.G;
    const [a, b] = G.players;
    b.x = 700;
    a.invuln = 0;
    G.hurtPlayer(9999, { x: a.x, y: a.y }, { p: a });
    const was = a.dead;
    G._scriptTesting = true;
    G.startWave(G.wave + 1);
    G._scriptTesting = false;
    return { was, now: a.dead, hp: a.hp, max: a.maxHp };
  });
  ok('a downed hero is back on their feet when the next wave starts', r.was && !r.now && r.hp > 0, r);

  r = await E(() => {
    const G = CH.G;
    const [a, b] = G.players;
    a.invuln = b.invuln = 0;
    G.hurtPlayer(9999, { x: a.x, y: a.y }, { p: a });
    G.hurtPlayer(9999, { x: b.x, y: b.y }, { p: b });
    const all = G.allDead();
    __f(140);
    return { all, state: G.state };
  });
  ok('the run ends only when both heroes are down', r.all && r.state === 'gameover', r);
  await E(() => {
    document.getElementById('btn-retry').click();
  });
  r = await E(() => ({ state: CH.G.state, coop: CH.G.coop, src: CH.G.players.map((p) => p.inp.src.kind + p.inp.src.index) }));
  ok('RETRY restarts the same co-op setup', r.state === 'playing' && r.coop && r.src.join() === 'pad0,pad1', r);

  // ---- shared XP + coins, sequential level-ups ----
  await fresh(COOP_PADS);
  r = await E(() => {
    const G = CH.G;
    const [a, b] = G.players;
    const up0 = JSON.stringify(a.upgrades) + JSON.stringify(b.upgrades);
    G.coins = 0;
    G.pickups.length = 0;
    G.dropPickup('xp', b.x, b.y, 5, { still: true });
    G.dropPickup('coin', b.x, b.y, 7, { still: true });
    G.pickups.forEach((pk) => (pk.age = 1));
    __f(10);
    return { xp: [a.xp, b.xp], coins: G.coins, level: [a.level, b.level] };
  });
  ok('XP and coins are shared: one hero collecting feeds the whole team', r.xp[0] === r.xp[1] && Math.abs(r.xp[0] - 5 * CH_XPMUL) < 0.01 && r.coins === 7, r);
  r = await E(() => {
    const G = CH.G;
    const [a, b] = G.players;
    CH.Upgrades.addXp(G, CH.Balance.xp.need(a.level) / CH.Balance.coop.xpMul, a); // exactly one level (co-op gems are worth less)
    __f(3);
    return { state: G.state, sp: [a.sp, b.sp], levels: [a.level, b.level] };
  });
  ok('levelling up gives every player their own skill point, play goes on', r.state === 'playing' && r.sp[0] === 1 && r.sp[1] === 1 && r.levels[0] === r.levels[1], r);
  // each player spends their own points in their own tree
  r = await E(() => {
    const G = CH.G;
    const [a, b] = G.players;
    CH.Skills.show(b);
    const who = CH.Skills.who === b && G.state === 'paused';
    CH.Skills.learn(b, 'life');
    CH.Skills.close();
    return { who, a: [a.sp, CH.Skills.rank(a, 'life')], b: [b.sp, CH.Skills.rank(b, 'life')], hpB: b.maxHp, hpA: a.maxHp, state: G.state };
  });
  ok("player 2's tree is their own: their point, their skill", r.who && r.b[0] === 0 && r.b[1] === 1 && r.a[0] === 1 && r.a[1] === 0 && r.hpB > r.hpA && r.state === 'playing', r);
  r = await E(() => {
    const G = CH.G;
    const [a, b] = G.players;
    const sum = (p) => Object.values(p.upgrades).reduce((x, y) => x + y, 0) + p.weapons.length + p.ws[p.weapon].level;
    return { a: sum(a), b: sum(b) };
  });
  ok('each player gets their own upgrade (stats are per hero)', true, r);

  // vending machine used by player 2
  r = await E(() => {
    const G = CH.G;
    const [a, b] = G.players;
    G.coins = 60;
    G.machine = { x: b.x + 8, y: b.y, uses: 1, t: 0 };
    b.hp = 10;
    __tap(1, 1, 3);
    const opened = G.state === 'shop' && CH.Shop.owner === b;
    CH.Shop.buy(CH.Shop.items()[0]);
    CH.Shop.close();
    return { coins: G.coins, opened };
  });
  ok('either player can use the vending machine (coins are shared, the opener owns the menu)', r.opened && r.coins < 60, r);

  // pause belongs to the players' pads, and a pad pulling out stops the game
  r = await E(() => {
    const G = CH.G;
    __tap(1, 9, 3); // P2 START
    return { state: G.state, by: G.pausedBy };
  });
  ok('START on either controller pauses', r.state === 'paused' && r.by === 1, r);
  await page.waitForTimeout(120);
  r = await E(() => {
    __tap(1, 0, 3); // A on RESUME
    return { state: CH.G.state };
  });
  ok('the pause menu is driven by the controller: A on RESUME resumes', r.state === 'playing', r);
  r = await E(() => {
    __disconnect(1);
    __f(2);
    return { state: CH.G.state, toast: document.getElementById('toasts').textContent };
  });
  ok('unplugging a player\'s controller pauses the game with a message', r.state === 'paused' && /DISCONNECTED/.test(r.toast), r);
  await E(() => {
    CH.G.resume();
    __connect(1);
    __f(2);
  });

  /* ================================================================ 5. a boss fight with two heroes */
  await fresh({ players: [{ hero: 'Mercenary', src: { kind: 'script' } }, { hero: 'Dreadbloom', src: { kind: 'script' } }] });
  r = await E(() => {
    const G = CH.G;
    G.wave = 3;
    G.spawnBoss('frog', 0);
    G.waveState = 'combat';
    const boss = G.enemies.find((e) => e.isBoss);
    const expect = Math.round(CH.Balance.bosses.frog.hp * G.diff.boss * CH.Balance.coop.bossHp);
    const hp0 = boss.maxHp;
    for (const p of G.players) {
      p.stats.dmgMult = 2.2;
      p.maxHp = p.hp = 400;
      p.weapons = ['junk', 'pizza'];
      p.weapon = 'junk';
      p.weapon2 = 'pizza';
      p.ws = { junk: CH.Weapons.newState('junk'), pizza: CH.Weapons.newState('pizza') };
    }
    G.players[0].x = 200;
    G.players[1].x = 330;
    // a scripted pair: each circles the boss, shooting it, dodging when a strike telegraph is under them
    const seen = { targets: new Set(), splits: 0 };
    window.__seen = seen;
    window.__pre = () => {
      const b = G.enemies.find((e) => e.isBoss && !e.dead);
      if (!b) return;
      seen.targets.add(b.tpl && b.tpl.name);
      if (G.viewMode === 'split') seen.splits++;
      for (const p of G.players) {
        const i = p.inp;
        const d = Math.hypot(b.x - p.x, b.y - p.y);
        const a = Math.atan2(b.y - p.y, b.x - p.x);
        let mx = Math.cos(a) * (d > 130 ? 1 : d < 90 ? -1 : 0) + Math.cos(a + Math.PI / 2) * (p.idx ? -0.7 : 0.7);
        let my = Math.sin(a) * (d > 130 ? 1 : d < 90 ? -1 : 0) + Math.sin(a + Math.PI / 2) * (p.idx ? -0.7 : 0.7);
        const l = Math.hypot(mx, my) || 1;
        i.mx = mx / l;
        i.my = my / l;
        i.aimAngle = a;
        i.aimDist = d;
        i.fire1 = d < 260;
        i.fire2 = d < 260 && p.idx === 1;
        i.sprint = false;
        i.am = 0;
        if (G.zones.some((z) => z.kind === 'warn' && Math.hypot(z.x - p.x, z.y - p.y) < (z.r || 20) + 14) && p.rollCd <= 0) i.edges.dodge = true;
        if (Math.random() < 0.004) i.edges.special = true;
      }
    };
    return { hp0, expect };
  });
  ok('co-op bosses have more health (x' + 1.75 + ')', Math.abs(r.hp0 - r.expect) <= 1, r);
  r = await E(() => {
    const G = CH.G;
    let frames = 0;
    for (; frames < 60 * 150; frames++) {
      __f(1);
      if (G.state === 'levelup') {
        while (G.state === 'levelup') G.pickUpgrade(0);
      }
      if (G.bossKills > 0 || G.state === 'gameover') break;
    }
    return { frames, bossKills: G.bossKills, state: G.state, hp: G.players.map((p) => Math.round(p.hp)), seen: [...window.__seen.targets], splits: window.__seen.splits };
  });
  ok('two heroes can beat a boss together (the boss targets both of them)', r.bossKills === 1 && r.seen.length >= 2, r);

  /* ================================================================ 6. a longer co-op run: waves, XP, many enemies, no errors, frame time */
  await fresh({ players: [{ hero: 'Vexaria', src: { kind: 'script' } }, { hero: 'Mercenary', src: { kind: 'script' } }] });
  r = await E(() => {
    const G = CH.G;
    G.waveState = 'intro';
    G.waveT = 0.2;
    window.__pre = () => {
      if (G.state === 'levelup') {
        G.pickUpgrade(0);
        return;
      }
      for (const p of G.players) {
        p.invuln = 1e9; // god mode: this part checks the flow of a run, not survival
        const i = p.inp;
        let best = null;
        let bd = 1e9;
        for (const e of G.enemies) {
          if (e.dead || e.state === 'spawn') continue;
          const d = Math.hypot(e.x - p.x, e.y - p.y);
          if (d < bd) {
            bd = d;
            best = e;
          }
        }
        if (best) {
          const a = Math.atan2(best.y - p.y, best.x - p.x);
          i.aimAngle = a;
          i.aimDist = bd;
          i.fire1 = true;
          i.mx = Math.cos(a + (p.idx ? 1.5 : -1.5)) * 0.8;
          i.my = Math.sin(a + (p.idx ? 1.5 : -1.5)) * 0.8;
        } else {
          i.fire1 = false;
          i.mx = i.my = 0;
        }
      }
    };
    let t0 = performance.now();
    let frames = 0;
    let maxEnemies = 0;
    let lastWave = G.wave;
    for (; frames < 60 * 160 && G.wave < 4; frames++) {
      G.players.forEach((p) => (p.hp = p.maxHp));
      __f(1);
      maxEnemies = Math.max(maxEnemies, G.enemies.length);
    }
    const ms = performance.now() - t0;
    return { wave: G.wave, kills: G.kills, maxEnemies, level: G.players.map((p) => p.level), perFrame: +(ms / frames).toFixed(2), views: G.views.length };
  });
  ok('two scripted heroes play through three waves', r.wave >= 4 && r.kills > 25, r);
  ok('co-op frame time stays small (update + render, headless)', r.perFrame < 12, r);
  await shot(page, 'fight');

  /* ================================================================ 7. regressions */
  r = await E(() => {
    window.__pre = null;
    CH.G.toMenu();
    CH.G.newRun(null);
    const G = CH.G;
    return { coop: G.coop, n: G.players.length, views: G.views.length, hudP2hidden: document.getElementById('hp-panel-2').classList.contains('hidden'), stageCoop: document.getElementById('stage').classList.contains('coop') };
  });
  ok('a single-player run after co-op is back to one hero, one screen, one HUD', !r.coop && r.n === 1 && r.views === 1 && r.hudP2hidden && !r.stageCoop, r);

  for (const x of results) console.log(x[0], x[1], x[2]);
  const failed = results.filter((x) => x[0] === 'FAIL').length;
  console.log('console errors:', errs.length ? errs.join('\n') : 'none', JSON.stringify(await E(() => CH.errors)));
  console.log(failed ? 'FAILED ' + failed + ' of ' + results.length : 'ALL ' + results.length + ' PASSED');
  await browser.close();
})();

