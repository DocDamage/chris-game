/* Omens (PLAN.md 18, K10): with a character the random chaos timer is off; stages after the first may carry one omen
   with a cause to break; it grows while left alone; breaking it pays and it stays broken in that area. */
const { open } = require('./lib');
(async () => {
  const { browser, page, errs } = await open({ levels: true });
  let fails = 0;
  const ok = (name, c, extra) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + name + (c ? '' : ' ' + JSON.stringify(extra))); };

  let r = await page.evaluate(() => {
    const O = CH.Omens, out = { none1: true, count: 0, kinds: {} };
    for (let seed = 1; seed <= 40; seed++) {
      if (O.pick(1, 'deadwood', seed * 99)) out.none1 = false;
      for (const [n, b] of [[2, 'deadwood'], [5, 'gaslight'], [7, 'frozen']]) { const id = O.pick(n, b, seed * 99); if (id) { out.count++; out.kinds[id] = (out.kinds[id] || 0) + 1; if (O.DEFS[id].only && !O.DEFS[id].only.includes(b)) out.bad = id; } }
    }
    return out;
  });
  ok('never on the first stage; about two in five after it; each where it belongs', r.none1 && r.count > 25 && r.count < 75 && !r.bad && Object.keys(r.kinds).length >= 5, r);

  // a blood moon in a character's stage: the cause, growth, the payout, broken for good
  r = await page.evaluate(() => {
    const G = CH.G, St = CH.Storage, O = CH.Omens;
    localStorage.removeItem(St.KEY3);
    St.load();
    St.createSlot({ hero: 'Mercenary', name: 'Moonstruck' });
    G._scriptTesting = true;
    G.newRun(null);
    G.eventTimer = 0;
    for (let i = 0; i < 10; i++) CH.stepFrame(1 / 30);
    const noChaos = !G.event; // the old timer is off for a character
    G.startWave(2);
    O.end(false);
    O.begin('bloodmoon', G.level);
    const o = O.cur;
    const hit = { dmg: 10 };
    // grows after a minute
    o.t = 59.99;
    CH.stepFrame(1 / 30); CH.stepFrame(1 / 30);
    const grew = o.grow === 1;
    const coins0 = G.coins;
    CH.Weapons.damageProp(G, o.cause, 1e6, G.player);
    CH.stepFrame(1 / 30);
    const W = St.slot().world;
    return { noChaos, cause: !!o.cause, grew, ended: !O.cur, paid: G.coins > coins0, kept: W.omens[2] === true };
  });
  ok('the old random chaos is off for a character', r.noChaos, r);
  ok('an omen has a cause, grows when left, and breaking it pays', r.cause && r.grew && r.ended && r.paid, r);
  ok('a broken omen stays broken in its area', r.kept, r);

  // the ritual: chanters; killing them ends it
  r = await page.evaluate(() => {
    const G = CH.G, O = CH.Omens;
    O.begin('ritual', G.level);
    const o = O.cur;
    const n = o.chanters.length;
    for (const e of o.chanters) G.killEnemy(e);
    CH.stepFrame(1 / 30);
    return { n, ended: !O.cur };
  });
  ok('the ritual ends when its chanting cultists die', r.n === 3 && r.ended, r);

  ok('no console errors', errs.length === 0, errs.slice(0, 5));
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
