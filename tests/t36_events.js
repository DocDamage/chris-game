/* Events (PLAN.md section 16, step 2): G.call's order and take-over rules, and the calls that take over or change
   their arguments: shields, fear, a hit on the hero. */
const { open } = require('./lib');
(async () => {
  const { browser, page, errs } = await open({});
  let fails = 0;
  const ok = (name, c, extra) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + name + (c ? '' : ' ' + JSON.stringify(extra))); };

  // 1. G.call: ':before' newest first, the core, then the plain listeners oldest first; a take-over skips the older
  //    before-listeners, the core and the older after-listeners, and the newer after-listeners still run
  let r = await page.evaluate(() => {
    const G = CH.G, log = [];
    G.on('t36:before', (ev) => log.push('b1'));
    G.on('t36', (ev) => log.push('a1'));
    G.on('t36:before', (ev) => { log.push('b2'); if (ev.take) { ev.stop = true; ev.result = 'taken'; } });
    G.on('t36', (ev) => log.push('a2'));
    G.on('t36:before', (ev) => log.push('b3'));
    G.on('t36', (ev) => log.push('a3:' + ev.result));
    const core = (ev) => { log.push('core'); return 'core'; };
    const plain = G.call('t36', {}, core), a = log.splice(0);
    const taken = G.call('t36', { take: true }, core), b = log.splice(0);
    return { plain, a, taken, b };
  });
  ok('before-listeners newest first, core, after-listeners oldest first', r.plain === 'core' && r.a.join() === 'b3,b2,b1,core,a1,a2,a3:core', r);
  ok('a take-over skips older before-listeners, the core and older after-listeners', r.taken === 'taken' && r.b.join() === 'b3,b2,a2,a3:taken', r);

  // 2. every converted call has its listeners (none fell back to a wrapper)
  r = await page.evaluate(() => {
    const h = CH.G.hooks(), n = (k) => (h[k] || []).length;
    return { newRun: [n('newRun:before'), n('newRun')], startWave: [n('startWave:before'), n('startWave')], damageEnemy: [n('damageEnemy:before'), n('damageEnemy')], hurtPlayer: [n('hurtPlayer:before'), n('hurtPlayer')], playerUpdate: [n('playerUpdate:before'), n('playerUpdate')] };
  });
  ok('listeners: newRun 10 + 9, startWave 5 + 9 (js/character.js, js/areas.js, js/clinic.js, js/cult.js, js/omens.js and js/worldmap.js add theirs, the path prompt went), damageEnemy 4 + 4, hurtPlayer 2 + 3, playerUpdate 6 + 5',
    JSON.stringify(r) === JSON.stringify({ newRun: [10, 9], startWave: [5, 9], damageEnemy: [4, 4], hurtPlayer: [2, 3], playerUpdate: [6, 5] }), r);

  // 3. shields, fear and a hit on the hero
  r = await page.evaluate(() => {
    const G = CH.G, X = CH.X, out = {};
    X.startRun({ mode: 'classic' }, null);
    G._scriptTesting = true;
    for (let i = 0; i < 30; i++) G.update(1 / 60);
    const p = G.player;
    const mob = () => { const e = G.spawnEnemy('orc', p.x + 200, p.y, { spawnTime: 0 }); e.state = 'idle'; e.maxHp = e.hp = 500; e.update = function () {}; return e; };
    // a shield that swallows the hit: nothing reaches the core or the damage stats
    let e = mob();
    e.shieldHp = 50;
    const dmg0 = X.rs.dmg;
    out.swallow = { r: G.damageEnemy(e, 20, { shooter: p }), hp: e.hp, shield: e.shieldHp, counted: X.rs.dmg - dmg0 };
    // a shield that takes part of it
    e.shieldHp = 10;
    out.partial = { r: G.damageEnemy(e, 30, { shooter: p }), hp: e.hp, shield: e.shieldHp, counted: X.rs.dmg - dmg0 };
    // fear: +25%, before the shield sees it
    e = mob();
    e.fearT = 2;
    out.fear = { r: G.damageEnemy(e, 40, { shooter: p }), hp: e.hp };
    // a hit on the hero lands (the training room that swallowed it is gone: PLAN.md 18, K0d)
    const hp0 = p.hp;
    p.invuln = 0; p.rolling = false; p.rollGrace = 0;
    out.classic = { r: G.hurtPlayer(10, null, {}), lost: hp0 - p.hp };
    return out;
  });
  ok('a shield that swallows a hit: 0 damage, the shield pays, the stats count nothing', r.swallow.r === 0 && r.swallow.hp === 500 && r.swallow.shield === 30 && r.swallow.counted === 0, r.swallow);
  ok('a shield that takes part of a hit: the rest gets through and is counted', r.partial.r === 20 && r.partial.hp === 480 && r.partial.shield === 0 && r.partial.counted === 20, r.partial);
  ok('a frightened monster takes 25% more', r.fear.r === 50 && r.fear.hp === 450, r.fear);
  ok('a hit on the hero lands', r.classic.r > 0 && r.classic.lost > 0, r);

  ok('no console errors', errs.length === 0, errs.slice(0, 5));
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
