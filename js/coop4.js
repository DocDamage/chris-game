/* CHAOS.exe - 3-4 player co-op support and the downed-hero crawl.
   - Co-op difficulty scales with the party size (the base numbers in balance.js are tuned for two heroes).
   - A downed hero is not out of the game: they can crawl slowly (movement stick / keys) and take weak shots at a
     partner-saving pace until a teammate revives them. */
(function (CH) {
  'use strict';
  const B = CH.Balance;
  const U = CH.U;
  const G = CH.G;
  const X = CH.X;

  const BASE = Object.assign({}, B.coop);
  X.applyCoopScale = (n) => {
    Object.assign(B.coop, BASE);
    if (n <= 2) return;
    const f = 1 + 0.4 * (n - 2);
    B.coop.count = BASE.count * f;
    B.coop.aliveCap = BASE.aliveCap * f;
    B.coop.bossHp = BASE.bossHp * f;
    B.coop.enemyHp = BASE.enemyHp * (1 + 0.15 * (n - 2));
    B.coop.xpMul = BASE.xpMul / f;
  };

  G.on('newRun:before', function (ev) {
    const cfg = ev.config === undefined ? G.lastConfig : ev.config;
    X.applyCoopScale(cfg && cfg.players ? Math.min(4, cfg.players.length) : 1);
  });

  /* ---- crawling ---- */
  const CRAWL_SPEED = 26;
  X.crawl = (p) => G.coop && p.dead && !G.allDead() && G.state === 'playing';
  G.on('playerUpdate', function (ev) {
    const p = ev.p, g = ev.g, dt = ev.dt;
    if (!X.crawl(p)) {
      p.crawling = false;
      return;
    }
    const inp = p.inp;
    p.updateAim(g, dt);
    p.crawling = inp.mx !== 0 || inp.my !== 0;
    const m = B.arena.margin + p.r;
    p.x = U.clamp(p.x + inp.mx * CRAWL_SPEED * dt, m, g.arena.w - m);
    p.y = U.clamp(p.y + inp.my * CRAWL_SPEED * dt, m, g.arena.h - m);
    p.face = Math.cos(p.aim) >= 0 ? 1 : -1;
    p._crawlT = (p._crawlT || 0) - dt;
    if ((inp.fire1 || inp.fire2) && p._crawlT <= 0) {
      p._crawlT = 0.85;
      g.spawnProjectile({ owner: 'p', shooter: p, kind: 'junk', x: p.x, y: p.y - 4, ang: p.aim, speed: 210, r: 2.5, dmg: 4 * ((p.stats && p.stats.dmgMult) || 1), life: 0.6, sprite: 'junk' + U.randInt(0, 5), spin: 10, knock: 30, trail: 'junk' });
      CH.Audio.sfx('shoot_junk');
    }
  });
})(window.CH);
