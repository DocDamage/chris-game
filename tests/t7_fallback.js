const { chromium } = require('playwright-core');
const ENV = require('./env');
(async () => {
  const browser = await chromium.launch({ executablePath: ENV.CHROME, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  for (const mode of ['no-bundle', 'no-music-files']) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    await ctx.addInitScript(() => { window.requestAnimationFrame = (cb) => { (window.__raf = window.__raf || []).push(cb); return 1; }; });
    if (mode === 'no-bundle') await ctx.route('**/data/assets.js', (r) => r.abort());
    else await ctx.route('**/data/music/*.mp3', (r) => r.abort());
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED|net::/.test(m.text())) errs.push(m.text()); });
    await page.goto(ENV.URL);
    await page.waitForFunction(() => document.getElementById('loading').classList.contains('done'), null, { timeout: 60000 });
    await page.mouse.click(5, 5);
    await page.waitForTimeout(600);
    const info = await page.evaluate(() => ({ art: CH.Art.on, assets: CH.Assets.ready, procTrack: !!CH.Audio.track, files: CH.Audio.musicInfo().length }));
    // short bot run incl. a boss
    const res = await page.evaluate(() => {
      const G = CH.G; G.newRun();
      const I = CH.Input;
      for (let i = 0; i < 60 * 40; i++) {
        const p = G.player;
        // simple auto-aim/fire/level-up loop
        if (G.state === 'levelup') G.pickUpgrade(0);
        let near = null, nd = 1e9; for (const e of G.enemies) { const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < nd) { nd = d; near = e; } }
        if (near) { I.mouse.x = near.x - G.cam.x; I.mouse.y = near.y - G.cam.y; I.mouse.down = true; I.mouse.inside = true; }
        p.hp = p.maxHp; G.update(1 / 60); if (i % 4 === 0) { G.render(); CH.UI.updateHUD(); } I.endFrame();
      }
      const seen = [];
      for (const kind of ['frog', 'bd', 'gol', 'maw', 'ceo', 'chicken', 'bug', 'dragon', 'beholder', 'mage', 'demon', 'ooze', 'treant', 'knight', 'moss', 'sporeeye', 'yeti', 'dunewyrm', 'bloodwyrm', 'voideye', 'daddy', 'skull']) {
        G.enemies.length = 0; G.queue.length = 0; G.projectiles.length = 0; G.wave = 9; G.spawnBoss(kind, 0);
        for (let i = 0; i < 60 * 12; i++) { if (G.state === 'levelup') G.pickUpgrade(0); G.player.hp = G.player.maxHp; G.update(1 / 60); if (i % 4 === 0) G.render(); I.endFrame(); }
        const b = G.enemies.find((e) => e.isBoss);
        seen.push(kind + ':' + (b ? b.last || 'idle' : 'dead'));
      }
      // enemy variants, golems and every pickup type, drawn with whatever art there is
      G.enemies.length = 0; G.queue.length = 0; G.pickups.length = 0;
      for (const t of CH.Enemies.ids) { G.spawnEnemy(t, G.player.x + 60, G.player.y + 30, { variant: CH.Enemies.VARIANTS[t] ? 1 : 0, spawnTime: 0 }); }
      for (const t of ['coin', 'xp', 'hp', 'power', 'wood', 'scrap', 'stone']) G.dropPickup(t, G.player.x + 12, G.player.y + 12, 1);
      G.dropPickup('loot', G.player.x, G.player.y + 20, 1, { item: 7 }); CH.PowerUps.dropCurio(G, G.player.x + 10, G.player.y + 20);
      for (let i = 0; i < 120; i++) { G.player.hp = G.player.maxHp; G.update(1 / 60); if (i % 4 === 0) { G.render(); CH.UI.updateHUD(); } I.endFrame(); }
      // two heroes: split / merged screens, downed + revive, HUD, with whatever art is available
      G.newRun({ players: [{ hero: 'Mercenary', src: { kind: 'script' } }, { hero: 'Vexaria', src: { kind: 'script' } }] });
      const modes = new Set();
      for (let i = 0; i < 60 * 30; i++) {
        if (G.state === 'levelup') G.pickUpgrade(0);
        const [a, b] = G.players;
        for (const p of G.players) {
          p.hp = Math.max(p.hp, 1);
          let near = null, nd = 1e9; for (const e of G.enemies) { const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < nd) { nd = d; near = e; } }
          p.inp.aimAngle = near ? Math.atan2(near.y - p.y, near.x - p.x) : 0; p.inp.fire1 = !!near; p.inp.aimDist = nd;
          // march apart for a while, then together again, to exercise both camera modes
          const ph = Math.floor(i / 420) % 2; p.inp.mx = ph === 0 ? (p.idx ? 1 : -1) : (p.idx ? -1 : 1); p.inp.my = 0;
        }
        if (i === 800) G.hurtPlayer(9999, { x: a.x, y: a.y }, { p: a });
        G.update(1 / 60); modes.add(G.viewMode); if (i % 4 === 0) { G.render(); CH.UI.updateHUD(); } I.endFrame();
      }
      return { wave: G.wave, kills: G.kills, bosses: seen.join(' '), coop: [...modes].join('/'), revived: !G.players[0].dead };
    });
    console.log(mode.padEnd(15), JSON.stringify(info), JSON.stringify(res), 'errors:', errs.length ? errs.join(' | ') : 'none', JSON.stringify(await page.evaluate(() => CH.errors)));
    await page.screenshot({ path: 'fb_' + mode + '.png' });
    await ctx.close();
  }
  await browser.close();
})();
