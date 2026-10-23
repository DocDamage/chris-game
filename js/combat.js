/* CHAOS.exe - combat feel: perfect dodge, parry, combo buffs, elemental reactions, player status effects,
   environmental kills, boss-beam cover, active reload and hit-stop. Everything wraps the base systems. */
(function (CH) {
  'use strict';
  const { Balance: B, Weapons: W, U, X, FX, Audio, G, Upgrades: Up } = CH;
  const wrap = X.wrap;
  const opts = () => X.opts();
  const chain = (name, fn) => {
    const prev = X[name];
    X[name] = (...a) => {
      if (prev) prev(...a);
      fn(...a);
    };
  };
  X.chain = chain;
  const sfx = (n) => {
    try { Audio.sfx(n); } catch (e) { /* optional */ }
  };
  const alive = (g) => g.players.filter((p) => !p.dead);

  /* ---------- time: slow-mo, hit-stop, game speed ---------- */
  const T = (X.time = { slow: 0, stop: 0 });
  X.hitStop = (s) => {
    if (opts().hitStop !== false) T.stop = Math.max(T.stop, s);
  };
  X.slowMo = (s) => {
    T.slow = Math.max(T.slow, s);
  };
  wrap(G, 'update', function (orig, dt) {
    if (G.state !== 'playing') return orig(dt);
    let k = (opts().gameSpeed || 100) / 100;
    if (T.stop > 0) {
      T.stop -= dt;
      k *= 0.04;
    } else if (T.slow > 0) {
      T.slow -= dt;
      k *= 0.4;
    }
    return orig(dt * k);
  });

  /* ---------- perfect dodge ---------- */
  function perfectDodge(g, p) {
    p._pd = true;
    p.stamina = B.player.stamina;
    p.exhausted = false;
    p.pdCrit = 3;
    X.slowMo(0.55);
    FX.text(p.x, p.y - 22, 'PERFECT DODGE!', '#3ccbe6', 1.5);
    FX.ring(p.x, p.y, 6, 30, '#3ccbe6', 0.3);
    g.screenFlash && g.screenFlash(0.25, '#3ccbe6');
    sfx('parry');
    const m = X.meta();
    m.stats = m.stats || {};
    m.stats.perfectDodges = (m.stats.perfectDodges || 0) + 1;
    g.runStat && g.runStat('perfectDodges', 1);
  }
  wrap(W, 'tryFire', function (orig, g, p, which) {
    if (!(p.pdCrit > 0)) return orig(g, p, which);
    const keep = p.stats.critChance;
    X.critNext = true;
    p.stats.critChance = 1;
    let r;
    try {
      r = orig(g, p, which);
    } finally {
      X.critNext = false;
      p.stats.critChance = keep;
    }
    if (r) p.pdCrit--;
    return r;
  });

  /* ---------- parry ---------- */
  wrap(G, 'deflectProjectiles', function (orig, x, y, r, ang, arc, who) {
    let before = 0;
    for (const pr of G.projectiles) if (pr.owner === 'e' && !pr.dead) before++;
    orig.call(G, x, y, r, ang, arc, who);
    let after = 0;
    for (const pr of G.projectiles) if (pr.owner === 'e' && !pr.dead) after++;
    if (before > after) {
      const p = who || G.player;
      let hit = 0;
      for (const e of G.enemies) {
        if (e.dead || e.state === 'spawn' || U.dist(e.x, e.y, x, y) > r + 38) continue;
        if (e.stun && !e.isBoss) e.stun(0.9);
        X.hitEnemy(e, 22 * p.stats.dmgMult, p, 'wind');
        hit++;
      }
      FX.text(p.x, p.y - 24, 'PARRY!' + (hit ? ' COUNTER' : ''), '#fee761', 1.5);
      X.hitStop(0.08);
      p.stamina = Math.min(B.player.stamina, p.stamina + 20);
    }
  });

  /* ---------- combo meter buffs ---------- */
  X.comboTier = 0;
  X.statHooks.push((p, s) => {
    const t = X.comboTier;
    if (t >= 1) s.fireRate *= 1.08;
    if (t >= 2) s.speedMult *= 1.1;
    if (t >= 3) s.dmgMult *= 1.15;
    if (p.arT > 0) s.dmgMult *= 1.25;
  });
  X.comboBuffText = () => ['', 'FIRE RATE +8%', '+MOVE SPEED +10%', '+DAMAGE +15%'][X.comboTier] || '';
  function updateCombo(g) {
    const m = g.comboMult();
    const t = m >= 3 ? 3 : m >= 2 ? 2 : m >= 1.5 ? 1 : 0;
    if (t === X.comboTier) return;
    const up = t > X.comboTier;
    X.comboTier = t;
    for (const p of g.players) Up.recalc(p);
    const p = g.player;
    if (p && up) FX.text(p.x, p.y - 30, 'COMBO BUFF: ' + X.comboBuffText(), '#3ccbe6', 1);
    else if (p && !up && t === 0) FX.text(p.x, p.y - 30, 'COMBO LOST', '#e43b44', 1);
  }

  /* ---------- elemental reactions ---------- */
  let reacting = false;
  const inCheese = (e) => G.zones.some((z) => z.kind === 'cheese' && G.inZone(z, e.x, e.y, 0));
  chain('onDamage', (e, dmg, o) => {
    if (reacting || !o) return;
    if (o.elem === 'ice') e.chillT = G.time + 3.5;
    const p = o.shooter || G.player;
    if (o.elem === 'fire' && !e.burnT && inCheese(e)) {
      e.burnT = 3.5;
      e.burnP = p;
      FX.text(e.x, e.y - e.r - 10, 'FONDUE BURN!', '#feae34', 1);
      FX.burst(e.x, e.y, { n: 8, colors: ['#feae34', '#fee761', '#f77622'], speed: 60, life: 0.5 });
    }
    if (o.elem === 'earth' && e.chillT > G.time && !e.dead) {
      e.chillT = 0;
      reacting = true;
      X.hitEnemy(e, dmg * 0.8 + 10, p, 'phys');
      reacting = false;
      if (e.stun && !e.isBoss) e.stun(0.7);
      FX.text(e.x, e.y - e.r - 10, 'SHATTER!', '#8be9ff', 1.5);
      FX.burst(e.x, e.y, { n: 12, colors: ['#ffffff', '#8be9ff', '#3ccbe6'], speed: 110, life: 0.5 });
      X.hitStop(0.05);
      CH.X.reaction && CH.X.reaction('shatter');
    }
    if (o.crit) X.hitStop(Math.min(0.06, 0.03 + dmg / 4000));
    else if (dmg >= 40 && !e.isBoss) X.hitStop(0.035);
  });
  function stepBurn(g, dt) {
    for (const e of g.enemies) {
      if (e.dead || !(e.burnT > 0)) continue;
      e.burnT -= dt;
      e.burnTick = (e.burnTick || 0) - dt;
      if (e.burnTick <= 0) {
        e.burnTick = 0.5;
        reacting = true;
        X.hitEnemy(e, 5 * ((e.burnP && e.burnP.stats && e.burnP.stats.dmgMult) || 1) + e.maxHp * 0.01, e.burnP || g.player, 'phys');
        reacting = false;
        FX.burst(e.x, e.y - 4, { n: 2, colors: ['#feae34', '#f77622'], speed: 25, up: 30, life: 0.4 });
      }
    }
  }

  /* ---------- status effects on the player ---------- */
  const isWeb = (src) => src && src.sprite === 'vfx.p5.23';
  wrap(G, 'hurtPlayer', function (orig, dmg, src, o) {
    const p = (o && o.p) || G.player;
    const r = orig.call(G, dmg, src, o);
    if (r > 0 && p && !p.dead) {
      if (isWeb(src)) {
        p.rootT = 1.0;
        FX.text(p.x, p.y - 26, 'WEBBED!', '#e0e0e0', 1);
      }
      const el = CH.Kit.elemOf(src);
      if (el === 'toxic' && !isWeb(src)) {
        if (!(p.poisonT > 0)) FX.text(p.x, p.y - 26, 'POISONED', '#63c74d', 1);
        p.poisonT = 5;
      }
      if (el === 'ice' && !isWeb(src)) {
        p.slowT = Math.max(p.slowT, 2.5);
        FX.text(p.x, p.y - 26, 'FROZEN SLOW', '#8be9ff', 1);
      }
    }
    return r;
  });
  wrap(G, 'healPlayer', function (orig, raw, p) {
    p = p || G.player;
    if (p && p.poisonT > 0) {
      if (G.time - (p._pTxt || -9) > 1.2) {
        p._pTxt = G.time;
        FX.text(p.x, p.y - 16, 'POISONED: NO HEALING', '#63c74d', 1);
      }
      return 0;
    }
    return orig.call(G, raw, p);
  });
  X.cleanse = (p) => {
    p.poisonT = 0;
    p.rootT = 0;
    p.slowT = 0;
    FX.text(p.x, p.y - 24, 'CLEANSED', '#ffffff', 1);
  };
  wrap(G, 'collect', function (orig, pk, who) {
    const p = who || G.player;
    if (pk && pk.type === 'hp' && p && (p.poisonT > 0 || p.rootT > 0 || p.slowT > 0)) X.cleanse(p);
    return orig.call(G, pk, who);
  });
  wrap(CH.Player.prototype, 'update', function (orig, g, dt) {
    const x0 = this.x, y0 = this.y;
    orig.call(this, g, dt);
    if (this.poisonT > 0) this.poisonT -= dt;
    if (this.rootT > 0) {
      this.rootT -= dt;
      if (this.rolling) this.rootT = 0;
      else {
        this.x = x0;
        this.y = y0;
        this.kx = 0;
        this.ky = 0;
      }
    }
    if (this.arT > 0) {
      this.arT -= dt;
      if (this.arT <= 0) Up.recalc(this);
    }
    if (!this.rolling) this._pd = false;
  });

  /* ---------- environmental kills ---------- */
  X.envUntil = 0;
  wrap(W, 'damageProp', function (orig, g, prop, dmg, player) {
    const wasDead = prop && prop.dead;
    const r = orig.call(W, g, prop, dmg, player);
    if (prop && !wasDead && prop.dead && (prop.kind === 'barrel' || prop.kind === 'car')) X.envUntil = G.time + 0.35;
    return r;
  });
  wrap(G, 'damageEnemy', function (orig, e, dmg, o) {
    if (!e.dead) e._env = !(o && (o.shooter || o.src === 'player'));
    return orig.call(G, e, dmg, o);
  });
  X.envKills = 0;
  G.on('kill', function (e) {
    if (e.isBoss) return;
    if (e._env || G.time < X.envUntil) {
      X.envKills++;
      G.addScore(Math.round(50 * G.scoreMult()));
      G.dropPickup('coin', e.x, e.y, 2);
      FX.text(e.x, e.y - 14, 'ENVIRONMENTAL!', '#ffb36b', 1);
      const m = X.meta();
      m.stats = m.stats || {};
      m.stats.envKills = (m.stats.envKills || 0) + 1;
      G.runStat && G.runStat('envKills', 1);
    }
  });
  function stepLancers(g, dt) {
    for (const e of g.enemies) {
      if (e.dead || e.type !== 'cart' || !e.hot) continue;
      for (const o of g.enemies) {
        if (o === e || o.dead || o.isBoss || o.state === 'spawn') continue;
        if (o._lcd > g.time) continue;
        if (Math.hypot(o.x - e.x, o.y - e.y) < e.r + o.r + 2) {
          o._lcd = g.time + 0.6;
          const a = Math.atan2(o.y - e.y, o.x - e.x);
          g.damageEnemy(o, 24, { kx: Math.cos(a), ky: Math.sin(a), kf: 220, stun: 0.3, elem: 'earth' });
          FX.text(o.x, o.y - 12, 'RUN OVER', '#ffb36b', 1);
        }
      }
    }
  }

  /* ---------- boss beams are blocked by solid cover (which then breaks) ---------- */
  wrap(G, 'updateZones', function (orig, dt) {
    const props = G.arena && G.arena.props;
    if (props) {
      for (const z of G.zones) {
        if (z.kind !== 'beam' || !z.once || z.shape !== 'line') continue;
        const ex = Math.cos(z.ang), ey = Math.sin(z.ang);
        let bestT = z.len, hitProp = null;
        for (const pr of props) {
          if (pr.dead || !pr.solid || pr.falling || pr.kind === 'tree') continue;
          const px = pr.x + (pr.cx || 0), py = pr.y + (pr.cy || 0);
          const t = U.clamp((px - z.x) * ex + (py - z.y) * ey, 0, z.len);
          if (Math.hypot(px - (z.x + ex * t), py - (z.y + ey * t)) < z.w / 2 + (pr.cr || 10) && t < bestT) {
            bestT = t;
            hitProp = pr;
          }
        }
        if (hitProp) {
          z.len = bestT;
          FX.text(hitProp.x, hitProp.y - 18, 'BLOCKED', '#3ccbe6', 1);
          if (hitProp.destructible) {
            hitProp.hp = Math.min(hitProp.hp, 1);
            W.damageProp(G, hitProp, 999, null);
            FX.text(hitProp.x, hitProp.y - 28, 'COVER BROKE', '#e43b44', 1);
          }
        }
      }
    }
    return orig.call(G, dt);
  });

  /* ---------- active reload ---------- */
  wrap(W, 'startReload', function (orig, p, id) {
    const d = B.weapons[id];
    const ws = p.ws[id];
    if (d.ammo && ws && ws.reload > 0 && p.ar && p.ar.id === id && !p.ar.done) {
      const f = 1 - ws.reload / p.ar.total;
      p.ar.done = true;
      if (f >= 0.4 && f <= 0.65) {
        ws.reload = 0.001;
        p.arT = 3.5;
        Up.recalc(p);
        FX.text(p.x, p.y - 24, 'ACTIVE RELOAD!', '#fee761', 1.5);
        sfx('item_get');
      } else {
        ws.reload += 0.5;
        FX.text(p.x, p.y - 24, 'JAMMED', '#e43b44', 1);
      }
      return false;
    }
    const r = orig(p, id);
    if (r) p.ar = { id, total: ws.reload, done: false };
    return r;
  });
  CH.Hooks.world.push((ctx, cam, v) => {
    for (const p of G.players || []) {
      if (p.dead) continue;
      const sx = Math.round(p.x - cam.x), sy = Math.round(p.y - cam.y);
      const ws = p.ar && p.ws[p.ar.id];
      if (ws && ws.reload > 0 && !p.ar.done) {
        const f = 1 - ws.reload / p.ar.total;
        ctx.fillStyle = '#1b1226';
        ctx.fillRect(sx - 13, sy - 24, 26, 4);
        ctx.fillStyle = '#63c74d';
        ctx.fillRect(sx - 13 + 26 * 0.4, sy - 24, 26 * 0.25, 4);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(sx - 13 + Math.round(26 * f), sy - 25, 1, 6);
      }
      let line = 0;
      const tag = (t, c) => {
        CH.Font.draw(ctx, t, sx, sy - 30 - line * 7, c, 1, true);
        line++;
      };
      if (p.rootT > 0) tag('ROOTED', '#e0e0e0');
      if (p.poisonT > 0) tag('POISON', '#63c74d');
      if (p.slowT > 0) tag('SLOWED', '#8be9ff');
    }
  });

  /* ---------- per-step driver ---------- */
  G.on('step', function (dt) {
    if (G.state !== 'playing') return;
    updateCombo(G);
    stepBurn(G, dt);
    stepLancers(G, dt);
    for (const p of alive(G)) {
      if (!p.rolling || p._pd) continue;
      let near = false;
      for (const pr of G.projectiles) {
        if (pr.owner !== 'e' || pr.dead) continue;
        if (Math.hypot(pr.x - p.x, pr.y - p.y) < p.r + (pr.r || 3) + 12) {
          near = true;
          break;
        }
      }
      if (!near) {
        for (const e of G.enemies) {
          if (e.dead || e.state === 'spawn' || !e.canTouch || !e.canTouch()) continue;
          if (Math.hypot(e.x - p.x, e.y - p.y) < e.r + p.r + 5) {
            near = true;
            break;
          }
        }
      }
      if (near) perfectDodge(G, p);
    }
  });

  wrap(X, 'reset', function (orig) {
    orig();
    T.slow = 0;
    T.stop = 0;
    X.comboTier = 0;
    X.envUntil = 0;
    X.envKills = 0;
  });
})(window.CH);
