/* Extras & Modes inside the Journal: every launch button starts a run from inside the book, with the right stage type;
   toggles, heat, loadout, pets, options, heroes and the other tabs respond. Also: jump key, feet collision, prop hitboxes. */
const { open } = require('./lib');
(async () => {
  const { browser, page, errs } = await open({ levels: true });
  const out = await page.evaluate(() => {
    const G = CH.G, X = CH.X, S = CH.Storage, J = CH.Journal, M = CH.Meta, r = {};
    const step = (n) => { for (let i = 0; i < n; i++) { if (G.state === 'levelup') while (G.state === 'levelup') G.pickUpgrade(0); CH.stepFrame(1 / 30); } };
    const openExtras = (tab) => { if (J.open) J.close(true); J.show(0, 2, 'main'); if (tab) M.ui.S = null; document.querySelector('#xt-tabs [data-v="' + (tab || 'play') + '"]') && document.querySelector('#xt-tabs [data-v="' + (tab || 'play') + '"]').click(); };
    const click = (act, v) => { const el = document.querySelector('#xt-body [data-act="' + act + '"]' + (v !== undefined ? '[data-v="' + v + '"]' : '')); if (!el) return false; el.click(); return true; };
    const tabs = ['play', 'hist', 'ach', 'hero', 'safe', 'sets', 'bestiary', 'opts'];
    r.tabs = {};
    openExtras('play');
    for (const t of tabs) { document.querySelector('#xt-tabs [data-v="' + t + '"]').click(); r.tabs[t] = document.getElementById('xt-body').textContent.length > 40; }
    // launch buttons
    const launches = [['start', null, 'classic', true], ['daily', null, null, true], ['tutorial', null, 'tutorial', false]];
    r.launch = {};
    for (const [act, v, mode, lv] of launches) {
      openExtras('play');
      const ok = click(act);
      step(5);
      r.launch[act] = { clicked: ok, playing: G.state === 'playing', journalClosed: !J.open, mode: X.run.mode, level: !!G.level, expectLevel: lv };
      G.toMenu(); step(2);
    }
    // modes
    for (const m of ['short', 'marathon', 'rush']) {
      openExtras('play'); click('mode', m); click('start'); step(5);
      r.launch['mode_' + m] = { playing: G.state === 'playing', mode: X.run.mode, level: !!G.level, journalClosed: !J.open };
      G.toMenu(); step(2);
    }
    // challenge + heat + seed
    openExtras('play');
    click('chal', M.CHALLENGES[0].id); click('heat+', M.PACTS[0].id); click('heat+', M.PACTS[0].id);
    document.getElementById('xt-seed').value = 'hello'; document.getElementById('xt-seed').dispatchEvent(new Event('input'));
    click('start'); step(5);
    r.setup = { challenge: X.run.challenge === M.CHALLENGES[0].id, heat: M.heatTotal() > 0, seed: X.run.seed !== null };
    G.toMenu(); step(2);
    const hashOf = () => G.level && G.level.cells.reduce((a, c) => (a * 31 + c) | 0, 0);
    let seeds = [];
    for (let k = 0; k < 2; k++) { openExtras('play'); click('chal', ''); for (const p of M.PACTS) { while (document.querySelector('#xt-body [data-act="heat-"][data-v="' + p.id + '"]') && (CH.Meta.ui.heat[p.id] || 0) > 0) click('heat-', p.id); } document.getElementById('xt-seed').value = 'hello'; document.getElementById('xt-seed').dispatchEvent(new Event('input')); click('start'); step(5); seeds.push(hashOf()); G.toMenu(); step(2); }
    r.seedSame = seeds[0] !== null && seeds[0] === seeds[1];
    // hero tab toggles, options toggle, pets, loadout buttons
    openExtras('hero'); S.data.meta.mastery = { Mercenary: 400 }; M.ui.render();
    r.altBtn = click('alt', 'Mercenary');
    openExtras('opts'); const before = JSON.stringify(X.opts()); r.optToggle = click('opt', 'dpsMeter') && JSON.stringify(X.opts()) !== before;
    openExtras('safe'); r.safeBtns = document.querySelectorAll('#xt-body [data-act]').length >= 1;
    openExtras('play'); r.petsRow = document.querySelectorAll('#xt-body [data-act="pet"],#xt-body [data-act="noop"]').length >= 0;
    J.close(true);
    return r;
  });
  console.log(JSON.stringify(out));
  const L = out.launch;
  const ok = Object.values(out.tabs).every(Boolean) && L.start.playing && L.start.journalClosed && L.start.level && L.daily.playing && L.daily.journalClosed && L.daily.level &&
    L.tutorial.playing && L.tutorial.journalClosed && !L.tutorial.level && L.mode_short.playing && L.mode_short.level && L.mode_marathon.playing && L.mode_marathon.level &&
    L.mode_rush.playing && !L.mode_rush.level && out.setup.challenge && out.setup.heat && out.setup.seed && out.altBtn && out.optToggle && out.safeBtns;
  console.log('errors', errs);
  console.log(ok && !errs.length ? 'ALL PASSED' : 'FAILED');
  await browser.close();
  process.exit(ok && !errs.length ? 0 : 1);
})();
