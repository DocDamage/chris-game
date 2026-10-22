/* Mob drops (trophies), the Trophy Codex, power-up pickups with item icons, enemy variants, golems, curios. */
const { open } = require('./lib');

(async () => {
  const { browser, page, errs } = await open();
  let fails = 0;
  const ok = (cond, name, info) => {
    console.log(cond ? 'PASS' : 'FAIL', name, info === undefined ? '' : JSON.stringify(info));
    if (!cond) fails++;
  };
  const ev = (fn, arg) => page.evaluate(fn, arg);

  /* ---------------------------------------------------------------- catalog */
  const cat = await ev(() => {
    const L = CH.Loot;
    const rar = { c: 0, u: 0, r: 0, e: 0 };
    let noIcon = 0;
    for (const it of L.items) {
      rar[it.rarity]++;
      if (!CH.Sprites.has(it.sprite)) noIcon++;
    }
    const themesOk = L.items.every((i) => [...i.themes].every((t) => L.THEMES[t]));
    return { n: L.count, rar, noIcon, themesOk, names: new Set(L.items.map((i) => i.name)).size, pu: CH.PowerUps.CURIO_ICONS.length };
  });
  ok(cat.n === 367, 'all 367 mob drops are in the catalog', cat);
  ok(cat.noIcon === 0, 'every mob drop has its icon');
  ok(cat.themesOk && cat.rar.c > cat.rar.u && cat.rar.u > cat.rar.r && cat.rar.r > cat.rar.e, 'rarities and themes are consistent', cat.rar);
  const puIcons = await ev(() => {
    let missing = 0;
    for (let i = 1; i <= 650; i++) if (!CH.Sprites.has('pu.' + i)) missing++;
    const used = new Set(CH.PowerUps.HEAL_ICONS);
    for (const k of Object.keys(CH.PowerUps.KINDS)) for (const i of CH.PowerUps.KINDS[k].icons) used.add(i);
    for (const i of CH.PowerUps.CURIO_ICONS) used.add(i);
    return { missing, covered: used.size, curios: CH.PowerUps.CURIO_ICONS.length };
  });
  ok(puIcons.missing === 0 && puIcons.covered === 650, 'all 650 power-up icons load and every one is used', puIcons);

  /* ---------------------------------------------------------------- enemy drops */
  const types = await ev(() => CH.Enemies.ids);
  const drops = await ev((types) => {
    const G = CH.G;
    const out = {};
    G.newRun();
    G.queue.length = 0;
    G.enemies.length = 0;
    G.state = 'playing';
    G.waveState = 'combat';
    CH.Storage.data.loot = {};
    CH.Storage.data.seen = {};
    for (const t of types) {
      // every drop of this enemy has to match one of its themes
      const th = CH.Loot.themesOf(t);
      let match = 0;
      for (let i = 0; i < 40; i++) {
        const it = CH.Loot.roll(t, {});
        if ([...it.themes].some((x) => th.includes(x))) match++;
      }
      out[t] = match;
    }
    return out;
  }, types);
  ok(Object.values(drops).every((n) => n >= 36), 'every enemy type drops items that fit its themes', drops);

  const flow = await ev(() => {
    const G = CH.G;
    G.newRun();
    G.queue.length = 0;
    G.enemies.length = 0;
    G.state = 'playing';
    G.waveState = 'combat';
    CH.Storage.data.loot = {};
    CH.Storage.data.seen = {};
    const p = G.player;
    p.hp = 10;
    const e = G.spawnEnemy('slime', p.x + 100, p.y, {});
    e.state = 'chase';
    const before = G.pickups.length;
    // force the drop
    CH.Loot.chance = () => 1;
    G.damageEnemy(e, 9999);
    const loot = G.pickups.filter((q) => q.type === 'loot');
    const res = { dropped: loot.length, icon: loot[0] && loot[0].icon };
    // collect the item
    const it = CH.Loot.byId(loot[0].item);
    G.collect(loot[0], p);
    res.stock = CH.Storage.loot[it.id];
    res.seen = !!CH.Storage.data.seen[it.id];
    res.runLoot = G.lootCount;
    res.newLoot = G.newLoot;
    res.effect = it.effect;
    return res;
  });
  ok(flow.dropped >= 1 && /^loot\.\d+$/.test(flow.icon), 'a killed enemy leaves an item pickup with its icon', flow);
  ok(flow.stock === 1 && flow.seen && flow.runLoot === 1 && flow.newLoot === 1, 'collecting files the item in the codex and the run tally');

  const effects = await ev(() => {
    const G = CH.G;
    const p = G.player;
    const out = {};
    const mk = (effect, rarity) => CH.Loot.items.find((i) => i.effect === effect && i.rarity === rarity);
    for (const eff of ['heal', 'xp', 'wood', 'scrap', 'stone', 'coin']) {
      const it = mk(eff, 'r');
      p.hp = 20;
      const b = { hp: p.hp, xp: p.xp, coins: G.coins, wood: G.resources.wood, scrap: G.resources.scrap, stone: G.resources.stone, lvl: p.level };
      CH.Loot.collect(G, { item: it.id, x: p.x, y: p.y }, p);
      out[eff] = eff === 'heal' ? p.hp > b.hp : eff === 'xp' ? p.xp > b.xp || p.level > b.lvl || G.pendingLevels > 0 : eff === 'coin' ? G.coins > b.coins : G.resources[eff] > b[eff];
    }
    return out;
  });
  ok(Object.values(effects).every(Boolean), 'each item effect works (heal / xp / wood / scrap / stone / coins)', effects);

  const boss = await ev(() => {
    const G = CH.G;
    G.newRun();
    G.queue.length = 0;
    G.enemies.length = 0;
    G.state = 'playing';
    G.wave = 3;
    G.spawnBoss('treant', 0);
    G.waveState = 'combat';
    const b = G.enemies.find((e) => e.isBoss);
    b.intro = 0;
    G.pickups.length = 0;
    CH.Loot.bossDrops(G, b);
    const l = G.pickups.filter((q) => q.type === 'loot').map((q) => CH.Loot.byId(q.item));
    return { n: l.length, rarities: l.map((i) => i.rarity), themes: l.map((i) => i.themes) };
  });
  ok(boss.n >= 2 && boss.rarities[0] !== 'c', 'bosses drop rare trophies', boss);

  /* ---------------------------------------------------------------- power-ups */
  const pus = await ev(() => {
    const G = CH.G;
    G.newRun();
    G.queue.length = 0;
    G.enemies.length = 0;
    G.state = 'playing';
    G.waveState = 'combat';
    const p = G.player;
    const out = {};
    for (const kind of Object.keys(CH.PowerUps.KINDS)) {
      G.pickups.length = 0;
      const pk = G.dropPickup('power', p.x + 30, p.y, 1, { pu: kind });
      out[kind] = { pu: pk.pu, icon: pk.icon, has: CH.Sprites.has(pk.icon) };
      const e = G.spawnEnemy('slime', p.x + 80, p.y, {});
      G.collect(pk, p);
      const d = CH.PowerUps.KINDS[kind];
      out[kind].worked = d.instant ? (kind === 'magnet' ? G.vacuum > 0 : kind === 'bomb' ? G.projectiles.length === 0 : G.pickups.length >= 6) : p.buffs[kind] > 0;
      G.enemies.length = 0;
    }
    return out;
  });
  const badPu = Object.keys(pus).filter((k) => !(pus[k].has && pus[k].worked));
  ok(badPu.length === 0, 'all 12 power-up kinds drop with their icon and work', badPu.length ? pus : Object.keys(pus).length);

  const buffFx = await ev(() => {
    const G = CH.G;
    const p = G.player;
    const W = CH.Weapons;
    const r = {};
    p.buffs.focus = 0;
    const cd0 = W.cooldown(p, 'junk');
    p.buffs.focus = 5;
    r.focusCd = W.cooldown(p, 'junk') < cd0;
    p.buffs.focus = 0;
    p.hp = 50;
    p.buffs.regen = 5;
    for (let i = 0; i < 60; i++) p.update(G, 1 / 60);
    r.regen = p.hp > 50;
    p.buffs.regen = 0;
    const x0 = p.xp;
    const lv = p.level;
    p.buffs.scholar = 5;
    CH.Upgrades.addXp(G, 10, p);
    const gain = p.xp - x0 + (p.level - lv) * 1000;
    p.buffs.scholar = 0;
    const x1 = p.xp;
    CH.Upgrades.addXp(G, 10, p);
    r.scholarDouble = gain > p.xp - x1 * 1;
    p.buffs.luck = 5;
    CH.Upgrades.recalc(p);
    r.luckCrit = p.stats.critChance >= CH.Balance.player.critChance + 0.19;
    p.buffs.luck = 0;
    CH.Upgrades.recalc(p);
    const e = G.spawnEnemy('orc', p.x + 200, p.y, {});
    e.state = 'chase';
    e.tgt = { x: p.x, y: p.y, isPlayer: true };
    G.warpT = 5;
    const ax = e.x;
    for (let i = 0; i < 30; i++) e.update(G, 1 / 60);
    const warped = Math.abs(e.x - ax);
    G.warpT = 0;
    const e2 = G.spawnEnemy('orc', p.x + 200, p.y + 40, {});
    e2.state = 'chase';
    e2.tgt = { x: p.x, y: p.y, isPlayer: true };
    const bx = e2.x;
    for (let i = 0; i < 30; i++) e2.update(G, 1 / 60);
    r.timewarp = warped < Math.abs(e2.x - bx) * 0.7;
    return r;
  });
  ok(Object.values(buffFx).every(Boolean), 'new buffs change the game (focus, regen, scholar, luck, time warp)', buffFx);

  const hp = await ev(() => {
    const G = CH.G;
    const a = [];
    for (let i = 0; i < 12; i++) a.push(G.dropPickup('hp', 100, 100, 10).icon);
    const cur = G.dropPickup('curio', 120, 120, 1, { icon: 'pu.' + CH.PowerUps.CURIO_ICONS[3], life: 20 });
    const c0 = G.coins;
    G.collect(cur, G.player);
    return { food: new Set(a).size, all: a.every((i) => /^pu\.\d+$/.test(i) && CH.PowerUps.HEAL_ICONS.includes(+i.slice(3))), curioCoins: G.coins > c0 };
  });
  ok(hp.food > 3 && hp.all, 'health pickups show food and potion icons', hp);
  ok(hp.curioCoins, 'curios pay out coins');

  /* drawing every pickup kind must not throw */
  const draw = await ev(() => {
    const G = CH.G;
    G.pickups.length = 0;
    const p = G.player;
    for (const t of ['coin', 'xp', 'hp', 'power', 'wood', 'scrap', 'stone']) G.dropPickup(t, p.x + 10, p.y + 10, 1, { still: true });
    G.dropPickup('loot', p.x, p.y + 20, 1, { item: 7, still: true });
    G.dropPickup('curio', p.x + 20, p.y + 20, 1, { icon: 'pu.600', still: true });
    try {
      G.render();
      return 'ok';
    } catch (e) {
      return String(e);
    }
  });
  ok(draw === 'ok', 'every pickup type renders', draw);

  /* ---------------------------------------------------------------- codex */
  const codex = await ev(() => {
    const S = CH.Storage;
    S.data.loot = { 5: 4, 9: 1, 100: 2 };
    S.data.seen = { 5: true, 9: true, 100: true, 200: true };
    CH.UI.show('codex');
    CH.Codex.open();
    const cells = document.querySelectorAll('#codex-grid .codex-item').length;
    const unknown = document.querySelectorAll('#codex-grid .codex-item.unknown').length;
    const count = document.getElementById('codex-count').textContent;
    const ms = document.querySelectorAll('#codex-milestones .ms').length;
    CH.Codex.filter = 'stock';
    CH.Codex.render();
    const stockCells = document.querySelectorAll('#codex-grid .codex-item').length;
    CH.Codex.filter = 'all';
    CH.Codex.sel = 5;
    CH.Codex.render();
    const scrap0 = S.resources.scrap;
    CH.Codex.sell1();
    const afterSell1 = { stock: S.loot[5], scrap: S.resources.scrap - scrap0 };
    CH.Codex.sellDupes();
    return { cells, unknown, count, ms, stockCells, afterSell1, finalStock: [S.loot[5], S.loot[100], S.loot[9]], seenKept: !!S.data.seen[5] };
  });
  ok(codex.cells === 367 && codex.unknown === 363 && codex.ms === 6, 'the codex lists all 367 items, hides the unfound ones, shows 6 milestones', codex);
  ok(codex.stockCells === 3 && /4 \/ 367/.test(codex.count), 'in-stock filter and the found counter work');
  ok(codex.afterSell1.stock === 3 && codex.afterSell1.scrap > 0, 'selling an item pays scrap', codex.afterSell1);
  ok(JSON.stringify(codex.finalStock) === '[1,1,1]' && codex.seenKept, 'sell-all-duplicates keeps one of each, and the codex entry stays found', codex.finalStock);

  const nav = await ev(() => {
    CH.G.state = 'menu';
    CH.UI.show('codex');
    CH.Codex.filter = 'all';
    CH.Codex.open();
    const items = [...document.querySelectorAll('#codex-grid .codex-item')];
    items[0].focus();
    CH.UI.navigate('down');
    const idx = items.indexOf(document.activeElement);
    const sel = CH.Codex.sel;
    CH.UI.navigate('up');
    const back = items.indexOf(document.activeElement);
    CH.UI.navigate('right');
    const right = items.indexOf(document.activeElement);
    CH.UI.cancel();
    return { idx, back, right, sel, active: CH.UI.active };
  });
  ok(nav.idx > 3 && nav.back === 0 && nav.right === 1 && nav.sel === nav.idx + 1 && nav.active === 'main', 'the codex works with the D-pad: rows, selection follows focus, B goes back', nav);

  const ms = await ev(() => {
    const S = CH.Storage;
    S.data.seen = {};
    const none = CH.Loot.bonus();
    for (let i = 1; i <= 120; i++) S.data.seen[i] = true; // ~33%
    const some = CH.Loot.bonus();
    CH.G.newRun();
    const p = CH.G.player;
    CH.Upgrades.recalc(p);
    const hp33 = p.stats.maxHp;
    for (let i = 1; i <= 367; i++) S.data.seen[i] = true;
    CH.Upgrades.recalc(p);
    const all = CH.Loot.bonus();
    const r = { none: Object.keys(none).length, someHp: some.hp, hp33, allHp: all.hp, allCoin: all.coinMult, hpAll: p.stats.maxHp, start: (CH.Loot.bonus().startCoins) };
    S.data.seen = {};
    return r;
  });
  ok(ms.none === 0 && ms.someHp === 10 && ms.allHp === 30 && ms.hpAll > ms.hp33, 'codex milestones grant permanent bonuses', ms);

  /* ---------------------------------------------------------------- variants and golems */
  const vars = await ev(() => {
    const G = CH.G;
    G.newRun();
    G.queue.length = 0;
    G.enemies.length = 0;
    G.state = 'playing';
    G.waveState = 'combat';
    const out = { sprites: {}, traits: {} };
    for (const t of Object.keys(CH.Enemies.VARIANTS)) {
      const list = CH.Enemies.VARIANTS[t];
      list.forEach((v, i) => {
        const e = G.spawnEnemy(t, 300 + i * 20, 300, { variant: i + 1 });
        out.sprites[t + (i + 1)] = e.look.sprite === t + '_v' + (i + 1) && e.maxHp > 0 && e.vname === v.name;
        e.dead = true;
      });
    }
    G.enemies.length = 0;
    // golem
    const g = G.spawnEnemy('golem', G.player.x + 40, G.player.y, {});
    g.state = 'chase';
    G.player.invuln = 0;
    out.golem = { sprite: g.look.sprite, hp: g.maxHp };
    // slow-touch variant
    const s = G.spawnEnemy('slime', G.player.x, G.player.y, { variant: 1 });
    s.x = G.player.x;
    s.y = G.player.y;
    s.state = 'chase';
    s.contactCd = 0;
    s.t = 0;
    s.age = 5;
    G.player.slowT = 0;
    for (let i = 0; i < 30; i++) G.update(1 / 60);
    out.traits.slow = G.player.slowT > 0;
    // magma slime explodes, imp slime splits into four
    G.enemies.length = 0;
    const m = G.spawnEnemy('slime', G.player.x + 400, G.player.y, { variant: 2 });
    m.state = 'chase';
    let booms = 0;
    const ex = G.explode;
    G.explode = function () {
      booms++;
      return ex.apply(G, arguments);
    };
    G.damageEnemy(m, 99);
    for (let i = 0; i < 10; i++) G.update(1 / 60);
    G.explode = ex;
    out.traits.boom = booms > 0;
    G.enemies.length = 0;
    const imp = G.spawnEnemy('slime', G.player.x + 400, G.player.y + 20, { variant: 5 });
    imp.state = 'chase';
    G.damageEnemy(imp, 9999);
    out.traits.split = G.enemies.filter((e) => e.type === 'slime' && !e.dead).length === 4;
    // golem slam hurts
    G.enemies.length = 0;
    const g2 = G.spawnEnemy('golem', G.player.x + 30, G.player.y, {});
    g2.state = 'chase';
    g2.spawnTime = 0;
    g2.t = 0;
    let hit = false;
    G.player.hp = G.player.maxHp;
    for (let i = 0; i < 400 && !hit; i++) {
      G.player.invuln = 0;
      G.update(1 / 60);
      if (G.player.hp < G.player.maxHp) hit = true;
    }
    out.golemHit = hit;
    // variant rolls
    let any = 0;
    for (let i = 0; i < 200; i++) if (CH.Enemies.rollVariant('orc', 8, 'wasteland') > 0) any++;
    out.rolls = any;
    out.rollEarly = CH.Enemies.rollVariant('orc', 1, 'wasteland');
    return out;
  });
  ok(Object.values(vars.sprites).every(Boolean) && Object.keys(vars.sprites).length === 16, 'all 16 enemy variants use their own sprite, name and stats', Object.keys(vars.sprites).length);
  ok(vars.golem.sprite === 'golem' && vars.golemHit, 'golems exist and their slam hurts', vars.golem);
  ok(vars.traits.slow && vars.traits.boom && vars.traits.split, 'variant traits work (slow touch, explode, split)', vars.traits);
  ok(vars.rolls > 40 && vars.rollEarly === 0, 'variants appear in later waves only', { rolls: vars.rolls });

  /* queue carries variants */
  const q = await ev(() => {
    const G = CH.G;
    G.newRun();
    G.wave = 8;
    let variants = 0;
    let total = 0;
    for (let i = 0; i < 12; i++) {
      const queue = G.buildQueue(8);
      variants += queue.filter((e) => e.variant > 0).length;
      total += queue.length;
    }
    return { variants, total };
  });
  ok(q.variants > 0, 'later waves queue enemy variants', q);

  /* ---------------------------------------------------------------- schedule has every new boss */
  const sched = await ev(() => {
    const kinds = new Set();
    const G = CH.G;
    for (let run = 0; run < 36; run++) {
      G.runIndex = run;
      for (const w of [3, 5, 8, 10]) kinds.add(G.isBossWave(w).kind);
    }
    G.runIndex = 0;
    G.endless = true;
    for (let w = 15; w < 15 + 5 * 24; w += 5) kinds.add(G.isBossWave(w).kind);
    G.endless = false;
    return [...kinds].sort();
  });
  ok(sched.length === 22, 'the campaign and endless rotations reach all 22 bosses', sched.length + ' ' + sched.join(','));

  /* the wave-10 bosses all end the run with a win */
  for (const kind of ['bug', 'skull', 'daddy']) {
    const win = await ev((kind) => {
      const G = CH.G;
      G.newRun();
      G.queue.length = 0;
      G.enemies.length = 0;
      G.state = 'playing';
      G.wave = 10;
      G.spawnBoss(kind, 0);
      G.waveState = 'combat';
      const b = G.enemies.find((e) => e.isBoss);
      b.intro = 0;
      b.setState('chase');
      G.damageEnemy(b, 1e9);
      for (let i = 0; i < 60 * 9; i++) {
        G.player.hp = G.player.maxHp;
        G.update(1 / 60);
        CH.Input.endFrame();
        if (G.state === 'victory') break;
      }
      return { state: G.state, won: G.won };
    }, kind);
    ok(win.state === 'victory' && win.won, 'beating the wave-10 boss ' + kind + ' wins the run', win);
  }

  /* ---------------------------------------------------------------- run summary */
  const sum = await ev(() => {
    const G = CH.G;
    G.newRun();
    G.state = 'playing';
    G.runLoot = { 7: 2, 62: 1 };
    G.lootCount = 3;
    G.newLoot = 2;
    G.gameOver();
    return { html: document.getElementById('go-stats').innerHTML };
  });
  ok(/Trophies found/.test(sum.html) && /loot-row/.test(sum.html), 'the game-over screen lists the trophies found', sum.html.length);

  console.log('console errors:', errs.length ? errs.join('\n') : 'none');
  ok(errs.length === 0, 'no console errors');
  console.log(fails ? 'FAILED ' + fails : 'ALL PASSED');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
