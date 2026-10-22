/* Diablo layer: gear rolls and affixes feed stats, equip / salvage, persistence, ground drops, belt, shop gear,
   quests, tiers and the secret sidekick unlocks. */
const { open } = require('./lib');
(async () => {
  const { browser, page, errs } = await open({ levels: true });
  const out = await page.evaluate(() => {
    const G = CH.G, X = CH.X, S = CH.Storage, I = CH.Items, Q = CH.Quests, SK = CH.SK, r = {};
    const step = (n) => { for (let i = 0; i < n; i++) { if (G.state === 'levelup') while (G.state === 'levelup') G.pickUpgrade(0); CH.stepFrame(1 / 30); } };
    S.data.diablo.bag.length = 0;
    X.startRun({}, null); G._scriptTesting = true; for (const p of G.players) p.hp = p.maxHp = 100;
    const p = G.player;
    // rolls
    const rar = {};
    for (let i = 0; i < 400; i++) { const it = I.roll(5, {}); rar[it.rarity] = (rar[it.rarity] || 0) + 1; if (!I.validate(it)) r.badRoll = true; }
    r.rarities = Object.keys(rar).length;
    r.magicAffixes = I.roll(5, { rarity: 'magic' }).aff.length >= 1 && I.roll(5, { rarity: 'rare' }).aff.length >= 3;
    // equip raises stats
    const hp0 = p.stats.maxHp, dm0 = p.stats.dmgMult;
    const helm = I.roll(10, { rarity: 'rare', slot: 'helm' });
    I.addToBag(helm); I.equip(p, helm);
    r.equipped = I.equippedOf(p).helm === helm && (p.stats.maxHp > hp0 || p.stats.dmgMult > dm0 || p.stats.critChance > 0.05 || p.stats.healMult > 1 || p.stats.luck > 0);
    r.bagAfter = I.bag().length === 0;
    // swapping returns the old one to the bag
    const helm2 = I.roll(10, { rarity: 'magic', slot: 'helm' }); I.addToBag(helm2); I.equip(p, helm2);
    r.swapped = I.bag().includes(helm) && I.equippedOf(p).helm === helm2;
    // legendary effect + set bonus
    const leg = I.roll(8, { rarity: 'legendary', slot: 'ring' }); r.legendary = !!leg.uniq && leg.aff.length >= 2;
    const parts = ['helm', 'chest', 'boots'].map((s) => { let it; do { it = I.roll(5, { rarity: 'set' }); } while (it.set !== 'gnome' || it.slot !== s); return it; });
    const before = p.stats.dmgMult;
    for (const it of parts) { I.addToBag(it); I.equip(p, it); }
    r.setBonus = p.stats.dmgMult > before && p.stats.extraProj >= 1;
    // salvage
    const junk = I.roll(5, { rarity: 'rare' }); I.addToBag(junk);
    const scrap0 = S.resources.scrap; const got = I.salvage(junk); r.salvaged = !!got && S.resources.scrap > scrap0 && !I.bag().includes(junk);
    // persistence: save, reload, equipped + bag survive validation
    I.addToBag(I.roll(4, { rarity: 'magic' }));
    const nb = I.bag().length; S.save(); S.load();
    r.persist = I.equippedOf(G.player || p).helm && S.data.diablo.bag.length === nb && !!S.data.diablo.equipped[p.hero.id];
    r.garbage = S.sanitize({ diablo: { bag: [{ slot: 'helm', rarity: 'godlike', aff: [['hp', 99999]] }, { slot: 'x' }, null, 5] } }).diablo.bag.length === 0;
    // ground drop + pickup
    X.startRun({}, null); G._scriptTesting = true; for (const q of G.players) q.hp = q.maxHp = 1e6;
    const q = G.player; const bag0 = I.bag().length;
    I.drop(q.x + 5, q.y, I.roll(3, { rarity: 'rare' })); step(30);
    // the drop tumbles up to ~30px sideways before it lands: the hero walks over to it, as a player would
    if (I.ground.length) { q.x = I.ground[0].x; q.y = I.ground[0].y; step(10); }
    r.pickedUp = I.bag().length === bag0 + 1 && I.ground.length === 0;
    // belt: meat heals over time; portal quill only on the belt
    q.hp = 10; I.addConsumable(q, 'steak', 1); const bi = I.belt(q).findIndex((s) => s && s.id === 'steak'); I.useBelt(q, bi); step(30 * 9);
    r.belt = q.hp > 40 && I.belt(q)[bi] === null;
    r.beltCd = (() => { I.addConsumable(q, 'meat', 3); const i = I.belt(q).findIndex((s) => s && s.id === 'meat'); I.useBelt(q, i); return I.useBelt(q, i) === false; })();
    // shop: gear category, buying and selling gear
    const m = G.machine || (G.machine = { x: q.x, y: q.y, uses: 1, t: 0 }); G.coins = 5000; q.x = m.x; q.y = m.y;
    G.state = 'playing'; CH.Shop.open = false; G.interact(q);
    CH.Shop.cat = 'gear'; const gi = CH.Shop.items(); r.gearStock = gi.length;
    const bag1 = I.bag().length; r.boughtGear = CH.Shop.buy(gi[0]) && I.bag().length === bag1 + 1;
    CH.Shop.cat = 'sell'; const sg = CH.Shop.items().find((x) => x.gearSell); const c1 = G.coins; r.soldGear = !!sg && CH.Shop.buy(sg) && G.coins > c1;
    CH.Shop.cat = 'food'; r.beltFood = (() => { const b0 = I.belt(q).filter(Boolean).length; const meat = CH.Shop.items().find((x) => x.id === 'meat'); CH.Shop.buy(meat); return I.belt(q).some((s) => s && s.id === 'meat'); })();
    CH.Shop.close();
    // quests
    S.data.diablo.quests = {}; S.data.diablo.counts = {};
    for (let i = 0; i < 6; i++) Q.event('breach');
    r.questDone = Q.state('a1_breach').st === 'done';
    const c0 = S.stats.totalCoins; const coins0 = G.coins; r.claimed = Q.claim('a1_breach') && Q.state('a1_breach').st === 'claimed' && G.coins > coins0;
    r.noDoubleClaim = Q.claim('a1_breach') === false;
    // lost shrine quest unlocks the Rune Golem
    SK.unlock && (S.data.sidekicks.unlocked = []);
    Q.event('lost'); r.runegolem = SK.isUnlocked('runegolem');
    // tiers
    r.tierLocked = Q.setTier(1) === false;
    S.data.diablo.tierUnlocked = 1; r.tierSet = Q.setTier(1) && Q.tier() === 1;
    X.startRun({}, null); r.tierHp = G.diff.enemyHp > CH.Balance.difficulty[S.settings.difficulty].enemyHp;
    Q.setTier(0);
    // secret sidekicks
    S.data.sidekicks.unlocked = [];
    G.onBossDefeated({ kind: 'dragon', tier: 0, x: 0, y: 0, name: 'x' }); r.aurex = SK.isUnlocked('aurex');
    G.onBossDefeated({ kind: 'skull', tier: 0, x: 0, y: 0, name: 'x' }); r.maldrath = SK.isUnlocked('maldrath');
    S.data.diablo.counts.eliteLife = 99; const e = G.spawnEnemy('orc', G.player.x + 60, G.player.y, { elite: true, spawnTime: 0 }); step(1); e.hp = 1; G.damageEnemy(e, 999, { src: 'player', shooter: G.player }); r.raven = SK.isUnlocked('raven');
    S.reset();
    return r;
  });
  console.log(JSON.stringify(out));
  const ok = out.rarities >= 4 && !out.badRoll && out.magicAffixes && out.equipped && out.bagAfter && out.swapped && out.legendary && out.setBonus && out.salvaged && out.persist && out.garbage &&
    out.pickedUp && out.belt && out.beltCd && out.gearStock >= 3 && out.boughtGear && out.soldGear && out.beltFood && out.questDone && out.claimed && out.noDoubleClaim && out.runegolem &&
    out.tierLocked && out.tierSet && out.tierHp && out.aurex && out.maldrath && out.raven;
  console.log('errors', errs);
  console.log(ok && !errs.length ? 'ALL PASSED' : 'FAILED');
  await browser.close();
  process.exit(ok && !errs.length ? 0 : 1);
})();
