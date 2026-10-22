const { chromium } = require('playwright-core');
const ENV = require('./env');
const URL = ENV.URL;
const results = [];
const ok = (name, cond, extra) => { results.push([cond ? 'PASS' : 'FAIL', name, extra === undefined ? '' : JSON.stringify(extra)]); };

(async () => {
  const browser = await chromium.launch({ executablePath: ENV.CHROME, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
  const state = () => page.evaluate(() => ({ s: CH.G.state, ui: CH.UI.active, wave: CH.G.wave, hp: CH.G.player && CH.G.player.hp, kills: CH.G.kills, ents: CH.G.enemies.length, proj: CH.G.projectiles.length, pk: CH.G.pickups.length, zones: CH.G.zones.length }));

  await page.goto(URL);
  await page.waitForFunction(() => window.CH && CH.G && CH.G.ui && document.getElementById('loading').classList.contains('done'), null, { timeout: 60000 });
  ok('loading screen finishes, assets on', await page.evaluate(() => CH.Art.on && CH.Assets.ready));
  ok('menu shown', (await state()).ui === 'main');
  await page.screenshot({ path: 'u_menu.png' });

  // keyboard navigation in menu: ArrowDown moves focus, Enter activates
  await page.keyboard.press('ArrowDown');
  const focused = await page.evaluate(() => document.activeElement && document.activeElement.id);
  ok('arrow-key focus moves in menu', focused === 'btn-heroes' || focused === 'btn-coop' || focused === 'btn-settings', focused);
  await page.click('#btn-howto');
  ok('how to play opens', (await state()).ui === 'howto');
  await page.screenshot({ path: 'u_howto.png' });
  await page.keyboard.press('Escape');
  ok('Escape goes back to main menu', (await state()).ui === 'main');

  await page.click('#btn-stats');
  await page.screenshot({ path: 'u_stats.png' });
  await page.evaluate(() => CH.Journal.close());
  await page.click('#btn-credits');
  await page.screenshot({ path: 'u_credits.png' });
  await page.click('#screen-credits [data-back]');

  // settings: difficulty + hero + toggles persist across reload
  await page.click('#btn-settings');
  await page.screenshot({ path: 'u_settings.png' });
  await page.click('#diff-buttons [data-diff="chaotic"]');
  await page.click('#swatches [data-pal="Mercenary"]');
  await page.click('#set-shake');
  await page.click('#set-reduced');
  await page.click('#set-flashing');
  await page.evaluate(() => { const el = document.getElementById('set-master'); el.value = 35; el.dispatchEvent(new Event('input')); el.dispatchEvent(new Event('change')); });
  // locked hero must not be selectable
  await page.click('#swatches [data-pal="Vexaria"]');
  ok('locked hero stays locked', (await page.evaluate(() => CH.Storage.settings.hero)) === 'Mercenary');
  // rebinding: dodge -> KeyX
  await page.evaluate(() => { const btns = [...document.querySelectorAll('#rebind .btn')]; btns.find((b) => b.textContent.includes('Dodge')).click(); });
  await page.keyboard.press('KeyX');
  ok('rebind works', (await page.evaluate(() => CH.Storage.settings.keys.dodge)) === 'KeyX');
  await page.evaluate(() => CH.Journal.close());
  await page.reload();
  await page.waitForFunction(() => document.getElementById('loading').classList.contains('done'), null, { timeout: 60000 });
  const saved = await page.evaluate(() => { const s = CH.Storage.settings; return { d: s.difficulty, shake: s.shake, reduced: s.reduced, flashing: s.flashing, master: s.master, dodge: s.keys.dodge }; });
  ok('settings persist after reload', saved.d === 'chaotic' && saved.shake === false && saved.reduced === true && saved.flashing === false && Math.abs(saved.master - 0.35) < 0.01 && saved.dodge === 'KeyX', saved);
  // restore defaults for the rest of the run
  await page.evaluate(() => { const s = CH.Storage.settings; s.difficulty = 'normal'; s.shake = true; s.reduced = false; s.flashing = true; s.keys.dodge = 'Space'; CH.Input.rebuild(); CH.Storage.save(); CH.UI.applyAccessibility(); });

  // play with real input
  await page.click('#btn-play');
  ok('run started', (await state()).s === 'playing');
  await page.waitForTimeout(3600);
  await page.mouse.move(900, 300);
  await page.mouse.down();
  await page.keyboard.down('KeyD');
  await page.keyboard.down('ShiftLeft');
  await page.waitForTimeout(1500);
  const px1 = await page.evaluate(() => CH.G.player.x);
  await page.keyboard.up('ShiftLeft');
  await page.keyboard.press('Space');
  await page.waitForTimeout(120);
  ok('dodge roll starts on Space', await page.evaluate(() => CH.G.player.rolling || CH.G.player.rollCd > 0.5));
  await page.waitForTimeout(1400);
  await page.keyboard.up('KeyD');
  await page.mouse.up();
  const px2 = await page.evaluate(() => CH.G.player.x);
  ok('player moved with D', px2 > 480 || px1 > 480, { px1, px2 });
  await page.screenshot({ path: 'u_play.png' });

  // pause / resume
  await page.keyboard.press('Escape');
  ok('Escape pauses', (await state()).s === 'paused');
  await page.screenshot({ path: 'u_pause.png' });
  const t1 = await page.evaluate(() => CH.G.time);
  await page.waitForTimeout(600);
  const t2 = await page.evaluate(() => CH.G.time);
  ok('time frozen while paused', t2 === t1, { t1, t2 });
  await page.keyboard.press('Escape');
  ok('Escape resumes', (await state()).s === 'playing');
  // keys must not be stuck after pause/resume
  await page.waitForTimeout(300);
  const held = await page.evaluate(() => JSON.stringify(CH.Input.held));
  ok('no stuck keys after resume', held === '{}' || !/true/.test(held), held);

  // restart with confirmation
  await page.keyboard.press('Escape');
  await page.click('#btn-restart');
  ok('restart asks for confirmation', (await state()).ui === 'confirm');
  await page.screenshot({ path: 'u_confirm.png' });
  await page.click('#confirm-no');
  ok('confirm No returns to pause', (await state()).ui === 'pause');
  await page.click('#btn-restart');
  await page.click('#confirm-yes');
  await page.waitForTimeout(300);
  const afterRestart = await state();
  ok('restart gives a fresh run (wave 1, no leftovers)', afterRestart.s === 'playing' && afterRestart.wave === 1 && afterRestart.proj === 0 && afterRestart.pk === 0 && afterRestart.kills === 0, afterRestart);

  // level-up flow with real keyboard
  await page.evaluate(() => { CH.Upgrades.addXp(CH.G, 500); });
  await page.waitForTimeout(400);
  ok('level-up screen opens', (await state()).s === 'levelup');
  ok('three cards shown', (await page.evaluate(() => document.querySelectorAll('#cards .card').length)) === 3);
  await page.screenshot({ path: 'u_levelup.png' });
  const lvBefore = await page.evaluate(() => CH.G.player.level);
  await page.keyboard.press('Digit2');
  await page.waitForTimeout(200);
  // several levels were queued: keep picking until playing again
  let guard = 0;
  while ((await state()).s === 'levelup' && guard++ < 30) { await page.keyboard.press('Digit1'); await page.waitForTimeout(80); }
  ok('level-ups all resolve, game resumes', (await state()).s === 'playing', { lvBefore, now: await page.evaluate(() => CH.G.player.level) });
  const lastStats = await page.evaluate(() => CH.G.player.upgrades);
  ok('upgrades applied exactly once per pick', Object.values(lastStats).reduce((a, b) => a + b, 0) + (await page.evaluate(() => CH.G.player.weapons.length - 1)) <= (await page.evaluate(() => CH.G.player.level - 1)) + 2, lastStats);

  // mute toggle
  await page.keyboard.press('KeyM');
  ok('M toggles mute', await page.evaluate(() => CH.Storage.settings.muted));
  await page.keyboard.press('KeyM');
  ok('M toggles back', !(await page.evaluate(() => CH.Storage.settings.muted)));

  // game over via real death
  await page.evaluate(() => { const p = CH.G.player; p.invuln = 0; p.rolling = false; p.rollGrace = 0; p.hp = 1; CH.G.hurtPlayer(50, null, {}); CH.G.hurtPlayer(50, null, {}); });
  const deaths = await page.evaluate(() => CH.G.player.dead);
  ok('player dies when hp hits 0', deaths);
  await page.waitForTimeout(2600);
  ok('game over screen shown', (await state()).s === 'gameover' && (await state()).ui === 'gameover');
  await page.screenshot({ path: 'u_gameover.png' });
  const st = await page.evaluate(() => CH.Storage.stats);
  ok('stats recorded exactly once for the run', st.totalRuns === 2 && st.deaths === 2, st); // first run abandoned by restart + this death
  await page.click('#btn-retry');
  await page.waitForTimeout(300);
  const afterRetry = await state();
  ok('retry starts clean', afterRetry.s === 'playing' && afterRetry.proj === 0 && afterRetry.kills === 0 && afterRetry.wave === 1, afterRetry);

  // abandon to menu with confirmation
  await page.keyboard.press('Escape');
  await page.click('#btn-pause-menu');
  await page.click('#confirm-yes');
  ok('abandon returns to menu', (await state()).s === 'menu' && (await state()).ui === 'main');

  // multiple consecutive runs: entity counts never leak
  for (let i = 0; i < 3; i++) {
    await page.click('#btn-play');
    await page.waitForTimeout(500);
    await page.evaluate(() => { for (let k = 0; k < 6; k++) CH.G.spawnEnemy('chicken', CH.G.player.x + 120, CH.G.player.y, {}); });
    await page.keyboard.press('Escape');
    await page.click('#btn-pause-menu');
    await page.click('#confirm-yes');
  }
  const leak = await state();
  ok('no entities left after repeated runs', leak.ents === 0 && leak.proj === 0 && leak.pk === 0 && leak.zones === 0, leak);

  // corrupted storage must not crash
  await page.evaluate(() => { localStorage.setItem('chaosexe.save.v1', '{not json!!'); });
  await page.reload();
  await page.waitForFunction(() => document.getElementById('loading').classList.contains('done'), null, { timeout: 60000 });
  ok('corrupted save falls back to defaults', await page.evaluate(() => CH.Storage.settings.difficulty === 'normal' && CH.G.state === 'menu'));
  await page.evaluate(() => { localStorage.setItem('chaosexe.save.v1', JSON.stringify({ settings: { master: 'loud', hero: 7, keys: { dodge: 5 }, difficulty: 'nightmare' }, stats: { highScore: -5, totalRuns: 'x' }, unlocked: 'all' })); });
  await page.reload();
  await page.waitForFunction(() => document.getElementById('loading').classList.contains('done'), null, { timeout: 60000 });
  ok('invalid values are sanitised', await page.evaluate(() => { const s = CH.Storage; return s.settings.master === 0.8 && s.settings.hero === 'Mercenary' && s.settings.keys.dodge === 'Space' && s.settings.difficulty === 'normal' && s.stats.highScore === 0 && s.stats.totalRuns === 0; }));

  // window resizing
  for (const [w, h] of [[800, 450], [1920, 1080], [700, 900], [1100, 500]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(150);
    const dim = await page.evaluate(() => { const r = document.getElementById('stage').getBoundingClientRect(); return { w: r.width, h: r.height, fits: r.width <= innerWidth + 1 && r.height <= innerHeight + 1, ar: +(r.width / r.height).toFixed(3) }; });
    ok(`stage fits ${w}x${h}, 16:9`, dim.fits && Math.abs(dim.ar - 16 / 9) < 0.02, dim);
  }
  await page.setViewportSize({ width: 800, height: 450 });
  await page.click('#btn-play');
  await page.waitForTimeout(3600);
  await page.screenshot({ path: 'u_small.png' });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'u_big.png' });

  // window blur auto-pauses and clears input
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  ok('blur pauses the game', (await state()).s === 'paused');

  console.log(results.map((r) => r.join('  ')).join('\n'));
  console.log('\nFAILED:', results.filter((r) => r[0] === 'FAIL').length, 'of', results.length);
  console.log('console errors:', errs.length ? errs.join('\n') : 'none');
  console.log('game errors:', JSON.stringify(await page.evaluate(() => CH.errors)));
  await browser.close();
})();
