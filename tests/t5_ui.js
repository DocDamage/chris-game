const { chromium } = require('playwright-core');
const ENV = require('./env');
const { play } = require('./lib');
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
  const state = () => page.evaluate(() => ({ s: CH.G.state, ui: CH.UI.active, wave: CH.G.wave, hp: CH.G.player && CH.G.player.hp, kills: CH.G.kills, ents: CH.G.enemies.length, proj: CH.G.projectiles.length, pk: CH.G.pickups.length, zones: CH.G.zones.length, town: !!(CH.G.level && CH.G.level.isTown) }));
  // a character who has been out starts again in the hideout (PLAN.md 18, K0b), a fresh one in stage 1
  const start = (st) => st.wave === 1 || (st.wave === 0 && st.town);

  await page.goto(URL);
  await page.waitForFunction(() => window.CH && CH.G && CH.G.ui && document.getElementById('loading').classList.contains('done'), null, { timeout: 60000 });
  ok('loading screen finishes, assets on', await page.evaluate(() => CH.Art.on && CH.Assets.ready));
  ok('menu shown', (await state()).ui === 'main');
  await page.screenshot({ path: __dirname + '/u_menu.png' });

  // keyboard navigation in menu: ArrowDown moves focus, Enter activates
  await page.keyboard.press('ArrowDown');
  const focused = await page.evaluate(() => document.activeElement && document.activeElement.id);
  ok('arrow-key focus moves in menu', focused === 'btn-heroes' || focused === 'btn-coop' || focused === 'btn-settings', focused);
  await page.click('#btn-howto');
  ok('how to play opens', (await state()).ui === 'howto');
  await page.screenshot({ path: __dirname + '/u_howto.png' });
  await page.keyboard.press('Escape');
  ok('Escape goes back to main menu', (await state()).ui === 'main');

  await page.click('#btn-stats');
  await page.screenshot({ path: __dirname + '/u_stats.png' });
  await page.evaluate(() => CH.Journal.close());
  await page.click('#btn-credits');
  await page.screenshot({ path: __dirname + '/u_credits.png' });
  await page.click('#screen-credits [data-back]');

  // settings: difficulty + hero + toggles persist across reload
  await page.click('#btn-settings');
  await page.screenshot({ path: __dirname + '/u_settings.png' });
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
  await play(page);
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
  await page.screenshot({ path: __dirname + '/u_play.png' });

  // pause / resume
  await page.keyboard.press('Escape');
  ok('Escape pauses', (await state()).s === 'paused');
  await page.screenshot({ path: __dirname + '/u_pause.png' });
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

  // SAVE & QUIT asks first; the restart went with the runs (PLAN.md 18, K0d)
  await page.keyboard.press('Escape');
  ok('there is no RESTART button', await page.evaluate(() => !document.getElementById('btn-restart')));
  await page.click('#btn-pause-menu');
  ok('SAVE & QUIT asks for confirmation', (await state()).ui === 'confirm');
  await page.screenshot({ path: __dirname + '/u_confirm.png' });
  await page.click('#confirm-no');
  ok('confirm No returns to pause', (await state()).ui === 'pause');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  ok('Escape resumes after the confirm', (await state()).s === 'playing');

  // levelling: skill points, no card screen; the tree opens with K and pauses the game (PLAN.md 15, request 7)
  await page.evaluate(() => { CH.Upgrades.addXp(CH.G, 500); });
  await page.waitForTimeout(400);
  const lv = await page.evaluate(() => ({ s: CH.G.state, level: CH.G.player.level, sp: CH.G.player.sp, chip: !!document.getElementById('sk-chip') && document.getElementById('sk-chip').style.display !== 'none' }));
  ok('levelling up keeps playing and gives one skill point per level', lv.s === 'playing' && lv.sp === lv.level - 1 && lv.chip, lv);
  await page.keyboard.press('KeyK');
  await page.waitForTimeout(300);
  ok('K opens the skill tree and pauses', (await page.evaluate(() => CH.UI.active === 'skills' && CH.G.state === 'paused')));
  await page.screenshot({ path: __dirname + '/u_levelup.png' });
  const before = await page.evaluate(() => ({ sp: CH.G.player.sp, focus: document.activeElement && document.activeElement.dataset.id }));
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  const after = await page.evaluate((id) => ({ sp: CH.G.player.sp, rank: CH.Skills.rank(CH.G.player, id) }), before.focus);
  ok('Enter learns the focused skill (one point, one rank)', !!before.focus && after.sp === before.sp - 1 && after.rank === 1, { before, after });
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  ok('Escape closes the tree, game resumes', (await state()).s === 'playing');
  const lastStats = await page.evaluate(() => ({ spent: CH.Skills.spent(CH.G.player), sp: CH.G.player.sp, level: CH.G.player.level }));
  ok('every point is spent once: spent + left = levels gained', lastStats.spent + lastStats.sp === lastStats.level - 1, lastStats);

  // mute toggle
  await page.keyboard.press('KeyM');
  ok('M toggles mute', await page.evaluate(() => CH.Storage.settings.muted));
  await page.keyboard.press('KeyM');
  ok('M toggles back', !(await page.evaluate(() => CH.Storage.settings.muted)));

  // game over via real death: a hardcore character's (a normal one wakes in the hideout: t44_death)
  await page.evaluate(() => { CH.Storage.slot().hardcore = true; const p = CH.G.player; p.invuln = 0; p.rolling = false; p.rollGrace = 0; p.hp = 1; CH.G.hurtPlayer(50, null, {}); CH.G.hurtPlayer(50, null, {}); });
  const deaths = await page.evaluate(() => CH.G.player.dead);
  ok('player dies when hp hits 0', deaths);
  await page.waitForTimeout(2600);
  ok('game over screen shown', (await state()).s === 'gameover' && (await state()).ui === 'gameover');
  await page.screenshot({ path: __dirname + '/u_gameover.png' });
  const st = await page.evaluate(() => CH.Storage.stats);
  ok('stats recorded exactly once for the run', st.totalRuns === 1 && st.deaths === 1, st); // this death (the restart is gone)
  ok('a fallen hardcore character gets no RETRY', await page.evaluate(() => getComputedStyle(document.getElementById('btn-retry')).display === 'none' && !CH.Storage.slot()));
  await page.click('#btn-go-menu');
  await play(page);
  await page.waitForTimeout(300);
  const afterRetry = await state();
  ok('a new character starts clean', afterRetry.s === 'playing' && afterRetry.proj === 0 && afterRetry.kills === 0 && start(afterRetry), afterRetry);

  // abandon to menu with confirmation
  await page.keyboard.press('Escape');
  await page.click('#btn-pause-menu');
  await page.click('#confirm-yes');
  ok('abandon returns to menu', (await state()).s === 'menu' && (await state()).ui === 'main');

  // multiple consecutive runs: entity counts never leak
  for (let i = 0; i < 3; i++) {
    await play(page);
    await page.waitForTimeout(500);
    await page.evaluate(() => { for (let k = 0; k < 6; k++) CH.G.spawnEnemy('chicken', CH.G.player.x + 120, CH.G.player.y, {}); });
    await page.keyboard.press('Escape');
    await page.click('#btn-pause-menu');
    await page.click('#confirm-yes');
  }
  const leak = await state();
  ok('no entities left after repeated runs', leak.ents === 0 && leak.proj === 0 && leak.pk === 0 && leak.zones === 0, leak);

  // corrupted storage must not crash
  await page.evaluate(() => { localStorage.setItem('chaosexe.save.v3', '{not json!!'); });
  await page.reload();
  await page.waitForFunction(() => document.getElementById('loading').classList.contains('done'), null, { timeout: 60000 });
  ok('corrupted save falls back to defaults', await page.evaluate(() => CH.Storage.settings.difficulty === 'normal' && CH.G.state === 'menu'));
  await page.evaluate(() => { localStorage.setItem('chaosexe.save.v3', JSON.stringify({ version: 3, account: { settings: { master: 'loud', hero: 7, keys: { dodge: 5 }, difficulty: 'nightmare' }, stats: { highScore: -5, totalRuns: 'x' }, unlocked: 'all' }, slots: [{ hero: 'Nobody' }, 5], active: 9 })); });
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
  await play(page);
  await page.waitForTimeout(3600);
  await page.screenshot({ path: __dirname + '/u_small.png' });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: __dirname + '/u_big.png' });

  // window blur auto-pauses and clears input
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  ok('blur pauses the game', (await state()).s === 'paused');

  console.log(results.map((r) => r.join('  ')).join('\n'));
  console.log('\nFAILED:', results.filter((r) => r[0] === 'FAIL').length, 'of', results.length);
  console.log('console errors:', errs.length ? errs.join('\n') : 'none');
  console.log('game errors:', JSON.stringify(await page.evaluate(() => CH.errors)));
  await browser.close();
})();
