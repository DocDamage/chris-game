/* Replay check for refactors: a seeded bot plays a wave run and a level run, and the game state is fingerprinted every
   second of game time. The same code and seed must give the same trace; a refactor that changes no behaviour must too.
     node replay.js [--root <other checkout>] [--seed N] [--secs 90]  > trace.json
     node replay.js --compare a.json b.json        first differing second, or "identical"
   Not part of the suite (run.js only picks up t*_ / test_* files). */
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { open } = require('./lib');

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };

if (args[0] === '--compare') {
  const a = JSON.parse(fs.readFileSync(args[1], 'utf8')), b = JSON.parse(fs.readFileSync(args[2], 'utf8'));
  for (const mode of Object.keys(a)) {
    const n = Math.max(a[mode].length, b[mode].length);
    const i = [...Array(n).keys()].find((k) => JSON.stringify(a[mode][k]) !== JSON.stringify(b[mode][k]));
    console.log(mode + ': ' + (i === undefined ? `identical (${n} samples)` : `differs at second ${i}\n  a ${JSON.stringify(a[mode][i])}\n  b ${JSON.stringify(b[mode][i])}`));
  }
  process.exit(0);
}

(async () => {
  const root = opt('--root', path.resolve(__dirname, '..'));
  const secs = +opt('--secs', 90);
  const trace = {};
  for (const mode of ['waves', 'levels']) {
    const { browser, page } = await open({ url: pathToFileURL(path.join(root, 'index.html')).href, levels: mode === 'levels', seed: +opt('--seed', 1), quiet: true });
    trace[mode] = await page.evaluate((secs) => {
      const G = CH.G, out = [];
      CH.X.startRun({ mode: 'classic' }, null);
      G._scriptTesting = true;
      window.__bot.god = true;
      const r = (v) => Math.round(v);
      for (let s = 0; s < secs; s++) {
        window.__bot.step(60);
        if (G.state === 'levelup') while (G.state === 'levelup') G.pickUpgrade(0);
        let ex = 0, ey = 0;
        for (const e of G.enemies) { ex += e.x; ey += e.y; }
        const p = G.player;
        out.push([s, G.state, G.wave, G.kills, r(G.score), G.coins, r(p.x), r(p.y), r(p.hp), p.level, G.enemies.length, r(ex), r(ey), G.projectiles.length, G.pickups.length]);
      }
      return out;
    }, secs);
    await browser.close();
  }
  process.stdout.write(JSON.stringify(trace));
})();
