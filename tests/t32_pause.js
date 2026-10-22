/* The pause menu with REAL input (real-time page, real mouse and keyboard, shader on): every button and icon, the
   confirm dialogs, Esc out of the Journal even with a slider focused, and the way back to the game. */
const { chromium } = require('playwright-core');
const ENV = require('./env');
(async () => {
  const browser = await chromium.launch({ executablePath: ENV.CHROME, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  await page.goto(ENV.URL);
  await page.waitForFunction(() => document.getElementById('loading').classList.contains('done'), null, { timeout: 60000 });
  await page.waitForTimeout(400);
  let fails = 0;
  const ok = (name, c, extra) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + name + (c ? '' : ' ' + JSON.stringify(extra))); };
  const st = () => page.evaluate(() => ({ state: CH.G.state, ui: CH.UI.active, j: CH.Journal.open, map: CH.MapScroll.open, time: CH.G.time, tab: CH.Journal.tab }));
  const click = async (sel, n) => {
    const box = await page.evaluate(([sel, n]) => { const el = document.querySelectorAll(sel)[n || 0]; if (!el) return null; const r = el.getBoundingClientRect(); const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { x: r.x + r.width / 2, y: r.y + r.height / 2, hit: e === el || el.contains(e) }; }, [sel, n]);
    if (!box) return { missing: true };
    await page.mouse.click(box.x, box.y);
    return box;
  };
  const pause = async () => { await page.keyboard.press('Escape'); await page.waitForTimeout(350); };
  await click('#btn-play'); await page.waitForTimeout(1500);
  ok('the run started with a click', (await st()).state === 'playing', await st());
  // resume by clicking
  await pause(); let s = await st(); ok('Esc pauses', s.state === 'paused' && s.ui === 'pause', s);
  let b = await click('#btn-resume'); await page.waitForTimeout(300); s = await st(); ok('RESUME by mouse', b.hit && s.state === 'playing', [b, s]);
  // Esc twice
  await pause(); await page.keyboard.press('Escape'); await page.waitForTimeout(300); s = await st(); ok('Esc resumes', s.state === 'playing', s);
  // icons open the Journal on the right tab, Esc closes it back to the pause menu, then resume
  const tabs = ['journal', 'inventory', 'equipment', 'codex', 'save', 'settings'];
  for (let i = 0; i < 6; i++) {
    await pause();
    b = await click('.pz-btn', i); await page.waitForTimeout(2400);
    s = await st(); ok('pause icon ' + tabs[i] + ' opens the Journal tab ' + i, b.hit && s.j && s.tab === i, [b, s]);
    await page.keyboard.press('Escape'); await page.waitForTimeout(2200);
    s = await st(); ok('Esc closes the Journal back to the pause menu (' + tabs[i] + ')', !s.j && s.ui === 'pause' && s.state === 'paused', s);
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    s = await st(); if (s.state !== 'playing') { await click('#btn-resume'); await page.waitForTimeout(300); }
  }
  // map icon
  await pause(); b = await click('.pz-btn', 6); await page.waitForTimeout(1800); s = await st(); ok('map icon opens the map', b.hit && s.map, [b, s]);
  await page.keyboard.press('Escape'); await page.waitForTimeout(1500); s = await st(); ok('Esc closes the map to the pause menu', !s.map && s.ui === 'pause', s);
  // SETTINGS button -> journal settings, slider focused is not a trap
  b = await click('#btn-pause-settings'); await page.waitForTimeout(2400); s = await st(); ok('SETTINGS opens the Journal settings tab', s.j && s.tab === 5, s);
  await page.evaluate(() => document.querySelector('#screen-journal input[type=range]').focus());
  await page.keyboard.press('Escape'); await page.waitForTimeout(2200); s = await st(); ok('Esc leaves the Journal even with a slider focused', !s.j && s.ui === 'pause', s);
  // keyboard navigation in the pause menu: down, Enter on RESTART RUN -> confirm -> Esc cancels
  await page.keyboard.press('ArrowDown'); await page.waitForTimeout(100);
  await page.keyboard.press('Enter'); await page.waitForTimeout(400); s = await st(); ok('keyboard: Enter on RESTART RUN opens the confirm', s.ui === 'confirm', s);
  await page.keyboard.press('Escape'); await page.waitForTimeout(300); s = await st(); ok('Esc cancels the confirm', s.ui === 'pause', s);
  // restart for real
  const t0 = (await st()).time;
  await click('#btn-restart'); await page.waitForTimeout(400); await click('#confirm-yes'); await page.waitForTimeout(600); s = await st(); ok('RESTART RUN restarts the stage', s.state === 'playing' && s.time < t0 + 1, [t0, s]);
  // return to main menu
  await pause(); await click('#btn-pause-menu'); await page.waitForTimeout(400); s = await st(); ok('RETURN opens the confirm', s.ui === 'confirm', s);
  await click('#confirm-yes'); await page.waitForTimeout(600); s = await st(); ok('the confirm returns to the main menu', s.state === 'menu' && s.ui === 'main', s);
  console.log('errors', errs);
  console.log(fails || errs.length ? 'FAILED' : 'ALL PASSED');
  await browser.close();
  process.exit(fails || errs.length ? 1 : 0);
})();
