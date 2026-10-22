/* The three newer heroes: real sprites (with the new animation sets), kits, fear status, passives. */
const { open } = require('./lib');
(async () => {
  const { browser, page, errs } = await open();
  const out = await page.evaluate(async () => {
    const G = CH.G, X = CH.X, S = CH.Storage, r = {};
    const god = () => { for (const p of G.players) p.hp = p.maxHp = 1e6; };
    const step = (n) => { for (let i = 0; i < n; i++) G.update(1 / 30); };
    r.ids = CH.Balance.heroes.map((h) => h.id).join(',');
    r.art = {};
    for (const id of ['Enchantress', 'Specter', 'Stranger']) {
      r.art[id] = { sheet: CH.Sprites.has('hero.' + id), meta: !!CH.Assets.meta.heroes[id], death: !!(CH.Assets.meta.heroes[id] && CH.Assets.meta.heroes[id].anims.death) };
    }
    for (const id of ['Enchantress', 'Specter', 'Stranger']) {
      S.settings.hero = id;
      X.startRun({}, null); G._scriptTesting = true; G.startWave(2); god();
      const p = G.player;
      r[id] = { hero: p.hero.id, special: p.hero.special };
      for (let i = 0; i < 12; i++) G.spawnEnemy('orc', p.x + Math.cos(i / 12 * 6.283) * 70, p.y + Math.sin(i / 12 * 6.283) * 70, {});
      step(40);
      p.specialCd = 0;
      const t0 = X.turrets.length, x0 = p.x, y0 = p.y;
      const hp0 = G.enemies.filter((e) => !e.dead).map((e) => e.hp).reduce((a, b) => a + b, 0);
      p.special(G);
      step(60);
      if (id === 'Enchantress') r[id].spirits = X.turrets.length - t0;
      if (id === 'Specter') { r[id].moved = Math.round(Math.hypot(p.x - x0, p.y - y0)); r[id].damaged = G.enemies.filter((e) => !e.dead).map((e) => e.hp).reduce((a, b) => a + b, 0) < hp0; }
      if (id === 'Stranger') {
        r[id].feared = G.enemies.filter((e) => e.fearT > 0).length;
        const e = G.enemies.find((q) => q.fearT > 0);
        if (e) {
          const d0 = Math.hypot(e.x - p.x, e.y - p.y);
          step(30);
          r[id].fled = Math.hypot(e.x - p.x, e.y - p.y) > d0;
          const hp = e.hp; G.damageEnemy(e, 10, { src: 'player', shooter: p });
          r[id].bonus = Math.round((hp - e.hp) * 10) / 10;
        }
      }
      // specter passive: crit builds while not hit, resets on a hit
      if (id === 'Specter') {
        const c0 = p.stats.critChance; p.noHitT = 5; CH.Upgrades.recalc(p);
        r[id].critBuilt = p.stats.critChance > c0;
      }
    }
    S.settings.hero = CH.Balance.heroes[0].id;
    return r;
  });
  console.log(JSON.stringify(out, null, 1));
  const o = out;
  const ok = o.ids.includes('Enchantress') && !o.ids.includes('Wrangler') &&
    ['Enchantress', 'Specter', 'Stranger'].every((id) => o.art[id].sheet && o.art[id].meta) && o.art.Specter.death &&
    o.Enchantress.spirits >= 5 && Math.abs(o.Specter.moved) > 60 && o.Specter.damaged && o.Specter.critBuilt &&
    o.Stranger.feared >= 3 && o.Stranger.fled && o.Stranger.bonus >= 10;
  console.log('errors', errs);
  console.log(ok && !errs.length ? 'ALL PASSED' : 'FAILED');
  await browser.close();
  process.exit(ok && !errs.length ? 0 : 1);
})();
