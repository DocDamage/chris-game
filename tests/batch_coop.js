/* Co-op balance: two human-like bots (one per hero, scripted inputs) play whole runs.
   usage: node batch_coop.js <difficulty> <runs> [profile]      e.g. node batch_coop.js normal 6 human */
const { openPad } = require('./padlib');

/* the same dodge / kite / pick-up logic as the single-player bot, per hero, writing a scripted PlayerInput */
const INSTALL = () => {
  const G = CH.G;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const state = [{}, {}];
  const prefs = ['bonk', 'multi', 'crit', 'life', 'skull', 'speed', 'boom', 'magnet', 'loot'];
  window.__hits = { total: [0, 0], bySrc: {} };
  const orig = G.hurtPlayer;
  G.hurtPlayer = function (dmg, src, o) {
    const r = orig.call(G, dmg, src, o);
    if (r > 0) {
      const p = (o && o.p) || G.player;
      window.__hits.total[p.idx] += r;
      const k = (src && (src.type || src.kind)) || 'zone/other';
      window.__hits.bySrc[k] = (window.__hits.bySrc[k] || 0) + r;
    }
    return r;
  };

  function think(p, st, human) {
    const inp = p.inp;
    const tick = (st.tick = (st.tick || 0) + 1);
    let near = null;
    let nd = 1e9;
    for (const e of G.enemies) {
      if (e.dead || e.state === 'spawn' || e.hidden) continue;
      const d = dist(e, p) - e.r;
      if (d < nd) {
        nd = d;
        near = e;
      }
    }
    if (tick % 120 === 1) {
      for (const w of ['pizza', 'chicken', 'problem', 'chair', 'junk']) {
        if (p.weapons.includes(w)) {
          if (p.weapon !== w) p.selectWeapon(w);
          break;
        }
      }
    }
    // aim + fire track the closest enemy every frame
    const tgt = near || { x: p.x + 1, y: p.y };
    inp.aimAngle = Math.atan2(tgt.y - (p.y - 6), tgt.x - p.x) + (human ? (Math.random() - 0.5) * 2 * human.jitter * 0.9 : 0);
    inp.aimDist = Math.hypot(tgt.x - p.x, tgt.y - p.y);
    inp.fire1 = !!near && nd < (p.weapon === 'baguette' ? 42 : 280);
    inp.fire2 = !window.__nofire2 && !!p.weapon2 && !!near && nd < (p.weapon2 === 'baguette' ? 42 : 280) && p.weapon2 !== 'baguette';
    inp.am = 0;
    // movement decisions are re-made every `reaction` frames
    if (human && tick % human.reaction !== 0 && st.mv) {
      inp.mx = st.mv.x;
      inp.my = st.mv.y;
      inp.sprint = st.mv.sprint;
      return;
    }
    let vx = 0;
    let vy = 0;
    let danger = 0;
    let crowd = 0;
    for (const e of G.enemies) {
      if (e.dead || e.state === 'spawn' || e.hidden) continue;
      const d = Math.max(1, dist(e, p));
      const rng = e.isBoss ? 140 : p.weapon === 'baguette' ? 40 : 95;
      if (d < rng) {
        const w = ((rng - d) / rng) * (e.isBoss ? 2 : 1);
        vx -= ((e.x - p.x) / d) * w;
        vy -= ((e.y - p.y) / d) * w;
        danger += w;
        crowd++;
      }
      if (e.tele && e.tele.t > 0 && d < 160) {
        const a = Math.atan2(p.y - e.y, p.x - e.x);
        vx += Math.cos(a) * 1.5;
        vy += Math.sin(a) * 1.5;
        danger += 1;
      }
    }
    let dodge = false;
    for (const pr of G.projectiles) {
      if (pr.owner !== 'e') continue;
      const d = dist(pr, p);
      if (d < 70) {
        const rel = Math.atan2(pr.vy, pr.vx);
        const nx = -Math.sin(rel);
        const ny = Math.cos(rel);
        const side = (p.x - pr.x) * nx + (p.y - pr.y) * ny >= 0 ? 1 : -1;
        vx += (nx * side * (70 - d)) / 30;
        vy += (ny * side * (70 - d)) / 30;
        danger += 0.5;
        if (d < 22 && p.rollCd <= 0 && p.stamina >= 20) dodge = true;
      }
    }
    for (const z of G.zones) {
      if (z.kind === 'cheese') continue;
      if (z.shape === 'line') {
        if (G.inZone(z, p.x, p.y, 8)) {
          const nx = -Math.sin(z.ang);
          const ny = Math.cos(z.ang);
          const side = (p.x - z.x) * nx + (p.y - z.y) * ny >= 0 ? 1 : -1;
          vx += nx * side * 3;
          vy += ny * side * 3;
          danger += 2;
        }
      } else {
        const d = dist(z, p);
        if (d < z.r + 18) {
          const a = Math.atan2(p.y - z.y, p.x - z.x);
          vx += Math.cos(a) * 2.5;
          vy += Math.sin(a) * 2.5;
          danger += 1;
        }
      }
    }
    let pk = null;
    let pd = 150;
    for (const k of G.pickups) {
      if (k.collected) continue;
      const d = dist(k, p);
      if (d < pd) {
        pd = d;
        pk = k;
      }
    }
    if (pk && danger < 1.2) {
      const a = Math.atan2(pk.y - p.y, pk.x - p.x);
      vx += Math.cos(a) * 0.9;
      vy += Math.sin(a) * 0.9;
    }
    if (near && nd > 130 && danger < 0.3 && !pk) {
      const a = Math.atan2(near.y - p.y, near.x - p.x);
      vx += Math.cos(a) * 0.5;
      vy += Math.sin(a) * 0.5;
    }
    if (near && nd < 140) {
      const a = Math.atan2(near.y - p.y, near.x - p.x) + Math.PI / 2;
      vx += Math.cos(a) * 0.35;
      vy += Math.sin(a) * 0.35;
    }
    // a living partner: keep a few steps apart but not far, so the party stays together
    const mate = G.players.find((q) => q !== p && !q.dead);
    if (mate) {
      const d = dist(mate, p);
      if (d > 180) {
        const a = Math.atan2(mate.y - p.y, mate.x - p.x);
        vx += Math.cos(a) * 0.5;
        vy += Math.sin(a) * 0.5;
      }
    }
    // go to a downed partner and stay with them
    const down = G.players.find((q) => q !== p && q.dead);
    if (down && danger < 2) {
      const d = dist(down, p);
      if (d > 8) {
        const a = Math.atan2(down.y - p.y, down.x - p.x);
        vx += Math.cos(a) * 1.4;
        vy += Math.sin(a) * 1.4;
      }
    }
    const m = 60;
    if (p.x < m) vx += ((m - p.x) / m) * 2;
    if (p.x > G.arena.w - m) vx -= ((p.x - (G.arena.w - m)) / m) * 2;
    if (p.y < m) vy += ((m - p.y) / m) * 2;
    if (p.y > G.arena.h - m) vy -= ((p.y - (G.arena.h - m)) / m) * 2;
    if (G.machine && G.machine.uses > 0 && G.coins >= 25) {
      const d = dist(G.machine, p);
      if (d > 28) {
        const a = Math.atan2(G.machine.y - p.y, G.machine.x - p.x);
        vx += Math.cos(a) * 0.8;
        vy += Math.sin(a) * 0.8;
      } else inp.edges.interact = true;
    }
    if (G.mods.reverse) {
      vx = -vx;
      vy = -vy;
    }
    const l = Math.hypot(vx, vy);
    let mx = 0;
    let my = 0;
    if (l > 0.25) {
      vx /= l;
      vy /= l;
      mx = Math.abs(vx) > 0.35 ? Math.sign(vx) : 0;
      my = Math.abs(vy) > 0.35 ? Math.sign(vy) : 0;
      if (mx && my) {
        mx *= Math.SQRT1_2;
        my *= Math.SQRT1_2;
      }
    }
    const sprint = danger > 1.5 && p.stamina > 30;
    st.mv = { x: mx, y: my, sprint };
    inp.mx = mx;
    inp.my = my;
    inp.sprint = sprint;
    for (const e of G.enemies) {
      if (e.dead || !e.canTouch || !e.canTouch()) continue;
      if (e.hot && dist(e, p) < e.r + 22 && p.rollCd <= 0 && p.stamina >= 20 && p.canBeHurt) {
        dodge = true;
        break;
      }
    }
    if (dodge && (!human || Math.random() < 0.6)) inp.edges.dodge = true;
    if (p.hp / p.maxHp < 0.45 && crowd >= 3 && p.specialCd <= 0) inp.edges.special = true;
  }

  /* run n frames with both bots at the controls, picking level-up cards as they appear */
  window.__playCoop = (n, human) => {
    const out = { frames: 0 };
    for (let i = 0; i < n; i++) {
      if (G.state === 'levelup') {
        const cards = G.cards;
        let idx = 0;
        let best = -1;
        cards.forEach((c, k) => {
          let sc = 1;
          if (c.kind === 'weapon') sc = 8;
          else if (c.kind === 'upgrade') {
            const j = prefs.indexOf(c.id);
            sc = j < 0 ? 2 : 6 - j * 0.4;
          } else if (c.kind === 'weaponup') sc = 4;
          if (sc > best) {
            best = sc;
            idx = k;
          }
        });
        G.pickUpgrade(idx);
      } else if (G.state === 'playing') {
        G.players.forEach((p, k) => {
          if (!p.dead) think(p, state[k], human);
          else p.inp.mx = p.inp.my = 0;
        });
      } else break;
      G.update(1 / 60);
      if (i % 5 === 0) G.render();
      CH.Input.endFrame();
      out.frames++;
    }
    return { state: G.state, wave: G.wave, t: Math.round(G.time), kills: G.kills, lvl: G.players.map((p) => p.level), hp: G.players.map((p) => Math.round(p.hp)), dead: G.players.map((p) => p.dead), split: G.viewMode };
  };
};

