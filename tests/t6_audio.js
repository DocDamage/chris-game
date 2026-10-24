/* Audio: sample bank, ambience, music selection per situation, mute, fades. */
const { chromium } = require('playwright-core');
const ENV = require('./env');
const { play } = require('./lib');
(async () => {
  const browser = await chromium.launch({ executablePath: ENV.CHROME, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  await page.addInitScript(() => { window.__uikInstant = true; });
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
  const results = [];
  const ok = (n, c, x) => results.push([c ? 'PASS' : 'FAIL', n, x === undefined ? '' : JSON.stringify(x)]);
  const track = () => page.evaluate(() => CH.Audio.musicInfo().filter((t) => t.target === 1).map((t) => t.name).join(','));
  await page.goto(ENV.URL);
  await page.waitForFunction(() => document.getElementById('loading').classList.contains('done'), null, { timeout: 120000 });
  ok('nothing plays before the first gesture', await page.evaluate(() => !CH.Audio.unlocked && !CH.Audio.ctx));
  await page.mouse.click(5, 5);
  await page.waitForTimeout(3500);
  const bank = await page.evaluate(() => ({ names: Object.keys(CH.Audio.bank).length, decoded: Object.values(CH.Audio.bank).reduce((n, l) => n + l.length, 0), expected: Object.values(CH.Assets.sfx).reduce((n, l) => n + l.length, 0), loops: Object.keys(CH.Audio.loopBank).length, expectedLoops: Object.keys(CH.Assets.loops).length, tracks: Object.keys(CH.Assets.music).length }));
  ok('all sound clips decode', bank.decoded === bank.expected && bank.names > 90, bank);
  ok('all ambience loops decode', bank.loops === bank.expectedLoops && bank.loops >= 6, bank);
  ok('all 20 music tracks present', bank.tracks === 20, bank.tracks);
  ok('menu music', (await track()) === 'menu', await track());

  // every sound name plays without throwing
  const names = await page.evaluate(() => { const bad = []; const all = Object.keys(CH.Assets.sfx); for (const n of all) { try { CH.Audio.last = {}; CH.Audio.sfx(n); } catch (e) { bad.push(n); } } return { n: all.length, bad }; });
  ok('every sound name plays', names.bad.length === 0, names);

  // screens switch the menu track
  await page.click('#btn-howto'); await page.waitForTimeout(300); ok('how-to track', (await track()) === 'theme', await track());
  await page.keyboard.press('Escape');
  await page.click('#btn-settings'); await page.waitForTimeout(300); ok('settings track', (await track()) === 'shop', await track());
  await page.keyboard.press('Escape');
  await page.click('#btn-stats'); await page.waitForTimeout(300); ok('stats track', (await track()) === 'garden', await track());
  await page.keyboard.press('Escape');
  await page.click('#btn-credits'); await page.waitForTimeout(300); ok('credits track', (await track()) === 'credits', await track());
  await page.keyboard.press('Escape');

  // in game: arena music + ambience
  await play(page); await page.waitForTimeout(1500);
  ok('Dead Wood music + ambience (stage 1: PLAN.md 18, K2)', (await track()) === 'library' && (await page.evaluate(() => CH.Audio.ambName)) === 'amb_wind', { t: await track(), a: await page.evaluate(() => CH.Audio.ambName) });
  // levelling up is a skill point now: no card screen, the arena music keeps playing
  await page.evaluate(() => CH.Upgrades.addXp(CH.G, 30)); await page.waitForTimeout(600);
  ok('level-up keeps the arena music (skill point, no card screen)', (await track()) === 'library' && (await page.evaluate(() => CH.G.state)) === 'playing', await track());
  // chaos event music + ambience
  await page.evaluate(() => CH.Events.start(CH.G, CH.Events.byId.chickenrain)); await page.waitForTimeout(800);
  ok('chicken rain theme + rain ambience', (await track()) === 'rain' && (await page.evaluate(() => CH.Audio.ambName)) === 'amb_rain', { t: await track(), a: await page.evaluate(() => CH.Audio.ambName) });
  await page.evaluate(() => CH.Events.end(CH.G, true)); await page.waitForTimeout(800);
  ok('event ends -> arena music', (await track()) === 'library', await track());
  // boss music per boss
  for (const [kind, want] of [['frog', 'miniboss'], ['gol', 'dungeon'], ['maw', 'superboss'], ['bug', 'finalboss']]) {
    await page.evaluate((kind) => { const G = CH.G; G.enemies.length = 0; G.queue.length = 0; G.spawnBoss(kind, 0); }, kind);
    await page.waitForTimeout(700);
    ok('boss music: ' + kind, (await track()) === want, await track());
    await page.evaluate(() => { CH.G.enemies.length = 0; });
  }
  // mute silences and restores music
  await page.evaluate(() => CH.G.enemies.length = 0);
  await page.keyboard.press('KeyM'); await page.waitForTimeout(500);
  const mv = await page.evaluate(() => CH.Audio.musicInfo().filter((t) => t.target === 1)[0].volume);
  await page.keyboard.press('KeyM'); await page.waitForTimeout(600);
  const uv = await page.evaluate(() => CH.Audio.musicInfo().filter((t) => t.target === 1)[0].volume);
  ok('mute zeroes music, unmute restores', mv === 0 && uv > 0.1, { mv, uv });
  // game over
  // a hardcore character's death ends in the game over screen (a normal one wakes in the hideout)
  await page.evaluate(() => { if (CH.Storage.slot()) CH.Storage.slot().hardcore = true; const p = CH.G.player; p.invuln = 0; p.hp = 1; CH.G.hurtPlayer(30, null, {}); }); await page.waitForTimeout(3200);
  ok('game over track (early death = sad)', ['sad', 'gameover'].includes(await track()) && (await page.evaluate(() => CH.Audio.ambName)) === null, await track());
  await page.click('#btn-go-menu'); await page.waitForTimeout(800);
  ok('back to menu music, ambience off', (await track()) === 'menu' && (await page.evaluate(() => CH.Audio.ambName)) === null);
  ok('only one music track audible at a time', (await page.evaluate(() => CH.Audio.musicInfo().filter((t) => t.target === 1).length)) === 1);

  console.log(results.map((r) => r.join('  ')).join('\n'));
  console.log('FAILED:', results.filter((r) => r[0] === 'FAIL').length, 'of', results.length);
  console.log('console errors:', errs.length ? errs.join('\n') : 'none', JSON.stringify(await page.evaluate(() => CH.errors)));
  await browser.close();
})();
