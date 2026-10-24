/* A piece of a stage's map as painted (floor, walls, decals) plus its props, at 1:1 around a room, for checking walls
   and dressing by eye. Not a test.
     node tests/mapshot.js <area> [room index, default the 2nd] [w,h px, default 900,520] [outDir, default tests/tour] */
const path = require('path');
const fs = require('fs');
const { open } = require('./lib');
(async () => {
  const n = +(process.argv[2] || 7), ri = +(process.argv[3] || 1);
  const [vw, vh] = (process.argv[4] || '900,520').split(',').map(Number);
  const out = path.resolve(process.argv[5] || path.join(__dirname, 'tour'));
  fs.mkdirSync(out, { recursive: true });
  const { browser, page, errs } = await open({ levels: true, quiet: true });
  const url = await page.evaluate(([n, ri, vw, vh]) => {
    const St = CH.Storage;
    localStorage.removeItem(St.KEY3);
    St.load();
    St.createSlot({ hero: 'Mercenary', name: 'Mapper' });
    CH.G._scriptTesting = true;
    CH.G.newRun(null);
    const G = CH.G;
    if (CH.Town && CH.Town.inTown) CH.Town.leave();
    G.startWave(n);
    if (CH.Town && CH.Town.inTown) CH.Town.leave();
    const L = G.level;
    const rm = L.rooms[Math.min(ri, L.rooms.length - 1)];
    const x0 = Math.max(0, Math.round(rm.cx - vw / 2)), y0 = Math.max(0, Math.round(rm.cy - vh / 2));
    const c = document.createElement('canvas');
    c.width = vw; c.height = vh;
    const g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, vw, vh);
    const S = CH.Level.TS * 8;
    for (let cy = Math.floor(y0 / S); cy <= Math.floor((y0 + vh) / S); cy++) for (let cx = Math.floor(x0 / S); cx <= Math.floor((x0 + vw) / S); cx++) {
      if (cx < 0 || cy < 0 || cx * 8 >= L.tw || cy * 8 >= L.th) continue;
      g.drawImage(L.chunk(cx, cy), cx * S - x0, cy * S - y0);
    }
    const props = L.props.filter((p) => !p.invisible && p.sprite && CH.Sprites.has(p.sprite)).sort((a, b) => a.y - b.y);
    for (const p of props) {
      const x = p.x - x0, y = p.y - y0;
      if (x < -150 || y < -150 || x > vw + 150 || y > vh + 150) continue;
      g.save();
      g.translate(Math.round(x), Math.round(y));
      if (p.additive) g.globalCompositeOperation = 'lighter';
      CH.Sprites.draw(g, p.sprite, 0, 0, p.flip ? { flip: true } : undefined);
      g.restore();
    }
    return c.toDataURL('image/png');
  }, [n, ri, vw, vh]);
  const f = path.join(out, 'map_a' + String(n).padStart(2, '0') + '_r' + ri + '.png');
  fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64'));
  console.log(f);
  if (errs.length) console.log(errs.slice(0, 5));
  await browser.close();
})();
