const { open } = require('./lib');
(async () => {
  const { browser, page, errs } = await open();
  const out = await page.evaluate(() => {
    const G = CH.G, X = CH.X, Up = CH.Upgrades, B = CH.Balance;
    const res = {};
    G.newRun();
    const p = G.player;
    // rarity + cards
    p.upgrades.luck = 4; Up.recalc(p);
    const rar = {};
    for (let i = 0; i < 200; i++) for (const c of Up.makeCards(G, p)) rar[c.rarity] = (rar[c.rarity] || 0) + 1;
    res.rarities = rar;
    // always 3 cards, unique
    let bad = 0;
    for (let i = 0; i < 100; i++) { const cs = Up.makeCards(G, p); if (cs.length !== 3 || new Set(cs.map((c) => c.kind + c.id)).size !== 3) bad++; }
    res.badCardSets = bad;
    // evolution
    p.ws.junk.level = 6; p.upgrades.bonk = 1; Up.recalc(p);
    const cs = Up.makeCards(G, p);
    res.evoOffered = cs.some((c) => c.kind === 'evolve');
    Up.applyCard(G, cs.find((c) => c.kind === 'evolve'), p);
    res.evolved = !!p.evo.junk;
    const n0 = G.projectiles.length;
    p.ws.junk.cd = 0; CH.Weapons.tryFire(G, p, 'junk');
    res.junkProjectiles = G.projectiles.length - n0;
    // level-up flow with reroll / banish / skip
    G.pendingLevels = 1; G.openLevelUp();
    const before = JSON.stringify(G.cards.map((c) => c.id));
    X.reroll();
    res.rerolled = p.rr.reroll === 2;
    const first = G.cards[0];
    X.toggleBanish(); G.pickUpgrade(0);
    res.banished = p.banned.has(first.kind + ':' + first.id) && p.rr.banish === 1;
    const lvl0 = p.level;
    X.skip();
    res.skipDone = G.state === 'playing' && p.rr.skip === 1;
    // perks
    p.perks.firetrail = 1; p.perks.tenth = 1; p.perks.reloadmine = 1; p.perks.chain = 1; p.perks.glass = 1; p.perks.greed = 1; p.perks.frenzy = 1; p.perks.hex = 1; p.perks.turretbar = 1;
    Up.recalc(p);
    res.fireRate = p.stats.fireRate; res.maxHp = p.maxHp;
    p.hp = 10; G.healPlayer(20, p); res.hpAfterHeal = p.hp;
    p.rolling = true; p.rollT = 0.2;
    for (let i = 0; i < 40; i++) G.step(1 / 60);
    res.trailZones = X.zones.length;
    return res;
  });
  console.log(JSON.stringify(out, null, 1));
  console.log('errors:', errs.length ? errs.join('\n') : 'none', JSON.stringify(await page.evaluate(() => window.CH.errors)));
  await browser.close();
})();