(async () => {
  const diff = process.argv[2] || 'normal';
  const runs = +process.argv[3] || 4;
  const profiles = { perfect: null, human: { reaction: 14, jitter: 0.09, mistake: 0.12 }, sloppy: { reaction: 24, jitter: 0.16, mistake: 0.25 } };
  const prof = process.argv[4] || 'human';
  const { browser, page, errs } = await openPad();
  await page.evaluate(INSTALL);
  if (process.env.NOFIRE2) await page.evaluate(() => (window.__nofire2 = true)); // the single-player bot only ever fires one weapon
  if (process.env.COOP) await page.evaluate((o) => Object.assign(CH.Balance.coop, o), JSON.parse(process.env.COOP)); // balance experiments
  const res = [];
  for (let r = 0; r < runs; r++) {
    await page.evaluate(
      ([diff]) => {
        CH.Storage.settings.difficulty = diff;
        window.__hits.total = [0, 0];
        window.__hits.bySrc = {};
        CH.G.newRun({ players: [{ hero: ['Mercenary', 'Dreadbloom', 'Vexaria'][Math.floor(Math.random() * 3)], src: { kind: 'script' } }, { hero: ['Mercenary', 'Dreadbloom', 'Vexaria'][Math.floor(Math.random() * 3)], src: { kind: 'script' } }] });
      },
      [diff]
    );
    let steps = 0;
    let snap;
    let splits = 0;
    while (steps < 60 * 60 * 25) {
      snap = await page.evaluate((h) => window.__playCoop(600, h), profiles[prof]);
      steps += 600;
      if (snap.split === 'split') splits++;
      if (snap.state === 'gameover' || snap.state === 'victory') break;
    }
    const hits = await page.evaluate(() => window.__hits);
    const heroes = await page.evaluate(() => CH.G.players.map((p) => p.hero.id));
    const row = { end: snap.state, wave: snap.wave, t: snap.t, lvl: snap.lvl[0], kills: snap.kills, heroes: heroes.join('+'), dmgTaken: hits.total.map(Math.round), splitSamples: splits };
    if (snap.state === 'gameover') row.killers = Object.entries(hits.bySrc).sort((a, b) => b[1] - a[1]).slice(0, 3).map((x) => x[0] + ':' + Math.round(x[1])).join(' ');
    res.push(row);
    console.log(JSON.stringify(row));
  }
  console.log('co-op', diff, prof, 'wins', res.filter((x) => x.end === 'victory').length + '/' + runs, 'errors:', errs.length ? errs.join('\n') : 'none', JSON.stringify(await page.evaluate(() => CH.errors)));
  await browser.close();
})();
