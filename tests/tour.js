/* A look round the world for a human: screenshots of the menus and of a few areas of every biome (the start, enemy
   camps, a dressed room), plus an audit of standing props nothing collides with. Not a test: it never fails.
     node tests/tour.js [outDir] [areas, comma separated]   (default out: tests/tour/) */
const path = require('path');
const fs = require('fs');
const { open } = require('./lib');
(async () => {
  const out = path.resolve(process.argv[2] || path.join(__dirname, 'tour'));
  fs.mkdirSync(out, { recursive: true });
  const areas = (process.argv[3] || '1,4,7,9,11,13,18,23,27,29,34,40,45,49').split(',').map(Number);
  const { browser, page, errs } = await open({ levels: true, fx: 'high' });
  const shot = (name) => page.screenshot({ path: path.join(out, name + '.png') });

  // menus
  await page.evaluate(() => { CH.G.render && CH.G.render(); });
  await shot('menu_main');
  await page.evaluate(() => {
    const St = CH.Storage;
    localStorage.removeItem(St.KEY3);
    St.load();
    St.createSlot({ hero: 'Mercenary', name: 'Tourist' });
    CH.G._scriptTesting = true;
    CH.G.newRun(null);
  });

  for (const n of areas) {
    const info = await page.evaluate((n) => {
      const G = CH.G;
      if (CH.Town && CH.Town.inTown) CH.Town.leave();
      G.startWave(n);
      if (CH.Town && CH.Town.inTown) CH.Town.leave();
      const L = G.level;
      if (!L) return null;
      L.explored.fill(1); L.fogDirty = true;
      const spots = [{ tag: 'start', x: L.entrance.x, y: L.entrance.y }];
      for (const c of (L.camps || []).slice(0, 2)) spots.push({ tag: 'camp', x: c.x, y: c.y + 20 });
      const rooms = L.rooms.filter((r) => r.tag !== 'start' && r.tag !== 'exit' && !(L.camps || []).some((c) => Math.hypot(c.x - r.cx, c.y - r.cy) < 140));
      for (const r of rooms.slice(1, 3)) spots.push({ tag: 'room', x: r.cx, y: r.cy });
      if (L.lore && L.lore[0]) spots.push({ tag: 'landmark', x: L.lore[0].x, y: L.lore[0].y - 30 });
      spots.push({ tag: 'exit', x: L.exit.x, y: L.exit.y + 60 });
      // standing props that block nothing
      const loose = {};
      for (const p of L.props) {
        if (p.solid || p.dead) continue;
        const sp = CH.Sprites.has(p.sprite) ? CH.Sprites.get(p.sprite) : null;
        if (!sp || sp.h < 18) continue;
        const k = (p.cat || p.kind || '?') + ' ' + (p.sheet || p.sprite).split('.').slice(0, 2).join('.');
        loose[k] = (loose[k] || 0) + 1;
      }
      return { biome: L.biome, spots, loose, puddles: L.puddles.length, props: L.props.length };
    }, n);
    if (!info) continue;
    console.log('area ' + n + ' ' + info.biome + ': ' + info.props + ' props, ' + info.puddles + ' puddles; walk-through standing: ' + JSON.stringify(info.loose));
    let i = 0;
    for (const s of info.spots) {
      await page.evaluate((s) => {
        const G = CH.G;
        G.player.x = s.x; G.player.y = s.y; G.player.invuln = 99;
        G.snapCamera();
        for (let k = 0; k < 4; k++) CH.stepFrame(1 / 30);
        for (const e of G.enemies) if (!e.isSpawner && !e.isBoss) e.dead = true;
        G.enemies = G.enemies.filter((e) => !e.dead);
        G.flashT = 0;
        if (G.ui && G.ui.clearBanner) G.ui.clearBanner();
        CH.stepFrame(1 / 30);
        G.render();
      }, s);
      await shot('a' + String(n).padStart(2, '0') + '_' + info.biome + '_' + (i++) + '_' + s.tag);
    }
  }
  if (errs.length) console.log('console errors:', errs.slice(0, 8));
  await browser.close();
})();
