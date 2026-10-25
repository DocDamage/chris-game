/* How much of each stage pack the generated world really shows (PLAN.md 21): builds every area of the world with a few
   seeds, paints all of each stage's chunks, and records every piece placed as a prop, painted as a decal, a floor
   stamp or a wall face (a drawImage hook maps the pack images back to their keys). Prints, per pack and per sheet, how
   many of its pieces appeared, and writes the full list of unused pieces to tests/tour/unused.json.
     node tests/audit_assets.js [seeds per area, default 2] [areas, default 1-48]
   Not a test: it never fails. */
const path = require('path');
const fs = require('fs');
const { open } = require('./lib');
(async () => {
  const seeds = +(process.argv[2] || 2);
  const areas = process.argv[3] ? process.argv[3].split(',').map(Number) : Array.from({ length: 49 }, (_, i) => i + 1);
  const { browser, page, errs } = await open({ levels: true, quiet: true });
  await page.evaluate(() => {
    const St = CH.Storage;
    localStorage.removeItem(St.KEY3);
    St.load();
    St.createSlot({ hero: 'Mercenary', name: 'Auditor' });
    CH.G._scriptTesting = true;
    CH.G.newRun(null);
    const IM = CH.Assets.images;
    const rev = new Map();
    for (const k of Object.keys(IM)) rev.set(IM[k], k);
    window.__used = new Set();
    const di = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (im) {
      const k = rev.get(im);
      if (k && window.__rec) window.__used.add(k);
      return di.apply(this, arguments);
    };
  });
  for (const n of areas) for (let s = 0; s < seeds; s++) {
    await page.evaluate(([n, s]) => {
      const G = CH.G;
      if (CH.Town && CH.Town.inTown) CH.Town.leave();
      if (G.world) G.world.seed = (G.world.seed || 1) + s * 7919;
      window.__rec = true;
      G.startWave(n);
      if (CH.Town && CH.Town.inTown) CH.Town.leave();
      const L = G.level;
      if (!L) return;
      const U = window.__used;
      for (const p of L.props) { if (p.sheet) U.add(p.sheet); else if (p.sprite && (CH.Assets.images[p.sprite] || p.sprite.startsWith('obj.'))) U.add(p.sprite); if (p.src) U.add(p.src); }
      for (const q of L.inlays || []) U.add(CH.Assets.images['kit.' + q.key] ? 'kit.' + q.key : q.key);
      for (const d of L.decals || []) if (d.key) U.add(d.key);
      for (const k of L.wallKeys || []) U.add(k);
      const CHK = 8;
      for (let cy = 0; cy < Math.ceil(L.th / CHK); cy++) for (let cx = 0; cx < Math.ceil(L.tw / CHK); cx++) L.chunk(cx, cy);
      // the rooms of the stage's buildings
      // the last area: the sky road, then the belly inside the tower (js/sky.js)
      if (L.biome === 'sky' && CH.Sky) {
        L.exit.open = true;
        CH.Sky.enterTower();
        const B = G.level;
        for (let cy = 0; cy < Math.ceil(B.th / CHK); cy++) for (let cx = 0; cx < Math.ceil(B.tw / CHK); cx++) B.chunk(cx, cy);
        for (const p of B.props) if (p.sheet) U.add(p.sheet);
        for (const d of B.decals || []) if (d.key) U.add(d.key);
        for (const k of B.wallKeys || []) U.add(k);
        for (const p of B.props) if (p.sprite && p.sprite.startsWith('obj.')) U.add(p.sprite);
        for (const q of B.inlays || []) U.add(CH.Assets.images['kit.' + q.key] ? 'kit.' + q.key : q.key);
      }
      if (CH.Interiors && CH.Interiors.build) for (const p of L.props) if (p.enter) { try { const R = CH.Interiors.build(p, true); if (R && R.props) for (const q of R.props) if (q.sheet) U.add(q.sheet); } catch (e) {} }
      window.__rec = false;
    }, [n, s]);
  }
  const res = await page.evaluate(() => {
    const M = CH.Assets.meta || {}, used = window.__used, out = {};
    // a pack's autotile blocks and particle frames are the sources the floors, walls and weather are cut from, not pieces
    const SOURCE = { particle: 1, junk: 1 }; // the snowflakes: drawn by the weather (js/atmos.js), which the audit does not run
    const add = (pack, sheet, key, kind) => {
      if (SOURCE[kind]) return;
      const P = (out[pack] = out[pack] || { n: 0, used: 0, sheets: {} });
      const S2 = (P.sheets[sheet] = P.sheets[sheet] || { n: 0, used: 0, unused: [] });
      P.n++; S2.n++;
      if (used.has(key)) { P.used++; S2.used++; } else S2.unused.push(key.split('.').pop() + (kind ? ':' + kind : ''));
    };
    for (const id of Object.keys(M.kits || {})) {
      const m = M.kits[id];
      if (!m || !m.n) continue;
      for (let i = 0; i < m.n; i++) add(m.pack, id, 'kit.' + id + '.' + i, CH.Props.kindOf('kit.' + id + '.' + i) || (m.kinds && m.kinds[i]) || m.roles[i]);
    }
    for (const id of Object.keys(M.sheets || {})) {
      const m = M.sheets[id];
      for (let i = 0; i < m.n; i++) add('sheets:' + id[0], id, 'sh.' + id + '.' + i, CH.Props.kindOf('sh.' + id + '.' + i));
    }
    // the Valley Ruin's objects (js/setpieces.js OBJ): on the sky road's islands
    for (const k of [...new Set(Object.values(CH.SetPieces.OBJ).flat())]) if (CH.Sprites.has(k)) add('Valley Ruin', 'obj', k, null);
    const LD = M.lands || {};
    for (const id of Object.keys(LD.sheets || {})) {
      const m = LD.sheets[id];
      if (!m.kinds) { if (CH.Assets.images['kit.' + id]) add(m.pack || 'Final Tower', id, 'kit.' + id, null); continue; }
      for (let i = 0; i < m.n; i++) add(m.pack, id, 'kit.' + id + '.' + i, m.kinds[i]);
    }
    const APACK = { fi: 'Flying Islands', mb: "Monster's Belly", ft: 'Final Tower', sb: 'Seabed' };
    for (const name of Object.keys(LD.anims || {})) {
      const key = 'anim.' + name;
      if ([...Array(LD.anims[name].n).keys()].some((i) => used.has(key + '.' + i))) used.add(key);
      add(APACK[name.slice(0, 2)] || 'anims', 'anim:' + name.slice(0, 2), key, LD.anims[name].kind);
    }
    return out;
  });
  const dir = path.join(__dirname, 'tour');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'unused.json'), JSON.stringify(res, null, 1));
  let N = 0, Uu = 0;
  for (const [pack, P] of Object.entries(res).sort()) {
    N += P.n; Uu += P.used;
    const byK = {}; for (const S2 of Object.values(P.sheets)) for (const u of S2.unused) { const k = u.split(':')[1] || '?'; byK[k] = (byK[k] || 0) + 1; }
    console.log((pack + ':').padEnd(30), String(P.used).padStart(5), '/', String(P.n).padEnd(5), (100 * P.used / P.n).toFixed(0).padStart(3) + '%', ' unused by kind:', JSON.stringify(byK));
    for (const [id, S2] of Object.entries(P.sheets)) if (S2.used < S2.n) console.log('   ', id.padEnd(14), String(S2.used).padStart(4), '/', String(S2.n).padEnd(4), S2.unused.slice(0, 14).join(' ') + (S2.unused.length > 14 ? ' ...' : ''));
  }
  console.log('ALL'.padEnd(30), Uu, '/', N, (100 * Uu / N).toFixed(0) + '%');
  if (errs.length) console.log('console errors:', errs.slice(0, 5));
  await browser.close();
})();
