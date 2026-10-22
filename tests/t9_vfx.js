/* Attack VFX: (1) a gallery of every element x meaning, saved as v_<element>.png for a visual check,
   (2) every enemy attack, every boss attack and every hero skill actually plays kit effects. */
const { open } = require('./lib');
const path = require('path');

const results = [];
const ok = (name, cond, extra) => results.push([cond ? 'PASS' : 'FAIL', name, extra === undefined ? '' : JSON.stringify(extra)]);

(async () => {
  const { browser, page, errs } = await open();
  await page.evaluate(() => {
    const G = CH.G;
    G.newRun();
    G.queue.length = 0;
    G.enemies.length = 0;
    window.__bot.god = true;
  });
  ok('art bundle loaded', await page.evaluate(() => CH.Art.on && !!CH.Kit));

  /* ---------- 1. gallery ---------- */
  const elems = await page.evaluate(() => Object.keys(CH.Kit.elements).filter((k) => k !== 'glitch' && k !== 'cheese'));
  const slots = ['cast', 'muzzle', 'hit', 'crit', 'slash', 'impact', 'dash', 'trail'];
  const missing = await page.evaluate(() => {
    const out = [];
    for (const e of Object.keys(CH.Kit.elements)) {
      for (const [slot, layers] of Object.entries(CH.Kit.elements[e])) for (const l of layers) if (!CH.Sprites.has(l[0])) out.push(e + '.' + slot + ':' + l[0]);
    }
    return out;
  });
  ok('every recipe layer exists in the VFX bundle', missing.length === 0, missing);

  const frames = [0.1, 0.26];
  for (let i = 0; i < elems.length; i += 2) {
    for (const t of frames) {
      await page.evaluate(({ pair, slots, t }) => {
        const G = CH.G;
        const K = CH.Kit;
        const p = G.player;
        CH.FX.reset();
        G.enemies.length = 0;
        G.projectiles.length = 0;
        G.zones.length = 0;
        pair.forEach((el, row) => {
          const y = p.y + (row ? 62 : -66);
          slots.forEach((s, c) => {
            const x = p.x - 210 + c * 60;
            const a = 0;
            if (s === 'cast') K.cast(el, x, y, 18);
            else if (s === 'muzzle') K.muzzle(el, x, y, a, 9, { force: true });
            else if (s === 'hit') K.hit(el, x, y, 13);
            else if (s === 'crit') K.hit(el, x, y, 16, true);
            else if (s === 'slash') K.slash(el, x - 10, y, a, 22);
            else if (s === 'impact') K.impact(el, x, y, 26);
            else if (s === 'dash') K.dash(el, x + 10, y, Math.PI, 14);
            else K.trail(el, x, y, 8);
          });
        });
        window.__bot.step(Math.round(t * 60));
      }, { pair: elems.slice(i, i + 2), slots, t });
      const file = path.join(__dirname, `v_${elems[i]}_${elems[i + 1] || 'x'}_${Math.round(t * 100)}.png`);
      await page.locator('#game').screenshot({ path: file });
    }
  }
  console.log('gallery rows (top/bottom):', elems.map((e, i) => e).join(', '), '| columns:', slots.join(', '));

  /* ---------- 2. heroes ---------- */
  for (const hero of ['Mercenary', 'Dreadbloom', 'Vexaria']) {
    const r = await page.evaluate((hero) => {
      const G = CH.G;
      CH.Storage.settings.hero = hero;
      G.newRun();
      G.queue.length = 0;
      G.enemies.length = 0;
      G.waveState = 'combat';
      const p = G.player;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        G.spawnEnemy('chicken', p.x + Math.cos(a) * 50, p.y + Math.sin(a) * 50, { spawnTime: 0 });
      }
      p.weapons = ['junk', 'pizza', 'chicken', 'baguette', 'chair', 'problem'];
      for (const w of p.weapons) p.ws[w] = p.ws[w] || CH.Weapons.newState(w);
      p.stats.dmgMult = 0.05; // keep the dummies alive
      const out = {};
      CH.Kit.log = [];
      for (const w of p.weapons) {
        p.selectWeapon(w);
        p.ws[w].cd = 0;
        p.ws[w].reload = 0;
        if (p.ws[w].ammo !== undefined) p.ws[w].ammo = 99;
        const before = CH.Kit.count;
        p.aim = 0;
        CH.Weapons.tryFire(G, p);
        window.__bot.step(20);
        out[w] = CH.Kit.count - before;
        for (const e of G.enemies) e.hp = e.maxHp;
      }
      // roll + special
      p.rollCd = 0;
      p.stamina = 100;
      const b0 = CH.Kit.count;
      p.startRoll(G, { x: 1, y: 0 }, true);
      window.__bot.step(10);
      out.roll = CH.Kit.count - b0;
      p.stats.dmgMult = 1;
      p.specialCd = 0;
      const b1 = CH.Kit.count;
      p.special(G);
      window.__bot.step(60);
      out.special = CH.Kit.count - b1;
      return { out, hero: p.hero.id };
    }, hero);
    const bad = Object.entries(r.out).filter(([, v]) => !(v > 0)).map(([k]) => k);
    ok(`hero ${hero}: every weapon, the roll and the special play VFX`, bad.length === 0, bad.length ? bad : r.out);
    await page.locator('#game').screenshot({ path: path.join(__dirname, `v_hero_${hero}.png`) });
  }

  /* ---------- 3. enemy attacks ---------- */
  const types = ['chicken', 'potato', 'trashcan', 'office', 'toaster', 'influencer', 'cart', 'pigeon', 'fridge', 'plant', 'slime', 'orc', 'goblin', 'spider', 'golem'];
  for (const type of types) {
    const r = await page.evaluate((type) => {
      const G = CH.G;
      CH.Storage.settings.hero = 'Mercenary';
      G.newRun();
      G.queue.length = 0;
      G.enemies.length = 0;
      G.waveState = 'combat';
      window.__bot.god = true;
      const p = G.player;
      p.stats.dmgMult = 0.01;
      const off = { chicken: 20, trashcan: 34, office: 100, fridge: 120, influencer: 70, cart: 110, slime: 24, orc: 30, golem: 38 }[type] || 70;
      const e = G.spawnEnemy(type, p.x + off, p.y, { spawnTime: 0 });
      e.state = 'chase';
      e.atkCd = e.chargeCd = e.shotCd = e.flashCd = e.diveCd = 0;
      let attacked = false;
      let fxAtk = 0;
      let fxIdle = 0;
      CH.Kit.log = [];
      for (let i = 0; i < 60 * 8; i++) {
        const before = CH.Kit.count;
        // keep the target in range and still
        p.x = e.x - off;
        p.y = e.y;
        window.__bot.step(1);
        const d = CH.Kit.count - before;
        if (e.state === 'attack') {
          attacked = true;
          fxAtk += d;
        } else fxIdle += d;
        if (attacked && e.state === 'chase' && i > 120 && fxAtk > 0) break;
      }
      return { attacked, fxAtk, layers: [...new Set(CH.Kit.log)].length };
    }, type);
    ok(`enemy ${type}: attack plays VFX`, r.attacked && r.fxAtk > 0, r);
  }

  /* ---------- 4. boss attacks ---------- */
  for (const kind of ['frog', 'bd', 'gol', 'maw', 'ceo', 'chicken', 'bug', 'dragon', 'beholder', 'mage', 'demon', 'ooze', 'treant', 'knight', 'moss', 'sporeeye', 'yeti', 'dunewyrm', 'bloodwyrm', 'voideye', 'daddy', 'skull']) {
    const r = await page.evaluate((kind) => {
      const G = CH.G;
      CH.Storage.settings.hero = 'Mercenary';
      G.newRun();
      G.queue.length = 0;
      G.enemies.length = 0;
      G.wave = { frog: 3, bd: 3, ceo: 5, maw: 8, gol: 8, chicken: 8, bug: 10 }[kind] || 6;
      const b = window.__bot;
      b.god = true;
      b.human = { reaction: 14, jitter: 0.09, mistake: 0.1 };
      G.spawnBoss(kind, 0);
      G.waveState = 'combat';
      const boss = G.enemies.find((e) => e.isBoss);
      boss.hp = boss.maxHp = 1e9; // survive long enough to show every attack
      const seen = {};
      const plain = {};
      for (let i = 0; i < 60 * 80; i++) {
        const before = CH.Kit.count;
        b.step(1);
        if (boss.intro > 0) continue;
        const name = boss.last || '?';
        seen[name] = (seen[name] || 0) + (CH.Kit.count - before);
        plain[name] = (plain[name] || 0) + 1;
      }
      return { seen, frames: plain, phases: boss.phase };
    }, kind);
    const dead = Object.entries(r.seen).filter(([k, v]) => k !== '?' && v === 0).map(([k]) => k);
    const attacks = Object.keys(r.seen).filter((k) => k !== '?' && k !== '');
    ok(`boss ${kind}: every attack (${attacks.join(',')}) plays VFX`, dead.length === 0 && attacks.length >= 3, { vfx: r.seen, dead });
  }

  /* ---------- 5. reduced effects keeps working ---------- */
  const reduced = await page.evaluate(() => {
    CH.Storage.settings.reduced = true;
    const G = CH.G;
    G.newRun();
    G.queue.length = 0;
    G.enemies.length = 0;
    const p = G.player;
    const before = CH.FX.parts.length;
    CH.Kit.impact('fire', p.x + 40, p.y, 30);
    CH.Kit.cast('magic', p.x - 40, p.y, 20);
    const n = CH.FX.parts.length - before;
    window.__bot.step(30);
    CH.Storage.settings.reduced = false;
    return n;
  });
  ok('reduced effects plays only the main layer', reduced === 2, reduced);

  /* ---------- 6. soak: a long fight does not blow the particle budget ---------- */
  const soak = await page.evaluate(() => {
    const G = CH.G;
    G.newRun();
    G.queue.length = 0;
    G.enemies.length = 0;
    G.wave = 10;
    window.__bot.god = true;
    G.spawnBoss('bug', 0);
    G.waveState = 'combat';
    let max = 0;
    for (let i = 0; i < 60 * 30; i++) {
      window.__bot.step(1);
      max = Math.max(max, CH.FX.parts.length);
    }
    return { max, cap: CH.FX.max };
  });
  ok('particle count stays under the cap during a bullet-hell boss', soak.max < soak.cap, soak);

  for (const r of results) console.log(r[0], r[1], r[2]);
  const failed = results.filter((r) => r[0] === 'FAIL').length;
  console.log('console errors:', errs.length ? errs.join('\n') : 'none', JSON.stringify(await page.evaluate(() => CH.errors)));
  console.log(failed ? 'FAILED ' + failed + ' of ' + results.length : 'ALL ' + results.length + ' PASSED');
  await browser.close();
})();
