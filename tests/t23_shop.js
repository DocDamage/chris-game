/* Vending machine shop: interact pauses the game and opens the menu; buy, sell, buyback, reroll, leave. */
const { open } = require('./lib');
(async () => {
  const { browser, page, errs } = await open();
  const out = await page.evaluate(async () => {
    const G = CH.G, X = CH.X, S = CH.Storage, Sh = CH.Shop, r = {};
    const step = (n) => { for (let i = 0; i < n; i++) CH.stepFrame(1 / 30); };
    X.startRun({}, null); G._scriptTesting = true; G.startWave(2);
    for (const p of G.players) p.hp = p.maxHp = 100;
    step(30);
    const m = G.machine; const p = G.player;
    r.hasMachine = !!m;
    p.x = m.x; p.y = m.y + 10; G.coins = 500;
    G.interact(p);
    r.state = G.state; r.open = Sh.open; r.screen = CH.UI.active;
    const t0 = G.time; step(30); r.frozen = G.time === t0;
    r.cats = document.querySelectorAll('#vend-tabs .btn').length;
    r.cells = document.querySelectorAll('#vend-grid .vend-cell').length;
    // buy a heal food item
    p.hp = 20;
    Sh.cat = 'food'; Sh.sel = 0; const items = Sh.items();
    const c0 = G.coins; const ok = Sh.buy(items[0]);
    r.bought = ok && G.coins < c0 && p.hp > 20;
    // sold out items cannot be bought twice
    r.twice = Sh.buy(items[0]) === false;
    // too poor
    G.coins = 0; r.poor = Sh.buy(Sh.items()[1]) === false;
    // sell + buyback
    S.data.loot = { 5: 2 }; G.coins = 100; Sh.cat = 'sell';
    const sell = Sh.items()[0]; const cs = G.coins; Sh.buy(sell);
    r.sold = G.coins > cs && S.loot[5] === 1 && Sh.buyback.length === 1;
    r.buybackListed = Sh.items().some((i) => i.buyback !== undefined);
    // reroll
    G.coins = 500; const before = G.machine.stock.rolls; Sh.cat = 'power'; Sh.reroll(); r.rerolled = G.machine.stock.rolls === before + 1;
    // every category renders items
    r.catItems = {};
    for (const c of Sh.CATS) { Sh.cat = c.id; r.catItems[c.id] = Sh.items().length; }
    // gamble works and is repeatable
    Sh.cat = 'gamble'; G.coins = 100; const g1 = Sh.buy(Sh.items()[0]); const g2 = Sh.buy(Sh.items()[0]); r.gamble = g1 && g2;
    Sh.close(); r.closed = G.state === 'playing' && !Sh.open;
    step(20); r.runs = G.time > t0;
    return r;
  });
  console.log(JSON.stringify(out));
  const ok = out.hasMachine && out.state === 'shop' && out.open && out.screen === 'vend' && out.frozen && out.cats >= 6 && out.cells >= 5 &&
    out.bought && out.twice && out.poor && out.sold && out.buybackListed && out.rerolled && out.catItems.food >= 6 && out.catItems.power >= 3 && out.catItems.services >= 4 &&
    out.gamble && out.closed && out.runs;
  console.log('errors', errs);
  console.log(ok && !errs.length ? 'ALL PASSED' : 'FAILED');
  await browser.close();
  process.exit(ok && !errs.length ? 0 : 1);
})();
